import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { generateStadium, checkStadium } from '../engine/stadium.js';
import { buildStadium } from '../engine/stadium-builder.js';
import { makeTheme } from '../engine/club-theme.js';
import { setupStadiumNight, checkStadiumNight } from '../engine/stadium-night.js';
import { createRenderPipeline, checkRenderPipeline } from '../engine/render-pipeline.js';
import { buildKit } from '../engine/kit.js';
import { tintPart } from '../engine/part-tint.js';
import { loadSquad, setCloner } from '../engine/squad.js';
import { CharacterController } from '../engine/character-controller.js';
import { MOVES, mirrorMove } from '../engine/animkit.js';
import { toClip, playGesture } from '../engine/animkit-builder.js';
import { BALL } from '../engine/ball.js';
import { makeRondo, RONDO } from '../engine/rondo.js';
import { rondoStep, checkRondo } from '../engine/rondo-sim.js';
import { byId as TECHNIQUES_BY_ID } from '../engine/technique.js';
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
    this._reports = { stadium: chk, night: checkStadiumNight(this.night, model), kits: [], gestes: [] };

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
    // ?n=3 pour un 3 contre 3. Sur un téléphone, dix bonshommes dans un carré de 16 m sont dix taches
    // de trois pixels ; à six, on voit ce que chacun fait — ce qui est tout l'intérêt de la scène.
    const perTeam = Math.max(2, Math.min(6, Number(q.get('n')) || 5));
    this.state = makeRondo({ perTeam, seed: Number(q.get('seed')) || 7 });
    this.perTeam = perTeam;

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
    // KITS OFF by default: the players wear Shanon's OWN strip, which is a real modelled football kit
    // with proper collar, cuffs and sock ribs — the generated one is a set of lofted tubes and reads
    // like it. ?kit=1 puts the generated strip back (and hides hers, since the two would fight).
    // The cost is stated plainly below: with her own strip there is only one strip.
    this.kits = q.get('kit') === '1';
    const SHANON = { url: 'shanon.glb', faces: '+Z', name: 'shanon', dequantize: true, matte: true, ...(this.kits ? { hide: /Shirt|Shorts|Socks/i } : {}) };
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

      // TWO SHIRT COLOURS, WITHOUT A SECOND SHIRT. The character's own strip is one texture atlas
      // shared with his skin and boots, so it cannot be recoloured per team. What a rondo actually
      // uses is a BIB: one team keeps its strip, the other pulls a coloured one over the top. Minimal
      // geometry, one flat colour, nothing to get wrong — and it is the true answer rather than a
      // workaround.
      // DEUX COULEURS D'ÉQUIPE, SANS VÊTEMENT EN PLUS. La chasuble était un contournement d'une
      // supposition fausse : j'avais écrit que maillot, peau et crampons partageaient un matériau et
      // qu'on ne pouvait donc pas les séparer. Mesuré, le fichier contient SEPT meshes dont un
      // `Ch38_Shirt`, et le matériau est un attribut du draw call — teindre le maillot ne peut pas
      // atteindre la peau. Voir engine/part-tint.js.
      const tint = tintPart(model3d, { match: /Shirt/i, color: TEAMS[p.team].primary });
      if (!tint.check.ok) this._reports.kits.push(tint.check.issues);

      // the kit — built after scale/placement because the skeleton binds to the pose as it stands
      if (this.kits) {
        const t = TEAMS[p.team];
        const kit = buildKit(model3d, { shirt: t.primary, shorts: t.shorts, socks: t.socks, trim: t.secondary, number: p.id + 1 });
        if (kit.group) model3d.add(kit.group);
        else this._reports.kits.push(kit.check?.issues);
        if (kit.check && !kit.check.ok) this._reports.kits.push(kit.check.issues);
      }

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
    // ONE SET PER RIG, ONE CLIP PER MOVE, BOTH FEET. Gesture tracks address bones by NAME, and two
    // Mixamo exports rarely share a prefix, so a clip compiled against one rig binds to nothing on the
    // other — the player simply would not swing his leg, silently. And the gesture must be the one the
    // TECHNIQUE named: a backheel and an inside pass are not the same movement, and at this camera
    // distance playing one for the other is the difference between football and mime.
    // LES CLIPS SONT DÉRIVÉS DE LA TABLE DES TECHNIQUES, PAS ÉNUMÉRÉS À LA MAIN. Cette ligne tenait
    // cinq noms écrits en dur, et `_playTech` retombe sur `set.passe` quand le clip demandé manque :
    // mesuré, 502 gestes de ballon sur 876 (57,3 %) dessinaient une passe de l'intérieur QUELLE QUE
    // SOIT la technique choisie. Les huit gestes ajoutés à la session précédente — passe en pivot,
    // extérieur, déviation, contrôle semelle, amorti cuisse… — n'ont jamais été visibles une seule
    // fois à l'écran. C'est la vraie raison de « ça se voit même pas le mouvement », bien avant
    // l'amplitude des poses : on regardait le mauvais geste une fois sur deux.
    // Dériver la liste de TECHNIQUES rend l'oubli impossible : ajouter une technique compile son clip.
    const MOVE_IDS = [...new Set([
      ...Object.values(TECHNIQUES_BY_ID).map((t) => t.clip).filter((c) => MOVES[c]),
      'passe', 'frappe', 'amorti', 'tacle',
    ])];
    this.gest = new Map();
    for (const pl of this.players) {
      if (this.gest.has(pl.rig)) continue;
      const set = {};
      for (const id of MOVE_IDS) {
        set[id] = { right: toClip(MOVES[id], pl.model), left: toClip(mirrorMove(MOVES[id]), pl.model) };
      }
      this.gest.set(pl.rig, set);
    }
    // …et on le prouve au démarrage plutôt qu'à l'usage : toute technique dont le clip n'est pas
    // compilé est un geste que le joueur jouera sans qu'on le voie.
    {
      const set = this.gest.values().next().value || {};
      const manquants = Object.values(TECHNIQUES_BY_ID).map((t) => t.clip).filter((c) => !set[c]);
      if (manquants.length) this._reports.gestes.push(`techniques sans clip compilé : ${[...new Set(manquants)].join(', ')}`);
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
    // Framed for the BOX, not for the stadium. The grid is 16 x 14 m; the old rig sat 38 m out with a
    // 34° lens because the grid used to be 34 x 26, and at that distance a 22 cm ball is about five
    // pixels wide — which is most of why "the ball is far from the players" reads true even when the
    // measurement says it is a metre from the nearest man.
    // La caméra se rapproche quand il y a moins de monde ET quand l'écran est étroit : à 19 m sur un
    // téléphone en portrait, le carré tient dans un tiers de la hauteur et on ne distingue plus un
    // geste d'un autre. Le cadrage est dérivé, pas écrit en dur.
    const narrow = typeof window !== 'undefined' && window.innerWidth < 700;
    const back = 19 - (5 - this.perTeam) * 1.6 - (narrow ? 3.5 : 0);
    cam.fov = narrow ? 34 : 30; cam.updateProjectionMatrix();
    cam.position.set(0, 8.5 - (narrow ? 1.2 : 0), -back);
    this._camBack = back;
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

  /** Play the gesture the technique named, on the foot it named. `from` is normally 0 — the beginning
   *  of the movement — because the simulation now starts the swing BEFORE the ball leaves and the ball
   *  leaves at the clip's own contact frame (engine/gesture.js). Only reactive gestures, the ones the
   *  game reports after the fact, still start at contact. */
  _playTech(pl, e, from = 0) {
    const set = this.gest.get(pl.rig);
    if (!set) return;
    const move = e.move || (e.tech && TECHNIQUES_BY_ID[e.tech]?.clip) || (e.type === 'control' ? 'amorti' : 'passe');
    // UN CLIP MANQUANT DOIT SE VOIR. Ce repli était silencieux (`set[move] || set.passe`), et c'est
    // exactement pourquoi 57 % des gestes ont pu dessiner le mauvais mouvement pendant toute une
    // session sans qu'aucun contrat ne bronche : le jeu affichait quelque chose de plausible. Un repli
    // qui se tait est pire qu'une erreur.
    const pair = set[move] || (this._reports.gestes.push(`clip absent : ${move}`), set.passe);
    const clip = e.foot === 'left' ? pair.left : pair.right;
    if (clip) playGesture(pl.mixer, clip, { from: from === 'contact' ? (clip.userData?.contact ?? 0) : 0, fade: 0.06 });
  }

  /** The broadcast camera: it TRACKS the ball with lag and a touch of overshoot, the way a real
   *  operator pans. Copying that lag buys more perceived realism than any shader. */
  _broadcast(dt) {
    if (this.free || !this.cam) return;
    const b = this.state.ball.p;
    if (!this._look) this._look = new THREE.Vector3(0, 1, 0);
    if (!this._camV) this._camV = 0;
    const targetX = THREE.MathUtils.clamp(b[0], -8, 8);
    this._look.x += (b[0] - this._look.x) * Math.min(1, dt * 2.4);      // lag
    this._look.z += (b[2] - this._look.z) * Math.min(1, dt * 2.4);
    this._look.y += (1 - this._look.y) * Math.min(1, dt * 3);
    const px = this.cam.position.x + (targetX * 0.55 - this.cam.position.x) * Math.min(1, dt * 1.5);
    this.cam.position.set(px, this.cam.position.y, -this._camBack);
    this.cam.lookAt(this._look);
  }

  update(dt) {
    if (!this.state) return;
    const step = Math.min(dt, 1 / 30);
    const before = this.state.events.length;
    const toBefore = this.state.turnovers;
    rondoStep(this.state, step);
    this._since = this.state.turnovers !== toBefore ? 0 : (this._since ?? 0) + step;

    // ---- react to what the game just did: a pass fires the correct-foot strike on the passer
    for (let i = before; i < this.state.events.length; i++) {
      const e = this.state.events[i];
      if (e.type === 'windup') {
        // THE SWING STARTS HERE, FROM FRAME 0 — and the ball is still at his feet. This event did not
        // exist: the game used to strike the ball and then ask for a pose, so the only way to keep the
        // boot and the ball together was to start the clip AT its contact frame, throwing away the
        // entire backswing. That is why there was no visible movement — you were watching the second
        // half of a gesture whose first half had been deleted. Now the simulation waits for the leg.
        this._playTech(this.players[e.by], e);
      } else if (e.type === 'pass') {
        // the ball leaving is no longer a cue to animate: the swing that sent it started earlier and is
        // still running, and it will finish on its own follow-through
      } else if (e.type === 'control' || e.type === 'slide') {
        const pl = this.players[e.by];
        if (pl) this._playTech(pl, e);
      } else if (e.type === 'receive') {
        const pl = this.players[e.by];
        this._playTech(pl, e);
      }
    }

    // le haut du corps appartient au geste pendant qu'un geste tourne (voir _applyGaitLayer)
    for (const pl of this.players) pl.ctrl.gestureHold = !!pl.sim.act;

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
        // seconds since the last turnover — the contract judges SHAPE on settled possession only, and
        // a hard-coded 99 told it every frame was settled, including the kick-off seconds when the
        // teams are still bunched on their starting ring. The headless run computes this properly;
        // the live trace claiming otherwise is how the same game passed in node and failed on screen.
        passes: this.state.passes, since: +this._since.toFixed(2),
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
