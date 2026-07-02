import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as skeletonClone } from 'three/addons/utils/SkeletonUtils.js';
import { CharacterController } from '../engine/character-controller.js';
import { ThirdPersonCamera } from '../engine/third-person-camera.js';
import { Input } from '../engine/input.js';
import { WORLD } from '../engine/world-basis.js';
import { Physics } from '../engine/physics.js';
import { pursue, seek, toMoveInput } from '../engine/steering.js';

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
    this.ballBody = this.phys.addDynamicBall([0, R, 0], R, { density: 22, restitution: 0.55 }); // ~football mass, centre
    this.dyn.push({ mesh: ballMesh, body: this.ballBody });

    // player + AI opponent (cloned rig, red tint) — both are physics-collided capsule characters
    const gltf = await new GLTFLoader().loadAsync('Soldier.glb');
    const player = this._makeCharacter(gltf.scene, gltf.animations, [-8, 0, 0]);
    this.ctrl = player.ctrl; this.model = player.model; this.ctrl.faceInstant(1, 0);
    const opp = this._makeCharacter(skeletonClone(gltf.scene), gltf.animations, [8, 0, 0], 0xd23b3b);
    this.aiCtrl = opp.ctrl; this.aiCtrl.runSpeed = 5.0; this.aiCtrl.faceInstant(-1, 0);
    return true;
  }

  // build a physics-collided capsule character; optional `tint` recolours the rig (the AI opponent)
  _makeCharacter(model, anims, start, tint) {
    model.traverse((o) => {
      if (!o.isMesh) return; o.castShadow = true; o.frustumCulled = false;
      if (tint) { o.material = o.material.clone(); o.material.color = o.material.color.clone().lerp(new THREE.Color(tint), 0.55); this.disposables.push(o.material); }
    });
    const box = new THREE.Box3().setFromObject(model); model.scale.setScalar(1.8 / box.getSize(new THREE.Vector3()).y);
    const b2 = new THREE.Box3().setFromObject(model); model.position.set(start[0], -b2.min.y, start[2]); this.scene.add(model);
    const mixer = new THREE.AnimationMixer(model);
    const run = anims.find((a) => /run/i.test(a.name)), idle = anims.find((a) => /idle/i.test(a.name));
    const bone = (re) => { let f = null; model.traverse((o) => { if (o.isBone && re.test(o.name) && !f) f = o; }); return f; };
    const legs = [
      { up: bone(/LeftUpLeg/i), knee: bone(/LeftLeg$/i), foot: bone(/LeftFoot/i) },
      { up: bone(/RightUpLeg/i), knee: bone(/RightLeg$/i), foot: bone(/RightFoot/i) },
    ];
    const char = this.phys.addCharacter(start, { radius: 0.32, height: 1.8 });
    const ctrl = new CharacterController(model, { mixer, runClip: run, idleClip: idle, legs, stride: 2.6, runSpeed: 5.5, forwardLocal: new THREE.Vector3(0, 0, -1) });
    ctrl.collide = (dx, dy, dz) => char.move(dx, dy, dz);
    return { model, ctrl, char };
  }

  // opponent AI: chase the ball (intercept its predicted position); when on it, shield/boot it away from the player
  _ai(dt) {
    const ai = this.aiCtrl, p = this.ctrl, b = this.ballBody.translation(), bv = this.ballBody.linvel();
    const aiPos = [ai.pos.x, ai.pos.z], ball = [b.x, b.z], player = [p.pos.x, p.pos.z];
    const dBall = Math.hypot(ball[0] - aiPos[0], ball[1] - aiPos[1]);
    let vel;
    if (dBall > 1.0) { vel = pursue(aiPos, ball, [bv.x, bv.z], ai.runSpeed, 0.35); }        // intercept
    else {                                                                                  // has it → clear away from player
      const away = [ball[0] - player[0], ball[1] - player[1]]; const l = Math.hypot(away[0], away[1]) || 1; away[0] /= l; away[1] /= l;
      vel = seek(aiPos, [ball[0] + away[0] * 2.5, ball[1] + away[1] * 2.5], ai.runSpeed);
      this._kickCd = (this._kickCd || 0) - dt;
      if (this._kickCd <= 0) { this.ballBody.setLinvel({ x: away[0] * 9, y: 3, z: away[1] * 9 }, true); this._kickCd = 1.4; }
    }
    const [mx, mz] = toMoveInput(vel, ai.runSpeed);
    ai.setMoveWorld(mx, mz); ai.update(dt);
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
    if (this.aiCtrl) this._ai(dt);        // opponent contests the ball (queues its kinematic move too)

    this.phys.step();
    for (const { body, mesh } of this.dyn) this.phys.sync(body, mesh);
    this.tpc.update(this._tmp.set(p.x, p.y, p.z), dt);
  }

  dispose() { this.input?.dispose(); for (const d of this.disposables) d.dispose?.(); }
}
