// L'AFFECTATION HOMME PAR HOMME (225, cfg.marquageSurface — déporté de match-sim, volumétrie). Audit aval,
// constat 3 : « un attaquant sur dix seul dans la surface ». Sondé : 59 % des attaquants dans la surface à
// > 3 m du premier défenseur avec 8 marqueurs actifs — le tri PERSONNEL de chaque marqueur (le (i−2)-ième
// attaquant le plus proche DE LUI) mettait deux marqueurs sur le même homme et laissait un orphelin.
// Une affectation, une fois par image : le DANGER d'abord (l'attaquant le plus près de mon but), pour
// chacun le marqueur libre le plus proche × (2 − markF) — le bon marqueur « est plus près » ; chaque
// homme une fois, chaque marqueur une fois. Absente : le tri d'hier au bit. Mesuré : libres 59 → 34 %,
// distance au premier défenseur p50 3,5 → 2,2 m (réel 1-2).
import { hyp } from './hyp.js';

export function affecterMarquage(st, byDist, marks, defGoal, d2) {
  if (st._bAssignT === st.t) return;
  st._bAssignT = st.t; const A = st._bAssign ??= new Map(); A.clear();
  const markers = byDist.slice(2, 2 + Math.max(0, marks.length)).filter((q) => !q.keeper);
  const danger = [...marks].sort((x, y) => hyp(x.p[0] - defGoal.x, x.p[2]) - hyp(y.p[0] - defGoal.x, y.p[2]));
  const pris = new Set();
  for (const a of danger) {
    let best = null, bc = Infinity;
    for (const q of markers) { if (pris.has(q.id)) continue; const c = d2(a.p, q.p) * (2 - (q.skill?.markF ?? 1)); if (c < bc) { bc = c; best = q; } }
    if (best) { pris.add(best.id); A.set(best.id, a); }
  }
}
