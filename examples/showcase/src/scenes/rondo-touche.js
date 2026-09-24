// rondo-touche.js — LE CONTACT DU PIED AU BALLON, extrait de Rondo.js (au plafond) aux lots 304-305 (« le ballon est trop un corps
// étranger au joueur » ; « une touche sans pied proche, on doit être à 0 %, au contrôle comme en conduite »). Trois consommateurs de
// l'état sim, lu jamais écrit : la touche PRÉVUE (l'instant du contact), le CORPS qui va au contact (motion warping), le PIED au ballon
// (le warp de touche, IK deux os). L'ordre de la pile de Rondo.js : contactRoot après la vérité sim et avant le verrou des pieds,
// touchWarpApply en fin de pile.
import { planWarp, twoBoneIK } from '../engine/strike-warp.js';
import { aimChildAt } from '../engine/foot-lock.js';

/** (304) LA TOUCHE PRÉVUE — « le ballon est trop un corps étranger au joueur » (retour du 25/09). Mesuré dans le rendu : le warp
 *  commençait AU contact et culminait 0,1 s APRÈS, le ballon déjà parti de 0,3-0,5 m — 39 % des touches sans pied à < 0,35 m du
 *  ballon. La sim sait quand son pied l'atteindra (dribble.js : le ballon à < prise du corps, la foulée ≥ minStride) : à ≤ 0,1 s de
 *  ce contact prédit, le warp part, le pied est AU ballon à l'instant de la touche. Lecture pure de l'état sim. */
export function predictTouch(scene, pl) {
  if (typeof window !== 'undefined' && window.__sabotage === 'touche-prevue') { pl._touchPre = null; return; }
  const st = scene.state, c = pl.sim, d = st._drb;
  if (!d?.cfg || st.phase !== 'carry' || st.possession.carrier !== c.id || st.ball.owner != null || c.act) { if (pl._touchPre != null && scene._t > pl._touchPre + 0.1) pl._touchPre = null; return; }
  if (pl._touchPre != null && scene._t <= pl._touchPre + 0.1) return;
  const b = st.ball.p, dx = b[0] - c.p[0], dz = b[2] - c.p[2], dist = Math.hypot(dx, dz);
  if (dist < 1e-3 || b[1] > 1.0) return;
  const ux = dx / dist, uz = dz / dist, vc = c.v[0] * ux + c.v[1] * uz - (st.ball.v[0] * ux + st.ball.v[2] * uz), prise = d.cfg.prise ?? d.cfg.reach ?? 0.62;
  const tDist = dist <= prise ? 0 : vc > 0.2 ? (dist - prise) / vc : Infinity, sp = c.speed ?? 0;
  const tFoulee = d.sinceTouch >= (d.cfg.minStride ?? 0.55) ? 0 : sp > 0.3 ? ((d.cfg.minStride ?? 0.55) - d.sinceTouch) / sp : Infinity;   // la touche part au PLUS TARD des deux : le ballon à portée ET la foulée faite
  const bvAway = st.ball.v[0] * ux + st.ball.v[2] * uz, allonge = bvAway > sp + 0.3 && dist < (d.cfg.reach ?? 1.15);   // la touche d'ALLONGE (dribble.js : le ballon fuit plus vite que le corps, jambe tendue)
  let tHit = allonge ? tFoulee : Math.max(tDist, tFoulee);
  // …ET LA REPRISE PAR INTENTION (rondo-sim : l'intention formée reprend le ballon au pied — captureRadius s'il ne fuit pas le corps,
  // prisePied s'il le fuit) : c'est aussi un contact, sans foulée
  if (c.intent || (c.anchorHint && st.t - c.anchorHint.t < 0.4)) { const fuite = (st.ball.v[0] - c.v[0]) * ux + (st.ball.v[2] - c.v[1]) * uz, R2 = fuite < 0.5 ? (scene._mcfg?.captureRadius ?? 0.9) : (scene._mcfg?.prisePied ?? 0.5);
    const tCap = dist <= R2 ? 0 : vc > 0.2 ? (dist - R2) / vc : Infinity; if (tCap < tHit) tHit = tCap; }
  if (!(tHit <= 0.2)) return;   // 0,2 s d'horizon : la sim touche jusqu'à ~0,15 s avant l'estimation (mesuré), l'événement recale
  pl._touchPre = scene._t + tHit;
}

/** (304 bis) LE CORPS VA AU CONTACT — le motion warping (Unreal : Motion Warping) : « une touche sans pied proche, on doit être
 *  à 0 % ». Mesuré : la sim déclare le contrôle à 0,89 m du centre du corps (p50) et la touche à 0,62 m (44 % > 0,7) ; une jambe
 *  (~0,9 m) met l'orteil au ballon jusqu'à ~0,5 m du centre — hors de portée pour 94 % des contrôles, 41 % des touches. Les lois
 *  de la sim restent (duels, prises, calibrations) : le CORPS RENDU glisse vers le point de contact prédit (la touche prévue, ou
 *  la passe qui arrive — l'instant où le ballon entre dans receiveRadius), au plus `max` m, fondu smoothstep sur 0,2 s avant et
 *  0,25 s après ; le verrou des pieds re-plante l'appui, le warp de touche met le pied. Sabotage : 'corps-contact'. */
export function contactRoot(scene, pl) {
  if (typeof window !== 'undefined' && window.__sabotage === 'corps-contact') { pl._contact = null; pl._rec = null; return; }
  const st = scene.state, s = pl.sim, t = scene._t, b = st.ball.p, K = { confort: 0.35, hancheRec: 0.2, hancheTouche: 0.3, max: 0.6, avant: 0.6, apres: 0.35, vMax: 1.2 };   // la réception s'approche plus (le ballon vient, la touche de conduite part devant le pied)
  const ss = (w) => { w = Math.max(0, Math.min(1, w)); return w * w * (3 - 2 * w); };
  // LE PIED LIBRE VA AU CONTACT (la foulée mesurée : un pied d'APPUI ne fait jamais la touche — touchWarpApply). Un pied planté, l'autre
  // libre : la portée se lit depuis la HANCHE de la jambe libre (sa position rendue, portée à l'instant du contact avec le corps sim),
  // pas depuis le centre du corps — sinon le corps s'arrêtait à portée du pied planté et le pied libre n'arrivait pas (mesuré après
  // l'intégration : touches sans pied 2 → 10 %, contrôles 1,9 → 5,6 %). Deux pieds libres (le vol) ou deux plantés : le centre.
  const planted = (f) => /^(stance|peel)$/.test(pl.ctrl?._gaitFeet?.[f === 'left' ? 'Left' : 'Right']?.phase ?? '');
  const libre = planted('left') !== planted('right') ? (planted('left') ? 'right' : 'left') : null;
  const vise = (bx, bz, px, pz, aer, hanche) => {
    const dc = Math.hypot(bx - px, bz - pz) || 1e-6, base = { need: Math.min(aer ? 0.75 : K.max, Math.max(0, dc - (aer ? 0.12 : K.confort))), ux: (bx - px) / dc, uz: (bz - pz) / dc };
    const up = libre && !aer ? pl.legs?.[libre]?.up : null; if (!up) return base;
    up.getWorldPosition(scene._wh);
    const hx = scene._wh.x - pl.model.position.x + px, hz = scene._wh.z - pl.model.position.z + pz, dh = Math.hypot(bx - hx, bz - hz) || 1e-6, needH = Math.min(K.max, Math.max(0, dh - hanche));
    return needH > base.need ? { need: needH, ux: (bx - hx) / dh, uz: (bz - hz) / dh } : base;
  };
  let C = pl._contact;
  if (C && t > C.tc + K.apres) C = pl._contact = null;
  // LA RÉCEPTION, SUIVIE EN CONTINU : la passe adressée, ou le ballon libre dont il est le plus proche de son équipe — le point de
  // contact (le ballon quand il entrera dans receiveRadius) se recalcule à chaque image ; le poids monte sur les avant s qui précèdent
  pl._rec = null;
  if (!s.act && !s.keeper && b[1] < 2.2 && (!C || t < C.tc) && st.ball.owner == null && !(st.phase === 'carry' && st.possession.carrier === s.id)) {   // le ballon libre, au sol ou en l'air (l'amorti : le corps sous le ballon) ; le porteur en conduite a SA loi (la touche prévue)
    // la trajectoire des avant s qui viennent (ballon et corps à vitesse constante, pas de 1/20 s) : le premier instant où le ballon
    // entre dans sa prise — receiveRadius ; pour le receveur ATTITRÉ, la jambe tendue (allonge.max, le ballon qui le dépasse) —
    // et il est le plus proche du ballon à cet instant (l'intercepteur compris) : c'est lui qui ira au contact
    const rr = scene._mcfg?.receiveRadius ?? 0.85, rMax = st.pass?.to === s.id && scene._mcfg?.allonge ? (scene._mcfg.allonge.max ?? 1.15) : rr;
    for (let tt = 0; tt <= K.avant + 1e-6; tt += 0.05) {
      const bx = b[0] + st.ball.v[0] * tt, bz = b[2] + st.ball.v[2] * tt, px = s.p[0] + s.v[0] * tt, pz = s.p[2] + s.v[1] * tt, dc = Math.hypot(bx - px, bz - pz);
      if (dc > rMax) continue;
      if (!st.players.every((q) => q === s || q.keeper || q.down > 0 || Math.hypot(q.p[0] + q.v[0] * tt - bx, q.p[2] + q.v[1] * tt - bz) >= dc)) break;
      const aer = b[1] + st.ball.v[1] * tt - 4.9 * tt * tt > 0.6, V = vise(bx, bz, px, pz, aer, K.hancheRec);   // l'amorti aérien : le corps SOUS le ballon ; au sol : le pied libre
      pl._touchPre = t + tt;   // le pied part avec (le warp de touche lit la touche prévue ; l'événement la consomme)
      if (V.need > 0.01) pl._rec = { ux: V.ux, uz: V.uz, need: V.need, w: ss(1 - tt / K.avant) };
      break;
    }
  }
  // LA TOUCHE DE CONDUITE, À L'INSTANT PRÉVU (dribble.js — _predictTouch)
  if (!C && !pl._rec && !s.act && !s.keeper) {
    predictTouch(scene, pl);
    const tc = pl._touchPre != null && pl._touchPre >= t - 0.05 && st.phase === 'carry' ? Math.max(t, pl._touchPre) : null;   // une touche prévue « maintenant » à l'image d'avant compte encore
    if (tc != null) {
      const dt = tc - t, V = vise(b[0] + st.ball.v[0] * dt, b[2] + st.ball.v[2] * dt, s.p[0] + s.v[0] * dt, s.p[2] + s.v[1] * dt, false, K.hancheTouche);
      C = pl._contact = V.need > 0.01 ? { tc, ux: V.ux, uz: V.uz, need: V.need } : null;
    }
  }
  let ox = 0, oz = 0;
  if (pl._rec) { ox = pl._rec.ux * pl._rec.need * pl._rec.w; oz = pl._rec.uz * pl._rec.need * pl._rec.w; }
  else if (C) { const e = ss(t < C.tc ? 1 - (C.tc - t) / K.avant : 1 - (t - C.tc) / K.apres) * (C.w0 ?? 1); ox = C.ux * C.need * e; oz = C.uz * C.need * e; }
  // (308) LE CORPS NE SE TÉLÉPORTE PAS : le décalage appliqué suit sa cible à vMax m/s au plus (mesuré avant : 15-18 cm par image,
  // 0 → 60 cm en 4 images — « sur les contrôles il y a téléportation », retour du 25/09) ; il revient à la vérité sim au même pas
  const A = pl._offA ?? (pl._offA = [0, 0]), dtA = Math.max(0, Math.min(0.1, t - (pl._offT ?? t))); pl._offT = t;
  const ex = ox - A[0], ez = oz - A[1], el = Math.hypot(ex, ez), pas = K.vMax * dtA;
  if (el > pas) { A[0] += ex / el * pas; A[1] += ez / el * pas; } else { A[0] = ox; A[1] = oz; }
  pl.model.position.x += A[0]; pl.model.position.z += A[1];
}

/** LE WARP DE TOUCHE — quatrième consommateur du warp de contact (pied de frappe, gant,
 *  racine, et maintenant LE PIED DE CONDUITE). La sim touche à ~1,15 m (jambe tendue) mais le
 *  clip de course ne le sait pas : le contact restait invisible — « il ne touche jamais le
 *  ballon » (retour utilisateur, captures). Autour de chaque événement 'touche' (0,2 s),
 *  le pied le plus proche est corrigé vers la surface du ballon : même primitive (planWarp,
 *  IK deux os), enveloppe sin C¹ (zéro aux deux bouts), borné, hors gestes (un act possède
 *  déjà sa jambe). */
export function touchWarpApply(scene, pl) {
  if (typeof window !== 'undefined' && window.__sabotage === 'warp-touche') return;
  predictTouch(scene, pl);
  const T = pl._touchPre != null && scene._t >= pl._touchPre - 0.15 && scene._t <= pl._touchPre + 0.15 ? pl._touchPre - 0.15 : pl._touchT;   // (308) le geste sur 0,3 s, centré au contact
  if (T == null || pl.sim.act) return;
  const u = (scene._t - T) / 0.3;
  if (u <= 0 || u >= 1) return;
  const b = scene.state.ball.p;
  if (b[1] > 1.0) return;   // (305) au-dessus de la hanche, c'est la poitrine ou la tête (le corps sous le ballon : contactRoot)
  // le pied le plus proche du ballon fait la touche — ou le pied que la sim a NOMMÉ (note 388, conduite nommée)
  // …jamais un pied d'APPUI (la foulée générée le dit : verrouillé au sol, la touche le traînait jusqu'à 36 cm)
  let side = null, dBest = 1.8; const planted = (f) => /^(stance|peel)$/.test(pl.ctrl?._gaitFeet?.[f === 'left' ? 'Left' : 'Right']?.phase ?? '');
  for (const f of ['left', 'right']) {
    const leg = pl.legs?.[f];
    if (!leg?.foot || !leg.up || !leg.knee || !pl.legLens?.[f] || planted(f)) continue;
    leg.foot.getWorldPosition(scene._wf);
    const d = Math.hypot(scene._wf.x - b[0], scene._wf.y - b[1], scene._wf.z - b[2]);
    if (d < dBest) { dBest = d; side = f; }
  }
  if (pl._touchFoot && pl._touchPre == null && pl.legs?.[pl._touchFoot]?.foot && pl.legLens?.[pl._touchFoot] && !planted(pl._touchFoot)) side = pl._touchFoot;   // (304) pendant la touche PRÉVUE, le pied nommé est celui de la touche d'avant : le plus proche
  if (!side) return;
  const leg = pl.legs[side], lens = pl.legLens[side];
  leg.foot.getWorldPosition(scene._wf);
  const plan = planWarp([scene._wf.x, scene._wf.z], [b[0], b[2]], { standoff: 0.13, warpMax: 0.6 });   // (304) 0,42 → 0,6 : la touche prise à 0,62 m du corps avec la jambe arrière ; la longueur de jambe borne l'IK (R)
  const env = Math.sin(Math.PI * u);
  scene._wt.set(scene._wf.x + plan.offset[0] * env, scene._wf.y + Math.max(0, b[1] - 0.12 - scene._wf.y) * env, scene._wf.z + plan.offset[1] * env);   // (305) le ballon qui rebondit : le pied MONTE à lui (0,12 : sous le centre)
  leg.up.getWorldPosition(scene._wh); leg.knee.getWorldPosition(scene._wk);
  const dT = scene._wh.distanceTo(scene._wt);
  const R = (lens.A + lens.B) * 0.995;
  if (dT > R) {
    scene._wt.set(scene._wh.x + (scene._wt.x - scene._wh.x) * (R / dT), scene._wh.y + (scene._wt.y - scene._wh.y) * (R / dT), scene._wh.z + (scene._wt.z - scene._wh.z) * (R / dT));
  }
  const sol = twoBoneIK(
    [scene._wh.x, scene._wh.y, scene._wh.z], [scene._wt.x, scene._wt.y, scene._wt.z], lens.A, lens.B,
    [scene._wk.x - scene._wh.x, scene._wk.y - scene._wh.y, scene._wk.z - scene._wh.z],
  );
  aimChildAt(leg.up, leg.knee, scene._wm.fromArray(sol.mid));
  aimChildAt(leg.knee, leg.foot, scene._wm.fromArray(sol.end));
}

/** (306) LA FENTE DE LA TOUCHE — AVANT le verrou des pieds (Rondo.js, à côté de strikeWarpPlan). Mesuré après la foulée mesurée : au
 *  contact, la hanche de la jambe libre est à 0,77-0,97 m du ballon pour une jambe (A+B) de 0,74-0,80 m — debout, la hanche à ~0,85 m
 *  du sol, le pied n'atteint que le sol SOUS elle. Un vrai joueur fléchit : le bassin DESCEND (≤ drop) et avance (≤ lunge) jusqu'à
 *  mettre le ballon à 0,97 × la jambe libre ; le verrou re-plante ensuite l'appui sous le bassin déplacé (le patron de la fente de
 *  frappe, rondo-warp.js). Même enveloppe que touchWarpApply. Sabotage : 'fente-touche'. */
export function touchLunge(scene, pl) {
  if (typeof window !== 'undefined' && window.__sabotage === 'fente-touche') return;
  const T = pl._touchPre != null && scene._t >= pl._touchPre - 0.15 && scene._t <= pl._touchPre + 0.15 ? pl._touchPre - 0.15 : pl._touchT;   // (308) le geste sur 0,3 s, centré au contact
  if (T == null || pl.sim.act || !pl.hipsNudge) return;
  const u = (scene._t - T) / 0.3; if (u <= 0 || u >= 1) return;
  const b = scene.state.ball.p; if (b[1] > 1.0) return;
  const planted = (f) => /^(stance|peel)$/.test(pl.ctrl?._gaitFeet?.[f === 'left' ? 'Left' : 'Right']?.phase ?? '');
  let side = null, dBest = 1.8;
  for (const f of ['left', 'right']) { const leg = pl.legs?.[f]; if (!leg?.foot || !leg.up || !pl.legLens?.[f] || planted(f)) continue; leg.foot.getWorldPosition(scene._wf); const d = Math.hypot(scene._wf.x - b[0], scene._wf.z - b[2]); if (d < dBest) { dBest = d; side = f; } }
  if (!side) return;
  const L = { lunge: 0.18, drop: 0.14 }, lens = pl.legLens[side], R = (lens.A + lens.B) * 0.97, env = Math.sin(Math.PI * u);
  pl.legs[side].up.getWorldPosition(scene._wh);
  const dx = b[0] - scene._wh.x, dz = b[2] - scene._wh.z, r = Math.hypot(dx, dz) || 1e-6, h = scene._wh.y - Math.max(0.08, b[1] - 0.05);
  if (Math.hypot(r, h) <= R) return;
  const manque = Math.hypot(r, h) - R, drop = Math.min(L.drop, 0.6 * manque), h2 = h - drop;   // le bassin descend de 60 % du manque, avance du reste
  const lunge = Math.min(L.lunge, Math.max(0, r - Math.sqrt(Math.max(0, R * R - h2 * h2))));
  pl.hipsNudge([dx / r * lunge * env, -drop * env, dz / r * lunge * env]);
}
