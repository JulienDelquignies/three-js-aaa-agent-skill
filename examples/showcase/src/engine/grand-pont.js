// grand-pont.js — LE GRAND PONT, « pousser-courir » (lot 357 ; référence : Olmo, Angleterre–Espagne, clip du 26/09 : il FIXE le défenseur
// qui vient sur lui, et à l'instant où celui-ci S'ENGAGE, une seule touche pousse le ballon d'UN côté du défenseur pendant que le porteur
// le contourne de l'AUTRE, épaule contre épaule, et repart plein pot). L'élimination la plus fréquente du vrai jeu, surtout en transition ;
// le répertoire n'avait que des gestes d'équilibriste (passement, crochet, croqueta, pont, roulette) — rien pour le porteur LANCÉ.
//
// La niche, disjointe des frères : un porteur EN COURSE (≥ vMin) sur son ballon, un défenseur de FACE (cône) à [foe] m qui S'ENGAGE
// (il ferme sur lui à ≥ engage m/s — le jockey posté appartient au passement, le glisseur au pont, le jeté franc à la croqueta), et de
// l'ESPACE derrière lui d'un côté (le point B, à profondeur m derrière et lateral m de côté, libre de tout adversaire à clear m, dans
// le terrain). Le ballon part du côté le plus libre ; à égalité, CONTRE l'élan latéral du défenseur (il ne se retourne pas contre son pas).
//
// Qui : la note de dribble × le flair × gesteF² × accelF² — le grand pont est un pari de VITESSE (Olmo, Mbappé), pas d'exhibition.
// Le MOMENT : l'engagement du défenseur (sa vitesse de fermeture) allonge sa morsure — le bon dribbleur attend que l'autre se jette.
// Au contact (hors du noyau commun — voir grandPontContact) : réussi, le ballon part (strike physique, interceptable), le défenseur MORD
// (bite × gesteF × engagement), le porteur contourne et accélère ; raté, la touche part trop près du défenseur, qui ne mord pas.
// Clé `cfg.grandPont` (st.full) ; absente/null : le répertoire d'hier au bit.
import { tirage } from './rng.js';
import { hyp } from './hyp.js';
import { situation, footFor, byId } from './technique.js';
import { startGesture, abortGesture } from './gesture.js';

const d2 = (a, b) => hyp(a[0] - b[0], a[2] - b[2]);
const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));
export const GRAND_PONT_TIMING = { duration: 0.36, contact: 0.14 };   // le geste généré (motion-skill grandPont) : une poussée sèche

/** Le déclencheur, au tick de décision du porteur. dribMF, poidsF : les facteurs du répertoire (skills-sim), évalués SEULEMENT si la niche s'ouvre. */
export function maybeGrandPont(st, c, cfg, dribMF, poidsF) {
  const K = st.full ? cfg.grandPont : null; if (!K) return false;
  if (c.keeper || (c._skillCd?.grandPont ?? -1) > st.t) return false;
  if (d2(c.p, st.ball.p) > 0.6 || c.speed < (K.vMin ?? 2.0)) return false;             // sur SON ballon, LANCÉ
  let foe = null, fd = Infinity;
  for (const q of st.players) { if (q.team === c.team || q.down > 0 || q.keeper) continue; const d = d2(q.p, c.p); if (d < fd) { fd = d; foe = q; } }
  if (!foe || fd < K.foe[0] || fd > K.foe[1]) return false;
  const ux = (foe.p[0] - c.p[0]) / fd, uz = (foe.p[2] - c.p[2]) / fd;
  if (situation(c.p, c.yaw, foe.p, [0, 0], 0.11).bearing > (K.cone ?? 35)) return false;   // de FACE
  const engage = -(ux * foe.v[0] + uz * foe.v[1]);                                     // il ferme sur le porteur (m/s)
  (st.deny ??= {})['grandPont-niche'] = (st.deny['grandPont-niche'] ?? 0) + 1;   // (la sonde : la niche ouverte au tick de décision)
  if (engage < (K.engage ?? 1.0)) return false;                                        // pas encore engagé : on le FIXE encore
  // les deux côtés : le point B derrière le défenseur, et le couloir du ballon ; le plus libre gagne
  const nx = -uz, nz = ux, prof = K.profondeur ?? 4, lat = K.lateral ?? 1.4;
  const lib = (s) => {
    const bx = foe.p[0] + ux * prof + nx * s * lat, bz = foe.p[2] + uz * prof + nz * s * lat;
    if (st.area && (Math.abs(bx) > st.area[0] / 2 - 1 || Math.abs(bz) > st.area[1] / 2 - 1)) return -1;
    let m = 99; for (const q of st.players) { if (q.team === c.team || q.down > 0 || q === foe) continue; m = Math.min(m, hyp(q.p[0] - bx, q.p[2] - bz), hyp(q.p[0] - (bx + foe.p[0]) / 2, q.p[2] - (bz + foe.p[2]) / 2)); }
    return m;
  };
  const lG = lib(1), lD = lib(-1), latFoe = nx * foe.v[0] + nz * foe.v[1];
  const side = Math.abs(lG - lD) > 0.5 ? (lG > lD ? 1 : -1) : (latFoe > 0 ? -1 : 1);
  if (Math.max(lG, lD) < (K.clear ?? 2.5) || (side > 0 ? lG : lD) < (K.clear ?? 2.5)) { (st.deny ??= {})['grandPont-sans-espace'] = (st.deny['grandPont-sans-espace'] ?? 0) + 1; return false; }
  const B = [foe.p[0] + ux * prof + nx * side * lat, foe.p[2] + uz * prof + nz * side * lat];
  // QUI : un pari de vitesse — la note de dribble, le flair, la technique ET l'accélération (au carré : le lent ne pousse pas devant lui)
  const w = dribMF() * poidsF() * (K.part ?? 0.35) * (0.4 + 0.6 * (c.persona?.flair ?? 0.5)) * ((c.skill?.gesteF ?? 1) ** 2) * ((c.skill?.accelF ?? 1) ** 2);
  if (tirage(st, 'geste', c.id, st.rnd ?? (() => 0.5))() > w) { (c._skillCd ??= {}).grandPont = st.t + (K.refusCd ?? 1.5); (st.deny ??= {})['grandPont-tirage'] = (st.deny['grandPont-tirage'] ?? 0) + 1; return false; }
  const sit = situation(c.p, c.yaw, st.ball.p, [0, 0], st.ball.p[1]);
  const foot = footFor(byId.crochet, sit);
  if (st.ball.owner !== c.id) st.ball.possess(c.id);
  // le porteur contourne de l'AUTRE côté : un point à 1 m du défenseur, puis la course vers B
  const W = [foe.p[0] - nx * side * (K.contour ?? 1.0), foe.p[2] - nz * side * (K.contour ?? 1.0)];
  const exitYaw = Math.atan2(W[1] - c.p[2], W[0] - c.p[0]);
  startGesture(c, { id: 'grandPont', ...GRAND_PONT_TIMING }, {
    payload: { kind: 'skill', skill: 'grandPont', pick: { foot }, ownsBody: true, yaw0: c.yaw, exitYaw, B, W, side, u: [ux, uz], foeId: foe.id, engage, v0: c.speed, ballMax: 0 },
    log: st.gestures,
  });
  (c._skillCd ??= {}).grandPont = st.t + (K.cd ?? 8);
  c.intent = null; c._dribAt = st.t;
  st.events.push({ t: +st.t.toFixed(2), type: 'windup', by: c.id, move: 'grandPont', foot, skill: 'grandPont', anticipation: GRAND_PONT_TIMING.contact });
  st.events.push({ t: +st.t.toFixed(2), type: 'skill', kind: 'grandPont-tente', by: c.id, foe: +fd.toFixed(2), engage: +engage.toFixed(1), side });
  return true;
}

/** Au contact (skillContactNow). HORS du noyau commun (268) : mesuré avec lui, 15 dépossessions sur 22 (le book : ~15 %) — le noyau lit un
 *  défenseur à 1,3-4 m qui FERME comme un défenseur qui atteint le ballon ; pour le grand pont c'est l'inverse, son engagement le perd.
 *  L'issue : la technique du porteur contre les réflexes du défenseur, et le MOMENT (plus il s'est jeté, plus ça passe) ; raté, le ballon
 *  TAPE LA JAMBE et revient court (le 50/50 du pont). Réussi, le vol reste physique — le défenseur non mordu peut encore l'intercepter. */
export function grandPontContact(st, p, A, cfg) {
  const K = cfg.grandPont ?? {}, foe = st.players[A.foeId ?? -1];
  const pOk = (K.pOk ?? 0.55) + 0.25 * ((p.skill?.gesteF ?? 1) - 1) + 1.5 * ((foe?.skill?.reaction ?? 0.22) - 0.22) + 0.1 * Math.min(1, (A.engage ?? 0) / 2);
  const reussi = !foe || foe.down > 0 || tirage(st, 'geste', p.id, st.rnd ?? (() => 0.5))() < pOk;
  st.pass = null; p._dribAt = st.t; A.reussi = reussi; A.pousse = true;
  // raté, la touche est MAL DOSÉE : le ballon part trop près du défenseur (un quart de l'écart prévu) et il ne mord pas — il l'intercepte
  // s'il est là (physique, visible). Le « ballon qui tape la jambe » du pont n'a pas de sens à 3-4 m (filmé : il revenait derrière le porteur)
  const lat = A.side * (K.lateral ?? 1.4), Bm = reussi || !foe ? A.B : [A.B[0] + (A.u?.[1] ?? 0) * lat * 0.75, A.B[1] - (A.u?.[0] ?? 0) * lat * 0.75];   // B − n·côté·lat·¾, n = (−uz, ux)
  st.ball.strike({ speed: K.v ?? 5.5, dirYaw: Math.atan2(Bm[1] - st.ball.p[2], Bm[0] - st.ball.p[0]), elevation: 0.01, spinAxis: [0, 1, 0], spinRev: 0 });
  if (reussi && foe && foe.down <= 0) foe._bite = st.t + (K.bite ?? 0.55) * (p.skill?.gesteF ?? 1) * Math.min(1.5, Math.max(0.6, (A.engage ?? 1) / 2));   // le MOMENT : plus il s'est jeté, plus il mord
  p._pace = { ...(p._pace ?? { next: 3 }), until: st.t + 1.1, kind: 'sortie' };
  if (foe) { const d = hyp(foe.p[0] - p.p[0], foe.p[2] - p.p[2]) || 1; p._gp = { until: st.t + (K.sansTouche ?? 1.2), foe: foe.id, u: [(foe.p[0] - p.p[0]) / d, (foe.p[2] - p.p[2]) / d] }; }
  st.events.push({ t: +st.t.toFixed(2), type: 'skill', kind: 'grandPont', by: p.id, reussi, bitten: reussi && foe ? [foe.id] : [], foot: A.pick.foot });
}

/** Image par image (skillFollowStep) : avant le contact le corps se cale sur le ballon ; après, il CONTOURNE (vers W) et accélère. */
export function grandPontFollow(st, p, A, dt) {
  if (p.act.t < p.act.anticipation) {
    if (st.ball.owner !== p.id) { abortGesture(p, 'ballon-souffle-pendant-grand-pont', { log: st.gestures }); return; }
    p.v[0] *= 0.9; p.v[1] *= 0.9; p.speed = hyp(p.v[0], p.v[1]);
    return;
  }
  // le ballon PARTI vit sa vie : un geste ownsBody fait taire l'intégration du ballon (rondo-sim) — le pont d'hier le gelait pendant son
  // accompagnement (mesuré : 0,2 s immobile à 7,5 m/s, le porteur le rattrapait et la conduite le TUAIT d'une touche) ; ici il vole
  if (st.ball.owner !== p.id) st.ball.integrate(dt);
  const u = Math.min(1, (p.act.t - p.act.anticipation) / Math.max(1e-4, p.act.follow)), e2 = u * u * (3 - 2 * u);
  const aim = hyp(A.W[0] - p.p[0], A.W[1] - p.p[2]) > 0.5 ? Math.atan2(A.W[1] - p.p[2], A.W[0] - p.p[0]) : Math.atan2(A.B[1] - p.p[2], A.B[0] - p.p[0]);
  p.yaw = wrapA(A.yaw0 + wrapA(aim - A.yaw0) * e2); p.yawWant = null;
  const vC = Math.max(4, A.v0 ?? 4) * (0.9 + 0.55 * e2) * (p.skill?.accelF ?? 1);   // il PART : ~6 m/s en fin de geste (mesuré à 3-4 : un autre ramassait le ballon)
  p.v[0] = Math.cos(p.yaw) * vC; p.v[1] = Math.sin(p.yaw) * vC;
  p.p[0] += p.v[0] * dt; p.p[2] += p.v[1] * dt; p.speed = vC;
}


/** (357) LE PORTEUR NE RETOUCHE PAS SON BALLON AVANT D'AVOIR PASSÉ LE DÉFENSEUR : sans ça, la conduite le rattrapait 0,22 s après la poussée
 *  (6 fois sur 15, mesuré) et le renvoyait vers SA course — du côté du défenseur, le grand pont devenait une touche. Vrai tant que le
 *  porteur n'a pas franchi la ligne du défenseur (le long de l'axe du duel au contact), au plus sansTouche s. */
export function gpSansTouche(st, c) {
  const G = c._gp; if (!G) return false;
  const f = st.players[G.foe];
  if (st.t > G.until || !f || (c.p[0] - f.p[0]) * G.u[0] + (c.p[2] - f.p[2]) * G.u[1] > 0) { c._gp = null; return false; }
  return true;
}
