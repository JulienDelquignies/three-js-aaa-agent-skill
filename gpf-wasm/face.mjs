// face.mjs — LE FACE-À-FACE « TAARABT » DANS LE 11 CONTRE 11 : la loi de face.js (branche duel, feat/1v1-maquette), portée sur les corps
// de Gameplay Football. La référence (Taarabt, image par image ; Headrick, thèse QUT) : planté à 1,5-2 m du défenseur, la semelle sur le
// ballon, une feinte toutes les 0,3-0,6 s, 2 à 4 par duel, le défenseur qui finit par se jeter, puis le départ ; un face-à-face de 3,3 à 5 s.
//
// CE QUI CHANGE AVEC LE CORPS. Dans le duel, la loi lance des gestes dans le monde du moteur à chaque image (60 Hz). Ici elle tourne à chaque
// tick de l'adaptateur (100 ms) et pose des INTENTIONS : le geste n° N de notre répertoire (gestes/*.anim, intention GESTE), conduire à
// l'arrêt (la tenue), aller (la garde du défenseur), presser (sa fente). Le corps joue les gestes et décide des contacts. L'instant où un
// geste démarre vraiment vient du journal (GF_EV_GESTE) : la morsure se juge au contact de la feinte réellement jouée.
//
// LA LOI (face.js, inchangée dans ses seuils, la configuration du duel) :
//   ENTRÉE   le porteur de champ, ballon au pied devant lui, un défenseur de champ DEVANT (côté but, cône 50°) à 1-2,6 m freinage compris,
//            face à lui (≤ 70°), hors de la zone de tir (≥ 6,5 m du but) — au tirage de l'envie (0,7 + 0,3 × flair). En 11 contre 11, deux
//            portes de plus : un VRAI un-contre-un (aucun autre adversaire à moins de 4 m du porteur) et le choix du cerveau, CONDUIRE.
//   TENUE    l'arrêt de semelle, puis planté, la semelle sur le ballon ; toutes les 0,1-0,35 s après un geste, une FEINTE au tirage : le
//            passement (0,3 × le flair ; parfois une série de 2 à 4), la feinte de corps semelle dessus (0,25), sinon le roulé de semelle.
//   MORSURE  au contact de la feinte, le défenseur mord avec p = (0,15 + 0,12 × feintes vues) × vente × gesteF × (2 − anticipF), au plus
//            0,85 ; mordu, il glisse de 0,6 m du côté vendu.
//   GARDE    le défenseur à 1,4 m du ballon (× (2 − agressivité), 1,1-1,8 m) sur la ligne ballon → son but ; toutes les 0,45-0,85 s il
//            montre la fente (le jab, un pas de 0,35 m).
//   FENTE    à bout de patience (1,6-3,2 s) ou mordu (35 %) : il charge 0,2 s puis se jette — la jambe part sur sa LIGNE, vers le
//            ballon d'alors (anticipé de 0,3 s), le corps glisse jusqu'à 0,7 m, la jambe porte à 0,7 m : elle ne gagne que le ballon
//            resté dans son COULOIR (0,35 m de part et d'autre). Manquée, il reste déséquilibré 0,45 s — au sol 1,2 s, au tirage (0,3,
//            × 1,5 mordu). Le porteur la lit avec p = 0,5 × anticipF × (2 − tempo du tacleur) : il tire le ballon à la semelle, ou
//            sort en roulette, en râteau.
//   SORTIE   le mordu décalé, la fente manquée, ou au bout de 5 s : la croqueta (ou le râteau, la roulette) vers le côté ouvert, puis la
//            conduite lancée 0,8 s vers un point à 1,3 m de son flanc et 1 m au-delà de lui.
//
// LE CORPS, LUI, A SES RÉFLEXES. Ceux de Gameplay Football jugent un duel sur la seule géométrie (« l'adversaire est-il entre le ballon et
// moi ? ») : face à un porteur planté, le ballon devant lui, toujours gagnable — le défenseur le piquait au premier pas (mesuré : 14
// face-à-face sur 27 finis ainsi pendant la garde). La garde est donc une intention ALLER au drapeau 1 : ses réflexes de duel se taisent
// (patch.py, étape 13). La fente (PRESSER) et la sortie les lui rendent : là, c'est le corps qui juge qui touche le ballon.
// LA FIN SE LIT AU JOURNAL, pas à la possession que déclare le corps : elle clignote dès que le ballon s'écarte d'un pas (l'adaptateur
// compte déjà la tenue au journal pour cette raison, le « teneur »). Fini : un autre a touché le ballon, le porteur l'a passé,
// le ballon s'est échappé, un second adversaire arrive (le un-contre-un n'en est plus un : la main au cerveau), le défenseur est
// dépassé ou décroche, le jeu s'arrête.
import { INTENTION, GESTE } from './contrat.mjs';

/** La configuration du face-à-face — celle du duel (duel-1v1.js), seuils inchangés. Le 11 contre 11 y ajoute : `double`, le rayon où un
 *  second adversaire met fin au face-à-face ; `isole` (s), le temps qu'il faut au plus proche des autres pour y arriver, à vAide m/s au
 *  moins (il viendra : le corps envoie deux presseurs) ; `echappe`, le ballon à plus de 1,3 m du porteur planté (3 m dans sa sortie
 *  lancée) : il lui a échappé. */
export const FACE = {
  entree: { foe: [1.0, 2.6], frein: 0.25, cone: 50, face: 70, but: 6.5, vMax: 4.5, ballon: 0.5, vBallon: 5.5, envie: [0.7, 0.3], cd: 2.5, isole: 2.0, vAide: 3 },
  double: 2.5, echappe: 1.3, echappeSortie: 3.0,
  pause: [0.1, 0.35], jab: { cadence: [0.45, 0.85], pas: 0.35, duree: 0.3 },
  morsure: { base: 0.15, cumul: 0.12, duree: 0.6, decale: 0.6, elan: 1.8 }, garde: 1.4, patience: [1.6, 3.2],
  fente: { charge: 0.2, duree: 0.7, surMorsure: 0.35, glisse: 0.7, portee: 0.7, couloir: 0.35, chute: 0.3, desequilibre: 0.45, sol: 1.2 }, lecture: 0.5, lache: 4.8, max: 5.0,
  sortie: { lat: 1.3, au: 1.0, duree: 0.8, v: 7 }, sorties: { rateau: 0.35, roulette: 0.25 },
  feintes: { corps: { p: 0.25, vente: 1.3 }, passement: { p: 0.3, vente: 1.5 }, serie: { part: 0.6, vente: 0.45, venteFin: 1.0 } },
};

/** Le répertoire (outils/vers-gpf.mjs, REPERTOIRE) : n°, durée, contact (la vente), libre (le pied libre pour la sortie). */
export const GESTES = {
  arretSemelle: { n: 101, duree: 0.85, contact: 0.24, libre: 0.62 }, semelleRoule: { n: 102, duree: 0.5, contact: 0.04, libre: 0.4 },
  semelleRouleOut: { n: 103, duree: 0.5, contact: 0.04, libre: 0.4 }, feinteSemelle: { n: 104, duree: 0.6, contact: 0.24, libre: 0.34 },
  feinteSemelleIn: { n: 105, duree: 0.6, contact: 0.24, libre: 0.34 }, passementFace: { n: 106, duree: 0.66, contact: 0.3, libre: 0.5, sansTouche: true },
  passementSerie2: { n: 107, duree: 1.08, contact: 0.04, serie: 2, sansTouche: true }, passementSerie3: { n: 108, duree: 1.38, contact: 0.04, serie: 3, sansTouche: true },
  passementSerie4: { n: 109, duree: 1.68, contact: 0.04, serie: 4, sansTouche: true }, tireSemelle: { n: 110, duree: 0.6, contact: 0.04, libre: 0.3 },
  tireSemelleIn: { n: 111, duree: 0.6, contact: 0.04, libre: 0.3 }, rateauFace: { n: 112, duree: 0.5, contact: 0.04, libre: 0.24 },
  rateauFaceIn: { n: 113, duree: 0.5, contact: 0.04, libre: 0.24 }, rouletteFace: { n: 114, duree: 0.78, contact: 0.04, libre: 0.6 },
  doubleContact: { n: 115, duree: 0.36, contact: 0.18, libre: 0.36 }, rateau: { n: 116, duree: 0.7, contact: 0.22, libre: 0.5 },
};
const PAR_NUMERO = Object.fromEntries(Object.entries(GESTES).map(([k, g]) => [g.n, k]));
const SERIE = { entree: 0.22, tour: 0.30 };   // la série : l'entrée (le roulé au milieu), un passage toutes les 0,30 s
const ARRIVEE = 0.5, PAS = 2.0, PLANTE = 0.45, TICK = 0.1, ATTENTE = 0.6;   // le corps : la bande morte de son placement (m), son plus petit pas (m/s, au-dessus de idleDribbleSwitch 1,8) ; l'écart à sa place sous lequel le défenseur reste planté (m) ; le tick de l'adaptateur (s)
const NOM_GESTE = Object.fromEntries(Object.entries(GESTE).map(([k, v]) => [v, k]));

const hyp = Math.hypot;
const tir = (a, u) => a[0] + (a[1] - a[0]) * u;

/**
 * Le face-à-face d'un match. `tirage(a, b)` : le tirage seedé de l'adaptateur ; `attributs(idCorps)` : { flair, gesteF, anticipF, aggrF,
 * tacleTempoF, reaction } du joueur (le cerveau les porte) ; `equipes` : les équipes pilotées ; `trace(t, quoi, détail)` : la chronique
 * d'un face-à-face, pour les bancs.
 */
export function creerFace({ tirage, attributs, equipes = [0, 1], K = FACE, trace = null }) {
  let F = null;                 // le face-à-face en cours
  const recharge = new Map();   // id du porteur → instant où il peut retenter
  const gestes = [];            // les gestes démarrés depuis le dernier tick (le journal) : { joueur, n, t }
  const touches = [];           // les touches du ballon depuis le dernier tick (le journal) : { joueur, equipe, b (le geste), t }
  let dernierToucheur = null;   // le dernier joueur à avoir touché le ballon
  let derniere = null;          // le dernier face-à-face fini : { issue, t, feintes, porteur, defenseur }
  let attente = null;           // un ballon disputé à la fin : l'issue se lit à la touche suivante (≤ ATTENTE s)
  const stats = { entrees: 0, refus: 0, issues: {}, feintes: 0, morsures: 0, fentes: 0, lues: 0, demandes: 0, joues: 0, duree: 0, parGeste: {} };
  let compteur = 0;
  const rnd = (id, t) => tirage(id * 131 + (++compteur % 97), t);

  const butAttaque = (eq) => (eq === 0 ? 55 : -55), butDefendu = (eq) => (eq === 0 ? -55 : 55);
  const equipeDe = new Map();   // id → équipe, retenue à l'entrée
  const attributsEquipe = (id) => equipeDe.get(id);
  const unite = (x, y) => { const l = hyp(x, y) || 1; return [x / l, y / l]; };

  /** Le défenseur de champ DEVANT le porteur (côté but, dans le cône, entre a et b m) ; null sinon. */
  function devant(etat, c, [a, b], cone) {
    const g = [butAttaque(c.equipe) - c.x, -c.y], gl = hyp(g[0], g[1]) || 1, cos = Math.cos(cone * Math.PI / 180);
    let best = null;
    for (const q of etat.joueurs) {
      if (q.equipe === c.equipe || q.role === 0 || !q.actif) continue;
      const dx = q.x - c.x, dy = q.y - c.y, d = hyp(dx, dy);
      if (d < a || d > b || (dx * g[0] + dy * g[1]) / (d * gl) < cos) continue;
      if (!best || d < best.d) best = { q, d };
    }
    return best;
  }

  /** La fin du face-à-face. `gardee` : l'issue si le ballon disputé revient à l'équipe du porteur — alors `issue` (la perte) attend
   *  la touche suivante pour être comptée : le jeu, lui, est rendu au cerveau tout de suite. */
  function fin(t, issue, gardee = null) {
    const r = { issue, t, feintes: F.feintes, porteur: F.c, defenseur: F.q };
    stats.duree += t - F.t0;
    recharge.set(F.c, t + K.entree.cd);
    if (gardee) attente = { ...r, gardee, eqC: attributsEquipe(F.c), eqQ: attributsEquipe(F.q) };
    else compter(r);
    F = null;
  }
  function compter(r) {
    trace?.(r.t, 'fin', r.issue);
    derniere = r; stats.issues[r.issue] = (stats.issues[r.issue] ?? 0) + 1;
  }
  /** Le ballon disputé à la fin d'un face-à-face : la touche suivante dit à qui il est — ou, s'il sort, l'équipe qui reprend ; sans
   *  rien en ATTENTE s, la perte. `t` absent : seulement les touches (le journal, jeu arrêté compris). */
  function juger(t, touchees) {
    if (!attente) return;
    const x = touchees.find((x) => x.equipe === attente.eqC || x.equipe === attente.eqQ);
    if (!x && (t == null || t - attente.t < ATTENTE)) return;
    compter({ ...attente, issue: x && x.equipe === attente.eqC ? attente.gardee : attente.issue });
    attente = null;
  }

  /** Le geste demandé au porteur jusqu'à ce que le corps le lance (le journal), puis tenu le temps de sa durée. */
  function demander(t, nom, cible, vitesse = 0) {
    const G = GESTES[nom];
    F.demande = { nom, t, cible, vitesse };
    trace?.(t, 'demande', nom);
    stats.demandes++; (stats.parGeste[nom] ??= { demandes: 0, joues: 0 }).demandes++;
    return G;
  }

  /** Le journal depuis le dernier tick : les gestes que le corps a lancés (ceux du porteur du face-à-face font foi), les touches. */
  function observer(evenements, EV) {
    for (const ev of evenements) {
      if (ev.type === EV.GESTE) gestes.push({ joueur: ev.joueur, n: ev.a, t: ev.t / 1000 });
      else if (ev.type === EV.TOUCHE) { touches.push({ joueur: ev.joueur, equipe: ev.equipe, b: ev.b, t: ev.t / 1000 }); dernierToucheur = ev.joueur; }
      // le ballon disputé hors du jeu : l'équipe qui reprend le tranche (le cerveau ne tourne pas, jeu arrêté)
      if (attente && !F && (ev.type === EV.TOUCHE || ev.type === EV.CPA)) juger(null, [{ equipe: ev.equipe }]);
    }
  }

  /** La sortie vers le côté ouvert du défenseur (cote : +1 sa droite vue du porteur, −1 sa gauche) — la croqueta, le râteau ou la roulette. */
  function sortir(t, c, q, cote, issue, geste = null) {
    const g = unite(butAttaque(c.equipe) - q.x, -q.y), n = [-F.u[1], F.u[0]];
    const ax = q.x + n[0] * cote * K.sortie.lat + g[0] * K.sortie.au, ay = q.y + n[1] * cote * K.sortie.lat + g[1] * K.sortie.au;
    if (!geste) geste = rnd(c.id, t) < K.sorties.rateau ? 'rateau' : 'croqueta';
    const lat = ballonLateral(c);
    const nom = geste === 'roulette' ? 'rouletteFace' : geste === 'rateau' ? (lat >= -0.02 ? 'rateauFace' : 'rateauFaceIn') : 'doubleContact';
    F.sortie = { nom, cible: [ax, ay], t, issue, lance: null };
    trace?.(t, 'sortie', { nom, issue });
    demander(t, nom, [ax, ay], 0);
  }

  /** Le ballon dans le repère du porteur : sa position latérale (m, + = sa droite). */
  function ballonLateral(c) {
    const f = unite(c.dir[0], c.dir[1]), r = [f[1], -f[0]], b = F._ballon;
    return b ? (b[0] - c.x) * r[0] + (b[1] - c.y) * r[1] : 0;
  }

  /** Remplacer l'intention que le cerveau a donnée au joueur `id` (en place dans `out`). */
  function poser(id, i) {
    const o = outRef.find((x) => x.id === id);
    if (o) { for (const k of Object.keys(o)) if (k !== 'id') delete o[k]; Object.assign(o, i, { face: true }); }
  }

  /**
   * LES DEUX INTENTIONS DU TICK, quoi qu'il se soit passé : tant que le face-à-face vit, le cerveau ne parle ni au porteur ni à son
   * défenseur. (Mesuré avant : un geste raté ou une sortie décidée sautaient la pose — le porteur reprenait l'intention du cerveau pour
   * un tick, une passe parfois, et la jouait.) Le porteur : sa sortie (le geste, puis la conduite lancée), le geste demandé, sinon planté.
   */
  function poserTout(t, c, q, n, Aq) {
    if (!F) return;
    const S = F.sortie;
    if (S) {
      // LE CORPS NE COUPE JAMAIS UNE ANIMATION (humanoidbase : la suivante se choisit à sa dernière image, avec l'intention posée à cet
      // instant ; la remise en file est éteinte dans GRF) : le geste lancé, la conduite lancée est posée tout de suite — il la prend en
      // finissant le geste. Laissé en GESTE jusqu'à sa fin, le corps le rejouait (mesuré : six croquetas d'affilée).
      if (S.lance != null)
        poser(F.c, { genre: INTENTION.CONDUIRE, x: S.cible[0] + (S.cible[0] - c.x), y: S.cible[1] + (S.cible[1] - c.y), vitesse: K.sortie.v });
      else if (S.lance == null && (t - S.t > 0.6 || c.vitesse > 1.8))   // le corps n'a pas pu lancer le geste, ou le porteur court déjà (nos gestes partent de l'arrêt) : la conduite lancée seule
        poser(F.c, { genre: INTENTION.CONDUIRE, x: S.cible[0], y: S.cible[1], vitesse: K.sortie.v });
      else poser(F.c, { genre: INTENTION.GESTE, x: S.cible[0], y: S.cible[1], vitesse: 0, cible: GESTES[S.nom].n, drapeaux: 0 });
    } else if (F.demande) {
      const G = GESTES[F.demande.nom];
      poser(F.c, { genre: INTENTION.GESTE, x: F.demande.cible[0], y: F.demande.cible[1], vitesse: F.demande.vitesse, cible: G.n, drapeaux: G.sansTouche ? 1 : 0 });
    } else poser(F.c, { genre: INTENTION.CONDUIRE, x: q.x, y: q.y, vitesse: 0 });   // planté : conduire à l'arrêt, la semelle reste
    gardeDuDefenseur(t, c, q, n, Aq, !!S);
  }

  /**
   * Un tick : `etat` (corps.etat()), `out` (les intentions du cerveau, modifiées en place pour le porteur et son défenseur).
   */
  function tick(etat, out, EV) {
    const t = etat.t / 1000;
    const { equipe, joueur } = etat.possession;
    const porteur = equipe >= 0 && joueur >= 0 ? etat.joueurs.filter((j) => j.equipe === equipe)[joueur] : null;
    // les gestes lancés par le corps depuis le dernier tick, les touches du ballon
    const lances = gestes.splice(0), touchees = touches.splice(0);
    juger(t, touchees);
    if (!etat.enJeu || etat.cpa) { if (F) fin(t, 'arret'); return; }

    if (!F) {
      // ── L'ENTRÉE ───────────────────────────────────────────────────────────────────────────────────────────────────────────
      const c = porteur, E = K.entree;
      if (!c || c.role === 0 || !equipes.includes(c.equipe) || (recharge.get(c.id) ?? -1) > t || c.vitesse > E.vMax) return;
      // le porteur conduit (son geste en cours : déplacement ou contrôle — pas une passe, un tir déjà partis) et il a touché le ballon le dernier
      if ((c.geste !== GESTE.MOUVEMENT && c.geste !== GESTE.CONTROLE) || dernierToucheur !== c.id) return;
      const o = out.find((x) => x.id === c.id); if (!o || o.genre !== INTENTION.CONDUIRE) return;   // le cerveau a choisi de conduire
      const b = etat.ballon, bx = b[0] - c.x, by = b[1] - c.y, dB = hyp(bx, by), vB = hyp(etat.ballonV[0], etat.ballonV[1]);
      const f = unite(c.dir[0], c.dir[1]);
      if (b[2] > 0.3 || dB > E.ballon + E.frein * c.vitesse || vB > E.vBallon || bx * f[0] + by * f[1] < 0.05) return;
      if (hyp(butAttaque(c.equipe) - c.x, c.y) < E.but) return;
      const D = devant(etat, c, [0.5, E.foe[1] + E.frein * c.vitesse], E.cone); if (!D || !equipes.includes(D.q.equipe)) return;   // (le défenseur aussi piloté : contre leur IA, il ne garderait pas)
      const dFrein = D.d - E.frein * c.vitesse; if (dFrein < E.foe[0] || dFrein > E.foe[1]) return;
      const u = [(D.q.x - c.x) / D.d, (D.q.y - c.y) / D.d];
      const h = c.vitesse > 0.5 ? unite(c.v[0], c.v[1]) : f;
      if (u[0] * h[0] + u[1] * h[1] < Math.cos(E.face * Math.PI / 180)) return;
      if (-(D.q.v[0] * u[0] + D.q.v[1] * u[1]) > 3) return;   // le défenseur qui charge lancé : pas de pose
      // LE VRAI UN-CONTRE-UN (11 contre 11) : aucun autre adversaire de champ ne peut le doubler (être à `double` m de lui) avant
      // `isole` s, à sa vitesse vers lui ou à vAide m/s au moins. Mesuré avec « personne à moins de 4 m » : un face-à-face sur quatre
      // fini en 1,2-1,6 s par le second presseur
      if (etat.joueurs.some((o) => {
        if (o.equipe === c.equipe || o.role === 0 || !o.actif || o === D.q) return false;
        const ox = c.x - o.x, oy = c.y - o.y, d = hyp(ox, oy) || 1, vers = (o.v[0] * ox + o.v[1] * oy) / d;
        return (d - K.double) / Math.max(E.vAide, vers) < E.isole;
      })) return;
      const A = attributs(c.id);
      if (rnd(c.id, t) > E.envie[0] + E.envie[1] * A.flair) { recharge.set(c.id, t + E.cd); stats.refus++; return; }
      const Aq = attributs(D.q.id);
      F = { c: c.id, q: D.q.id, t0: t, u, feintes: 0, mords: 0, mordu: null, vente: null, fente: null, sortie: null, geste: null, demande: null,
        prochain: t + GESTES.arretSemelle.libre, jab: t + tir(K.jab.cadence, rnd(D.q.id, t)), patience: t + tir(K.patience, rnd(D.q.id, t)) * (2 - Aq.aggrF), _ballon: b };
      stats.entrees++; equipeDe.set(c.id, c.equipe); equipeDe.set(D.q.id, D.q.equipe);
      trace?.(t, 'entrée', { c: c.id, q: D.q.id, d: +D.d.toFixed(2), v: +c.vitesse.toFixed(1) });
      demander(t, 'arretSemelle', [D.q.x, D.q.y], 0);
    }

    // ── LE FACE-À-FACE EN COURS ──────────────────────────────────────────────────────────────────────────────────────────────
    const c = etat.joueurs.find((j) => j.id === F.c), q = etat.joueurs.find((j) => j.id === F.q);
    if (!c || !q || !q.actif) return fin(t, 'perdu');
    // LE JOURNAL : le porteur qui passe ou tire, un partenaire, un autre adversaire mettent fin. LE DÉFENSEUR QUI TOUCHE LE BALLON
    // aussi : le duel planté est fini — le ballon est libre ou disputé, le corps ne tient plus le porteur pour possesseur (notre
    // « conduire à l'arrêt » n'est plus lu : leur IA le fait courir après), et c'est au cerveau de jouer la mêlée. L'issue se lit à
    // la touche suivante (`juger`) : sa touche le pique ou le frôle seulement (mesuré : « gagnée » à sa touche, le ballon restait au
    // porteur deux fois sur trois ; et la loi qui continuait demandait un râteau à l'arrêt à un porteur lancé à 6 m/s)
    for (const x of touchees) {
      if (x.joueur === F.c) { if (x.b >= GESTE.PASSE_COURTE && x.b <= GESTE.TIR) return fin(t, 'passe'); continue; }
      if (x.equipe === c.equipe) return fin(t, 'relais');
      if (x.joueur !== F.q) return fin(t, 'tiers');
      trace?.(x.t, 'touche du défenseur', NOM_GESTE[x.b] ?? x.b);
      const apres = touchees.slice(touchees.indexOf(x) + 1);   // les touches du même tick, après la sienne : déjà la réponse
      if (F.fente && t >= F.fente.part) fin(t, 'fente-gagnee', 'fente-contree');
      else if (F.sortie) fin(t, 'sortie-coupee', `sortie-${F.sortie.issue}`);
      else fin(t, 'chipe', 'chipe-repris');
      return juger(null, apres);
    }
    // LE BALLON ÉCHAPPÉ : à plus de 1,3 m du porteur planté — parti devant lui dans sa sortie lancée (3 m), c'est la sortie
    const dBallon = hyp(etat.ballon[0] - c.x, etat.ballon[1] - c.y);
    if (dBallon > (F.sortie?.lance != null ? K.echappeSortie : K.echappe))
      return F.sortie?.lance != null ? fin(t, `sortie-${F.sortie.issue}`) : fin(t, 'echappe', 'echappe-repris');
    if (!F.sortie && etat.joueurs.some((o) => o.equipe !== c.equipe && o.role !== 0 && o.actif && o.id !== F.q && hyp(o.x - c.x, o.y - c.y) < K.double))
      return fin(t, 'double');
    F._ballon = etat.ballon;
    const dx = q.x - c.x, dy = q.y - c.y, dq = hyp(dx, dy) || 1;
    const g = [butAttaque(c.equipe) - c.x, -c.y], gl = hyp(g[0], g[1]) || 1;
    if ((dx * g[0] + dy * g[1]) / gl < -0.3) return fin(t, 'depasse');
    if (dq > K.lache) return fin(t, 'relache');
    if (!F.fente?.part || t < F.fente.part) F.u = [dx / dq, dy / dq];
    const n = [-F.u[1], F.u[0]];   // la gauche du porteur face au défenseur
    const A = attributs(c.id), Aq = attributs(q.id);
    const age = t - F.t0;
    const sortie = (...args) => { sortir(...args); return poserTout(t, c, q, n, Aq); };

    // les gestes du porteur que le corps a lancés : le geste en cours, la vente à juger
    for (const L of lances) if (L.joueur === F.c) {
      const nom = PAR_NUMERO[L.n]; if (!nom) continue;
      const G = GESTES[nom];
      F.geste = { nom, t: L.t, fin: L.t + G.duree, libre: L.t + (G.libre ?? G.duree) };
      trace?.(L.t, 'joué', nom);
      if (F.demande?.nom === nom) { F.demande = null; stats.joues++; stats.parGeste[nom].joues++; }
      if (F.vente && F.vente.nom === nom && F.vente.t0 == null) F.vente.t0 = L.t;
      if (F.sortie && F.sortie.nom === nom) F.sortie.lance ??= L.t;
    }
    const enGeste = F.geste && t < F.geste.fin;

    // LA SORTIE DEMANDÉE : le geste, puis la conduite lancée vers le côté ouvert ; finie au bout de sa durée
    if (F.sortie) {
      if (F.fente && t >= F.fente.part + K.fente.duree) finDeFente(t, q);   // la fente lue s'est jetée dans le vide pendant la sortie
      const S = F.sortie, dur = GESTES[S.nom].duree;
      if (S.lance != null ? t >= S.lance + dur + K.sortie.duree : t - S.t > 0.6 + K.sortie.duree) return fin(t, `sortie-${S.issue}`);
      return poserTout(t, c, q, n, Aq);
    }

    // LA MORSURE : au contact de la feinte jouée (pour la série, à chaque passage), le défenseur mord du côté vendu
    if (F.vente && F.vente.t0 != null && !F.fente) {
      const V = F.vente, G = GESTES[V.nom];
      const instants = G.serie ? Array.from({ length: G.serie }, (_, j) => V.t0 + SERIE.entree + (j + 0.5) * SERIE.tour) : [V.t0 + G.contact];
      while ((V.juges ?? 0) < instants.length && t >= instants[V.juges ?? 0]) {
        const j = V.juges ?? 0; V.juges = j + 1;
        const cote = G.serie ? (j % 2 === 0 ? -1 : 1) : V.cote, vente = G.serie ? (j === G.serie - 1 ? K.feintes.serie.venteFin : K.feintes.serie.vente) : V.vente;
        if (G.serie) F.feintes++;
        const pM = Math.min(0.85, (K.morsure.base + K.morsure.cumul * (F.feintes - 1)) * vente * A.gesteF * (2 - Aq.anticipF));
        if (!F.mordu && rnd(q.id, t) < pM) {
          F.mords++; stats.morsures++;
          F.mordu = { t, cote, until: t + K.morsure.duree * A.gesteF };
          trace?.(t, 'morsure', { pM: +pM.toFixed(2), cote });
          if (rnd(q.id, t + 0.01) < K.fente.surMorsure) lancerFente(t, c, q, A, Aq, true);
        }
      }
    }

    // LA FENTE : la charge, la lecture, le départ, puis le jugement
    if (F.fente) {
      const Fn = F.fente;
      if (Fn.lu != null && !Fn.repondu && t >= Fn.lu && (!enGeste || t >= F.geste.libre)) {
        Fn.repondu = true; stats.lues++;
        const ouvert = (dx * n[0] + dy * n[1]) > 0 ? -1 : 1, u = rnd(c.id, t);
        if (u < K.sorties.roulette * (0.6 + 0.8 * A.flair)) return sortie(t, c, q, ouvert, 'roulette-fente', 'roulette');
        if (u < K.sorties.roulette * (0.6 + 0.8 * A.flair) + K.sorties.rateau) return sortie(t, c, q, ouvert, 'rateau-fente', 'rateau');
        demander(t, ballonLateral(c) >= -0.02 ? 'tireSemelle' : 'tireSemelleIn', [q.x, q.y], 0);   // le tiré de semelle : la semelle ramène le ballon
      }
      if (t >= Fn.part + K.fente.duree) {   // la fente passée, le ballon toujours à lui : manquée — la sortie de l'autre côté
        finDeFente(t, q);
        const cote = ((etat.ballon[0] - q.x) * n[0] + (etat.ballon[1] - q.y) * n[1]) >= 0 ? 1 : -1;
        const issue = Fn.lu != null ? 'fente-lue' : Fn.mordue ? 'fente-mordue' : 'fente-manquee';
        return sortie(t, c, q, cote, issue);
      }
    }

    // LA SORTIE SUR LA MORSURE : le mordu glisse du côté vendu → de l'autre côté, dès que le pied est libre
    if (F.mordu && (!F.fente || F.fente.mordue) && t - F.mordu.t > A.reaction * 0.7 && t < F.mordu.until && (!enGeste || t >= F.geste.libre))
      return sortie(t, c, q, -F.mordu.cote, F.fente ? 'fente-mordue' : 'mordu');
    if (!F.fente && !enGeste && age > K.max) {
      const cote = ((etat.ballon[0] - q.x) * n[0] + (etat.ballon[1] - q.y) * n[1]) >= 0 ? 1 : -1;
      return sortie(t, c, q, cote, 'expire');
    }

    // LE GESTE QUE LE CORPS N'A PAS PU LANCER (vitesse, angle, ballon hors d'atteinte) : planté, une autre feinte
    if (F.demande && t - F.demande.t > (F.demande.nom === 'arretSemelle' ? 1.0 : 0.6)) { trace?.(t, 'raté', F.demande.nom); F.demande = null; F.prochain = t + 0.1; }
    // l'heure de la feinte suivante : la fin du geste plus la pause — sauf après l'arrêt de semelle, que la première feinte enchaîne sur
    // la tenue, le pied encore dessus (comme le duel)
    if (F.geste && !F.demande && F.prochain < F.geste.fin && t >= F.geste.t) F.prochain = F.geste.fin + (F.geste.nom === 'arretSemelle' ? 0 : tir(K.pause, rnd(c.id, t)));

    // LA FEINTE SUIVANTE, planté — demandée un tick avant son heure : le corps la prend à la dernière image du geste en cours (ou de
    // l'appui planté), sans le trou d'un tick
    if (!F.fente && !F.demande && (!enGeste || t >= F.geste.fin - TICK) && t >= F.prochain - TICK) {
      const lat = ballonLateral(c), dehors = lat >= -0.02, FK = K.feintes, u = rnd(c.id, t);
      const pP = dehors ? FK.passement.p * (0.6 + 0.8 * A.flair) : 0, pC = FK.corps.p;
      let nom, cote, vente = 1;
      if (u < pP && rnd(c.id, t + 0.02) < FK.serie.part * (0.5 + A.flair)) { nom = `passementSerie${Math.min(4, 2 + Math.floor(rnd(c.id, t + 0.03) * (1 + 2 * A.flair)))}`; cote = -1; }
      else if (u < pP) { nom = 'passementFace'; cote = 1; vente = FK.passement.vente; F.feintes++; }
      else if (u < pP + pC) { nom = dehors ? 'feinteSemelle' : 'feinteSemelleIn'; cote = -1; vente = FK.corps.vente; F.feintes++; }
      else { nom = dehors ? 'semelleRoule' : 'semelleRouleOut'; cote = dehors ? -1 : 1; F.feintes++; }
      stats.feintes++;
      F.vente = { nom, cote, vente, t0: null };
      demander(t, nom, [q.x, q.y], 0);
    }
    // LA FENTE À BOUT DE PATIENCE
    if (!F.fente && age > 0.4 && t >= F.patience && !(F.mordu && t < F.mordu.until) && hyp(q.x - etat.ballon[0], q.y - etat.ballon[1]) < K.garde + 0.6)
      lancerFente(t, c, q, A, Aq, false);

    poserTout(t, c, q, n, Aq);
  }

  /** La fente passée, le ballon toujours au porteur : dans le vide, il reste déséquilibré — au sol, au tirage (mordu, plus souvent) ;
   *  ses réflexes ne lui reviennent qu'après. */
  function finDeFente(t, q) {
    const Fn = F.fente; F.fente = null;
    const auSol = rnd(q.id, t + 0.05) < K.fente.chute * (Fn.mordue ? 1.5 : 1);
    F.desequilibre = t + (auSol ? K.fente.sol : K.fente.desequilibre);
    trace?.(t, 'fente manquée', auSol ? 'au sol' : 'déséquilibré');
  }

  function lancerFente(t, c, q, A, Aq, mordue) {
    const pLu = mordue ? 0 : Math.min(0.9, K.lecture * A.anticipF * (2 - Aq.tacleTempoF));
    const b = etatRef.ballon;
    F.fente = { t, part: t + K.fente.charge, mordue, lu: rnd(c.id, t + 0.04) < pLu ? t + A.reaction * 0.7 : null, cible: [b[0] + c.v[0] * 0.3, b[1] + c.v[1] * 0.3] };
    trace?.(t, 'fente', { mordue, pLu: +pLu.toFixed(2), lu: F.fente.lu != null });
    stats.fentes++;
  }

  /**
   * LA GARDE DU DÉFENSEUR : à garde m du ballon sur la ligne ballon → son but ; le jab ; mordu, décalé ; la fente : il se jette.
   * LE PAS VISE AU-DELÀ DE LA BANDE MORTE du placement du corps (comme dans le duel, movement.ARRIVEE) : à moins de 0,5 m de sa cible,
   * le corps ne bouge pas (_GfPlacement) — le jab (0,35 m) restait invisible, le défenseur figé à sa garde jusqu'à la fente. Et un pas
   * se fait au moins à 2 m/s : sous 1,8 m/s, la classe de vitesse « arrêt » du corps (idleDribbleSwitch), il ne fait que pivoter.
   */
  function gardeDuDefenseur(t, c, q, n, Aq, sortie) {
    if (!F) return;
    // LA FENTE ENGAGÉE (face.js, lancerFente) : la jambe part sur sa ligne — de sa place vers le ballon d'alors —, le corps glisse
    // jusqu'au bout de sa glissade, au sprint, et va au bout (fente.duree) même si le porteur l'a lue et sort. Ses réflexes ne
    // s'ouvrent que si le ballon est resté dans son couloir et à sa portée : c'est alors le corps qui juge le contact. (Avant :
    // PRESSER, la chasse aimantée du corps — il suivait le ballon où qu'il aille et le touchait presque à chaque fente.)
    if (F.fente && t >= F.fente.part && t < F.fente.part + K.fente.duree) {
      const Fn = F.fente;
      if (!Fn.ligne) {
        const dx = Fn.cible[0] - q.x, dy = Fn.cible[1] - q.y, d = hyp(dx, dy) || 1, gl = Math.min(K.fente.glisse, Math.max(0, d - K.fente.portee));
        Fn.ligne = { u: [dx / d, dy / d], o: [q.x, q.y], porte: gl + K.fente.portee, bout: [q.x + (dx / d) * gl, q.y + (dy / d) * gl] };
      }
      const L = Fn.ligne, b = etatRef.ballon, bx = b[0] - L.o[0], by = b[1] - L.o[1];
      const lat = Math.abs(bx * L.u[1] - by * L.u[0]), le = bx * L.u[0] + by * L.u[1];
      const dansSaLigne = lat <= K.fente.couloir && le >= -0.2 && le <= L.porte + 0.2;
      poser(F.q, { genre: INTENTION.ALLER, x: L.bout[0] + L.u[0] * ARRIVEE, y: L.bout[1] + L.u[1] * ARRIVEE, vitesse: 8, drapeaux: dansSaLigne ? 0 : 1 });
      return;
    }
    // DÉSÉQUILIBRÉ (la fente dans le vide) ou AU SOL : planté, sans réflexes, le temps de se remettre
    if (F.desequilibre && t < F.desequilibre) { poser(F.q, { genre: INTENTION.ALLER, x: q.x, y: q.y, vitesse: 0, drapeaux: 1 }); return; }
    if (F.fente && t < F.fente.part) { poser(F.q, { genre: INTENTION.ALLER, x: q.x, y: q.y, vitesse: 0, drapeaux: 1 }); return; }   // la charge : il s'arrête, l'appui chargé
    if (t >= F.jab + K.jab.duree) F.jab = t + tir(K.jab.cadence, rnd(q.id, t));
    const b = etatRef.ballon, og = [butDefendu(q.equipe) - b[0], -b[1]], ol = hyp(og[0], og[1]) || 1;
    const gd = Math.max(1.1, Math.min(1.8, K.garde * (2 - Aq.aggrF))) - (t >= F.jab ? K.jab.pas : 0);
    let tx = b[0] + (og[0] / ol) * gd, ty = b[1] + (og[1] / ol) * gd;
    if (F.mordu && t < F.mordu.until) { tx += n[0] * F.mordu.cote * K.morsure.decale; ty += n[1] * F.mordu.cote * K.morsure.decale; }
    // à moins de `PLANTE` m de sa place, il y reste (planté, face au ballon) ; au-delà — le jab, son retour, la morsure, le ballon qui
    // bouge —, un vrai pas. Sans ce seuil, la cible toujours prolongée le faisait passer et repasser sa place à 3 m/s (mesuré : de 1,2
    // à 2,45 m du porteur, l'inertie du corps)
    const ex = tx - q.x, ey = ty - q.y, ed = hyp(ex, ey);
    if (ed < PLANTE) { tx = q.x; ty = q.y; } else { tx += (ex / ed) * ARRIVEE; ty += (ey / ed) * ARRIVEE; }
    const v = ed < PLANTE ? 0 : F.mordu && t < F.mordu.until ? Math.max(PAS, K.morsure.elan) : ed < 0.6 ? PAS : Math.min(3, ed * 3);
    // la garde muette (drapeau 1 : pas de réflexe de duel) ; dans la sortie du porteur, ses réflexes lui reviennent — sauf mordu : il a
    // vendu son appui du mauvais côté, il ne peut rien jusqu'au bout de sa morsure (mesuré : mordu, il coupait la croqueta, 6 sorties sur 6)
    const mordu = F.mordu && t < F.mordu.until;
    poser(F.q, { genre: INTENTION.ALLER, x: tx, y: ty, vitesse: v, drapeaux: sortie && !mordu ? 0 : 1 });
  }

  let outRef = null, etatRef = null;
  return {
    observer,
    tick(etat, out, EV) { outRef = out; etatRef = etat; return tick(etat, out, EV); },
    get actif() { return F ? { porteur: F.c, defenseur: F.q, depuis: F.t0, feintes: F.feintes } : null; },
    get derniere() { return derniere; },
    stats() { return { ...stats, issues: { ...stats.issues }, parGeste: structuredClone(stats.parGeste) }; },
  };
}
