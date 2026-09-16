// rondo-contact — LE CONTACT DANS LA SCÈNE (lot A10, motion-contact + duel.chuter).
//
// Trois habillages, tous lus de la sim, jamais inventés :
//   - la CHUTE nommée (événement 'chute' : avant / côté / arrière, le côté du coup) s'habille du geste généré ; le clip
//     TIENT à la pose couchée tant que la sim garde le corps au sol (p.down), et le RELEVÉ se rejoue pour finir
//     exactement quand la sim relève (down 0 ↔ clé finale) — le patron du tacleur et du gardien (lots 91/109) ;
//   - le DUEL D'ÉPAULE ('duel' kind 'épaule') : le chargeur met l'épaule (côté de l'adversaire), le perdant trébuche ;
//     l'ACCROCHAGE sans chute (course cassée, pas d'arraché) : le porteur trébuche ;
//   - la PROTECTION : le porteur, un adversaire à ≤ 1,4 m sur le flanc ou dans le dos, tend le bras vers lui et tourne
//     le tronc — un plateau TENU tant que la pression dure, le haut du corps seul (les jambes restent à la foulée).
//
// Le miroir se juge au côté réel : le côté du coup pour la chute de côté (poussé de gauche, on tombe à droite : le clip
// neutre), le côté de l'adversaire pour l'épaule et le bouclier (à droite : le clip neutre).

export const VIE = 0.6;   // (A10 bis) le rythme des allers-retours de la pose tenue (× temps réel)
const rightOf = (s, q) => { const fx = Math.cos(s.yaw), fz = Math.sin(s.yaw); return -(q.p[0] - s.p[0]) * fz + (q.p[2] - s.p[2]) * fx; };

/** Les événements de contact : la chute nommée, le duel d'épaule, l'accrochage qui casse la course. */
export function contactEvent(scene, e) {
  if (e.type === 'chute') {
    const pl = scene.players[e.by]; if (!pl) return;
    const side = pl.sim._chute?.side ?? 1;                                      // +1 : le coup vient de la droite
    const move = e.kind === 'cote' ? 'chuteCote' : e.kind === 'arriere' ? 'chuteArriere' : 'chuteAvant';
    scene._playTech(pl, { ...e, move, foot: e.kind === 'cote' && side > 0 ? 'left' : 'right' });   // poussé de droite → tombe à gauche : miroir
    pl._teched = scene._t; pl._fallAt = scene._t; pl._shield = null; pl._sol = null;   // (A10 bis) l'horloge de la vie au sol repart
  } else if (e.type === 'duel' && e.kind === 'épaule') {
    const by = scene.players[e.by], sur = scene.players[e.sur];
    if (by && sur && !by.sim.act) { scene._playTech(by, { ...e, move: 'epaule', foot: rightOf(by.sim, sur.sim) < 0 ? 'left' : 'right' }); by._teched = scene._t; }
    const loser = e.won ? sur : by;
    if (loser && !loser.sim.act && (loser.sim.down ?? 0) <= 0 && loser._teched !== scene._t) { scene._playTech(loser, { ...e, move: 'trebuche', foot: 'right' }); loser._teched = scene._t; }
  } else if (e.type === 'faute' && e.kind === 'accrochage' && !e.arrache && !e.prometteur) {
    const pl = scene.players[e.sur];
    if (pl && !pl.sim.act && (pl.sim.down ?? 0) <= 0) { scene._playTech(pl, { ...e, move: 'trebuche', foot: 'right' }); pl._teched = scene._t; }
  }
}

/** L'horloge d'un geste de contact : la chute tient au sol et se relève à l'heure de la sim ; le bouclier tient son plateau.
 *  Renvoie l'heure d'échantillonnage, ou null si le geste n'est pas du contact. */
export function contactClock(pl, meta, t, dtP, now) {
  const spec = pl.gestureLayer.spec;
  if (!spec || (spec.family !== 'contact' && !(spec.family === 'emotion' && spec.lying != null))) { pl._fallOwns = false; return null; }   // (A11) la glissade sur les genoux tient et se relève comme une chute
  pl._fallOwns = spec.lying != null && (pl.sim.down ?? 0) > 0;                       // la chute POSSÈDE les jambes tant que le corps est au sol (la glissade ferait lire « il court »)
  if (spec.lying != null) {
    const down = (pl.sim.down ?? 0), T = spec.duration, tL = spec.lying, tR = spec.rise;
    if (down > 0 && !pl.sim.expulse && !pl.sim._sub && t >= tL) {
      // (A10 bis) LA POSE TENUE VIT : entre lying et rise le clip porte un cycle fermé (la main au corps, la tête qui se pose et se relève, la jambe du dessus qui plie) — l'horloge y fait des allers-retours au ralenti (VIE ×0,6) tant que la sim a plus de temps à terre que le clip n'en demande pour finir (T − t) ; puis elle AVANCE au rythme qui finit debout quand la sim relève ((T − t)/down, borné ×1-2,5 : jamais de saut de pose — hier le gel figeait la pose couchée et le relevé sautait à l'heure sim)
      const S = pl._sol ??= { t: tL, dir: 1 }; if (S.t < tL) S.t = tL;
      if (down > T - S.t) { S.t += S.dir * dtP * VIE; if (S.t >= tR - 1e-3) { S.t = tR - 1e-3; S.dir = -1; } else if (S.t <= tL) { S.t = tL; S.dir = 1; } }
      else S.t = Math.min(T, S.t + dtP * Math.max(1, Math.min(2.5, (T - S.t) / Math.max(down, dtP))));
      meta.t0 = now - S.t + (meta.offset ?? 0);
      return S.t;
    }
    if (down <= 0) pl._sol = null;
    return t;
  }
  if (spec.name === 'protection' && spec.hold != null && pl._shield) {
    if (t >= spec.hold) { meta.t0 += dtP; return spec.hold; }
    return t;
  }
  return t;
}

/** Le bouclier : le porteur pressé sur le flanc ou dans le dos tend le bras vers l'adversaire, tant que ça dure. */
export function contactShield(scene, pl) {
  const st = scene.state, s = pl.sim;
  const carrying = st.ball.owner === s.id && !s.act && (s.down ?? 0) <= 0 && !s.keeper;
  let want = 0;
  if (carrying) {
    const fx = Math.cos(s.yaw), fz = Math.sin(s.yaw);
    let best = null;
    for (const q of st.players) {
      if (q.team === s.team || (q.down ?? 0) > 0 || q._sub) continue;
      const dx = q.p[0] - s.p[0], dz = q.p[2] - s.p[2], d = Math.hypot(dx, dz);
      if (d > 1.4 || d < 0.2) continue;
      if ((dx * fx + dz * fz) / d > 0.55) continue;                                   // devant : pas un bouclier, un duel
      if (!best || d < best.d) best = { d, right: -dx * fz + dz * fx };
    }
    if (best) want = best.right >= 0 ? 1 : -1;
  }
  const playing = pl.gestureLayer.spec?.name === 'protection';
  if (want && !pl._shield && !pl.gestureLayer.active) {
    scene._playTech(pl, { type: 'protection', move: 'protection', foot: want < 0 ? 'left' : 'right' });
    pl._shield = { side: want, since: scene._t }; pl._teched = scene._t;
  } else if (pl._shield && (!want || !playing)) pl._shield = null;                    // la garde se relâche : le clip joue sa fin
  return playing;
}
