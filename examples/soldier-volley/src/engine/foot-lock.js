// FootLockIK — the stance finisher for foot-skate. Pairs with matchCadence (./locomotion.js): cadence
// ties the legs to ground speed, this pins whichever foot is in contact so it doesn't smear across the
// ground. Needed whenever a clip's authored foot push is smaller than the distance you move it over
// (very common with Mixamo clips meant for root-motion — measured on Soldier.glb, NO playback speed makes
// its Run grip). Fits bone rotations in world space, so it's rig-agnostic (Mixamo, RPM, …). See reference/21.
//
// Requires THREE (poses real bones) + twoBoneIK (analytic, from procedural.js). Per frame call order:
//   place the model → mixer/clip pose → (procedural layers) → updateMatrixWorld(true) → footLock.solve().

import * as THREE from 'three/webgpu';
import { twoBoneIK } from './procedural.js';

const _hip = new THREE.Vector3(), _knee = new THREE.Vector3(), _foot = new THREE.Vector3();
const _tgt = new THREE.Vector3(), _cur = new THREE.Vector3(), _des = new THREE.Vector3();
const _mid = new THREE.Vector3(), _end = new THREE.Vector3();
const _q = new THREE.Quaternion(), _wq = new THREE.Quaternion(), _pw = new THREE.Quaternion();

// Rotate `bone` (in world space) so that its `child` joint aims from the bone toward `worldTarget`.
// Axis-agnostic: it measures the current world aim and rotates it onto the desired aim, so it works
// for any rig's local bone orientation. Caller must updateMatrixWorld after.
// Exported: strike-warp (the gesture-window leg authority) applies its IK with the SAME primitive —
// one way to pose a leg in this engine, not two.
export function aimChildAt(bone, child, worldTarget) {
  bone.getWorldPosition(_hip); child.getWorldPosition(_knee);
  _cur.copy(_knee).sub(_hip); _des.copy(worldTarget).sub(_hip);
  if (_cur.lengthSq() < 1e-10 || _des.lengthSq() < 1e-10) return;
  _cur.normalize(); _des.normalize();
  _q.setFromUnitVectors(_cur, _des);              // world-space delta
  bone.getWorldQuaternion(_wq);
  _wq.premultiply(_q);                             // new world = delta * current
  bone.parent.getWorldQuaternion(_pw).invert();
  bone.quaternion.copy(_pw.multiply(_wq));         // back to local
  bone.updateMatrixWorld(true);
}

/**
 * Foot-lock IK. Construct with leg chains, each { up, knee, foot } (e.g. mixamorigRightUpLeg / RightLeg /
 * RightFoot), then call solve() every frame AFTER the clip has posed the skeleton and the model is placed.
 * Detecting "grounded" needs the foot's true resting height, which differs per foot on stylized clips —
 * pass a `sampleClip(phase01)` that poses the skeleton at a normalized clip phase (the ctor sweeps it once
 * to find each foot's floor). Without it, the floor is learned online (less robust on the first cycle).
 */
export class FootLockIK {
  constructor(legs, { contactBand = 0.05, sampleClip = null, samples = 40, fade = 0.09 } = {}) {
    this.legs = legs; this.contactBand = contactBand; this.fade = fade;
    this.state = legs.map(() => ({ grounded: false, lock: new THREE.Vector3(), floor: Infinity, online: true, w: 0 }));
    this.lens = legs.map((l) => {
      l.up.getWorldPosition(_hip); l.knee.getWorldPosition(_knee); l.foot.getWorldPosition(_foot);
      return { A: _hip.distanceTo(_knee), B: _knee.distanceTo(_foot) };
    });
    if (sampleClip) {                                    // calibrate each foot's true ground height once
      for (let s = 0; s < samples; s++) {
        sampleClip(s / samples);
        legs.forEach((l, i) => { l.foot.getWorldPosition(_foot); this.state[i].floor = Math.min(this.state[i].floor, _foot.y); this.state[i].online = false; });
      }
    }
  }

  /**
   * v2, ré-écrit contre la sonde du sweep (97-98 % des appuis translataient > 0,15 m, médiane
   * 0,77 m par appui — le patin généralisé qui fait LIRE le jeu trop vite) :
   *   — le FONDU : la capture monte en ~0,09 s, la relâche REDESCEND au lieu de téléporter (le
   *     retour sec lock→clip mesurait 0,4-0,6 m en une image à chaque recapture) ;
   *   — hors de portée : le pied s'ÉCRÊTE sur la sphère de la jambe pendant que le fondu descend
   *     (même loi que le warp de frappe : la fraction atteignable vaut mieux qu'un lâcher sec) ;
   *   — le CLAMP SOL : la cible ne descend jamais sous le plancher calibré (orteils mesurés à
   *     −12,9 cm sous la pelouse) ;
   *   — le MASQUE par jambe : pendant un geste, la jambe frappeuse appartient à la couche de
   *     geste + warp — mais le pied d'APPUI garde SON verrou (l'ancien tout-ou-rien coupait les
   *     deux pendant chaque geste, pendant que le corps translatait jusqu'à 7 m/s).
   * L'appelant décide QUAND (la scène l'appelle en toute FIN de pile, après le replaquage sim et
   * toutes les couches — le résoudre avant le replaquage, c'était verrouiller une position que la
   * scène allait déplacer une ligne plus bas).
   */
  /**
   * @param dt    pas de temps
   * @param mask  par jambe : false = jambe possédée par une autre autorité (geste/warp) — relâche
   * @param bodyYaw lacet du corps (rad) — un pivot > ~25° depuis la capture RE-PLANTE le pied
   *              (XZ tenu pendant que le corps tourne = jambes qui se vrillent — mesuré : 298
   *              croisements de pieds en virage quand le lacet n'était pas écouté, 5 avant)
   */
  solve(dt = 1 / 60, mask = null, bodyYaw = null, bodySpeed = 0) {
    for (let i = 0; i < this.legs.length; i++) {
      const l = this.legs[i], st = this.state[i], { A, B } = this.lens[i];
      l.foot.getWorldPosition(_foot);
      if (st.online) st.floor = Math.min(st.floor, _foot.y);
      // QUEL PIED EST L'APPUI ? Ni la hauteur seule (la marche a un swing rasant : le verrou le
      // re-capturait en plein vol et le TRAÎNAIT — marche aplatie, +8 400 fenêtres de glisse
      // officielles mesurées), ni un seuil fixe de vitesse monde (le pied d'appui QUI GLISSE bouge
      // en monde — c'est le symptôme même : un seuil fixe rejette la capture pile quand il faut
      // verrouiller). Le discriminant est RELATIF À L'ALLURE : en cycle vrai, l'appui est
      // quasi-stationnaire en monde et le swing va à ~2× l'allure — un pied bas sous
      // max(0,4 ; 0,6×allure) est un appui, même s'il dérape.
      const vFoot = st.prev ? hyp(_foot.x - st.prev.x, _foot.z - st.prev.z) / Math.max(1e-4, dt) : 0;
      st.prev = st.prev ? st.prev.set(_foot.x, _foot.y, _foot.z) : _foot.clone();
      const allowed = !mask || mask[i] !== false;
      const low = _foot.y <= st.floor + this.contactBand;
      const stanceV = Math.max(0.4, 0.6 * bodySpeed);
      if (allowed && low && vFoot < stanceV && !st.grounded) {
        st.grounded = true; st.lock.copy(_foot);                          // touchdown : capture monde
        st.yaw0 = bodyYaw ?? 0;
      }
      if (st.grounded) {
        const drift = hyp(st.lock.x - _foot.x, st.lock.z - _foot.z);
        const turned = bodyYaw != null && Math.abs(Math.atan2(Math.sin(bodyYaw - st.yaw0), Math.cos(bodyYaw - st.yaw0))) > 0.44;
        // …et l'ÉTIREMENT SE RELÂCHE AVANT LA BUTÉE : une cheville réelle DÉCOLLE (le talon pèle)
        // avant l'extension complète — attendre l'écrêtage de la sphère, c'est traîner le pied à
        // poids plein sur l'image même où la jambe perd le bras de fer (mesuré : chaque écrêtage
        // = 25-40 mm de glissement à w=1, la clause « un pied tenu ne bouge pas » le lit). À 92 %
        // de la portée, le fondu démarre PENDANT que la jambe peut encore suivre.
        l.up.getWorldPosition(_hip);
        const dLock = hyp(_hip.x - st.lock.x, _hip.y - Math.max(_foot.y, st.floor), _hip.z - st.lock.z);
        const stretched = dLock > 0.92 * (A + B) * 0.995;
        // relâche : le clip a levé le pied (vrai swing : haut ou NET plus vite que l'allure), la
        // dérive dépasse la borne d'un appui (0,45 m — au-delà le pied DOIT se re-planter, pas
        // s'étirer), ou le corps a pivoté (> 25° : un vrai appui qui tourne se re-plante)
        if (!allowed || !low || vFoot >= Math.max(1.0, 1.1 * bodySpeed) || drift > 0.45 || turned || stretched) st.grounded = false;
      }
      st.w = Math.max(0, Math.min(1, st.w + (st.grounded ? dt : -dt) / this.fade));
      if (st.w <= 1e-3) {
        // même un pied LIBRE (masqué, pose couchée, fondu de sortie) ne traverse pas la pelouse :
        // clamp Y seul, XZ au clip — la pose de tacle composée plantait l'orteil à −0,26 m
        if (_foot.y < st.floor - 0.02) {
          _tgt.set(_foot.x, st.floor - 0.02, _foot.z);
          l.up.getWorldPosition(_hip); l.knee.getWorldPosition(_knee);
          const d0 = _hip.distanceTo(_tgt), R0 = (A + B) * 0.995;
          if (d0 <= R0) {
            const pole0 = [_knee.x - _hip.x, _knee.y - _hip.y, _knee.z - _hip.z];
            const sol0 = twoBoneIK(_hip.toArray(), _tgt.toArray(), A, B, pole0);
            aimChildAt(l.up, l.knee, _mid.fromArray(sol0.mid));
            aimChildAt(l.knee, l.foot, _end.fromArray(sol0.end));
          }
        }
        continue;                                                        // swing assumé : la pose du clip
      }
      // cible : XZ tenu au verrou (fondu vers la pose clip quand w < 1), hauteur = clip CLAMPÉE au sol
      const y = Math.max(_foot.y, st.floor);
      _tgt.set(
        _foot.x + (st.lock.x - _foot.x) * st.w,
        y,
        _foot.z + (st.lock.z - _foot.z) * st.w,
      );
      l.up.getWorldPosition(_hip); l.knee.getWorldPosition(_knee);
      const d = _hip.distanceTo(_tgt), R = (A + B) * 0.995;
      if (d > R) {                                                        // hors de portée : écrêter + relâcher
        _tgt.set(_hip.x + (_tgt.x - _hip.x) * (R / d), _hip.y + (_tgt.y - _hip.y) * (R / d), _hip.z + (_tgt.z - _hip.z) * (R / d));
        st.grounded = false;                                              // le fondu redescend au prochain pas
      }
      const pole = [_knee.x - _hip.x, _knee.y - _hip.y, _knee.z - _hip.z]; // keep the clip's natural knee bend
      const sol = twoBoneIK(_hip.toArray(), _tgt.toArray(), A, B, pole);
      aimChildAt(l.up, l.knee, _mid.fromArray(sol.mid));
      aimChildAt(l.knee, l.foot, _end.fromArray(sol.end));
    }
  }
}
import { hyp } from './hyp.js';
