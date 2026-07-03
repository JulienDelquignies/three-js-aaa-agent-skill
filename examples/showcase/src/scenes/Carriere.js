import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CharacterController } from '../engine/character-controller.js';
import { ThirdPersonCamera } from '../engine/third-person-camera.js';
import { Input } from '../engine/input.js';
import { WORLD } from '../engine/world-basis.js';
import { Physics } from '../engine/physics.js';
import { generateCareer, checkCareer } from '../engine/career.js';
import { generateCity, checkCity } from '../engine/city.js';
import { buildCity } from '../engine/city-builder.js';
import { buildCar, PathDriver } from '../engine/vehicle.js';
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

    // buildings (home + club + restaurant): meshes, furniture, colliders, doors, seats
    this.doors = [];
    for (const key of ['home', 'club', 'resto']) {
      const site = this.career.sites[key]; const { model, at } = site;
      const built = buildPlace(model, { at, theme: key === 'resto' ? null : this.theme });
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
      // the MEETING (rendez-vous d'agent): the private-dining table of the restaurant — the NPC agent
      // sits on one seat, the opposite seat gets its own interaction (dialogue placeholder, see below)
      if (key === 'resto') {
        const table = items.find((i) => /^salon-prive/.test(i.room) && i.kind === 'table') || items.find((i) => i.room === 'salle-resto' && i.kind === 'table');
        const chairs = table ? items.filter((i) => i.kind === 'chair' && i.faces === table.id) : [];
        if (chairs.length >= 2) this._meet = { at, table, npcChair: chairs[0], meChair: chairs[1] };
      }
      for (const it of items) {
        const seatH = SEAT_H[it.kind]; if (!seatH) continue;
        if (this._meet && (it === this._meet.npcChair || it === this._meet.meChair)) continue;
        // the speakers' chairs at the press podium get their own interaction: sitting there switches
        // the camera to the TV SHOT (from the press rows, framing podium + sponsor backdrop)
        const podium = key === 'club' && it.room === 'salle-presse' && it.kind === 'office-chair';
        const wp = [at[0] + it.x, 0, at[2] + it.z];
        this.sys.add({
          label: () => (this.ctrl?.seated ? 'E — Se lever' : (podium ? 'E — S’installer au pupitre' : 'E — S’asseoir')),
          pos: () => wp, radius: 1.4,
          onInteract: () => {
            if (this.ctrl.seated) { this.ctrl.standUp(); this._syncBody(); this._podium = false; this.tpc._init = false; }
            // furniture yaw (0 = faces +z) → character yaw via the WorldBasis, else the model sits BACKWARDS
            else { this.ctrl.sitAt({ pos: [wp[0], 0, wp[2]], yaw: this.ctrl.yawFor(Math.sin(it.yaw), Math.cos(it.yaw)), seatH }); this._podium = podium; }
          },
        });
      }
      // the TV shot pose, derived from the podium desk + its room (camera at the back of the rows)
      if (key === 'club') {
        const desk = items.find((i) => i.kind === 'press-desk');
        const room = desk && model.floors[0].rooms.find((r) => r.id === desk.room);
        if (desk && room) {
          const fx = Math.sin(desk.yaw), fz = Math.cos(desk.yaw);
          const dist = Math.min(fx > 0.5 ? room.rect[2] - desk.x : fx < -0.5 ? desk.x - room.rect[0] : 99,
            fz > 0.5 ? room.rect[3] - desk.z : fz < -0.5 ? desk.z - room.rect[1] : 99);
          const back = Math.max(1.8, dist - 0.45);
          this._pressShot = { pos: [at[0] + desk.x + fx * back, 1.55, at[2] + desk.z + fz * back], look: [at[0] + desk.x, 1.0, at[2] + desk.z] };
        }
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
        onInteract: () => {
          if (this.ctrl.seated) { this.ctrl.standUp(); this._syncBody(); }
          else this.ctrl.sitAt({ pos: [wp[0], 0, wp[2]], yaw: this.ctrl.yawFor(Math.sin(it.yaw), Math.cos(it.yaw)), seatH });
        },
      });
    }

    // the CITY around the sites: streets carved between the derived curb stops, buildings/trees/lights
    // (see engine/city.js — checkCity is the contract). Buildings get colliders; streets stay open.
    this.city = generateCity({ career: this.career, seed: 11 });
    const cityCheck = checkCity(this.city, this.career);
    if (!cityCheck.ok) console.warn('checkCity:', cityCheck.issues);
    const builtCity = buildCity(this.city);
    this.scene.add(builtCity.group); this.disposables.push(builtCity);
    for (const c of builtCity.colliders) this.phys.addStaticBox(c.pos, c.half);
    // your CAR, parked at the current site's curb stop — travel = watch it drive the streets
    this.car = buildCar({ color: 0xb3252f });
    this.scene.add(this.car.group); this.disposables.push(this.car);
    this._parkCar('home');

    // TRAVEL pads (derived by career.js): glowing discs, E to fast-travel between the sites
    const padGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.05, 28); this.disposables.push(padGeo);
    for (const t of this.career.travels) {
      const pm = new THREE.MeshStandardNodeMaterial({ color: 0x123a4a, emissive: 0x35c8ff, emissiveIntensity: 1.6, roughness: 0.4 });
      const pad = new THREE.Mesh(padGeo, pm); pad.position.set(t.pos[0], t.pos[1] + 0.03, t.pos[2]);
      this.scene.add(pad); this.disposables.push(pm);
      this.sys.add({ label: `E — ${t.label} 🚗`, pos: () => t.pos, radius: 1.5, onInteract: () => this.driveTo(t.to) });
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

    // the NPC AGENT: same Soldier rig in a dark suit, seated at the meeting table, waiting for you.
    // The opposite seat drives the encounter: sit → talk (placeholder dialogue) → stand up.
    if (this._meet) {
      const g2 = await new GLTFLoader().loadAsync('Soldier.glb');
      const nm = g2.scene;
      nm.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; if (o.material) { o.material = o.material.clone(); o.material.color = new THREE.Color(0x6f7787); } } });
      const nb = new THREE.Box3().setFromObject(nm); nm.scale.setScalar(1.8 / nb.getSize(new THREE.Vector3()).y);
      this.scene.add(nm);
      const nmix = new THREE.AnimationMixer(nm);
      const nbone = (re) => { let f = null; nm.traverse((o) => { if (o.isBone && re.test(o.name) && !f) f = o; }); return f; };
      const nlegs = [
        { up: nbone(/LeftUpLeg/i), knee: nbone(/LeftLeg$/i), foot: nbone(/LeftFoot/i) },
        { up: nbone(/RightUpLeg/i), knee: nbone(/RightLeg$/i), foot: nbone(/RightFoot/i) },
      ];
      this.npc = new CharacterController(nm, {
        mixer: nmix, runClip: g2.animations.find((a) => /run/i.test(a.name)), idleClip: g2.animations.find((a) => /idle/i.test(a.name)),
        walkClip: g2.animations.find((a) => /walk/i.test(a.name)), legs: nlegs, forwardLocal: new THREE.Vector3(0, 0, -1),
      });
      const m = this._meet, np = [m.at[0] + m.npcChair.x, 0, m.at[2] + m.npcChair.z];
      this.npc.pos.set(np[0], 0, np[2]); this.npc.model.position.copy(this.npc.pos);
      this.npc.sitAt({ pos: np, yaw: this.npc.yawFor(Math.sin(m.npcChair.yaw), Math.cos(m.npcChair.yaw)), seatH: 0.45 });
      const mp = [m.at[0] + m.meChair.x, 0, m.at[2] + m.meChair.z];
      this._meetLines = [
        'Agent : Merci d’être venu en personne, ça compte pour mon joueur.',
        'Agent : Il progresse vite — et le PSG a déjà appelé, je ne vous le cache pas.',
        'Vous : Chez nous, il jouera. Projet, temps de jeu, staff aux petits soins. Faisons ça bien.',
        'Agent : … D’accord. Envoyez l’offre, on tient un accord de principe. 🤝',
      ];
      this._meetIdx = 0;
      this.sys.add({
        label: () => (!this.ctrl?.seated ? 'E — S’installer au rendez-vous' : (this._meetIdx < this._meetLines.length ? 'E — Discuter' : 'E — Se lever')),
        pos: () => mp, radius: 1.6,
        onInteract: () => {
          const dlg = document.getElementById('dialog');
          if (!this.ctrl.seated) { this.ctrl.sitAt({ pos: mp, yaw: this.ctrl.yawFor(Math.sin(m.meChair.yaw), Math.cos(m.meChair.yaw)), seatH: 0.45 }); this._meetIdx = 0; }
          else if (this._meetIdx < this._meetLines.length) { if (dlg) { dlg.textContent = this._meetLines[this._meetIdx]; dlg.style.opacity = '1'; } this._meetIdx++; }
          else { if (dlg) dlg.style.opacity = '0'; this.ctrl.standUp(); this._syncBody(); }
        },
      });
    }
    this.site = 'home'; this._siteHud();
    window.__carriere = this;                                     // for headless verification
    return true;
  }

  _parkCar(key) {
    if (!this.car || !this.city) return;
    const st = this.city.stops[key]; if (!st) return;
    this.car.group.position.set(st.pos[0], 0, st.pos[1]);
  }

  /** Drive to a site: the car follows the derived street route, elevated camera, E skips. */
  driveTo(to) {
    if (this._drive) return;
    const path = this.city?.paths?.[`${this.site}->${to}`];
    if (!path) return this.travelTo(to);                       // no route → instant fallback
    if (this.ctrl.seated) { this.ctrl.standUp(); this._syncBody(); }
    this._podium = false;
    const dlg = document.getElementById('dialog'); if (dlg) dlg.style.opacity = '0';
    this._drive = { driver: new PathDriver(path, { speed: 15 }), to };
    this.ctrl.model.visible = false; this.ctrl.setMoveWorld(0, 0);
    const el = document.getElementById('site'); if (el) el.textContent = '🚗 En route : ' + this.career.sites[to].label + '  (E : passer)';
    const pr = document.getElementById('prompt'); if (pr) { pr.textContent = ''; pr.style.opacity = '0'; }
  }

  /** Re-seat the physics capsule on the controller position (after sitAt/standUp moved it). */
  _syncBody() {
    const p = this.ctrl.pos, c = this.char, t = { x: p.x, y: p.y + c.center, z: p.z };
    c.body.setTranslation(t, true); c.body.setNextKinematicTranslation(t);
  }

  /** Fast-travel: put the character (feet) on the destination spawn, snap the camera behind it. */
  travelTo(key) {
    const s = this.career.sites[key]; if (!s) return;
    if (this.ctrl.seated) this.ctrl.standUp();
    this._podium = false;
    const dlg = document.getElementById('dialog'); if (dlg) dlg.style.opacity = '0';
    const p = s.spawn, c = this.char;
    c.body.setTranslation({ x: p[0], y: p[1] + c.center, z: p[2] }, true);
    c.body.setNextKinematicTranslation({ x: p[0], y: p[1] + c.center, z: p[2] });
    this.ctrl.pos.set(p[0], p[1], p[2]); this.ctrl.groundY = p[1]; this.ctrl.vy = 0;
    this.ctrl.model.position.copy(this.ctrl.pos);
    if (key === 'stadium') { this.ctrl.faceInstant(0, 1); this.tpc?.setYaw(0); }      // face the pitch
    else { this.ctrl.faceInstant(1, 0); this.tpc?.setYaw(Math.PI / 2); }              // face into the hub
    if (this.tpc) { this.tpc._init = false; this.tpc._occDist = Infinity; }           // camera snaps behind
    this.ctrl.model.visible = true;
    this._parkCar(key);
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
    if (this._drive) {                                          // EN ROUTE: the car drives the streets
      this.input.update();
      if (this.input.pressed('interact')) this._drive.driver.finish();   // E skips the trip
      this.input.endFrame();
      const d = this._drive.driver.update(dt);
      this.car.group.position.set(d.x, 0, d.z); this.car.group.rotation.y = d.yaw;
      for (const w of this.car.wheels) w.rotation.x += d.wheelSpin * dt;
      const fx = Math.sin(d.yaw), fz = Math.cos(d.yaw);         // elevated chase camera → you SEE the city
      const cam = this.tpc.cam, k = 1 - Math.exp(-2.2 * dt);
      this._tmp.set(d.x - fx * 13, 31, d.z - fz * 13);
      if (!this._driveCamInit) { cam.position.copy(this._tmp); this._driveCamInit = true; } else cam.position.lerp(this._tmp, k);
      cam.lookAt(d.x + fx * 10, 1, d.z + fz * 10);
      if (d.done) { const to = this._drive.to; this._drive = null; this._driveCamInit = false; this.travelTo(to); }
      return;
    }
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
    this.npc?.update(dt);
    for (const d of this.doors) d.update(dt);
    this.phys.step();
    if (this.carrying && this.hand) carryFollow(this.hand, this.ballMesh, this.ballBody);
    else this.phys.sync(this.ballBody, this.ballMesh);

    this.sys.update(this.ctrl.pos);
    const el = document.getElementById('prompt');
    if (el && el.textContent !== this.sys.promptText) { el.textContent = this.sys.promptText; el.style.opacity = this.sys.promptText ? '1' : '0'; }
    if (this._podium && this.ctrl.seated && this._pressShot) {  // seated at the podium → the TV shot
      const p = this._pressShot;
      this.tpc.cam.position.lerp(this._tmp.set(p.pos[0], p.pos[1], p.pos[2]), 1 - Math.exp(-4 * dt));
      this.tpc.cam.lookAt(p.look[0], p.look[1], p.look[2]);
    } else {
      this.tpc.update(this._tmp.set(this.ctrl.pos.x, this.ctrl.pos.y, this.ctrl.pos.z), dt,
        (from, dir, max) => this.phys.raycast(from, dir, max, this.char.body));
    }
  }

  dispose() { this.input?.dispose(); for (const d of this.disposables) d.dispose?.(); }
}
