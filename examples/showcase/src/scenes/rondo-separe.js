// rondo-separe.js — LES CORPS NE SE TRAVERSENT PAS (26/09, plan d'étude : dans un duel, deux corps rendus passent l'un dans l'autre sur 3
// images ; la sim, elle, ne descend sous 0,45 m qu'une fois toutes les 2 min — c'est le RENDU qui les rapproche : le décalage de contact
// (_offA, rondo-touche) tire chaque corps jusqu'à 0,6 m vers le ballon, et deux joueurs qui vont au même ballon se superposent). Ici, au
// rendu seul : une fois par image, chaque paire de corps DEBOUT plus proche que D (0,5 m — l'épaule contre l'épaule reste permise) reçoit
// un écart qui la ramène à D, partagé moitié-moitié, borné à 0,2 m par corps ; l'écart AFFICHÉ glisse vers sa cible à 1,5 m/s au plus
// (jamais une téléportation). Les positions lues sont celles de l'image d'avant SANS l'écart (pas de boucle). La sim ne bouge pas.
// ?corps-libres : hier.

// (350, les collisions) Un corps n'est pas un disque : bras et foulée le portent plus loin DEVANT et DERRIÈRE que sur les côtés (filmé : le
// défenseur dans le dos du porteur à 0,5 m, le buste DANS le dos). Chaque corps est une ellipse (AX 0,33 m dans son axe, 0,25 m de
// côté) : épaule contre épaule 0,5 m comme hier, poitrine contre dos ~0,66 m. Le porteur ne cède que 30 % de l'écart (son ballon est au
// pied, ne pas l'en décrocher). ?separe-rond : l'hier (le disque de 0,5 m, moitié-moitié).
const D = 0.5, MAX = 0.2, VIT = 1.5, AX = 0.33, LAT = 0.25, PORTEUR = 0.3;
const rayon = (pl, ux, uz) => { const y = pl.sim.yaw ?? 0, c = Math.abs(ux * Math.cos(y) + uz * Math.sin(y)), sn = Math.sqrt(Math.max(0, 1 - c * c)); return 1 / Math.hypot(c / AX, sn / LAT); };

/** Avant la boucle des joueurs : les cibles d'écart (m, x/z) de chaque joueur. */
export function separerPrepare(scene) {
  if (scene._corpsLibres) return;
  const P = scene.players ?? [], n = P.length, W = P.map(() => [0, 0]); const rond = !!scene._separeRond;
  const pos = P.map((pl) => { const S = pl._sep ?? [0, 0]; return [pl.model.position.x - S[0], pl.model.position.z - S[1]]; });
  for (let i = 0; i < n; i++) {
    if ((P[i].sim.down ?? 0) > 0) continue;
    for (let j = i + 1; j < n; j++) {
      if ((P[j].sim.down ?? 0) > 0) continue;
      const dx = pos[j][0] - pos[i][0], dz = pos[j][1] - pos[i][1], d = Math.hypot(dx, dz);
      if (d >= (rond ? D : AX * 2) || d < 1e-4) continue;
      const Dq = rond ? D : rayon(P[i], dx / d, dz / d) + rayon(P[j], dx / d, dz / d); if (d >= Dq) continue;
      const car = rond ? -1 : scene.state?.possession?.carrier, wi = rond ? 0.5 : P[i].sim.id === car ? PORTEUR : P[j].sim.id === car ? 1 - PORTEUR : 0.5;
      const k = (Dq - d) / d;
      W[i][0] -= dx * k * wi; W[i][1] -= dz * k * wi; W[j][0] += dx * k * (1 - wi); W[j][1] += dz * k * (1 - wi);
    }
  }
  for (let i = 0; i < n; i++) { const w = W[i], l = Math.hypot(w[0], w[1]); if (l > MAX) { w[0] *= MAX / l; w[1] *= MAX / l; } P[i]._sepW = w; }
}

/** Après la position du corps (sim + contact), avant le verrou des pieds : l'écart glisse vers sa cible et s'ajoute. */
export function separerApplique(scene, pl, dt) {
  if (scene._corpsLibres) return;
  const W = pl._sepW ?? [0, 0], S = (pl._sep ??= [0, 0]), dx = W[0] - S[0], dz = W[1] - S[1], l = Math.hypot(dx, dz), mv = VIT * Math.max(0, dt);
  const k = l > mv ? mv / l : 1; S[0] += dx * k; S[1] += dz * k;
  pl.model.position.x += S[0]; pl.model.position.z += S[1];
}
