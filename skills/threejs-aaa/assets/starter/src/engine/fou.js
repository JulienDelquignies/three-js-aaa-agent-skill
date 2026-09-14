// LE BALLON FOU (271, cfg.ballonFou && st.full — Bible 15 lot 3 « le ballon qui sort » ; §3.4 la sortie stochastique du
// ballon disputé : σ_θ ≈ 75° (45,3 % dans le cône ± 45°, 25,9 % vers l'arrière — D8b, D9), la vitesse de sortie moyenne 4-9
// m/s (§10) ; Référentiel 01 §2.5 : touches 33-45 / match, corners 9-11, sorties de but ~16 ; Modèle 09 §7 la sortie non
// forcée 6-9 % des pertes). Hier le ballon dévié repartait à 2-3 m/s (le pique 3,4 m/s « un 50/50 », le tacle dégagé 7 m/s
// dans un cône serré, le contrôle manqué la vitesse d'arrivée × 0,62 dans son axe, le glissé 3,2 m/s dans sa course) : il
// ne sortait jamais — 27-35 sorties / match (réel 60-70), touches 14-21 (réel 33-45), le moteur « visait au lieu de
// dévier » (D8b). LA LOI : après une déviation (le pique, le tacle qui dégage, le contrôle manqué, le glissé gagné), le
// ballon repart à une vitesse LOG-NORMALE autour de v (6,5 m/s, σ_v 0,35, bornée [2 ; 12]) dans une direction tirée sur
// la normale enroulée autour de l'axe du dévieur (son sens d'attaque ; pour le contrôle manqué, l'axe du ballon) avec
// σ_θ interpolé par la QUALITÉ du point d'appui (élite 45°, moyenne 75°, médiocre 100° — la note du dévieur), sur le
// flux 'duel'. Le quart arrière et les sorties en découlent, pas d'un quota. Clé absente : les déviations d'hier au bit.
// Ce que le lot nomme : le second ballon comme structure (Bible 15 §3.4 : la chute à 12-16 m, le TRAIL), le contre
// (258b, sa propre loi), la tête (112), les tirs qui ne sortent pas (37 / match, 3 sorties de but : Modèle 10), les
// passes longues qui ne se manquent pas (D14, le sous-dosage du 265).
import { hyp } from './hyp.js';
import { tirage } from './rng.js';

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
/** Deux uniformes → une gaussienne (Box-Muller). */
const gaussDe = (rnd) => Math.sqrt(-2 * Math.log(Math.max(1e-12, rnd()))) * Math.cos(2 * Math.PI * rnd());

/** σ_θ (rad) de la sortie selon la qualité du point d'appui ∈ [0 ; 1] : 0,5 → 75°. Pure. */
export function sigmaFou(qualite, K) {
  const q = Math.max(0, Math.min(1, qualite));
  const deg = q >= 0.5 ? (K.sigMoyen ?? 75) + ((K.sigElite ?? 45) - (K.sigMoyen ?? 75)) * (q - 0.5) * 2 : (K.sigMoyen ?? 75) + ((K.sigMediocre ?? 100) - (K.sigMoyen ?? 75)) * (0.5 - q) * 2;
  return deg * Math.PI / 180;
}

/** La qualité du point d'appui d'un corps : la moyenne de ses facteurs de contrôle et de garde du tacle, 0,5 à l'identité. Pure. */
export function qualiteDe(q) {
  const s = q?.skill; if (!s) return 0.5;
  return Math.max(0, Math.min(1, 0.5 + (((s.controlF ?? 1) - 1) + ((s.tacleGardeF ?? 1) - 1)) / 0.6));
}

/** La vitesse de sortie [vx, vz] : log-normale autour de v, direction base + N(0, σ_θ) enroulée. rnd : () => u. Pure. */
export function sortieFolle(base, qualite, K, rnd) {
  const v = Math.max(K.vMin ?? 2, Math.min(K.vMax ?? 12, (K.v ?? 6.5) * Math.exp((K.sigV ?? 0.35) * gaussDe(rnd))));
  const a = wrap(base + sigmaFou(qualite, K) * gaussDe(rnd));
  return [Math.cos(a) * v, Math.sin(a) * v];
}

/** Applique la sortie folle au ballon : le dévieur q, l'axe de base (son sens d'attaque par défaut). Rend la vitesse posée. */
export function appliquerFou(st, q, cfg, base = null) {
  const K = cfg.ballonFou;
  const b = base ?? Math.atan2(0, Math.sign(st.pitch.attackGoal(q.team).x || 1));
  const v = sortieFolle(b, qualiteDe(q), K, tirage(st, 'duel', q.id, st.rnd ?? (() => 0.5)));
  st.ball.impulse([v[0] - st.ball.v[0], 0, v[1] - st.ball.v[2]]);
  return v;
}
