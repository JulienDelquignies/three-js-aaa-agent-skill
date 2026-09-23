/** LA CONDUITE CONTOURNE LE PRESSEUR (lot 295, cfg.contourne). Sondé (sonde-296, 4 × 90 min, au monde du 294) : ~50-63 pertes EN
 *  CONDUITE par équipe et par match (la comptabilité au sens du book, sonde-295 : l'excès ~30 par équipe est là — la passe et le
 *  take-on sont justes) ; dans la demi-seconde d'avant, le porteur CONDUISAIT VERS le défenseur le plus proche 42-46 % (le porteur
 *  pressé qui ne perd pas : 15-18 %), le défenseur DEVANT lui 47-51 % (24 %), à 2,5 m p50, sans geste de dribble, sans bouclier (≈ 0),
 *  et tenait le ballon depuis 0,42-0,45 s p50 (1,4-1,5) : il reçoit et fonce dans le presseur qui le cadre de face.
 *
 *  La loi : quand la direction de conduite voulue passe à moins de `cone`° d'un défenseur à moins de d × anticipF m (l'anticipateur
 *  lit plus tôt), la conduite tourne vers le côté LIBRE — la direction du défenseur tournée de `angle`° du côté opposé à lui (le
 *  sens du produit vectoriel), mêlée à la voulue selon la proximité (pleine sous dPlein, nulle à d). Le vrai porteur ne s'empale pas :
 *  il s'écarte, se retourne ou protège — le take-on reste le geste nommé (noyau 268), ce n'est pas lui qu'on touche.
 *  Attributs : anticipation (la portée de lecture). Tactique, rôles : rien. Clé absente : la conduite d'hier au bit. */
const hyp = Math.hypot;

export function contourneDe(st, c, want, K) {
  const d0 = (K.d ?? 3) * (c.skill?.anticipF ?? 1), dP = K.dPlein ?? 1.5, cosC = Math.cos((K.cone ?? 45) * Math.PI / 180);
  let D = null, dm = d0;
  for (const q of st.players) {
    if (q.team === c.team || q.keeper || q.down > 0) continue;
    const dx = q.p[0] - c.p[0], dz = q.p[2] - c.p[2], d = hyp(dx, dz);
    if (d < dm && d > 1e-6 && (dx * want[0] + dz * want[1]) / d > cosC) { dm = d; D = { dx: dx / d, dz: dz / d }; }
  }
  if (!D) return null;
  const s = Math.sign(D.dx * want[1] - D.dz * want[0]) || 1, a = s * (K.angle ?? 80) * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
  const tx = D.dx * ca - D.dz * sa, tz = D.dx * sa + D.dz * ca;
  const w = Math.max(0, Math.min(1, (d0 - dm) / Math.max(1e-6, d0 - dP)));
  const x = want[0] * (1 - w) + tx * w, z = want[1] * (1 - w) + tz * w, l = hyp(x, z) || 1;
  return [x / l, z / l];
}
