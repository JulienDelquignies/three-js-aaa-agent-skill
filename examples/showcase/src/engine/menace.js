// menace.js — L'ARBITRE DE MENACE ON-BALL : le cerveau du porteur est un CONTRAT, pas un ordre
// figé. Avant lui, le porteur vivait sur trois heuristiques séparées évaluées dans un ordre
// écrit en dur (tir, puis centre, puis passe, sinon conduite) — chacune avec ses seuils, aucune
// ne sachant ce que les autres valaient. Ici : QUATRE options notées sur UNE échelle (la menace
// — « qu'est-ce qui rapproche du but adverse ? »), un gagnant, et le POURQUOI sur chaque note.
//
// Le patron moteur (Unity/Unreal) : le moteur possède l'EXÉCUTION (gestes, balistique, duels,
// portes nommées des exécuteurs — tryShot garde ses refus, choosePass ses couloirs) ; la
// POLITIQUE est remplaçable — `cfg.decide` injecte un arbitre aval complet (même contrat de
// retour : { meilleure: 'tir'|'centre'|'passe'|'conduite', … }), et le moteur l'écoute sans
// rien perdre de ses lois. PAS DE SECONDE VÉRITÉ : chaque note se calcule avec les MÊMES
// primitives que l'exécuteur qu'elle représente (laneClearance, le vrai choosePass, les mêmes
// seuils de position) — un arbitre qui inventerait sa propre géométrie divergerait du monde.
//
// Pur : un état entre, des notes sorent — testable au banc (verify-menace), sans navigateur.
// Clé absente (rondo, réduit futsal) : l'ancien ordre, au bit près (la consommation est gardée
// par cfg.menace && st.full dans le loop).

import { laneClearance } from './ball-predict.js';
import { choosePass } from './rondo.js';
import { axe } from './tactics.js';

/** LE TIR — proximité × couloir réel vers le meilleur coin (les mêmes lois que tryShot : portée,
 *  moitié, angle fermé, coin choisi contre le gardien, trafic toléré à bout portant). */
export function menaceTir(st, c, cfg) {
  const { pitch } = st;
  const goal = pitch.attackGoal(c.team);
  const d = hyp(goal.x - c.p[0], c.p[2]);
  const R = cfg.shotRange ?? 15;
  // LA PORTÉE DE TIR EST L'ATTRIBUT, PAS UN MUR (lot 92, cfg.menace.grise && st.full — mesuré :
  // 8 conduites muettes / 4 matchs, tir « hors-portée » 8/8 à 21-31 m, l'une jusqu'aux pieds du
  // gardien). Entre R et R×grise, le tir EXISTE, dégressif, pondéré par le FINISHING (facteur :
  // l'élite tente à 25 m, le fini de 30 jamais — shotSigma inversé, défaut 0,5 sans effectif).
  // false : le mur binaire d'hier (sabotage nommé).
  const grise = st.full && cfg.menace?.grise ? R * cfg.menace.grise : R;
  // LE GARDIEN SORTI SE VOIT (lot 120, cfg.lob && st.full) : le libéro hors de sa ligne à
  // distance de lob EST une occasion — le score se plancherise ici même (avant les refus de
  // distance et d'angle : la cage est VIDE, ces portes parlent d'un but gardé), pondéré par
  // longShots et par l'AMPLEUR de la sortie. Sans cette lecture, la fenêtre du contre mourait
  // en 'hors-portée' : l'arbitre ne regardait que la distance, jamais le gardien (mesuré :
  // 839 frames de fenêtre 18-38 m / 3 matchs, 0 lob tenté). Clé absente : l'arbitre d'hier.
  const gkS = st.full && cfg.lob && !c.keeper ? st.players.find((p) => p.keeper && p.team !== c.team) : null;
  const gkOffS = gkS ? Math.abs(gkS.p[0] - goal.x) : 0;
  const capS = gkS ? Math.atan2(0 - c.p[2], goal.x - c.p[0]) : 0;
  const decolleS = !gkS || !st.players.some((q) => q.team !== c.team && q.down <= 0
    && hyp(q.p[0] - c.p[0], q.p[2] - c.p[2]) < (cfg.lob.decolle ?? 3.5)
    && Math.abs((Math.atan2(q.p[2] - c.p[2], q.p[0] - c.p[0]) - capS + 3 * Math.PI) % (2 * Math.PI) - Math.PI) < 0.6);
  if (gkS && decolleS && gkOffS >= (cfg.lob.out ?? 4) && d >= (cfg.lob.min ?? 18) && d <= (cfg.lob.max ?? 38)
    && Math.abs(c.p[2]) <= 14 && Math.sign(c.p[0] || goal.x) === Math.sign(goal.x)) {
    const longFS = c.skill?.longF ?? 1;
    let scL = Math.min(0.9, (cfg.lob.vue ?? 0.62) * longFS * (0.5 + Math.min(0.5, (gkOffS - (cfg.lob.out ?? 4)) / 8)));
    // …(232) le lob aussi a une QUALITÉ : la cage vide la multiplie (× (1 + sortie / Q.lobOut)) — mesuré sans la porte :
    // 25 % des tirs restants étaient des lobs de 30 m (10 / 90 min ; le réel en voit un par match, les bons jours)
    let qL = null, whyL = 'gardien-sorti';
    if (st.full && cfg.qualiteTir) {
      qL = qualiteTir(st, c, cfg, d, 0) * (1 + gkOffS / (cfg.qualiteTir.lobOut ?? 4));
      const g = selectiviteTir(st, c, cfg, qL); scL *= g.f; if (g.sel < 0.5) whyL = 'lob-sans-qualité';
    }
    return { score: +scL.toFixed(3), d: +d.toFixed(1), pourquoi: whyL, ...(qL != null ? { q: +qL.toFixed(3) } : {}) };
  }
  if (c.keeper || d > grise) return { score: 0, d: +d.toFixed(1), pourquoi: 'hors-portée' };
  if (Math.sign(c.p[0] || goal.x) !== Math.sign(goal.x) && d > R * 0.75) return { score: 0, d: +d.toFixed(1), pourquoi: 'sa-moitié' };
  // …l'angle fermé s'assouplit DE LOIN (lot 107, cfg.audace) : la porte tuait la frappe de
  // 22 m à |z| 9 — un tir réel (l'angle but reste ouvert à distance) ; près du but l'excentré
  // reste un centre. Clé absente : la porte d'hier au bit.
  const excuse = st.full && cfg.audace && d >= (cfg.audace.deLoin ?? 18) && Math.abs(c.p[2]) <= (cfg.audace.zMax ?? 12);
  if (Math.abs(c.p[2]) > pitch.goalHalf + 3 && d > 8.5 && !excuse) return { score: 0, d: +d.toFixed(1), pourquoi: 'angle-fermé' };
  const gk = st.players.find((p) => p.keeper && p.team !== c.team);
  const corners = [pitch.goalHalf - 0.55, -(pitch.goalHalf - 0.55)]
    .sort((a, b) => (gk ? Math.abs(b - gk.p[2]) - Math.abs(a - gk.p[2]) : 0));
  const blockers = st.players.filter((q) => q.team !== c.team && !q.keeper && q.down <= 0).map((q) => q.p);
  const need = d < 9 ? Math.min(cfg.shotClear ?? 0.45, 0.3) : (cfg.shotClear ?? 0.45);
  let margin = -1, tz = corners[0];
  for (const cz of corners) {
    const m = laneClearance([st.ball.p[0], 0, st.ball.p[2]], [goal.x, 0, cz], blockers).margin;
    if (m > margin) { margin = m; tz = cz; }
  }
  const laneF = Math.max(0, Math.min(1, margin / (need * 2)));      // 2× le besoin = pleine confiance
  const nearF = 1 - d / (R + 2);
  // L'OCCASION FRANCHE SE PREND (lot 67a — l'attaque asséchée d'un cran : le se-montrer offre
  // toujours une passe sûre et la circulation VOLAIT la frappe — mesuré : 0 tir en 330 s pour
  // 267 entrées de dernier tiers, seed 7). Cadre en vue à distance franche ⇒ le score de tir
  // est PLANCHERISÉ : seule une passe qui vaut MIEUX qu'une occasion (le caviar de surface)
  // peut encore la voler. cfg.tirFranc:false = la circulation stérile d'hier (sabotage nommé).
  const franc = margin >= need && d <= R * 0.8 && cfg.tirFranc !== false;
  // …et LE TIR SE TENTE en zone chaude même à demi-couloir (d ≤ 0,6·R, marge ≥ 0,4·need) : le
  // tir contré/dévié fait vivre la surface (corners, rebonds) — sans lui, un bloc hermétique
  // rend l'attaque STÉRILE (seed 7 : 0 tir en 330 s malgré le plancher franc, tous couloirs < need).
  const tente = !franc && margin >= need * 0.4 && d <= R * 0.6 && cfg.tirFranc !== false;
  // LE MUR SE CONTOURNE, PAS SE PERFORE (lot 126, cfg.menace.mur — le trafic de frappe : en
  // boîte dense les marqueurs suivent les coureurs, la clearance des tirs s'effondrait à 1,46
  // et le TENTÉ tirait quand même dans le mur : conversion 46 → 19 % mesurée tir par tir, le
  // corps AMI innocenté à 0,03/cône). Le score du tenté décroît avec la DENSITÉ ADVERSE du
  // cône de frappe (±0,35 rad) — l'arbitre rend la passe/conduite au porteur muré. Absente : hier.
  let murN = 0;
  if (st.full && cfg.menace?.mur) {
    const capM = Math.atan2(0 - c.p[2], goal.x - c.p[0]);
    for (const b of blockers) {
      const db = hyp(b[0] - c.p[0], b[2] - c.p[2]);
      if (db > d) continue;
      const angM = Math.abs(((Math.atan2(b[2] - c.p[2], b[0] - c.p[0]) - capM + 3 * Math.PI) % (2 * Math.PI)) - Math.PI);
      if (angM < 0.35) murN++;
    }
  }
  const murF = 1 / (1 + murN * (st.full && cfg.menace?.mur ? cfg.menace.mur : 0));
  // …le FRANC aussi : margin ≥ need (0,45 — un couloir de PASSE) restait « franc » dans une
  // boîte à 1,2 corps/cône et convertissait à 19 % — le mur pèse sur les deux branches.
  let sc = Math.max((0.30 + 0.62 * nearF) * (0.25 + 0.75 * laneF) * murF, franc ? (cfg.tirFranc ?? 0.72) * murF : tente ? (cfg.tirTente ?? 0.55) * murF : 0);   // …la BASE aussi : laneF ne voit que le meilleur coin, murF voit le trafic central
  let why = franc ? 'occasion-franche' : tente ? 'tir-tenté' : margin < need ? 'couloir-serré' : 'cadre-en-vue';
  if (d > R) {
    const finF = c.skill ? Math.max(0, Math.min(1, (0.55 - c.skill.shotSigma) / 0.45)) : 0.5;
    sc = Math.max(0.12, (0.30 + 0.62 * Math.max(0, nearF)) * (0.25 + 0.75 * laneF))
      * Math.max(0, 1 - (d - R) / Math.max(0.5, grise - R)) * (0.3 + 0.6 * finF);
    why = 'zone-grise';
    // L'AUDACE LOINTAINE (lot 107, cfg.audace && st.full — « ça manque de tir lointain » :
    // max 18,3 m mesuré, la zone grise ne GAGNAIT jamais l'arbitrage). Le vrai tir de loin
    // se tente quand on a LE TEMPS D'ARMER (aucun adversaire à < esp m du tireur) et le
    // couloir plein : le score se PLANCHERISE, pondéré par l'ATTRIBUT longShots (longF —
    // le monde note SES frappeurs de loin) et dégressif doux vers la grise. false : hier.
    if (st.full && cfg.audace && margin >= need * 0.8) {
      let charge = 99;
      for (const b of blockers) { const db = hyp(b[0] - c.p[0], b[2] - c.p[2]); if (db < charge) charge = db; }
      if (charge >= (cfg.audace.esp ?? 5)) {
        sc = Math.max(sc, (cfg.audace.bonus ?? 0.55) * (c.skill?.longF ?? 1)
          * Math.max(0, 1 - ((d - R) / Math.max(0.5, grise - R)) * 0.5));
        why = 'audace';
      }
    }
  }
  // LA ZONE DE VÉRITÉ (232, cfg.qualiteTir && st.full — la doctrine : Lacombe, 25-30 m ; le brief : 22-30 tirs par
  // match, 1 but pour 9-11 tirs, « le tir sans pression convertit ×2 » ; mesuré AVANT : 63 tirs / 90 min, 48 % sous
  // pression — « l'occasion franche se prend » plancherisait à 0,72 tout couloir libre à ≤ 16 m, chaque entrée de
  // surface devenait un tir). Le tir reçoit une QUALITÉ ATTENDUE q (qualiteTir : distance, angle, pression, mur) et
  // un SEUIL : Q.seuil × axe(style, 1,3, 0,7) (le direct tire de loin) ÷ rôle arbitre.tir (le 9) ÷ (0,7 + 0,6·finF)
  // (l'élite tente à 25 m, identité 0,5) × composureF (le sang-froid attend la meilleure occasion) × le score (mené :
  // Q.retard, on tire à vue ; devant : Q.avance). La SÉLECTIVITÉ s = lissage de q/seuil entre 0,5 et 1,5 étouffe les
  // planchers franc/tenté (× plancher + (1 − plancher)·s) : sous le seuil, la passe et la conduite reprennent la main —
  // conserver, porter vers la zone de vérité. Clé absente : l'arbitre d'hier au bit.
  let q = null;
  if (st.full && cfg.qualiteTir) {
    q = qualiteTir(st, c, cfg, d, murN);
    const g = selectiviteTir(st, c, cfg, q);
    sc *= g.f;
    if (g.sel < 0.5 && ['occasion-franche', 'tir-tenté', 'cadre-en-vue', 'zone-grise', 'audace'].includes(why)) why = 'qualité-insuffisante';   // le refus d'hier (couloir-serré) garde son nom : la géométrie explique mieux que le seuil
  }
  return { score: +sc.toFixed(3), d: +d.toFixed(1), marge: +margin.toFixed(2), tz: +tz.toFixed(1), pourquoi: why, ...(q != null ? { q: +q.toFixed(3) } : {}) };
}

/** LA SÉLECTIVITÉ (232) — pure : le seuil du tireur (Q.seuilBoite dans la surface / Q.seuilLoin hors × axe(style, 1,3, 0,7) ÷ rôle arbitre.tir ÷ (0,7 + 0,6·finF)
 *  × composureF × score) et le lissage de q/seuil entre 0,5 et 1,5 ; rend { f, sel, seuil } — f multiplie le score du
 *  tir (plancher + (1 − plancher)·sel). */
export function selectiviteTir(st, c, cfg, q) {
  const Q = cfg.qualiteTir ?? {}, T = st.tactics?.[c.team];
  const finQ = c.skill ? Math.max(0, Math.min(1, (0.55 - c.skill.shotSigma) / 0.45)) : 0.5;
  const lead = st.score ? (st.score[c.team] ?? 0) - (st.score[1 - c.team] ?? 0) : 0;
  // DEUX SEUILS (le brief 2.10) : dans la surface on attend mieux (seuilBoite 0,12) ; hors de la surface on accepte le
  // tir de qualité modeste (seuilLoin 0,05) — un seuil unique tuait toute la mi-distance (mesuré : 0 tir > 22 m, 83 %
  // dans la surface pour 60-68 réels), ou n'écrémait rien dans la boîte
  const goal = st.pitch.attackGoal(c.team), boite = Math.abs(goal.x - c.p[0]) <= st.pitch.dims.box.depth && Math.abs(c.p[2]) <= st.pitch.dims.box.width / 2;
  const seuil = (boite ? (Q.seuilBoite ?? Q.seuil ?? 0.12) : (Q.seuilLoin ?? Q.seuil ?? 0.05)) * (T ? axe(T.style, 1.3, 0.7) : 1) / (c.role?.arbitre?.tir ?? 1) / (0.7 + 0.6 * finQ)
    * (c.skill?.composureF ?? 1) * (lead < 0 ? (Q.retard ?? 0.8) : lead > 0 ? (Q.avance ?? 1.15) : 1);
  const u = q / Math.max(1e-6, seuil), t = Math.max(0, Math.min(1, (u - 0.5) / 1));
  const sel = t * t * (3 - 2 * t), pl = Q.plancher ?? 0.15;
  return { f: pl + (1 - pl) * sel, sel, seuil };
}

/** LA QUALITÉ ATTENDUE D'UN TIR (232) — pure : distance (0,36 à 8 m, e-fold Q.efold 8 m : 0,13 à 16, 0,05 à 24),
 *  angle (cos^1,5 de l'écart à l'axe du but : 0,8 à 30°, 0,35 à 60°), pression (un adversaire à < Q.pres m : ×
 *  Q.presF — le tir libre convertit ×2), mur (corps dans le cône : × 1/(1 + 0,5·n)). Le monde note ses tireurs
 *  ailleurs (le seuil) : la qualité est celle de la SITUATION, la même pour tous. */
export function qualiteTir(st, c, cfg, d = null, murN = 0) {
  const Q = cfg.qualiteTir ?? {}, goal = st.pitch.attackGoal(c.team);
  const dd = d ?? hyp(goal.x - c.p[0], c.p[2]);
  const qD = Math.min(1, (Q.base ?? 0.36) * Math.exp(-(dd - 8) / (Q.efold ?? 8)));
  const ang = Math.atan2(Math.abs(c.p[2]), Math.max(0.5, Math.abs(goal.x - c.p[0])));
  const qA = Math.pow(Math.max(0, Math.cos(ang)), 1.5);
  let presse = false;
  for (const o of st.players) if (o.team !== c.team && !o.keeper && o.down <= 0 && hyp(o.p[0] - c.p[0], o.p[2] - c.p[2]) < (Q.pres ?? 2)) { presse = true; break; }
  return qD * qA * (presse ? (Q.presF ?? 0.6) : 1) / (1 + 0.5 * murN);
}

/** LE CENTRE — les portes de position de tryCross (haut, large, boîte peuplée, cooldown), la
 *  note montant avec les cibles de surface. */
export function menaceCentre(st, c, cfg) {
  const { pitch } = st;
  const goal = pitch.attackGoal(c.team);
  const sgn = Math.sign(goal.x || 1);
  if (c.keeper) return { score: 0, pourquoi: 'gardien' };
  if ((st._crossCd?.[c.team] ?? -1) > st.t) return { score: 0, pourquoi: 'cooldown' };
  if (c.p[0] * sgn < pitch.hx - pitch.dims.box.depth - 9 || Math.abs(c.p[2]) < pitch.hz * 0.38) {
    return { score: 0, pourquoi: 'pas-en-position' };
  }
  const boxX = pitch.hx - pitch.dims.box.depth;
  const cibles = st.players.filter((q) => q.team === c.team && !q.keeper && q.id !== c.id && q.down <= 0
    && q.p[0] * sgn > boxX - 1.5 && Math.abs(q.p[2]) < pitch.dims.box.width / 2 + 1.5).length;
  if (!cibles) return { score: 0.05, pourquoi: 'boîte-vide' };
  return { score: +(0.34 + 0.14 * Math.min(2, cibles)).toFixed(3), cibles, pourquoi: 'surface-servie' };
}

/** LA PASSE — le VRAI cerveau de passe choisit (choosePass, pas une copie) ; la menace note ce
 *  que son élu VAUT : la progression vers le but, la liberté du couloir, la profondeur atteinte. */
export function menacePasse(st, c, cfg) {
  const best = choosePass(st, cfg);
  if (!best) return { score: 0.08, pourquoi: 'aucune-ligne' };
  const { pitch } = st;
  const goal = pitch.attackGoal(c.team);
  const dRec = hyp(goal.x - best.to.p[0], best.to.p[2]);
  const dMoi = hyp(goal.x - c.p[0], c.p[2]);
  const prog = Math.max(-1, Math.min(1, (dMoi - dRec) / 14));
  const libre = Math.min(1, (best.lane?.margin ?? 0) / 3);
  return {
    score: +(0.30 + 0.22 * prog + 0.18 * libre + 0.16 * Math.max(0, 1 - dRec / 30)).toFixed(3),
    vers: best.to.id, prog: +prog.toFixed(2),
    pourquoi: prog > 0.2 ? 'ligne-qui-progresse' : 'circulation',
  };
}

/** LA CONDUITE — l'espace RÉEL devant, dans le cône vers le but (~±35° sur 9 m) ; porter vaut
 *  plus loin du but (près, le tir et la passe doivent gagner — porter dans la surface est
 *  l'empalement déjà mesuré). LE GARDIEN EST UN CORPS DU CÔNE : la première version l'excluait
 *  (copie du filtre de tir, où c'est LUI qu'on défie) — le porteur ne le voyait pas comme
 *  obstacle et MARCHAIT dans le but, ballon au pied (mesuré : 12 buts / 16 tirs sur 4 matchs
 *  complets, dont ~la moitié en conduite pure — des scores 2-2 systématiques). Un gardien battu
 *  ou hors position laisse le cône OUVERT : le but-cadeau porté reste légitime, c'est le cas
 *  filet-ouvert — une seule loi couvre les deux mondes. */
export function menaceConduite(st, c, cfg) {
  const { pitch } = st;
  const goal = pitch.attackGoal(c.team);
  const gx = goal.x - c.p[0], gz = -c.p[2];
  const gl = hyp(gx, gz) || 1;
  const ux = gx / gl, uz = gz / gl;
  let espace = 9;
  for (const q of st.players) {
    if (q.team === c.team || q.down > 0) continue;
    const vx = q.p[0] - c.p[0], vz = q.p[2] - c.p[2];
    const along = vx * ux + vz * uz;
    if (along < 0 || along > 9) continue;
    if (Math.abs(vx * uz - vz * ux) < 1.4 + along * 0.7) espace = Math.min(espace, along);
  }
  const farF = Math.min(1, gl / pitch.hx);
  let sc = 0.14 + 0.5 * (espace / 9) * (0.55 + 0.45 * farF);
  let why = espace < 3 ? 'fermé-devant' : 'champ-devant';
  // LA CONDUITE MUETTE SE PAIE (lot 92, cfg.menace.muteD && st.full — la conduite gagnait PAR
  // DÉFAUT : « aucune-ligne » 6/8, l'arbitre n'avait rien d'autre). Au-delà de muteD m conduits
  // depuis la prise (c._takeP, posé par receive), le score décroît (plancher 0,32×) — la passe
  // de CIRCULATION redevient le bon choix : rendre le ballon quand rien ne s'ouvre EST le
  // football. false : la conduite gratuite d'hier (sabotage nommé).
  const mD = st.full && cfg.menace?.muteD && c._takeP ? hyp(c.p[0] - c._takeP[0], c.p[2] - c._takeP[1]) : 0;
  if (mD > (cfg.menace?.muteD ?? 10)) { sc *= Math.max(0.32, 1 - (mD - (cfg.menace?.muteD ?? 10)) * 0.07); why = 'conduite-muette'; }
  return { score: +sc.toFixed(3), espace: +espace.toFixed(1), pourquoi: why };
}

/**
 * L'ARBITRE — les quatre notes, pondérées par cfg.menace ({ tir, centre, passe, conduite } —
 * multiplicateurs, 1 par défaut), un gagnant, et chaque option porte son pourquoi. C'est LUI
 * que `cfg.decide` remplace chez un projet aval (même contrat de retour).
 */
export function arbitre(st, c, cfg) {
  const w = typeof cfg.menace === 'object' && cfg.menace ? cfg.menace : {};
  const o = {
    tir: menaceTir(st, c, cfg),
    centre: menaceCentre(st, c, cfg),
    passe: menacePasse(st, c, cfg),
    conduite: menaceConduite(st, c, cfg),
  };
  // LE STYLE D'ÉQUIPE (tactics.style — possession ↔ direct) pèse les options PAR ÉQUIPE :
  // possession monte la passe, direct monte tir/centre/conduite. Milieux = ×1 : la tactique
  // absente (rondo, réduit, équilibre) ne bouge pas un bit.
  // …±30-35 % aux extrêmes : la première paire (±20 %) ne faisait JAMAIS basculer un gagnant
  // (150 s de flux bit-identiques entre style 0 et style 1, mesuré) — un axe qui ne bouge
  // aucun choix est un placebo. Milieux exacts à 1 : l'identité du défaut tient au bit.
  const T = st.tactics?.[c.team];
  const sW = T ? {
    tir: axe(T.style, 0.7, 1.3), centre: axe(T.style, 0.8, 1.2),
    passe: axe(T.style, 1.35, 0.65), conduite: axe(T.style, 0.85, 1.15),
  } : null;
  // …ET LE RÔLE DU JOUEUR compose avec le style d'équipe (roles.js — ±15 % : un 9 direct dans
  // une équipe possession reste un 9, nuancé, pas écrasé). Aucun rôle : ×1, pas un bit.
  const rW = c.role?.arbitre;
  let meilleure = 'conduite', sMax = -Infinity;
  for (const k of ['tir', 'centre', 'passe', 'conduite']) {
    const s = o[k].score * (w[k] ?? 1) * (sW ? sW[k] : 1) * (rW?.[k] ?? 1);
    if (s > sMax) { sMax = s; meilleure = k; }
  }
  return { ...o, meilleure, score: +sMax.toFixed(3) };
}
import { hyp } from './hyp.js';
