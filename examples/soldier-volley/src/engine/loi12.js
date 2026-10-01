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
