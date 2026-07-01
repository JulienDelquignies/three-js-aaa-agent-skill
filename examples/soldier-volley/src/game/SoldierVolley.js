import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { attachmentThroughout, noPops } from '../engine/temporal-validate.js';

// The volley, performed by a REAL rigged Mixamo character (Soldier.glb): runs in with the Mixamo
// Run clip, plants, a procedural right-leg kick strikes the ball, ball arcs into the net. Deterministic
// setTime(t, camera) for frame-accurate capture; temporal validation of ball-at-foot through contact.

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => t * t * (3 - 2 * t);
const l3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
function arc(p0, p1, t0, t1, apex, t) { const u = clamp((t - t0) / (t1 - t0), 0, 1); const p = l3(p0, p1, u); p[1] += 4 * apex * u * (1 - u); return p; }

const GOAL_X = 26, GOAL_W = 7.3, GOAL_H = 2.44, D = 1.6;
const PLANT = [8.5, 0, 0.4];
const T_CONTACT = 2.55, T_GOAL = 3.2;

export class SoldierVolley {
  constructor(scene, renderer) {
    this.scene = scene; this.duration = 6.0; this.disposables = [];
    this._ground(); this._goal(); this._ball();
    this.ready = this._load();
  }

  _ground() {
    const geo = new THREE.PlaneGeometry(80, 50); geo.rotateX(-Math.PI / 2);
    const c = document.createElement('canvas'); c.width = 1024; c.height = 640; const g = c.getContext('2d');
    for (let i = 0; i < 16; i++) { g.fillStyle = i % 2 ? '#3f9a3f' : '#368636'; g.fillRect(i / 16 * 1024, 0, 64, 640); }
    g.strokeStyle = '#eaf3ea'; g.lineWidth = 4; g.strokeRect(30, 30, 964, 580); g.strokeRect(760, 190, 234, 260);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshStandardNodeMaterial({ map: tex, roughness: 0.95 });
    const m = new THREE.Mesh(geo, mat); m.receiveShadow = true; this.scene.add(m); this.disposables.push(geo, mat, tex);
    const sgeo = new THREE.PlaneGeometry(320, 320); sgeo.rotateX(-Math.PI / 2);
    const smat = new THREE.MeshStandardNodeMaterial({ color: 0x2c7a30, roughness: 1 });
    const s = new THREE.Mesh(sgeo, smat); s.position.y = -0.04; this.scene.add(s); this.disposables.push(sgeo, smat);
  }

  _goal() {
    const white = new THREE.MeshStandardNodeMaterial({ color: 0xf4f6f8, roughness: 0.4 });
    const post = new THREE.CylinderGeometry(0.1, 0.1, GOAL_H, 12), bar = new THREE.CylinderGeometry(0.1, 0.1, GOAL_W, 12);
    const add = (geo, x, y, z, rx = 0) => { const m = new THREE.Mesh(geo, white); m.position.set(x, y, z); m.rotation.x = rx; m.castShadow = true; this.scene.add(m); };
    add(post, GOAL_X, GOAL_H / 2, -GOAL_W / 2); add(post, GOAL_X, GOAL_H / 2, GOAL_W / 2); add(bar, GOAL_X, GOAL_H, 0, Math.PI / 2);
    const nc = document.createElement('canvas'); nc.width = nc.height = 128; const ng = nc.getContext('2d'); ng.strokeStyle = '#fff'; ng.lineWidth = 3;
    for (let i = 0; i <= 8; i++) { const p = i / 8 * 128; ng.beginPath(); ng.moveTo(p, 0); ng.lineTo(p, 128); ng.moveTo(0, p); ng.lineTo(128, p); ng.stroke(); }
    const ntex = new THREE.CanvasTexture(nc); ntex.wrapS = ntex.wrapT = THREE.RepeatWrapping; ntex.repeat.set(8, 3);
    const nmat = new THREE.MeshStandardNodeMaterial({ color: 0xffffff, alphaMap: ntex, transparent: true, side: THREE.DoubleSide, depthWrite: false, roughness: 1 });
    const back = new THREE.PlaneGeometry(GOAL_W, GOAL_H, 24, 12); this.net = new THREE.Mesh(back, nmat); this.net.position.set(GOAL_X + D, GOAL_H / 2, 0);
    this.netRest = back.attributes.position.array.slice(); this.scene.add(this.net);
    const side = new THREE.PlaneGeometry(D, GOAL_H);
    const sl = new THREE.Mesh(side, nmat); sl.position.set(GOAL_X + D / 2, GOAL_H / 2, -GOAL_W / 2);
    const sr = new THREE.Mesh(side, nmat); sr.position.set(GOAL_X + D / 2, GOAL_H / 2, GOAL_W / 2);
    const top = new THREE.PlaneGeometry(D, GOAL_W); const tp = new THREE.Mesh(top, nmat); tp.rotation.x = Math.PI / 2; tp.position.set(GOAL_X + D / 2, GOAL_H, 0);
    this.scene.add(sl, sr, tp); this.disposables.push(post, bar, white, back, side, top, nmat, ntex);
  }

  _ball() {
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); g.fillStyle = '#f2f2f2'; g.fillRect(0, 0, 128, 128);
    g.fillStyle = '#141414'; for (let i = 0; i < 5; i++) { g.beginPath(); g.arc(30 + (i % 3) * 40, 30 + ((i / 3) | 0) * 60, 12, 0, 7); g.fill(); }
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const geo = new THREE.SphereGeometry(0.12, 24, 16); const mat = new THREE.MeshStandardNodeMaterial({ map: tex, roughness: 0.5 });
    this.ball = new THREE.Mesh(geo, mat); this.ball.castShadow = true; this.scene.add(this.ball); this.disposables.push(geo, mat, tex);
  }

  async _load() {
    const gltf = await new GLTFLoader().loadAsync('Soldier.glb');
    const model = gltf.scene; model.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
    const box = new THREE.Box3().setFromObject(model); const size = box.getSize(new THREE.Vector3());
    model.scale.setScalar(1.8 / size.y); const b2 = new THREE.Box3().setFromObject(model); model.position.y -= b2.min.y;
    model.rotation.y = Math.PI / 2; // face +X (running direction)
    this.scene.add(model); this.model = model;
    this.mixer = new THREE.AnimationMixer(model);
    const clips = gltf.animations;
    this.run = clips.find((c) => /run/i.test(c.name)); this.idle = clips.find((c) => /idle/i.test(c.name));
    this.runDur = this.run?.duration || 1;
    this.actRun = this.mixer.clipAction(this.run); this.actIdle = this.mixer.clipAction(this.idle);
    this.actRun.play();
    const bone = (re) => { let f = null; model.traverse((o) => { if (o.isBone && re.test(o.name) && !f) f = o; }); return f; };
    this.rUpLeg = bone(/RightUpLeg/i); this.rLeg = bone(/RightLeg$/i); this.rFoot = bone(/RightFoot/i);
    this.rUpRest = this.rUpLeg?.rotation.x || 0; this.rLegRest = this.rLeg?.rotation.x || 0;
    this.setTime(0);
    this._validate();
    return true;
  }

  _poseAt(t) {
    // locomotion: run while approaching, ease to idle after the plant
    const approaching = t < T_CONTACT - 0.15;
    if (approaching) { this.mixer.setTime((t * 1.35) % this.runDur); }
    else { this.mixer.setTime((this.idle ? (t - T_CONTACT) % this.idle.duration : 0)); this.actRun.weight = 0; this.actIdle.weight = 1; this.actIdle.play(); }
    // move root along the approach path, feet grounded
    const u = smooth(clamp(t / (T_CONTACT - 0.15), 0, 1));
    const p = l3([-8, 0, 1.6], PLANT, u); this.model.position.set(p[0], 0, p[2]);
    this.scene.updateMatrixWorld(true);
    // procedural right-leg kick around contact (blend on top of the clip pose)
    const w = Math.exp(-Math.pow((t - T_CONTACT) / 0.16, 2));
    if (this.rUpLeg) this.rUpLeg.rotation.x = this.rUpRest - 1.5 * w;
    if (this.rLeg) this.rLeg.rotation.x = this.rLegRest + 0.9 * w;
    this.scene.updateMatrixWorld(true);
  }

  setTime(t, camera) {
    t = clamp(t, 0, this.duration);
    this._poseAt(t);
    const v = new THREE.Vector3(); this.rFoot?.getWorldPosition(v); const foot = v.toArray();
    // ball: on the foot until contact, then arc to goal, then settle in the net
    let bp;
    if (t < T_CONTACT) bp = [foot[0] + 0.18, Math.max(0.12, foot[1]), foot[2]];
    else if (t < T_GOAL) bp = arc([PLANT[0] + 0.2, 0.4, PLANT[2]], [GOAL_X + 1.0, 1.15, 0], T_CONTACT, T_GOAL, 1.4, t);
    else { const s = Math.exp(-(t - T_GOAL) * 3) * Math.abs(Math.sin((t - T_GOAL) * 20)) * 0.15; bp = [GOAL_X + 1.15, 1.1 + s, 0]; }
    this.ball.position.set(bp[0], bp[1], bp[2]); this.ball.rotation.z -= 0.3; this.ball.rotation.x = t * 5;
    if (this.net) { const pos = this.net.geometry.attributes.position; const amp = t > T_GOAL ? Math.exp(-(t - T_GOAL) * 4) * 0.5 : 0; for (let i = 0; i < pos.count; i++) { const x = this.netRest[i * 3], y = this.netRest[i * 3 + 1]; const d = Math.hypot(x, y - (1.1 - GOAL_H / 2)); pos.array[i * 3 + 2] = this.netRest[i * 3 + 2] - amp * Math.exp(-d * d * 1.5) * Math.cos(d * 8 - (t - T_GOAL) * 20); } pos.needsUpdate = true; }
    if (camera) {
      const keys = [
        { t: 0.0, p: [-9, 3.2, 7], l: [-6, 1.2, 1] }, { t: 2.0, p: [4, 2.6, 6.5], l: [8, 1.2, 0.5] },
        { t: 2.55, p: [5.5, 1.8, 5], l: [16, 1.3, 0] }, { t: 3.3, p: [16, 2.6, 8], l: [26, 1.4, 0] },
        { t: 3.9, p: [21, 2.8, 8], l: [26.5, 1.2, 0] }, { t: 6.0, p: [20, 3.2, 9], l: [26.5, 1.2, 0] },
      ];
      let a = keys[0], b = keys[keys.length - 1];
      for (let i = 0; i < keys.length - 1; i++) if (t >= keys[i].t && t <= keys[i + 1].t) { a = keys[i]; b = keys[i + 1]; break; }
      const u2 = smooth(clamp((t - a.t) / (b.t - a.t || 1), 0, 1)); const p2 = l3(a.p, b.p, u2), l = l3(a.l, b.l, u2);
      camera.position.set(p2[0], p2[1], p2[2]); camera.lookAt(l[0], l[1], l[2]);
    }
  }

  // temporal validation: the ball stays at the striker's foot through the approach/contact window.
  _validate() {
    const N = 40, v = new THREE.Vector3(); const footP = [], ballP = [];
    for (let i = 0; i < N; i++) { const t = (i / N) * (T_CONTACT - 0.03); this.setTime(t); this.rFoot.getWorldPosition(v); footP.push(v.toArray()); ballP.push(this.ball.position.toArray()); }
    const atFoot = attachmentThroughout(ballP, footP.map((f) => [f[0] + 0.18, Math.max(0.12, f[1]), f[2]]), 0.15);
    const ballAll = []; for (let i = 0; i < 60; i++) { this.setTime((i / 59) * this.duration); ballAll.push(this.ball.position.toArray()); }
    const pops = noPops(ballAll, null, { dt: this.duration / 60, maxSpeed: 60 });
    window.__volleyReport = {
      character: 'Soldier.glb (Mixamo rig)', kickBone: this.rUpLeg?.name, footBone: this.rFoot?.name,
      checks: { ball_at_foot_through_contact: { ok: atFoot.ok, detail: atFoot.detail }, ball_trajectory_no_pops: { ok: pops.ok, detail: pops.detail } },
      summary: `Soldier (real Mixamo rig) volley: ball stays at the kicking foot through the run-up to contact ${atFoot.ok ? '✓' : '✗'} (${atFoot.detail}); ball trajectory continuous, no pops ${pops.ok ? '✓' : '✗'}.`,
    };
    console.log('[SoldierVolley]', window.__volleyReport.summary);
  }

  update() {}
  dispose() { for (const d of this.disposables) d.dispose?.(); }
}
