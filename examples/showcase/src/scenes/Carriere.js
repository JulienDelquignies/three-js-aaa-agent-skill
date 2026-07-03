import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CharacterController } from '../engine/character-controller.js';
import { ThirdPersonCamera } from '../engine/third-person-camera.js';
import { Input } from '../engine/input.js';
import { WORLD } from '../engine/world-basis.js';
import { Physics } from '../engine/physics.js';
import { generateCareer, checkCareer } from '../engine/career.js';
import { buildPlace } from '../engine/place-builder.js';
import { furnishPlace } from '../engine/furnish.js';
import { buildFurnishing } from '../engine/furniture-kit.js';
import { buildStadium } from '../engine/stadium-builder.js';
import { makeTheme } from '../engine/club-theme.js';
import { InteractableSystem, doorsFromFloorplan, carryFollow } from '../engine/interactables.js';

// Carrière — the career demo: ONE character, the SAME controls, across the three sites of a club level
// (?niveau=1..4): the player's home (chambre d'hôtel → villa), the training centre (club T1→T4) and the
// stadium's directors' loge with its TERRACE over the stands (the playable "FM view"). The whole world
// comes from engine/career.js — one number in, three themed sites out, offsets/travel pads/spawns all
// DERIVED and contract-checked (checkCareer). Travel pads teleport between sites; doors open, seats sit
// (including the VIP row behind the loge glass), the ball on the training pitch is carryable/kickable.
const SEAT_H = { bench: 0.45, chair: 0.45, 'office-chair': 0.5, sofa: 0.42, stool: 0.7 };

export class Carriere {
  constructor(scene) {
    this.scene = scene; this.disposables = [];
    this._tmp = new THREE.Vector3(); this._fwd = new THREE.Vector3();
    this.input = new Input(document.body, { keymap: { e: 'interact' }, padmap: { 2: 'interact' } });
    this.sys = new InteractableSystem();
    this.niveau = Math.max(1, Math.min(4, Number(new URLSearchParams(location.search).get('niveau')) || 2));
    this.ready = this._load();
  }

  async _load() {
    this.phys = await Physics.create({ gravity: [0, -20, 0] });
    this.phys.addGround(600, 600, 0);
    const ggeo = new THREE.PlaneGeometry(1200, 1200); ggeo.rotateX(-Math.PI / 2);
    const gmat = new THREE.MeshStandardNodeMaterial({ color: 0x46503f, roughness: 1 });
    const ground = new THREE.Mesh(ggeo, gmat); ground.position.y = -0.02; ground.receiveShadow = true;
    this.scene.add(ground); this.disposables.push(ggeo, gmat);
    if (this.scene.fog) this.scene.fog.density = 0.0012;          // stadium-scale world (see ref 29)

    // the WORLD: derived from the career level, contract-checked (checkCareer = the no-regression gate)
    this.career = generateCareer({ level: this.niveau, seed: 11 });
    const check = checkCareer(this.career);
    if (!check.ok) console.warn('checkCareer:', check.issues);
    this.theme = makeTheme({ seed: this.niveau * 5 + 3 });

    // buildings (home + club): meshes, furniture, colliders, doors, seats
    this.doors = [];
    for (const key of ['home', 'club']) {
      const site = this.career.sites[key]; const { model, at } = site;
      const built = buildPlace(model, { at, theme: this.theme });
      this.scene.add(built.group); this.disposables.push(built);
      const items = furnishPlace(model);
      const furn = buildFurnishing(items, model, { at, theme: this.theme });
      this.scene.add(furn.group); this.disposables.push(furn);
      for (const c of [...built.colliders, ...furn.colliders]) this.phys.addStaticBox(c.pos, c.half);
      for (let fi = 0; fi < model.floors.length; fi++) {
        for (const d of doorsFromFloorplan(this.scene, this.phys, model, fi, { at })) {
          this.doors.push(d); this.disposables.push(d);
          this.sys.add({ label: () => (d.open ? 'E — Fermer la porte' : 'E — Ouvrir la porte'), pos: () => d.centre(), radius: 1.6, onInteract: () => d.toggle() });
        }
      }
      for (const it of items) {
        const seatH = SEAT_H[it.kind]; if (!seatH) continue;
        const wp = [at[0] + it.x, 0, at[2] + it.z];
        this.sys.add({
          label: () => (this.ctrl?.seated ? 'E — Se lever' : 'E — S’asseoir'),
          pos: () => wp, radius: 1.4,
          onInteract: () => { if (this.ctrl.seated) this.ctrl.standUp(); else this.ctrl.sitAt({ pos: [wp[0], 0, wp[2]], yaw: it.yaw, seatH }); },
        });
      }
    }

    // the STADIUM: themed stands + the loge (its terrace door is derived — checkStadium enforces it)
    const stad = this.career.sites.stadium;
    const builtStad = buildStadium(stad.model, this.theme, { at: stad.at });
    this.scene.add(builtStad.group); this.disposables.push(builtStad);
    for (const c of builtStad.colliders) this.phys.addStaticBox(c.pos, c.half);
    const lg = stad.model.loge;
    for (const it of lg.items || []) {                            // VIP row + bar stools are sittable
      const seatH = SEAT_H[it.kind]; if (!seatH) continue;
      const wp = [stad.at[0] + it.x, lg.floorY, stad.at[2] + it.z];
      this.sys.add({
        label: () => (this.ctrl?.seated ? 'E — Se lever' : (it.vip ? 'E — S’asseoir (place VIP)' : 'E — S’asseoir')),
        pos: () => wp, radius: 1.2,
        onInteract: () => { if (this.ctrl.seated) this.ctrl.standUp(); else this.ctrl.sitAt({ pos: [wp[0], 0, wp[2]], yaw: it.yaw, seatH }); },
      });
    }

    // TRAVEL pads (derived by career.js): glowing discs, E to fast-travel between the sites
    const padGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.05, 28); this.disposables.push(padGeo);
    for (const t of this.career.travels) {
      const pm = new THREE.MeshStandardNodeMaterial({ color: 0x123a4a, emissive: 0x35c8ff, emissiveIntensity: 1.6, roughness: 0.4 });
      const pad = new THREE.Mesh(padGeo, pm); pad.position.set(t.pos[0], t.pos[1] + 0.03, t.pos[2]);
      this.scene.add(pad); this.disposables.push(pm);
      this.sys.add({ label: `E — ${t.label}`, pos: () => t.pos, radius: 1.5, onInteract: () => this.travelTo(t.to) });
    }

    // the BALL on the first training pitch (carryable + kickable, same rules as the Intérieur scene)
    const pr = this.career.sites.club.model.outdoor.pitches[0], cat = this.career.sites.club.at;
    const bgeo = new THREE.SphereGeometry(0.16, 24, 16);
    const bc = document.createElement('canvas'); bc.width = bc.height = 64; const bg = bc.getContext('2d');
    bg.fillStyle = '#f2f2f2'; bg.fillRect(0, 0, 64, 64); bg.fillStyle = '#141414';
    for (let i = 0; i < 4; i++) { bg.beginPath(); bg.arc(16 + (i % 2) * 32, 16 + ((i / 2) | 0) * 32, 7, 0, 7); bg.fill(); }
    const btex = new THREE.CanvasTexture(bc); btex.colorSpace = THREE.SRGBColorSpace;
    const bmat = new THREE.MeshStandardNodeMaterial({ map: btex, roughness: 0.5 });
    this.ballMesh = new THREE.Mesh(bgeo, bmat); this.ballMesh.castShadow = true; this.scene.add(this.ballMesh);
    this.disposables.push(bgeo, bmat, btex);
    this.ballBody = this.phys.addDynamicBall([cat[0] + (pr[0] + pr[2]) / 2, 0.16, cat[2] + (pr[1] + pr[3]) / 2], 0.16, { density: 22, restitution: 0.5 });
    this.carrying = false;
    this.sys.add({
      label: () => (this.carrying ? 'E — Poser le ballon' : 'E — Ramasser le ballon'),
      pos: () => { const t = this.ballBody.translation(); return [t.x, t.y, t.z]; }, radius: 1.4,
      onInteract: () => {
        this.carrying = !this.carrying;
        this.ballBody.setEnabled(!this.carrying);
        if (!this.carrying) {
          const f = this.ctrl.forward(this._fwd), p = this.ctrl.pos;
          this.ballBody.setTranslation({ x: p.x + f.x * 0.5, y: p.y + 0.3, z: p.z + f.z * 0.5 }, true);
          this.ballBody.setLinvel({ x: f.x * 1.2, y: 0.2, z: f.z * 1.2 }, true);
        }
      },
    });

    // the character — same Soldier, same controller, everywhere
    const gltf = await new GLTFLoader().loadAsync('Soldier.glb');
    const model = gltf.scene; model.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
    const box = new THREE.Box3().setFromObject(model); model.scale.setScalar(1.8 / box.getSize(new THREE.Vector3()).y);
    const b2 = new THREE.Box3().setFromObject(model);
    const start = this.career.sites.home.spawn;
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
    this.site = 'home'; this._siteHud();
    window.__carriere = this;                                     // for headless verification
    return true;
  }

  /** Fast-travel: put the character (feet) on the destination spawn, snap the camera behind it. */
  travelTo(key) {
    const s = this.career.sites[key]; if (!s) return;
    if (this.ctrl.seated) this.ctrl.standUp();
    const p = s.spawn, c = this.char;
    c.body.setTranslation({ x: p[0], y: p[1] + c.center, z: p[2] }, true);
    c.body.setNextKinematicTranslation({ x: p[0], y: p[1] + c.center, z: p[2] });
    this.ctrl.pos.set(p[0], p[1], p[2]); this.ctrl.groundY = p[1]; this.ctrl.vy = 0;
    this.ctrl.model.position.copy(this.ctrl.pos);
    if (key === 'stadium') { this.ctrl.faceInstant(0, 1); this.tpc?.setYaw(0); }      // face the pitch
    else { this.ctrl.faceInstant(1, 0); this.tpc?.setYaw(Math.PI / 2); }              // face into the hub
    if (this.tpc) { this.tpc._init = false; this.tpc._occDist = Infinity; }           // camera snaps behind
    this.site = key; this._siteHud();
  }
  _siteHud() { const el = document.getElementById('site'); if (el) el.textContent = '📍 ' + this.career.sites[this.site].label; }

  camera(cam, controls) {
    if (controls) controls.enabled = false;
    this.tpc = new ThirdPersonCamera(cam, { distance: 8.5, height: 1.2, lookHeight: 1.1, pitch: 0.92, minPitch: 0.14, maxPitch: 1.25, minDist: 3, maxDist: 18 });
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
      (from, dir, max) => this.phys.raycast(from, dir, max, this.char.body));
  }

  dispose() { this.input?.dispose(); for (const d of this.disposables) d.dispose?.(); }
}
