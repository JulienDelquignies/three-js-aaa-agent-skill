import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CharacterController } from '../engine/character-controller.js';
import { ThirdPersonCamera } from '../engine/third-person-camera.js';
import { Input } from '../engine/input.js';
import { WORLD } from '../engine/world-basis.js';
import { Physics } from '../engine/physics.js';
import { generatePlace } from '../engine/floorplan.js';
import { buildPlace } from '../engine/place-builder.js';
import { furnishPlace } from '../engine/furnish.js';
import { buildFurnishing } from '../engine/furniture-kit.js';
import { makeTheme } from '../engine/club-theme.js';
import { InteractableSystem, doorsFromFloorplan, carryFollow } from '../engine/interactables.js';
import { lightPlace, switchPositions } from '../engine/interior-lighting.js';

// Intérieur — the interactions demo, in a GENERATED place (club tier 2, no plan drawn): walk the corridor,
// OPEN the doors (hinged panels with kinematic colliders — closed doorways really block), SIT on the
// locker-room bench or an office chair (procedural sit pose, hips on the seat), PICK UP the ball and carry
// it (attached to the hand bone), drop it anywhere. E / gamepad X / touch button to interact; Sims-style
// high camera (above the roofless walls). Everything physics-collided. See reference/30.
const SEAT_H = { bench: 0.45, chair: 0.45, 'office-chair': 0.5, sofa: 0.42, stool: 0.7 };

export class Interieur {
  constructor(scene) {
    this.scene = scene; this.disposables = [];
    this._tmp = new THREE.Vector3(); this._fwd = new THREE.Vector3();
    this.input = new Input(document.body, { keymap: { e: 'interact' }, padmap: { 2: 'interact' } });
    this.sys = new InteractableSystem();
    this.ready = this._load();
  }

  async _load() {
    this.phys = await Physics.create({ gravity: [0, -20, 0] });
    this.phys.addGround(60, 60, 0);
    const ggeo = new THREE.PlaneGeometry(120, 120); ggeo.rotateX(-Math.PI / 2);
    const gmat = new THREE.MeshStandardNodeMaterial({ color: 0x46503f, roughness: 1 });
    const ground = new THREE.Mesh(ggeo, gmat); ground.position.y = -0.02; ground.receiveShadow = true;
    this.scene.add(ground); this.disposables.push(ggeo, gmat);

    // the place: club tier 2, generated + furnished + themed, all colliders into Rapier
    this.model = generatePlace({ type: 'club', tier: 2, seed: 5 });
    this.theme = makeTheme({ seed: 3, name: 'AS Colline', primary: 0x0b6e4f, secondary: 0xffffff });
    const at = [-this.model.W / 2, 0, -this.model.D / 2];
    const built = buildPlace(this.model, { at, theme: this.theme });
    this.scene.add(built.group); this.disposables.push(built);
    const items = furnishPlace(this.model);
    const furn = buildFurnishing(items, this.model, { at, theme: this.theme });
    this.scene.add(furn.group); this.disposables.push(furn);
    for (const c of [...built.colliders, ...furn.colliders]) this.phys.addStaticBox(c.pos, c.half);

    // EVENING ambience: dim the sun/IBL so the room lights carry the interior
    this.scene.environmentIntensity = 0.32;
    this.scene.traverse((o) => { if (o.isDirectionalLight) o.intensity = 0.5; });
    if (this.scene.fog) this.scene.fog.density = 0.006;
    // per-room lights + wall switches (interactable)
    this.lighting = lightPlace(this.scene, this.model, { at }); this.disposables.push(this.lighting);
    for (const sw of switchPositions(this.model, { at })) {
      const room = this.lighting.byId(sw.roomId); if (!room) continue;
      const pg = new THREE.BoxGeometry(0.09, 0.13, 0.03); const pm = new THREE.MeshStandardNodeMaterial({ color: 0xdad7ce, roughness: 0.5 });
      const plate = new THREE.Mesh(pg, pm); plate.position.set(sw.pos[0], sw.pos[1], sw.pos[2]); this.scene.add(plate);
      this.disposables.push(pg, pm);
      this.sys.add({ label: () => (room.on ? 'E — Éteindre la lumière' : 'E — Allumer la lumière'), pos: () => sw.pos, radius: 1.3, onInteract: () => room.toggle() });
    }

    // DOORS: one per doorway (interior + entrance), animated kinematic colliders
    this.doors = doorsFromFloorplan(this.scene, this.phys, this.model, 0, { at });
    for (const d of this.doors) {
      this.sys.add({ label: () => (d.open ? 'E — Fermer la porte' : 'E — Ouvrir la porte'), pos: () => d.centre(), radius: 1.6, onInteract: () => d.toggle() });
      this.disposables.push(d);
    }

    // SEATS: benches/chairs/sofas from the furnishing become sittable
    for (const it of items) {
      const seatH = SEAT_H[it.kind]; if (!seatH) continue;
      const wp = [at[0] + it.x, 0, at[2] + it.z];
      this.sys.add({
        label: () => (this.ctrl?.seated ? 'E — Se lever' : 'E — S’asseoir'),
        pos: () => wp, radius: 1.4,
        onInteract: () => { if (this.ctrl.seated) this.ctrl.standUp(); else this.ctrl.sitAt({ pos: [wp[0], 0, wp[2]], yaw: it.yaw, seatH }); },
      });
    }

    // the BALL: carryable (attached to the right hand) + kickable dynamic body
    const bgeo = new THREE.SphereGeometry(0.16, 24, 16);
    const bc = document.createElement('canvas'); bc.width = bc.height = 64; const bg = bc.getContext('2d');
    bg.fillStyle = '#f2f2f2'; bg.fillRect(0, 0, 64, 64); bg.fillStyle = '#141414';
    for (let i = 0; i < 4; i++) { bg.beginPath(); bg.arc(16 + (i % 2) * 32, 16 + ((i / 2) | 0) * 32, 7, 0, 7); bg.fill(); }
    const btex = new THREE.CanvasTexture(bc); btex.colorSpace = THREE.SRGBColorSpace;
    const bmat = new THREE.MeshStandardNodeMaterial({ map: btex, roughness: 0.5 });
    this.ballMesh = new THREE.Mesh(bgeo, bmat); this.ballMesh.castShadow = true; this.scene.add(this.ballMesh);
    this.disposables.push(bgeo, bmat, btex);
    const spawn = this.model.spawn.pos;
    this.ballBody = this.phys.addDynamicBall([at[0] + spawn[0] + 2.2, 0.16, at[2] + spawn[2]], 0.16, { density: 22, restitution: 0.5 });
    this.carrying = false;
    this.sys.add({
      label: () => (this.carrying ? 'E — Poser le ballon' : 'E — Ramasser le ballon'),
      pos: () => { const t = this.ballBody.translation(); return [t.x, t.y, t.z]; }, radius: 1.4,
      onInteract: () => {
        this.carrying = !this.carrying;
        this.ballBody.setEnabled(!this.carrying);
        if (!this.carrying) {                                   // drop just ahead, gently
          const f = this.ctrl.forward(this._fwd), p = this.ctrl.pos;
          this.ballBody.setTranslation({ x: p.x + f.x * 0.5, y: 0.3, z: p.z + f.z * 0.5 }, true);
          this.ballBody.setLinvel({ x: f.x * 1.2, y: 0.2, z: f.z * 1.2 }, true);
        }
      },
    });

    // the character
    const gltf = await new GLTFLoader().loadAsync('Soldier.glb');
    const model = gltf.scene; model.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
    const box = new THREE.Box3().setFromObject(model); model.scale.setScalar(1.8 / box.getSize(new THREE.Vector3()).y);
    const b2 = new THREE.Box3().setFromObject(model);
    const start = [at[0] + spawn[0], 0, at[2] + spawn[2]];
    model.position.set(start[0], -b2.min.y, start[2]); this.scene.add(model);
    const mixer = new THREE.AnimationMixer(model);
    const clips = gltf.animations;
    const bone = (re) => { let f = null; model.traverse((o) => { if (o.isBone && re.test(o.name) && !f) f = o; }); return f; };
    const legs = [
      { up: bone(/LeftUpLeg/i), knee: bone(/LeftLeg$/i), foot: bone(/LeftFoot/i) },
      { up: bone(/RightUpLeg/i), knee: bone(/RightLeg$/i), foot: bone(/RightFoot/i) },
    ];
    this.hand = bone(/RightHand$/i) || bone(/RightHand/i);
    this.char = this.phys.addCharacter(start, { radius: 0.3, height: 1.8 });
    this.ctrl = new CharacterController(model, {
      mixer, runClip: clips.find((a) => /run/i.test(a.name)), idleClip: clips.find((a) => /idle/i.test(a.name)),
      walkClip: clips.find((a) => /walk/i.test(a.name)), legs, stride: 2.6, runSpeed: 4.5, forwardLocal: new THREE.Vector3(0, 0, -1),
    });
    this.ctrl.collide = (dx, dy, dz) => this.char.move(dx, dy, dz);
    this.ctrl.faceInstant(1, 0);
    window.__interieur = this;                                 // for headless verification
    return true;
  }

  camera(cam, controls) {
    if (controls) controls.enabled = false;
    // Sims-style: steep pitch keeps the camera ABOVE the roofless walls → no wall clipping indoors
    this.tpc = new ThirdPersonCamera(cam, { distance: 8.5, height: 1.2, lookHeight: 1.1, pitch: 0.92, minPitch: 0.18, maxPitch: 1.25, minDist: 3, maxDist: 16 });   // minPitch bas = vue rasante possible (occlusion caméra gérée)
    this.tpc.yaw = Math.PI / 2;
    cam.position.set(-14, 9, 0); cam.lookAt(-6, 0, 0);
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
    if (!this.ctrl.seated) { this.ctrl.setMoveWorld(wx, wz); this.ctrl.setSprint(this.input.down('sprint')); }
    if (this.input.pressed('interact')) this.sys.interact();
    this.input.endFrame();
    this.ctrl.update(dt);
    for (const d of this.doors) d.update(dt);
    this.phys.step();
    if (this.carrying && this.hand) carryFollow(this.hand, this.ballMesh, this.ballBody);
    else this.phys.sync(this.ballBody, this.ballMesh);

    this.sys.update(this.ctrl.pos);
    const el = document.getElementById('prompt');
    if (el && el.textContent !== this.sys.promptText) { el.textContent = this.sys.promptText; el.style.opacity = this.sys.promptText ? '1' : '0'; }
    this.tpc.update(this._tmp.set(this.ctrl.pos.x, this.ctrl.pos.y, this.ctrl.pos.z), dt,
      (from, dir, max) => this.phys.raycast(from, dir, max, this.char.body));   // la caméra ne traverse plus les murs
  }

  dispose() { this.input?.dispose(); for (const d of this.disposables) d.dispose?.(); }
}
