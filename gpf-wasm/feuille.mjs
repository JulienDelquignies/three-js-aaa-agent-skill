// feuille.mjs — LA FEUILLE DE MATCH DU CORPS (lot L5 : le panneau de stats de /match11 ; la source du lot L4). Le journal de Gameplay Football
// (contrat.mjs ; corps.md § 10.6) est traduit en FAITS au schéma de la skill (stats.js : { k, t, per, team, by, x, z, … }, positions dans le
// sens de l'équipe — elle attaque toujours vers +x —, issues résolues ici : la passe à la touche suivante d'un autre joueur, le tir au
// passage de la ligne de but ou à la touche adverse). Le RAPPORT est celui de la skill, tel quel (statsReport : par équipe, par mi-temps,
// par joueur, la note noteDe). UN SEUL SCHÉMA d'événements (EX-39) : la page, les bancs et, demain, la carrière lisent la même feuille.
//
// LECTURE SEULE : la feuille lit l'état et le journal qu'on lui passe, elle n'écrit rien dans le corps (bancs/feuille.mjs garde que le
// match joué ne change pas d'un bit, et que ses comptes retrouvent ceux du journal brut).
//
// Ce que le journal ne dit pas, et comment la feuille le décide (docs/feuille.md) :
//   · un tir n'a pas d'événement propre : c'est une TOUCHE de geste 8 ; il se résout au premier des quatre — le but (BUT), la touche du
//     gardien adverse (arrêté), d'un autre adversaire (contré), le passage de la ligne de but (cadré, hors cadre, frôle à < 25 cm d'un
//     montant ou de la barre) ; sinon, 5 s plus tard, « autre » ;
//   · une passe est la touche d'un geste de passe (4, 5, 6 — le compte des bancs) ; l'événement PASSE (au contact) y ajoute le
//     destinataire ; elle se juge à la touche suivante d'un AUTRE joueur (coéquipier : réussie ; adversaire : interceptée, et c'est une
//     récupération), ou échoue sur un arrêt de jeu, un hors-jeu, une faute, ou 8 s sans touche ;
//   · une récupération est un changement d'équipe d'une touche à l'autre, hors remise en jeu ;
//   · un dribble est un geste en course ou un face-à-face du cerveau, réussi s'il n'a pas fini sur une touche adverse (la page passe le
//     cerveau ; sans lui, pas de dribbles).
import { EV, GESTE } from './contrat.mjs';
import { xgRef, statsReport } from '../skills/threejs-aaa/assets/starter/src/engine/stats.js';

const HX = 55, HZ = 36, BUT_DEMI = 3.66, BUT_H = 2.44, GX = 21, GZ = 14;
const PASSES = new Set([GESTE.PASSE_COURTE, GESTE.PASSE_LONGUE, GESTE.PASSE_HAUTE]);
/** e_GameMode (le CPA du journal, a) */
export const MODES = { 1: 'engagement', 2: 'six-metres', 3: 'coup-franc', 4: 'corner', 5: 'touche', 6: 'penalty' };
/** e_PlayerRole du corps (la colonne rôle de gf_frame), en postes lisibles */
export const ROLES = ['G', 'DC', 'DG', 'DD', 'MDC', 'MC', 'MG', 'MD', 'MOC', 'BU'];
// LE MATCH DANS LE SENS DE L'ÉQUIPE : l'équipe 0 attaque +x (corps.md § 7.8 : pas de changement de côté à la mi-temps) ; z = −y, le
// latéral de la scène (x, z, −y) — gauche et droite comme à l'écran
const sens = (team, x, y) => (team === 0 ? [x, -y] : [-x, y]);
const r1 = (v) => Math.round(v * 10) / 10;

// LES NOMS (fictifs — EX-46 : aucun nom réel) : une initiale et un patronyme courant, tirés par la graine et l'équipe
const PATRONYMES = ['Martin', 'Bernard', 'Dubois', 'Durand', 'Lefèvre', 'Moreau', 'Laurent', 'Simon', 'Michel', 'Leroy', 'Roux', 'Bertrand', 'Morel',
  'Fournier', 'Girard', 'Bonnet', 'Lambert', 'Fontaine', 'Rousseau', 'Mercier', 'Blanc', 'Guérin', 'Boyer', 'Garnier', 'Chevalier', 'Legrand',
  'Gauthier', 'Perrin', 'Robin', 'Clément', 'Morin', 'Henry', 'Roussel', 'Lemoine', 'Colin', 'Vidal', 'Caron', 'Picard', 'Renaud', 'Aubert',
  'Ortega', 'Navarro', 'Molina', 'Delgado', 'Castro', 'Rubio', 'Serrano', 'Ferreira', 'Carvalho', 'Mendes', 'Pinto', 'Bianchi', 'Romano',
  'Colombo', 'Ricci', 'Marino', 'Greco', 'Gallo', 'Diallo', 'Traoré', 'Koné', 'Camara', 'Ndiaye', 'Mensah', 'Owusu', 'Bakari', 'Sylla',
  'Cissé', 'Keita', 'Sow', 'Hansen', 'Larsen', 'Berg', 'Vogel', 'Becker', 'Koch', 'Lindqvist', 'Novak', 'Horvat', 'Kowalski', 'Petrov', 'Janssen'];
const INITIALES = 'AABCDEFGHIJJKLLMMNOPRSSTVY';
/** Les noms des 22 joueurs, par id stable du corps (l'équipe 0 = ids 11-21, l'équipe 1 = ids 0-10) : « M. Diallo ». */
export function nomsDesJoueurs(graine = 7, etat = null) {
  let s = (graine * 2246822519 + 3266489917) >>> 0; const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const pris = new Set(), noms = {};
  const ids = etat ? etat.joueurs.map((j) => j.id) : [...Array(22).keys()];
  for (const id of ids) {
    let p; do p = PATRONYMES[Math.floor(rnd() * PATRONYMES.length)]; while (pris.has(p));
    pris.add(p); noms[id] = `${INITIALES[Math.floor(rnd() * INITIALES.length)]}. ${p}`;
  }
  return noms;
}

/**
 * creerFeuille — la feuille d'un match.
 * @param {{ etat: object, noms?: Record<number,string>, poste?: (id:number) => string|null }} o
 *   etat : un état du corps (lireEtat) pour connaître les 22 (id, équipe, rôle) ; noms : id → nom ; poste : id → poste lisible (le cerveau)
 * @returns {{ S, observer, rapport, chronologie, nom }}
 */
export function creerFeuille({ etat, noms = null, poste = null } = {}) {
  const J = [];
  for (const j of etat.joueurs) {
    J[j.id] = { id: j.id, team: j.equipe, keeper: j.role === 0, post: poste?.(j.id) ?? ROLES[j.role] ?? null, name: noms?.[j.id] ?? null,
      dist: [0, 0, 0], sprints: [0, 0, 0], vMax: 0, tJeu: [0, 0, 0], _sprint: false, heat: [null, new Float32Array(GX * GZ), new Float32Array(GX * GZ)] };
  }
  const S = {
    faits: [], pass: null, tir: null, poss: [[0, 0], [0, 0], [0, 0]], lastLoss: [-99, -99],
    forme: [0, 1].map(() => [null, 0, 0].map(() => ({ nA: 0, larg: 0, profA: 0, nD: 0, ligne: 0, bloc: 0, long: 0, largD: 0 }))),
    J, ballPrev: null, tPrev: null, prevPos: new Map(), dernier: null, cpa: null, passeInfo: null, jaunes: new Map(), gain: null, possStable: null, possCand: null,
    gesteVu: null, faceVue: null, chrono: [],   // chrono : les buts et les cartons, à part (la page les lit à chaque image)
  };
  const fait = (o) => { S.faits.push(o); if (o.k === 'but' || o.k === 'carton') S.chrono.push(o); return o; };
  const ST = { pitch: { hx: HX, hz: HZ } };   // ce que statsReport lit du monde

  function finirPasse(ok, cause, rec = null, pos = null) {
    const P = S.pass; if (!P) return; S.pass = null;
    P.ok = ok; P.cause = cause;
    if (ok && rec != null && pos) { P.to = rec; const [x, z] = sens(P.team, pos.x, pos.y); P.x1 = r1(x); P.z1 = r1(z); P.len = r1(Math.hypot(x - P.x, z - P.z)); }
    if (P.len == null) P.len = P.len0 ?? null;
    P.court = P.len != null ? (P.len < 15 ? 'courte' : P.len < 30 ? 'moyenne' : 'longue') : null;
    if (P.x1 != null) P.dir = P.x1 - P.x > 5 ? 'avant' : P.x1 - P.x < -5 ? 'arriere' : 'laterale';
  }
  function finirTir(issue) {
    const T = S.tir; if (!T) return; S.tir = null;
    T.issue = issue ?? (T.ligne ? (T.ligne.cadre ? 'cadre' : T.ligne.frole ? 'frole' : 'hors-cadre') : 'autre');
    T.cadre = T.issue === 'but' || T.issue === 'arrete' || T.issue === 'cadre';
  }
  /** Le passeur décisif d'un but : la dernière passe réussie reçue par le buteur dans les 6 s (stats.js passeurDe). */
  function passeurDe(by, t) {
    for (let i = S.faits.length - 1; i >= 0; i--) { const f = S.faits[i]; if (t - f.t > 6) break; if (f.k === 'passe' && f.ok && f.to === by && f.t <= t) return f.by; }
    return null;
  }

  function lire(ev, per, qui) {
    const t = ev.t / 1000, P = qui.get(ev.joueur) ?? null, team = ev.equipe;
    const [x, z] = P ? sens(P.equipe, P.x, P.y) : [null, null];
    const base = { t, per, team, by: ev.joueur >= 0 ? ev.joueur : null, x: x != null ? r1(x) : null, z: z != null ? r1(z) : null };
    switch (ev.type) {
      case EV.TOUCHE: {
        const b = ev.b, keeper = !!J[ev.joueur]?.keeper, apresCpa = S.cpa && S.cpa.premiere;
        // le tir en cours, coupé par l'adversaire : le gardien l'arrête, un autre le contre
        if (S.tir && !S.tir.ligne && team !== S.tir.team) {
          finirTir(keeper ? 'arrete' : 'contre');
          if (!keeper) fait({ ...base, k: 'contre' });
        }
        // la passe en cours, jugée par la touche d'un autre joueur
        let intercepte = false;
        if (S.pass && ev.joueur !== S.pass.by) {
          if (team === S.pass.team) finirPasse(true, 'recue', ev.joueur, P);
          else { finirPasse(false, 'intercepte'); intercepte = true; }
        }
        // LE BALLON GAGNÉ : l'équipe change d'une touche à l'autre (hors remise en jeu) — noté ici, compté comme RÉCUPÉRATION seulement
        // quand la possession déclarée par le corps s'y stabilise (stabiliser : les ballons disputés changent de pied sans cesse)
        if (S.dernier && S.dernier.equipe !== team && !apresCpa) {
          const why = intercepte || b === GESTE.INTERVENTION ? 'interception' : b === GESTE.TACLE ? 'tacle' : keeper ? 'gardien' : 'libre';
          S.gain = { ...base, why };
          if (b === GESTE.TACLE) fait({ ...base, k: 'tacle', gagne: true, glisse: false });
        }
        if (b === GESTE.TIR) {
          if (S.tir) finirTir(null);
          const dx = HX - (x ?? 0), dz = z ?? 0, partie = ev.a === 1 ? 'tete' : 'pied';
          const genre = apresCpa && S.cpa.tireur === ev.joueur ? (S.cpa.mode === 6 ? 'penalty' : S.cpa.mode === 3 ? 'coup-franc-direct' : null) : null;
          const surface = dx <= 16.5 && Math.abs(dz) <= 20.16, six = dx <= 5.5 && Math.abs(dz) <= 9.16;
          S.tir = fait({ ...base, k: 'tir', genre: genre ?? 'jeu', partie, dist: r1(Math.hypot(dx, dz)), surface, six, xg: +xgRef(dx, dz, partie, genre).toFixed(3) });
        } else if (PASSES.has(b)) {
          if (keeper) fait({ ...base, k: 'relance', mains: !!P?.enMain, long: b !== GESTE.PASSE_COURTE });
          if (S.pass) finirPasse(false, 'coupee');
          const une = !!(S.dernier && S.dernier.joueur !== ev.joueur && !apresCpa);
          S.pass = fait({ ...base, k: 'passe', to0: null, len0: null, style: b === GESTE.PASSE_HAUTE ? 'lofted' : b === GESTE.PASSE_LONGUE ? 'driven' : 'ground', air: b === GESTE.PASSE_HAUTE, une, cpa: apresCpa ? MODES[S.cpa.mode] : null });
          if (S.passeInfo && S.passeInfo.joueur === ev.joueur && Math.abs(S.passeInfo.t - ev.t) < 60) { attacherPasse(S.passeInfo, qui); S.passeInfo = null; }
        } else if (b === GESTE.CONTROLE || b === GESTE.AMORTI) fait({ ...base, k: 'controle', tech: b === GESTE.AMORTI ? 'amorti' : 'controle', rate: false });
        else if (b === GESTE.PRISE || (keeper && b === GESTE.DEVIATION)) fait({ ...base, k: 'arret', mode: b === GESTE.PRISE ? 'prise' : 'parade' });
        else if (b === GESTE.INTERVENTION && x != null && x < -HX / 3) fait({ ...base, k: 'degagement', geste: 'pied' });
        else if (b === GESTE.MOUVEMENT) fait({ ...base, k: 'touche' });
        if (S.cpa && S.cpa.premiere) S.cpa.premiere = false;
        S.dernier = { joueur: ev.joueur, equipe: team, b, t };
        break;
      }
      case EV.PASSE: {
        // le destinataire (au contact) : sur la passe déjà ouverte par la touche, sinon gardé pour elle
        if (S.pass && S.pass.by === ev.joueur && S.pass.to0 == null) attacherPasse(ev, qui);
        else S.passeInfo = ev;
        break;
      }
      case EV.BUT: {
        const T = S.tir && S.tir.team === team ? S.tir : null; if (T) finirTir('but'); else if (S.tir) finirTir(null);
        if (S.pass) finirPasse(false, 'but');
        const csc = ev.a === 1, by = ev.joueur >= 0 ? ev.joueur : (T?.by ?? null);
        fait({ ...base, team, by, k: 'but', csc, penalty: T?.genre === 'penalty', tir: T ? S.faits.indexOf(T) : null, passeur: !csc && by != null ? passeurDe(by, t) : null });
        if (T) T.but = true;
        S.dernier = null;
        break;
      }
      case EV.FAUTE: {
        if (S.pass) finirPasse(false, 'faute'); if (S.tir) finirTir(null);
        fait({ ...base, k: 'faute', sur: ev.b >= 0 ? ev.b : null, genre: ev.c === 1 ? 'penalty' : ev.c === -1 ? 'avantage' : null });
        if (ev.a === 2) {
          const n = (S.jaunes.get(ev.joueur) ?? 0) + 1; S.jaunes.set(ev.joueur, n);
          fait({ ...base, k: 'carton', couleur: 'jaune' });
          if (n === 2) fait({ ...base, k: 'carton', couleur: 'rouge', deuxJaunes: true });
        } else if (ev.a === 3) fait({ ...base, k: 'carton', couleur: 'rouge' });
        break;
      }
      case EV.HORS_JEU: { if (S.pass) finirPasse(false, 'hors-jeu'); fait({ ...base, k: 'hors-jeu' }); break; }
      case EV.CPA: {
        if (S.pass) finirPasse(false, 'sortie'); if (S.tir) finirTir(null);
        const mode = ev.a;
        if (mode === 4) fait({ t, per, team, k: 'sortie', out: 'corner' });
        else if (mode === 2) fait({ t, per, team, k: 'sortie', out: 'sortie-de-but' });
        else if (mode === 5) fait({ t, per, team, k: 'sortie', out: 'touche' });
        S.cpa = { mode, tireur: ev.joueur, t, premiere: true };
        S.dernier = null; S.possStable = team; S.possCand = null; S.gain = null;   // une remise donne le ballon : ce n'est pas une récupération
        break;
      }
    }
  }
  function attacherPasse(ev, qui) {
    const P = S.pass; if (!P) return;
    P.to0 = ev.b >= 0 ? ev.b : null; P.vitesse = r1(ev.c); P.impose = ev.d >= 0 ? ev.d : null;
    const R = P.to0 != null ? qui.get(P.to0) : null;
    if (R && P.x != null) { const [rx, rz] = sens(P.team, R.x, R.y); P.len0 = r1(Math.hypot(rx - P.x, rz - P.z)); }
  }

  /** Le geste du cerveau fini (gestes en course, face-à-face) → un dribble : réussi s'il n'a pas fini sur une touche adverse. */
  function dribbles(cerveau, per, qui) {
    const g = cerveau?.gesteDernier;
    if (g && g !== S.gesteVu) {
      S.gesteVu = g;
      if (g.issue !== 'pas-parti' && g.issue !== 'jeu-arrete') {
        const P = qui.get(g.porteur), [x, z] = P ? sens(P.equipe, P.x, P.y) : [null, null];
        fait({ t: g.t, per, team: P?.equipe ?? J[g.porteur]?.team ?? null, by: g.porteur, x: x != null ? r1(x) : null, z: z != null ? r1(z) : null, k: 'dribble', geste: g.nom, ok: g.issue !== 'touche-adverse', perdu: g.issue === 'touche-adverse', issue: g.issue });
      }
    }
    const f = cerveau?.faceDerniere;
    if (f && f !== S.faceVue) {
      S.faceVue = f;
      const ok = (/^sortie/.test(f.issue) && f.issue !== 'sortie-coupee') || f.issue === 'depasse' || f.issue === 'fente-contree' || /-repris$/.test(f.issue);
      const perdu = ['fente-gagnee', 'chipe', 'echappe', 'perdu', 'tiers', 'sortie-coupee'].includes(f.issue);
      if (ok || perdu) {
        const P = qui.get(f.porteur), [x, z] = P ? sens(P.equipe, P.x, P.y) : [null, null];
        fait({ t: f.t, per, team: P?.equipe ?? J[f.porteur]?.team ?? null, by: f.porteur, x: x != null ? r1(x) : null, z: z != null ? r1(z) : null, k: 'dribble', geste: 'face-a-face', contre: f.defenseur ?? null, ok, perdu, issue: f.issue });
      }
    }
  }

  /** Les échantillons d'un pas : la possession (temps simulé, ballon en jeu), les distances, les sprints, le temps de jeu (horloge du
   *  match), les heatmaps et la forme de l'équipe. */
  function echantillonner(etat, per, dt, dtHorloge) {
    const jeu = etat.enJeu && !etat.cpa, pe = etat.possession.equipe;
    if (jeu && (pe === 0 || pe === 1)) S.poss[per][pe] += dt;
    for (const j of etat.joueurs) {
      const Jj = J[j.id]; if (!Jj) continue;
      const p = S.prevPos.get(j.id);
      // un replacement (coup de pied arrêté, engagement) n'est pas une course : au-delà de 12 m/s, le pas est ignoré
      if (p) { const d = Math.hypot(j.x - p[0], j.y - p[1]); if (d <= Math.max(0.5, 12 * dt)) Jj.dist[per] += d; }
      S.prevPos.set(j.id, [j.x, j.y]);
      if (!j.actif) continue;
      Jj.tJeu[per] += dtHorloge; Jj.vMax = Math.max(Jj.vMax, j.vitesse);
      if (!Jj._sprint && j.vitesse > 7) { Jj._sprint = true; Jj.sprints[per]++; } else if (Jj._sprint && j.vitesse < 5.5) Jj._sprint = false;
      if (jeu) {
        const [x, z] = sens(j.equipe, j.x, j.y);
        const ix = Math.max(0, Math.min(GX - 1, Math.floor((x + HX) / (2 * HX) * GX))), iz = Math.max(0, Math.min(GZ - 1, Math.floor((z + HZ) / (2 * HZ) * GZ)));
        Jj.heat[per][iz * GX + ix] += dt;
      }
    }
    if (jeu && (pe === 0 || pe === 1)) {
      for (const t of [0, 1]) {
        const xs = [], zs = [];
        for (const j of etat.joueurs) if (j.equipe === t && j.role !== 0 && j.actif) { const [x, z] = sens(t, j.x, j.y); xs.push(x + HX); zs.push(z); }
        if (xs.length < 6) continue;
        const Fm = S.forme[t][per], cx = xs.reduce((a, b) => a + b, 0) / xs.length, lz = Math.max(...zs) - Math.min(...zs);
        if (pe === t) { Fm.nA++; Fm.larg += lz; Fm.profA += cx; }
        else { const o = [...xs].sort((a, b) => a - b); Fm.nD++; Fm.ligne += (o[0] + o[1] + o[2] + o[3]) / 4; Fm.bloc += cx; Fm.long += o[o.length - 1] - o[0]; Fm.largD += lz; }
      }
    }
  }

  /** LA RÉCUPÉRATION : la possession déclarée par le corps passe à l'autre équipe et y reste STABLE 0,4 s (ballon en jeu) ; le geste qui
   *  l'a gagnée (la touche notée S.gain : interception, tacle, gardien, ballon libre) en dit la cause. */
  function stabiliser(etat, per, t) {
    const pe = etat.possession.equipe;
    if (!etat.enJeu || etat.cpa || (pe !== 0 && pe !== 1)) return;
    if (!S.possCand || S.possCand.team !== pe) { S.possCand = { team: pe, depuis: t }; return; }
    if (S.possStable === pe || t - S.possCand.depuis < 0.4) return;
    if (S.possStable === 0 || S.possStable === 1) {
      const g = S.gain && S.gain.team === pe ? S.gain : null;
      S.lastLoss[1 - pe] = t;
      fait({ ...(g ?? { t, per, team: pe, by: null, x: null, z: null }), per, k: 'recuperation', why: g?.why ?? 'libre', contrePress: t - S.lastLoss[pe] < 5 });
    }
    S.possStable = pe; S.gain = null;
  }

  /** Le tir en vol : le passage de la ligne de but attaquée (cadré, hors cadre, frôle), interpolé entre deux lectures. */
  function ligne(etat) {
    const T = S.tir, b = etat.ballon, p = S.ballPrev;
    if (!T || T.ligne || !p) return;
    const g = T.team === 0 ? HX : -HX;
    if ((p[0] - g) * (b[0] - g) > 0 || p[0] === b[0]) return;
    const f = (g - p[0]) / (b[0] - p[0]), y = p[1] + f * (b[1] - p[1]), h = p[2] + f * (b[2] - p[2]);
    const dy = Math.abs(y) - BUT_DEMI, dh = h - BUT_H;
    T.ligne = { z: r1(-y), y: r1(h), cadre: dy <= 0 && dh <= 0, frole: (dy > 0 && dy < 0.25 && h < BUT_H + 0.25) || (dh > 0 && dh < 0.25 && dy < 0.25) };
  }

  return {
    S, ST,
    /**
     * Après chaque avance du corps : le journal lu depuis la précédente (le même tableau que reçoit le cerveau), l'état après l'avance.
     * @param {object} etat lireEtat
     * @param {object[]} journal lireJournal
     * @param {{ per?: number, dt?: number, cerveau?: object }} o per : la mi-temps (1, 2) ; dt : le temps simulé de l'avance (s)
     */
    observer(etat, journal, { per = 1, dt = 0.01, cerveau = null } = {}) {
      per = per >= 2 ? 2 : 1;
      const qui = new Map(etat.joueurs.map((j) => [j.id, j]));
      for (const ev of journal) lire(ev, per, qui);
      ligne(etat);
      if (cerveau) dribbles(cerveau, per, qui);
      const t = etat.t / 1000, dtH = S.tPrev == null ? 0 : Math.max(0, Math.min(5, t - S.tPrev));
      echantillonner(etat, per, dt, dtH);
      stabiliser(etat, per, t);
      S.tPrev = t; S.ballPrev = [etat.ballon[0], etat.ballon[1], etat.ballon[2]];
      // les résolutions au temps
      if (S.pass && t - S.pass.t > 8) finirPasse(false, 'temps');
      if (S.tir && t - S.tir.t > 5) finirTir(null);
    },
    /** Le rapport de la skill (stats.js statsReport) : per null = le match, 1 ou 2 = une mi-temps. */
    rapport({ per = null } = {}) { return statsReport(S, ST, { per }); },
    /** La chronologie : les buts (buteur, passeur, contre son camp, penalty) et les cartons, dans l'ordre — { t, per, minute, k, team, by, … }. */
    chronologie() {
      if (S._chronoVu !== S.chrono.length) { S._chronoVu = S.chrono.length; S._chronoCache = S.chrono.map((f) => ({ ...f, minute: Math.floor(f.t / 60) + 1 })); }
      return S._chronoCache;
    },
    /** Le nom d'un joueur (id stable), ou son poste à défaut. */
    nom(id) { return J[id]?.name ?? (id != null && id >= 0 ? `n° ${id}` : '?'); },
  };
}
