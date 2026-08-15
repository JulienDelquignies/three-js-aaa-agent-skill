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
import { loadSquad, setCloner, rigBones } from '../engine/squad.js';
import { CharacterController } from '../engine/character-controller.js';
import { MOVES, mirrorMove } from '../engine/animkit.js';
import { GestureLayer } from '../engine/gesture-layer.js';
import { BALL } from '../engine/ball.js';
import { makeRondo, RONDO } from '../engine/rondo.js';
import { rondoStep, checkRondo } from '../engine/rondo-sim.js';
import { makeMatch, matchCfg, matchStep, checkMatch, MATCH } from '../engine/match-sim.js';
import { byId as TECHNIQUES_BY_ID } from '../engine/technique.js';
import { warpEnvelope, planWarp, planWarp3, warpReach, twoBoneIK, checkStrikeWarp, WARP, HAND_WARP } from '../engine/strike-warp.js';
import { Gaze, pickGazeTarget, gazeRng, checkGaze } from '../engine/gaze.js';
import { aimChildAt } from '../engine/foot-lock.js';
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
    // scratch du warp de frappe (zéro allocation par image)
    this._wv = new THREE.Vector3(); this._wf = new THREE.Vector3(); this._wt = new THREE.Vector3();
    this._wh = new THREE.Vector3(); this._wk = new THREE.Vector3(); this._wm = new THREE.Vector3();
    this.ready = this._build();
  }

  async _build() {
    const q = new URLSearchParams(location.search);
    this.free = q.has('orbit');
    // LE MODE SE LIT AVANT TOUT LE RESTE (le bug d'ordre est documenté : matchMode lu à la ligne
    // 106 et consommé à la 77 — la grille d'entraînement se dessinait sur tous les matchs)
    this.matchMode = q.has('match');
    // LE 11C11 (?full) : terrain Loi 1, 10 + gardien par équipe, postes de formation — la même
    // scène, le même moteur : une CONFIGURATION (la preuve que l'architecture scale à 22 corps)
    this.fullMode = this.matchMode && q.has('full');

    // ---- the stadium: pitch centre at the origin so sim space IS world space.
    // EN MATCH, LE STADE SE CONSTRUIT AUTOUR DU TERRAIN RÉDUIT (stade paramétrique) : ses cages
    // sont LES cages (mêmes lignes que pitch.js), sa pelouse peint LES surfaces — une seule vérité
    // au sol, plus de carré superposé ni de buts décoratifs à 3 m des vrais.
    const model = this.fullMode
      ? generateStadium({ tier: 4, landmark: 'grandbol' })   // défauts = plein format Loi 1
      : this.matchMode
        ? generateStadium({ tier: 4, landmark: 'grandbol', pitch: { L: 46, W: 30, circle: 4, box: { d: 8, w: 15 }, six: { d: 3, w: 9 }, spot: 7.5 }, goal: { w: 5, h: 2 } })
        : generateStadium({ tier: 5, landmark: 'grandbol' });
    const chk = checkStadium(model);
    if (!chk.ok) console.warn('checkStadium', chk.issues);
    const theme = makeTheme({ seed: 3, name: 'Grand Bol', primary: TEAMS[0].secondary, secondary: TEAMS[0].primary });
    const built = buildStadium(model, theme, { at: [0, 0, 0] });
    this.scene.add(built.group); this.disposables.push(built);
    this.scene.fog = new THREE.FogExp2(0x0a1020, 0.0016);

    // plein format sur écran étroit : la chaîne 'low' par défaut (le post 'high' à DPR mobile
    // sur 105 × 68 est le lag mesuré au téléphone) — ?q=high le rétablit explicitement.
    // Calculé AVANT le stade : la taille de la shadow map en dépend (lot 61).
    this._tier = q.get('q') || (this.fullMode && typeof window !== 'undefined' && window.innerWidth < 700 ? 'low' : 'high');

    // ---- night: floodlights + one shadow-casting sun fitted to the pitch
    this.night = setupStadiumNight(this.scene, this.renderer, { at: [0, 0, 0], model,
      // plein format : 22 corps skinnés se re-déforment dans la passe d'ombre — la map se
      // resserre (1024²) et le BUDGET DE CASTERS (update) limite qui la paie. Le 512² du lot 61
      // est REVENU à 1024 (lot 63 — « encore un peu les traits », capture) : son texel de 22 cm
      // reste au bord de l'acné sur les depth-buffers mobiles même sous la loi du biais, et le
      // budget GPU est rendu ailleurs (bloom OFF + MSAA OFF au tier low, lots 61-62).
      shadowMapSize: this.fullMode ? 1024 : 2048 });
    this.disposables.push(this.night);
    this._reports = { stadium: chk, night: checkStadiumNight(this.night, model), kits: [], gestes: [] };

    // LE LOD D'ANIMATION (lot 60) est actif par défaut — ?animlod=0 le coupe (sabotage nommé) ;
    // et le tier low PLAFONNE le pixel ratio à 1,75 (un écran 2,6× DPR paie 6,8 fragments pour 1 —
    // à 412 px de large, 1,75 est indiscernable et rend ~30 % du budget GPU).
    this._animLod = q.get('animlod') !== '0';
    if (this._tier === 'low' && this.renderer?.setPixelRatio && typeof window !== 'undefined') {
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    }
    // …ET LA RÉSOLUTION EST DYNAMIQUE EN PLEIN FORMAT (lot 61) : le tier se choisit à l'ouverture,
    // le GPU réel ne se voit qu'en jouant — update() mesure le fps mural et ajuste. ?dynres=0 coupe.
    this._dynRes = this.fullMode && q.get('dynres') !== '0';

    // ---- the grid the game is played in, painted on the grass
    // un ENTRAÎNEMENT a son carré et ses cônes ; un MATCH n'ajoute rien au sol — le stade
    // paramétrique a déjà peint les lignes et posé les cages
    this.grid = this.matchMode ? null : buildRondoGrid(RONDO.area);
    if (this.grid) { this.scene.add(this.grid.group); this.disposables.push(this.grid); }

    this.ball = ballMesh();
    this.scene.add(this.ball); this.disposables.push(this.ball);
    // the key is masked to the pitch (that is what makes the bowl fall away into night), so anything
    // standing ON the pitch has to be opted in or it goes unlit
    if (this.grid) this.night.light(this.grid.group);
    this.night.light(this.ball);

    // ---- the game itself
    // ?n=3 pour un 3 contre 3. Sur un téléphone, dix bonshommes dans un carré de 16 m sont dix taches
    // de trois pixels ; à six, on voit ce que chacun fait — ce qui est tout l'intérêt de la scène.
    const perTeam = this.fullMode
      ? Math.max(6, Math.min(10, Number(q.get('n')) || 10))
      : Math.max(2, Math.min(6, Number(q.get('n')) || 5));
    // ?match : LE MATCH RÉDUIT — deux buts, gardiens, tirs, remises (match-sim). Même scène, même
    // pipeline visuel : le match est une CONFIGURATION du moteur, l'habillage ne change pas.
    // en plein format, la portée de tir suit l'échelle (les frappes du 11c11 partent de 16-25 m)
    // …et le CYCLE DE MATCH (chrono — l'enveloppe produit) : deux mi-temps de 3 min, sifflet
    // final, feuille. Le réduit garde son monde sans fin (calibré 76 clauses).
    this._mcfg = this.fullMode ? matchCfg({ shotRange: 20, chrono: { periodes: 2, duree: 180, pause: 6 } })
      : this.matchMode ? matchCfg() : null;
    this.state = this.matchMode
      ? makeMatch({ perTeam, seed: Number(q.get('seed')) || 7, full: this.fullMode })
      : makeRondo({ perTeam, seed: Number(q.get('seed')) || 7 });
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
      const { model: model3d, groundY: groundY0, clips, rig } = this.squad.spawn(p.team);
      // la TAILLE de la persona (±4 %) — appliquée par-dessus la normalisation du squad, avec le
      // sol qui suit : c'est la première chose que l'œil lit pour distinguer deux corps
      // le LOOK injecté (attributes/squads : taille du projet amont) prime sur l'accent persona
      const kScale = p.look?.scale ?? p.persona?.scale ?? 1;
      model3d.scale.multiplyScalar(kScale);
      const groundY = groundY0 * kScale;
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
      // le gardien porte SA couleur — le métier se lit avant le maillot d'équipe
      const tint = tintPart(model3d, { match: /Shirt/i, color: p.keeper ? 0xd7b12a : (p.look?.shirt ?? TEAMS[p.team].primary) });
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
      // …et les chaînes de BRAS, pour le warp du gant (le plongeon) — mêmes primitives que les jambes
      const arms = [
        { up: bone(/LeftArm$/i), elbow: bone(/LeftForeArm$/i), hand: bone(/LeftHand$/i) },
        { up: bone(/RightArm$/i), elbow: bone(/RightForeArm$/i), hand: bone(/RightHand$/i) },
      ];
      const ctrl = new CharacterController(model3d, {
        mixer,
        runClip: clips.find((a) => /run/i.test(a.name)),
        idleClip: clips.find((a) => /idle/i.test(a.name)),
        walkClip: clips.find((a) => /walk/i.test(a.name)),
        legs, stride: 2.6, runSpeed: RONDO.speeds.chase, persona: p.persona,
        forwardLocal: new THREE.Vector3(0, 0, -1),
      });
      this.night.light(model3d);            // opt the player (kit included) into the key's layer
      // le warp de frappe a besoin des chaînes de jambe PAR PIED et de leurs longueurs (mesurées
      // sur le rig posé, comme foot-lock) — l'autorité de la jambe frappeuse pendant l'armé
      const _a = new THREE.Vector3(), _b = new THREE.Vector3();
      const legLen = (l) => {
        l.up.getWorldPosition(_a); l.knee.getWorldPosition(_b);
        const A = _a.distanceTo(_b);
        l.foot.getWorldPosition(_a);
        return { A, B: _b.distanceTo(_a) };
      };
      // LA COUCHE DE GESTE (engine/gesture-layer) : la pose authorée posée ABSOLUE, par membre,
      // après le mixer. Le rest vient du TEMPLATE de squad.js — jamais animé, donc exactement le
      // repère contre lequel le banc de swing prouve les clips. Les deltas additifs sur l'idle
      // retargeté ont été mesurés : base tournée de 20-43° par os, le balayage partait DERRIÈRE.
      const entry = this.squad.entries.find((e) => (e.spec.name || e.spec.url) === rig);
      // L'ÉCRIVAIN DU BASSIN : les specs authorent le root motion en MÈTRES PERSONNAGE
      // [droite, haut, avant] — la conversion vers le local du parent des hanches est celle de
      // toClip (base du modèle → inverse du parent, qui absorbe la rotation d'armature ET les cm).
      // Sans lui, la couche jetait le hips-motion des specs : le tacleur « glissait » DEBOUT,
      // hanches à hauteur de marche (mesuré par deux sondes indépendantes du sweep).
      const hipsBone = (() => { let b = null; model3d.traverse((o) => { if (o.isBone && /Hips$/i.test(o.name) && !b) b = o; }); return b; })();
      // …avec un canal de BIAIS (axes personnage) : LA RÉCONCILIATION DES DEUX VOYAGES du
      // plongeon — la sim transporte le corps (lunge borné) ET le clip dessine son root motion ;
      // sans soustraction, le rendu ADDITIONNAIT les deux (le corps couché 1,35 m plus loin que
      // la sim, puis RECUL d'autant au fondu — la « téléportation » des captures). delta appliqué
      // = clip − voyage sim : le dessin domine tôt, converge vers la sim, le fondu part de ≈ 0.
      const hipsCtl = { bias: null };
      const hipsWrite = (() => {
        if (!hipsBone) return null;
        model3d.updateMatrixWorld(true);
        const toWorld = new THREE.Matrix3().setFromMatrix4(model3d.matrixWorld);
        const toParent = new THREE.Matrix3().setFromMatrix4(hipsBone.parent.matrixWorld).invert();
        const rest = hipsBone.position.clone();
        const d = new THREE.Vector3();
        return (delta, w) => {
          const b = hipsCtl.bias;
          d.set(delta[0] - (b ? b[0] : 0), delta[1] - (b ? b[1] : 0), -(delta[2] - (b ? b[2] : 0)))
            .applyMatrix3(toWorld).applyMatrix3(toParent); // forward = −Z
          hipsBone.position.set(rest.x + d.x * w, rest.y + d.y * w, rest.z + d.z * w);
        };
      })();
      // …et l'écrivain ADDITIF du bassin — le warp de translation racine (troisième consommateur
      // du warp de contact : pied, gant, bassin). Delta en MONDE (mètres), converti par la
      // matrice COURANTE du parent (contrairement à hipsWrite, l'entrée est monde : la capture
      // statique serait fausse dès que le modèle tourne). S'ajoute PAR-DESSUS l'écriture du
      // clip, une fois par image — la couche ré-écrit les hanches à chaque apply, pas de cumul.
      const hipsNudge = (() => {
        if (!hipsBone) return null;
        const m = new THREE.Matrix3(); const d = new THREE.Vector3();
        return (dw) => {
          m.setFromMatrix4(hipsBone.parent.matrixWorld).invert();
          d.set(dw[0], dw[1], dw[2]).applyMatrix3(m); hipsBone.position.add(d);
        };
      })();
      const gestureLayer = new GestureLayer({ bones: rigBones(model3d), rest: entry.bones, hipsWrite });
      ctrl.lockExternal = true;   // le verrou des pieds se résout en toute FIN de pile (voir plus bas)
      // LE REGARD (engine/gaze.js) : la couche que le sweep a classée n°1 en manque de réalisme —
      // médiane tête→ballon 49-65° dans tous les rôles, receveur qui ne regarde le ballon que
      // 5,2 % du vol. Politique par rôle (pure), mécanisme rate-limité, cible tenue EN MONDE.
      const cloneBones = rigBones(model3d);
      const gaze = new Gaze({ neck: cloneBones.get('Neck'), head: cloneBones.get('Head') });
      this.players.push({
        sim: p, model: model3d, ctrl, mixer, groundY, rig, gestureLayer, hipsNudge, hipsCtl,
        gaze, _gazeSt: {}, _gazeRng: gazeRng(p.id + 13),
        legs: { left: legs[0], right: legs[1] },
        legLens: { left: legLen(legs[0]), right: legLen(legs[1]) },
        arms: { left: arms[0], right: arms[1] },
        armLens: {
          left: arms[0].up && arms[0].elbow && arms[0].hand ? legLen({ up: arms[0].up, knee: arms[0].elbow, foot: arms[0].hand }) : null,
          right: arms[1].up && arms[1].elbow && arms[1].hand ? legLen({ up: arms[1].up, knee: arms[1].elbow, foot: arms[1].hand }) : null,
        },
      });
    }

    // ---- les gestes : LA COUCHE, plus le mixer. Les clips additifs (toClip + makeClipAdditive)
    // composaient le delta sur l'idle RETARGETÉ — base tournée de 20° (cuisse), 32° (tibia), 43°
    // (bassin) par rapport au rest contre lequel les specs sont écrites et prouvées : le plan du
    // balayage pivotait, la passe dessinait une talonnade (pied composé DERRIÈRE-HAUT au contact,
    // mesuré [−0,27, 0,43, 0,57] local contre [·, 0,16, avant] au banc). La couche de geste
    // (engine/gesture-layer) pose la pose authorée ABSOLUE — rest ⊗ q_spec(0)⁻¹ ⊗ q_spec(t) — par
    // membre, après le mixer : à poids 1 la pose affichée est CELLE DU BANC, quelle que soit la
    // base. L'horloge est act.t (la sim) : un seul instant, un seul contrat. Le scindé haut/jambes
    // et ses lois de poids (bras tout de suite, jambes fondues par l'arrivée) sont inchangés — la
    // couche ne décide pas QUAND le geste a les membres, seulement CE QUE les membres montrent.
    // …et on prouve au démarrage que toute technique de la table a un geste authoré : un repli
    // silencieux a déjà caché 57,3 % des gestes pendant une session entière.
    {
      const manquants = Object.values(TECHNIQUES_BY_ID).map((t) => t.clip).filter((c) => !MOVES[c]);
      if (manquants.length) this._reports.gestes.push(`techniques sans geste authoré : ${[...new Set(manquants)].join(', ')}`);
    }
    // le point de contact du pied en espace personnage, CALIBRÉ EN LIGNE par (rig × clip × pied) —
    // mesuré sur le jeu composé lui-même au passage du contact (un probe statique hors pile a été
    // essayé et condamné : il mesurait une ombre — charte, loi 8). Premier geste : mesure ;
    // suivants : warp.
    this._contactLive = new Map();
    // l'auto-test du warp au démarrage, comme les autres contrats embarqués
    this._reports.warp = checkStrikeWarp();
    if (!this._reports.warp.ok) console.warn('checkStrikeWarp', this._reports.warp.issues);
    this._reports.gaze = checkGaze();
    if (!this._reports.gaze.ok) console.warn('checkGaze', this._reports.gaze.issues);
    this._warpStats = { n: 0, mags: [], denied: {} };

    this._hud = document.getElementById('score');
    // le TICKER DES GESTES (retour utilisateur : « j'ai du mal à distinguer les feintes de
    // frappe, les passements… ») : chaque événement 'skill' de la sim s'annonce, nommé, daté,
    // avec son équipe — l'élément n'existe que sur la page match, la scène s'en passe sinon
    this._gesteHud = document.getElementById('gestes');
    this._gesteLog = [];
    // LE SIFFLET SE VOIT (lot 59 — capture utilisateur : un hors-jeu sifflé lu comme « le
    // receveur ne va pas au ballon », le ticker étant coupé au zoom mobile). Un flash central
    // bref NOMME chaque décision d'arbitrage, à n'importe quel zoom. Créé ici, pas dans le
    // HTML : toute page qui monte la scène l'a d'office — le moteur porte sa lisibilité.
    this._flash = document.createElement('div');
    this._flash.style.cssText = 'position:fixed;top:11%;left:50%;transform:translateX(-50%);padding:.3em .85em;'
      + 'font:700 clamp(18px,4vw,34px)/1.2 system-ui,sans-serif;letter-spacing:.08em;color:#fff;'
      + 'background:rgba(10,14,12,.74);border-left:.22em solid #f2c14e;border-radius:.3em;opacity:0;'
      + 'transition:opacity .25s;pointer-events:none;z-index:40;text-transform:uppercase;white-space:nowrap';
    document.body.appendChild(this._flash);
    this._sifflet = (txt, couleur = '#f2c14e') => {
      this._flash.textContent = txt;
      this._flash.style.borderLeftColor = couleur;
      this._flash.style.opacity = '1';
      clearTimeout(this._flashT);
      this._flashT = setTimeout(() => { this._flash.style.opacity = '0'; }, 1600);
    };
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
    // plein format : le DPR se cape à 1,5 (un téléphone à DPR 3 → 2 quadruple déjà les
    // fragments du réduit ; à 22 corps + grand stade, 1,5 rend ~44 % des pixels au GPU).
    // Ce cap devient le PLAFOND de la résolution dynamique (lot 61) : elle peut rendre des
    // pixels sous la charge, jamais en offrir plus qu'à l'ouverture.
    if (this.fullMode && this.renderer?.setPixelRatio) {
      this._dprCap = Math.min(window.devicePixelRatio ?? 1, 1.5);
      this.renderer.setPixelRatio(this._dprCap);
    }
    // le match cadre le TERRAIN, et la régie vit AU-DESSUS de la tribune — le stade réduit a
    // rapproché le premier rang à 21 m du centre : l'ancienne position (z=−34) filmait l'intérieur
    // du béton (écran noir mesuré). Passerelle haute, plongée douce, tout le terrain dans le cadre.
    const back = this.fullMode ? (narrow ? 42 : 47)
      : this.matchMode ? (narrow ? 17 : 20) : 19 - (5 - this.perTeam) * 1.6 - (narrow ? 3.5 : 0);
    cam.fov = this.matchMode ? (narrow ? 56 : 50) : (narrow ? 34 : 30); cam.updateProjectionMatrix();
    cam.position.set(0, this.fullMode ? 40 : this.matchMode ? 19 : 8.5 - (narrow ? 1.2 : 0), -back);
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
    // UN ACTE ownsBody POSSÈDE LE CORPS (charte, loi 1) — jusqu'au bout de son accompagnement.
    // La prise du gardien émet un événement de réception PENDANT le plongeon : la scène jouait
    // « amorti » par-dessus la détente et le gardien se REDRESSAIT à l'instant de l'arrêt
    // (mesuré : spec=amorti sur 5/7 arrêts, gant à ~1 m d'un ballon au sol). Un geste réactif
    // ne reprend pas un corps qu'un acte possède ; seul le windup de l'acte lui-même passe.
    if (pl.sim.act?.payload?.ownsBody && e.type !== 'windup' && pl.gestureLayer.active) return;
    const move = e.move || (e.tech && TECHNIQUES_BY_ID[e.tech]?.clip) || (e.type === 'control' ? 'amorti' : 'passe');
    // UN GESTE MANQUANT DOIT SE VOIR. Ce repli était silencieux (`set[move] || set.passe`), et c'est
    // exactement pourquoi 57 % des gestes ont pu dessiner le mauvais mouvement pendant toute une
    // session sans qu'aucun contrat ne bronche : le jeu affichait quelque chose de plausible. Un repli
    // qui se tait est pire qu'une erreur.
    const spec = MOVES[move] || (this._reports.gestes.push(`geste absent : ${move}`), MOVES.passe);
    // LE MIROIR DU PLONGEON SE JUGE AU MODÈLE, pas à une convention monde : la sim ne connaît ni
    // l'offset de facing du rig ni le lissage du regard rendu — « cross.z > gk.z → gauche »
    // jouait la moitié des plongeons à l'envers (clip dessiné à l'opposé de la détente, hips à
    // 2,5 m du corps — « il plonge du mauvais côté », captures). Ici : le lunge sim projeté sur
    // la DROITE RÉELLE du modèle (colonne X de sa matrice monde) choisit le côté du clip.
    let useMirror = e.foot === 'left';
    if (/^plongeon/.test(move)) {
      const lg = pl.sim.act?.payload?.lunge;
      // l'interrupteur de SABOTAGE de l'instrument composé (audit-gants) : rejouer la convention
      // monde naïve — la clause du relevé-au-lieu doit mordre
      if (typeof window !== 'undefined' && window.__sabotage === 'plongeon-monde') { pl._diveMirror = useMirror; }
      else if (lg) {
        pl.model.updateMatrixWorld(true);
        const me = pl.model.matrixWorld.elements;
        useMirror = (lg[0] * me[0] + lg[1] * me[2]) < 0;
        pl._diveMirror = useMirror;
      } else pl._diveMirror = useMirror;
    }
    const r = pl.gestureLayer.begin(useMirror ? mirrorMove(spec) : spec);
    if (r.missing.length) this._reports.gestes.push(`${move}: os absents du rig ${pl.rig} : ${r.missing.join(', ')}`);
    // l'horloge de la couche : act.t quand la sim porte le geste (un seul instant, un seul
    // contrat) ; sinon une horloge locale — les gestes réactifs (contrôle rapporté après coup)
    // démarrent À leur frame de contact, comme avant.
    pl._layerClock = { t0: this._t, offset: from === 'contact' ? (spec.contact ?? 0) : 0, dur: spec.duration ?? 0.6, antic: spec.contact ?? 0.2 };
    pl._wLegs = pl._wLegs ?? 0;
  }

  /** LE WARP DE FRAPPE, appliqué. L'autorité de la jambe frappeuse pendant l'armé (foot-lock se
   *  retire sur gestureHold — sans ceci, personne ne possède ce pied), projetée EN DERNIER :
   *  mixer → poids des étages → warp (charte, loi 2). La correction est planaire (la hauteur reste
   *  au clip), bornée (refus nommés au registre), pondérée par le poids RÉEL des jambes du geste
   *  (le warp corrige la jambe du geste dans la proportion où le geste la possède — corriger une
   *  jambe qui marche encore serait la chimère), et GELÉE à l'instant du tir (le ballon part : on
   *  ne chasse pas un ballon en vol, on rend la jambe à l'accompagnement authoré). */
  /** LE WARP DU GANT — le DEUXIÈME consommateur du warp de contact (la preuve que c'est une
   *  capacité moteur, pas un cas spécial de la frappe). Pendant la détente du plongeon, la main
   *  du côté du geste est corrigée EN 3D vers la surface du ballon vivant — mêmes lois que le
   *  pied de frappe (enveloppe C¹, borné + refus nommé, standoff à la surface, gel à la
   *  résolution — après la claquette on ne chasse pas un ballon qui repart), même primitive
   *  (IK deux os épaule-coude-poignet). Mesuré avant : gant à 1,0-2,1 m du ballon À L'INSTANT
   *  DE L'ARRÊT (p50 1,67 m) — l'arrêt était vrai en sim, faux aux gants. */
  _applyDiveWarp(pl) {
    // l'interrupteur de SABOTAGE de l'instrument composé (audit-gants) : la clause doit mordre
    if (typeof window !== 'undefined' && window.__sabotage === 'warp-gant') { pl._dwarp = null; return; }
    const a = pl.sim.act;
    if (!a || a.payload?.skill !== 'plongeon') { pl._dwarp = null; return; }
    const side = (pl._diveMirror ?? (a.payload.pick?.foot === 'left')) ? 'left' : 'right';
    const arm = pl.arms?.[side], lens = pl.armLens?.[side];
    if (!arm?.up || !arm.elbow || !arm.hand || !lens) return;
    // L'ENVELOPPE DU GANT EST DISTANCE-CLÉE — deuxième espèce d'enveloppe du warp : un contact
    // de frappe a une HEURE authorée (clé du clip, enveloppe temporelle C¹) ; un plongeon n'a
    // pas d'heure, il a une APPROCHE — le gant monte à mesure que le ballon arrive,
    // avec une rampe d'amorçage (0,12 s) contre le pop de première image. Mesuré avec
    // l'enveloppe temporelle : les prises précoces (a.t ≈ 0,2 < 40 % de l'armé) plafonnaient à
    // env ≈ 0,06 — gant à 1,0 m du ballon à l'instant de l'arrêt.
    let env;
    const b = this.state.ball.p;
    if (!a.payload.resolved) {
      // …clée sur la distance BALLON-ÉPAULE (la vérité sim de l'arrêt : la prise se juge du
      // corps), PAS gant-ballon — cette version-là était CIRCULAIRE : gant loin → enveloppe
      // faible → gant reste loin (mesuré : env 0,54-0,64 sur les arrêts résolus, gant à 0,7-0,9 m).
      arm.up.getWorldPosition(this._wh);
      const dSB = Math.hypot(this._wh.x - b[0], this._wh.y - b[1], this._wh.z - b[2]);
      // …plus le terme d'URGENCE : sur un ballon à bout portant (arrivée < 0,45 s), la main est
      // une SACCADE — le seul membre où la montée en 2-3 images est la vérité biomécanique (les
      // plongeons-réflexe restaient gant à 1 m : les deux enveloppes n'avaient pas le temps)
      const bv = this.state.ball.v;
      const tArr = dSB / Math.max(3, Math.hypot(bv[0], bv[1], bv[2]));
      const envDist = Math.max(0, Math.min(1, (2.2 - dSB) / 1.2));
      const envUrg = Math.max(0, Math.min(1, 1 - tArr / 0.45));
      env = Math.max(envDist, envUrg) * Math.min(1, a.t / 0.06);
      pl._dwEnv = env; pl._dwT = null;
      // LE WARP DE RACINE — troisième consommateur du warp de contact : quand l'ÉPAULE est plus
      // loin que bras + standoff, aucun membre ne peut couvrir (mesuré : bras à pleine extension,
      // gant à 0,68-0,88 m = dSB − portée, exactement). Le bassin complète la détente vers le
      // ballon : borné (0,45 m — un allongé, pas un téléport), enveloppé comme le gant, plancher
      // au sol (le bassin ne creuse pas la pelouse). Unreal warpe la racine ; nous aussi.
      const Rr = (lens.A + lens.B) * 0.995;
      const need = Math.min(0.45, Math.max(0, dSB - (Rr + HAND_WARP.standoff)));
      if (need > 1e-3 && pl.hipsNudge && dSB > 1e-6) {
        const s = (need * env) / dSB;
        const n = [(b[0] - this._wh.x) * s, (b[1] - this._wh.y) * s, (b[2] - this._wh.z) * s];
        const floor = Math.max(0, this._wh.y - 0.3);
        if (n[1] < -floor) n[1] = -floor;
        pl._dwNudge = n; pl.hipsNudge(n);
      } else pl._dwNudge = null;
    } else {
      pl._dwT = pl._dwT ?? a.t;
      const k = Math.max(0, 1 - (a.t - pl._dwT) / HAND_WARP.out);
      env = (pl._dwEnv ?? 0) * k;
      // le nudge gèle et redescend avec la même loi que le plan du gant
      if (pl._dwNudge && pl.hipsNudge && k > 1e-3) pl.hipsNudge([pl._dwNudge[0] * k, pl._dwNudge[1] * k, pl._dwNudge[2] * k]);
    }
    if (env <= 1e-3) { if (a.payload.resolved) pl._dwarp = null; return; }
    arm.hand.getWorldPosition(this._wf);   // APRÈS le nudge : le plan du gant part du squelette déplacé
    let plan = pl._dwarp;
    if (!a.payload.resolved) {
      plan = planWarp3([this._wf.x, this._wf.y, this._wf.z], [b[0], b[1], b[2]], HAND_WARP);
      pl._dwarp = plan;
      if (plan.denied) this._warpStats.denied[plan.denied + '-gant'] = (this._warpStats.denied[plan.denied + '-gant'] ?? 0) + 1;
    }
    if (!plan) return;
    this._wt.set(this._wf.x + plan.offset[0] * env, this._wf.y + plan.offset[1] * env, this._wf.z + plan.offset[2] * env);
    arm.up.getWorldPosition(this._wh); arm.elbow.getWorldPosition(this._wk);
    const d = this._wh.distanceTo(this._wt);
    const R = (lens.A + lens.B) * 0.995;
    if (d > R) {
      // écrêter, pas refuser — la fraction atteignable vaut mieux que rien (même leçon que la jambe)
      this._wt.set(
        this._wh.x + (this._wt.x - this._wh.x) * (R / d),
        this._wh.y + (this._wt.y - this._wh.y) * (R / d),
        this._wh.z + (this._wt.z - this._wh.z) * (R / d),
      );
      this._warpStats.denied['warp-écrêté-portée-gant'] = (this._warpStats.denied['warp-écrêté-portée-gant'] ?? 0) + 1;
    }
    const sol = twoBoneIK(
      [this._wh.x, this._wh.y, this._wh.z], [this._wt.x, this._wt.y, this._wt.z], lens.A, lens.B,
      [this._wk.x - this._wh.x, this._wk.y - this._wh.y, this._wk.z - this._wh.z],
    );
    aimChildAt(arm.up, arm.elbow, this._wm.fromArray(sol.mid));
    aimChildAt(arm.elbow, arm.hand, this._wm.fromArray(sol.end));
  }

  /** LE WARP DE TOUCHE — quatrième consommateur du warp de contact (pied de frappe, gant,
   *  racine, et maintenant LE PIED DE CONDUITE). La sim touche à ~1,15 m (jambe tendue) mais le
   *  clip de course ne le sait pas : le contact restait invisible — « il ne touche jamais le
   *  ballon » (retour utilisateur, captures). Autour de chaque événement 'touche' (0,2 s),
   *  le pied le plus proche est corrigé vers la surface du ballon : même primitive (planWarp,
   *  IK deux os), enveloppe sin C¹ (zéro aux deux bouts), borné, hors gestes (un act possède
   *  déjà sa jambe). */
  _applyTouchWarp(pl) {
    if (typeof window !== 'undefined' && window.__sabotage === 'warp-touche') return;
    const T = pl._touchT;
    if (T == null || pl.sim.act) return;
    const u = (this._t - T) / 0.2;
    if (u <= 0 || u >= 1) return;
    const b = this.state.ball.p;
    if (b[1] > 0.6) return;
    // le pied le plus proche du ballon fait la touche
    let side = null, dBest = 1.8;
    for (const f of ['left', 'right']) {
      const leg = pl.legs?.[f];
      if (!leg?.foot || !leg.up || !leg.knee || !pl.legLens?.[f]) continue;
      leg.foot.getWorldPosition(this._wf);
      const d = Math.hypot(this._wf.x - b[0], this._wf.y - b[1], this._wf.z - b[2]);
      if (d < dBest) { dBest = d; side = f; }
    }
    if (!side) return;
    const leg = pl.legs[side], lens = pl.legLens[side];
    leg.foot.getWorldPosition(this._wf);
    const plan = planWarp([this._wf.x, this._wf.z], [b[0], b[2]], { standoff: 0.13, warpMax: 0.42 });
    const env = Math.sin(Math.PI * u);
    this._wt.set(this._wf.x + plan.offset[0] * env, this._wf.y, this._wf.z + plan.offset[1] * env);
    leg.up.getWorldPosition(this._wh); leg.knee.getWorldPosition(this._wk);
    const dT = this._wh.distanceTo(this._wt);
    const R = (lens.A + lens.B) * 0.995;
    if (dT > R) {
      this._wt.set(this._wh.x + (this._wt.x - this._wh.x) * (R / dT), this._wh.y + (this._wt.y - this._wh.y) * (R / dT), this._wh.z + (this._wt.z - this._wh.z) * (R / dT));
    }
    const sol = twoBoneIK(
      [this._wh.x, this._wh.y, this._wh.z], [this._wt.x, this._wt.y, this._wt.z], lens.A, lens.B,
      [this._wk.x - this._wh.x, this._wk.y - this._wh.y, this._wk.z - this._wh.z],
    );
    aimChildAt(leg.up, leg.knee, this._wm.fromArray(sol.mid));
    aimChildAt(leg.knee, leg.foot, this._wm.fromArray(sol.end));
  }

  _applyStrikeWarp(pl) {
    const a = pl.sim.act;
    if (!a || a.payload?.kind !== 'pass' || !a.payload.pick) { pl._warp = null; pl._warpCal = null; return; }
    const foot = a.payload.pick.foot === 'left' ? 'left' : 'right';
    const clKey = `${pl.rig}:${a.id}:${foot}`;
    const leg = pl.legs?.[foot], lens = pl.legLens?.[foot];
    if (!leg?.up || !leg.knee || !leg.foot || !lens) return;

    // ---- CALIBRATION EN LIGNE. Le pied lu ICI est la pose PURE du clip de cette image (le mixer
    // ré-écrit chaque os à chaque update : le warp de l'image précédente est déjà effacé). On garde
    // la dernière image d'avant-contact ; au passage du tir, on interpole les deux images qui
    // encadrent l'instant exact et on verse en moyenne mobile — la vérité composée, mesurée sur le
    // jeu réel, par (clip × pied × rig). Un probe hors pile a été essayé : il mesurait une ombre.
    leg.foot.getWorldPosition(this._wf);
    if (!a.fired) {
      this._wv.copy(this._wf); pl.model.worldToLocal(this._wv);
      pl._warpCal = { t: a.t, local: [this._wv.x, this._wv.y, this._wv.z] };
    } else if (pl._warpCal && pl._warpCal.t < a.anticipation) {
      const c0 = pl._warpCal; pl._warpCal = null;
      this._wv.copy(this._wf); pl.model.worldToLocal(this._wv);
      const u = Math.max(0, Math.min(1, (a.anticipation - c0.t) / Math.max(1e-4, a.t - c0.t)));
      const at = [c0.local[0] + (this._wv.x - c0.local[0]) * u,
                  c0.local[1] + (this._wv.y - c0.local[1]) * u,
                  c0.local[2] + (this._wv.z - c0.local[2]) * u];
      const prev = this._contactLive.get(clKey);
      this._contactLive.set(clKey, prev ? prev.map((v, i) => v + (at[i] - v) * 0.4) : at);
    }
    const cl = this._contactLive.get(clKey);
    if (!cl) { this._warpStats.denied['warp-non-calibré'] = (this._warpStats.denied['warp-non-calibré'] ?? 0) + 1; return; }

    const env = warpEnvelope(a.t, a.anticipation);
    if (env <= 0) { pl._warp = null; return; }
    // le poids réel des jambes du geste module l'enveloppe : le warp corrige la jambe du geste
    // dans la proportion où le geste la possède (pleine dès ~0,85 — au contact le poids y est)
    const s = env * Math.min(1, (pl._wLegs ?? 1) / 0.85);
    if (s <= 1e-3) return;
    let plan = pl._warp;
    if (!a.fired) {
      // avant le contact : re-viser chaque image — les DEUX cibles convergent (le corps s'assied
      // sur l'ancre, le ballon porté converge vers le point de stance), l'offset converge avec
      this._wv.fromArray(cl); pl.model.localToWorld(this._wv);
      const b = this.state.ball.p;
      plan = planWarp([this._wv.x, this._wv.z], [b[0], b[2]]);
      pl._warp = plan;
      if (plan.denied) this._warpStats.denied[plan.denied] = (this._warpStats.denied[plan.denied] ?? 0) + 1;
    }
    if (!plan || (plan.denied && plan.mag <= 0)) return;
    this._wt.set(this._wf.x + plan.offset[0] * s, this._wf.y, this._wf.z + plan.offset[1] * s);
    leg.up.getWorldPosition(this._wh); leg.knee.getWorldPosition(this._wk);
    if (!warpReach([this._wh.x, this._wh.y, this._wh.z], [this._wt.x, this._wt.y, this._wt.z], lens.A, lens.B)) {
      // ÉCRÊTER, PAS REFUSER : le refus binaire annulait TOUTE la correction pile aux images où le
      // pied est le plus tendu — c'est-à-dire exactement AU CONTACT (mesuré au sweep : 62 % des
      // passes avec au moins un refus de portée dans ±0,05 s du contact). La fraction atteignable
      // vaut mieux que rien ; le reliquat reste une dette NOMMÉE au registre.
      const d = this._wh.distanceTo(this._wt);
      const R = (lens.A + lens.B) * 0.995;
      this._wt.set(
        this._wh.x + (this._wt.x - this._wh.x) * (R / d),
        this._wh.y + (this._wt.y - this._wh.y) * (R / d),
        this._wh.z + (this._wt.z - this._wh.z) * (R / d),
      );
      this._warpStats.denied['warp-écrêté-portée'] = (this._warpStats.denied['warp-écrêté-portée'] ?? 0) + 1;
    }
    if (!a.fired && this._warpStats.mags.length < 4000) { this._warpStats.n++; this._warpStats.mags.push(plan.mag); }
    // même primitive que foot-lock : IK deux os, plan de pliage du genou = celui du clip
    const sol = twoBoneIK(
      [this._wh.x, this._wh.y, this._wh.z], [this._wt.x, this._wt.y, this._wt.z], lens.A, lens.B,
      [this._wk.x - this._wh.x, this._wk.y - this._wh.y, this._wk.z - this._wh.z],
    );
    aimChildAt(leg.up, leg.knee, this._wm.fromArray(sol.mid));
    aimChildAt(leg.knee, leg.foot, this._wm.fromArray(sol.end));
  }

  /** The broadcast camera: it TRACKS the ball with lag and a touch of overshoot, the way a real
   *  operator pans. Copying that lag buys more perceived realism than any shader. */
  _broadcast(dt) {
    if (this.free || !this.cam) return;
    const b = this.state.ball.p;
    if (!this._look) this._look = new THREE.Vector3(0, 1, 0);
    if (!this._camV) this._camV = 0;
    // le travelling suit l'ÉCHELLE du terrain (le ±8 était celui du carré) ; en match, la régie
    // ZOOME dans le dernier tiers — la tension d'une attaque se lit aussi à la focale
    const spanX = this.matchMode ? this.state.pitch.hx * 0.5 : 8;
    const targetX = THREE.MathUtils.clamp(b[0], -spanX, spanX);
    this._look.x += (b[0] - this._look.x) * Math.min(1, dt * 2.4);      // lag
    this._look.z += (b[2] - this._look.z) * Math.min(1, dt * 2.4);
    this._look.y += (1 - this._look.y) * Math.min(1, dt * 3);
    const px = this.cam.position.x + (targetX * 0.55 - this.cam.position.x) * Math.min(1, dt * 1.5);
    this.cam.position.set(px, this.cam.position.y, -this._camBack);
    if (this.matchMode) {
      if (this._fovBase == null) this._fovBase = this.cam.fov;
      const lastThird = Math.abs(b[0]) > this.state.pitch.hx - this.state.pitch.dims.box.depth - 3;
      const want = this._fovBase - (lastThird ? 9 : 0);
      const nf = this.cam.fov + (want - this.cam.fov) * Math.min(1, dt * 1.6);
      if (Math.abs(nf - this.cam.fov) > 0.01) { this.cam.fov = nf; this.cam.updateProjectionMatrix(); }
    }
    this.cam.lookAt(this._look);
  }

  update(dt) {
    if (!this.state) return;
    // LA RÉSOLUTION SUIT LE TÉLÉPHONE (lot 61 — « toujours saccadé » après le CPU réglé au
    // lot 60) : le tier se choisit à l'ouverture, le GPU réel ne se voit qu'en jouant. Fenêtre
    // de 2 s au chrono MURAL (dt est clampé à 1/30, il ment sous la charge) : < 45 fps → −0,25
    // de pixel ratio (plancher 1,0), > 55 fps → +0,25 (jamais au-delà du cap d'ouverture, posé
    // dans camera()). Le post relit getDrawingBufferSize à chaque frame : le changement se
    // propage seul, sans resize. Une fenêtre gelée (onglet caché, chargement, GC massif) se
    // REJETTE au lieu de se lire comme de la lenteur. ?dynres=0 coupe (sabotage nommé).
    if (this._dynRes && typeof performance !== 'undefined') {
      const nowW = performance.now();
      if (this._drT0 == null) { this._drT0 = nowW; this._drN = 0; }
      else if (++this._drN && nowW - this._drT0 >= 2000) {
        const win = nowW - this._drT0, fps = this._drN * 1000 / win;
        const cur = this.renderer?.getPixelRatio?.() ?? 0;
        if (win < 4000 && cur > 0) {
          if (fps < 45 && cur > 1.0) { this.renderer.setPixelRatio(Math.max(1.0, cur - 0.25)); this._drUp = 0; }
          else if (fps > 55 && this._dprCap && cur < this._dprCap) {
            // REMONTER exige DEUX fenêtres rapides consécutives (lot 62 — hystérésis) : chaque
            // changement réalloue les cibles du post, osciller 1,25↔1,5 toutes les 2 s SERAIT
            // une saccade. Descendre reste immédiat : on rend des pixels, jamais des à-coups.
            if ((this._drUp = (this._drUp ?? 0) + 1) >= 2) { this.renderer.setPixelRatio(Math.min(this._dprCap, cur + 0.25)); this._drUp = 0; }
          } else this._drUp = 0;
        }
        this._drT0 = nowW; this._drN = 0;
      }
    }
    const step = Math.min(dt, 1 / 30);
    const before = this.state.events.length;
    const toBefore = this.state.turnovers;
    if (this.matchMode) matchStep(this.state, step, this._mcfg);
    else rondoStep(this.state, step);
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
        // …et le CONTRÔLE arme le warp du pied comme la touche de conduite (lot 70 — mesuré :
        // pied réel à p90 1,13 m du ballon à l'instant du control ; le clip seul ne sait pas
        // où le ballon est vraiment)
        if (pl) { this._playTech(pl, e); pl._teched = this._t; if (e.type === 'control') { pl._rxAt = this._t; pl._touchT = this._t; } }
      } else if (e.type === 'receive') {
        // une RÉCEPTION n'est pas une passe : le repli par défaut de _playTech jouait le clip
        // « passe » sur le receveur — mesuré au sweep, un armé fantôme à chaque réception, aussitôt
        // écrasé par le contrôle (churn receive→passe→control dans la même seconde). Une réception
        // sans technique nommée dessine un amorti ; et si un 'control' est arrivé dans la même
        // rafale d'événements, il a déjà le membre — on ne le lui reprend pas.
        const pl = this.players[e.by];
        if (pl) pl._rxAt = this._t;
        if (pl && pl._teched !== this._t) this._playTech(pl, { ...e, move: e.move || (e.tech && TECHNIQUES_BY_ID[e.tech]?.clip) || 'amorti' });
      } else if (e.type === 'touche') {
        // LA TOUCHE DE CONDUITE SE VOIT (retour utilisateur, captures : « il ne touche jamais le
        // ballon ») : la sim inscrit chaque touche ; la scène tend le pied vers le ballon autour
        // de cet instant (_applyTouchWarp) — sans ça le contact réel restait invisible.
        const pl = this.players[e.by];
        if (pl) pl._touchT = this._t;
        // …ET LA TOUCHE FORTE A UN CORPS (lot 55, retour utilisateur : le demi-tour à 0,3-0,9 m
        // sans AUCUNE frappe) : l'événement porte sa cassure (dev°, dribble.js) — au-delà de 60°
        // la couche de geste joue une frappe courte (crochet court au demi-tour ≥ 110°, extérieur
        // du pied à la cassure), miroir au pied CÔTÉ BALLON (le même choix que l'IK de la touche).
        // Cadencé (0,35 s) : une relance n'est pas une mitraille. Sabotage nommé : 'touche-plate'.
        if (pl && (e.dev ?? 0) >= 60 && this._t - (pl._swingT ?? -9) >= 0.35
          && !(typeof window !== 'undefined' && window.__sabotage === 'touche-plate')) {
          const q = this.state.players[e.by], b = this.state.ball.p;
          const lat = q ? (b[0] - q.p[0]) * Math.sin(q.yaw) - (b[2] - q.p[2]) * Math.cos(q.yaw) : 0;
          this._playTech(pl, { ...e, move: e.dev >= 110 ? 'crochetCourt' : 'passeExterieur', foot: lat > 0 ? 'left' : 'right' });
          pl._swingT = this._t;
        }
      } else if (e.type === 'skill' && this._gesteHud && !e.kind.endsWith('-vendu')) {
        // le ticker : l'événement du CONTACT du geste (skillContactNow), pas l'intention —
        // les '*-vendu' sont le mordu du même geste, pas un second geste. Les ESPÈCES se
        // nomment (la variété doit se lire : crochet court ≠ chaloupé, passement ×2, sortie).
        const names = { rateau: 'râteau', semelle: 'semelle', feinte: 'feinte de passe', passement: 'passement de jambes', crochet: 'crochet', frappeFeinte: 'feinte de frappe' };
        let label = names[e.kind] ?? e.kind;
        if (e.kind === 'crochet' && e.espece === 'crochetChaloupe') label = 'crochet chaloupé';
        else if (e.kind === 'crochet' && e.espece === 'crochetCourt') label = 'crochet court';
        else if (e.kind === 'passement') label = `passement${e.enCourse ? ' lancé' : ''}${e.tours === 2 ? ' ×2' : ''}${e.sortie ? ` (${e.sortie})` : ''}`;
        const q = this.state.players[e.by];
        const mm = Math.floor(e.t / 60), ss = String(Math.floor(e.t % 60)).padStart(2, '0');
        this._gesteLog.unshift(`<b style="color:#e8ebf2">${label}</b> <span>— ${TEAMS[q?.team ?? 0].name} nº${e.by} · ${mm}:${ss}</span>`);
        if (this._gesteLog.length > 5) this._gesteLog.pop();
        this._gesteHud.innerHTML = this._gesteLog.join('<br>');
      } else if (e.type === 'press' && this._gesteHud) {
        // LA FENÊTRE DE PRESSING SE LIT : l'intelligence off-ball est invisible par nature (des
        // corps qui se resserrent) — l'événement nommé la rend jugeable par l'utilisateur,
        // exactement comme les gestes (« logge pour que je les distingue », NOTES 36).
        const mm = Math.floor(e.t / 60), ss = String(Math.floor(e.t % 60)).padStart(2, '0');
        this._gesteLog.unshift(`<b style="color:#8ecae6">pressing</b> <span>— ${TEAMS[e.team ?? 0].name} (${(e.kind ?? '').replace(/-/g, ' ')}) · ${mm}:${ss}</span>`);
        if (this._gesteLog.length > 5) this._gesteLog.pop();
        this._gesteHud.innerHTML = this._gesteLog.join('<br>');
      } else if (e.type === 'but') {
        this._sifflet('but !', '#90be6d');
      } else if (e.type === 'carton') {
        this._sifflet(`carton ${e.couleur}`, e.couleur === 'rouge' ? '#d62828' : '#f2c14e');
      } else if (e.type === 'mi-temps') {
        this._sifflet('mi-temps');
      } else if (e.type === 'fin-de-match') {
        this._sifflet('coup de sifflet final');
      } else if (e.type === 'hors-jeu' && this._gesteHud) {
        // LE SIFFLET SE LIT COMME UN GESTE : la Loi 11 est un événement de match, pas un secret
        // de simulation — sans cette ligne, un coup franc « sorti de nulle part » serait un bug
        // aux yeux de l'utilisateur (le ticker est né exactement de ce besoin, NOTES 36).
        const q = this.state.players[e.by];
        const mm = Math.floor(e.t / 60), ss = String(Math.floor(e.t % 60)).padStart(2, '0');
        this._sifflet(`hors-jeu — nº${e.by}`);
        this._gesteLog.unshift(`<b style="color:#f2c14e">hors-jeu</b> <span>— ${TEAMS[q?.team ?? 0].name} nº${e.by} · ${mm}:${ss}</span>`);
        if (this._gesteLog.length > 5) this._gesteLog.pop();
        this._gesteHud.innerHTML = this._gesteLog.join('<br>');
      } else if ((e.type === 'faute' || e.type === 'avantage') && this._gesteHud) {
        // LOI 12 AU TICKER : la faute nomme le fautif, l'avantage nomme la décision — sans
        // ces deux lignes, un coup franc (ou un jeu qui continue sur un tacle raté) serait
        // illisible, exactement le bug perçu qui a fait naître le ticker (NOTES 36).
        const q = this.state.players[e.type === 'faute' ? e.by : e.sur];
        const mm = Math.floor(e.t / 60), ss = String(Math.floor(e.t % 60)).padStart(2, '0');
        if (e.type === 'faute') this._sifflet(`faute — nº${e.by}`, '#e76f51');
        this._gesteLog.unshift(e.type === 'faute'
          ? `<b style="color:#e76f51">faute</b> <span>— nº${e.by} sur nº${e.sur} · ${mm}:${ss}</span>`
          : `<b style="color:#90be6d">avantage</b> <span>— ${TEAMS[q?.team ?? 0].name} joue · ${mm}:${ss}</span>`);
        if (this._gesteLog.length > 5) this._gesteLog.pop();
        this._gesteHud.innerHTML = this._gesteLog.join('<br>');
      } else if (e.type === 'carton' && this._gesteHud) {
        // LE CARTON SE MONTRE (Loi 12 discipline) : le geste de l'arbitre est un événement de
        // match — jaune à la récidive, rouge au second jaune, dans les couleurs de l'objet.
        const mm = Math.floor(e.t / 60), ss = String(Math.floor(e.t % 60)).padStart(2, '0');
        this._gesteLog.unshift(e.couleur === 'rouge'
          ? `<b style="color:#d62828">carton rouge</b> <span>— nº${e.by} · ${mm}:${ss}</span>`
          : `<b style="color:#ffd60a">carton jaune</b> <span>— nº${e.by} (${e.cumul}ᵉ) · ${mm}:${ss}</span>`);
        if (this._gesteLog.length > 5) this._gesteLog.pop();
        this._gesteHud.innerHTML = this._gesteLog.join('<br>');
      }
    }

    // le haut du corps appartient au geste pendant qu'un geste tourne (voir _applyGaitLayer)
    for (const pl of this.players) {
      pl.ctrl.gestureHold = !!pl.sim.act || pl.gestureLayer.active;
      // la fenêtre de PLANT : dernier quart de l'armé — la locomotion retourne à l'idle (double
      // appui) pendant que les jambes du geste finissent d'arriver (voir character-controller)
      const a = pl.sim.act;
      pl.ctrl.plantHold = !!(a && a.anticipation && !a.fired && a.t > a.anticipation * 0.75);
    }

    // ---- dress the simulation: the sim owns positions, the controller owns the locomotion state
    const top = RONDO.speeds.chase;
    for (const pl of this.players) {
      const s = pl.sim;
      // LE LOD D'ANIMATION (lot 60 — profil téléphone : le SQUELETTE mange la frame, 40 % en
      // updateWorldMatrix/slerp/matrices pour 22 rigs à 60 Hz). La racine (position, lacet)
      // reste à 60 Hz — le corps GLISSE fluide ; les MEMBRES (mixer, couche de geste, regard,
      // verrou de pieds, warps) battent à 1/2 ou 1/3 de cadence quand le corps est LOIN de la
      // caméra (invisible à 3 pixels), avec dt ACCUMULÉ (la bonne vitesse, moins souvent).
      // JAMAIS ralenti : le porteur, le receveur, un corps en geste/au sol, les gardiens, les
      // proches. ?animlod=0 le coupe (sabotage nommé).
      const stx = this.state;
      const exemptLod = !this._animLod || pl.gestureLayer.active || s.act || (s.down ?? 0) > 0
        || s.id === stx.possession.carrier || s.id === (stx.pass?.to ?? -99) || s.keeper;
      const dCamL = exemptLod ? 0 : Math.hypot(this.cam.position.x - s.p[0], this.cam.position.z - s.p[2]);
      const nearL = this._tier === 'low' ? 22 : 30, midL = this._tier === 'low' ? 40 : 55;
      const strideL = exemptLod || dCamL < nearL ? 1 : dCamL < midL ? 2 : 3;
      pl._lodPhase = (pl._lodPhase ?? s.id) + 1;
      pl._lodAcc = (pl._lodAcc ?? 0) + step;
      if (strideL > 1 && (pl._lodPhase % strideL) !== 0) {
        pl.ctrl.pos.set(s.p[0], pl.groundY, s.p[2]);
        pl.model.position.copy(pl.ctrl.pos);
        pl.ctrl.yaw = pl.ctrl.yawFor(Math.cos(s.yaw), Math.sin(s.yaw));
        pl.model.rotation.y = pl.ctrl.yaw;
        continue;
      }
      const dtP = pl._lodAcc; pl._lodAcc = 0;
      pl.ctrl.setMoveWorld(s.v[0] / top, s.v[1] / top);       // magnitude picks idle / walk / run
      pl.ctrl.update(dtP);
      pl.ctrl.pos.set(s.p[0], pl.groundY, s.p[2]);            // then snap to the proven truth
      pl.model.position.copy(pl.ctrl.pos);
      // LE LACET AUSSI EST À LA SIM — même régime que la position. Le contrôleur dérive son facing
      // de l'intention de vitesse : pendant un armé en pivot la vitesse est nulle et le modèle
      // restait planté jusqu'à 110° du lacet sim AU CONTACT (mesuré épisode par épisode — le pied
      // du clip vivait dans un repère qui n'était pas celui où la sim pose le ballon ; la surface
      // « réalisée » variait de 22° à 133° d'un épisode à l'autre du MÊME clip). La sim tourne le
      // corps avec ses lois d'inertie prouvées (verify-rondo) : le visuel les COPIE, il ne les
      // ré-invente pas — un corps, une autorité, et le lissage est celui de la sim.
      pl.ctrl.yaw = pl.ctrl.yawFor(Math.cos(s.yaw), Math.sin(s.yaw));
      pl.model.rotation.y = pl.ctrl.yaw;

      // ---- LA COUCHE DE GESTE, après le mixer. Les poids restent les lois de composition :
      // LE POIDS DES JAMBES = L'ARRIVÉE (corps posé : 1 − v/2,5 sur la vitesse sol MESURÉE — la
      // chimère et le patin ont chacun leur loi) OU LE CONTACT QUI APPROCHE ((t/(antic·0,8))^1.5 —
      // le dernier cinquième de l'armé appartient au plant, entièrement) ; le HAUT s'arme tout de
      // suite (les bras portent l'anticipation pendant les derniers pas). L'horloge : act.t quand
      // la sim porte le geste ; l'horloge locale pour les gestes réactifs (contrôles rapportés).
      // Après la fin du geste, la couche REND les membres en fondu court — pas d'évaporation.
      if (pl.gestureLayer.active) {
        const act = pl.sim.act;
        const v = pl.ctrl.groundSpeed ?? 0;
        const meta = pl._layerClock ?? { t0: this._t, offset: 0, dur: 0.6, antic: 0.2 };
        let t = act ? act.t : (this._t - meta.t0 + meta.offset);
        // LE TACLEUR RESTE AU SOL tant que la sim le dit (p.down = récupération) : l'horloge du
        // clip se GÈLE sur la pose couchée (clé « au sol ») au lieu de dérouler le relevé — le
        // sweep a mesuré des tacleurs qui « glissaient » puis se relevaient pendant que la sim
        // les comptait encore à terre. Le relevé se joue quand la sim relève.
        // …et l'EXPULSÉ n'est PAS couché : son down géant est un drapeau d'inexistence pour les
        // cerveaux (Loi 12) — le corps, lui, MARCHE vers sa sortie et se rend normalement
        const lying = (pl.sim.down ?? 0) > 0 && !pl.sim.expulse && !pl.sim._sub && /tacle/i.test(pl.gestureLayer.spec?.name ?? '');
        // le gel est un VRAI gel : l'horloge locale s'arrête avec le corps (t0 avance d'autant).
        // La première version laissait t courir pendant down — au relevé, t sautait PAR-DESSUS le
        // segment de relevé authoré (clé 0,95) et le fondu partait de la pose couchée : l'arc
        // d'interpolation couché→debout creusait sous la pelouse (orteil mesuré à −0,41 m).
        if (lying) { meta.t0 += dtP; t = Math.min(t, pl.gestureLayer.duration * 0.55); }
        const antic = act?.anticipation || meta.antic || 0.2;
        const byArrive = Math.max(0, Math.min(1, 1 - v / 2.5));
        // …et le contact ne possède les jambes QUE jusqu'à ~0,15 s après lui : au-delà, c'est le
        // corps qui décide (byArrive). Sans cette borne, un tacleur relevé COURAIT à 3 m/s avec
        // les jambes de la pose couchée à poids plein (byContact restait à 1 tout l'accompagnement
        // du tacle, 0,9 s — orteil à −0,48 m, mesuré) ; pareil pour toute frappe dont la sim
        // repart tôt.
        const byContact = t < antic + 0.15 ? Math.min(1, Math.pow(t / Math.max(1e-4, antic * 0.8), 1.5)) : 0;
        // …et un tacleur que la SIM a relevé et remis en course lâche sa pose tout de suite : le
        // reste du clip couché n'a plus de corps à habiller (résidu mesuré : jambe fantôme à
        // −0,28 m pendant le fondu tardif)
        const done = !lying && !act && (t >= meta.dur || (/tacle/i.test(pl.gestureLayer.spec?.name ?? '') && (pl.sim.down ?? 0) <= 0 && v > 1));
        // LE PLONGEON POSSÈDE SES JAMBES D'EMBLÉE : byArrive/byContact sont des lois de FUSION
        // pour les gestes en flux (le corps décélère dans son geste) — mais la détente lance le
        // corps à ~6 m/s, donc byArrive lit « il court » et éteint les jambes du clip (mesuré :
        // wLegs 0,24 à t=0,18, hanches DEBOUT à l'arrêt, gant à ~1 m d'un ballon au sol). La
        // vitesse d'un corps en plongeon EST celle du geste, pas de la locomotion.
        const target = done ? 0 : (act?.payload?.skill === 'plongeon' || act?.payload?.enCourse ? 1 : Math.max(byArrive, byContact));
        pl._wLegs = (pl._wLegs ?? 0) + (target - (pl._wLegs ?? 0)) * Math.min(1, dtP / 0.05);
        // le HAUT s'arme VITE mais pas d'un coup : l'entrée sans rampe a été mesurée au sweep —
        // +54° d'élévation de bras en 50 ms (~1 086°/s), 122 fois en 2 min, un pop visible à
        // chaque geste. 0,12 s d'entrée = ≤ 25° par 50 ms, sous le seuil perceptible.
        // …ET LA RAMPE SUIT L'ALLURE : à 4+ m/s, quitter le balancé de course en 0,12 s reste un
        // « changement de mouvement » (retour utilisateur — le geste doit être la CONTINUITÉ de la
        // locomotion) : 0,12 → 0,18 s selon la vitesse sol, symétrique entrée/sortie.
        const tauW = 0.12 + 0.06 * Math.min(1, v / 4);
        pl._wUp = done ? Math.max(0, (pl._wUp ?? 1) - dtP / tauW) : Math.min(1, (pl._wUp ?? 0) + dtP / tauW);
        // L'ENTRÉE MÈNE L'HORLOGE DU CLIP : la clé t=0 d'un clip est la pose NEUTRE — pendant la
        // rampe d'entrée, le haut se faisait tirer vers le « garde-à-vous » AVANT de s'armer (le
        // hoquet mesuré entre locomotion et geste). On échantillonne EN AVANCE au début de l'armé
        // (lead 0,3 × anticipation), convergence linéaire vers l'heure vraie AU CONTACT — le pied
        // frappe exactement sur sa clé, l'entrée ne traverse plus le neutre.
        // …ET LE TEMPS-WARP DU PLONGEON (l'autre moitié du Motion Warping) : le clip a son heure
        // de contact AUTHORÉE (0,55 s) mais le ballon a la SIENNE (cross.t, prédite au
        // déclenchement) — on rejoue le clip à l'échelle pour que la pose de détente tombe quand
        // le ballon arrive (borné ×0,8-2,2 : un plongeon s'ajuste, il ne téléporte pas sa
        // biomécanique). Mesuré sans lui : à l'instant du contact réel le corps n'était pas
        // couché (épaule haute) — gant à ~1,0 m d'un ballon au sol, hors de toute anatomie.
        let tG = t;
        // LE CORPS DU PLONGEON, réconcilié — l'état vit tant que le LAYER joue un clip plongeon
        // (l'act sim finit avant le fondu : nettoyer sur l'act laissait la fin du clip sans
        // biais, écart 1,19 m mesuré à la sortie du geste).
        const diveClip = /^plongeon/.test(pl.gestureLayer.spec?.name ?? '');
        // un NOUVEL acte re-pose le départ (l'horloge repart de 0) — sans ça, deux plongeons
        // enchaînés gardaient le départ du premier et le biais devenait un mensonge (écarts
        // 2,5-2,7 m mesurés sur les enchaînements, pires que sans réconciliation)
        const newDive = act?.payload?.skill === 'plongeon' && act.t < (pl._divePrevT ?? Infinity);
        pl._divePrevT = act?.payload?.skill === 'plongeon' ? act.t : null;
        if (act?.payload?.skill === 'plongeon' && act.payload.cross?.t > 0 && (!pl._diveStart || newDive)) {
          // …le TIME-WARP JUSQU'AU CONTACT SEULEMENT : le rate calait la détente sur l'heure du
          // ballon mais rejouait AUSSI le couché-relevé en accéléré (debout en ~0,5 s à ×2,2 —
          // « ils se relèvent trop vite »). Après le contact du clip, l'horloge repasse à ×1.
          const rate = Math.max(0.8, Math.min(2.2, antic / Math.max(0.15, act.payload.cross.t)));
          pl._diveStart = { p: [pl.sim.p[0], pl.sim.p[2]], yaw: s.yaw, rate, tA: antic / rate, antic };
        }
        if (diveClip && pl._diveStart) {
          const D = pl._diveStart;
          tG = t < D.tA ? t * D.rate : D.antic + (t - D.tA);
          // LA RÉCONCILIATION : le voyage sim (axes personnage) au canal de biais de l'écrivain
          // des hanches — le rendu dessine clip − voyage : le dessin domine tôt, converge vers
          // la sim, le fondu de fin part d'un delta ≈ 0.
          const vx = pl.sim.p[0] - D.p[0], vz = pl.sim.p[2] - D.p[1];
          // …exprimé dans les axes RÉELS du modèle (colonnes de sa matrice monde) : la
          // conversion par le yaw sim ignorait l'offset de facing du rig et la rotation rendue
          // — deux populations mesurées : des plongeons parfaits (0,16 m) et des faux (2,7 m).
          const me = pl.model.matrixWorld.elements;
          const rl = Math.hypot(me[0], me[2]) || 1, fl = Math.hypot(me[8], me[10]) || 1;
          if (pl.hipsCtl) pl.hipsCtl.bias = [(vx * me[0] + vz * me[2]) / rl, 0, -(vx * me[8] + vz * me[10]) / fl];
        } else if (pl._diveStart) { pl._diveStart = null; if (pl.hipsCtl) pl.hipsCtl.bias = null; }
        const tSample = tG < antic ? tG + (0.3 * antic) * (1 - tG / antic) : tG;
        pl.gestureLayer.apply(tSample, pl._wLegs, pl._wUp);
        if (done && pl._wUp <= 0 && pl._wLegs <= 0.02) { pl.gestureLayer.end(); pl._wLegs = 0; }
      } else {
        pl._wLegs = 0; pl._wUp = 0;
        if (pl._diveStart) { pl._diveStart = null; if (pl.hipsCtl) pl.hipsCtl.bias = null; }
      }
      // LE REGARD — après la couche (il compose par-dessus les clés Head du geste, fondu quand le
      // clip possède la tête), avant le warp. La politique lit la photo sim que la scène a déjà.
      {
        const st = this.state;
        const owner = st.ball.owner != null ? st.players[st.ball.owner] : null;
        const a = s.act;
        const targetP = a?.payload?.choice != null && st.players[a.payload.choice.to?.id ?? a.payload.choice]
          ? (() => { const r = st.players[a.payload.choice.to?.id ?? a.payload.choice]; return [r.p[0], 1.5, r.p[2]]; })()
          : (a?.payload?.outYaw != null ? [s.p[0] + Math.cos(a.payload.outYaw) * 6, 1.4, s.p[2] + Math.sin(a.payload.outYaw) * 6] : null);
        const view = {
          id: s.id, t: this._t, ball: st.ball.p, ownerId: st.ball.owner,
          flightTo: st.pass?.to ?? null, justReceivedAt: pl._rxAt ?? null,
          act: a ? { t: a.t, antic: a.anticipation, targetP } : null,
          job: s.job, markP: null,   // le rondo ne marque pas à l'homme ; le scan va au porteur
          carrierP: owner && owner.id !== s.id ? [owner.p[0], 1.5, owner.p[2]] : null,
        };
        const target = pickGazeTarget(view, pl._gazeSt, pl._gazeRng);
        const gw = (pl.gestureLayer.active && pl.gestureLayer.tracks?.Head) ? 1 - 0.7 * (pl._wUp ?? 0) : 1;
        pl.gaze.neck?.getWorldPosition?.(this._wv);
        const hp = pl.gaze.head?.getWorldPosition ? pl.gaze.head.getWorldPosition(this._wv) : null;
        pl.gaze.update(dtP, hp ? [hp.x, hp.y, hp.z] : [s.p[0], pl.groundY + 1.6, s.p[2]], target, s.yaw, gw);
      }
      // LE VERROU DES PIEDS, en toute fin de pile — après le replaquage sim, la couche de geste et
      // le regard, pour verrouiller la position FINALE (le résoudre dans ctrl.update verrouillait
      // une position que le replaquage déplaçait juste après : 97 % des appuis glissaient, médiane
      // 0,77 m par appui — le patin qui fait LIRE le jeu trop vite). Actif à toute allure ; la
      // jambe frappeuse est MASQUÉE pendant un geste (elle appartient à la couche + au warp), le
      // pied d'appui garde son verrou.
      {
        const act2 = pl.sim.act;
        const striking = act2?.payload?.pick ? (act2.payload.pick.foot === 'left' ? 0 : 1) : -1;
        // un corps COUCHÉ (tacle, down > 0) n'a pas de pied d'appui : verrouiller un pied de la
        // pose couchée étirait la jambe SOUS terre en tenant son XZ pendant que le bassin
        // descendait (orteil mesuré à −0,38 m — le pire du dépôt, créé par le verrou lui-même)
        const lying2 = (pl.sim.down ?? 0) > 0 && !pl.sim.expulse && !pl.sim._sub;   // l'expulsé (Loi 12) et le remplacé (Loi 3) marchent
        if (!pl.ctrl.airborne && pl.ctrl.footLock) pl.ctrl.footLock.solve(dtP, [!lying2 && striking !== 0, !lying2 && striking !== 1], s.yaw, pl.ctrl.groundSpeed ?? 0);
      }
      // l'autorité de la jambe frappeuse — après le verrou, en dernier
      this._applyStrikeWarp(pl);
      this._applyDiveWarp(pl);
      this._applyTouchWarp(pl);
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
    // LE BUDGET D'OMBRES du plein format (2 Hz) : seuls les 8 corps les plus près du ballon
    // paient la passe d'ombre — un caster skinné se déforme DEUX fois par image, et l'œil ne
    // lit pas l'ombre d'un corps à 40 m dans un cadre de 105 m
    if (this.fullMode && this._t - (this._shadowAt ?? -1) > 0.5) {
      this._shadowAt = this._t;
      const b = this.state.ball.p;
      const order = [...this.players].sort((a, c) =>
        (Math.hypot(a.sim.p[0] - b[0], a.sim.p[2] - b[2])) - (Math.hypot(c.sim.p[0] - b[0], c.sim.p[2] - b[2])));
      order.forEach((pl, i) => {
        const cast = i < 8;
        if (pl._castShadow !== cast) {
          pl._castShadow = cast;
          pl.model.traverse((o) => { if (o.isMesh) o.castShadow = cast; });
        }
      });
    }
    if (this._hud && this._t - this._lastEvent > 0.15) {
      this._lastEvent = this._t;
      const teamName = TEAMS[this.state.possession.team].name;
      // LE CHRONO SE LIT (cfg.chrono, plein format) : période + temps écoulé dans la période,
      // puis TERMINÉ au sifflet final — le cycle de match est un produit, il s'affiche
      let chrono = '';
      const ch = this._mcfg?.chrono;
      if (ch && this.state._chrono) {
        const C = this.state._chrono;
        if (this.state.fini) chrono = ' · <b>TERMINÉ</b>';
        else {
          const tR = Math.max(0, this.state.t - (C.periode - 1) * (ch.duree + (ch.pause ?? 6)));
          const tP = Math.min(ch.duree, tR);
          const mm = Math.floor(tP / 60), ss = String(Math.floor(tP % 60)).padStart(2, '0');
          // le TEMPS ADDITIONNEL se lit (lot 24) : « 3:00 +2 » — la montre de l'arbitre, pas un gel
          chrono = ` · MT${C.periode} ${mm}:${ss}${tR > ch.duree ? ` +${Math.ceil(tR - ch.duree)}` : ''}`;
        }
      }
      this._hud.innerHTML = this.matchMode
        ? `<b>${TEAMS[0].name} ${this.state.score[0]} : ${this.state.score[1]} ${TEAMS[1].name}</b><br><span>${this.state.events.filter((e) => e.type === 'shot').length} tirs · ${this.state.events.filter((e) => e.type === 'arrêt').length} arrêts · possession : ${teamName}${chrono}</span>`
        : `<b>${this.state.passes}</b> passes <span>· record ${this.state.best} · ${this.state.turnovers} pertes</span><br><span>possession : ${teamName}</span>`;
    }
  }

  /** The running game, judged by the same contract the headless harness uses. */
  check() { return this.matchMode ? checkMatch(this.state, this._trace, this._mcfg) : checkRondo(this.state, this._trace); }

  dispose() {
    this.pipeline?.dispose?.();
    for (const d of this.disposables) d.dispose?.();
    for (const pl of this.players) this.scene.remove(pl.model);
  }
}
