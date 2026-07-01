import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CharacterController } from '../engine/character-controller.js';

// Playable controls — drive the Soldier around the pitch: WASD/ZQSD/arrows or a gamepad left stick to
// run (camera-relative), the player turns to face where it moves (no moonwalk) and never foot-skates,
// dribbles the ball at its feet, Space shoots, Shift crosses low. Third-person follow camera.
// This is what the skill is for: correct, good-feeling controls built on the native CharacterController.
const GOAL_X = 26, GOAL_W = 7.3, GOAL_H = 2.44, R = 0.12, G = 16;

export class Controls {
  constructor(scene, renderer) {
    this.scene = scene; this.disposables = []; this.keys = new Set();
    this._buildPitch(); this._buildGoal(); this._buildBall();
    this.ball = { pos: new THREE.Vector3(2, R, 0), vel: new THREE.Vector3() };
    this.camPos = new THREE.Vector3(-6, 3, 0); this.score = 0; this._cool = 0;
    this._tmp = new THREE.Vector3(); this._fwd = new THREE.Vector3();
    this._onKey = (e) => { const d = e.type === 'keydown'; const k = e.key.toLowerCase();
      if (['arrowup','arrowdown','arrowleft','arrowright',' '].includes(k)) e.preventDefault();
      if (d) this.keys.add(k); else this.keys.delete(k); if (k === ' ' && d) this._wantShoot = true; if (k === 'shift') this._cross = d; };
    addEventListener('keydown', this._onKey); addEventListener('keyup', this._onKey);
    this.ready = this._load(renderer);
  }

  _buildPitch() {
    const geo = new THREE.PlaneGeometry(70, 46); geo.rotateX(-Math.PI / 2);
    const c = document.createElement('canvas'); c.width = 1024; c.height = 672; const g = c.getContext('2d');
    for (let i = 0; i < 16; i++) { g.fillStyle = i % 2 ? '#3f9a3f' : '#368636'; g.fillRect(i / 16 * 1024, 0, 64, 672); }
    g.strokeStyle = '#eaf3ea'; g.lineWidth = 4; g.strokeRect(24, 24, 976, 624); g.beginPath(); g.arc(512, 336, 90, 0, 7); g.stroke();
    g.beginPath(); g.moveTo(512, 24); g.lineTo(512, 648); g.stroke();
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshStandardNodeMaterial({ map: tex, roughness: 0.95 });
    const m = new THREE.Mesh(geo, mat); m.receiveShadow = true; this.scene.add(m); this.disposables.push(geo, mat, tex);
  }

  _buildGoal() {
    const white = new THREE.MeshStandardNodeMaterial({ color: 0xf4f6f8, roughness: 0.4 });
    const post = new THREE.CylinderGeometry(0.1, 0.1, GOAL_H, 12), bar = new THREE.CylinderGeometry(0.1, 0.1, GOAL_W, 12);
    const add = (geo, x, y, z, rx = 0) => { const mm = new THREE.Mesh(geo, white); mm.position.set(x, y, z); mm.rotation.x = rx; mm.castShadow = true; this.scene.add(mm); };
    add(post, GOAL_X, GOAL_H / 2, -GOAL_W / 2); add(post, GOAL_X, GOAL_H / 2, GOAL_W / 2); add(bar, GOAL_X, GOAL_H, 0, Math.PI / 2);
    const nc = document.createElement('canvas'); nc.width = nc.height = 128; const ng = nc.getContext('2d'); ng.strokeStyle = '#fff'; ng.lineWidth = 3;
    for (let i = 0; i <= 8; i++) { const p = i / 8 * 128; ng.beginPath(); ng.moveTo(p, 0); ng.lineTo(p, 128); ng.moveTo(0, p); ng.lineTo(128, p); ng.stroke(); }
    const ntex = new THREE.CanvasTexture(nc); ntex.wrapS = ntex.wrapT = THREE.RepeatWrapping; ntex.repeat.set(8, 3);
    const nmat = new THREE.MeshStandardNodeMaterial({ color: 0xffffff, alphaMap: ntex, transparent: true, side: THREE.DoubleSide, depthWrite: false, roughness: 1 });
    const back = new THREE.PlaneGeometry(GOAL_W, GOAL_H); const bk = new THREE.Mesh(back, nmat); bk.position.set(GOAL_X + 1.5, GOAL_H / 2, 0); this.scene.add(bk);
    this.disposables.push(post, bar, white, back, nmat, ntex);
  }

  _buildBall() {
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); g.fillStyle = '#f2f2f2'; g.fillRect(0, 0, 128, 128);
    g.fillStyle = '#141414'; for (let i = 0; i < 5; i++) { g.beginPath(); g.arc(30 + (i % 3) * 40, 30 + ((i / 3) | 0) * 60, 12, 0, 7); g.fill(); }
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const geo = new THREE.SphereGeometry(R, 24, 16); const mat = new THREE.MeshStandardNodeMaterial({ map: tex, roughness: 0.5 });
    this.ballMesh = new THREE.Mesh(geo, mat); this.ballMesh.castShadow = true; this.scene.add(this.ballMesh); this.disposables.push(geo, mat, tex);
  }

  async _load(renderer) {
    const gltf = await new GLTFLoader().loadAsync('Soldier.glb');
    const model = gltf.scene; model.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
    const box = new THREE.Box3().setFromObject(model); model.scale.setScalar(1.8 / box.getSize(new THREE.Vector3()).y);
    const b2 = new THREE.Box3().setFromObject(model); model.position.set(-4, -b2.min.y, 0);
    this.scene.add(model); this.model = model;
    const mixer = new THREE.AnimationMixer(model);
    const run = gltf.animations.find((a) => /run/i.test(a.name)), idle = gltf.animations.find((a) => /idle/i.test(a.name));
    const bone = (re) => { let f = null; model.traverse((o) => { if (o.isBone && re.test(o.name) && !f) f = o; }); return f; };
    const legs = [
      { up: bone(/LeftUpLeg/i), knee: bone(/LeftLeg$/i), foot: bone(/LeftFoot/i) },
      { up: bone(/RightUpLeg/i), knee: bone(/RightLeg$/i), foot: bone(/RightFoot/i) },
    ];
    this.ctrl = new CharacterController(model, { mixer, runClip: run, idleClip: idle, legs, stride: 2.6, runSpeed: 6, forwardLocal: new THREE.Vector3(0, 0, -1) });
    this.ctrl.faceInstant(1, 0); // face the goal to start
    return true;
  }

  camera(cam, controls) {
    this._cam = cam;
    if (controls) controls.enabled = false;                // we drive a third-person follow camera
    cam.position.set(-10, 4, 0); cam.lookAt(0, 1, 0);
  }

  _readInput(cam) {
    let ix = 0, iz = 0; const K = this.keys;
    if (K.has('w') || K.has('z') || K.has('arrowup')) iz += 1;
    if (K.has('s') || K.has('arrowdown')) iz -= 1;
    if (K.has('a') || K.has('q') || K.has('arrowleft')) ix -= 1;
    if (K.has('d') || K.has('arrowright')) ix += 1;
    const gp = navigator.getGamepads?.()[0];
    if (gp) { const dz = (v) => Math.abs(v) < 0.18 ? 0 : v; ix += dz(gp.axes[0]); iz -= dz(gp.axes[1]); if (gp.buttons[0]?.pressed) this._wantShoot = true; this._cross = !!gp.buttons[2]?.pressed; }
    // camera-relative: forward = camera→player on the ground, right = perpendicular
    const f = this._fwd.copy(this.ctrl.pos).sub(cam.position); f.y = 0; if (f.lengthSq() < 1e-4) f.set(1, 0, 0); f.normalize();
    const rx = -f.z, rz = f.x;
    let mx = f.x * iz + rx * ix, mz = f.z * iz + rz * ix;
    const l = Math.hypot(mx, mz); if (l > 1) { mx /= l; mz /= l; }
    return [mx, mz, l];
  }

  update(dt) {
    const cam = this._cam; if (!this.ctrl || !cam) { this._integrateBall(dt); this._draw(); return; }
    const [mx, mz] = this._readInput(cam);
    this.ctrl.setMoveWorld(mx, mz);
    this.ctrl.update(dt);

    // ball: dribble when the player is on it, shoot on demand
    const p = this.ctrl.pos, fwd = this.ctrl.forward(this._fwd);
    const toBall = this._tmp.copy(this.ball.pos).setY(0).sub(this._tmp2().copy(p).setY(0));
    const d = toBall.length(); this._cool = Math.max(0, this._cool - dt);
    if (this._wantShoot && d < 1.6 && this._cool === 0) {
      const power = this._cross ? 9 : 15, lift = this._cross ? 3.2 : 5.5;
      this.ball.vel.set(fwd.x * power, lift, fwd.z * power); this._cool = 0.4;
    } else if (d < 0.75 && this.ctrl.speed > 0.6) {
      const s = this.ctrl.speed + 1.6; this.ball.vel.set(fwd.x * s, this.ball.vel.y, fwd.z * s); // knock it ahead → dribble
    }
    this._wantShoot = false;
    this._integrateBall(dt);
    this._follow(cam, dt);
    this._draw();
  }
  _tmp2() { return (this.__t2 ||= new THREE.Vector3()); }

  _integrateBall(dt) {
    const b = this.ball; b.vel.y -= 18 * dt;
    b.pos.addScaledVector(b.vel, dt);
    if (b.pos.y < R) { b.pos.y = R; b.vel.y = Math.abs(b.vel.y) * 0.45; const f = Math.exp(-2.2 * dt); b.vel.x *= f; b.vel.z *= f; }
    b.pos.x = THREE.MathUtils.clamp(b.pos.x, -33, GOAL_X + 2.5); b.pos.z = THREE.MathUtils.clamp(b.pos.z, -22, 22);
    // goal!
    if (b.pos.x > GOAL_X - 0.1 && Math.abs(b.pos.z) < GOAL_W / 2 && b.pos.y < GOAL_H && this._cool2 !== 1) {
      this.score++; this._flash(); this._cool2 = 1; setTimeout(() => { b.pos.set(2, R, 0); b.vel.set(0, 0, 0); this._cool2 = 0; }, 250);
    }
  }

  _follow(cam, dt) {
    const p = this.ctrl.pos, fwd = this.ctrl.forward(this._fwd);
    const want = this._tmp.set(p.x - fwd.x * 6.5, 3.2, p.z - fwd.z * 6.5);
    const k = 1 - Math.exp(-6 * dt); this.camPos.lerp(want, k);
    cam.position.copy(this.camPos); cam.lookAt(p.x + fwd.x * 2, 1.2, p.z + fwd.z * 2);
  }

  _draw() {
    this.ballMesh.position.copy(this.ball.pos);
    this.ballMesh.rotation.x += this.ball.vel.z * 0.02; this.ballMesh.rotation.z -= this.ball.vel.x * 0.02;
    const el = document.getElementById('score'); if (el && el.__n !== this.score) { el.__n = this.score; el.textContent = `⚽ ${this.score}`; }
  }

  _flash() { const el = document.getElementById('goal-flash'); if (el) { el.style.opacity = '1'; setTimeout(() => (el.style.opacity = '0'), 500); } }

  dispose() { removeEventListener('keydown', this._onKey); removeEventListener('keyup', this._onKey); for (const d of this.disposables) d.dispose?.(); }
}
