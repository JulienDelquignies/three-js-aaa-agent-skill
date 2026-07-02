import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CharacterController } from '../engine/character-controller.js';
import { ThirdPersonCamera } from '../engine/third-person-camera.js';
import { Input } from '../engine/input.js';
import { WORLD } from '../engine/world-basis.js';
import { buildGoal } from './goal.js';

// Playable controls — the point of the skill. Drive the Soldier with the native Input (keyboard / gamepad
// / touch joystick) + a steerable ThirdPersonCamera: run (camera-relative), LOOK around (mouse/right-stick/
// touch), ZOOM (wheel/pinch), SPRINT (Shift/RB), JUMP (J/B), dribble the ball, shoot along facing (Space/A),
// cross low (E/X). The player faces where it moves (no moonwalk) and never foot-skates. Scores in the net.
const GOAL_X = 26, GOAL_W = 7.3, GOAL_H = 2.44, R = 0.12;

export class Controls {
  constructor(scene, renderer) {
    this.scene = scene; this.disposables = [];
    this._buildPitch(); this._buildGoal(); this._buildBall();
    this.ball = { pos: new THREE.Vector3(2, R, 0), vel: new THREE.Vector3() };
    this._cool = 0; this._fwd = new THREE.Vector3(); this._tmp = new THREE.Vector3();
    this.input = new Input(document.body);
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

  _buildGoal() { this.goal = buildGoal(this.scene, { X: GOAL_X, W: GOAL_W, H: GOAL_H, D: 1.6 }); this.disposables.push(this.goal); this._ripple = 0; }

  _buildBall() {
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); g.fillStyle = '#f2f2f2'; g.fillRect(0, 0, 128, 128);
    g.fillStyle = '#141414'; for (let i = 0; i < 5; i++) { g.beginPath(); g.arc(30 + (i % 3) * 40, 30 + ((i / 3) | 0) * 60, 12, 0, 7); g.fill(); }
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const geo = new THREE.SphereGeometry(R, 24, 16); const mat = new THREE.MeshStandardNodeMaterial({ map: tex, roughness: 0.5 });
    this.ballMesh = new THREE.Mesh(geo, mat); this.ballMesh.castShadow = true; this.scene.add(this.ballMesh); this.disposables.push(geo, mat, tex);
  }

  async _load() {
    const gltf = await new GLTFLoader().loadAsync('Soldier.glb');
    const model = gltf.scene; model.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
    const box = new THREE.Box3().setFromObject(model); model.scale.setScalar(1.8 / box.getSize(new THREE.Vector3()).y);
    const b2 = new THREE.Box3().setFromObject(model); model.position.set(-4, -b2.min.y, 0);
    this.scene.add(model); this.model = model;
    const mixer = new THREE.AnimationMixer(model);
    const run = gltf.animations.find((a) => /run/i.test(a.name)), idle = gltf.animations.find((a) => /idle/i.test(a.name)), walk = gltf.animations.find((a) => /walk/i.test(a.name));
    const bone = (re) => { let f = null; model.traverse((o) => { if (o.isBone && re.test(o.name) && !f) f = o; }); return f; };
    const legs = [
      { up: bone(/LeftUpLeg/i), knee: bone(/LeftLeg$/i), foot: bone(/LeftFoot/i) },
      { up: bone(/RightUpLeg/i), knee: bone(/RightLeg$/i), foot: bone(/RightFoot/i) },
    ];
    this.ctrl = new CharacterController(model, { mixer, runClip: run, idleClip: idle, walkClip: walk, legs, stride: 2.6, runSpeed: 6, forwardLocal: new THREE.Vector3(0, 0, -1) });
    this.ctrl.faceInstant(1, 0); // face the goal to start
    return true;
  }

  camera(cam, controls) {
    if (controls) controls.enabled = false;
    this.tpc = new ThirdPersonCamera(cam, { distance: 7, height: 1.4, lookHeight: 1.2 });
    this.tpc.yaw = Math.PI / 2;            // look toward +X (the goal)
    cam.position.set(-10, 4, 0); cam.lookAt(0, 1, 0);
  }

  update(dt) {
    if (!this.ctrl || !this.tpc) { this._integrateBall(dt); this._draw(); return; }
    this.input.update();
    const look = this.input.consumeLook(); const z = this.input.consumeZoom();
    if (z) this.tpc.zoom(z);
    if (Math.abs(look.dx) > 1e-4 || Math.abs(look.dy) > 1e-4) this.tpc.orbit(look.dx, look.dy);

    // camera-relative move, resolved through the WorldBasis (single source of truth)
    const mv = this.input.move();
    const [wx, wz] = WORLD.moveFromInput(mv.x, mv.z, this.tpc.yaw);
    this.ctrl.setMoveWorld(wx, wz);
    this.ctrl.setSprint(this.input.down('sprint'));
    if (this.input.pressed('jump')) this.ctrl.jump();
    this.ctrl.update(dt);

    // gently swing the camera behind the player when moving and not manually looking
    const pf = this.ctrl.forward(this._fwd);
    if (Math.abs(look.dx) < 1e-4 && Math.hypot(wx, wz) > 0.05) {
      const d = WORLD.shortestTurn(this.tpc.yaw, WORLD.heading(pf.x, pf.z));
      this.tpc.yaw += d * (1 - Math.exp(-2.2 * dt));
    }

    // ball: shoot / cross / dribble
    const p = this.ctrl.pos; const d = Math.hypot(this.ball.pos.x - p.x, this.ball.pos.z - p.z);
    this._cool = Math.max(0, this._cool - dt);
    if (this.input.pressed('shoot') && d < 1.8 && this._cool === 0) { this.ball.vel.set(pf.x * 15, 5.5, pf.z * 15); this._cool = 0.35; }
    else if (this.input.pressed('cross') && d < 1.8 && this._cool === 0) { this.ball.vel.set(pf.x * 9, 3.4, pf.z * 9); this._cool = 0.35; }
    else if (d < 0.75 && this.ctrl.speed > 0.6) { const s = this.ctrl.speed + 1.6; this.ball.vel.set(pf.x * s, this.ball.vel.y, pf.z * s); }
    this.input.endFrame();

    this._integrateBall(dt);
    this.tpc.update(this._tmp.set(p.x, p.y, p.z), dt);
    this._draw();
  }

  _integrateBall(dt) {
    const b = this.ball; b.vel.y -= 18 * dt;
    b.pos.addScaledVector(b.vel, dt);
    if (b.pos.y < R) { b.pos.y = R; b.vel.y = Math.abs(b.vel.y) * 0.45; const f = Math.exp(-2.2 * dt); b.vel.x *= f; b.vel.z *= f; }
    b.pos.x = THREE.MathUtils.clamp(b.pos.x, -33, GOAL_X + 2.4); b.pos.z = THREE.MathUtils.clamp(b.pos.z, -22, 22);
    if (b.pos.x > GOAL_X - 0.1 && Math.abs(b.pos.z) < GOAL_W / 2 && b.pos.y < GOAL_H && this._cool2 !== 1) {
      this.score = (this.score || 0) + 1; this._flash(); this._cool2 = 1; this._ripple = 0.5; this._rz = b.pos.z; this._ry = b.pos.y;
      setTimeout(() => { b.pos.set(2, R, 0); b.vel.set(0, 0, 0); this._cool2 = 0; }, 250);
    }
  }

  _draw() {
    this.ballMesh.position.copy(this.ball.pos);
    this.ballMesh.rotation.x += this.ball.vel.z * 0.02; this.ballMesh.rotation.z -= this.ball.vel.x * 0.02;
    if (this._ripple > 0.002) { this._ripple *= 0.9; this.goal.setRipple(this._ripple, this._rz || 0, this._ry || 1.1); }
    else if (this._ripple) { this._ripple = 0; this.goal.setRipple(0); }
    const el = document.getElementById('score'); if (el && el.__n !== this.score) { el.__n = this.score || 0; el.textContent = `⚽ ${this.score || 0}`; }
  }

  _flash() { const el = document.getElementById('goal-flash'); if (el) { el.style.opacity = '1'; setTimeout(() => (el.style.opacity = '0'), 500); } }

  dispose() { this.input?.dispose(); for (const d of this.disposables) d.dispose?.(); }
}
