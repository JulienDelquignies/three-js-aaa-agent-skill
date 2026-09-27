// controle-oriente.js — LE CONTRÔLE ORIENTÉ DU RECEVEUR LIBRE (cfg.controleOriente && st.full — retour utilisateur 27/09 : « contrôle,
// conduite, passe latérale : l'enchaînement est catastrophique »). La loi d'hier (rondo-sim.receive) oriente la première touche À L'OPPOSÉ
// de l'adversaire le plus proche — juste sous pression ; LIBRE, elle gardait le regard courant (tourné vers le passeur) ou fuyait un
// adversaire à 30 m (et comptait les expulsés/remplacés au bord du terrain). Mesuré à l'atelier (match11.html?atelier=enchaine) : le
// receveur prenait le ballon face au passeur, puis tournait AUTOUR de son ballon 0,6-1,7 s (135-280°) avant de partir.
// Ici : les expulsés et les remplacés ne comptent plus ; l'adversaire le plus proche au-delà de libre m (personne n'arrive) → la touche va
// VERS L'AVANT (le but adverse, un peu vers l'axe : axe), mêlée à la course du receveur lancé (≥ 1,5 m/s, poids course) — le contrôle
// orienté du milieu libre. Pressé (≤ libre m) : la loi d'hier, loin du presseur. Clé absente : l'hier au bit.
import { hyp } from './hyp.js';

/** La direction [tx, tz] (unitaire) où le receveur oriente sa première touche. Pure. */
export function capControle(st, p, cfg) {
  const K = st.full && cfg.controleOriente;
  let foe = null, fd = Infinity;
  for (const q of st.players) {
    if (q.team === p.team || q.down > 0 || (K && (q.expulse || q._sub))) continue;
    const d = hyp(q.p[0] - p.p[0], q.p[2] - p.p[2]); if (d < fd) { fd = d; foe = q; }
  }
  if (K && st.pitch && fd > (K.libre ?? 6)) {
    const g = st.pitch.attackGoal(p.team), sg = Math.sign(g.x - p.p[0]) || 1;
    let tx = sg, tz = -(p.p[2] / (st.pitch.hz || 34)) * (K.axe ?? 0.3);
    const v = hyp(p.v[0], p.v[1]);
    if (v >= 1.5 && (p.v[0] * sg) > 0) { const w = K.course ?? 0.5; tx = tx * (1 - w) + (p.v[0] / v) * w; tz = tz * (1 - w) + (p.v[1] / v) * w; }   // lancé VERS l'avant : sa course compte
    const l = hyp(tx, tz) || 1; return [tx / l, tz / l];
  }
  if (foe) { const ax = p.p[0] - foe.p[0], az = p.p[2] - foe.p[2], al = hyp(ax, az) || 1; return [ax / al, az / al]; }
  return [Math.cos(p.yaw), Math.sin(p.yaw)];
}
