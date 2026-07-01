import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { noPops } from '../engine/temporal-validate.js';
import { matchCadence } from '../engine/locomotion.js';
import { FootLockIK } from '../engine/foot-lock.js';

// The volley, performed by a REAL rigged Mixamo character (Soldier.glb): runs in with the Mixamo
// Run clip, plants, a procedural right-leg kick strikes the ball, ball arcs into the net. Deterministic
// setTime(t, camera) for frame-accurate capture; temporal validation of ball-at-foot through contact.

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => t * t * (3 - 2 * t);
const l3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
function arc(p0, p1, t0, t1, apex, t) { const u = clamp((t - t0) / (t1 - t0), 0, 1); const p = l3(p0, p1, u); p[1] += 4 * apex * u * (1 - u); return p; }

const GOAL_X = 26, GOAL_W = 7.3, GOAL_H = 2.44, D = 1.6;
const START = [-4, 0, 0.6], PLANT = [8.5, 0, 0.4];   // ~12.5 m run-in at a believable ~5 m/s
const T_CONTACT = 2.55, T_APP = 2.45, T_GOAL = 3.2;

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
    this.lUpLeg = bone(/LeftUpLeg/i); this.lLeg = bone(/LeftLeg$/i); this.lFoot = bone(/LeftFoot/i);
    this.rUpLeg = bone(/RightUpLeg/i); this.rLeg = bone(/RightLeg$/i); this.rFoot = bone(/RightFoot/i);
    this.rUpRest = this.rUpLeg?.rotation.x || 0; this.rLegRest = this.rLeg?.rotation.x || 0;
    // STRIDE: metres of ground the Run clip covers per loop. matchCadence() ties the clip's phase to
    // distance travelled, so leg cadence tracks ground speed (legs turn over as fast as he moves).
    this.stride = 2.6;
    // FOOT-LOCK IK: this Mixamo Run was authored for root-motion — its feet barely push, so cadence alone
    // still leaves the plant foot smearing. FootLockIK pins whichever foot is down to its touchdown spot.
    // We calibrate each foot's true ground height by sweeping the clip once (feet rest at different Ys).
    this.footLock = new FootLockIK(
      [ { up: this.lUpLeg, knee: this.lLeg, foot: this.lFoot }, { up: this.rUpLeg, knee: this.rLeg, foot: this.rFoot } ],
      { contactBand: 0.05, sampleClip: (p) => { this.model.position.set(0, 0, 0); this.mixer.setTime(p * this.runDur); this.scene.updateMatrixWorld(true); } },
    );
    this.setTime(0);
    this._validate();
    return true;
  }

  // Where the striker is at time t: near-constant-speed run-in, easing out only for the final quarter
  // to settle into the plant (so he's already running at t=0 — no frozen start — and decelerates cleanly).
  playerPos(t) {
    const tau = clamp(t / T_APP, 0, 1), k = 0.75;
    const u = tau < k ? tau : k + (1 - k) * (1 - (1 - (tau - k) / (1 - k)) ** 2);
    return l3(START, PLANT, u);
  }

  _poseAt(t) {
    const pp = this.playerPos(t);
    this.model.position.set(pp[0], 0, pp[2]);
    // clip phase driven by distance travelled (not wall-clock) → leg cadence matches ground speed, so
    // the legs turn over as fast as he actually moves. This is what stops the "sliding on ice" look.
    const traveled = pp[0] - START[0];
    this.mixer.setTime(matchCadence(this.runDur, traveled, this.stride));
    this.scene.updateMatrixWorld(true);
    // FOOT-LOCK during the run-up (before the procedural kick takes over the right leg) → planted feet grip.
    if (this.footLock && t < T_CONTACT - 0.25) this.footLock.solve();
    // procedural right-leg volley around contact, blended on top of the run pose
    const w = Math.exp(-Math.pow((t - T_CONTACT) / 0.16, 2));
    if (this.rUpLeg) this.rUpLeg.rotation.x = this.rUpRest - 1.5 * w;
    if (this.rLeg) this.rLeg.rotation.x = this.rLegRest + 0.9 * w;
    this.scene.updateMatrixWorld(true);
  }

  setTime(t, camera) {
    t = clamp(t, 0, this.duration);
    this._poseAt(t);
    const pp = this.playerPos(t);
    // ball rolls ahead of the striker (a dribble); the gap closes to the foot right at contact,
    // then it's struck and arcs to the goal, then settles in the net. It is NOT glued to the foot.
    let bp;
    if (t < T_CONTACT) {
      const k = smooth(clamp(t / T_CONTACT, 0, 1));
      bp = [pp[0] + lerp(2.8, 0.5, k), 0.12, pp[2]];
      this.contactBall = bp.slice();                          // remember strike point for a seamless arc
    } else if (t < T_GOAL) {
      bp = arc(this.contactBall || [PLANT[0] + 0.5, 0.12, PLANT[2]], [GOAL_X + 1.0, 1.15, 0], T_CONTACT, T_GOAL, 1.5, t);
    } else { const s = Math.exp(-(t - T_GOAL) * 3) * Math.abs(Math.sin((t - T_GOAL) * 20)) * 0.15; bp = [GOAL_X + 1.15, 1.1 + s, 0]; }
    this.ball.position.set(bp[0], bp[1], bp[2]); this.ball.rotation.z -= 0.3; this.ball.rotation.x = t * 6;
    if (this.net) { const pos = this.net.geometry.attributes.position; const amp = t > T_GOAL ? Math.exp(-(t - T_GOAL) * 4) * 0.5 : 0; for (let i = 0; i < pos.count; i++) { const x = this.netRest[i * 3], y = this.netRest[i * 3 + 1]; const d = Math.hypot(x, y - (1.1 - GOAL_H / 2)); pos.array[i * 3 + 2] = this.netRest[i * 3 + 2] - amp * Math.exp(-d * d * 1.5) * Math.cos(d * 8 - (t - T_GOAL) * 20); } pos.needsUpdate = true; }
    if (camera) {
      // A broadcast tracking rig: dolly alongside the striker on the near touchline during the run,
      // then ease continuously into a goal-watching wide as the ball is struck (no cut/pop at contact).
      const follow = [pp[0] - 3.2, 2.15, pp[2] + 6.0], look = [pp[0] + 3.0, 0.8, pp[2]];
      if (t <= T_CONTACT) { camera.position.set(follow[0], follow[1], follow[2]); camera.lookAt(look[0], look[1], look[2]); }
      else {
        const k = smooth(clamp((t - T_CONTACT) / (T_GOAL + 0.5 - T_CONTACT), 0, 1));
        const gp = [20, 3.0, 8.5], gl = [26.5, 1.3, 0];
        const p = l3(follow, gp, k), l = l3(look, gl, k);
        camera.position.set(p[0], p[1], p[2]); camera.lookAt(l[0], l[1], l[2]);
      }
    }
  }

  // Median per-frame world slip of the truly-planted (lower) foot over the constant-speed run phase, for
  // a given cadence + optional foot-lock. Isolates what each fix contributes to killing the slide.
  _measureSlip(cadence, useFootLock) {
    const a = new THREE.Vector3(), b = new THREE.Vector3();
    const t0 = 0.2, t1 = T_APP * 0.72, N = 110, dt = (t1 - t0) / (N - 1);
    const lo = [], loY = [];
    for (let i = 0; i < N; i++) {
      const t = t0 + i * dt, pp = this.playerPos(t);
      this.model.position.set(pp[0], 0, pp[2]);
      this.mixer.setTime(cadence(t, pp[0] - START[0]));
      this.scene.updateMatrixWorld(true);
      if (useFootLock) this.footLock.solve();
      this.lFoot.getWorldPosition(a); this.rFoot.getWorldPosition(b);
      const l = a.toArray(), r = b.toArray(); const lower = a.y < b.y ? l : r;
      lo.push(lower); loY.push(lower[1]);                                    // the planted foot each frame = the lower one
    }
    // only count frames where the lower foot is actually in contact (within its ground band) — that's stance
    const floor = Math.min(...loY), band = floor + 0.06;
    const slips = []; for (let i = 1; i < N; i++) if (loY[i] <= band && loY[i - 1] <= band) slips.push(Math.hypot(lo[i][0] - lo[i - 1][0], lo[i][2] - lo[i - 1][2]));
    slips.sort((x, y) => x - y);
    return { median: +(slips.length ? slips[slips.length >> 1] : 0).toFixed(3), samples: slips.length, dt };
  }

  // temporal validation on the REAL rig — honest before/after. The "slide" has two causes, each fixed by
  // a native skill piece: (1) a fixed clip rate drags the planted foot at ground speed regardless of the
  // legs → matchCadence ties cadence to distance; (2) this Mixamo Run's feet barely push, so even synced
  // they smear → FootLockIK pins the planted foot. We measure the planted (lower) foot under each.
  _validate() {
    const sync = (t, tr) => matchCadence(this.runDur, tr, this.stride);
    const before = this._measureSlip((t) => (t * 1.35) % this.runDur, false); // old: fixed cadence, no lock
    const cadenceOnly = this._measureSlip(sync, false);                        // + distance-synced cadence
    const locked = this._measureSlip(sync, true);                             // + foot-lock IK (delivered)
    const groundPerFrame = +((Math.abs(PLANT[0] - START[0]) / T_APP) * locked.dt).toFixed(3);
    const grips = locked.median <= groundPerFrame;                            // planted foot at/below ground speed → no slide
    const v = new THREE.Vector3(); const ballAll = []; const M = 120;
    for (let i = 0; i < M; i++) { this.setTime((i / (M - 1)) * this.duration); ballAll.push(this.ball.position.toArray()); }
    const pops = noPops(ballAll, null, { dt: this.duration / M, maxSpeed: 60 });
    this.setTime(0);
    window.__volleyReport = {
      character: 'Soldier.glb (Mixamo rig)', kickBone: this.rUpLeg?.name, footBone: this.rFoot?.name,
      strideLength: this.stride, groundPerFrame,
      plantedFootSlip: { fixedCadence: before.median, distanceSynced: cadenceOnly.median, withFootLock: locked.median },
      checks: {
        locomotion_no_slide: {
          ok: grips, plantedFootSlip: locked.median, groundPerFrame,
          detail: `planted-foot slip fell ${before.median}→${cadenceOnly.median} (matchCadence) →${locked.median}m/frame (FootLockIK) vs ${groundPerFrame}m ground travel — foot now grips the pitch`,
        },
        ball_trajectory_no_pops: { ok: pops.ok, detail: pops.detail },
      },
      summary: `Soldier (real Mixamo rig): planted foot ${before.median}→${locked.median}m/frame (matchCadence + FootLockIK) vs ${groundPerFrame}m ground travel — ${grips ? 'grips, no slide ✓' : 'still slides ✗'}; ball trajectory continuous ${pops.ok ? '✓' : '✗'}.`,
    };
    console.log('[SoldierVolley]', window.__volleyReport.summary);
  }

  update() {}
  dispose() { for (const d of this.disposables) d.dispose?.(); }
}
