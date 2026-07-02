import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CharacterController } from '../engine/character-controller.js';
import { ThirdPersonCamera } from '../engine/third-person-camera.js';
import { Input } from '../engine/input.js';
import { WORLD } from '../engine/world-basis.js';
import { Physics } from '../engine/physics.js';

// Physics playground (roadmap #2) — real Rapier collisions. Drive the Soldier: he can't walk through the
// walls/crates, climbs the ramp and steps, PUSHES the crates around, and kicks the ball (dynamic rigid
// body). Collision resolution lives in engine/physics.js; facing/animation/cadence stay in the
// CharacterController via its `collide` hook. Keyboard / gamepad / touch, steerable third-person camera.
const R = 0.16;

export class PhysicsScene {
  constructor(scene, renderer) {
    this.scene = scene; this.disposables = []; this.dyn = [];   // {body, mesh}
    this._fwd = new THREE.Vector3(); this._tmp = new THREE.Vector3();
    this._buildFloor();
    this.input = new Input(document.body);
    this.ready = this._load();
  }

  _buildFloor() {
    const geo = new THREE.PlaneGeometry(70, 50); geo.rotateX(-Math.PI / 2);
    const c = document.createElement('canvas'); c.width = 512; c.height = 512; const g = c.getContext('2d');
    g.fillStyle = '#3a4150'; g.fillRect(0, 0, 512, 512); g.strokeStyle = '#4a5364'; g.lineWidth = 2;
    for (let i = 0; i <= 512; i += 32) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 512); g.moveTo(0, i); g.lineTo(512, i); g.stroke(); }
    const tex = new THREE.CanvasTexture(c); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(12, 9); tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshStandardNodeMaterial({ map: tex, roughness: 0.9, metalness: 0.05 });
    const m = new THREE.Mesh(geo, mat); m.receiveShadow = true; this.scene.add(m); this.disposables.push(geo, mat, tex);
  }

  _box(pos, half, color, physFn) {
    const geo = new THREE.BoxGeometry(half[0] * 2, half[1] * 2, half[2] * 2);
    const mat = new THREE.MeshStandardNodeMaterial({ color, roughness: 0.7, metalness: 0.1 });
    const mesh = new THREE.Mesh(geo, mat); mesh.castShadow = true; mesh.receiveShadow = true; mesh.position.set(pos[0], pos[1], pos[2]);
    this.scene.add(mesh); this.disposables.push(geo, mat);
    return { mesh, body: physFn() };
  }

  async _load() {
    this.phys = await Physics.create({ gravity: [0, -20, 0] });
    this.phys.addGround(35, 25, 0);

    // arena walls (static) — the player can't pass
    const wallC = 0x2b3242, H = 1.2;
    const walls = [[[0, H, -12.5], [18, H, 0.4]], [[0, H, 12.5], [18, H, 0.4]], [[-18, H, 0], [0.4, H, 12.5]], [[18, H, 0], [0.4, H, 12.5]]];
    for (const [p, h] of walls) this._box(p, h, wallC, () => this.phys.addStaticBox(p, h));

    // a ramp + two steps (static) to climb
    const q = [0, 0, Math.sin(-0.16 / 2), Math.cos(-0.16 / 2)];   // tilt about Z
    this._box([-9, 0.5, 6], [3, 0.25, 2.2], 0x555f72, () => this.phys.addStaticBox([-9, 0.5, 6], [3, 0.25, 2.2], q));
    this._box([6, 0.2, -7], [2.4, 0.2, 2.4], 0x555f72, () => this.phys.addStaticBox([6, 0.2, -7], [2.4, 0.2, 2.4]));
    this._box([8.4, 0.45, -7], [1.6, 0.45, 1.6], 0x4c5468, () => this.phys.addStaticBox([8.4, 0.45, -7], [1.6, 0.45, 1.6]));

    // dynamic crates (pushable)
    const crates = [[-2, 0.4, 2], [-2.9, 0.4, 3], [-1.1, 0.4, 3], [-2, 1.2, 2.5], [4, 0.4, 3], [4.9, 0.4, 3.6], [-6, 0.4, -3]];
    for (const p of crates) this.dyn.push(this._box(p, [0.4, 0.4, 0.4], 0xb07a3c, () => this.phys.addDynamicBox(p, [0.4, 0.4, 0.4])));

    // the ball (dynamic)
    const bgeo = new THREE.SphereGeometry(R, 24, 16);
    const bc = document.createElement('canvas'); bc.width = bc.height = 64; const bg = bc.getContext('2d'); bg.fillStyle = '#f2f2f2'; bg.fillRect(0, 0, 64, 64); bg.fillStyle = '#141414'; for (let i = 0; i < 4; i++) { bg.beginPath(); bg.arc(16 + (i % 2) * 32, 16 + ((i / 2) | 0) * 32, 7, 0, 7); bg.fill(); }
    const btex = new THREE.CanvasTexture(bc); btex.colorSpace = THREE.SRGBColorSpace;
    const bmat = new THREE.MeshStandardNodeMaterial({ map: btex, roughness: 0.5 });
    const ballMesh = new THREE.Mesh(bgeo, bmat); ballMesh.castShadow = true; this.scene.add(ballMesh); this.disposables.push(bgeo, bmat, btex);
    this.ballBody = this.phys.addDynamicBall([2, R, 1], R, { density: 22, restitution: 0.55 }); // ~football mass
    this.dyn.push({ mesh: ballMesh, body: this.ballBody });

    // character
    const gltf = await new GLTFLoader().loadAsync('Soldier.glb');
    const model = gltf.scene; model.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
    const box = new THREE.Box3().setFromObject(model); model.scale.setScalar(1.8 / box.getSize(new THREE.Vector3()).y);
    const b2 = new THREE.Box3().setFromObject(model); const START = [-8, 0, 0];
    model.position.set(START[0], -b2.min.y, START[2]); this.scene.add(model); this.model = model;
    const mixer = new THREE.AnimationMixer(model);
    const run = gltf.animations.find((a) => /run/i.test(a.name)), idle = gltf.animations.find((a) => /idle/i.test(a.name));
    const bone = (re) => { let f = null; model.traverse((o) => { if (o.isBone && re.test(o.name) && !f) f = o; }); return f; };
    const legs = [
      { up: bone(/LeftUpLeg/i), knee: bone(/LeftLeg$/i), foot: bone(/LeftFoot/i) },
      { up: bone(/RightUpLeg/i), knee: bone(/RightLeg$/i), foot: bone(/RightFoot/i) },
    ];
    this.char = this.phys.addCharacter(START, { radius: 0.32, height: 1.8 });
    this.ctrl = new CharacterController(model, { mixer, runClip: run, idleClip: idle, legs, stride: 2.6, runSpeed: 5.5, forwardLocal: new THREE.Vector3(0, 0, -1) });
    this.ctrl.collide = (dx, dy, dz) => this.char.move(dx, dy, dz);
    this.ctrl.faceInstant(1, 0);
    return true;
  }

  camera(cam, controls) {
    if (controls) controls.enabled = false;
    this.tpc = new ThirdPersonCamera(cam, { distance: 8, height: 1.6, lookHeight: 1.2 });
    this.tpc.yaw = Math.PI / 2;
    cam.position.set(-14, 5, 0); cam.lookAt(-6, 1, 0);
  }

  update(dt) {
    if (!this.ctrl || !this.tpc) return;
    dt = Math.min(dt, 1 / 30);
    this.input.update();
    const look = this.input.consumeLook(), z = this.input.consumeZoom();
    if (z) this.tpc.zoom(z);
    if (Math.abs(look.dx) > 1e-4 || Math.abs(look.dy) > 1e-4) this.tpc.orbit(look.dx, look.dy);

    const mv = this.input.move();
    const [wx, wz] = WORLD.moveFromInput(mv.x, mv.z, this.tpc.yaw);
    this.ctrl.setMoveWorld(wx, wz);
    this.ctrl.setSprint(this.input.down('sprint'));
    if (this.input.pressed('jump')) this.ctrl.jump();
    this.ctrl.update(dt);                 // resolves movement through Rapier via collide

    // kick the ball if it's near the feet
    const pf = this.ctrl.forward(this._fwd); const p = this.ctrl.pos; const bt = this.ballBody.translation();
    const near = Math.hypot(bt.x - p.x, bt.z - p.z) < 1.1;
    // kick = set a predictable launch velocity (mass-independent), so it doesn't depend on ball density
    if (near && this.input.pressed('shoot')) this.ballBody.setLinvel({ x: pf.x * 12, y: 4.5, z: pf.z * 12 }, true);
    else if (near && this.input.pressed('cross')) this.ballBody.setLinvel({ x: pf.x * 7, y: 2.6, z: pf.z * 7 }, true);
    this.input.endFrame();

    this.phys.step();
    for (const { body, mesh } of this.dyn) this.phys.sync(body, mesh);
    this.tpc.update(this._tmp.set(p.x, p.y, p.z), dt);
  }

  dispose() { this.input?.dispose(); for (const d of this.disposables) d.dispose?.(); }
}
