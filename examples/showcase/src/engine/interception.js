// interception.js — L'INTERCEPTION NON OMNISCIENTE (266, cfg.interception && st.full — la carte du book : Modèle 07 lot 2,
// §4.3 « le défenseur ne doit JAMAIS connaître la trajectoire avant t_pass + τ_r », test 4 « non-omniscience de
// l'interception » ; Modèle 04 la croyance). Sondé au 265 : le déficit de complétion de la tranche 15-30 yd (75 % c. 82-87)
// est l'interception — 14-15 % des passes prises par un adversaire qui n'était pas à portée du receveur ; et le défenseur
// d'hier ciblait le ballon VRAI à chaque tick (anchor = st.ball.p, la mène leadP sur sa vitesse vraie) : il coupait des
// passes qu'il n'avait pas vues partir, dans son dos, à l'image même du départ. Trois lois, une clé :
//  (1) LA LATENCE DE LECTURE : pendant τ_r = tauR × (2 − anticipF) après le départ de la passe, le défenseur n'a pas lu le
//      départ — sa cible relative au ballon reste celle du ballon AU DÉPART (st.pass.origin) ; la lecture est une note.
//  (2) LE BALLON CRU : passé τ_r, sa cible suit le ballon tel qu'il le CROIT (croyanceDe — la croyance du 262 : observé à
//      10 Hz s'il le voit, extrapolé et vieilli s'il ne le voit pas — le défenseur dos au ballon court vers un souvenir).
//      L'écart cru − vrai se retranche à la cible des métiers relatifs au ballon (press, intercept, cover) ; sous mort m
//      l'écart ne bouge rien (le bruit d'observation ne fait pas trembler la course).
//  (3) LE PASSEUR LIT SES CROYANCES : la course de refus (flightRace, strike-sim) projette les défenseurs là où le passeur
//      les CROIT — « on ne passe qu'à ce que l'on voit, ou croit savoir » (Modèle 09 §2.1) : le défenseur qu'il n'a pas vu
//      ne lui interdit rien, et coupe.
// Les attributs : anticipation (τ_r), vision et scanning (la croyance) ; identité à 50. Clé absente : l'omniscience d'hier
// au bit. Ce que le lot nomme : la logistique σ 0,45 / λ 4,3 comme LECTURE du passeur (Λ, l'appétit du risque par la
// mentalité), le pré-élagage par bande, l'ombre de couverture en forme fermée.
import { hyp } from './hyp.js';
import { croyanceDe } from './croyance.js';

/** La latence de lecture du départ (s) : la note d'anticipation, identité à 50. Pure. */
export function tauLecture(q, K) { return (K.tauR ?? 0.25) * (2 - (q.skill?.anticipF ?? 1)); }

/** L'écart [dx, dz] entre le ballon tel que q le croit et le ballon vrai : figé au départ pendant la latence, puis la croyance. Pure. */
export function ecartCru(q, st, cfg, K) {
  const P = st.pass;
  if (P && st.t - P.t < tauLecture(q, K)) return [P.origin[0] - st.ball.p[0], P.origin[1] - st.ball.p[2]];
  const B = croyanceDe(q, st.ball, st, cfg);
  return [B.p[0] - st.ball.p[0], B.p[2] - st.ball.p[2]];
}

/** Le pas : les défenseurs aux métiers relatifs au ballon visent le ballon cru (appelé avant movePlayers, pendant un vol). */
export function interceptionApply(st, cfg) {
  const K = st.full ? cfg.interception : null; if (!K || !st.pass || st.phase !== 'flight') return;
  const atk = st.players[st.pass.from]?.team; if (atk == null) return;
  for (const q of st.players) {
    if (q.team === atk || q.keeper || q.down > 0 || q.expulse || q._sub || !q.target) continue;
    if (q.job !== 'press' && q.job !== 'intercept' && q.job !== 'cover') continue;
    const e = ecartCru(q, st, cfg, K), d = hyp(e[0], e[1]); q._cru = d;
    if (d < (K.mort ?? 0.15)) continue;
    q.target = [q.target[0] + e[0], 0, q.target[2] + e[1]];
  }
}
