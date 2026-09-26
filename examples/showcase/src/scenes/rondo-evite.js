// rondo-evite.js — LE PIED CONTOURNE LE BALLON (chantier foulée, 28/09 : « le ballon traverse peut-être les pieds des fois »). Mesuré (arbitre
// visuel, 150 s) : 2 422 images où le ballon est DANS une jambe (5 cm p50, 10 cm p90) — en jeu surtout le porteur, dont le pied EN VOL traverse
// le ballon qu'il conduit juste devant lui (la trajectoire générée ignore le ballon). Le vrai joueur enjambe ou longe son ballon. Ici, en fin de
// pile (après les warps), pour chaque joueur proche du ballon : chaque pied EN VOL — sauf le pied qui fait la touche prévue, à son contact —
// dont le segment tibia→cheville ou cheville→orteils entre dans le ballon (rayon 0,11 + demi-épaisseur du membre) est écarté juste assez (la
// normale du ballon au point le plus proche, relevée d'un tiers vers le haut : on passe à côté ET au-dessus), IK deux os, jambe bornée à sa
// longueur. Le ballon ne bouge jamais (il est la sim). ?pied-traverse : hier.
import * as THREE from 'three/webgpu';
import { twoBoneIK } from '../engine/strike-warp.js';
import { aimChildAt } from '../engine/foot-lock.js';

const _k = new THREE.Vector3(), _f = new THREE.Vector3(), _t = new THREE.Vector3(), _h = new THREE.Vector3(), _g = new THREE.Vector3(), _m = new THREE.Vector3(), _e = new THREE.Vector3();

/** Distance du centre B au segment PQ, et le point le plus proche (dans out). */
function segDist(P, Q, B, out) {
  const ux = Q.x - P.x, uy = Q.y - P.y, uz = Q.z - P.z, L2 = ux * ux + uy * uy + uz * uz || 1;
  const k = Math.max(0, Math.min(1, ((B.x - P.x) * ux + (B.y - P.y) * uy + (B.z - P.z) * uz) / L2));
  out.set(P.x + ux * k, P.y + uy * k, P.z + uz * k); return out.distanceTo(B);
}

export function eviteBallon(scene, pl) {
  if (scene._piedTraverse) return;
  const B = scene.ball?.position; if (!B || B.y > 1.2) return;
  if (Math.hypot(pl.sim.p[0] - B.x, pl.sim.p[2] - B.z) > 1.4) return;
  for (const f of ['left', 'right']) {
    const leg = pl.legs?.[f], L = pl.legLens?.[f]; if (!leg?.foot || !leg.knee || !leg.up || !L) continue;
    const gf = pl.ctrl?._gaitFeet?.[f === 'left' ? 'Left' : 'Right'], ancien = (pl._evPh ??= {})[f]; pl._evPh[f] = gf?.phase;
    if (gf && gf.phase !== 'swing') {
      // l'appui ne se déplace pas (il glisserait) — SAUF à l'image de la pose : le pied qui se POSE dans le ballon se pose À CÔTÉ (le point d'appui décalé de la pénétration)
      const LS = pl.ctrl?.footLock?.state?.[f === 'left' ? 0 : 1];
      if (ancien === 'swing' && LS?.driven && LS.off) { leg.foot.getWorldPosition(_f); const nx = _f.x - B.x, nz = _f.z - B.z, nh = Math.hypot(nx, nz) || 1, pen = 0.11 + 0.05 - nh;
        if (pen > 0 && _f.y < B.y + 0.15) { LS.off[0] += nx / nh * pen; LS.off[1] += nz / nh * pen; LS.lock.x += nx / nh * pen; LS.lock.z += nz / nh * pen; pl._evitePose = (pl._evitePose ?? 0) + 1; } }
      continue;
    }
    const touche = (pl._touchFootPlan === f || pl._touchFoot === f) && ((pl._touchT != null && Math.abs(scene._t - pl._touchT) < 0.18) || (pl._touchPlanT != null && Math.abs(scene._t - pl._touchPlanT) < 0.18));
    if (touche || pl.sim.act) continue;                                                           // le pied qui JOUE le ballon le touche — c'est le geste
    const toe = leg.foot.children.find((o) => /ToeBase/i.test(o.name));
    leg.knee.getWorldPosition(_k); leg.foot.getWorldPosition(_f); if (toe) toe.getWorldPosition(_t); else _t.copy(_f);
    const d1 = segDist(_k, _f, B, _m) - 0.055, d2 = segDist(_f, _t, B, _e) - 0.045;
    const pen = 0.11 + 0.012 - Math.min(d1, d2); if (pen <= 0) continue;
    const P = d2 < d1 ? _e : _m;                                                                   // le point du membre le plus enfoncé
    const nx = P.x - B.x, nz = P.z - B.z, nh = Math.hypot(nx, nz) || 1;
    // la normale horizontale (à côté) relevée d'un tiers (au-dessus) — jamais vers le sol
    let dx = nx / nh, dy = 0.35, dz = nz / nh; const dl = Math.hypot(dx, dy, dz); dx /= dl; dy /= dl; dz /= dl;
    _g.set(_f.x + dx * pen, _f.y + dy * pen, _f.z + dz * pen);
    leg.up.getWorldPosition(_h);
    const R = (L.A + L.B) * 0.995, d = _h.distanceTo(_g); if (d > R) _g.set(_h.x + (_g.x - _h.x) * (R / d), _h.y + (_g.y - _h.y) * (R / d), _h.z + (_g.z - _h.z) * (R / d));
    const sol = twoBoneIK(_h.toArray(), _g.toArray(), L.A, L.B, [_k.x - _h.x, _k.y - _h.y, _k.z - _h.z]);
    aimChildAt(leg.up, leg.knee, _m.fromArray(sol.mid)); aimChildAt(leg.knee, leg.foot, _e.fromArray(sol.end));
    pl._evite = (pl._evite ?? 0) + 1;
  }
}
