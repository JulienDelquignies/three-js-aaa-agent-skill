import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { generateStadium, checkStadium } from '../engine/stadium.js';
import { buildStadium } from '../engine/stadium-builder.js';
import { makeTheme } from '../engine/club-theme.js';
import { setupStadiumNight, checkStadiumNight } from '../engine/stadium-night.js';
import { createRenderPipeline, checkRenderPipeline } from '../engine/render-pipeline.js';
import { buildKit } from '../engine/kit.js';
import { loadSquad, setCloner } from '../engine/squad.js';
import { CharacterController } from '../engine/character-controller.js';
import { MOVES, mirrorMove } from '../engine/animkit.js';
import { toClip, playGesture } from '../engine/animkit-builder.js';
import { BALL } from '../engine/ball.js';
import { makeRondo, RONDO } from '../engine/rondo.js';
import { rondoStep, checkRondo } from '../engine/rondo-sim.js';
import { buildRondoGrid, ballMesh } from './rondo-props.js';

// Rondo — a 5 v 5 "passe à dix" on the centre circle of the Grand Bol, under floodlights.
//
// The split that makes this work: the GAME is decided by rondo-sim (proved headless, 20/20 —
// jobs, lane-scored passing, inverse ballistics, tackles, interceptions), and this file only
// DRESSES it. Player positions come from the simulation; the CharacterControllers are driven so
// their locomotion state, cadence and foot-lock follow those positions instead of inventing a
// second, disagreeing motion. One source of truth, two consumers.
//
// The stadium places pitch centre at the world origin (grass Y = 0, long axis X), so the rondo
// grid's own coordinates are already world coordinates — no frame conversion anywhere.

const TEAMS = [
  { name: 'Grand Bol', primary: 0xe8ecf2, secondary: 0x16233f, shorts: 0x16233f, socks: 0xe8ecf2 },
  { name: 'Rivaux', primary: 0xc8202f, secondary: 0x14161c, shorts: 0x14161c, socks: 0xc8202f },
];

export class Rondo {
  constructor(scene, renderer) {
    this.scene = scene; this.renderer = renderer;
    this.disposables = [];
    this.players = [];
    this._t = 0;
    this._lastEvent = 0;
    this.ready = this._build();
  }

  async _build() {
    const q = new URLSearchParams(location.search);
    this.free = q.has('orbit');

    // ---- the stadium: pitch centre at the origin so sim space IS world space
    const model = generateStadium({ tier: 5, landmark: 'grandbol' });
    const chk = checkStadium(model);
    if (!chk.ok) console.warn('checkStadium', chk.issues);
    const theme = makeTheme({ seed: 3, name: 'Grand Bol', primary: TEAMS[0].secondary, secondary: TEAMS[0].primary });
    const built = buildStadium(model, theme, { at: [0, 0, 0] });
    this.scene.add(built.group); this.disposables.push(built);
    this.scene.fog = new THREE.FogExp2(0x0a1020, 0.0016);

    // ---- night: floodlights + one shadow-casting sun fitted to the pitch
    this.night = setupStadiumNight(this.scene, this.renderer, { at: [0, 0, 0], model });
    this.disposables.push(this.night);
    this._reports = { stadium: chk, night: checkStadiumNight(this.night, model), kits: [] };

    this._tier = q.get('q') || 'high';   // the post chain is built in camera(), once we have one

    // ---- the grid the game is played in, painted on the grass
    this.grid = buildRondoGrid(RONDO.area);
    this.scene.add(this.grid.group); this.disposables.push(this.grid);

    this.ball = ballMesh();
    this.scene.add(this.ball); this.disposables.push(this.ball);
    // the key is masked to the pitch (that is what makes the bowl fall away into night), so anything
    // standing ON the pitch has to be opted in or it goes unlit
    this.night.light(this.grid.group); this.night.light(this.ball);

    // ---- the game itself
    this.state = makeRondo({ perTeam: 5, seed: Number(q.get('seed')) || 7 });

    // ---- the squad. The scene no longer knows which GLB it is casting: squad.js loads a ROSTER,
    // normalises facing/height, and transports the donor's locomotion onto every imported rig.
    //
    // Cast: SHANON for both sides, told apart by kit colour. The obvious idea — one body per team, so
    // the sides read apart before the colours do — was built and looked at, and it is wrong here: the
    // Soldier is an ARMOURED sci-fi character, and kit.js fits its rings to the body cloud it is given,
    // so his shoulder plates and backpack turn the jersey into a sack. A generated strip only reads as
    // a strip over a body shaped like a person. He stays aboard as the clip DONOR, where his armour
    // costs nothing. ?rig=mix restores the two-body cast, ?rig=soldier the original single-rig one.
    setCloner(cloneSkinned);
    const SHANON = { url: 'shanon.glb', faces: '+Z', name: 'shanon', dequantize: true, matte: true, hide: /Shirt|Shorts|Socks/i };
    // Her shirt, skin and boots share ONE texture atlas and ONE material, so recolouring the jersey per
    // team would tint her skin with it: hide her own strip, build the kit over the bare body instead.
    const SOLDIER = { url: 'Soldier.glb', faces: '-Z', name: 'soldier' };
    const rigParam = q.get('rig');
    const roster = rigParam === 'soldier' ? [SOLDIER] : rigParam === 'mix' ? [SHANON, SOLDIER] : [SHANON];
    this.squad = await loadSquad(new GLTFLoader(), { rigs: roster, donor: 'Soldier.glb', height: 1.8 });
    this._reports.squad = this.squad.check;
    this.disposables.push(this.squad);
    if (!this.squad.check.ok) console.warn('checkSquad', this.squad.check.issues);

    // Order matters: scale and place BEFORE constructing the controller (it snapshots
    // position/yaw/groundY and measures hip height and foot floors from the live rig).
    for (const p of this.state.players) {
      // one rig per TEAM rather than round-robin: the two sides must be told apart at a glance, and
      // two different bodies do that even before the kit colours do
      const { model: model3d, groundY, clips, rig } = this.squad.spawn(p.team);
      model3d.position.set(p.p[0], groundY, p.p[2]);
      model3d.rotation.y = 0;
      this.scene.add(model3d);
      model3d.updateMatrixWorld(true);

      // the kit — built after scale/placement because the skeleton binds to the pose as it stands
      const t = TEAMS[p.team];
      const kit = buildKit(model3d, { shirt: t.primary, shorts: t.shorts, socks: t.socks, trim: t.secondary, number: p.id + 1 });
      if (kit.group) model3d.add(kit.group);
      else this._reports.kits.push(kit.check?.issues);
      if (kit.check && !kit.check.ok) this._reports.kits.push(kit.check.issues);

      const mixer = new THREE.AnimationMixer(model3d);
      const bone = (re) => { let f = null; model3d.traverse((o) => { if (o.isBone && re.test(o.name) && !f) f = o; }); return f; };
      const legs = [
        { up: bone(/LeftUpLeg/i), knee: bone(/LeftLeg$/i), foot: bone(/LeftFoot/i) },
        { up: bone(/RightUpLeg/i), knee: bone(/RightLeg$/i), foot: bone(/RightFoot/i) },
      ];
      const ctrl = new CharacterController(model3d, {
        mixer,
        runClip: clips.find((a) => /run/i.test(a.name)),
        idleClip: clips.find((a) => /idle/i.test(a.name)),
        walkClip: clips.find((a) => /walk/i.test(a.name)),
        legs, stride: 2.6, runSpeed: RONDO.speeds.chase,
        forwardLocal: new THREE.Vector3(0, 0, -1),
      });
      this.night.light(model3d);            // opt the player (kit included) into the key's layer
      this.players.push({ sim: p, model: model3d, ctrl, mixer, groundY, rig });
    }

    // ---- passing gestures, BOTH feet. Every strike in the library is right-footed; mirrorMove
    // gives the exact left-footed twin, so a player passing to his left uses the near foot.
    // ONE SET PER RIG. Gesture tracks address bones by NAME, and two Mixamo exports rarely share a
    // prefix (mixamorig… vs mixamorig5…), so a clip compiled against one rig binds to nothing on the
    // other — the player would simply not swing his leg, silently. Compile per rig, look up per player.
    this.gest = new Map();
    for (const pl of this.players) {
      if (this.gest.has(pl.rig)) continue;
      this.gest.set(pl.rig, {
        right: toClip(MOVES.passe, pl.model),
        left: toClip(mirrorMove(MOVES.passe), pl.model),
        control: toClip(MOVES.amorti, pl.model),
      });
    }

    this._hud = document.getElementById('score');
    // play-mode handles: runner.js sets window.__scene for every scene, and the MCP probes a
    // controller to know the scene is live — expose the first player's for that readiness check
    this.ctrl = this.players[0]?.ctrl;
    window.__rondo = this; window.__carriere = this;
    // a live trace, so the contract can be checked on the REAL running game at any moment
    this._trace = [];
    return true;
  }

  camera(cam, controls) {
    // broadcast framing: long lens, low, from the main stand side (negative Z)
    // The main stand (and its roof) sits on the NEGATIVE z side and begins at z = -(34 + apron 6):
    // a camera at z = -46 is INSIDE it, filming the underside of the seating. The broadcast rig
    // goes on the gantry over the touchline instead — clear of the stand, high enough to see the
    // far side of the grid.
    cam.fov = 34; cam.updateProjectionMatrix();
    cam.position.set(0, 16, -38);
    cam.lookAt(0, 1, 0);
    this.cam = cam;
    if (controls) {
      controls.enabled = this.free;
      controls.target.set(0, 1, 0);
      this.controls = controls;
    }
    // AAA post chain, built here because it needs the real camera. runner.js adopts scene.postfx.
    this.pipeline = createRenderPipeline(this.renderer, this.scene, cam, { tier: this._tier, sun: this.night?.sun });
    this.postfx = this.pipeline;
    if (this._reports) this._reports.pipeline = checkRenderPipeline(this.pipeline, this.renderer);
    window.__rondoReport = this._reports;
  }

  /** The broadcast camera: it TRACKS the ball with lag and a touch of overshoot, the way a real
   *  operator pans. Copying that lag buys more perceived realism than any shader. */
  _broadcast(dt) {
    if (this.free || !this.cam) return;
    const b = this.state.ball.p;
    if (!this._look) this._look = new THREE.Vector3(0, 1, 0);
    if (!this._camV) this._camV = 0;
    const targetX = THREE.MathUtils.clamp(b[0], -18, 18);
    this._look.x += (b[0] - this._look.x) * Math.min(1, dt * 2.4);      // lag
    this._look.z += (b[2] - this._look.z) * Math.min(1, dt * 2.4);
    this._look.y += (1 - this._look.y) * Math.min(1, dt * 3);
    const px = this.cam.position.x + (targetX * 0.55 - this.cam.position.x) * Math.min(1, dt * 1.5);
    this.cam.position.set(px, 16, -38);
    this.cam.lookAt(this._look);
  }

  update(dt) {
    if (!this.state) return;
    const step = Math.min(dt, 1 / 30);
    const before = this.state.events.length;
    rondoStep(this.state, step);

    // ---- react to what the game just did: a pass fires the correct-foot strike on the passer
    for (let i = before; i < this.state.events.length; i++) {
      const e = this.state.events[i];
      if (e.type === 'pass') {
        const pl = this.players[e.from];
        const g = pl && this.gest.get(pl.rig);
        // start the strike AT ITS CONTACT FRAME. The 'pass' event means the ball has just left, so a
        // clip started at t=0 would put the leg into its backswing while the ball is already gone —
        // which is precisely what reads as "the ball never really leaves his foot". Starting at contact
        // costs the backswing and buys the thing that matters: boot on ball at the frame it goes.
        const c = e.foot === 'left' ? g?.left : g?.right;
        if (c) playGesture(pl.mixer, c, { from: c.userData?.contact ?? 0, fade: 0.06 });
      } else if (e.type === 'receive') {
        const pl = this.players[e.by];
        const g = pl && this.gest.get(pl.rig);
        if (g) playGesture(pl.mixer, g.control, { from: g.control.userData?.contact ?? 0, fade: 0.06 });
      }
    }

    // ---- dress the simulation: the sim owns positions, the controller owns the locomotion state
    const top = RONDO.speeds.chase;
    for (const pl of this.players) {
      const s = pl.sim;
      pl.ctrl.setMoveWorld(s.v[0] / top, s.v[1] / top);       // magnitude picks idle / walk / run
      pl.ctrl.update(step);
      pl.ctrl.pos.set(s.p[0], pl.groundY, s.p[2]);            // then snap to the proven truth
      pl.model.position.copy(pl.ctrl.pos);
    }

    // ---- the ball, spun by its own angular velocity
    const b = this.state.ball;
    this.ball.position.set(b.p[0], b.p[1], b.p[2]);
    this.ball.rotation.x += b.w[0] * step; this.ball.rotation.y += b.w[1] * step; this.ball.rotation.z += b.w[2] * step;

    this._broadcast(step);
    this._t += step;
    if (this._trace.length < 4000 && Math.floor(this._t * 10) !== Math.floor((this._t - step) * 10)) {
      this._trace.push({
        t: +this._t.toFixed(2), phase: this.state.phase, team: this.state.possession.team,
        passes: this.state.passes, since: 99,
        ball: this.state.ball.p.map((v) => +v.toFixed(2)),
        players: this.state.players.map((p) => ({ id: p.id, team: p.team, job: p.job, p: [+p.p[0].toFixed(2), +p.p[2].toFixed(2)], speed: +p.speed.toFixed(2) })),
      });
    }
    if (this._hud && this._t - this._lastEvent > 0.15) {
      this._lastEvent = this._t;
      const teamName = TEAMS[this.state.possession.team].name;
      this._hud.innerHTML = `<b>${this.state.passes}</b> passes <span>· record ${this.state.best} · ${this.state.turnovers} pertes</span><br><span>possession : ${teamName}</span>`;
    }
  }

  /** The running game, judged by the same contract the headless harness uses. */
  check() { return checkRondo(this.state, this._trace); }

  dispose() {
    this.pipeline?.dispose?.();
    for (const d of this.disposables) d.dispose?.();
    for (const pl of this.players) this.scene.remove(pl.model);
  }
}
