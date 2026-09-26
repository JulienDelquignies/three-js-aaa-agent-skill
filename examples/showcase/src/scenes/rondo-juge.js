// rondo-juge.js — L'ARBITRE VISUEL (chantier « conduite et contrôle à la foulée », 27/09 : « pas de téléportation du ballon, pas de téléportation
// du joueur, éviter les pieds qui glissent, éviter les jambes qui s'allongent sur 3 m pour récupérer un ballon »). Il lit le RENDU (os du
// squelette, ballon affiché), jamais la sim, image par image, pour les 22 joueurs :
//   ballon   — saut : déplacement affiché > (vitesse sim × Δt × 1,5 + 3 cm) ;
//   corps    — saut : déplacement de la racine affichée > (vitesse sim × Δt × 1,5 + 3 cm) ;
//   pied     — glisse : pied POSÉ (≤ 4 cm au-dessus de son plancher appris, vitesse verticale < 0,4 m/s) qui file à > 0,5 m/s au sol ;
//   jambe    — étirée : hanche → pied > 1,03 × (cuisse + tibia) ;
//   allonge  — à chaque touche / contrôle : hanche la plus proche → ballon, en longueurs de jambe (> 1,1 : le pied « va chercher »).
// window.__atelier.juge() rend la synthèse. Lecture seule.
import * as THREE from 'three/webgpu';

const _a = new THREE.Vector3(), _b = new THREE.Vector3();

export function jugeInit() {
  return { t: null, ball: null, P: new Map(), n: 0, sautsBallon: 0, sautsCorps: 0, piedsPoses: 0, glisses: 0, glisseM: 0, jambes: 0, jambesMax: 1, jambeImages: 0, allonges: [], pires: [] };
}

/** Une image : mesure tout. scene = la scène Rondo (players, ball, state). */
export function jugeImage(J, scene) {
  const st = scene.state, t = st.t, dt = J.t == null ? 0 : t - J.t; J.t = t;
  if (!(dt > 0) || dt > 0.1) { J.ball = scene.ball?.position.clone(); for (const pl of scene.players ?? []) J.P.set(pl.sim.id, { root: pl.model.position.clone(), feet: {} }); return; }
  J.n++;
  // le ballon
  if (scene.ball) { const b = scene.ball.position, vb = Math.hypot(st.ball.v[0], st.ball.v[1], st.ball.v[2]);
    if (J.ball && b.distanceTo(J.ball) > vb * dt * 1.5 + 0.03 && !st.restart) { J.sautsBallon++; J.pires.push({ k: 'ballon', t: +t.toFixed(2), d: +b.distanceTo(J.ball).toFixed(2) }); }
    J.ball = b.clone(); }
  for (const pl of scene.players ?? []) {
    const s = pl.sim, prev = J.P.get(s.id) ?? { root: null, feet: {} }, r = pl.model.position, vs = Math.hypot(s.v[0], s.v[1]);
    if (prev.root && r.distanceTo(prev.root) > Math.max(vs, 1) * dt * 1.5 + 0.03 && !st.restart) { J.sautsCorps++; J.pires.push({ k: 'corps', id: s.id, t: +t.toFixed(2), d: +r.distanceTo(prev.root).toFixed(2) }); }
    prev.root = r.clone();
    for (const f of ['left', 'right']) {
      const leg = pl.legs?.[f], L = pl.legLens?.[f]; if (!leg?.foot || !leg.up || !L) continue;
      leg.foot.getWorldPosition(_a); leg.up.getWorldPosition(_b);
      const F = prev.feet[f] ?? (prev.feet[f] = { p: null, q: null });
      const toe = leg.foot.children.find((o) => /ToeBase/i.test(o.name)); const _t = toe ? toe.getWorldPosition(new THREE.Vector3()) : _a.clone();
      // POSÉ = la foulée dit « appui » (ctrl._gaitFeet) ; la GLISSE = le point d'appui qui bouge : le plus immobile de la cheville et des orteils
      // (le talon attaque, les orteils déroulent — l'un des deux est au sol et ne doit pas filer)
      const gf = pl.ctrl?._gaitFeet?.[f === 'left' ? 'Left' : 'Right'];
      const proche = !scene.cam || Math.hypot(scene.cam.position.x - s.p[0], scene.cam.position.z - s.p[2]) < 25;   // les joueurs PROCHES (le LOD anime les lointains une image sur 2-3 : leurs pieds suivent le corps entre deux)
      const pose = !!(gf && gf.phase === 'stance' && !pl.ctrl.airborne), avant = F.pose; F.pose = pose;   // la glisse se lit d'une image POSÉE à la suivante (l'image du contact est l'atterrissage)
      if (proche && F.p && F.q && pose && avant) { const vA = Math.hypot(_a.x - F.p.x, _a.z - F.p.z) / dt, vT = Math.hypot(_t.x - F.q.x, _t.z - F.q.z) / dt, vh = Math.min(vA, vT);
        J.piedsPoses++; const kv = vs < 1 ? 'v<1' : vs < 3 ? 'v1-3' : vs < 5 ? 'v3-5' : 'v5+', ko = (pl._offA && Math.hypot(pl._offA[0], pl._offA[1]) > 0.05) ? 'décalé' : 'non-décalé', kc = st.possession?.carrier === s.id ? 'porteur' : 'autres';
        for (const k of [kv, ko, kc]) { const B = (J.cases ??= {})[k] ??= [0, 0]; B[0]++; if (vh > 0.5) B[1]++; }
        const LS = pl.ctrl.footLock?.state?.[f === 'left' ? 0 : 1];
        if (vh > 0.5 && LS) { const e = LS.driven && LS.w > 0.99 ? Math.hypot(_a.x - LS.lock.x, _a.z - LS.lock.z) : -1, mv = LS._lp ? Math.hypot(LS.lock.x - LS._lp[0], LS.lock.z - LS._lp[1]) / dt : null; (J.diag ??= []).length < 3000 && J.diag.push([+e.toFixed(3), mv == null ? null : +mv.toFixed(2), LS.driven ? 1 : 0, +LS.w.toFixed(2), +vh.toFixed(2), +vs.toFixed(1)]); }
        if (LS) LS._lp = [LS.lock.x, LS.lock.z];
        if (vh > 0.5) { J.glisses++; J.glisseM += vh * dt; (J.vGl ??= []).push(+vh.toFixed(2)); if (J.vGl.length > 5000) J.vGl.shift(); } }
      F.p = _a.clone(); F.q = _t.clone();
      const ratio = _a.distanceTo(_b) / (L.A + L.B); J.jambeImages++;
      if (ratio > 1.03) J.jambes++; if (ratio > J.jambesMax) J.jambesMax = ratio;
    }
    J.P.set(s.id, prev);
  }
  if (J.pires.length > 200) J.pires.splice(0, J.pires.length - 200);
}

/** L'allonge à une touche / un contrôle : hanche la plus proche du ballon affiché, en longueurs de jambe. */
export function jugeTouche(J, scene, id, kind) {
  const pl = scene.players?.[id], b = scene.ball?.position; if (!pl || !b) return;
  let best = Infinity;
  for (const f of ['left', 'right']) { const leg = pl.legs?.[f], L = pl.legLens?.[f]; if (!leg?.up || !L) continue; leg.up.getWorldPosition(_b); best = Math.min(best, _b.distanceTo(b) / (L.A + L.B)); }
  if (isFinite(best)) J.allonges.push({ kind, r: best, t: scene.state.t });
  if (J.allonges.length > 2000) J.allonges.splice(0, J.allonges.length - 2000);
}

export function jugeBilan(J) {
  const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s.length ? +s[Math.floor(p * (s.length - 1))].toFixed(2) : null; };
  const A = J.allonges.map((x) => x.r);
  return { images: J.n, sautsBallon: J.sautsBallon, sautsCorps: J.sautsCorps, glissePct: +(100 * J.glisses / Math.max(1, J.piedsPoses)).toFixed(1), glisseM: +J.glisseM.toFixed(1),
    jambesEtireesPct: +(100 * J.jambes / Math.max(1, J.jambeImages)).toFixed(2), jambeMax: +J.jambesMax.toFixed(2),
    cases: Object.fromEntries(Object.entries(J.cases ?? {}).map(([k, [n, g]]) => [k, `${Math.round(100 * g / Math.max(1, n))} % de ${n}`])), vGlisse: { p50: q(J.vGl ?? [], 0.5), p90: q(J.vGl ?? [], 0.9) }, diag: J.diag,
    allonge: { n: A.length, p50: q(A, 0.5), p90: q(A, 0.9), max: q(A, 1), au_dela_1_1: A.filter((r) => r > 1.1).length }, pires: J.pires.slice(-8) };
}
