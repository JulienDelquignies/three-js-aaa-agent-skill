// loi12.js — LA PASSE EN RETRAIT SE JOUE AU PIED (lot 386, cfg.retraitPied — Loi 12.2 ; 01/10 : « vérifie aussi ce que fait le gardien sur
// les passes en retrait, pour moi il prend le ballon à la main »). Mesuré (2 × 45 min) : 35 retraits reçus par le gardien — CHACUN nommé
// 'control prise-gardien' (surface : les mains — la scène joue la prise à deux mains) suivi d'un 'arrêt' (mode 'pieds') compté comme une
// parade ; et le discriminant de la tenue aux mains (gk._mains, 171) n'était calculé qu'à la première prise, périmé : vrai dans 14 retraits
// sur 35. La loi : le ballon que le gardien reçoit d'une passe DÉLIBÉRÉE du pied d'un coéquipier (le dernier 'pass' dans la fenêtre, pas
// une déviation, sans touche adverse depuis) se contrôle AU PIED — ni prise aux mains, ni 'arrêt', ni tenue aux gants. La déviation, le
// contre, la tête (passe non « du pied » au sens de la loi — ici : la déviation seule) laissent les mains. Absente : hier, au bit.

/** Le ballon qui arrive au gardien est-il un retrait du pied d'un coéquipier ? Pure (lit st.events). */
export function retraitAuPied(st, gk, K = {}) {
  const fen = K.fenetre ?? 6;
  for (let i = st.events.length - 1; i >= 0; i--) {
    const e = st.events[i]; if (st.t - e.t > fen) return false;
    if (e.by == null) continue; const p = st.players[e.by]; if (!p || p === gk) continue;
    if (p.team !== gk.team && /pass|control|touche|tacle|duel|shot|tete|tête|interception|deviation|contre/.test(e.type)) return false;   // un adversaire a touché depuis
    if (e.type === 'pass') return p.team === gk.team && e.tech !== 'deviation' && e.tech !== 'tete' && e.kind !== 'tete';
  }
  return false;
}

// (387, cfg.murNombre / cfg.loi13 — 01/10 : « regarde aussi les coups de pied arrêtés… placement des joueurs ») LE COUP FRANC SELON LA LOI 13.
// Mesuré (8 matchs, coups francs à moins de 36 m) : le mur comptait TOUJOURS deux hommes ; à 19-24 m du but l'adversaire le plus proche était à
// 1,8-6 m du ballon (Loi 13 : 9,15 m) — les défenseurs qui marquent ou tiennent un poste près de la surface gardaient leur cible.
/** La taille du mur : n(d) interpolé sur la table centrale [[d m, n], …], moins `angle` hommes à 45° d'angle et au-delà ; plancher `min`. Pure. */
export function murTaille(d, ang, K) {
  const T = K.central ?? [[18, 5], [24, 4], [30, 3]]; let n = T[T.length - 1][1];
  if (d <= T[0][0]) n = T[0][1]; else for (let i = 1; i < T.length; i++) if (d <= T[i][0]) { n = T[i - 1][1] + (T[i][1] - T[i - 1][1]) * (d - T[i - 1][0]) / (T[i][0] - T[i - 1][0]); break; }
  n -= (K.angle ?? 1.5) * Math.min(1, ang / (Math.PI / 4));
  return Math.max(K.min ?? 2, Math.round(n));
}
/** Loi 13 : pendant le coup franc, la cible de tout adversaire du tireur (gardien excepté) est hors du cercle de `rayon` m autour du ballon. */
export function loi13Cibles(st, r, K) {
  const R = K.rayon ?? 9.15, rp = r.p;
  for (const p of st.players) { if (p.team === r.team || p.keeper || p.expulse || !p.target) continue;
    const dx = p.target[0] - rp[0], dz = p.target[2] - rp[1], d = Math.hypot(dx, dz); if (d >= R) continue;
    const ux = d > 0.1 ? dx / d : p.p[0] - rp[0], uz = d > 0.1 ? dz / d : p.p[2] - rp[1], ul = Math.hypot(ux, uz) || 1;
    p.target = [rp[0] + (ux / ul) * (R + 0.2), p.target[1] ?? 0, rp[1] + (uz / ul) * (R + 0.2)]; }
}
