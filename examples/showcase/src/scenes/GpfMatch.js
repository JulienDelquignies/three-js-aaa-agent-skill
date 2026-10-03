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
// L'ISSUE D'UN FACE-À-FACE (face.mjs), en clair
const ISSUES = {
  'sortie-mordu': 'le défenseur mord, la sortie de l’autre côté', 'sortie-fente-mordue': 'mordu, il se jette — la sortie de l’autre côté',
  'sortie-fente-lue': 'la fente lue, la sortie', 'sortie-fente-manquee': 'la fente dans le vide, la sortie', 'fente-contree': 'la fente touche le ballon, le porteur le garde',
  'chipe-repris': 'le ballon piqué, repris', 'echappe-repris': 'le ballon échappé, repris',
  'sortie-roulette-fente': 'la roulette contre la fente', 'sortie-rateau-fente': 'le râteau contre la fente', 'sortie-expire': 'la sortie, faute de morsure',
  'fente-gagnee': 'la fente gagne le ballon', 'sortie-coupee': 'la sortie coupée par le défenseur', chipe: 'le ballon piqué', echappe: 'le ballon échappé',
  double: 'un second défenseur arrive', depasse: 'le défenseur dépassé', relache: 'le défenseur décroche', passe: 'le porteur passe', relais: 'un partenaire prend le ballon',
  tiers: 'un autre défenseur prend le ballon', arret: 'le jeu est arrêté', perdu: 'le ballon perdu',
};
// LES GESTES EN COURSE (gestes-course.mjs), en clair
const GESTES_COURSE = { crochetCourt: 'crochet court', crochet: 'crochet', crochetChaloupe: 'crochet chaloupé', crochetExt: 'crochet de l’extérieur', croqueta: 'croqueta', feinteCorps: 'feinte de corps', passement: 'passement' };
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
    // L'HORLOGE DU MATCH : 4,75 fait coller leur chrono au temps simulé et donne aux corps la fatigue d'un vrai match (0,027,
    // le réglage de GRF, les épuisait vers la 12e minute) ; les remises en jeu durent leur vrai temps (l'écran coupe le temps
    // mort comme une retransmission) ; la mi-temps à 45:00, le coup de sifflet final à 90:00
    this.M._gf_init(1, Number(q.get('md')) || 4.75);
    const graine = Number(q.get('seed')) || 7;
    this.M._gf_reset(graine, 1.0, 1.0, 1e9);
    this.C = await import(/* @vite-ignore */ base + 'cerveau.mjs');
    if (q.get('arrets') !== '0') this.C.poserLesArrets(this.M);
    this.periode = 1;
    // NOTRE CERVEAU : le paquet (cerveau + contrat du corps), les intentions ouvertes, un tick de décision tous les 10 pas.
    // LE FACE-À-FACE « TAARABT » (face.mjs) en est : planté face au défenseur, la semelle sur le ballon, les feintes, la morsure, la
    // fente, la sortie — ?face=0 l'éteint ; ?face=saut (ou la touche F) avance le match à toute vitesse jusqu'au prochain
    this.mode = q.has('ia') ? 'ia' : q.get('contre') === 'ia' ? 'contre' : 'cerveau';
    // LES GESTES EN COURSE (gestes-course.mjs) : le cerveau décide (ses fenêtres, ses attributs), le corps joue la croqueta, le crochet, la
    // feinte de corps, le passement en pleine course — ?gestes=0 les éteint ; ?gestes=saut (ou la touche G) avance jusqu'au prochain.
    // LES EFFECTIFS sont notés par poste (le générateur du moteur) ; ?artiste=0:7 pose une anomalie (Taarabt) sur le joueur 7 de
    // l'équipe 0, ?technicien=1:9 un technicien (Olmo) — les postes de la formation (0-3 la défense, 4-6 le milieu, 7 et 9 les côtés,
    // 8 l'avant-centre)
    if (this.mode !== 'ia') {
      const face = q.get('face') !== '0', gestes = q.get('gestes') !== '0', archetypes = [];
      for (const type of ['artiste', 'technicien']) for (const v of q.getAll(type)) { const [e, p] = v.split(':').map(Number); if (e >= 0 && e <= 1 && p >= 0 && p <= 9) archetypes.push({ equipe: e, poste: p, type }); }
      this.cerveau = this.C.creerCerveau({ graine, equipes: this.mode === 'contre' ? [0] : [0, 1], options: { face, gestes, ...(archetypes.length ? { archetypes } : {}) } });
      this.M._gf_intents(1);
      this.pas = 0; this.cerveauMs = 0; this.cerveauN = 0;
      this.saut = face && q.get('face') === 'saut';
      this.sautGeste = gestes && q.get('gestes') === 'saut';
      if (face) {
        addEventListener('keydown', (e) => { if (e.key === 'f' || e.key === 'F') this.sauter(); });
        const b = document.getElementById('faceSaut');   // le bouton, pour les écrans sans clavier
        if (b && !q.has('capture')) { b.style.display = 'block'; b.addEventListener('click', () => this.sauter()); }
      }
      if (gestes) {
        addEventListener('keydown', (e) => { if (e.key === 'g' || e.key === 'G') this.sauterGeste(); });
        const b = document.getElementById('gesteSaut');
        if (b && !q.has('capture')) { b.style.display = 'block'; b.addEventListener('click', () => this.sauterGeste()); }
      }
    }
    this.zf = 0;   // le rapprochement de la caméra sur le face-à-face (0 : la caméra du jeu, 1 : le plan serré)
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
    // l'avance rapide jusqu'au prochain face-à-face : 3 s de jeu par image, le rendu suit
    if (this.saut || this.sautGeste) { n = 300; this.acc = 0; }
    if (this.periode === 3) n = 0;   // le coup de sifflet final : le match est figé sur son score
    if (n) {
      const t0 = performance.now();
      if (this.cerveau) {
        // le pas fixe découpé sur le tick du cerveau : il décide au début de chaque centaine de millisecondes, lit le journal
        // après chaque avance (la passe en vol, la tenue du porteur). La mi-temps et la fin se jugent au début du tick, avant la
        // décision — là où les bancs Node les sifflent : la page joue leur match au bit près, après la pause aussi
        for (let reste = n; reste > 0;) {
          if (this.pas % 10 === 0) {
            if (this._periodes()) break;
            this._decider();
            if (this.saut && this.cerveau.face) { this.saut = false; reste = Math.min(reste, 10); }   // le face-à-face est là : le temps réel
            if (this.sautGeste && this.cerveau.geste) { this.sautGeste = false; reste = Math.min(reste, 10); }   // un geste demandé : le temps réel (il part dans les 0,7 s)
          }
          const k = Math.min(reste, 10 - (this.pas % 10));
          this.M._gf_step(k); this.pas += k; reste -= k;
          this.cerveau.observer(this.C.lireJournal(this.M));
        }
      } else { this.M._gf_step(n); this._periodes(); }
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
      const horloge = this.periode === 3 ? 'fin du match' : `${Math.floor(F[0] / 60000)}:${String(Math.floor(F[0] / 1000) % 60).padStart(2, '0')}${this.periode === 2 ? ' (2e mi-temps)' : ''}`;
      const fa = this.cerveau?.face, der = this.cerveau?.faceDerniere, n = this.cerveau?.stats?.().face?.entrees ?? 0;
      const face = this.saut ? ' · avance rapide jusqu’au prochain face-à-face…'
        : fa ? ` · FACE-À-FACE, ${fa.feintes} feinte${fa.feintes > 1 ? 's' : ''}`
        : der && F[0] / 1000 - der.t < 8 ? ` · face-à-face : ${ISSUES[der.issue] ?? der.issue}`
        : this.cerveau && q.get('face') !== '0' ? ` · ${n} face-à-face · F : le prochain` : '';
      // le geste en course : qui (son poste, son profil), lequel ; le dernier joué quelques secondes ; sinon le compte et la touche G
      const ge = this.cerveau?.geste, gd = this.cerveau?.gesteDernier, nG = this.cerveau?.stats?.().course?.partis ?? 0;
      const quiG = (id) => { const P = this.cerveau.profil(id); return P ? `${P.equipe === 0 ? 'gauche' : 'droite'} ${P.poste}${P.archetype ? `, ${P.archetype}` : ''}` : ''; };
      const geste = !this.cerveau || q.get('gestes') === '0' ? ''
        : this.sautGeste ? ' · avance rapide jusqu’au prochain geste…'
        : ge ? ` · ${(GESTES_COURSE[ge.nom] ?? ge.nom).toUpperCase()} (${quiG(ge.porteur)})`
        : gd && F[0] / 1000 - gd.t < 3 && gd.issue !== 'pas-parti' ? ` · ${GESTES_COURSE[gd.nom] ?? gd.nom} (${quiG(gd.porteur)})`
        : ` · ${nG} geste${nG > 1 ? 's' : ''} en course · G : le prochain`;
      // en capture (?capture : images calculées une à une, rendu logiciel), les mesures de vitesse ne disent rien : le score et le temps seuls
      if (this._hud) this._hud.textContent = q.has('capture') ? `${F[4]}-${F[5]} · ${horloge} · ${qui}${face}${geste}`
        : `${F[4]}-${F[5]} · ${horloge} · ${qui}${face}${geste} · ${fps.toFixed(0)} images/s · calcul ${cpu.toFixed(1)} ms par image (simulation ${msPas.toFixed(2)} ms par pas${this.cerveau ? `, cerveau ${msCerveau.toFixed(1)} ms par décision` : ''}, poses ${msPose.toFixed(2)} ms) · ${this.api} ${cv.width}×${cv.height} · démarrage ${this.bootMs.toFixed(0)} ms`;
      this.cerveauMs = 0; this.cerveauN = 0;
      this._fpsN = 0; this._fpsT0 = now; this.simMs = 0; this.simSteps = 0; this.poseMs = 0; this.poseN = 0; this._cpuMs = 0; this._cpuN = 0;
    }
  }

  // L'AVANCE RAPIDE jusqu'au prochain face-à-face, depuis la caméra du jeu
  sauter() { if (!this.cerveau || this.periode === 3) return; this.saut = true; this._faceJusqua = -1; this._faceVu = null; this.zf = 0; }
  // L'AVANCE RAPIDE jusqu'au prochain geste en course
  sauterGeste() { if (!this.cerveau || this.periode === 3) return; this.sautGeste = true; this._faceJusqua = -1; this._faceVu = null; this.zf = 0; }

  // LA MI-TEMPS ET LA FIN, à l'horloge du match ; vrai : le coup de sifflet final
  _periodes() {
    const tMatch = new Float32Array(this.M.HEAPF32.buffer, this.M._gf_frame(), 1)[0];
    if (this.periode === 1 && tMatch >= 45 * 60000) { this.M._gf_mi_temps(); this.periode = 2; }
    if (this.periode === 2 && tMatch >= 90 * 60000) { this.periode = 3; this.saut = false; }
    return this.periode === 3;
  }

  // un tick de NOTRE CERVEAU : l'état du corps prêté, une intention par joueur piloté (hors jeu arrêté : le corps les mène)
  _decider() {
    const t0 = performance.now();
    const e = this.C.lireEtat(this.M, this.HEAD, this.PER);
    if (e.enJeu && !e.cpa) {
      const d = this.cerveau.decider(e);
      for (const i of d) this.C.poserIntention(this.M, i.id, i);
      this.C.poserFautes(this.M, d.fautes);   // la Loi 12 du cerveau : l'arbitre du corps siffle, ou montre le carton
    }
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
    const P = pres ? [this.cam.x, 7, this.cam.z + 14]   // la caméra RAPPROCHÉE : 15 m du ballon, 7 m de haut — on juge les corps et la complicité avec le ballon
      : [this.cam.x * 0.9, 17, 40 + this.cam.z * 0.4];   // la caméra TÉLÉ : une tribune latérale, 17 m de haut, qui suit le ballon (lissée) — le cadre d'une retransmission
    const L = [this.cam.x, 0, this.cam.z];
    // LE PLAN SERRÉ DU FACE-À-FACE (sauf ?cam=tele) : la caméra descend à 9 m du duel, 3,8 m de haut, le milieu du porteur et de son
    // défenseur au centre, suivi de près (0,3 s) ; le duel fini, elle suit le ballon 1,5 s encore — la sortie part, souvent vers
    // elle : figée sur le lieu du duel, elle laissait les joueurs lui passer dessous
    // …ET SUR UN GESTE EN COURSE : le porteur au centre, de sa demande à 1,5 s après sa fin (le ballon suivi ensuite)
    const fa = this.cerveau?.face, ge = !fa && q.get('gestes') !== '0' ? this.cerveau?.geste : null;
    let vise = null;
    if (fa && q.get('cam') !== 'tele') {
      const c = this._joueur(fa.porteur), d = this._joueur(fa.defenseur);
      if (c && d) { vise = [(c.position.x + d.position.x) / 2, (c.position.z + d.position.z) / 2]; this._faceJusqua = this.t + 1.5; }
    } else if (ge && q.get('cam') !== 'tele') {
      const c = this._joueur(ge.porteur);
      if (c) {
        vise = [(c.position.x * 2 + b.x) / 3, (c.position.z * 2 + b.z) / 3]; this._faceJusqua = this.t + 1.5;
        // LE FLANC DU PORTEUR : sa direction de course (lissée 0,25 s) — la caméra se met sur son côté, on voit ses appuis
        const pp = this._gePrev, k = 1 - Math.exp(-dt / 0.25);
        if (pp && pp.id === ge.porteur) { const dx = c.position.x - pp.x, dz = c.position.z - pp.z, l = Math.hypot(dx, dz); if (l > 0.004) { const u = this._geDir ?? [dx / l, dz / l]; this._geDir = [u[0] + (dx / l - u[0]) * k, u[1] + (dz / l - u[1]) * k]; } }
        else this._geDir = null;
        this._gePrev = { id: ge.porteur, x: c.position.x, z: c.position.z };
      }
    } else if (this.t < (this._faceJusqua ?? -1)) vise = [b.x, b.z];
    if (vise) {
      // un nouveau face-à-face : le point visé y saute (le plan de coupe) — glissé depuis le précédent, il laissait la caméra devant les joueurs
      const de = fa?.depuis ?? (ge ? `g${ge.depuis}` : undefined);
      if (!this._faceVu || ((fa || ge) && this._faceVu.de !== de)) this._faceVu = { x: vise[0], z: vise[1], de };
      const kf = 1 - Math.exp(-dt / 0.3);
      this._faceVu.x += (vise[0] - this._faceVu.x) * kf; this._faceVu.z += (vise[1] - this._faceVu.z) * kf;
    }
    const vu = this._faceVu, viser = vise ? 1 : 0;
    this.zf += (viser - this.zf) * (1 - Math.exp(-dt / 0.6));
    if (vu && this.zf < 0.01 && !viser) this._faceVu = null;
    if (vu) {
      // le face-à-face à 9 m (deux joueurs plantés, de la tribune) ; le geste en course DE CÔTÉ — sur le flanc du porteur, à 6 m, 2,2 m de
      // haut, perpendiculaire à sa course (du côté de la tribune) : on juge les appuis, le ballon entre les pieds
      const w = this.zf * this.zf * (3 - 2 * this.zf), mix = (a, b) => a + (b - a) * w, enCourse = typeof vu.de === 'string';
      let off = [0, 9], h = 3.8;
      if (enCourse) {
        // le flanc DÉGAGÉ : des deux côtés de sa course, celui où aucun corps ne passe entre la caméra et lui (à 0,7 m du segment) ; à égalité,
        // le côté de la tribune (+z) ; on ne change de côté que si l'autre est meilleur depuis 0,4 s (la caméra ne bascule pas à chaque pas)
        const u = this._geDir ?? [1, 0], l0 = Math.hypot(u[0], u[1]) || 1, perp = [-u[1] / l0, u[0] / l0];
        const c = this._joueur(this.cerveau?.geste?.porteur ?? -1);
        const gene = (sg) => { if (!c) return 0; const cx = c.position.x + perp[0] * 6 * sg, cz = c.position.z + perp[1] * 6 * sg; let n = 0;
          for (const pl of this.players) { const m = pl.model; if (m === c) continue; const ax = m.position.x - cx, az = m.position.z - cz, bx = c.position.x - cx, bz = c.position.z - cz, t = Math.max(0, Math.min(1, (ax * bx + az * bz) / (bx * bx + bz * bz))); if (Math.hypot(ax - bx * t, az - bz * t) < 0.7) n++; }
          return n; };
        // (le côté se choisit UNE fois, au départ du geste : changer de flanc en plein geste faisait passer la caméra au-dessus du porteur)
        const tribune = perp[1] >= 0 ? 1 : -1;
        if (this._geCote == null) this._geCote = gene(tribune) <= gene(-tribune) ? tribune : -tribune;
        off = [perp[0] * 6 * this._geCote, perp[1] * 6 * this._geCote]; h = 2.2;
      } else this._geCote = null;
      // LA CAMÉRA TOURNE AUTOUR DU POINT VISÉ (son azimut lissé, au plus court ; la distance aussi) — un décalage interpolé en ligne droite
      // passait par le point visé lui-même quand le porteur coupait
      const ko = 1 - Math.exp(-dt / 0.4), aV = Math.atan2(off[1], off[0]), rV = Math.hypot(off[0], off[1]);
      if (!this._camOff) this._camOff = { a: aV, r: rV };
      else { const da = Math.atan2(Math.sin(aV - this._camOff.a), Math.cos(aV - this._camOff.a)); this._camOff = { a: this._camOff.a + da * ko, r: this._camOff.r + (rV - this._camOff.r) * ko }; }
      const camOff = [Math.cos(this._camOff.a) * this._camOff.r, Math.sin(this._camOff.a) * this._camOff.r];
      P[0] = mix(P[0], vu.x + camOff[0]); P[1] = mix(P[1], h); P[2] = mix(P[2], vu.z + camOff[1]);
      L[0] = mix(L[0], vu.x); L[1] = mix(L[1], enCourse ? 0.7 : 0.9); L[2] = mix(L[2], vu.z);
    } else this._camOff = null;
    this.camRef.position.set(P[0], P[1], P[2]);
    this.camRef.lookAt(L[0], L[1], L[2]);
    // la cible des OrbitControls suit le même point : le runner les met à jour avant chaque image capturée (__seekFrame), et leur
    // lookAt(target) écrasait celui-ci — les captures regardaient le centre du terrain au lieu du ballon
    if (this.controls) this.controls.target.set(L[0], L[1], L[2]);
  }

  // le modèle d'un joueur par son id stable (celui du corps)
  _joueur(id) {
    const F = new Float32Array(this.M.HEAPF32.buffer, this.M._gf_frame(), this.HEAD + 22 * this.PER);
    for (let k = 0; k < 22; k++) if (F[this.HEAD + k * this.PER + 10] === id) return this.players[k].model;
    return null;
  }
}
