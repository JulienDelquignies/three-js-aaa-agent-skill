import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { loadSquad, setCloner, rigBones } from '../engine/squad.js';
import { motionProfileOf } from '../engine/motion-cast.js';
import { jointToSpec, CANON } from '../engine/motion-rig.js';
import { jointsFromSample, restOffsets, GPF_NODES } from '../engine/gpf-anim.js';
import { quatMul } from '../engine/vecmath.js';
import { DUEL_CAST, TENUE_GARDIEN, tenueGardien } from './duel-joueurs.js';
import { construireStade, STADES, HEURES } from './gpf-stade.js';
import { Magneto, IMG, interpoler } from './gpf-magneto.js';
import { Habillage, PLANS, VITESSES } from './gpf-habillage.js';

// GpfMatch — LES LOTS L0, L2 ET L5 DU CADRAGE : le moteur de match de Gameplay Football (Google Research Football, licence Unlicense),
// compilé en WebAssembly SANS son rendu (gpf-wasm/), joue un 11 contre 11, et notre three.js le dessine avec NOS humains (les
// Rocketbox n° 18 et n° 10 du duel). Qui décide :
//   · par défaut, NOTRE CERVEAU (lot L2) — le moteur de match de la skill, empaqueté (gpf/cerveau.mjs, branche
//     feat/l2-cerveau-corps) : toutes les 100 ms il reçoit le monde du corps et rend une intention par joueur de champ
//     (aller, presser, passer, tirer, conduire) ; le corps garde ses gestes, ses gardiens, ses coups de pied arrêtés ;
//   · ?ia : l'IA du jeu des deux côtés (le lot L0) ; ?contre=ia : notre cerveau à gauche, leur IA à droite. Chaque image : le moteur avance au pas fixe de 10 ms (100 Hz), puis les poses
// (racine + 13 articulations locales par joueur, gf_pose) passent par gpf-anim.jointsFromSample (le port validé : cheville au
// ballon à ±2 cm de leur moteur) sur le rig canonique ; la racine est posée sans lacet, le cap vit dans le bassin.
// L'IMAGE (lot L5) : le stade de la skill autour du terrain du corps (gpf-stade.js : tribunes, public, jour/soir/nuit), l'habillage télé
// (gpf-habillage.js : tableau d'affichage, bandeaux, régie, statistiques), le magnétoscope (gpf-magneto.js : ralentis des buts, 10 s en
// arrière, le prochain temps fort), les plans de caméra (auto, télé, rapprochée, tactique, joueur, derrière le but), les gardiens en jaune et
// en vert. La feuille de match vient du journal du corps (gpf/cerveau.mjs → feuille.mjs : le rapport de stats.js, les notes).
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
const GESTES_COURSE = { crochetCourt: 'crochet court', crochet: 'crochet', crochetChaloupe: 'crochet chaloupé', crochetExt: 'crochet de l’extérieur', croqueta: 'croqueta', feinteCorps: 'feinte de corps', passement: 'passement', grandPont: 'grand pont', petitPont: 'petit pont' };
// LES ÉQUIPES (fictives — EX-46) : leurs couleurs sont celles des tenues Rocketbox (le n° 18 rayé noir et blanc, le n° 10 passé en bleu
// ciel) ; l'équipe de gauche reçoit, le stade est à ses couleurs
const EQUIPES = [
  { nom: 'Ardoise FC', court: 'ARD', primary: 0xf2f4f7, secondary: 0x15161a },
  { nom: 'Azur SC', court: 'AZU', primary: 0x8fcbef, secondary: 0xf4f8fb },
];
const q = new URLSearchParams(location.search);
const CAPTURE = q.has('capture');
// ce qui se dit dans l'adresse et se change dans les réglages
const lit = (k, d) => (q.has(k) ? q.get(k) !== '0' : d);

export class GpfMatch {
  constructor(scene, renderer) {
    this.scene = scene; this.renderer = renderer;
    this.players = []; this.acc = 0; this.simMs = 0; this.simSteps = 0; this.poseMs = 0; this.poseN = 0; this.t = 0;
    this._fpsN = 0; this._fpsT0 = performance.now(); this._cpuMs = 0; this._cpuN = 0;
    this.tot = { frames: 0, cpuMs: 0, simMs: 0, simSteps: 0, poseMs: 0, t0: performance.now() };   // cumulés, pour le diagnostic
    this.cam = { x: 0, z: 0 };
    this._hud = document.getElementById('gpfHud');
    // LA RÉGIE : la vitesse (le pas du corps est fixe : la vitesse ne change pas le match), la pause, le plan de caméra
    this.vitesse = Number(q.get('vitesse')) || 1; this.pause = false;
    const cam = q.get('cam') === 'pres' ? 'rapprochee' : q.get('cam');
    this.plan = PLANS[cam] ? cam : 'auto';
    // un TÉLÉPHONE (le petit côté de l'écran sous 600 px) : la fin d'après-midi par défaut — un soleil, sans les huit projecteurs de la nuit
    // (mesuré dans le Rondo, lot 74 : les nappes en forward coûtaient ~40 ms par image de fragment au téléphone) ; ?heure=nuit les rend
    const petit = typeof window !== 'undefined' && Math.min(window.innerWidth, window.innerHeight) < 600;
    this.reglages = {
      stade: STADES[q.get('stade')] ? q.get('stade') : 'bol', heure: HEURES[q.get('heure')] ? q.get('heure') : petit ? 'soir' : 'nuit',
      foule: lit('public', true), ralentis: lit('ralentis', !CAPTURE), ombres: lit('ombres', true), bloom: lit('bloom', true), technique: q.has('fps') || q.has('technique'),
      radar: lit('radar', typeof window === 'undefined' || window.innerWidth >= 700), noms: lit('noms', true),
    };
    this.clips = []; this.lecture = null; this.butsEnAttente = []; this.pas = 0;
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
    this.leger = typeof window !== 'undefined' && Math.min(window.innerWidth, window.innerHeight) < 600;   // un téléphone
    // LE STADE (?stade=0 : la pelouse seule d'avant, sans tribunes ni public)
    if (q.get('stade') === '0') this._buildPitch(); else this._construireStade();
    // LE MOTEUR : le module WebAssembly et ses données (6 Mo : animations, maillages des corps, police) — servis depuis ./gpf/
    const base = new URL('./gpf/', location.href).href;
    const { default: GpfModule } = await import(/* @vite-ignore */ base + 'gpf.mjs');
    const t0 = performance.now();
    this.M = await GpfModule({ locateFile: (p) => base + p, print: () => {}, printErr: (s) => console.warn('[gpf]', s) });
    // L'HORLOGE DU MATCH : 4,75 fait coller leur chrono au temps simulé et donne aux corps la fatigue d'un vrai match (0,027,
    // le réglage de GRF, les épuisait vers la 12e minute) ; les remises en jeu durent leur vrai temps (l'écran coupe le temps
    // mort comme une retransmission) ; la mi-temps à 45:00, le coup de sifflet final à 90:00
    this.M._gf_init(1, Number(q.get('md')) || 4.75);
    const graine = this.graine = Number(q.get('seed')) || 7;
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
      this.cerveauMs = 0; this.cerveauN = 0;
      this.saut = face && q.get('face') === 'saut';
      this.sautGeste = gestes && q.get('gestes') === 'saut';
      if (face) addEventListener('keydown', (e) => { if ((e.key === 'f' || e.key === 'F') && !e.ctrlKey && !e.metaKey) this.sauter(); });
      if (gestes) addEventListener('keydown', (e) => { if ((e.key === 'g' || e.key === 'G') && !e.ctrlKey && !e.metaKey) this.sauterGeste(); });
    }
    this.zf = 0;   // le rapprochement de la caméra sur le face-à-face (0 : la caméra du jeu, 1 : le plan serré)
    this.bootMs = performance.now() - t0;
    this.HEAD = this.M._gf_frame_head(); this.PER = this.M._gf_frame_per(); this.POSE = this.M._gf_pose_per();
    const e0 = this.C.lireEtat(this.M, this.HEAD, this.PER);
    this._score = [e0.score[0], e0.score[1]];
    // LA FEUILLE DE MATCH (feuille.mjs, dans le paquet du cerveau) : le journal du corps → les faits de stats.js → le rapport ; les noms
    // (fictifs) tirés par la graine ; le poste, celui du cerveau quand il pilote
    if (this.cerveau && this.C.creerFeuille) {
      this.noms = this.C.nomsDesJoueurs(graine, e0);
      this.feuille = this.C.creerFeuille({ etat: e0, noms: this.noms, poste: (id) => this.cerveau.profil(id)?.poste ?? null });
    }
    // les ids stables du corps → leur place dans gf_frame/gf_pose (l'ordre des listes d'équipe ne change pas)
    this.slot = new Map(e0.joueurs.map((j, k) => [j.id, k])); this.idDe = e0.joueurs.map((j) => j.id);
    this.gardien = e0.joueurs.map((j) => j.role === 0);

    // NOS HUMAINS : la chaîne du duel (squad + rig-bip01 + rig canonique), une silhouette par équipe ; LES GARDIENS : le corps du n° 18,
    // ses blancs passés au jaune (gauche) ou au vert (droite) — le métier se lit avant le maillot (duel-joueurs.js tenueGardien)
    setCloner(cloneSkinned);
    this.squad = await loadSquad(new GLTFLoader(), { rigs: DUEL_CAST, donor: 'Soldier.glb', height: 1.8 });
    this.profiles = this.squad.entries.map((e) => motionProfileOf(e));
    this.offsets = this.profiles.map((P) => restOffsets(P));
    for (let k = 0; k < 22; k++) {
      const team = k < 11 ? 0 : 1, gk = this.gardien[k] && q.get('gardiens') !== '0', rig = gk ? 0 : team;
      const { model, groundY } = this.squad.spawn(rig);
      if (gk) tenueGardien(model, TENUE_GARDIEN[team]);
      model.rotation.y = Math.PI;
      this.scene.add(model); model.updateMatrixWorld(true);
      this.stade?.light(model);   // la nuit : sous la clé
      const bones = rigBones(model), rest = new Map();
      for (const [n, b] of bones) rest.set(n, { q: [b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w], p: b.position.clone() });
      // le repère du parent du bassin, vu du monde : constant (seul le modèle se déplace, sans tourner) — inversé une fois pour toutes
      const hb = bones.get('Hips'), hipsInv = hb ? new THREE.Matrix3().setFromMatrix4(hb.parent.matrixWorld).invert() : null;
      this.players.push({ model, bones, rest, groundY, team, P: this.profiles[rig], C: this.offsets[rig], hipsInv });
    }
    // LE BALLON
    const g = new THREE.SphereGeometry(0.11, 24, 16);
    this.ball = new THREE.Mesh(g, new THREE.MeshStandardNodeMaterial({ color: 0xf4f4f4, roughness: 0.45 }));
    this.ball.castShadow = true; this.scene.add(this.ball); this.stade?.light(this.ball);
    this._v = new THREE.Vector3();
    // LE MAGNÉTOSCOPE ET L'HABILLAGE
    this.magneto = new Magneto(this.POSE, { hz: 50, secondes: 30 });
    this._img = new Float32Array(this.magneto.per);
    this.habillage = new Habillage(this, { equipes: EQUIPES, stades: STADES, heures: HEURES });
    this._appliquerTechnique();
    this.affiche = { t: 0, score: [...this._score], per: 1, lecture: null, saut: null };
    window.__gpf = this;
    if (q.has('diag')) import('./gpf-diag.js').then((m) => m.runDiag(this));
  }

  // ———————————————————————————— le stade ————————————————————————————
  _construireStade() {
    const R = this.reglages;
    this.stade = construireStade(this.scene, this.renderer, {
      stade: R.stade, heure: R.heure, foule: R.foule, leger: this.leger,
      equipes: EQUIPES.map((e, i) => (i === 0 ? { primary: e.secondary, secondary: e.primary } : { primary: e.primary, secondary: e.secondary })),
      club: { nom: EQUIPES[0].nom, primary: EQUIPES[0].secondary, secondary: EQUIPES[0].primary },
    });
    for (const pl of this.players) this.stade.light(pl.model);
    if (this.ball) this.stade.light(this.ball);
    this._ombres();
  }
  /** Le stade ou l'heure changent en plein match : l'ancien s'en va, le nouveau se construit (le corps n'en sait rien). */
  _reconstruireStade() {
    if (!this.stade) return;
    this.stade.dispose(); this.stade = null;
    this._construireStade();
    this._precompiler();
  }
  _ombres() {
    const on = this.reglages.ombres;
    this.scene.traverse((o) => { if (o.isDirectionalLight && o.shadow) { if (o._ombreInit == null) o._ombreInit = o.castShadow; o.castShadow = on && o._ombreInit; } });
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
    const ombres = this.reglages.ombres;
    this.scene.traverse((o) => { if (o.isDirectionalLight && o.castShadow && !ombres) o.castShadow = false; });
    this.scene.traverse((o) => { if (o.isDirectionalLight && o.castShadow) {
      o.position.set(-35, 70, 30); Object.assign(o.shadow.camera, { left: -75, right: 75, top: 55, bottom: -55, near: 1, far: 220 }); o.shadow.camera.updateProjectionMatrix(); } });
  }

  camera(cam, controls) {
    this.camRef = cam; this.controls = controls;
    cam.fov = 30; cam.near = 0.5; cam.far = 900; cam.updateProjectionMatrix();
    if (controls) controls.enabled = q.has('orbit');
    // ?bloom=0 : le rendu direct, sans la passe de bloom du moteur (le runner adopte le pipeline d'une scène qui en déclare un)
    this._direct = { render: async () => this.renderer.render(this.scene, cam) };
    if (!this.reglages.bloom) this.postfx = this._direct;
    this._precompiler();
  }
  /** LES SHADERS COMPILÉS D'AVANCE (en tâche de fond) : chaque programme se compile sinon à la première image qui l'utilise, et cette compilation
   *  bloque (~15 ms par programme sur mobile) — un nouveau plan, un ralenti, un stade changé faisaient saccader le match. 59 programmes au
   *  chargement, 69 une fois tous les plans vus (essai du 3 octobre, la nuit avec l'ombre des joueurs). */
  //  compileAsync ne compile que ce que sa caméra voit : une caméra provisoire, haute et très ouverte, au-dessus du stade — tout y est.
  _precompiler() {
    if (!this.camRef || CAPTURE || !this.renderer.compileAsync) return;
    const c = (this._camPre ??= new THREE.PerspectiveCamera(120, 1.6, 1, 2000));
    c.position.set(0, 150, 0.01); c.lookAt(0, 0, 0); c.updateMatrixWorld();
    this.renderer.compileAsync(this.scene, c).catch(() => {});
  }

  // ———————————————————————————— les réglages et la régie ————————————————————————————
  regle(cle, v) {
    const R = this.reglages; R[cle] = v;
    if (cle === 'stade' || cle === 'heure' || cle === 'foule') this._reconstruireStade();
    else if (cle === 'ombres') this._ombres();
    else if (cle === 'bloom') {
      // le pipeline de rendu est celui du moteur (bloom) ; le rendu direct le remplace — la boucle relit engine.postfx à chaque image
      const eng = window.__engine; if (!eng) return;
      if (!v) { this._postfxBloom ??= eng.postfx; eng.postfx = this._direct; } else if (this._postfxBloom) eng.postfx = this._postfxBloom;
    } else if (cle === 'technique') this._appliquerTechnique();
    else if (cle === 'radar' && this.habillage) this.habillage.radarBox.style.display = v ? 'block' : 'none';
    if (this.habillage?.panneau === 'reglages') this.habillage._rendreReglages();
  }
  // LES INFOS TECHNIQUES (#gpfHud) : en capture, la légende des films en bas à gauche (comme avant) ; sinon, sous le tableau d'affichage,
  // à la demande (D, ou les réglages) — la régie occupe le bas
  _appliquerTechnique() {
    const h = this._hud; if (!h) return;
    h.style.display = this.reglages.technique || CAPTURE ? 'block' : 'none';
    if (!CAPTURE) Object.assign(h.style, { top: '106px', bottom: 'auto', maxWidth: 'min(560px, calc(100vw - 24px))' });
  }
  regleVitesse(v) { if (VITESSES.includes(v)) { this.vitesse = v; this.pause = false; } }
  basculerPause() { this.pause = !this.pause; }
  reglePlan(p) { if (PLANS[p]) { this.plan = p; this._coupe = true; } }

  // L'AVANCE RAPIDE jusqu'au prochain face-à-face, depuis la caméra du jeu
  sauter() { if (!this.cerveau || this.periode === 3) return; this._finLecture(); this.saut = true; this._faceJusqua = -1; this._faceVu = null; this.zf = 0; }
  // L'AVANCE RAPIDE jusqu'au prochain geste en course
  sauterGeste() { if (!this.cerveau || this.periode === 3) return; this._finLecture(); this.sautGeste = true; this._faceJusqua = -1; this._faceVu = null; this.zf = 0; }
  /** LE PROCHAIN TEMPS FORT : l'avance rapide (le magnétoscope tourne) jusqu'à un tir, un but, un carton ou un penalty ; puis le différé
   *  depuis 6 s avant, jusqu'au direct (et les ralentis si c'est un but). */
  prochainTempsFort() { if (this.periode === 3) return; this._finLecture(); this.sautTF = true; this.tf = null; this.pause = false; }
  /** 10 s en arrière : le différé jusqu'au direct (le match attend). */
  reculer(s = 10) {
    const M = this.magneto; if (!M || M.total < 2) return;
    this._finLecture();
    const src = M.commeClip(), i0 = Math.max(0, src.n - 1 - Math.round(s * M.hz));
    this._lancer([{ src, i0, i1: src.n - 1, vitesse: 1, plan: null, badge: 'Différé', differe: true }]);
  }
  /** Revoir le but n (−1 : le dernier) : ses ralentis. */
  revoirBut(n = -1) {
    const c = this.clips.at(n); if (!c) return;
    this._finLecture(); this._lancer(this._ralentis(c));
  }
  /** Retour au direct : la lecture s'arrête, le match reprend. */
  passerLecture() { this._finLecture(); }

  // ———————————————————————————— chaque image ————————————————————————————
  update(dt) {
    if (!this.M) return;
    const tp = performance.now();
    // la lecture avance au plus de 0,1 s par image : une image très longue (l'onglet qui revient, une machine lente) sautait le ralenti
    if (this.lecture) this._lire(this.pause ? 0 : Math.min(dt, 0.1));
    else {
      if (!this.pause) this._avancer(dt);
      if (!this.lecture) this._poserDirect();
    }
    const dp = performance.now() - tp; this.poseMs += dp; this.poseN++; this.tot.poseMs += dp; this.tot.frames++;
    this._camera(dt);
    this.stade?.update(dt, this.camRef);
    this._foule();
    this.habillage?.maj(dt);
    this.t += dt;
    const now = performance.now(); this._fpsN++;
    if (now - this._fpsT0 > 500) this._mesures(now);
  }

  /** LE MATCH AVANCE : le pas fixe (10 ms), autant de pas que le temps réel × la vitesse (plafonné : un onglet en pause ne rattrape pas). */
  _avancer(dt) {
    this.acc = Math.min(this.acc + dt * this.vitesse, 0.1 * Math.max(1, this.vitesse));
    let n = 0; while (this.acc >= 0.01) { this.acc -= 0.01; n++; }
    // l'avance rapide (le prochain face-à-face, geste, temps fort) : 3 s de jeu par image, le rendu suit
    if (this.saut || this.sautGeste || this.sautTF) { n = 300; this.acc = 0; }
    if (this.periode === 3) { n = 0; this.sautTF = false; }   // le coup de sifflet final : le match est figé sur son score
    if (!n) return;
    const t0 = performance.now(); let fait = 0;
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
        this._pas(k); reste -= k; fait += k;
        const j = this.C.lireJournal(this.M);
        this.cerveau.observer(j);
        this._apres(j, k);
        if (this.lecture) break;   // un ralenti ou un différé commence : le match attend ici
      }
    } else { this._pas(n); fait = n; this._periodes(); this._apres(null, n); }
    const d = performance.now() - t0; this.simMs += d; this.simSteps += fait; this.tot.simMs += d; this.tot.simSteps += fait;
  }

  /** k pas du corps, en tranches de 2 : le magnétoscope enregistre aux pas pairs (50 Hz). */
  _pas(k) {
    for (let s = 0; s < k;) {
      const m = Math.min(k - s, 2 - (this.pas % 2));
      this.M._gf_step(m); this.pas += m; s += m;
      if (this.pas % 2 === 0) this._enregistrer();
    }
  }
  _F() { return new Float32Array(this.M.HEAPF32.buffer, this.M._gf_frame(), this.HEAD + 22 * this.PER); }
  _Q() { return new Float32Array(this.M.HEAPF32.buffer, this.M._gf_pose(), 22 * this.POSE); }
  _enregistrer() {
    const ge = this.cerveau?.geste, fa = this.cerveau?.face;
    this.magneto.enregistrer(this._F(), this.HEAD, this.PER, this._Q(), { pas: this.pas, per: this.periode,
      ge: ge && q.get('gestes') !== '0' ? [ge.porteur, ge.depuis] : null, fa: fa ? [fa.porteur, fa.defenseur, fa.depuis] : null });
  }

  /** Après chaque avance : la feuille, les bandeaux, les buts (et leurs ralentis), le prochain temps fort. */
  _apres(j, k) {
    const EV = this.C.EV;
    if (this.feuille && j) this.feuille.observer(this.C.lireEtat(this.M, this.HEAD, this.PER), j, { per: this.periode, dt: k * 0.01, cerveau: this.cerveau });
    if (j) for (const ev of j) {
      if (ev.type === EV.FAUTE && ev.a >= 2 && this.feuille) { const f = this.feuille.chronologie().filter((x) => x.k === 'carton').at(-1); if (f) this.habillage?.carton(f); }
      else if (ev.type === EV.CPA && ev.a === 6) this.habillage?.annonce('PENALTY', EQUIPES[ev.equipe]?.nom ?? '', '', { classe: 'info', duree: 4 });
      // le temps fort cherché : un tir, un carton, un penalty — on filme encore 1,5 s (l'issue), puis le différé depuis 6 s avant
      if (this.sautTF && !this.tf && ((ev.type === EV.TOUCHE && ev.b === this.C.GESTE.TIR) || (ev.type === EV.FAUTE && ev.a >= 2) || (ev.type === EV.CPA && ev.a === 6))) this.tf = { t0: ev.t - 6000, pasFin: this.pas + 150 };
    }
    // LE BUT (le score du corps : vrai aussi sous leur IA) — le bandeau, le public ; le ralenti part 0,46 s plus tard (le ballon au fond des
    // filets ; le corps replace tout le monde 0,5 s après le but)
    const F = this._F();
    for (let t = 0; t < 2; t++) if (F[4 + t] > this._score[t]) {
      this._score[t] = F[4 + t];
      const f = this.feuille?.chronologie().filter((x) => x.k === 'but').at(-1);
      const fb = f && f.team === t ? f : { team: t, by: null, minute: Math.floor(F[0] / 60000) + 1 };
      this.habillage?.but(fb, [...this._score]);
      this.stade?.public?.cheer(t, 9);
      this.butsEnAttente.push({ iBut: this.magneto.total - 1, pasFin: this.pas + 46, team: t, t: F[0] });
    }
    if (this.butsEnAttente.length && this.pas >= this.butsEnAttente[0].pasFin) {
      const b = this.butsEnAttente.shift(), M = this.magneto, i0 = Math.max(M.debut, b.iBut - 12 * M.hz);
      const c = M.extraire(i0, M.fin); c.iBut = b.iBut - i0; c.team = b.team; this.clips.push(c);
      if (this.sautTF) {
        // le temps fort était un but : le différé depuis le temps fort (ou 8 s avant le but), puis les ralentis
        const src = M.commeClip(), deb = Math.max(0, M.indexA(this.tf ? this.tf.t0 : b.t - 8000) - M.debut);
        this.sautTF = false; this.tf = null;
        this._lancer([{ src, i0: deb, i1: src.n - 1, vitesse: 1, plan: null, badge: 'Temps fort', differe: true }, ...(this.reglages.ralentis ? this._ralentis(c) : [])]);
      } else if (this.reglages.ralentis && !this.saut && !this.sautGeste) this._lancer(this._ralentis(c));
      return;
    }
    if (this.sautTF && this.tf && this.pas >= this.tf.pasFin && !this.butsEnAttente.length) {
      const M = this.magneto, src = M.commeClip(), deb = Math.max(0, M.indexA(this.tf.t0) - M.debut);
      this.sautTF = false; this.tf = null;
      this._lancer([{ src, i0: deb, i1: src.n - 1, vitesse: 1, plan: null, badge: 'Temps fort', differe: true }]);
    }
  }

  /** Les ralentis d'un but : derrière le but (×0,5, depuis 4,5 s avant), puis au ras de la pelouse (×0,3, depuis 2,2 s avant). */
  _ralentis(c) {
    const hz = this.magneto.hz;
    return [
      { src: { n: c.n, img: c.img }, i0: Math.max(0, c.iBut - Math.round(4.5 * hz)), i1: c.n - 1, vitesse: 0.5, plan: 'but', equipe: c.team, badge: 'Ralenti' },
      { src: { n: c.n, img: c.img }, i0: Math.max(0, c.iBut - Math.round(2.2 * hz)), i1: c.n - 1, vitesse: 0.3, plan: 'bas', equipe: c.team, badge: 'Ralenti' },
    ];
  }
  _lancer(segs) { if (!segs.length) return; this.lecture = { segs, k: 0, u: segs[0].i0 }; this._coupe = true; }
  _finLecture() { if (this.lecture) { this.lecture = null; this._coupe = true; } }

  /** LA LECTURE : la tête avance (la cadence × la vitesse du segment), deux images interpolées, les poses et le ballon posés. */
  _lire(dt) {
    const L = this.lecture, M = this.magneto;
    let S = L.segs[L.k];
    L.u += dt * M.hz * S.vitesse;
    if (L.u > S.i1) {
      L.k++; S = L.segs[L.k];
      if (!S) { this.lecture = null; this._coupe = true; this._poserDirect(); return; }
      L.u = S.i0; this._coupe = true;
    }
    const i = Math.min(S.i1, Math.floor(L.u)), u = Math.min(1, L.u - i), A = S.src.img(i), B = S.src.img(Math.min(S.i1, i + 1));
    const I = interpoler(A, B, u, this._img, this.POSE);
    for (let k = 0; k < 22; k++) { const pl = this.players[k]; pl.model.visible = I[IMG.ACT + k] > 0; this._pose(pl, I, IMG.POSE + k * this.POSE); }
    this.ball.position.set(I[IMG.B], Math.max(0.11, I[IMG.B + 2]), -I[IMG.B + 1]);
    // le tableau : le passé en différé ; pendant un ralenti, le direct (le score d'après le but)
    if (S.differe) this.affiche = { t: I[IMG.T], score: [I[IMG.SC], I[IMG.SC + 1]], per: I[IMG.PER], lecture: S.badge, saut: null };
    else this.affiche = { ...this._afficheDirect(), lecture: S.badge };
    const ge = I[IMG.GE] >= 0 ? { porteur: I[IMG.GE], depuis: I[IMG.GE + 1] } : null, fa = I[IMG.FA] >= 0 ? { porteur: I[IMG.FA], defenseur: I[IMG.FA + 1], depuis: I[IMG.FA + 2] } : null;
    this.vue = { ge, fa, pe: I[IMG.POSS], pj: I[IMG.POSS + 1], plan: S.plan, equipe: S.equipe };
  }

  _afficheDirect() {
    const F = this._F();
    const saut = this.sautTF ? 'Vers le prochain temps fort…' : this.saut ? 'Vers le prochain face-à-face…' : this.sautGeste ? 'Vers le prochain geste…' : null;
    return { t: F[0], score: [F[4], F[5]], per: this.periode, lecture: null, saut };
  }
  /** Le direct : les poses du corps (gf_pose), le ballon, qui est en jeu ; ce que la caméra suit. */
  _poserDirect() {
    const F = this._F(), Q = this._Q();
    for (let k = 0; k < 22; k++) { const pl = this.players[k]; pl.model.visible = F[this.HEAD + k * this.PER + 11] > 0; this._pose(pl, Q, k * this.POSE); }
    this.ball.position.set(F[6], Math.max(0.11, F[8]), -F[7]);
    this.affiche = this._afficheDirect();
    const fa = this.cerveau?.face ?? null, ge = q.get('gestes') !== '0' ? this.cerveau?.geste ?? null : null;
    this.vue = { fa, ge, pe: F[9], pj: F[10], plan: null };
  }

  /** Le radar : les 22 (position dans la scène, équipe, gardien, en jeu, porteur) et le ballon. */
  radar() {
    if (!this.players.length || !this.ball) return null;
    const pe = this.vue?.pe, pk = pe === 0 || pe === 1 ? pe * 11 + this.vue.pj : -1;
    return { joueurs: this.players.map((pl, k) => ({ x: pl.model.position.x, z: pl.model.position.z, equipe: pl.team, gardien: !!this.gardien?.[k], visible: pl.model.visible, porteur: k === pk })),
      ballon: { x: this.ball.position.x, z: this.ball.position.z } };
  }
  /** Le porteur à l'écran (son nom, au-dessus de sa tête) — s'il a le ballon (à moins de 2,5 m) et qu'il est devant la caméra. */
  porteurEcran() {
    const pe = this.vue?.pe; if (!this.camRef || !this.noms || (pe !== 0 && pe !== 1)) return null;
    const k = pe * 11 + this.vue.pj, pl = this.players[k], m = pl?.model, b = this.ball.position;
    if (!m || !m.visible || Math.hypot(m.position.x - b.x, m.position.z - b.z) > 2.5) return null;
    const v = (this._vEcran ??= new THREE.Vector3()).set(m.position.x, 2.15, m.position.z).project(this.camRef);
    if (v.z > 1 || Math.abs(v.x) > 1.05 || Math.abs(v.y) > 1.05) return null;
    // le cadre du canevas, relu au redimensionnement seulement (le relire à chaque image forcerait une mise en page après les écritures de l'habillage)
    if (!this._cadre) { const lire = () => { this._cadre = this.renderer.domElement.getBoundingClientRect(); }; lire(); addEventListener('resize', lire); }
    const cv = this._cadre;
    return { nom: this.noms[this.idDe[k]] ?? '', equipe: pl.team, x: cv.left + (v.x + 1) / 2 * cv.width, y: cv.top + (1 - v.y) / 2 * cv.height };
  }

  /** LE PUBLIC VIT LE MATCH : la tension monte quand le porteur approche du but adverse (à 30 m : rien ; sur la ligne : debout). */
  _foule() {
    const P = this.stade?.public; if (!P || !this.vue) return;
    const pe = this.vue.pe, c = pe === 0 || pe === 1 ? this.players[pe * 11 + this.vue.pj]?.model : null;
    for (let t = 0; t < 2; t++) P.tension(t, c && pe === t ? Math.max(0, 1 - Math.hypot((t === 0 ? 55 : -55) - c.position.x, c.position.z) / 30) : 0);
  }

  _mesures(now) {
    const F = this._F();
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
    // le geste en course : qui (son nom, son poste, son profil), lequel ; le dernier joué quelques secondes ; sinon le compte et la touche G
    const ge = this.cerveau?.geste, gd = this.cerveau?.gesteDernier, nG = this.cerveau?.stats?.().course?.partis ?? 0;
    const quiG = (id) => { const P = this.cerveau.profil(id); return P ? `${this.noms?.[id] ? `${this.noms[id]}, ` : ''}${P.equipe === 0 ? 'gauche' : 'droite'} ${P.poste}${P.archetype ? `, ${P.archetype}` : ''}` : ''; };
    const geste = !this.cerveau || q.get('gestes') === '0' ? ''
      : this.sautGeste ? ' · avance rapide jusqu’au prochain geste…'
      : ge ? ` · ${(GESTES_COURSE[ge.nom] ?? ge.nom).toUpperCase()} (${quiG(ge.porteur)})`
      : gd && F[0] / 1000 - gd.t < 3 && gd.issue !== 'pas-parti' ? ` · ${GESTES_COURSE[gd.nom] ?? gd.nom} (${quiG(gd.porteur)})`
      : ` · ${nG} geste${nG > 1 ? 's' : ''} en course · G : le prochain`;
    // en capture (?capture : images calculées une à une, rendu logiciel), les mesures de vitesse ne disent rien : le score et le temps seuls
    if (this._hud) this._hud.textContent = CAPTURE ? `${F[4]}-${F[5]} · ${horloge} · ${qui}${face}${geste}`
      : `${F[4]}-${F[5]} · ${horloge} · ${qui}${face}${geste} · ${fps.toFixed(0)} images/s · calcul ${cpu.toFixed(1)} ms par image (simulation ${msPas.toFixed(2)} ms par pas${this.cerveau ? `, cerveau ${msCerveau.toFixed(1)} ms par décision` : ''}, poses ${msPose.toFixed(2)} ms) · ${this.api} · ${cv.width}×${cv.height}${this.stade ? ` · ${this.stade.nom}, ${this.stade.capacite} places` : ''}`;
    // la ligne du geste dans l'habillage (hors capture) : ce que le cerveau fait jouer au corps, quand il le fait
    const recent = gd && F[0] / 1000 - gd.t < 3 && gd.issue !== 'pas-parti';
    this.habillage?.info(this.lecture ? '' : ge ? `${GESTES_COURSE[ge.nom] ?? ge.nom} — ${quiG(ge.porteur)}` : fa ? `Face-à-face — ${fa.feintes} feinte${fa.feintes > 1 ? 's' : ''}` : recent ? `${GESTES_COURSE[gd.nom] ?? gd.nom} — ${quiG(gd.porteur)}` : '');
    this.cerveauMs = 0; this.cerveauN = 0;
    this._fpsN = 0; this._fpsT0 = now; this.simMs = 0; this.simSteps = 0; this.poseMs = 0; this.poseN = 0; this._cpuMs = 0; this._cpuN = 0;
  }

  // LA MI-TEMPS ET LA FIN, à l'horloge du match ; vrai : le coup de sifflet final
  _periodes() {
    const tMatch = new Float32Array(this.M.HEAPF32.buffer, this.M._gf_frame(), 1)[0];
    if (this.periode === 1 && tMatch >= 45 * 60000) {
      this.M._gf_mi_temps(); this.periode = 2;
      this.habillage?.annonce('MI-TEMPS', `${EQUIPES[0].nom} ${this._score[0]} - ${this._score[1]} ${EQUIPES[1].nom}`, this._resume(), { classe: 'info', duree: 7 });
    }
    if (this.periode === 2 && tMatch >= 90 * 60000) {
      this.periode = 3; this.saut = false; this.sautGeste = false; this.sautTF = false;
      this.habillage?.annonce('FIN DU MATCH', `${EQUIPES[0].nom} ${this._score[0]} - ${this._score[1]} ${EQUIPES[1].nom}`, this._resume(), { classe: 'info', duree: 12 });
      if (!CAPTURE) setTimeout(() => { if (this.habillage && this.habillage.panneau !== 'stats') this.habillage.ouvrir('stats'); }, 2500);
    }
    return this.periode === 3;
  }
  /** Une ligne de résumé (possession, tirs, xG) pour les bandeaux de mi-temps et de fin. */
  _resume() {
    if (!this.feuille) return '';
    const R = this.feuille.rapport(), [a, b] = R.equipes;
    return `possession ${Math.round(a.possession ?? 50)} %-${Math.round(b.possession ?? 50)} % · tirs ${a.tirs}-${b.tirs} · xG ${(a.xg ?? 0).toFixed(1)}-${(b.xg ?? 0).toFixed(1)}`;
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

  // ———————————————————————————— la caméra ————————————————————————————
  /** Le champ VERTICAL qui donne `h` degrés d'horizontal à cet écran, borné. */
  _fovH(h, min = 25, max = 55) { return THREE.MathUtils.clamp(2 * THREE.MathUtils.radToDeg(Math.atan(Math.tan(THREE.MathUtils.degToRad(h / 2)) / this.camRef.aspect)), min, max); }
  _fov(f) { if (Math.abs(f - this.camRef.fov) > 0.05) { this.camRef.fov = f; this.camRef.updateProjectionMatrix(); } }

  _camera(dt) {
    if (!this.camRef || q.has('orbit')) return;
    const plan = this.vue?.plan ?? this.plan;
    const coupe = this._coupe; this._coupe = false;
    if (plan !== 'auto' && plan !== 'tele' && plan !== 'rapprochee') { this._planLibre(plan, dt, coupe); return; }
    if (coupe) this._libre = null;
    // le champ HORIZONTAL visé (51°, celui d'un écran 16:9 à 30° de vertical) : un téléphone en portrait ne regarde plus le terrain
    // par une fente de 17°. Le vertical s'ouvre, mais pas au-delà de 50° : plus haut, le haut de l'image passe au-dessus de la
    // ligne de touche opposée (du vide) et les joueurs deviennent des fourmis — en portrait, ≈ 35° d'horizontal
    this._fov(this._fovH(51, 30, 50));
    // la caméra rapprochée par défaut sur un écran en hauteur (un téléphone tenu droit ne peut pas montrer la largeur du jeu :
    // la télé y donne des fourmis sous un bandeau vide) ; le plan « télé » ou « rapprochée » l'impose
    const pres = plan === 'rapprochee' || (plan === 'auto' && this.camRef.aspect < 1);
    const k = 1 - Math.exp(-dt / (pres ? 0.5 : 0.8)), b = this.ball.position;
    if (coupe) { this.cam.x = pres ? b.x : THREE.MathUtils.clamp(b.x, -42, 42); this.cam.z = b.z * (pres ? 1 : 0.85); }
    this.cam.x += ((pres ? b.x : THREE.MathUtils.clamp(b.x, -42, 42)) - this.cam.x) * k;
    this.cam.z += (b.z * (pres ? 1 : 0.85) - this.cam.z) * k;
    const P = pres ? [this.cam.x, 7, this.cam.z + 14]   // la caméra RAPPROCHÉE : 15 m du ballon, 7 m de haut — on juge les corps et la complicité avec le ballon
      : [this.cam.x * 0.9, 17, 40 + this.cam.z * 0.4];   // la caméra TÉLÉ : une tribune latérale, 17 m de haut, qui suit le ballon (lissée) — le cadre d'une retransmission
    const L = [this.cam.x, 0, this.cam.z];
    // LE PLAN SERRÉ DU FACE-À-FACE (plan auto seulement) : la caméra descend à 9 m du duel, 3,8 m de haut, le milieu du porteur et de son
    // défenseur au centre, suivi de près (0,3 s) ; le duel fini, elle suit le ballon 1,5 s encore — la sortie part, souvent vers
    // elle : figée sur le lieu du duel, elle laissait les joueurs lui passer dessous
    // …ET SUR UN GESTE EN COURSE : le porteur au centre, de sa demande à 1,5 s après sa fin (le ballon suivi ensuite)
    const serre = plan === 'auto', fa = serre ? this.vue?.fa : null, ge = serre && !fa ? this.vue?.ge : null;
    let vise = null;
    if (fa) {
      const c = this._joueur(fa.porteur), d = this._joueur(fa.defenseur);
      if (c && d) { vise = [(c.position.x + d.position.x) / 2, (c.position.z + d.position.z) / 2]; this._faceJusqua = this.t + 1.5; }
    } else if (ge) {
      const c = this._joueur(ge.porteur);
      if (c) {
        vise = [(c.position.x * 2 + b.x) / 3, (c.position.z * 2 + b.z) / 3]; this._faceJusqua = this.t + 1.5;
        // LE FLANC DU PORTEUR : sa direction de course (lissée 0,25 s) — la caméra se met sur son côté, on voit ses appuis
        const pp = this._gePrev, kd = 1 - Math.exp(-dt / 0.25);
        if (pp && pp.id === ge.porteur) { const dx = c.position.x - pp.x, dz = c.position.z - pp.z, l = Math.hypot(dx, dz); if (l > 0.004) { const u = this._geDir ?? [dx / l, dz / l]; this._geDir = [u[0] + (dx / l - u[0]) * kd, u[1] + (dz / l - u[1]) * kd]; } }
        else this._geDir = null;
        this._gePrev = { id: ge.porteur, x: c.position.x, z: c.position.z };
      }
    } else if (serre && this.t < (this._faceJusqua ?? -1)) vise = [b.x, b.z];
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
      const w = this.zf * this.zf * (3 - 2 * this.zf), mix = (a, c) => a + (c - a) * w, enCourse = typeof vu.de === 'string';
      let off = [0, 9], h = 3.8;
      if (enCourse) {
        // le flanc DÉGAGÉ : des deux côtés de sa course, celui où aucun corps ne passe entre la caméra et lui (à 0,7 m du segment) ; à égalité,
        // le côté de la tribune (+z) ; le côté se choisit UNE fois, au départ du geste (changer de flanc en plein geste faisait passer la
        // caméra au-dessus du porteur)
        const u = this._geDir ?? [1, 0], l0 = Math.hypot(u[0], u[1]) || 1, perp = [-u[1] / l0, u[0] / l0];
        const c = this._joueur(this.vue?.ge?.porteur ?? -1);
        const gene = (sg) => { if (!c) return 0; const cx = c.position.x + perp[0] * 6 * sg, cz = c.position.z + perp[1] * 6 * sg; let n = 0;
          for (const pl of this.players) { const m = pl.model; if (m === c || !m.visible) continue; const ax = m.position.x - cx, az = m.position.z - cz, bx = c.position.x - cx, bz = c.position.z - cz, t = Math.max(0, Math.min(1, (ax * bx + az * bz) / (bx * bx + bz * bz))); if (Math.hypot(ax - bx * t, az - bz * t) < 0.7) n++; }
          return n; };
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

  /** LES AUTRES PLANS (rondo-cameras.js de la skill, au terrain du corps) — chacun une position et un regard visés, lissés (une grue ne
   *  saute pas) ; au changement de plan, la coupe franche :
   *    tactique — la plongée haute de Football Manager, le bloc des 22 : lire les lignes ;
   *    joueur   — derrière le porteur, dans le sens de son attaque (jamais sur le lacet du corps : il tremblerait à chaque appui) ;
   *    but      — derrière la cage du côté du ballon (ou du but marqué, au ralenti), 6 m derrière la ligne et 6 m de haut ;
   *    bas      — le ralenti au ras de la pelouse, de l'autre côté du terrain, à 14 m du ballon. */
  _planLibre(plan, dt, coupe) {
    const b = this.ball.position, V = this.vue ?? {};
    const pe = V.pe === 0 || V.pe === 1 ? V.pe : null, porteur = pe != null ? this.players[pe * 11 + V.pj]?.model : null;
    let P, L, h, tau = 0.5;
    if (plan === 'tactique') {
      const x = THREE.MathUtils.clamp(b.x, -26, 26);
      P = [x, 50, 40]; L = [x, 0, -3]; h = 78; tau = 0.9;
    } else if (plan === 'joueur') {
      // le porteur déclaré, tant que le ballon est à lui (à moins de 4 m) ; une passe en vol : le ballon
      const o = porteur && Math.hypot(porteur.position.x - b.x, porteur.position.z - b.z) < 4 ? porteur.position : b, sg = pe === 1 ? -1 : 1;
      P = [o.x - sg * 9, 4.4, o.z + 3.5]; L = [o.x + sg * 7, 1.2, o.z]; h = 72; tau = 0.35;
    } else if (plan === 'but') {
      const gs = V.equipe != null ? (V.equipe === 0 ? 1 : -1) : b.x >= 0 ? 1 : -1;
      // 6 m derrière la ligne, 6 m de haut : entre le fond du filet (2 m) et les panneaux (3,5 m) — à 11 m, en portrait, les panneaux bouchaient le bas de l'image
      P = [gs * (PITCH.hx + 6), 6, THREE.MathUtils.clamp(b.z * 0.3, -6, 6)]; L = [b.x, 0.9, b.z]; h = 58; tau = 0.35;
    } else {   // bas — 14 m, 2,4 m de haut, l'objectif serré : à 10 m et 1,5 m, les dos des joueurs bouchaient l'action (essai du 3 octobre)
      const sg = V.equipe === 1 ? -1 : 1;
      P = [b.x - sg * 6, 2.4, b.z - 14]; L = [b.x, 0.9, b.z]; h = 34; tau = 0.25;
    }
    const k = coupe || !this._libre ? 1 : 1 - Math.exp(-dt / tau);
    if (!this._libre || coupe) this._libre = { P: [...P], L: [...L] };
    for (let i = 0; i < 3; i++) { this._libre.P[i] += (P[i] - this._libre.P[i]) * k; this._libre.L[i] += (L[i] - this._libre.L[i]) * k; }
    this._fov(this._fovH(h, 25, 62));
    const p = this._libre.P, l = this._libre.L;
    this.camRef.position.set(p[0], p[1], p[2]); this.camRef.lookAt(l[0], l[1], l[2]);
    if (this.controls) this.controls.target.set(l[0], l[1], l[2]);
  }

  // le modèle d'un joueur par son id stable (celui du corps)
  _joueur(id) { const k = this.slot?.get(id); return k != null ? this.players[k]?.model ?? null : null; }
}
