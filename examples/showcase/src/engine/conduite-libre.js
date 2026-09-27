// conduite-libre.js — LA CONDUITE EST UNE SUITE DE TOUCHES, PAS UN AIMANT (cfg.conduiteLibre && st.full — retour utilisateur 27/09 :
// « est-ce que le ballon est poussé correctement ? il faut qu'on soit réaliste, c'est la base du foot »). Mesuré (2 × 900 s) : 52 % du
// temps de conduite le ballon était PORTÉ (un servo le ramène au point du pied à chaque image) ; il tournait avec le corps sans être
// touché sur 19 % des images. La moitié de ce porté venait du RAMASSAGE (lot 107, fait pour le ballon mort) appliqué au ballon de
// conduite du porteur lui-même : 145 reprises / 15 min, autant que de contrôles, chacune suivie de 0,3 s de ballon soudé.
// Ici : le porteur EN COURSE (≥ vMin m/s) ne ramasse pas le ballon qu'il vient de pousser — il le rejoint et le rejoue d'une touche
// (dribble.dribbleStep). À l'arrêt, la semelle garde le droit de le poser. Clé absente : l'hier au bit.
import { hyp } from './hyp.js';

/** Vrai quand le ramassage doit se taire : ballon de conduite du porteur, porteur lancé. Pure. */
export function conduiteLibre(st, c, cfg) {
  const K = st.full && cfg.conduiteLibre; if (!K) return false;
  const R = st.ball.ledger?.releases, r = R && R[R.length - 1];
  return !!r && r.by === c.id && r.cause === 'conduite' && hyp(c.v[0], c.v[1]) >= (K.vMin ?? 1.2);
}

/** (assiseFixe) LE BALLON AMORTI MEURT AU SOL, LE CORPS RESTE DESSUS : pendant l'assise du contrôle, le point du porté est FIGÉ au premier
 *  instant (au sol, il ne balaie pas autour du corps qui pivote) et le corps est bridé à vAssise m/s (il ne le dépasse pas). Mesuré : sous
 *  2 m/s, 72 % du porté était l'assise, 27-31 % de ces images le ballon changeait de direction sans touche ; figé sans brider le corps,
 *  il le dépassait (13,5 % des images lancées ballon derrière). Écrit st._settling.pt et la vitesse du corps. */
export function assisePoint(st, c, fp, K) {
  const S = st._settling; S.pt ??= fp;
  const v = Math.hypot(c.v[0], c.v[1]), vM = K.vAssise ?? 1.2;
  if (v > vM) { c.v[0] *= vM / v; c.v[1] *= vM / v; c.speed = vM; }
  return S.pt;
}
