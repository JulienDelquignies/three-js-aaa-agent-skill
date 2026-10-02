import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { loadSquad, setCloner, rigBones } from '../engine/squad.js';
import { motionProfileOf } from '../engine/motion-cast.js';
import { jointToSpec, CANON } from '../engine/motion-rig.js';
import { jointsFromSample, restOffsets, GPF_NODES } from '../engine/gpf-anim.js';
import { quatMul } from '../engine/vecmath.js';
import { DUEL_CAST } from './duel-joueurs.js';

// GpfMatch — LES LOTS L0 ET L2 DU CADRAGE : le moteur de match de Gameplay Football (Google Research Football, licence Unlicense),
// compilé en WebAssembly SANS son rendu (gpf-wasm/), joue un 11 contre 11, et notre three.js le dessine avec NOS humains (les
// Rocketbox n° 18 et n° 10 du duel). Qui décide :
//   · par défaut, NOTRE CERVEAU (lot L2) — le moteur de match de la skill, empaqueté (gpf/cerveau.mjs, branche
//     feat/l2-cerveau-corps) : toutes les 100 ms il reçoit le monde du corps et rend une intention par joueur de champ
//     (aller, presser, passer, tirer, conduire) ; le corps garde ses gestes, ses gardiens, ses coups de pied arrêtés ;
//   · ?ia : l'IA du jeu des deux côtés (le lot L0) ; ?contre=ia : notre cerveau à gauche, leur IA à droite. Chaque image : le moteur avance au pas fixe de 10 ms (100 Hz), puis les poses
// (racine + 13 articulations locales par joueur, gf_pose) passent par gpf-anim.jointsFromSample (le port validé : cheville au
// ballon à ±2 cm de leur moteur) sur le rig canonique ; la racine est posée sans lacet, le cap vit dans le bassin.
//
// Repères. Le moteur : x le long (±55 m), y en travers (±36 m), z en haut. La scène : (x, z, −y) — une rotation propre — et le
// repère personnage de gpf-anim (droite +X, haut +Y, avant −Z) est cette scène tournée de 180° autour de Y : les modèles sont donc
// posés avec rotation.y = π. Les mesures (ms par pas de simulation, images par seconde) s'affichent et sont lues par window.__gpf.
const PITCH = { hx: 55, hz: 36, goalHalf: 3.66, goalH: 2.44 };
const q = new URLSearchParams(location.search);

export class GpfMatch {
  constructor(scene, renderer) {
    this.scene = scene; this.renderer = renderer;
    this.players = []; this.acc = 0; this.simMs = 0; this.simSteps = 0; this.poseMs = 0; this.poseN = 0; this.t = 0;
    this._fpsN = 0; this._fpsT0 = performance.now(); this._cpuMs = 0; this._cpuN = 0;
    this.tot = { frames: 0, cpuMs: 0, simMs: 0, simSteps: 0, poseMs: 0, t0: performance.now() };   // cumulés, pour le diagnostic
    this.cam = { x: 0, z: 0 };
    this._hud = document.getElementById('gpfHud');
    this.ready = this._load();
  }

  async _load() {
    // ?dpr=1 : la densité de pixels imposée (le moteur la plafonne à 2) — le coût du remplissage se lit en la baissant
    if (q.has('dpr')) this.renderer.setPixelRatio(Math.min(2, Math.max(0.25, Number(q.get('dpr')) || 1)));
    // le CALCUL d'une image : tout le rappel de la boucle (simulation, poses, caméra, soumission du rendu). Une image qui dure
    // bien plus longtemps que son calcul attend la carte graphique (ou la cadence de l'écran)
    const r = this.renderer, loop = r.setAnimationLoop.bind(r);
    r.setAnimationLoop = (cb) => loop(cb && (async (...a) => {
      const t = performance.now(); await cb(...a); const d = performance.now() - t; this._cpuMs += d; this._cpuN++; this.tot.cpuMs += d; }));
    this.api = r.backend?.isWebGPUBackend ? 'WebGPU' : 'WebGL 2';
    this._buildPitch();
    // LE MOTEUR : le module WebAssembly et ses données (6 Mo : animations, maillages des corps, police) — servis depuis ./gpf/
    const base = new URL('./gpf/', location.href).href;
    const { default: GpfModule } = await import(/* @vite-ignore */ base + 'gpf.mjs');
    const t0 = performance.now();
    this.M = await GpfModule({ locateFile: (p) => base + p, print: () => {}, printErr: (s) => console.warn('[gpf]', s) });
    this.M._gf_init(1, Number(q.get('md')) || 0.027);
    const graine = Number(q.get('seed')) || 7;
    this.M._gf_reset(graine, 1.0, 1.0, 1e9);
    // NOTRE CERVEAU : le paquet (cerveau + contrat du corps), les intentions ouvertes, un tick de décision tous les 10 pas
    this.mode = q.has('ia') ? 'ia' : q.get('contre') === 'ia' ? 'contre' : 'cerveau';
    if (this.mode !== 'ia') {
      this.C = await import(/* @vite-ignore */ base + 'cerveau.mjs');
      this.cerveau = this.C.creerCerveau({ graine, equipes: this.mode === 'contre' ? [0] : [0, 1] });
      this.M._gf_intents(1);
      this.pas = 0; this.cerveauMs = 0; this.cerveauN = 0;
    }
    this.bootMs = performance.now() - t0;
    this.HEAD = this.M._gf_frame_head(); this.PER = this.M._gf_frame_per(); this.POSE = this.M._gf_pose_per();

    // NOS HUMAINS : la chaîne du duel (squad + rig-bip01 + rig canonique), une silhouette par équipe
    setCloner(cloneSkinned);
    this.squad = await loadSquad(new GLTFLoader(), { rigs: DUEL_CAST, donor: 'Soldier.glb', height: 1.8 });
    this.profiles = this.squad.entries.map((e) => motionProfileOf(e));
    this.offsets = this.profiles.map((P) => restOffsets(P));
    for (let k = 0; k < 22; k++) {
      const team = k < 11 ? 0 : 1;
      const { model, groundY } = this.squad.spawn(team);
      model.rotation.y = Math.PI;
      this.scene.add(model); model.updateMatrixWorld(true);
      const bones = rigBones(model), rest = new Map();
      for (const [n, b] of bones) rest.set(n, { q: [b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w], p: b.position.clone() });
      // le repère du parent du bassin, vu du monde : constant (seul le modèle se déplace, sans tourner) — inversé une fois pour toutes
      const hb = bones.get('Hips'), hipsInv = hb ? new THREE.Matrix3().setFromMatrix4(hb.parent.matrixWorld).invert() : null;
      this.players.push({ model, bones, rest, groundY, team, P: this.profiles[team], C: this.offsets[team], hipsInv });
    }
    // LE BALLON
    const g = new THREE.SphereGeometry(0.11, 24, 16);
    this.ball = new THREE.Mesh(g, new THREE.MeshStandardNodeMaterial({ color: 0xf4f4f4, roughness: 0.45 }));
    this.ball.castShadow = true; this.scene.add(this.ball);
    this._v = new THREE.Vector3();
    window.__gpf = this;
    if (q.has('diag')) import('./gpf-diag.js').then((m) => m.runDiag(this));
  }

  _buildPitch() {
    const W = PITCH.hx * 2 + 16, H = PITCH.hz * 2 + 12;
    const c = document.createElement('canvas'); c.width = 2048; c.height = Math.round(2048 * H / W);
    const k = c.width / W, g = c.getContext('2d'), X = (x) => (x + W / 2) * k, Y = (z) => (z + H / 2) * k;
    for (let i = 0; i < 22; i++) { g.fillStyle = i % 2 ? '#3f8f3a' : '#47993f'; g.fillRect(X(-W / 2 + i * W / 22), 0, W / 22 * k + 1, c.height); }
    g.strokeStyle = '#f2f5ef'; g.lineWidth = 0.12 * k;
    g.strokeRect(X(-PITCH.hx), Y(-PITCH.hz), 2 * PITCH.hx * k, 2 * PITCH.hz * k);
    g.beginPath(); g.moveTo(X(0), Y(-PITCH.hz)); g.lineTo(X(0), Y(PITCH.hz)); g.stroke();
    g.beginPath(); g.arc(X(0), Y(0), 9.15 * k, 0, 7); g.stroke();
    for (const s of [-1, 1]) {
      g.strokeRect(X(s > 0 ? PITCH.hx - 16.5 : -PITCH.hx), Y(-20.16), 16.5 * k, 40.32 * k);
      g.strokeRect(X(s > 0 ? PITCH.hx - 5.5 : -PITCH.hx), Y(-9.16), 5.5 * k, 18.32 * k);
      g.beginPath(); g.arc(X(s * (PITCH.hx - 11)), Y(0), 0.25 * k, 0, 7); g.fillStyle = '#f2f5ef'; g.fill();
    }
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshStandardNodeMaterial({ map: tex, roughness: 0.95 }));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; this.scene.add(ground);
    // les buts : deux poteaux, une barre, un filet léger
    const mat = new THREE.MeshStandardNodeMaterial({ color: 0xffffff, roughness: 0.4 });
    const net = new THREE.MeshStandardNodeMaterial({ color: 0xffffff, transparent: true, opacity: 0.25, roughness: 1, side: THREE.DoubleSide });
    for (const s of [-1, 1]) {
      const grp = new THREE.Group(); grp.position.x = s * PITCH.hx;
      for (const z of [-PITCH.goalHalf, PITCH.goalHalf]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, PITCH.goalH, 12), mat); p.position.set(0, PITCH.goalH / 2, z); grp.add(p); }
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, PITCH.goalHalf * 2, 12), mat); bar.rotation.x = Math.PI / 2; bar.position.y = PITCH.goalH; grp.add(bar);
      const back = new THREE.Mesh(new THREE.PlaneGeometry(PITCH.goalHalf * 2, PITCH.goalH), net); back.rotation.y = Math.PI / 2; back.position.set(s * 1.8, PITCH.goalH / 2, 0); grp.add(back);
      this.scene.add(grp);
    }
    // la lumière : le soleil du moteur (Lighting.js), ses ombres élargies au terrain entier ; pas de brouillard — l'exponentielle
    // 0,014 des petites scènes voile la moitié de l'image à la distance d'une caméra télé (mesuré : 48 % à 58 m)
    this.scene.fog = null;
    const ombres = q.get('ombres') !== '0';
    this.scene.traverse((o) => { if (o.isDirectionalLight && o.castShadow && !ombres) o.castShadow = false; });
    this.scene.traverse((o) => { if (o.isDirectionalLight && o.castShadow) {
      o.position.set(-35, 70, 30); Object.assign(o.shadow.camera, { left: -75, right: 75, top: 55, bottom: -55, near: 1, far: 220 }); o.shadow.camera.updateProjectionMatrix(); } });
  }

  camera(cam, controls) {
    this.camRef = cam; this.controls = controls;
    cam.fov = 30; cam.near = 0.5; cam.far = 600; cam.updateProjectionMatrix();
    if (controls) controls.enabled = q.has('orbit');
    // ?bloom=0 : le rendu direct, sans la passe de bloom du moteur (le runner adopte le pipeline d'une scène qui en déclare un)
    if (q.get('bloom') === '0') this.postfx = { render: async () => this.renderer.render(this.scene, cam) };
  }

  update(dt) {
    if (!this.M) return;
    // LE PAS FIXE : 10 ms de jeu par pas, autant de pas que le temps réel écoulé (plafonné : un onglet en pause ne rattrape pas)
    this.acc = Math.min(this.acc + dt * (Number(q.get('vitesse')) || 1), 0.1);
    let n = 0; while (this.acc >= 0.01) { this.acc -= 0.01; n++; }
    if (n) {
      const t0 = performance.now();
      if (this.cerveau) {
        // le pas fixe découpé sur le tick du cerveau : il décide au début de chaque centaine de millisecondes, lit le journal
        // après chaque avance (la passe en vol, la tenue du porteur)
        for (let reste = n; reste > 0;) {
          if (this.pas % 10 === 0) this._decider();
          const k = Math.min(reste, 10 - (this.pas % 10));
          this.M._gf_step(k); this.pas += k; reste -= k;
          this.cerveau.observer(this.C.lireJournal(this.M));
        }
      } else this.M._gf_step(n);
      const d = performance.now() - t0; this.simMs += d; this.simSteps += n; this.tot.simMs += d; this.tot.simSteps += n;
    }
    const tp = performance.now();
    const F = new Float32Array(this.M.HEAPF32.buffer, this.M._gf_frame(), this.HEAD + 22 * this.PER);
    const Q = new Float32Array(this.M.HEAPF32.buffer, this.M._gf_pose(), 22 * this.POSE);
    for (let k = 0; k < 22; k++) this._pose(this.players[k], Q, k * this.POSE);
    this.ball.position.set(F[6], Math.max(0.11, F[8]), -F[7]);
    const dp = performance.now() - tp; this.poseMs += dp; this.poseN++; this.tot.poseMs += dp; this.tot.frames++;
    this._camera(dt);
    this.t += dt;
    const now = performance.now(); this._fpsN++;
    if (now - this._fpsT0 > 500) {
      const fps = this._fpsN * 1000 / (now - this._fpsT0), msPas = this.simSteps ? this.simMs / this.simSteps : 0, msPose = this.poseN ? this.poseMs / this.poseN : 0;
      const cpu = this._cpuN ? this._cpuMs / this._cpuN : 0, cv = this.renderer.domElement;
      const msCerveau = this.cerveauN ? this.cerveauMs / this.cerveauN : 0;
      this.stats = { fps, cpu, msPas, msPose, msCerveau, boot: this.bootMs, score: [F[4], F[5]], tMs: F[0] };
      const qui = this.mode === 'ia' ? 'leur IA des deux côtés' : this.mode === 'contre' ? 'notre cerveau (gauche) contre leur IA' : 'notre cerveau, leurs corps';
      const horloge = `${Math.floor(F[0] / 60000)}:${String(Math.floor(F[0] / 1000) % 60).padStart(2, '0')}`;
      // en capture (?capture : images calculées une à une, rendu logiciel), les mesures de vitesse ne disent rien : le score et le temps seuls
      if (this._hud) this._hud.textContent = q.has('capture') ? `${F[4]}-${F[5]} · ${horloge} · ${qui}`
        : `${F[4]}-${F[5]} · ${horloge} · ${qui} · ${fps.toFixed(0)} images/s · calcul ${cpu.toFixed(1)} ms par image (simulation ${msPas.toFixed(2)} ms par pas${this.cerveau ? `, cerveau ${msCerveau.toFixed(1)} ms par décision` : ''}, poses ${msPose.toFixed(2)} ms) · ${this.api} ${cv.width}×${cv.height} · démarrage ${this.bootMs.toFixed(0)} ms`;
      this.cerveauMs = 0; this.cerveauN = 0;
      this._fpsN = 0; this._fpsT0 = now; this.simMs = 0; this.simSteps = 0; this.poseMs = 0; this.poseN = 0; this._cpuMs = 0; this._cpuN = 0;
    }
  }

  // un tick de NOTRE CERVEAU : l'état du corps prêté, une intention par joueur piloté (hors jeu arrêté : le corps les mène)
  _decider() {
    const t0 = performance.now();
    const e = this.C.lireEtat(this.M, this.HEAD, this.PER);
    if (e.enJeu && !e.cpa) for (const i of this.cerveau.decider(e)) this.C.poserIntention(this.M, i.id, i);
    this.cerveauMs += performance.now() - t0; this.cerveauN++;
  }

  // une pose : la racine dans la scène, puis les articulations du port (rest ⊗ q_spec, la convention de la couche de geste)
  _pose(pl, Q, o) {
    const S = { p: [Q[o], Q[o + 1], Q[o + 2]], q: {} };
    for (let n = 0; n < 13; n++) S.q[GPF_NODES[n]] = [Q[o + 3 + n * 4], Q[o + 4 + n * 4], Q[o + 5 + n * 4], Q[o + 6 + n * 4]];
    const { J, hips } = jointsFromSample(S, pl.P, pl.C, { keepHeading: true });
    pl.model.position.set(S.p[0], pl.groundY, -S.p[1]);
    for (const name of CANON) {
      const b = pl.bones.get(name), r = pl.rest.get(name); if (!b || !r || !J[name]) continue;
      const qs = jointToSpec(pl.P, name, J[name]); const w = quatMul(r.q, qs);
      b.quaternion.set(w[0], w[1], w[2], w[3]);
    }
    // la hauteur du bassin : le décalage (repère personnage) tourné dans la scène (rotation.y = π : x → −x, z → −z), puis ramené
    // dans le repère du parent du bassin
    const hb = pl.bones.get('Hips'), hr = pl.rest.get('Hips');
    if (hb && hr && pl.hipsInv) hb.position.copy(hr.p).add(this._v.set(-hips[0], hips[1], -hips[2]).applyMatrix3(pl.hipsInv));
  }

  _camera(dt) {
    if (!this.camRef || q.has('orbit')) return;
    // le champ HORIZONTAL visé (51°, celui d'un écran 16:9 à 30° de vertical) : un téléphone en portrait ne regarde plus le terrain
    // par une fente de 17°. Le vertical s'ouvre, mais pas au-delà de 50° : plus haut, le haut de l'image passe au-dessus de la
    // ligne de touche opposée (du vide) et les joueurs deviennent des fourmis — en portrait, ≈ 35° d'horizontal
    const fov = THREE.MathUtils.clamp(2 * THREE.MathUtils.radToDeg(Math.atan(Math.tan(THREE.MathUtils.degToRad(51 / 2)) / this.camRef.aspect)), 30, 50);
    if (Math.abs(fov - this.camRef.fov) > 0.05) { this.camRef.fov = fov; this.camRef.updateProjectionMatrix(); }
    // la caméra rapprochée par défaut sur un écran en hauteur (un téléphone tenu droit ne peut pas montrer la largeur du jeu :
    // la télé y donne des fourmis sous un bandeau vide) ; ?cam=pres ou ?cam=tele imposent l'une ou l'autre
    const pres = q.get('cam') === 'pres' || (q.get('cam') !== 'tele' && this.camRef.aspect < 1);
    const k = 1 - Math.exp(-dt / (pres ? 0.5 : 0.8)), b = this.ball.position;
    this.cam.x += ((pres ? b.x : THREE.MathUtils.clamp(b.x, -42, 42)) - this.cam.x) * k;
    this.cam.z += (b.z * (pres ? 1 : 0.85) - this.cam.z) * k;
    if (pres) {   // la caméra RAPPROCHÉE : 15 m du ballon, 7 m de haut — on juge les corps et la complicité avec le ballon
      this.camRef.position.set(this.cam.x, 7, this.cam.z + 14);
    } else {      // la caméra TÉLÉ : une tribune latérale, 17 m de haut, qui suit le ballon (lissée) — le cadre d'une retransmission
      this.camRef.position.set(this.cam.x * 0.9, 17, 40 + this.cam.z * 0.4);
    }
    this.camRef.lookAt(this.cam.x, 0, this.cam.z);
    // la cible des OrbitControls suit le même point : le runner les met à jour avant chaque image capturée (__seekFrame), et leur
    // lookAt(target) écrasait celui-ci — les captures regardaient le centre du terrain au lieu du ballon
    if (this.controls) this.controls.target.set(this.cam.x, 0, this.cam.z);
  }
}
