// touche-orientee.js — LA TOUCHE ORIENTÉE EN COURSE (note 399, cfg.toucheOrientee && st.full — retour utilisateur du 17/09 :
// « le ballon est un corps étranger », « des réceptions mauvaises avec des demi-tours »). Mesuré avant : 55 % des images de port
// SOUDÉES au servo, dont 19 % par la fenêtre de contrôle de la réception (le ballon capturé puis porté au point du pied 0,3-0,5 s,
// le corps qui tourne APRÈS) ; ~40 % de demi-tours de plus de 100° dans la seconde après la prise. Le vrai receveur libre ne
// capture pas : sa première touche EMMÈNE le ballon du côté ouvert — le sens du jeu, son élan, jamais dans un corps — et il court
// dessus en tournant ; la conduite (dribble.js) reprend à la touche suivante. Le pressé garde le porté d'hier (la touche propre
// protégée du 265) : la touche libre est contestable, c'est son prix. Le statique face au jeu garde aussi le sien (la pausa, la
// semelle vivent là). Clé absente : la capture d'hier au bit.
import { hyp } from './hyp.js';
import { BALL } from './ball.js';
import { pushSpeed } from './dribble.js';

/** La première touche du receveur `p` : true si le ballon est PARTI du côté ouvert (le porté ne le capture pas). */
export function toucheOrientee(st, p, cfg, RC) {
  const K = st.full ? cfg.toucheOrientee : null; if (!K || p.keeper || st.restart || !st.pitch) return false;
  if (RC && RC.issue !== 'propre' && RC.issue !== 'lourde') return false;   // le 50/50 et le manqué ont leur loi (265)
  const foes = st.players.filter((q) => q.team !== p.team && q.down <= 0);
  let foeD = 99; for (const q of foes) foeD = Math.min(foeD, hyp(q.p[0] - p.p[0], q.p[2] - p.p[2]));
  if (foeD < (K.libre ?? 3)) return false;                                    // pressé : le porté d'hier
  const sg = Math.sign(st.pitch.attackGoal(p.team).x || 1);
  const sp = p.speed, vx = sp > 0.5 ? p.v[0] / sp : Math.cos(p.yaw), vz = sp > 0.5 ? p.v[1] / sp : Math.sin(p.yaw);
  const dosJeu = Math.cos(p.yaw) * sg < -(K.dos ?? 0.3);                     // dos au jeu : la touche le retourne
  if (!(sp >= (K.v ?? 1.5) || dosJeu)) return false;
  let lead = Math.max(K.leadMin ?? 0.6, Math.min(K.leadMax ?? 1.6, (K.lead ?? 1.0) * (0.6 + sp / 5)));
  // LE CÔTÉ OUVERT : douze directions ; le sens du jeu (× sens, un peu vers l'axe), l'élan (× elan), du champ devant (aucun corps à moins de
  // champ m dans le couloir de devant m), jamais vers la craie (le ballon roule lead m et un peu plus)
  const gz = -Math.sign(p.p[2]) * Math.min(0.4, Math.abs(p.p[2]) / (st.pitch.hz || 34));
  let best = null;
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2, dx = Math.cos(a), dz = Math.sin(a);
    const tx = p.p[0] + dx * (lead + 1.5), tz = p.p[2] + dz * (lead + 1.5);
    if (Math.abs(tx) > st.area[0] / 2 - 1.2 || Math.abs(tz) > st.area[1] / 2 - 1.2) continue;
    let champ = 99;
    for (const q of foes) { const qx = q.p[0] - p.p[0], qz = q.p[2] - p.p[2], along = qx * dx + qz * dz; if (along > 0 && along < (K.devant ?? 4) && Math.abs(qx * dz - qz * dx) < 1.5) champ = Math.min(champ, along); }
    if (champ < (K.champ ?? 3)) continue;
    const s = (dx * sg + dz * gz) * (K.sens ?? 1) + (dx * vx + dz * vz) * (K.elan ?? 0.6) + Math.min(champ, 8) * 0.05;
    if (!best || s > best.s) best = { s, dx, dz };
  }
  if (!best) return false;
  // …ET LA TOUCHE EN TRAVERS RESTE COURTE (310, K.tournant — filmé à l'atelier : la touche partait à 46° p50 du regard, 116° p90, à
  // 3 m/s pour 1 m d'avance ; le corps tournait 0,3 s avant de pousser, le ballon à 1,2-2 m, la 2e touche à 1 s). Le vrai joueur qui
  // pivote sur sa touche la garde sous lui : l'avance × (1 − tournant × (1 − cos θ) / 2), θ l'angle touche / course (regard à l'arrêt).
  if (K.tournant) { const c = best.dx * vx + best.dz * vz; lead *= 1 - K.tournant * (1 - Math.max(-1, Math.min(1, c))) / 2; lead = Math.max(K.leadCourt ?? 0.35, lead); }
  // LA TOUCHE EST UNE VITESSE (dribble.js) : le ballon gagne lead m sur le corps projeté sur la touche, la grasse le rend ensuite
  const v = Math.max(K.tournant ? (K.vMin ?? 1.5) : 1.5, pushSpeed(Math.max(0, sp * (best.dx * vx + best.dz * vz)), lead));
  st.ball.impulse([best.dx * v - st.ball.v[0], -st.ball.v[1], best.dz * v - st.ball.v[2]],
    [(best.dz * v) / BALL.radius - st.ball.w[0], -st.ball.w[1], -(best.dx * v) / BALL.radius - st.ball.w[2]]);
  p.yawWant = Math.atan2(best.dz, best.dx);                                   // il tourne SUR sa touche — movePlayers slew, jamais un claquement
  st._pousse = { dir: +Math.atan2(best.dz, best.dx).toFixed(2), lead: +lead.toFixed(2), v: +v.toFixed(1) };
  return true;
}
