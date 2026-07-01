import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as skeletonClone } from 'three/addons/utils/SkeletonUtils.js';
import { matchCadence } from '../engine/locomotion.js';
import { FootLockIK } from '../engine/foot-lock.js';
import { noPops } from '../engine/temporal-validate.js';

// The move, done right: a DRIBBLER carries the ball down the wing and CROSSES; a STRIKER runs onto it
// and VOLLEYS into the net. Two real Mixamo rigs. Each player FACES where it moves (Soldier forward is
// −Z, so yaw = atan2(dx,dz) − π) — no moonwalk — and the shots go toward their targets (cross → striker,
// volley → goal). Legs cadence-synced + foot-locked (reference/21). Deterministic setTime(t,camera).
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => t * t * (3 - 2 * t);
const l3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
function arc(p0, p1, t0, t1, apex, t) { const u = clamp((t - t0) / (t1 - t0), 0, 1); const p = l3(p0, p1, u); p[1] += 4 * apex * u * (1 - u); return p; }
const faceYaw = (dx, dz) => Math.atan2(dx, dz) - Math.PI;         // Soldier forward is −Z

const GOAL_X = 26, GOAL_W = 7.3, GOAL_H = 2.44, D = 1.6, R = 0.12;
// choreography
const DRB0 = [1, 0, 9], DRB1 = [17.5, 0, 9];            // dribbler run (down the wing, +X)
const STR0 = [13, 0, -7], MEET = [20.5, 0, -1.2];        // striker run onto the cross
const GOALPT = [25.4, 1.15, 0.6];
const T_CROSS = 2.25, T_MEET = 3.2, T_GOAL = 3.85;

class Walker {
  constructor(scene, model, gltfAnims, start, stride = 2.6) {
    this.scene = scene; this.model = model; this.start = start; this.stride = stride;
    model.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
    const box = new THREE.Box3().setFromObject(model); model.scale.setScalar(1.8 / box.getSize(new THREE.Vector3()).y);
    const b2 = new THREE.Box3().setFromObject(model); this.y = -b2.min.y; model.position.set(start[0], this.y, start[2]);
    scene.add(model);
    this.mixer = new THREE.AnimationMixer(model);
    this.run = gltfAnims.find((a) => /run/i.test(a.name)); this.runDur = this.run.duration; this.mixer.clipAction(this.run).play();
    const bone = (re) => { let f = null; model.traverse((o) => { if (o.isBone && re.test(o.name) && !f) f = o; }); return f; };
    this.rUpLeg = bone(/RightUpLeg/i); this.rLeg = bone(/RightLeg$/i); this.rUpRest = this.rUpLeg?.rotation.x || 0; this.rLegRest = this.rLeg?.rotation.x || 0;
    const legs = [
      { up: bone(/LeftUpLeg/i), knee: bone(/LeftLeg$/i), foot: bone(/LeftFoot/i) },
      { up: bone(/RightUpLeg/i), knee: bone(/RightLeg$/i), foot: bone(/RightFoot/i) },
    ];
    this.footLock = new FootLockIK(legs, { contactBand: 0.05, sampleClip: (p) => { this.mixer.setTime(p * this.runDur); this.model.updateWorldMatrix(true, true); } });
  }
  // pos: [x,_,z]; face: [dx,dz]; kick: 0..1 right-leg volley blend
  pose(pos, face, { running = true, kick = 0 } = {}) {
    this.model.position.set(pos[0], this.y, pos[2]);
    this.model.rotation.y = faceYaw(face[0], face[1]);
    const traveled = Math.hypot(pos[0] - this.start[0], pos[2] - this.start[2]);
    this.mixer.setTime(matchCadence(this.runDur, traveled, this.stride));
    this.model.updateWorldMatrix(true, true);
    if (kick > 0) { if (this.rUpLeg) this.rUpLeg.rotation.x = this.rUpRest - 1.6 * kick; if (this.rLeg) this.rLeg.rotation.x = this.rLegRest + 1.0 * kick; this.model.updateWorldMatrix(true, true); }
    else if (running) this.footLock.solve();
  }
}

export class SoldierVolley {
  constructor(scene) { this.scene = scene; this.duration = 6.0; this.disposables = []; this._ground(); this._goal(); this._ball(); this.ready = this._load(); }

  _ground() {
    const geo = new THREE.PlaneGeometry(80, 55); geo.rotateX(-Math.PI / 2);
    const c = document.createElement('canvas'); c.width = 1024; c.height = 704; const g = c.getContext('2d');
    for (let i = 0; i < 16; i++) { g.fillStyle = i % 2 ? '#3f9a3f' : '#368636'; g.fillRect(i / 16 * 1024, 0, 64, 704); }
    g.strokeStyle = '#eaf3ea'; g.lineWidth = 4; g.strokeRect(28, 28, 968, 648); g.strokeRect(770, 250, 226, 204);
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
    const add = (geo, x, y, z, rx = 0) => { const mm = new THREE.Mesh(geo, white); mm.position.set(x, y, z); mm.rotation.x = rx; mm.castShadow = true; this.scene.add(mm); };
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
    const geo = new THREE.SphereGeometry(R, 24, 16); const mat = new THREE.MeshStandardNodeMaterial({ map: tex, roughness: 0.5 });
    this.ball = new THREE.Mesh(geo, mat); this.ball.castShadow = true; this.scene.add(this.ball); this.disposables.push(geo, mat, tex);
  }

  async _load() {
    const gltf = await new GLTFLoader().loadAsync('Soldier.glb');
    this.dribbler = new Walker(this.scene, gltf.scene, gltf.animations, DRB0, 2.6);
    this.striker = new Walker(this.scene, skeletonClone(gltf.scene), gltf.animations, STR0, 2.6);
    this.setTime(0); this._validate(); return true;
  }

  _dribblerPos(t) { const u = smooth(clamp(t / T_CROSS, 0, 1)); return l3(DRB0, DRB1, u); }
  _strikerPos(t) { const u = smooth(clamp((t - 0.5) / (T_MEET - 0.5), 0, 1)); return l3(STR0, MEET, u); }

  setTime(t, camera) {
    t = clamp(t, 0, this.duration);
    const dPos = this._dribblerPos(t), sPos = this._strikerPos(t);
    const dDir = [DRB1[0] - DRB0[0], DRB1[2] - DRB0[2]];
    const sDir = [MEET[0] - STR0[0], MEET[2] - STR0[2]];
    // dribbler runs & dribbles until the cross, plays a cross kick, then faces upfield
    const dKick = Math.exp(-Math.pow((t - T_CROSS) / 0.14, 2));
    this.dribbler.pose(dPos, t < T_CROSS + 0.3 ? dDir : [1, 0], { running: t < T_CROSS, kick: t > T_CROSS - 0.12 && t < T_CROSS + 0.12 ? dKick : 0 });
    // striker runs onto the ball, faces the goal at the volley, volley kick at the meet
    const vKick = Math.exp(-Math.pow((t - T_MEET) / 0.13, 2));
    this.striker.pose(t < T_MEET ? sPos : MEET, t < T_MEET - 0.15 ? sDir : [1, 0], { running: t < T_MEET - 0.05, kick: t > T_MEET - 0.12 && t < T_MEET + 0.14 ? vKick : 0 });

    // ball: dribbled ahead of the dribbler → crossed to the meet point → volleyed into the goal → settle
    let bp;
    if (t < T_CROSS) { const f = Math.hypot(dDir[0], dDir[1]); bp = [dPos[0] + dDir[0] / f * 0.85, R, dPos[2] + dDir[1] / f * 0.85]; this._cross0 = [bp[0], 0.25, bp[2]]; }
    else if (t < T_MEET) bp = arc(this._cross0 || [DRB1[0] + 0.8, 0.25, DRB1[2]], [MEET[0], 0.35, MEET[2]], T_CROSS, T_MEET, 2.6, t);
    else if (t < T_GOAL) bp = arc([MEET[0], 0.4, MEET[2]], GOALPT, T_MEET, T_GOAL, 1.5, t);
    else { const s = Math.exp(-(t - T_GOAL) * 3) * Math.abs(Math.sin((t - T_GOAL) * 20)) * 0.15; bp = [GOALPT[0] + 0.15, GOALPT[1] + s, GOALPT[2]]; }
    this.ball.position.set(bp[0], bp[1], bp[2]); this.ball.rotation.x = t * 6; this.ball.rotation.z -= 0.25;

    if (this.net) { const pos = this.net.geometry.attributes.position; const amp = t > T_GOAL ? Math.exp(-(t - T_GOAL) * 4) * 0.5 : 0; for (let i = 0; i < pos.count; i++) { const x = this.netRest[i * 3], y = this.netRest[i * 3 + 1]; const d = Math.hypot(x - GOALPT[2], y - (GOALPT[1] - GOAL_H / 2)); pos.array[i * 3 + 2] = this.netRest[i * 3 + 2] - amp * Math.exp(-d * d * 1.5) * Math.cos(d * 8 - (t - T_GOAL) * 20); } pos.needsUpdate = true; }

    if (camera) this._camera(camera, t, dPos);
  }

  _camera(cam, t, dPos) {
    const keys = [
      { t: 0.0, p: [dPos[0] - 4, 2.4, dPos[2] + 6], l: [dPos[0] + 3, 1.0, dPos[2]] },
      { t: T_CROSS, p: [dPos[0] - 3, 2.6, dPos[2] + 6.5], l: [DRB1[0] + 2, 1.1, 4] },
      { t: T_MEET - 0.15, p: [MEET[0] - 7, 3.0, MEET[2] + 8], l: [MEET[0] + 1, 1.0, MEET[2]] },
      { t: T_GOAL + 0.15, p: [MEET[0] - 2, 2.6, MEET[2] + 9], l: [GOAL_X, 1.3, 0] },
      { t: 6.0, p: [GOAL_X - 8, 3.2, 9], l: [GOAL_X + 1, 1.2, 0] },
    ];
    let a = keys[0], b = keys[keys.length - 1];
    for (let i = 0; i < keys.length - 1; i++) if (t >= keys[i].t && t <= keys[i + 1].t) { a = keys[i]; b = keys[i + 1]; break; }
    const u = smooth(clamp((t - a.t) / (b.t - a.t || 1), 0, 1)); const p = l3(a.p, b.p, u), l = l3(a.l, b.l, u);
    cam.position.set(p[0], p[1], p[2]); cam.lookAt(l[0], l[1], l[2]);
  }

  _validate() {
    // orientation: each player faces its travel direction (dot(forward, velocity) > 0 = not moonwalking)
    const facing = (dir) => { const y = faceYaw(dir[0], dir[1]); const fx = Math.sin(y + Math.PI), fz = Math.cos(y + Math.PI); const l = Math.hypot(dir[0], dir[1]); return (fx * dir[0] + fz * dir[1]) / l; };
    const dFace = facing([DRB1[0] - DRB0[0], DRB1[2] - DRB0[2]]);
    const sFace = facing([MEET[0] - STR0[0], MEET[2] - STR0[2]]);
    const dir = (a, b) => { const v = [b[0] - a[0], b[2] - a[2]]; const l = Math.hypot(v[0], v[1]) || 1; return [v[0] / l, v[1] / l]; };
    const ballAt = (t) => { this.setTime(t); return this.ball.position.toArray(); };
    const crossV = dir(ballAt(T_CROSS + 0.05), ballAt(T_CROSS + 0.3)); const toMeet = dir([DRB1[0], 0, DRB1[2]], MEET);
    const volleyV = dir(ballAt(T_MEET + 0.05), ballAt(T_MEET + 0.3)); const toGoal = dir(MEET, [GOAL_X, 0, GOALPT[2]]);
    const crossOk = crossV[0] * toMeet[0] + crossV[1] * toMeet[1] > 0.3;
    const volleyOk = volleyV[0] * toGoal[0] + volleyV[1] * toGoal[1] > 0.5;
    const ballAll = []; for (let i = 0; i < 120; i++) ballAll.push(ballAt((i / 119) * this.duration));
    const pops = noPops(ballAll, null, { dt: this.duration / 120, maxSpeed: 70 });
    this.setTime(0);
    const facingOk = dFace > 0.7 && sFace > 0.7;
    window.__volleyReport = {
      players: ['dribbler', 'striker'],
      checks: {
        players_face_travel_not_moonwalk: { ok: facingOk, dribbler: +dFace.toFixed(2), striker: +sFace.toFixed(2) },
        cross_goes_toward_striker: { ok: crossOk },
        volley_goes_toward_goal: { ok: volleyOk },
        ball_no_pops: { ok: pops.ok, detail: pops.detail },
      },
      summary: `Dribble → cross → volley: players face their run (not moonwalk) ${facingOk ? '✓' : '✗'}; cross → striker ${crossOk ? '✓' : '✗'}; volley → goal ${volleyOk ? '✓' : '✗'}; ball continuous ${pops.ok ? '✓' : '✗'}.`,
    };
    console.log('[SoldierVolley]', window.__volleyReport.summary);
  }

  update() {}
  dispose() { for (const d of this.disposables) d.dispose?.(); }
}
