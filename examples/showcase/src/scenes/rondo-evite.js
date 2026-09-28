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

const _k = new THREE.Vector3(), _f = new THREE.Vector3(), _t = new THREE.Vector3(), _h = new THREE.Vector3(), _g = new THREE.Vector3(), _m = new THREE.Vector3(), _e = new THREE.Vector3(), _B = new THREE.Vector3();

/** Distance du centre B au segment PQ, et le point le plus proche (dans out). */
function segDist(P, Q, B, out) {
  const ux = Q.x - P.x, uy = Q.y - P.y, uz = Q.z - P.z, L2 = ux * ux + uy * uy + uz * uz || 1;
  const k = Math.max(0, Math.min(1, ((B.x - P.x) * ux + (B.y - P.y) * uy + (B.z - P.z) * uz) / L2));
  out.set(P.x + ux * k, P.y + uy * k, P.z + uz * k); return out.distanceTo(B);
}

export function eviteBallon(scene, pl) {
  if (scene._piedTraverse) return;
  // (C4) le ballon de CETTE image : Rondo pose le maillage après la pile des joueurs — scene.ball.position est celui de l'image passée,
  // 8-12 cm en retard à 5-7 m/s (le pied évitait un ballon déjà parti et entrait dans le vrai). La sim + l'écart rendu courant (_ballOff).
  const b = scene.state?.ball?.p, O = scene._ballOff ?? [0, 0, 0];
  const B = scene._eviteImagePassee || !b ? scene.ball?.position : _B.set(b[0] + O[0], b[1] + O[1], b[2] + O[2]); if (!B || B.y > 1.2) return;
  if (Math.hypot(pl.sim.p[0] - B.x, pl.sim.p[2] - B.z) > 1.4) return;
  for (const f of ['left', 'right']) {
    const leg = pl.legs?.[f], L = pl.legLens?.[f]; if (!leg?.foot || !leg.knee || !leg.up || !L) continue;
    const gf = pl.ctrl?._gaitFeet?.[f === 'left' ? 'Left' : 'Right'], ancien = (pl._evPh ??= {})[f]; pl._evPh[f] = gf?.phase;
    // (354) PENDANT UN GESTE DU CORPS ENTIER de dribble ou de contrôle, la jambe est AU GESTE : l'étiquette de phase de la foulée y est périmée et
    // l'acte sim du dribble l'exemptait tout entière — les épisodes de ≥ 3 images au-delà de 3 cm étaient TOUS là (contrôle pivot, crochet,
    // contrôle rebond, passement : le clip suppose le ballon à sa place, la sim le met ailleurs). Les deux pieds y sont posés à la SURFACE.
    const gs = pl.gestureLayer?.active && !pl.gestureLayer.spec?.upperOnly ? pl.gestureLayer.spec?.family : null;
    const enGeste = !scene._degageAppui && (gs === 'skill' || gs === 'control') && (!pl.sim.act || pl.sim.act.payload?.kind === 'skill');
    // …sauf l'appui VRAIMENT immobile (≤ 5 mm à l'image d'avant) : planté, il glisserait (appuis qui bougent en geste 12 → 14-17 %) — le ballon rendu s'en écarte (ballonDegage)
    leg.foot.getWorldPosition(_f); const pv = (pl._evPos ??= {})[f], immobile = pv && Math.hypot(_f.x - pv[0], _f.z - pv[1]) < 0.005; pl._evPos[f] = [_f.x, _f.z];
    if (gf && gf.phase !== 'swing' && (!enGeste || immobile)) {
      // l'appui ne se déplace pas (il glisserait) — SAUF à l'image de la pose : le pied qui se POSE dans le ballon se pose À CÔTÉ (le point d'appui décalé de la pénétration)
      const LS = pl.ctrl?.footLock?.state?.[f === 'left' ? 0 : 1];
      if (ancien === 'swing' && LS?.driven && LS.off) { leg.foot.getWorldPosition(_f); const nx = _f.x - B.x, nz = _f.z - B.z, nh = Math.hypot(nx, nz) || 1, pen = 0.11 + 0.05 - nh;
        if (pen > 0 && _f.y < B.y + 0.15) { LS.off[0] += nx / nh * pen; LS.off[1] += nz / nh * pen; LS.lock.x += nx / nh * pen; LS.lock.z += nz / nh * pen; pl._evitePose = (pl._evitePose ?? 0) + 1; } }
      continue;
    }
    const touche = (pl._touchFootPlan === f || pl._touchFoot === f) && ((pl._touchT != null && Math.abs(scene._t - pl._touchT) < 0.18) || (pl._touchPlanT != null && Math.abs(scene._t - pl._touchPlanT) < 0.18));
    const geste = enGeste || (!scene._gesteTraverse && pl._gestePied === f && Math.abs(scene._t - (pl._gestePiedT ?? -9)) < 0.25);   // (C4) le pied du CONTRÔLE (rondo-pied) : lui aussi au ballon, à sa surface
    if ((pl.sim.act && !enGeste) || (touche && scene._toucheTraverse)) continue;                                  // le pied qui JOUE le ballon le touche — c'est le geste
    // (C4) …mais il le touche À SA SURFACE : exempté ±0,18 s, le pied de touche entrait de 9 cm p50 dans le ballon (5,2 % des images de conduite) —
    // il reste corrigé, sans marge et presque à plat (la poussée vient de derrière, pas d'au-dessus)
    const toe = leg.foot.children.find((o) => /ToeBase/i.test(o.name));
    // (C4) JUSQU'À TROIS PASSES : le point le plus enfoncé est souvent au MILIEU du tibia — la cible déplace la cheville de pen, ce point-là
    // d'une fraction seulement (mesuré : 12 tibias en vol et les jambes des contrôles restaient 2-8 cm dans le ballon) ; on recommence
    for (let passe = 0; passe < (scene._eviteUnePasse ? 1 : 3); passe++) {
    leg.knee.getWorldPosition(_k); leg.foot.getWorldPosition(_f); if (toe) toe.getWorldPosition(_t); else _t.copy(_f);
    const d1 = segDist(_k, _f, B, _m) - 0.055, d2 = segDist(_f, _t, B, _e) - 0.045;
    const appuiG = enGeste && gf && gf.phase !== 'swing';   // (354) l'appui DU GESTE qui bouge ne se corrige qu'au-delà de 1,5 cm (la tolérance, sous 3)
    const pen = 0.11 + (appuiG ? -0.015 : touche || geste ? 0 : 0.012) - Math.min(d1, d2); if (pen <= 0.002) break;
    const P = d2 < d1 ? _e : _m;                                                                   // le point du membre le plus enfoncé
    const nx = P.x - B.x, nz = P.z - B.z, nh = Math.hypot(nx, nz) || 1;
    // la normale horizontale (à côté) relevée d'un tiers (au-dessus) — jamais vers le sol
    let dx = nx / nh, dy = touche || geste ? 0.1 : 0.35, dz = nz / nh; const dl = Math.hypot(dx, dy, dz); dx /= dl; dy /= dl; dz /= dl;
    _g.set(_f.x + dx * pen, _f.y + dy * pen, _f.z + dz * pen);
    leg.up.getWorldPosition(_h);
    const R = (L.A + L.B) * 0.995, d = _h.distanceTo(_g); if (d > R) _g.set(_h.x + (_g.x - _h.x) * (R / d), _h.y + (_g.y - _h.y) * (R / d), _h.z + (_g.z - _h.z) * (R / d));
    const sol = twoBoneIK(_h.toArray(), _g.toArray(), L.A, L.B, [_k.x - _h.x, _k.y - _h.y, _k.z - _h.z]);
    aimChildAt(leg.up, leg.knee, _m.fromArray(sol.mid)); aimChildAt(leg.knee, leg.foot, _e.fromArray(sol.end));
    pl._evite = (pl._evite ?? 0) + 1;
    }
  }
}

/** LE BALLON BUTE CONTRE LE PIED D'APPUI (chantier foulée) : un pied POSÉ ne bouge pas (il glisserait) — mais un ballon qui roule DANS un appui y buterait.
 *  L'écart AFFICHÉ (≤ max m, horizontal) qui sort le ballon rendu des pieds posés des joueurs proches ; Rondo le fond au décalage rendu − sim (≤ 3 m/s).
 *  Jamais contre le pied qui JOUE la touche. Rend [dx, dz] ou null. La sim ne bouge pas. */
export function ballonDegage(scene, max = 0.12, tibia = false) {   // (C4) tibia : le bas de la jambe compte aussi (le ballon roulait dans la cheville)
  if (scene._piedTraverse) return null;
  const st = scene.state, b = st.ball.p; if (b[1] > 0.5) return null;
  _g.set(b[0], b[1], b[2]); let ox = 0, oz = 0;
  for (const pl of scene.players ?? []) {
    if (Math.hypot(pl.sim.p[0] - b[0], pl.sim.p[2] - b[2]) > 1.3) continue;
    for (const f of ['left', 'right']) {
      // (354, « on peut tolérer 3 cm ») TOUTE jambe près du ballon — la jambe en VOL aussi (1,2 % des images de conduite, le tibia qui passe
      // dans le ballon), le tibia toujours ; le pied qui joue au contact 1,5 cm (la marge sous 3). ?degage-appui : hier (les appuis seuls)
      const tout = !scene._degageAppui;
      const leg = pl.legs?.[f], gf = pl.ctrl?._gaitFeet?.[f === 'left' ? 'Left' : 'Right']; if (!leg?.foot || (!tout && (!gf || gf.phase === 'swing'))) continue;
      const joue = (pl._touchFootPlan === f || pl._touchFoot === f) && ((pl._touchT != null && Math.abs(scene._t - pl._touchT) < 0.18) || (pl._touchPlanT != null && Math.abs(scene._t - pl._touchPlanT) < 0.18));
      if (joue && scene._degageTouche === false) continue;   // (C4, filmé) le pied qui JOUE, posé, restait jusqu'à 7 cm DANS le ballon (1,7 % des images) : il garde le contact (2 cm), le reste se dégage
      const toe = leg.foot.children.find((o) => /ToeBase/i.test(o.name)); leg.foot.getWorldPosition(_f); if (toe) toe.getWorldPosition(_t); else _t.copy(_f);
      let d = segDist(_f, _t, _g, _e) - 0.045; if ((tibia || tout) && leg.knee) { leg.knee.getWorldPosition(_k); const d1 = segDist(_k, _f, _g, _m) - 0.055; if (d1 < d) { d = d1; _e.copy(_m); } }
      const pen = 0.11 + (joue ? (tout ? -0.015 : -0.02) : 0.01) - d; if (pen <= 0) continue;   // le pied qui joue garde 1,5 cm de contact (le ballon s'écrase), les autres 1 cm d'air
      const nx = _g.x - _e.x, nz = _g.z - _e.z, nh = Math.hypot(nx, nz) || 1; ox += nx / nh * pen; oz += nz / nh * pen;
    }
  }
  const l = Math.hypot(ox, oz); if (l < 1e-4) return null; const k = l > max ? max / l : 1; return [ox * k, oz * k];
}
