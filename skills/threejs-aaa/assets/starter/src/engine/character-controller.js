import * as THREE from 'three/webgpu';
import { FootLockIK } from './foot-lock.js';
import { WORLD } from './world-basis.js';
import { AnimationStateMachine } from './anim-state-machine.js';
import { makeGaitClock, phaseOffset, gaitLayer } from './gait.js';

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
  constructor(model, { mixer, runClip, idleClip, walkClip = null, legs = null, stride = 2.6, walkStride = 1.5, walkSpeed = 1.9, runSpeed = 5.5, sprintMult = 1.6, jumpSpeed = 5.5, gravity = 18, accel = 14, turnRate = 12, forwardLocal = FWD } = {}) {
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
    // le corps accordé : bassin/colonne/bras/tête dérivés de (φ, v), appliqués APRÈS le mixer
    this._gaitBones = null;
    if (this.gait) {
      const suffix = (n) => n.replace(/^mixamorig\d*/i, '');
      const map = new Map();
      model.traverse((o) => { if (o.isBone) { const s2 = suffix(o.name); if (!map.has(s2)) map.set(s2, o); } });
      this._gaitBones = map;
      this._gaitQ = new THREE.Quaternion(); this._gaitE = new THREE.Euler();
    }
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
      const d = Math.hypot(wp.x - this._lastW.x, wp.z - this._lastW.z);
      const cap = this.runSpeed * this.sprintMult * 1.5;      // au-delà : téléport de scène, pas une course
      const inst = Math.min(d / Math.max(1e-4, dt), cap);
      this.groundSpeed = (this.groundSpeed ?? inst) * 0.7 + inst * 0.3;
    } else this.groundSpeed = 0;
    this._lastW = { x: wp.x, z: wp.z };

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
      this.dist += Math.hypot(r.dx, r.dz);                  // cadence tracks ACTUAL movement (blocked → legs slow)
    } else {
      this.pos.x += ddx; this.pos.z += ddz; this.dist += Math.hypot(ddx, ddz);
      if (this.airborne || this.vy !== 0) { this.vy -= this.gravity * dt; this.pos.y += this.vy * dt; if (this.pos.y <= this.groundY) { this.pos.y = this.groundY; this.vy = 0; this.airborne = false; } }
    }
    this.model.position.copy(this.pos); this.model.rotation.y = this.yaw;

    const runRef = this.runSpeed * (this._sprint ? this.sprintMult : 1);
    const run01 = Math.min(1, this.speed / runRef);
    if (this._useFsm) {
      const vGait = Math.max(this.speed, this.groundSpeed ?? 0);
      if (this.gait) this.gait.advance(vGait, dt);                   // l'horloge unique tourne AVANT le mixer
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
    if (this.footLock && run01 > 0.25 && !this.airborne && !this.gestureHold) this.footLock.solve();
  }

  /** Le corps accordé (gait.js) : deltas additifs appliqués APRÈS le mixer. Le mixer réécrit chaque os
   *  à chaque frame (les clips de locomotion en portent 65), donc rien ne s'accumule : la couche est une
   *  fonction pure de (φ, v) et l'application est idempotente par construction. */
  _applyGaitLayer(v) {
    if (!this.gait || !this._gaitBones) return;
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
      this._gaitE.set(e[0] * D, e[1] * D, e[2] * D, 'XYZ');
      this._gaitQ.setFromEuler(this._gaitE);
      bone.quaternion.multiply(this._gaitQ);
    }
    const hips = this._gaitBones.get('Hips');
    if (hips && g.hipsY) hips.position.y += g.hipsY / Math.max(1e-6, this.model.scale.y);
  }
}
