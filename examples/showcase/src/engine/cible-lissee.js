// cible-lissee.js — LA CIBLE NE CLIGNOTE PAS (lot 370, cfg.cibleLissee — T1 du chantier tactique ; M05 #4 / M08 #1 du livre : 12-25
// changements de cible par minute, aucun pic > 1,5 Hz). Mesuré (600 s) : la cible des défenseurs « mark » SAUTAIT de plus de 3 m 117-128
// fois par minute et par joueur (p50 5,4 m) — après le slot et l'homme, cinq couches la réécrivent chaque image avec leurs seuils (la
// ligne accrochée et ses marges par état du porteur, la bande, l'interligne, le piège, la croyance) ; chaque bascule d'état la téléporte.
// Le corps courait derrière une cible qui clignote : 9,3 m de retard p50, N_def(10) des corps 2,1 quand les cibles en donnaient 3,2.
// La loi : pour les métiers SANS ballon (mark, cover, support), le corps suit une cible FILTRÉE (premier ordre, tau s) dont la vitesse est
// bornée (vMax m/s) — un vrai joueur ne réagit pas à une consigne qui change deux fois par seconde. Le presseur, le receveur, le porteur,
// l'intercepteur gardent leur cible exacte. Absente : la cible brute d'hier, au bit.
const hyp = Math.hypot, LISSES = new Set(['mark', 'cover', 'support']);
/** Lisse p.target en place (appelé au début du pas de mouvement de p). */
export function lisserCible(p, dt, K) {
  if (!p.target || !LISSES.has(p.job) || p.down > 0) { p._tL = null; return; }
  const L = p._tL;
  if (!L || L.job !== p.job) { p._tL = { x: p.target[0], z: p.target[2], job: p.job }; return; }
  const a = 1 - Math.exp(-dt / (K.tau ?? 0.35));
  let dx = (p.target[0] - L.x) * a, dz = (p.target[2] - L.z) * a; const d = hyp(dx, dz), m = (K.vMax ?? 9) * dt;
  if (d > m) { dx *= m / d; dz *= m / d; }
  L.x += dx; L.z += dz; p.target = [L.x, p.target[1] ?? 0, L.z];
}

/** (370, cfg.compressionBallon — B10 : N_def(10) 4,9 médian, 6,3 bloc bas) LE BLOC SE REFERME AUTOUR DU BALLON. Mesuré : les dix défenseurs
 *  s'étageaient uniformément (un tous les ~3,5 m de distance au ballon, du 1er à 4,6 m au 10e à 37 m) — rien ne resserrait autour du ballon,
 *  N_def(10) ≈ 2 quelle que soit la hauteur de ligne (27, 20, 15 m essayées). La loi : sans le ballon, la cible d'un marqueur ou d'un couvreur
 *  à moins de R m du ballon se rapproche du ballon d'une part c de la distance au-delà de plancher m — le marquage côté ballon, la ligne de
 *  passe coupée ; c suit la COMPACITÉ (0,5 → c ; serré plus, relâché moins). Appelé avant le lissage. Absente : hier au bit. */
export function compresserCible(st, p, K, tq) {
  if (!p.target || (p.job !== 'mark' && p.job !== 'cover') || st.restart || !(st.possession?.team >= 0) || st.possession.team === p.team) return;
  const b = st.ball.p, dx = p.target[0] - b[0], dz = p.target[2] - b[2], d = hyp(dx, dz), R = K.R ?? 20, pl = K.plancher ?? 6;
  if (d >= R || d <= pl) return;
  const c = (K.c ?? 0.35) * (0.5 + Math.max(0, Math.min(1, tq?.compacite ?? 0.5))) * (1 - d / R) * 2;   // plus fort près du ballon, nul à R
  const k = (pl + (d - pl) * (1 - Math.min(0.8, c))) / d;
  p.target = [b[0] + dx * k, p.target[1] ?? 0, b[2] + dz * k];
}
