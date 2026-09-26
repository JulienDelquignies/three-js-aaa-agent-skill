// rondo-separe.js — LES CORPS NE SE TRAVERSENT PAS (26/09, plan d'étude : dans un duel, deux corps rendus passent l'un dans l'autre sur 3
// images ; la sim, elle, ne descend sous 0,45 m qu'une fois toutes les 2 min — c'est le RENDU qui les rapproche : le décalage de contact
// (_offA, rondo-touche) tire chaque corps jusqu'à 0,6 m vers le ballon, et deux joueurs qui vont au même ballon se superposent). Ici, au
// rendu seul : une fois par image, chaque paire de corps DEBOUT plus proche que D (0,5 m — l'épaule contre l'épaule reste permise) reçoit
// un écart qui la ramène à D, partagé moitié-moitié, borné à 0,2 m par corps ; l'écart AFFICHÉ glisse vers sa cible à 1,5 m/s au plus
// (jamais une téléportation). Les positions lues sont celles de l'image d'avant SANS l'écart (pas de boucle). La sim ne bouge pas.
// ?corps-libres : hier.

const D = 0.5, MAX = 0.2, VIT = 1.5;

/** Avant la boucle des joueurs : les cibles d'écart (m, x/z) de chaque joueur. */
export function separerPrepare(scene) {
  if (scene._corpsLibres) return;
  const P = scene.players ?? [], n = P.length, W = P.map(() => [0, 0]);
  const pos = P.map((pl) => { const S = pl._sep ?? [0, 0]; return [pl.model.position.x - S[0], pl.model.position.z - S[1]]; });
  for (let i = 0; i < n; i++) {
    if ((P[i].sim.down ?? 0) > 0) continue;
    for (let j = i + 1; j < n; j++) {
      if ((P[j].sim.down ?? 0) > 0) continue;
      const dx = pos[j][0] - pos[i][0], dz = pos[j][1] - pos[i][1], d = Math.hypot(dx, dz);
      if (d >= D || d < 1e-4) continue;
      const k = (D - d) / 2 / d;
      W[i][0] -= dx * k; W[i][1] -= dz * k; W[j][0] += dx * k; W[j][1] += dz * k;
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
