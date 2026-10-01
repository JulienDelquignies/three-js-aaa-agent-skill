// regard-jeu.js — LE JOUEUR SANS BALLON REGARDE LE JEU (cfg.regardJeu && st.full — demande du 27/09 : « le rapport au ballon, l'intelligence
// de jeu, se rapprocher des vidéos » ; FM / FC / le réel : les joueurs suivent le ballon des yeux, s'ouvrent, reculent face au jeu).
// Mesuré avant (sonde audit-ref, 2 × 900 s) : le cap d'un joueur sans ballon suivait SA COURSE (movement : yaw ← direction de v) —
// 21 % des joueurs de champ à ≤ 30 m du ballon lui tournaient le DOS (> 120°), p50 62° ; l'arrêté gardait son cap fossile. La course
// arrière et le pas chassé existent au rendu (motion-gait) mais rien ne les déclenchait hors gardien et jockey.
// Ici, joueur de champ sans ballon, hors acte, à ≤ portee m du ballon : le cap voulu est la course TOURNÉE vers le ballon d'au plus
//   π           à ≤ vRecul m/s (il recule face au jeu),
//   chasse °    à ≤ vChasse m/s (le pas chassé, le corps de trois quarts),
//   course °    au-delà (il sprinte ; seules les épaules s'ouvrent).
// À l'arrêt : face au ballon. Le cap passe par le slew borné de movement (aucune rotation instantanée). Clé absente : l'hier au bit.
import { hyp } from './hyp.js';

const wrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };

function eligible(st, p, K) {
  if (p.keeper || p.expulse || p._sub || p.act || st.restart || p.job === 'carry' || st.possession?.carrier === p.id) return false;
  const b = st.ball.p; return hyp(b[0] - p.p[0], b[2] - p.p[2]) <= (K.portee ?? 35);
}

/** Le cap voulu en course (rad) ou null (la course d'hier). Pure. */
export function regardJeu(st, p, cfg) {
  const K0 = st.full && cfg.regardJeu; if (!K0 || !eligible(st, p, K0)) return null;
  // (359, cfg.corpsSobre — 28/09 : « des joueurs courir dans une direction avec le corps orienté vers une autre » ; mesuré diag-D : 93 % des
  // corps de travers venaient d'ici — le corps entier tourné vers un ballon à 20-35 m, la course arrière jusqu'à 3,2 m/s = le trot de repli)
  // LA TÊTE REGARDE LE JEU LOIN, LE CORPS SEULEMENT PRÈS : la part s'éteint entre pres et loin m ; allures plus sobres ; l'équipe qui a le
  // ballon ne recule pas face au jeu (elle court vers ses zones). Absente : l'hier au bit.
  const CS = st.full && cfg.corpsSobre, K = CS ? { ...K0, vRecul: CS.vRecul ?? K0.vRecul, vChasse: CS.vChasse ?? K0.vChasse, chasse: CS.chasse ?? K0.chasse, course: CS.course ?? K0.course } : K0;
  const b = st.ball.p, vDir = Math.atan2(p.v[1], p.v[0]), bDir = Math.atan2(b[2] - p.p[2], b[0] - p.p[0]), d = wrap(bDir - vDir);
  const loinF = CS ? Math.max(0, Math.min(1, ((CS.loin ?? 25) - Math.hypot(b[0] - p.p[0], b[2] - p.p[2])) / Math.max(1e-3, (CS.loin ?? 25) - (CS.pres ?? 12)))) : 1;
  const recule = !CS || st.possession?.team !== p.team;
  const vR = p._vVeut != null ? Math.max(p.speed, p._vVeut) : p.speed;   // (377, cfg.retourPoste) le corps se décide sur l'allure VOULUE : le défenseur qui rentre se retourne et sprinte (hier : lent → face au ballon → la course de dos bridée à 2,5-3,2 m/s → lent)
  const maxA = recule && vR <= (K.vRecul ?? 3.2) ? Math.PI : vR <= (K.vChasse ?? 5) ? (K.chasse ?? 100) * Math.PI / 180 : (K.course ?? 45) * Math.PI / 180;
  // …LE CORPS S'OUVRE, IL NE FIXE PAS (mesuré : tourné plein, 100 % des corps sur le ballon — p50 0,2°, des tourelles) : une part `part`
  // du chemin vers le ballon (le regard fait le reste), et un biais personnel stable (±biais °, par joueur) — le jeu n'est pas une revue
  const biais = (((p.id * 37) % 21) - 10) / 10 * (K.biais ?? 10) * Math.PI / 180;
  return vDir + Math.max(-maxA, Math.min(maxA, d * (K.part ?? 0.75) * loinF)) + biais * loinF;
}

/** À l'arrêt : le cap vers le ballon (rad) ou null. Pure. */
export function regardJeuArret(st, p, cfg) {
  const K = st.full && cfg.regardJeu; if (!K || !eligible(st, p, K)) return null;
  const b = st.ball.p; return Math.atan2(b[2] - p.p[2], b[0] - p.p[0]) + (((p.id * 37) % 21) - 10) / 10 * (K.biais ?? 10) * Math.PI / 180;
}
