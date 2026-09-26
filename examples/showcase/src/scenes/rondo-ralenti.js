// rondo-ralenti.js — LES RALENTIS (26/09 : « les ralentis ok »). La régie télé ne rejoue pas le match, elle rejoue les IMAGES : un
// magnétoscope garde les ~14 dernières secondes du RENDU (pour chaque corps : la racine, les rotations de tous les os, la position des
// hanches ; le ballon), à 30 images/s de temps de match. Après un but, la lecture s'arrête (la sim est suspendue, rien ne change dans le
// monde), le ralenti rejoue la séquence sous un autre angle — derrière le but, puis au ras de la pelouse (résumé long et match complet) —,
// interpolé (slerp des os) à 0,5-0,4× ; puis l'image en direct est RESTAURÉE telle qu'elle était et le match reprend. Chaque but garde son
// clip : « ▶ revoir » dans la liste des moments. Échap / le bouton : passer. ?ralenti=0 : sans ralentis. Lecture du rendu, écriture du
// rendu seul (poses, caméra) — la simulation n'est jamais touchée.
import * as THREE from 'three/webgpu';

const PAS = 1 / 30, GARDE = 14, CLIPS = 6;

/** Les acteurs enregistrés : le ballon, les joueurs, les officiels et ramasseurs — leurs os, leurs hanches (la seule translation d'os). */
function acteurs(scene) {
  const roots = [scene.ball, ...scene.players.map((p) => p.model)];
  const A = scene.arbitre3d; if (A) for (const o of [A.central, ...(A.assistants ?? []), ...(A.ramasseurs ?? [])]) if (o?.model) roots.push(o.model);
  let n = 0;
  const L = roots.filter(Boolean).map((root) => {
    const os = []; root.traverse((o) => { if (o.isBone) os.push(o); });
    const hanches = os.filter((o) => /hips|pelvis/i.test(o.name));
    const a = { root, os, hanches, off: n }; n += 8 + os.length * 4 + hanches.length * 3; return a;
  });
  return { L, n };
}

function ecrire(R, out) {
  for (const a of R.A.L) {
    let k = a.off; const r = a.root;
    out[k++] = r.position.x; out[k++] = r.position.y; out[k++] = r.position.z; r.quaternion.toArray(out, k); k += 4; out[k++] = r.visible ? 1 : 0;
    for (const b of a.os) { b.quaternion.toArray(out, k); k += 4; }
    for (const h of a.hanches) { out[k++] = h.position.x; out[k++] = h.position.y; out[k++] = h.position.z; }
  }
  return out;
}

const _qa = new Float32Array(4);
/** Pose l'image interpolée entre fa et fb (u ∈ [0,1]). */
function poser(R, fa, fb, u) {
  for (const a of R.A.L) {
    let k = a.off; const r = a.root, l = (i) => fa[i] + (fb[i] - fa[i]) * u;
    r.position.set(l(k), l(k + 1), l(k + 2)); THREE.Quaternion.slerpFlat(_qa, 0, fa, k + 3, fb, k + 3, u); r.quaternion.fromArray(_qa); r.visible = fa[k + 7] > 0.5; k += 8;
    for (const b of a.os) { THREE.Quaternion.slerpFlat(_qa, 0, fa, k, fb, k, u); b.quaternion.fromArray(_qa); k += 4; }
    for (const h of a.hanches) { h.position.set(l(k), l(k + 1), l(k + 2)); k += 3; }
    r.updateMatrixWorld(true);
  }
}

export function ralentiInit(scene, { onClip } = {}) {
  const R = { frames: [], pool: [], dernier: -1, lecture: null, attente: null, onClip, A: null };
  if (typeof document === 'undefined') return R;
  R.badge = document.createElement('div');
  R.badge.style.cssText = 'position:fixed;top:14px;right:16px;z-index:42;display:none;align-items:stretch;height:38px;font-family:"Barlow Condensed","Roboto Condensed","Arial Narrow",system-ui,sans-serif;filter:drop-shadow(0 6px 14px rgba(0,0,0,.55))';
  R.badge.innerHTML = '<div style="background:#d7ff3c;color:#07090f;font-weight:800;font-size:22px;letter-spacing:.16em;padding:0 16px;display:flex;align-items:center;transform:skewX(-14deg)"><span style="transform:skewX(14deg)">RALENTI</span></div><div class="ang" style="background:#07090f;color:#fff;font-weight:600;font-size:18px;padding:0 14px;display:flex;align-items:center;transform:skewX(-14deg);margin-left:-1px"><span style="transform:skewX(14deg)"></span></div><button style="margin-left:10px;height:38px;padding:0 14px;border:0;border-radius:6px;background:#2a2f3a;color:#e8ebf2;font:600 14px system-ui,sans-serif;cursor:pointer">Passer ⏭</button>';
  R.badgeAng = R.badge.querySelector('.ang span');
  R.badge.querySelector('button').addEventListener('click', () => { if (R.lecture) R.lecture.fin = true; });
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && R.lecture) R.lecture.fin = true; });
  document.body.appendChild(R.badge);
  return R;
}

/** Chaque image rendue, APRÈS toute la pile de pose : l'image entre au magnétoscope (au pas de 1/30 s de temps de match). */
export function ralentiRecord(scene, R) {
  if (R.lecture) return;
  const t = scene.state.t; if (t - R.dernier < PAS - 1e-6) return;
  R.A ??= acteurs(scene);
  const buf = R.pool.pop() ?? new Float32Array(R.A.n);
  R.frames.push({ t, d: ecrire(R, buf) }); R.dernier = t;
  while (R.frames.length && R.frames[0].t < t - GARDE) R.pool.push(R.frames.shift().d);
}

/** Un but : le ralenti partira 2,5 s après (le temps de la célébration), sur [but − 6 s, but + 1 s]. */
export function ralentiBut(R, scene, e) {
  const st = scene.state;
  R.attente = { at: st.t + 2.5, t0: st.t - 6, t1: st.t + 1, team: e.team ?? 0, angles: scene._mode === 'court' ? ['but'] : ['but', 'ras'] };
}

function extraire(R, t0, t1) { return R.frames.filter((f) => f.t >= t0 && f.t <= t1).map((f) => ({ t: f.t, d: f.d.slice() })); }

/** Lance la lecture d'un clip (depuis le but, ou « revoir » dans les moments). */
export function ralentiJouer(R, scene, clip, angles = ['but', 'ras']) {
  if (!R || !clip?.frames?.length || R.lecture) return;
  const live = ecrire(R, new Float32Array(R.A.n)), cam = scene.cam;
  R.lecture = { clip, angles, ai: 0, u: 0, fin: false, live, cam: { p: cam.position.clone(), q: cam.quaternion.clone(), fov: cam.fov }, look: null };
  if (R.badge) R.badge.style.display = 'flex';
}

const NOMS = { but: 'Derrière le but', ras: 'Au ras de la pelouse' };

/** Chaque image : démarre le ralenti attendu, ou joue celui en cours. Rend true tant qu'un ralenti occupe l'écran (la scène ne fait rien d'autre). */
export function ralentiUpdate(scene, R, dt) {
  const st = scene.state;
  if (R.attente && !R.lecture && st.t >= R.attente.at) {
    const W = R.attente; R.attente = null;
    const clip = { frames: extraire(R, W.t0, W.t1), team: W.team, tBut: W.t1 - 1 };
    if (clip.frames.length > 10) { R.onClip?.(clip); ralentiJouer(R, scene, clip, W.angles); }
  }
  const P = R.lecture; if (!P) return false;
  const F = P.clip.frames, ang = P.angles[P.ai], tA = F[0].t, tB = F[F.length - 1].t;
  // l'angle au ras ne rejoue que la fin (l'action décisive), plus lentement
  const debut = ang === 'ras' ? Math.max(tA, (P.clip.tBut ?? tB) - 2.5) : tA, vit = ang === 'ras' ? 0.4 : 0.55;
  if (P.u === 0) { P.t = debut; P.look = null; if (R.badgeAng) R.badgeAng.textContent = NOMS[ang] ?? ''; }
  P.t += Math.min(dt, 1 / 20) * vit; P.u = 1;
  if (P.t >= tB || P.fin) {
    if (!P.fin && P.ai + 1 < P.angles.length) { P.ai++; P.u = 0; return true; }
    // FIN : l'image en direct revient telle qu'elle était, la caméra aussi
    poser(R, P.live, P.live, 0); const c = scene.cam; c.position.copy(P.cam.p); c.quaternion.copy(P.cam.q); c.fov = P.cam.fov; c.updateProjectionMatrix();
    R.lecture = null; if (R.badge) R.badge.style.display = 'none'; return false;
  }
  let i = 0; while (i < F.length - 2 && F[i + 1].t < P.t) i++;
  const a = F[i], b = F[i + 1] ?? a, u = b.t > a.t ? Math.min(1, Math.max(0, (P.t - a.t) / (b.t - a.t))) : 0;
  poser(R, a.d, b.d, u);
  // la caméra du ralenti : elle suit le BALLON rejoué (l'acteur 0)
  const bx = a.d[0] + (b.d[0] - a.d[0]) * u, by = a.d[1] + (b.d[1] - a.d[1]) * u, bz = a.d[2] + (b.d[2] - a.d[2]) * u;
  const g = st.pitch.attackGoal(P.clip.team ?? 0), sg = Math.sign(g.x || 1), cam = scene.cam, look = new THREE.Vector3(bx, Math.max(0.6, by), bz);
  P.look = P.look ? P.look.lerp(look, Math.min(1, dt * 3)) : look;
  if (ang === 'but') { cam.position.set(g.x + sg * 7.5, 6, THREE.MathUtils.clamp(bz * 0.4, -7, 7)); cam.fov = 46; }   // derrière la cage, au-dessus de la barre, EN DEÇÀ des panneaux (la tribune commence ~6 m derrière la ligne)
  else { const want = new THREE.Vector3(P.look.x - sg * 7, 1.6, P.look.z - 9); cam.position.lerp(want, cam.position.distanceTo(want) > 20 ? 1 : Math.min(1, dt * 2.5)); cam.fov = 38; }
  cam.updateProjectionMatrix(); cam.lookAt(P.look);
  return true;
}
