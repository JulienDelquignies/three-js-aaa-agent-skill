import * as THREE from 'three/webgpu';
import { FootLockIK } from './foot-lock.js';
import { WORLD } from './world-basis.js';
import { AnimationStateMachine } from './anim-state-machine.js';
import { makeGaitClock, phaseOffset, gaitLayer } from './gait.js';
import { gaitPose, gaitCadenceFactor, gaitStyleFromSeed, NEUTRAL_GAIT_STYLE } from './motion-gait.js';
import { idlePose, idlePolicy, idleStyleFromSeed, NEUTRAL_IDLE_STYLE } from './motion-idle.js';
import { profileFromBones } from './motion-rig.js';
import { UP_BONES } from './gesture-layer.js';

// CharacterController — turn input into believable, correct movement. This is the point of the skill:
// good controls. It couples player intent (a world-space move vector, 0..1) to:
//   • facing        — the model turns to face where it moves (shortest-arc, rate-limited) so it never
//                      moonwalks. `forwardLocal` is the model's own "front" axis (Mixamo Soldier = −Z).
//   • locomotion    — run/idle blend by speed, and clip cadence tied to ground speed via timeScale
//                      (= the live form of matchCadence) so the legs turn over as fast as it moves.
//   • no foot-skate — FootLockIK pins the planted foot while running (see reference/21).
// The controller owns position + yaw; read `.model`, `.pos`, `.forward()` to attach a camera, ball, etc.
const FWD = new THREE.Vector3(0, 0, -1);

export class CharacterController {
  constructor(model, { mixer, runClip, idleClip, walkClip = null, legs = null, stride = 2.6, walkStride = 1.5, walkSpeed = 1.9, runSpeed = 5.5, sprintMult = 1.6, jumpSpeed = 5.5, gravity = 18, accel = 14, turnRate = 12, locomotion = 'clips', gaitStyle = null, gaitProfile = null, forwardLocal = FWD, persona = null } = {}) {
    this.model = model; this.mixer = mixer; this.runDur = runClip.duration;
    this.stride = stride; this.runSpeed = runSpeed; this.sprintMult = sprintMult; this.jumpSpeed = jumpSpeed; this.gravity = gravity;
    this.accel = accel; this.turnRate = turnRate;
    // Locomotion: if a Walk clip is given, blend Idle→Walk→Run by speed through a state machine (each clip
    // cadence-synced to ground speed via its stride). Otherwise fall back to a binary run/idle crossfade.
    this._useFsm = !!(walkClip && idleClip);
    if (this._useFsm) {
      this.anim = new AnimationStateMachine(mixer);
      this.anim.blend1d('locomotion', 'speed', [
        { clip: idleClip, at: 0 }, { clip: walkClip, at: walkSpeed, stride: walkStride }, { clip: runClip, at: runSpeed, stride: stride },
      ]).play('locomotion');
      // L'HORLOGE DE FOULÉE (gait.js) : un seul φ pour tous les clips porteurs de foulée, avancé à la
      // cadence de Dorn 2012 — les `stride` par clip ne servent plus qu'à marquer « porteur de foulée ».
      this.gait = makeGaitClock();
      this.anim.driveWithGait(this.gait);
    } else {
      this.actRun = mixer.clipAction(runClip); this.actRun.play(); this.actRun.weight = 0;
      this.actIdle = idleClip ? mixer.clipAction(idleClip) : null;
      if (this.actIdle) { this.actIdle.play(); this.actIdle.weight = 1; }
    }
    // optional physics resolver: collide(dx,dy,dz) → {dx,dy,dz,grounded}. If set, movement is resolved
    // against the physics world (Rapier) instead of moving freely + clamping to a flat groundY.
    this.collide = null;
    this.fwd = forwardLocal.clone().normalize();
    this.fa = WORLD.forwardAngle([this.fwd.x, this.fwd.y, this.fwd.z]); // ground angle of the model's forward axis
    this.pos = model.position.clone(); this.yaw = model.rotation.y; this.dist = 0; this.speed = 0;
    this.groundY = this.pos.y; this.vy = 0; this.airborne = false; this._sprint = false;
    this._move = new THREE.Vector2(); this._cur = new THREE.Vector2();  // desired / smoothed move
    this.legs = legs;
    if (legs) {                                            // rest rotations + hip height for the sit pose
      this._legRest = legs.map((l) => ({ up: l.up.rotation.x, knee: l.knee.rotation.x }));
      model.updateWorldMatrix(true, true);
      const v = new THREE.Vector3(); legs[0].up.getWorldPosition(v);
      this.hipH = v.y - model.position.y;                  // hip height above the feet when standing
    }
    this.seated = null;
    this.footLock = legs ? new FootLockIK(legs, {
      contactBand: 0.05,
      sampleClip: (p) => { this.mixer.setTime(p * this.runDur); this.model.updateWorldMatrix(true, true); },
    }) : null;
    // φ = 0 est « contact du pied gauche » : chaque clip pose ce contact où son auteur l'a mis, donc
    // l'offset de chaque ancre est MESURÉ sur le rig au chargement (minimum de hauteur du pied gauche).
    // Sans ça, deux clips en phase parfaite peuvent lire « gauche » l'un où l'autre lit « droite ».
    if (this.gait && legs) this._alignGaitOffsets();
    // L'IDENTITÉ DE MOUVEMENT (persona.js) : dix joueurs qui posent le pied gauche à la même
    // milliseconde sont un ballet militaire, pas une équipe — le cycle part DÉPHASÉ par joueur ;
    // le balancier et la posture prennent leur accent plus bas, dans la couche de gait.
    this.persona = persona;
    if (this.gait && persona?.gaitPhase != null) this.gait.phi = persona.gaitPhase % 1;
    // le corps accordé : bassin/colonne/bras/tête dérivés de (φ, v), appliqués APRÈS le mixer
    this._gaitBones = null;
    if (this.gait) {
      const suffix = (n) => n.replace(/^mixamorig\d*/i, '');
      const map = new Map();
      model.traverse((o) => { if (o.isBone) { const s2 = suffix(o.name); if (!map.has(s2)) map.set(s2, o); } });
      this._gaitBones = map;
      this._gaitQ = new THREE.Quaternion(); this._gaitE = new THREE.Euler();
    }
    // LA FOULÉE GÉNÉRÉE (motion-gait, lot A7) : la pose de locomotion est CALCULÉE — chemins de pied
    // → IK sur la hanche de l'instant, bassin, tronc, bras — fonction pure de (φ, v→) — et posée
    // ABSOLUE par os après le mixer (rest ⊗ q_spec : l'écrivain de la couche de geste), fondue avec
    // l'idle du mixer sous 0,6 m/s. Le rest et le profil viennent du clone AU BIND (jamais animé à la
    // construction) : exactement le repère contre lequel verify-foulee prouve le générateur.
    // `locomotion: 'generee'` l'active ; 'clips' garde les trois clips du donneur (l'ancien monde —
    // l'avant/après des captures, le sabotage nommé). Commutable à chaud (ctrl.locomotion).
    this.locomotion = locomotion;
    this._gaitGen = null;
    if (this.gait && this._gaitBones && locomotion === 'generee') this._setupGeneratedGait(gaitProfile, gaitStyle);
  }

  /** Le profil de rig (repère personnage, mètres monde) et le rest, pris sur le clone au bind. */
  _setupGeneratedGait(profile, style) {
    const rest = new Map();
    for (const [name, b] of this._gaitBones) rest.set(name, new THREE.Quaternion(b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w));
    const hips = this._gaitBones.get('Hips');
    if (!hips) return;
    let P = profile;
    // le repère personnage = le repère du MODÈLE (origine aux pieds, face −Z), à l'échelle monde :
    // la matrice du parent des hanches RELATIVE au modèle, fois l'échelle du modèle (squad + persona)
    const par = hips.parent;
    this.model.updateWorldMatrix(true, true);
    const rel = new THREE.Matrix4().copy(this.model.matrixWorld).invert().multiply(par.matrixWorld);
    const pos = new THREE.Vector3(), quat = new THREE.Quaternion(), scl = new THREE.Vector3();
    rel.decompose(pos, quat, scl);
    const kM = this.model.scale.y;
    if (!P) P = profileFromBones(this._gaitBones, { rootQ: [quat.x, quat.y, quat.z, quat.w], rootP: [pos.x * kM, pos.y * kM, pos.z * kM], scale: scl.y * kM });
    // l'axe « haut personnage » exprimé dans le local du parent des hanches (le rebond du bassin
    // s'écrit en mètres personnage, comme le canal hips des specs)
    const toParent = new THREE.Matrix3().setFromMatrix4(rel).invert();
    const axisY = new THREE.Vector3(0, 1 / kM, 0).applyMatrix3(toParent);
    const axisX = new THREE.Vector3(1 / kM, 0, 0).applyMatrix3(toParent);
    const seed = typeof style === 'number' ? style : null;
    if (typeof style === 'number') style = gaitStyleFromSeed(style);   // la graine de persona → sa signature
    this._gaitGen = { P, style: style || NEUTRAL_GAIT_STYLE, rest, hipsRest: hips.position.clone(), axisY, axisX, tq: new THREE.Quaternion(), tq2: new THREE.Quaternion(), tp: new THREE.Vector3(), w: 0, vBody: [0, 0] };
    // L'ATTENTE GÉNÉRÉE (motion-idle, lot A8) : sous 0,6 m/s le corps n'est plus l'idle du donneur mais
    // une espèce d'attente choisie par la politique (idleCtx posé par la scène ; idleForce : la planche),
    // au style du joueur, fondue en 0,5 s d'une espèce à l'autre et fondue avec la foulée au-dessus.
    this._idle = { style: seed != null ? idleStyleFromSeed(seed + 101) : NEUTRAL_IDLE_STYLE, kind: 'repos', prev: null, blend: 1, t: 0 };
    this.idleCtx = null; this.idleForce = null;
  }

  /** Changer le style de foulée d'un joueur (sa signature, graine de persona). */
  setGaitStyle(styleOrSeed) {
    if (!this._gaitGen) return;
    this._gaitGen.style = typeof styleOrSeed === 'number' ? gaitStyleFromSeed(styleOrSeed) : styleOrSeed;
  }

  /** La vitesse en repère CORPS [avant, droite] : intention lissée × allure, contre le lacet d'entrée
   *  (celui de la sim, pris avant que le facing ne tourne) — un gardien qui se déplace de côté face au
   *  ballon lit (0, ±v), un défenseur qui recule face au jeu lit (−v, 0). */
  _bodyVelocity(v) {
    const [fx, fz] = WORLD.facingDir(this._yawIn ?? this.yaw, this.fa);
    const mag = this._cur.length();
    let dx = fx, dz = fz;
    if (mag > 1e-3) { dx = this._cur.x / mag; dz = this._cur.y / mag; }
    return [v * (dx * fx + dz * fz), v * (dx * -fz + dz * fx)];
  }

  /** Mesure l'offset de phase de chaque ancre porteuse de foulée : le contact GAUCHE à φ = 0. */
  _alignGaitOffsets() {
    const loco = this.anim.states.get('locomotion');
    if (!loco) return;
    const foot = this.legs[0].foot;                            // legs[0] est la jambe gauche
    const v = new THREE.Vector3();
    const saved = loco.anchors.map((an) => ({ an, t: an.action.time, w: an.action.weight }));
    for (const an of loco.anchors) {
      if (!an.stride) continue;
      for (const { an: o } of saved) o.action.weight = o === an ? 1 : 0;
      an.gaitOffset = phaseOffset((u) => {
        an.action.time = u * an.dur;
        this.mixer.update(0);
        this.model.updateWorldMatrix(true, true);
        foot.getWorldPosition(v);
        return v.y;
      });
    }
    for (const { an, t, w } of saved) { an.action.time = t; an.action.weight = w; }
    this.mixer.update(0);
  }

  // Desired move in world XZ (e.g. from camera-relative WASD / left stick). Magnitude 0..1 = walk..run.
  setMoveWorld(x, z) { this._move.set(x, z); if (this._move.lengthSq() > 1) this._move.normalize(); }
  setSprint(on) { this._sprint = !!on; }
  jump() { if (!this.airborne && !this.seated) { this.vy = this.jumpSpeed; this.airborne = true; } }
  /** Sit on a seat: freezes locomotion, plants the hips at seatH, bends the legs procedurally. */
  sitAt({ pos, yaw, seatH }) {
    this.seated = { pos: [...pos], yaw, seatH };
    this.yaw = yaw; this._move.set(0, 0); this._cur.set(0, 0); this.speed = 0;
  }
  standUp() {
    if (!this.seated) return;
    const { pos, yaw } = this.seated; this.seated = null;
    for (let i = 0; i < (this.legs || []).length; i++) { this.legs[i].up.rotation.x = this._legRest[i].up; this.legs[i].knee.rotation.x = this._legRest[i].knee; }
    this.pos.set(pos[0] + Math.sin(yaw) * 0.6, this.groundY, pos[2] + Math.cos(yaw) * 0.6);   // step off the seat
  }

  // Yaw that turns the model's forward axis onto world dir (dx,dz) — via the WorldBasis, so facing is
  // always consistent (no moonwalk). For forward=−Z this resolves to atan2(dx,dz)−π.
  yawFor(dx, dz) { return WORLD.yawToFace(dx, dz, this.fa); }
  faceInstant(dx, dz) { this.yaw = this.yawFor(dx, dz); this.model.rotation.y = this.yaw; }
  // The world direction the model currently faces (unit XZ) — where a shot/pass would go.
  forward(out = new THREE.Vector3()) { const [dx, dz] = WORLD.facingDir(this.yaw, this.fa); return out.set(dx, 0, dz); }

  update(dt) {
    if (this.seated) {                                     // seated: no locomotion; idle anim + sit pose
      const s = this.seated;
      this.pos.set(s.pos[0], this.groundY + (s.seatH + 0.08 - this.hipH), s.pos[2]);   // hanches posées sur l'assise
      this.model.position.copy(this.pos); this.model.rotation.y = this.yaw = s.yaw;
      if (this._useFsm) this.anim.set('speed', 0).update(dt);
      else { if (this.actIdle) { this.actIdle.weight = 1; this.actRun.weight = 0; } this.mixer.update(dt); }
      for (let i = 0; i < (this.legs || []).length; i++) {  // procedural sit: thighs level, shins down
        this.legs[i].up.rotation.x = this._legRest[i].up - 1.35;
        this.legs[i].knee.rotation.x = this._legRest[i].knee + 1.4;
      }
      this.model.updateWorldMatrix(true, true);
      return;
    }
    // LA VITESSE VRAIE : mesurée sur le déplacement du modèle entre deux frames, PAS sur l'intention.
    // Dans le rondo, la simulation écrase la position APRÈS ctrl.update : `this.dist` n'accumulait donc
    // pas le mouvement réellement affiché, et la cadence suivait une fiction. Le delta de position du
    // modèle, lu en début d'update, capture tout — y compris ce que la scène a imposé.
    const wp = this.model.position;
    if (this._lastW) {
      const d = hyp(wp.x - this._lastW.x, wp.z - this._lastW.z);
      const cap = this.runSpeed * this.sprintMult * 1.5;      // au-delà : téléport de scène, pas une course
      const inst = Math.min(d / Math.max(1e-4, dt), cap);
      this.groundSpeed = (this.groundSpeed ?? inst) * 0.7 + inst * 0.3;
    } else this.groundSpeed = 0;
    this._lastW = { x: wp.x, z: wp.z };

    this._yawIn = this.yaw;                                 // le lacet reçu (sim) avant le facing de ce pas
    // smooth the input so starts/stops ease instead of snapping
    const k = 1 - Math.exp(-this.accel * dt);
    this._cur.lerp(this._move, k);
    const mag = this._cur.length(); this.speed = mag * this.runSpeed * (this._sprint ? this.sprintMult : 1);
    let ddx = 0, ddz = 0;                                    // desired horizontal delta this frame
    if (mag > 0.02) {
      const dx = this._cur.x / mag, dz = this._cur.y / mag;
      this.yaw = WORLD.turnToward(this.yaw, this.yawFor(dx, dz), this.turnRate * dt);
      const adv = this.speed * dt; ddx = dx * adv; ddz = dz * adv;
    }
    if (this.collide) {
      // physics-resolved: gravity always applies; the resolver reports contact with the ground
      this.vy -= this.gravity * dt;
      const r = this.collide(ddx, this.vy * dt, ddz);
      this.pos.x += r.dx; this.pos.y += r.dy; this.pos.z += r.dz;
      if (r.grounded) { if (this.vy < 0) this.vy = 0; this.airborne = false; } else this.airborne = true;
      this.dist += hyp(r.dx, r.dz);                  // cadence tracks ACTUAL movement (blocked → legs slow)
    } else {
      this.pos.x += ddx; this.pos.z += ddz; this.dist += hyp(ddx, ddz);
      if (this.airborne || this.vy !== 0) { this.vy -= this.gravity * dt; this.pos.y += this.vy * dt; if (this.pos.y <= this.groundY) { this.pos.y = this.groundY; this.vy = 0; this.airborne = false; } }
    }
    this.model.position.copy(this.pos); this.model.rotation.y = this.yaw;

    const runRef = this.runSpeed * (this._sprint ? this.sprintMult : 1);
    const run01 = Math.min(1, this.speed / runRef);
    if (this._useFsm) {
      const vGait = Math.max(this.speed, this.groundSpeed ?? 0);
      // …et la cadence suit la DIRECTION quand la foulée est générée (×1,3 à reculons, ×1,9 de côté —
      // motion-gait.gaitCadenceFactor : une phase, une durée, le chemin de pied et l'horloge sont UN)
      const gen = this._gaitGen && this.locomotion === 'generee';
      const vb = gen ? this._bodyVelocity(vGait) : null;
      if (this.gait) this.gait.advance(vGait, dt * (gen ? gaitCadenceFactor(vb[0], vb[1]) : 1));   // l'horloge unique tourne AVANT le mixer
      // PENDANT UN GESTE, LES JAMBES SUIVENT LE CORPS RÉEL — jamais un zéro forcé. L'idle forcé
      // (vTarget = 0) a été mesuré à l'audit membre par membre : le glissement d'approche translate
      // le corps jusqu'à 5,2 m/s pendant l'armé, et des jambes d'idle sous un corps qui se déplace,
      // c'est du PATIN À GLACE — pied d'appui « au sol » en translation 100 % des images de l'armé,
      // pics à 7,5 m/s. La cible est donc la vitesse SOL MESURÉE (groundSpeed, le déplacement réel
      // du modèle) : les pas portent l'approche, et quand le glissement s'assied (ease-out → 0) les
      // jambes s'arrêtent d'elles-mêmes — le plant émerge de la mesure, il n'est pas décrété.
      // L'anti-chimère (delta de frappe sur jambes de course = aucun membre cohérent) n'est PAS
      // cette ligne : il vit dans le POIDS des canaux jambes du geste, fondu par l'arrivée
      // (Rondo : clip scindé haut/jambes — les bras s'arment pendant les pas, les jambes du geste
      // ne prennent que quand le corps est posé).
      // …et la FENÊTRE DE PLANT (fin d'armé, `plantHold` levé par la scène) force le retour à
      // l'idle : sans elle, la marche GÈLE à une phase arbitraire quand le glissement s'assied —
      // l'audit a surpris le pied d'appui à 0,20 m de haut et l'axe du pied à 144° du départ AU
      // CONTACT (un pied de pleine foulée sous un geste de frappe). L'arrêt d'un pas se FINIT en
      // double appui ; le dernier quart de l'armé appartient au plant.
      const vTarget = this.plantHold ? 0 : this.gestureHold ? Math.min(this.groundSpeed ?? 0, vGait) : vGait;
      // le PLANT a sa propre constante de temps : pour un armé court (0,22 s) la fenêtre de plant
      // (dernier quart) dure 0,055 s — plus COURT que le lissage de croisière (0,08 s), donc la
      // marche restait ~30 % dans la pose au contact, à une phase arbitraire : l'axe du pied
      // frappeur variait de 104° à 165° d'un épisode à l'autre du MÊME clip. Un plant, ça se
      // plante — vite.
      this._leanDt = dt;
      const tauV = this.plantHold ? 0.025 : 0.08;
      this._vAnim = (this._vAnim ?? vGait) + (vTarget - (this._vAnim ?? vGait)) * Math.min(1, dt / tauV);
      this.anim.set('speed', this._vAnim).update(dt);                // Idle→Walk→Run blend, phase-locked
      this._applyGaitLayer(this._vAnim);
    } else {
      this.actRun.weight = run01; if (this.actIdle) this.actIdle.weight = 1 - run01;
      this.actRun.timeScale = Math.max(0.001, (this.speed / this.stride) * this.runDur); // cadence = ground speed
      this.mixer.update(dt);
    }
    this.model.updateWorldMatrix(true, true);
    // mode HABILLÉ (rondo) : la scène replaque position/yaw sim APRÈS cet update, donc le verrou
    // interne travaillerait sur une position que la scène va déplacer une ligne plus bas — mesuré :
    // 97 % des appuis glissaient. `lockExternal` : la scène appelle footLock.solve() en toute fin
    // de pile, masque la jambe frappeuse, et le verrou vit à TOUTE allure (l'ancien run01 > 0,25
    // excluait toute la plage marche — là où 12-14 % des fenêtres glissaient à lift nul).
    if (this.footLock && !this.lockExternal && run01 > 0.25 && !this.airborne && !this.gestureHold) this.footLock.solve(dt);
  }

  /** Le corps accordé (gait.js) : deltas additifs appliqués APRÈS le mixer. Le mixer réécrit chaque os
   *  à chaque frame (les clips de locomotion en portent 65), donc rien ne s'accumule : la couche est une
   *  fonction pure de (φ, v) et l'application est idempotente par construction. */
  _applyGaitLayer(v) {
    if (!this.gait || !this._gaitBones) return;
    if (this._gaitGen && this.locomotion === 'generee') { this._applyGeneratedGait(v); this._applyLean(); return; }
    const g = gaitLayer(this.gait.phi, v);
    if (!g) return;
    const D = Math.PI / 180;
    for (const [name, e] of Object.entries(g.euler)) {
      // PENDANT UN GESTE, LE HAUT DU CORPS APPARTIENT AU GESTE. Les bras à l'écran étaient la SOMME de
      // trois sources — les bras du clip de course, le delta additif du geste, et le balancer de cette
      // couche — et la somme partait au ciel : bras tendu à la verticale sur une passe de huit mètres,
      // vu par l'utilisateur sur capture pendant que tous les contrats étaient verts. La scène lève
      // `gestureHold` pendant qu'un geste est actif : cette couche garde les jambes et le bassin (la
      // course continue) et rend bras, cou et tête au geste, qui les a authorés pour être vus seuls.
      if (this.gestureHold && /Arm|ForeArm|Neck|Head/.test(name)) continue;
      const bone = this._gaitBones.get(name);
      if (!bone) continue;
      // l'accent de la persona : amplitude de balancier propre (bras seulement)
      const kA = this.persona && /Arm|ForeArm/.test(name) ? this.persona.armSwingF : 1;
      this._gaitE.set(e[0] * D * kA, e[1] * D * kA, e[2] * D * kA, 'XYZ');
      this._gaitQ.setFromEuler(this._gaitE);
      bone.quaternion.multiply(this._gaitQ);
    }
    this._applyLean();
    const hips = this._gaitBones.get('Hips');
    if (hips && g.hipsY) hips.position.y += g.hipsY / Math.max(1e-6, this.model.scale.y);
  }

  /** LA FOULÉE GÉNÉRÉE, posée : os = slerp(mixer, rest ⊗ q_spec(φ, v→), w) — w monte de 0,25 à 0,6 m/s
   *  (en dessous, l'idle du mixer ; au-delà, la pose calculée est CELLE DU BANC). Pendant un geste le
   *  haut du corps appartient au geste (même règle que la couche additive) ; le bassin rebondit en
   *  mètres personnage sur l'axe haut du parent. */
  _applyGeneratedGait(v) {
    const G = this._gaitGen, I = this._idle;
    const dt = Math.max(0, this._leanDt ?? 1 / 60);
    const w = Math.max(0, Math.min(1, (v - 0.25) / 0.35));      // 0 : attente ; 1 : foulée ; entre : fondu
    G.w = w;
    // ---- l'attente : l'espèce de la situation (politique pure), fondue en 0,5 s à chaque changement
    let idle = null;
    if (w < 1) {
      const kind = this.idleForce || (this.idleCtx ? idlePolicy(this.idleCtx, this.persona) : 'repos');
      if (kind !== I.kind) { I.prev = I.kind; I.kind = kind; I.blend = 0; }
      I.blend = Math.min(1, I.blend + dt / 0.5);
      I.t += dt;
      idle = idlePose(G.P, I.t, I.kind, I.style);
      if (I.blend < 1 && I.prev) {
        const b = idlePose(G.P, I.t, I.prev, I.style);
        idle = { q: blendQ(b.q, idle.q, I.blend, G), hips: lerp3(b.hips, idle.hips, I.blend) };
      } else if (I.prev) I.prev = null;
    }
    // ---- la foulée
    let gait = null;
    if (w > 0) {
      const vb = this._bodyVelocity(v);
      G.vBody = vb;
      gait = gaitPose(G.P, this.gait.phi, vb[0], vb[1], G.style, { armSwingF: this.persona?.armSwingF ?? 1 });
    }
    const pose = gait && idle ? { q: blendQ(idle.q, gait.q, w, G), hips: lerp3(idle.hips, gait.hips, w) } : (gait || idle);
    if (!pose) return;
    for (const name in pose.q) {
      if (this.gestureHold && UP_BONES.test(name)) continue;
      const bone = this._gaitBones.get(name), rest = G.rest.get(name);
      if (!bone || !rest) continue;
      const q = pose.q[name];
      this._gaitQ.set(q[0], q[1], q[2], q[3]);
      G.tq.copy(rest).multiply(this._gaitQ);
      bone.quaternion.copy(G.tq);
    }
    const hips = this._gaitBones.get('Hips');
    if (hips) hips.position.copy(G.hipsRest).addScaledVector(G.axisY, pose.hips[1]).addScaledVector(G.axisX, pose.hips[0]);
  }

  /** Forcer une espèce d'attente (la planche-contact, un test) — null : la politique décide. */
  setIdle(kind) { this.idleForce = kind; }

  /** L'inclinaison dans l'accélération et la signature de silhouette — communes aux deux foulées. */
  _applyLean() {
    const D = Math.PI / 180;
    // L'INCLINAISON DANS L'ACCÉLÉRATION — le corps PENCHE dans ce qu'il fait : buste en avant
    // quand on accélère, retenue en arrière au freinage, roulis DANS le virage (comme un cycliste).
    // C'est le tell n°1 d'un corps qui a une masse ; sans lui, les changements d'allure lisent
    // comme des translations de statue. Accélération lissée (τ 0,12 s), bornée (±9° tangage,
    // ±7° roulis), exprimée dans le repère du CORPS (le lacet du modèle, pas celui du monde).
    {
      const now = this.pos ?? this.model.position;
      if (!this._leanPrevV) { this._leanPrevV = [0, 0]; this._leanPrevP = [now.x, now.z]; this._lean = [0, 0]; }
      const dtc = Math.max(1e-3, this._leanDt ?? 1 / 60);
      const vx = (now.x - this._leanPrevP[0]) / dtc, vz = (now.z - this._leanPrevP[1]) / dtc;
      const ax = (vx - this._leanPrevV[0]) / dtc, az = (vz - this._leanPrevV[1]) / dtc;
      this._leanPrevP = [now.x, now.z]; this._leanPrevV = [vx, vz];
      const yaw = this.yaw ?? this.model.rotation.y;
      // repère corps : avant = (sin yaw, cos yaw) pour un modèle three tourné par rotation.y
      const fx = Math.sin(yaw), fz = Math.cos(yaw);
      const aF = Math.max(-14, Math.min(14, ax * fx + az * fz));       // accélération le long du regard
      const aL = Math.max(-14, Math.min(14, ax * fz - az * fx));       // latérale (le virage)
      const k = 1 - Math.exp(-dtc / 0.12);
      this._lean[0] += (Math.max(-9, Math.min(9, aF * 0.85)) - this._lean[0]) * k;
      this._lean[1] += (Math.max(-7, Math.min(7, aL * 0.7)) - this._lean[1]) * k;
      const spL = this._gaitBones.get('Spine');
      if (spL && (Math.abs(this._lean[0]) > 0.05 || Math.abs(this._lean[1]) > 0.05)) {
        this._gaitE.set(this._lean[0] * D, 0, -this._lean[1] * D, 'XYZ');
        this._gaitQ.setFromEuler(this._gaitE);
        spL.quaternion.multiply(this._gaitQ);
      }
    }
    // …et la SIGNATURE DE SILHOUETTE : une inclinaison propre du buste (1-3°) et une asymétrie
    // d'épaules constantes — c'est ce qui fait reconnaître un joueur de loin sans lire son numéro
    if (this.persona?.posture) {
      const sp = this._gaitBones.get('Spine1');
      if (sp) { this._gaitE.set(this.persona.posture.lean * D, 0, this.persona.posture.shoulder * D * 0.4, 'XYZ'); this._gaitQ.setFromEuler(this._gaitE); sp.quaternion.multiply(this._gaitQ); }
      const sh = this._gaitBones.get('Spine2');
      if (sh) { this._gaitE.set(0, 0, this.persona.posture.shoulder * D * 0.6, 'XYZ'); this._gaitQ.setFromEuler(this._gaitE); sh.quaternion.multiply(this._gaitQ); }
    }
  }
}
/** Fondu de deux poses q_spec (os par os, slerp — un os absent d'un côté garde l'autre). */
function blendQ(a, b, t, G) {
  if (t <= 0) return a; if (t >= 1) return b;
  const out = {};
  for (const k in b) {
    if (!a[k]) { out[k] = b[k]; continue; }
    G.tq.set(a[k][0], a[k][1], a[k][2], a[k][3]); G.tq2.set(b[k][0], b[k][1], b[k][2], b[k][3]);
    G.tq.slerp(G.tq2, t); out[k] = [G.tq.x, G.tq.y, G.tq.z, G.tq.w];
  }
  for (const k in a) if (!out[k]) out[k] = a[k];
  return out;
}
const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

import { hyp } from './hyp.js';
