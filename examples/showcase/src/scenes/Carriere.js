import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { CharacterController } from '../engine/character-controller.js';
import { ThirdPersonCamera } from '../engine/third-person-camera.js';
import { Input } from '../engine/input.js';
import { WORLD } from '../engine/world-basis.js';
import { Physics } from '../engine/physics.js';
import { generateCareer, checkCareer } from '../engine/career.js';
import { generateCity, checkCity } from '../engine/city.js';
import { buildCity } from '../engine/city-builder.js';
import { buildCar, buildBus, buildTrain, buildJet, paintCar, findWheels, PathDriver } from '../engine/vehicle.js';
import { makeCatalog, checkCatalog } from '../engine/dealership.js';
import { generateCabin, checkCabin } from '../engine/cabin.js';
import { buildCabin } from '../engine/cabin-builder.js';
import { generateBeach, checkBeach } from '../engine/beach.js';
import { buildBeach } from '../engine/beach-builder.js';
import { DriveController } from '../engine/drive.js';
import { MOVES } from '../engine/animkit.js';
import { toClip, playGesture } from '../engine/animkit-builder.js';
import { Laptop } from '../engine/laptop.js';
import { buildLaptopProp } from '../engine/laptop-prop.js';
import { generateCircuit, checkCircuit, makeLapTimer } from '../engine/circuit.js';
import { buildCircuit } from '../engine/circuit-builder.js';
import { makeGameState } from '../engine/game-state.js';
import { Phone, PhoneApps } from '../engine/phone.js';
import { CityView } from '../engine/city-view.js';
import { buildPlace } from '../engine/place-builder.js';
import { furnishPlace } from '../engine/furnish.js';
import { buildFurnishing } from '../engine/furniture-kit.js';
import { buildStadium } from '../engine/stadium-builder.js';
import { makeTheme } from '../engine/club-theme.js';
import { InteractableSystem, doorsFromFloorplan, carryFollow } from '../engine/interactables.js';
import { DebugGizmos } from '../engine/debug-gizmos.js';
import * as MESHKIT from '../engine/meshkit.js';
import { buildParts, toGeometry } from '../engine/meshkit-builder.js';
const { lathe, sweep, transform, mirrorX, merge, sphere, displace } = MESHKIT;

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
    this.input = new Input(document.body, {
      keymap: { e: 'interact', t: 'phone', m: 'map', o: 'laptop' }, padmap: { 2: 'interact', 3: 'phone' },
      touch: [{ label: 'E', action: 'interact', size: 76 }, { label: 'FREIN', action: 'sprint' }],
    });
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

    // buildings (every place-kind site: home, club, restaurant, dealership, gare/aéroport by level)
    this.doors = []; this._podiums = [];
    const placeKeys = Object.keys(this.career.sites).filter((k) => this.career.sites[k].kind === 'place');
    for (const key of placeKeys) {
      const site = this.career.sites[key]; const { model, at } = site;
      const built = buildPlace(model, { at, theme: key === 'home' || key === 'club' ? this.theme : null });
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
      // the DEALERSHIP showroom: keep the podium items — the catalogue cars land on them below
      if (key === 'dealer') this._podiumItems = items.filter((i) => i.kind === 'car-podium').map((i) => ({ ...i, at }));
      // GARE: parked train on the platform track — BOARDABLE (walkable coach interior, scouting inside)
      if (key === 'gare' && model.outdoor?.quai) {
        const q = model.outdoor.quai;
        const tPos = [at[0] + (q[0] + q[2]) / 2, 0, at[2] + q[3] - 1.0];
        const train = buildTrain({ accent: this.theme.primary, length: Math.min(18, q[2] - q[0] - 2) });
        train.group.position.set(tPos[0], 0, tPos[2]); train.group.rotation.y = Math.PI / 2;
        this.scene.add(train.group); this.disposables.push(train);
        const coach = [tPos[0] + 4.65, 0, tPos[2]];                        // first coach centre (rotated +x)
        this._mountCabin('train', coach, Math.PI / 2, '🚆', 'du train', [at[0] + (q[0] + q[2]) / 2, 0, at[2] + q[1] + 0.9]);
      }
      // AÉROPORT: the club jet on the tarmac — BOARDABLE (the flying lounge, scouting from the cabin)
      if (key === 'aeroport' && model.outdoor?.tarmac) {
        const t = model.outdoor.tarmac;
        const jPos = [at[0] + (t[0] + t[2]) / 2, 0, at[2] + (t[1] + t[3]) / 2 + 1];
        const jet = buildJet({ accent: this.theme.primary });
        jet.group.position.set(jPos[0], 0, jPos[2]); jet.group.rotation.y = 0.5;
        this.scene.add(jet.group); this.disposables.push(jet);
        this._mountCabin('jet', jPos, 0.5, '✈️', 'du jet', [jPos[0] + 4, 0, jPos[2] + 4]);
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

    // MESHKIT set dressing — curved, organic models (no boxes): the club trophy on its pedestal in
    // the loge (lathe cup + swept mirrored handles), a vase on the meeting table. See reference/40.
    {
      const lgr = lg.rect;
      // derived spot: the clearest x along the loge's BACK wall (max distance to any loge item)
      let bestX = 0, bestD = -1;
      for (let x = lgr[0] + 0.6; x <= lgr[2] - 0.6; x += 0.15) {
        const d = Math.min(...(lg.items || []).map((it) => Math.hypot(it.x - x, it.z - (lgr[1] + 0.5))));
        if (d > bestD) { bestD = d; bestX = x; }
      }
      const trophyPos = [stad.at[0] + bestX, lg.floorY, stad.at[2] + lgr[1] + 0.5];
      const cup = lathe([[0, 0], [0.09, 0], [0.11, 0.03], [0.09, 0.1], [0.2, 0.42], [0.24, 0.56], [0.23, 0.6], [0, 0.6]], { segments: 36 });
      const hp = []; for (let i = 0; i <= 18; i++) { const a = (i / 18) * Math.PI; hp.push([0.2 + Math.sin(a) * 0.21, 0.6 - Math.cos(a) * 0.24, 0]); }
      const circ = []; for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; circ.push([Math.cos(a) * 0.025, Math.sin(a) * 0.025]); }
      const handle = sweep(circ, hp);
      const foot = lathe([[0, 0], [0.2, 0], [0.2, 0.06], [0.07, 0.1], [0.05, 0.32], [0, 0.32]], { segments: 24 });
      const trophyMesh = transform(merge([transform(cup, { at: [0, 0.3, 0] }), foot, handle, mirrorX(handle)]), { scale: 0.62 });
      const pedestal = lathe([[0, 0], [0.26, 0], [0.24, 0.06], [0.2, 0.94], [0.24, 0.98], [0.24, 1.02], [0, 1.02]], { segments: 28 });
      const trophy = buildParts([
        { mesh: pedestal, color: 0x2c2f36, roughness: 0.4, at: trophyPos },
        { mesh: trophyMesh, color: 0xd8a832, roughness: 0.25, metalness: 1, at: [trophyPos[0], trophyPos[1] + 1.02, trophyPos[2]] },
      ]);
      this.scene.add(trophy.group); this.disposables.push(trophy);
      this.phys.addStaticBox([trophyPos[0], trophyPos[1] + 0.7, trophyPos[2]], [0.27, 0.7, 0.27]);
      if (this._meet) {                                          // the centrepiece of the agent dinner
        const vaseMesh = lathe([[0, 0], [0.16, 0], [0.2, 0.04], [0.14, 0.28], [0.26, 0.62], [0.18, 0.86], [0.2, 0.96], [0.19, 1.0], [0, 1.0]], { segments: 40 });
        const m = this._meet;
        const vase = buildParts([{ mesh: vaseMesh, color: 0xb35438, roughness: 0.55, at: [m.at[0] + m.table.x, 0.755, m.at[2] + m.table.z], scale: 0.42 }]);
        this.scene.add(vase.group); this.disposables.push(vase);
      }
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
    // FREE DRIVING: E at your own parked car → take the wheel (engine/drive.js, collisions via a
    // kinematic capsule so buildings/barriers are REAL); E again to step out where you stopped
    this.sys.add({
      label: () => 'E — Prendre le volant 🚗',
      pos: () => [this.car.group.position.x, 0, this.car.group.position.z], radius: 2.2,
      onInteract: () => this._enterDrive(),
    });
    // the TEAM BUS in club livery, parked at the club — matchday: ride it to the stadium
    // ...WITH its interior: the cabin (contract-checked) rides INSIDE the bus group, and the matchday
    // camera sits in the aisle among the seated teammates (the bus shell is invisible from inside —
    // closed FrontSide mesh — so the city stays visible through the window band)
    this.bus = buildBus({ theme: this.theme });
    const busCab = generateCabin({ kind: 'bus' });
    const busChk = checkCabin(busCab);
    if (!busChk.ok) console.warn('checkCabin bus:', busChk.issues);
    this._busCabin = { model: busCab, built: buildCabin(busCab, { theme: this.theme }) };
    this.bus.group.add(this._busCabin.built.group);
    this.disposables.push(this._busCabin.built);
    this._busHome = [this.city.stops.club.pos[0] + 4.5, this.city.stops.club.pos[1] + 2.5];
    this.bus.group.position.set(this._busHome[0], 0, this._busHome[1]);
    this.scene.add(this.bus.group); this.disposables.push(this.bus);
    this.sys.add({
      label: () => (this.site === 'club' ? 'E — Monter dans le bus d’équipe 🚌 (jour de match)' : 'Bus d’équipe'),
      pos: () => [this.bus.group.position.x, 0, this.bus.group.position.z], radius: 2.6,
      onInteract: () => { if (this.site === 'club') this.driveTo('stadium', this.bus); },
    });

    // TRAVEL pads (derived by career.js): glowing discs, E to fast-travel between the sites
    const padGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.05, 28); this.disposables.push(padGeo);
    for (const t of this.career.travels) {
      const pm = new THREE.MeshStandardNodeMaterial({ color: 0x123a4a, emissive: 0x35c8ff, emissiveIntensity: 1.6, roughness: 0.4 });
      const pad = new THREE.Mesh(padGeo, pm); pad.position.set(t.pos[0], t.pos[1] + 0.03, t.pos[2]);
      this.scene.add(pad); this.disposables.push(pm);
      this.sys.add({ label: `E — ${t.label} 🚗`, pos: () => t.pos, radius: 1.5, onInteract: () => this.driveTo(t.to) });
    }

    // the CIRCUIT (level ≥ 2, once the dealership sells something worth driving): a derived racing
    // loop far north-east of the city (engine/circuit.js — checkCircuit proves it drivable), reached
    // via « Journée circuit » at the dealership. Lap timing is data (makeLapTimer) → game-state.
    if (this.niveau >= 2) {
      const circ = generateCircuit({ level: this.niveau, seed: 11 });
      const cChk = checkCircuit(circ);
      if (!cChk.ok) console.warn('checkCircuit:', cChk.issues);
      const cAt = [this.city.bounds[2] + 130, 0, this.city.bounds[1] - 170];
      const builtC = buildCircuit(circ, { theme: this.theme });
      builtC.group.position.set(cAt[0], 0, cAt[2]);
      this.scene.add(builtC.group); this.disposables.push(builtC);
      for (const c of builtC.colliders) {
        const rot = c.yaw ? [0, Math.sin(c.yaw / 2), 0, Math.cos(c.yaw / 2)] : undefined;
        this.phys.addStaticBox([cAt[0] + c.pos[0], c.pos[1], cAt[2] + c.pos[2]], c.half, rot);
      }
      this._circuit = {
        model: circ, at: cAt,
        grid: [cAt[0] + circ.grid[0], cAt[2] + circ.grid[1]],
        gridYaw: Math.atan2(circ.start.dir[0], circ.start.dir[1]),
        spawn: [cAt[0] + circ.paddock.spawn[0], cAt[2] + circ.paddock.spawn[1]],
        returnPad: [cAt[0] + circ.paddock.returnPad[0], cAt[2] + circ.paddock.returnPad[1]],
      };
      const rpm2 = new THREE.MeshStandardNodeMaterial({ color: 0x123a4a, emissive: 0x35c8ff, emissiveIntensity: 1.6, roughness: 0.4 });
      const rp2 = new THREE.Mesh(padGeo, rpm2); rp2.position.set(this._circuit.returnPad[0], 0.03, this._circuit.returnPad[1]);
      this.scene.add(rp2); this.disposables.push(rpm2);
      this.sys.add({ label: 'E — Rentrer du circuit 🧳', pos: () => [this._circuit.returnPad[0], 0, this._circuit.returnPad[1]], radius: 1.6, onInteract: () => this.travelTo(this._circFrom || 'dealer') });
      const de = this.career.sites.dealer;
      this.sys.add({
        label: () => `E — Journée circuit 🏁 (${this.state?.bestLap ? 'record ' + this.state.bestLap.toFixed(2) + ' s' : 'chrono au tour'})`,
        pos: () => [de.spawn[0] + 1.6, 0, de.spawn[2] + 1.6], radius: 1.6,
        onInteract: () => this._goCircuit(),
      });
    }

    // the RESORT (level ≥ 3, with the gare): a seaside villa + beach far beyond the city — no street
    // goes there, you only reach it by train or jet (« Partir en vacances » from their lounge tables).
    // Everything derived and contract-checked (engine/beach.js), meshes from beach-builder.js.
    if (this.career.sites.gare) {
      const beach = generateBeach({ level: this.niveau, seed: 11 });
      const bChk = checkBeach(beach);
      if (!bChk.ok) console.warn('checkBeach:', bChk.issues);
      const at = [this.city.bounds[2] + 100, 0, 0];
      const builtV = buildPlace(beach.villa, { at, theme: this.theme });
      this.scene.add(builtV.group); this.disposables.push(builtV);
      const vItems = furnishPlace(beach.villa);
      const vFurn = buildFurnishing(vItems, beach.villa, { at, theme: this.theme });
      this.scene.add(vFurn.group); this.disposables.push(vFurn);
      for (const c of [...builtV.colliders, ...vFurn.colliders]) this.phys.addStaticBox(c.pos, c.half);
      for (let fi = 0; fi < beach.villa.floors.length; fi++) {
        for (const d of doorsFromFloorplan(this.scene, this.phys, beach.villa, fi, { at })) {
          this.doors.push(d); this.disposables.push(d);
          this.sys.add({ label: () => (d.open ? 'E — Fermer la porte' : 'E — Ouvrir la porte'), pos: () => d.centre(), radius: 1.6, onInteract: () => d.toggle() });
        }
      }
      const builtB = buildBeach(beach, { theme: this.theme });
      builtB.group.position.set(at[0], 0, at[2]);
      this.scene.add(builtB.group); this.disposables.push(builtB);
      for (const c of builtB.colliders) {
        const rot = c.yaw ? [0, Math.sin(c.yaw / 2), 0, Math.cos(c.yaw / 2)] : undefined;
        this.phys.addStaticBox([at[0] + c.pos[0], c.pos[1], at[2] + c.pos[2]], c.half, rot);
      }
      for (const s of builtB.seats) {                             // the transats: lie back, face the sea
        const wp = [at[0] + s.pos[0], 0, at[2] + s.pos[2]];
        this.sys.add({
          label: () => (this.ctrl?.seated ? 'E — Se lever' : 'E — S’allonger au soleil'),
          pos: () => wp, radius: 1.3,
          onInteract: () => {
            if (this.ctrl.seated) { this.ctrl.standUp(); this._syncBody(); }
            else this.ctrl.sitAt({ pos: [wp[0], 0, wp[2]], yaw: this.ctrl.yawFor(Math.sin(s.yaw), Math.cos(s.yaw)), seatH: s.seatH });
          },
        });
      }
      for (const it of vItems) {                                  // the villa's own seats stay sittable
        const seatH = SEAT_H[it.kind]; if (!seatH) continue;
        const wp = [at[0] + it.x, 0, at[2] + it.z];
        this.sys.add({
          label: () => (this.ctrl?.seated ? 'E — Se lever' : 'E — S’asseoir'),
          pos: () => wp, radius: 1.4,
          onInteract: () => {
            if (this.ctrl.seated) { this.ctrl.standUp(); this._syncBody(); }
            else this.ctrl.sitAt({ pos: [wp[0], 0, wp[2]], yaw: this.ctrl.yawFor(Math.sin(it.yaw), Math.cos(it.yaw)), seatH });
          },
        });
      }
      this._resort = { beach, at, spawn: [at[0] + beach.spawn[0], 0, at[2] + beach.spawn[2]] };
      const rp = [at[0] + beach.returnPad[0], 0, at[2] + beach.returnPad[2]];
      const rpm = new THREE.MeshStandardNodeMaterial({ color: 0x123a4a, emissive: 0x35c8ff, emissiveIntensity: 1.6, roughness: 0.4 });
      const rpad = new THREE.Mesh(padGeo, rpm); rpad.position.set(rp[0], 0.03, rp[2]);
      this.scene.add(rpad); this.disposables.push(rpm);
      this.sys.add({ label: 'E — Rentrer de vacances 🧳', pos: () => rp, radius: 1.5, onInteract: () => this.travelTo(this._vacFrom || 'gare') });
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
    this._soldierGltf = gltf;
    this._mixer = mixer;
    // GESTURES (animkit, reference/42): data-authored moves compiled against THIS rig — the tracks
    // only claim the bones they pose, so a gesture plays OVER the locomotion (legs keep walking)
    this._gestures = {};
    for (const g of Object.keys(MOVES)) this._gestures[g] = toClip(MOVES[g], model);
    this._gesture = (name) => playGesture(this._mixer, this._gestures[name]);
    // the LAPTOP (O / 💻): a real meshkit prop in the LEFT hand — folded while walking, the lid
    // eases open and DS OS (laptop.js) comes up once it's lit. Same apps as the phone: one data
    // layer, two diegetic screens.
    this.laptopProp = buildLaptopProp();
    this.laptopProp.attachToHand(model);
    this.laptopProp.group.visible = false;
    this.disposables.push(this.laptopProp);
    this._laptopOpen = false;

    // THE TEAMMATES: three seated players (skinned clones, jersey-tinted) riding in the bus cabin
    this._extras = [];
    if (this._busCabin) {
      const rows = this._busCabin.model.seats.filter((s) => !s.driver);
      for (const idx of [0, 3, 9]) {
        const s = rows[idx]; if (!s) continue;
        this._seatedExtra(this._busCabin.built.group, [s.x, this._busCabin.model.shell.floorY, s.z], s.yaw + Math.PI);
      }
    }

    // the FLYING RECRUITMENT ROOM (level 4): a suited agent waits at the jet's second lounge table —
    // sit opposite him, talk (E), close the deal 🤝 (message + handshake on BOTH rigs). Acting DURING
    // transport, not just travelling: the encounter grammar of the restaurant, airborne.
    if (this._jetCabin) {
      const { built, W, yaw: jyaw, sh, meetSeats: pair } = this._jetCabin;
      if (pair.length >= 2) {
        const npcSeat = pair[0], meSeat = pair[1];
        this._seatedExtra(built.group, [npcSeat.x, sh.floorY, npcSeat.z], npcSeat.yaw + Math.PI, 0x565e6e);
        this._jetMixer = this._extras[this._extras.length - 1]?.mixer;
        const mwp = W([meSeat.x, 0, meSeat.z]);
        const meYaw = jyaw + meSeat.yaw;
        const lines = [
          'Agent : Merci pour le vol — on n’est jamais mieux qu’à 10 000 mètres pour parler avenir.',
          'Agent : Mon attaquant plaît en Italie. Mais il rêve de VOTRE projet.',
          'Vous : Alors écrivons-le ici. Salaire cadré, temps de jeu réel, clause de départ raisonnable.',
          'Agent : Banco. Posez ça sur papier à l’atterrissage. 🤝',
        ];
        let idx = 0;
        this.sys.add({
          label: () => (!this.ctrl?.seated ? 'E — Rendez-vous en vol ✈️' : (idx < lines.length ? 'E — Discuter' : 'E — Se lever')),
          pos: () => mwp, radius: 1.0,
          onInteract: () => {
            const dlg = document.getElementById('dialog');
            if (!this.ctrl.seated) { this.ctrl.sitAt({ pos: [mwp[0], sh.floorY, mwp[2]], yaw: this.ctrl.yawFor(Math.sin(meYaw), Math.cos(meYaw)), seatH: 0.47 }); idx = 0; }
            else if (idx < lines.length) {
              if (dlg) { dlg.textContent = lines[idx]; dlg.style.opacity = '1'; }
              idx++;
              if (idx === lines.length && !this._jetDealDone) {
                this._jetDealDone = true;
                this.state?.addMessage({ from: 'Agent', text: 'Accord trouvé en plein vol pour mon attaquant. L’écrit suit à l’atterrissage. ✈️🤝' });
                this._gesture?.('poignee');
                if (this._jetMixer && this._gestures) playGesture(this._jetMixer, this._gestures.poignee);
              }
            } else { if (dlg) dlg.style.opacity = '0'; this.ctrl.standUp(); this._syncBody(); }
          },
        });
      }
    }

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
      this._npcMixer = nmix;
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
          else if (this._meetIdx < this._meetLines.length) {
            if (dlg) { dlg.textContent = this._meetLines[this._meetIdx]; dlg.style.opacity = '1'; }
            this._meetIdx++;
            if (this._meetIdx === this._meetLines.length && !this._meetDone) {   // the 3D pushes to the PHONE
              this._meetDone = true;
              this.state?.addMessage({ from: 'Agent', text: 'Accord de principe pour mon joueur. Envoyez l’offre écrite — on finalise cette semaine. 🤝' });
              this._gesture?.('poignee');                                        // the deal is SHAKEN ON (animkit)
              if (this._npcMixer && this._gestures) playGesture(this._npcMixer, this._gestures.poignee);
            }
          }
          else { if (dlg) dlg.style.opacity = '0'; this.ctrl.standUp(); this._syncBody(); }
        },
      });
    }
    this.site = 'home'; this._siteHud();

    // the CITY VIEW (Top-Eleven style): M / 🗺️ / the phone's Plan app — a fixed panorama of the 3D
    // city with clickable pins over the sites; picking one starts the drive
    this.cityView = new CityView({
      city: this.city, career: this.career,
      onPick: (key) => this.driveTo(key),
      onExit: () => { if (this.tpc) { this.tpc._init = false; this.tpc._occDist = Infinity; } },
    });
    this.disposables.push(this.cityView);
    document.getElementById('mapbtn')?.addEventListener('click', () => this.toggleCityView());

    // the PHONE (T / gamepad Y / 📱): a home screen of apps over the FM data layer (game-state);
    // the Plan app is an ACTION — it closes the phone and opens the city view
    this.state = makeGameState({ seed: 11, level: this.niveau });
    this.phone = new Phone({
      state: this.state,
      apps: [
        PhoneApps.messages(this.state),
        PhoneApps.effectif(this.state),
        PhoneApps.finances(this.state),
        { id: 'plan', name: 'Plan', icon: '🗺️', launch: () => { this.phone.close(); this.toggleCityView(true); } },
        PhoneApps.transferts(this.state),
        PhoneApps.placeholder('reglages', 'Réglages', '⚙️'),
      ],
    });
    this.disposables.push(this.phone);
    document.getElementById('phonebtn')?.addEventListener('click', () => this.phone.toggle());
    // DS OS on the laptop — the SAME app objects as the phone (minus the phone-only Plan action)
    this.laptop = new Laptop({
      state: this.state,
      apps: [
        PhoneApps.messages(this.state),
        PhoneApps.effectif(this.state),
        PhoneApps.finances(this.state),
        PhoneApps.transferts(this.state),
        PhoneApps.placeholder('emails', 'Emails', '📧', 'Boîte du club — bientôt (offres écrites, clauses).'),
      ],
    });
    this.disposables.push(this.laptop);
    document.getElementById('laptopbtn')?.addEventListener('click', () => this._toggleLaptop());

    // the DEALERSHIP: catalogue derived from the level (checkCatalog = the contract), one car per
    // podium — slowly turning, paint cycling through the display colors; E buys AT the shown color,
    // debits the personal cash (game-state) and the bought car becomes THE car driving the city.
    this.catalog = makeCatalog({ level: this.niveau });
    const catCheck = checkCatalog(this.catalog, this.state);
    if (!catCheck.ok) console.warn('checkCatalog:', catCheck.issues);
    if (this.catalog.some((m) => m.kind === 'ferrari')) {         // the three.js demo model (Draco)
      const dl = new DRACOLoader(); dl.setDecoderPath('draco/');
      const gl2 = new GLTFLoader(); gl2.setDRACOLoader(dl);
      this._ferrari = (await gl2.loadAsync('ferrari.glb')).scene;
      this._ferrari.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    }
    // more models than podiums → the showroom displays the TOP of the range (the GT and the Ferrari
    // must be in the window; the citadine sells itself)
    const podOffset = Math.max(0, this.catalog.length - (this._podiumItems || []).length);
    for (let i = 0; i < (this._podiumItems || []).length && i < this.catalog.length; i++) {
      const pod = this._podiumItems[i], entry = this.catalog[podOffset + i];
      if (!entry) break;
      const group = this._buildCarMesh(entry.kind, entry.colors[0]);
      group.position.set(pod.at[0] + pod.x, 0.16, pod.at[2] + pod.z);
      this.scene.add(group);
      const p = { entry, group, colorIdx: 0, timer: 0 };
      this._podiums.push(p);
      const wp = [pod.at[0] + pod.x, 0, pod.at[2] + pod.z];
      this.sys.add({
        label: () => (this.state.car.kind === entry.kind ? `✓ Votre ${entry.name}`
          : entry.price <= this.state.cash ? `E — Acheter ${entry.name} — ${entry.price} k€`
          : `${entry.name} — ${entry.price} k€ (fonds insuffisants)`),
        pos: () => wp, radius: 2.3,
        onInteract: () => {
          if (this.state.car.kind === entry.kind || entry.price > this.state.cash) return;
          const color = entry.colors[p.colorIdx];
          if (this.state.buyCar(entry, color).ok) this._setCar(entry.kind, color);
        },
      });
    }
    // the AGENT-EDITOR scene view (?debug=1, works on the deployed site too): colliders, interaction
    // rings, drivable routes, live panel — the human and the agent look at the SAME truth
    if (new URLSearchParams(location.search).has('debug')) {
      this.gizmos = new DebugGizmos(this.scene, {
        phys: this.phys, sys: this.sys, city: this.city,
        getState: () => ({ site: this.site, pos: [this.ctrl.pos.x, this.ctrl.pos.y, this.ctrl.pos.z] }),
      });
      this.disposables.push(this.gizmos);
    }
    window.__carriere = this;                                     // for headless verification
    window.__meshkit = { ...MESHKIT, buildParts, toGeometry };    // live modeling from the play-mode MCP
    return true;
  }

  /** Enter/exit the Top-Eleven city view (M / 🗺️ / the phone's Plan app). The aerial pose sits far
   *  from everything, so the exponential fog washes the panorama grey — thin it while up there. */
  toggleCityView(force = null) {
    if (!this.cityView) return;
    const want = force ?? !this.cityView.active;
    if (want && !this._drive) {
      this.phone?.close();
      if (this.scene.fog && this._fogD === undefined) { this._fogD = this.scene.fog.density; this.scene.fog.density = this._fogD * 0.35; }
      this.cityView.enter();
    } else if (!want) {
      if (this.scene.fog && this._fogD !== undefined) { this.scene.fog.density = this._fogD; this._fogD = undefined; }
      this.cityView.exit();
      if (this.tpc) { this.tpc._init = false; this.tpc._occDist = Infinity; }
    }
  }

  _parkCar(key) {
    if (!this.car || !this.city || this._skipCarPark) return;
    const st = this.city.stops[key]; if (!st) return;
    this.car.group.position.set(st.pos[0], 0, st.pos[1]);
  }

  /** A car mesh for a catalogue kind: procedural variants, or the ferrari GLB (cloned + repainted). */
  _buildCarMesh(kind, color) {
    if (kind === 'ferrari' && this._ferrari) {
      const g = this._ferrari.clone(true);
      const body = g.getObjectByName('body');
      if (body?.material) body.material = body.material.clone();          // independent paint per clone
      paintCar(g, color);
      return g;
    }
    const c = buildCar({ kind, color });
    this.disposables.push(c);
    return c.group;
  }

  /** Swap the player's car in the world (after a purchase) and park it at the current site. */
  _setCar(kind, color) {
    if (this.car) { this.scene.remove(this.car.group); this.car.dispose?.(); }
    if (kind === 'ferrari' && this._ferrari) {
      const group = this._buildCarMesh('ferrari', color);
      this.car = { group, wheels: findWheels(group), dispose: null };
    } else {
      const c = buildCar({ kind, color });
      this.car = c;
    }
    this.scene.add(this.car.group);
    this._parkCar(this.site);
  }

  /** Shortest leg sequence over the travel graph (for map travel between non-adjacent sites). */
  _route(from, to) {
    const prev = { [from]: null }; const q = [from];
    while (q.length) {
      const u = q.shift(); if (u === to) break;
      for (const t of this.career.travels) if (t.from === u && !(t.to in prev)) { prev[t.to] = u; q.push(t.to); }
    }
    if (!(to in prev)) return null;
    const legs = []; for (let v = to; prev[v]; v = prev[v]) legs.unshift(`${prev[v]}->${v}`);
    return legs;
  }

  /** Drive to a site: the vehicle (your car, or the team bus) follows the derived street route,
   *  elevated camera, E skips. Coming to the stadium by bus, you also ride the bus back. */
  driveTo(to, vehicle = null) {
    if (this._drive || to === this.site) return;
    this.phone?.close();
    let path = this.city?.paths?.[`${this.site}->${to}`];
    if (!path && this.city) {                                  // non-adjacent → compose the legs
      const legs = this._route(this.site, to);
      if (legs && legs.every((k) => this.city.paths[k])) {
        path = [];
        for (const k of legs) { const p = this.city.paths[k]; path = path.length ? path.concat(p.slice(1)) : p.slice(); }
      }
    }
    if (!path) return this.travelTo(to);                       // no route → instant fallback
    if (this.ctrl.seated) { this.ctrl.standUp(); this._syncBody(); }
    this._podium = false;
    const dlg = document.getElementById('dialog'); if (dlg) dlg.style.opacity = '0';
    let veh = vehicle;
    if (!veh && this._cameByBus && this.site === 'stadium') veh = this.bus;     // ride the bus back
    const isBus = veh === this.bus;
    this._drive = { driver: new PathDriver(path, { speed: isBus ? 13 : 15 }), to, vehicle: veh || this.car, isBus };
    this.ctrl.model.visible = false; this.ctrl.setMoveWorld(0, 0);
    const el = document.getElementById('site'); if (el) el.textContent = (isBus ? '🚌' : '🚗') + ' En route : ' + this.career.sites[to].label + '  (E : passer)';
    const pr = document.getElementById('prompt'); if (pr) { pr.textContent = ''; pr.style.opacity = '0'; }
  }

  /** A scouting trip (train from the gare, jet from the airport): report + shortlist on the phone. */
  _scoutTrip(mode) {
    const p = this.state.scoutTrip(mode);
    const dlg = document.getElementById('dialog');
    if (dlg) {
      dlg.textContent = `${mode === 'jet' ? '✈️' : '🚆'} Voyage de scouting à ${p.ville} — rapport reçu : ${p.name} (${p.poste}, ${p.note} estimé). Voir l’app Transferts.`;
      dlg.style.opacity = '1';
      clearTimeout(this._scoutT); this._scoutT = setTimeout(() => { dlg.style.opacity = '0'; }, 3500);
    }
  }

  /** A seated, tinted skinned clone attached to a parent — jersey teammate by default, dark suit
   *  (custom tint, no white lerp) for agents. */
  _seatedExtra(parent, seatLocal, yawLocal, tint = null) {
    const m = cloneSkinned(this._soldierGltf.scene);
    m.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; if (o.material) { o.material = o.material.clone(); o.material.color = tint != null ? new THREE.Color(tint) : new THREE.Color(this.theme.primary).lerp(new THREE.Color(0xffffff), 0.45); } } });
    const box = new THREE.Box3().setFromObject(m); m.scale.setScalar(1.8 / box.getSize(new THREE.Vector3()).y);
    const bone = (re) => { let f = null; m.traverse((o) => { if (o.isBone && re.test(o.name) && !f) f = o; }); return f; };
    const legs = [{ up: bone(/LeftUpLeg/i), knee: bone(/LeftLeg$/i) }, { up: bone(/RightUpLeg/i), knee: bone(/RightLeg$/i) }];
    const rests = legs.map((l) => ({ up: l.up.rotation.x, knee: l.knee.rotation.x }));
    const mixer = new THREE.AnimationMixer(m);
    mixer.clipAction(this._soldierGltf.animations.find((a) => /idle/i.test(a.name))).play();
    m.position.set(seatLocal[0], seatLocal[1] + 0.47 + 0.08 - (this.ctrl?.hipH ?? 0.91), seatLocal[2]);
    m.rotation.y = yawLocal;
    parent.add(m);
    this._extras.push({ mixer, legs, rests });
    return m;
  }

  /** Mount a WALKABLE vehicle interior at a parked pose: cabin meshes + rotated colliders + the
   *  board/leave doors, sittable seats and the scouting interactable inside. */
  _mountCabin(kind, pos, yaw, emoji, name, exitPos) {
    const model = generateCabin({ kind });
    const chk = checkCabin(model);
    if (!chk.ok) console.warn('checkCabin', kind, chk.issues);
    const built = buildCabin(model, { theme: this.theme });
    built.group.position.set(pos[0], pos[1], pos[2]); built.group.rotation.y = yaw;
    this.scene.add(built.group); this.disposables.push(built);
    const W = (p) => [pos[0] + p[0] * Math.cos(yaw) + p[2] * Math.sin(yaw), pos[1] + p[1], pos[2] - p[0] * Math.sin(yaw) + p[2] * Math.cos(yaw)];
    const q = [0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)];
    for (const c of built.colliders) this.phys.addStaticBox(W(c.pos), c.half, q);
    const sh = model.shell, mode = kind === 'jet' ? 'jet' : 'train';
    const doorOut = W([sh.W / 2 + 1.1, 0, model.door.z]);                 // on the ground, by the door
    const inSpawn = W([0, 0, model.door.z - 0.1]);                        // in the aisle, CLEAR of row 0
    this.sys.add({
      label: `E — Monter à bord ${name} ${emoji}`, pos: () => doorOut, radius: 1.8,
      onInteract: () => this._teleport([inSpawn[0], sh.floorY, inSpawn[2]], yaw + Math.PI),
    });
    this.sys.add({
      label: 'E — Descendre', pos: () => [inSpawn[0], sh.floorY, inSpawn[2]], radius: 1.1,
      onInteract: () => this._teleport([exitPos[0], 0, exitPos[2]], yaw),
    });
    model.tables.forEach((t, ti) => {                                     // lounge tables: scouting, vacation
      const tw = W([t.x, 0, t.z]);
      if (ti === 0) this.sys.add({ label: `E — Voyage de scouting ${emoji} (${mode === 'jet' ? 'étranger' : 'national'})`, pos: () => tw, radius: 1.1, onInteract: () => this._scoutTrip(mode) });
      else this.sys.add({ label: `E — Partir en vacances 🏖️ ${emoji}`, pos: () => tw, radius: 1.1, onInteract: () => this._goVacation() });
    });
    // the jet's second lounge pair is reserved for the in-flight MEETING (wired after the rig loads)
    let meetSeats = [];
    if (kind === 'jet' && model.tables.length > 1) {
      const mt = model.tables[1];
      meetSeats = model.seats.filter((s) => !s.driver && Math.abs(s.x - mt.x) < 0.35 && Math.abs(s.z - mt.z) < 1.2).slice(0, 2);
    }
    for (const s of model.seats) {                                        // the seats are sittable
      if (s.driver || meetSeats.includes(s)) continue;
      const swp = W([s.x, 0, s.z]);
      const fYaw = yaw + s.yaw;                                           // furniture yaw in world
      this.sys.add({
        label: () => (this.ctrl?.seated ? 'E — Se lever' : 'E — S’asseoir'),
        pos: () => swp, radius: 0.9,
        onInteract: () => {
          if (this.ctrl.seated) { this.ctrl.standUp(); this._syncBody(); }
          else this.ctrl.sitAt({ pos: [swp[0], 0, swp[2]], yaw: this.ctrl.yawFor(Math.sin(fYaw), Math.cos(fYaw)), seatH: 0.47 });
        },
      });
    }
    // the FLYING RECRUITMENT ROOM: remember the jet cabin — the suited agent and his meeting are
    // wired AFTER the character rig loads (the NPC is a skinned clone of it)
    if (kind === 'jet') this._jetCabin = { built, model, W, yaw, sh, meetSeats };
  }

  /** Open/fold the laptop (O / 💻): the prop's hinge animates, DS OS opens once the lid is up. */
  _toggleLaptop() {
    if (this._drive || this._wheel || !this.laptopProp) return;
    this._laptopOpen = !this._laptopOpen;
    if (this._laptopOpen) { this.phone?.close(); this.laptopProp.group.visible = true; this._laptopUiPending = true; }
    else { this._laptopUiPending = false; this.laptop?.close(); }
  }

  /** Take the wheel of YOUR car (free driving): kinematic capsule = real collisions with the city. */
  _enterDrive() {
    if (this._wheel || this._drive) return;
    if (this.ctrl.seated) { this.ctrl.standUp(); this._syncBody(); }
    const cp = this.car.group.position;
    if (!this._carBody) this._carBody = this.phys.addCharacter([cp.x, 0, cp.z], { radius: 0.95, height: 2.0 });
    else { const t = { x: cp.x, y: 1.0, z: cp.z }; this._carBody.body.setTranslation(t, true); this._carBody.body.setNextKinematicTranslation(t); }
    const drv = new DriveController({ pos: [cp.x, cp.z], yaw: this.car.group.rotation.y });
    drv.collide = (dx, dz) => { const r = this._carBody.move(dx, -0.5 * (1 / 60), dz); return { dx: r.dx, dz: r.dz }; };
    this._wheel = { drv };
    this.ctrl.model.visible = false; this.ctrl.setMoveWorld(0, 0);
    if (this._circuit && Math.hypot(cp.x - this._circuit.grid[0], cp.z - this._circuit.grid[1]) < 60) {
      this._wheel.timer = makeLapTimer({ ...this._circuit.model, start: { pos: [this._circuit.at[0] + this._circuit.model.start.pos[0], this._circuit.at[2] + this._circuit.model.start.pos[1]], dir: this._circuit.model.start.dir } });
    }
    const el = document.getElementById('site'); if (el) el.textContent = '🚗 Au volant — ZQSD conduire · E descendre';
  }

  /** Step out: the car stays where you stopped, you appear at the driver's door. */
  _exitDrive() {
    const { drv } = this._wheel; this._wheel = null;
    const side = [Math.cos(drv.yaw), -Math.sin(drv.yaw)];
    this._teleport([drv.pos[0] + side[0] * 1.7, 0, drv.pos[1] + side[1] * 1.7], drv.yaw);
    this.ctrl.model.visible = true;
    if (this._celebrate) { this._celebrate = false; this._gesture?.('celebration'); }   // new lap record
    this._siteHudSafe();
  }

  /** Track day: teleport your car to the circuit grid and take the wheel, chrono armed. */
  _goCircuit() {
    if (!this._circuit || this._wheel) return;
    this._circFrom = this.site;
    this.site = 'circuit';
    this.car.group.position.set(this._circuit.grid[0], 0, this._circuit.grid[1]);
    this.car.group.rotation.y = this._circuit.gridYaw;
    this._teleport([this._circuit.spawn[0], 0, this._circuit.spawn[1]], this._circuit.gridYaw);
    this._enterDrive();
    const dlg = document.getElementById('dialog');
    if (dlg) {
      dlg.textContent = '🏁 Journée circuit — passez la ligne pour lancer le chrono. E pour descendre, pad bleu pour rentrer.';
      dlg.style.opacity = '1';
      clearTimeout(this._scoutT); this._scoutT = setTimeout(() => { dlg.style.opacity = '0'; }, 4500);
    }
  }

  _siteHudSafe() {
    const el = document.getElementById('site'); if (!el) return;
    const s = this.career.sites[this.site];
    el.textContent = s ? '📍 ' + s.label : (this.site === 'circuit' ? '🏁 Circuit — journée essais' : '🏖️ Station balnéaire — vacances');
  }

  /** Off to the seaside resort (from the train or the jet lounge): land on the sand outside the
   *  villa, the forme comes back to 100 (game-state.vacation) — the return pad brings you back. */
  _goVacation() {
    if (!this._resort || this.site === 'vacances') return;
    this._vacFrom = this.site;
    if (this.ctrl.seated) { this.ctrl.standUp(); this._syncBody(); }
    this._teleport(this._resort.spawn, Math.PI / 2);              // facing the villa entrance (+x)
    const r = this.state.vacation();
    this.site = 'vacances';
    const el = document.getElementById('site'); if (el) el.textContent = '🏖️ Station balnéaire — vacances';
    const dlg = document.getElementById('dialog');
    if (dlg) {
      dlg.textContent = `🏖️ Vacances au bord de la mer — forme +${r.gained} (100 %). Les transats vous attendent.`;
      dlg.style.opacity = '1';
      clearTimeout(this._scoutT); this._scoutT = setTimeout(() => { dlg.style.opacity = '0'; }, 3500);
    }
  }

  /** Put the character (feet) somewhere, instantly, and snap the camera behind. */
  _teleport(p, faceYaw = 0) {
    const c = this.char, t = { x: p[0], y: p[1] + c.center, z: p[2] };
    c.body.setTranslation(t, true); c.body.setNextKinematicTranslation(t);
    this.ctrl.pos.set(p[0], p[1], p[2]); this.ctrl.groundY = p[1]; this.ctrl.vy = 0;
    this.ctrl.model.position.copy(this.ctrl.pos);
    this.ctrl.faceInstant(Math.sin(faceYaw), Math.cos(faceYaw));
    if (this.tpc) { this.tpc._init = false; this.tpc._occDist = Infinity; }
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
    for (const p of this._podiums) {                            // showroom life: turntables + paint cycle
      p.group.rotation.y += dt * 0.5;
      p.timer += dt;
      if (p.timer > 2.5) { p.timer = 0; p.colorIdx = (p.colorIdx + 1) % p.entry.colors.length; paintCar(p.group, p.entry.colors[p.colorIdx]); }
    }
    for (const e of this._extras || []) {                       // seated teammates: idle anim + bent legs
      e.mixer.update(dt);
      e.legs.forEach((l, i) => { l.up.rotation.x = e.rests[i].up - 1.35; l.knee.rotation.x = e.rests[i].knee + 1.4; });
    }
    if (this._wheel) {                                          // AT THE WHEEL: free driving
      this.input.update();
      const mv = this.input.move();
      const s = this._wheel.drv.update(dt, { throttle: mv.z, steer: mv.x, brake: this.input.downStrict('sprint') });
      this.car.group.position.set(s.x, 0, s.z); this.car.group.rotation.y = s.yaw;
      for (const w of this.car.wheels || []) w.rotation.x += s.wheelSpin * dt;
      if (this._wheel.timer) {                                  // circuit: live chrono + record
        const r = this._wheel.timer.update(dt, s.x, s.z);
        const el = document.getElementById('site');
        if (el) el.textContent = `🏁 Tour : ${r.time.toFixed(1)} s${this.state.bestLap ? ' — record ' + this.state.bestLap.toFixed(2) + ' s' : ''} · vitesse ${(Math.abs(s.speed) * 3.6).toFixed(0)} km/h`;
        if (r.lap) {
          const rec = this.state.recordLap(r.lap);
          if (rec.better) this._celebrate = true;                 // arms up when you step out
          const dlg = document.getElementById('dialog');
          if (dlg) { dlg.textContent = rec.better ? `🏁 ${r.lap.toFixed(2)} s — RECORD !` : `🏁 ${r.lap.toFixed(2)} s (record ${rec.best.toFixed(2)} s)`; dlg.style.opacity = '1'; clearTimeout(this._scoutT); this._scoutT = setTimeout(() => { dlg.style.opacity = '0'; }, 3000); }
        }
      }
      const cam = this.tpc.cam, k = 1 - Math.exp(-3.5 * dt);
      const fx = Math.sin(s.yaw), fz = Math.cos(s.yaw);
      this._tmp.set(s.x - fx * 7.5, 3.1, s.z - fz * 7.5);
      cam.position.lerp(this._tmp, k);
      cam.lookAt(s.x + fx * 6, 0.9, s.z + fz * 6);
      if (this.input.pressed('interact')) this._exitDrive();
      this.input.endFrame();
      this.phys.step();
      return;
    }
    if (this._drive) {                                          // EN ROUTE: the car drives the streets
      this.input.update();
      if (this.input.pressed('interact')) this._drive.driver.finish();   // E skips the trip
      this.input.endFrame();
      const d = this._drive.driver.update(dt);
      const veh = this._drive.vehicle;
      veh.group.position.set(d.x, 0, d.z); veh.group.rotation.y = d.yaw;
      for (const w of veh.wheels || []) w.rotation.x += d.wheelSpin * dt;
      const fx = Math.sin(d.yaw), fz = Math.cos(d.yaw);
      const cam = this.tpc.cam, k = 1 - Math.exp(-2.2 * dt);
      if (this._drive.isBus && this._busCabin) {                // MATCHDAY: ride INSIDE, with the team
        const sh = this._busCabin.model.shell;
        this._tmp.set(0.51, sh.floorY + 1.34, -0.4);
        this.bus.group.localToWorld(this._tmp);
        cam.position.copy(this._tmp);
        cam.lookAt(d.x + fx * 20, 1.5, d.z + fz * 20);
      } else {                                                  // elevated chase camera → you SEE the city
        this._tmp.set(d.x - fx * 13, 31, d.z - fz * 13);
        if (!this._driveCamInit) { cam.position.copy(this._tmp); this._driveCamInit = true; } else cam.position.lerp(this._tmp, k);
        cam.lookAt(d.x + fx * 10, 1, d.z + fz * 10);
      }
      if (d.done) {
        const { to, isBus } = this._drive; this._drive = null; this._driveCamInit = false;
        if (isBus) {                                            // the bus parks; your car stays where it was
          this._cameByBus = to === 'stadium';
          if (!this._cameByBus) this.bus.group.position.set(this._busHome[0], 0, this._busHome[1]);
          this._skipCarPark = true; this.travelTo(to); this._skipCarPark = false;
        } else this.travelTo(to);
      }
      return;
    }
    this.input.update();
    if (this.input.pressed('phone')) this.phone?.toggle();
    if (this.input.pressed('map')) this.toggleCityView();
    if (this.input.pressed('laptop')) this._toggleLaptop();
    this.phone?.update(); this.laptop?.update();
    // the laptop prop: ease the hinge; DS OS comes up once the lid is fully open (screen lit)
    if (this.laptopProp) {
      const moving = this.laptopProp.update(dt, this._laptopOpen);
      if (this._laptopOpen && this._laptopUiPending && !moving) { this._laptopUiPending = false; this.laptop.open(); }
      if (!this._laptopOpen && !moving) this.laptopProp.group.visible = false;
    }
    if (this.cityView?.active) {                                // CITY VIEW: panorama + pins, world waits
      this.input.endFrame();
      this.cityView.update(this.tpc.cam, dt);
      this.ctrl.setMoveWorld(0, 0); this.ctrl.update(dt); this.npc?.update(dt); this.phys.step();
      return;
    }
    if (this.phone?.isOpen || this.laptop?.isOpen) {            // phone or DS OS open → the world waits
      this.input.endFrame();
      this.ctrl.setMoveWorld(0, 0); this.ctrl.update(dt); this.npc?.update(dt); this.phys.step();
      return;
    }
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
    this.gizmos?.update(window.__engine?.renderer);
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
