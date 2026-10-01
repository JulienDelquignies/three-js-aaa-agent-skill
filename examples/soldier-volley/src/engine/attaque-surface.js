// attaque-surface.js — ON ATTAQUE LE CENTRE (lot 372, cfg.attaqueSurface — T2 du chantier tactique ; B09 R-07/R-08, B07 T12-13, B08 #10 :
// les appels aux poteaux 1,6-2,4 s avant l'arrivée du centre, ≤ 3-4 joueurs dans la surface au centre (90 %), arrivée lancée ≥ 4 m/s
// (70 %), slot dupliqué ≤ 17 %, l'ailier opposé au second poteau ≥ 60 %). Sondé (30 min, centreArrivee posé) : 8 centres, et 1 s APRÈS la
// frappe toujours personne dans la surface — seul le receveur visé courait ; la moitié des centres finissaient en jeu aérien… défensif.
// La loi : quand un centre part, les joueurs offensifs disponibles (milieux et attaquants à moins de dMax m de la ligne de but, hors
// centreur et receveur) SPRINTENT vers des ZONES DISTINCTES — second poteau, premier poteau, point de penalty, entrée de surface (le
// centre en retrait) —, dans cet ordre, le plus proche de chaque zone ; leur nombre suit la MENTALITÉ (2 → 4). Tenu tant que la passe vit
// (≤ tenue s). Absente : hier au bit.
const hyp = Math.hypot;
const ax = (v, lo, hi) => lo + Math.max(0, Math.min(1, v ?? 0.5)) * (hi - lo);

/** Une fois par pas : pose st._as = { pass, slots: Map(id → [x, z]) } au départ du centre, l'efface à sa fin. */
// …ET ON ANTICIPE (sondé après la v1 : les coureurs désignés partaient de 16-32 m du but, le vol dure ~1,2 s — personne n'arrivait) :
// dès que le PORTEUR entre dans la zone de centre (≤ zoneX m de la surface, couloir ≥ zoneZ × la demi-largeur), les coureurs sont désignés
// et gagnent leur zone EN DEÇÀ de la ligne de hors-jeu (marge m) ; à la frappe, ils attaquent la zone entière.
import { offsideLine } from './offside.js';
export function attaqueSurfaceStep(st, K) {
  const P = st.pass;
  if (st.restart) { st._as = null; return; }
  if (!P || !P.cross) {
    const id = st.possession?.carrier, c = id >= 0 ? st.players[id] : null;
    if (!c || c.keeper) { st._as = null; return; }
    const g = st.pitch.attackGoal(c.team), sg = Math.sign(g.x || 1), boxX = st.pitch.hx - st.pitch.dims.box.depth;
    if (c.p[0] * sg < boxX - (K.zoneX ?? 13) || Math.abs(c.p[2]) < st.pitch.hz * (K.zoneZ ?? 0.3)) { st._as = null; return; }
    if (st._as?.pre && st._as.by === c.id && st.t - st._as.t < 0.5) return;
    poser(st, K, c, null); return;
  }
  if (st._as?.pass === P) { if (st.t - P.t > (K.tenue ?? 2.5)) st._as = null; return; }
  const c = st.players[P.from]; if (!c) return;
  poser(st, K, c, P);
}
function poser(st, K, c, P) {
  const g = st.pitch.attackGoal(c.team), sg = Math.sign(g.x || 1), side = Math.sign(c.p[2] || 1);
  const zones = [[g.x - sg * 6, -side * 3], [g.x - sg * 5, side * 2.5], [g.x - sg * 11, 0], [g.x - sg * 17, -side * 4]];
  const n = Math.round(ax(st.tactics?.[c.team]?.mentalite, K.nMin ?? 2, K.nMax ?? 4));
  const libres = st.players.filter((q) => q.team === c.team && !q.keeper && q.id !== c.id && (!P || q.id !== P.to) && q.down <= 0 && !q.expulse && (q.post ?? 0) >= 4
    && Math.abs(g.x - q.p[0]) < (K.dMax ?? 35));
  const slots = new Map();
  for (const z of zones.slice(0, n)) { let best = null, bd = Infinity; for (const q of libres) { if (slots.has(q.id)) continue; const d = hyp(q.p[0] - z[0], q.p[2] - z[1]); if (d < bd) { bd = d; best = q; } } if (best) slots.set(best.id, z); }
  if (!P) { const off = offsideLine(st, c.team), lim = off.adv - (K.marge ?? 0.8);   // avant la frappe : en deçà de la ligne
    for (const [id, z] of slots) if (z[0] * sg > lim) slots.set(id, [lim * sg, z[1]]); }
  st._as = { pass: P, pre: !P, by: c.id, t: st.t, slots };
}

/** Dans la boucle de mouvement : le coureur désigné vise sa zone, en pointe. */
export function attaqueSurfaceCorps(st, p) {
  const z = st._as?.slots?.get(p.id); if (!z) return;
  p.job = 'attaque'; p.target = [z[0], 0, z[1]];
  if (hyp(z[0] - p.p[0], z[1] - p.p[2]) > 1.5) p._pace = { ...(p._pace ?? { next: st.t + 3 }), until: st.t + 0.3, kind: 'surface' };
}
