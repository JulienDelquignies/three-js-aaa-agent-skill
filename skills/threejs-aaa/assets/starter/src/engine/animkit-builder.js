import * as THREE from 'three/webgpu';
import { resolveTracks } from './animkit.js';

// animkit-builder — resolved animkit tracks → a real THREE.AnimationClip on a real rig. GLB exports
// rename bones ("mixamorigLeftArm", "LeftArm", …), so canonical names are resolved by SUFFIX against
// the model's actual bone names; bones missing from the rig are skipped (the clip still plays).
export function resolveBoneNames(model) {
  const names = [];
  model.traverse((o) => { if (o.isBone) names.push(o.name); });
  return (canonical) => names.find((n) => n.toLowerCase().endsWith(canonical.toLowerCase())) || null;
}

/** Build an AnimationClip from an animkit spec against a model's rig.
 *  { additive: false } keeps the clip ABSOLUTE — the form to feed rig-retarget (retarget first,
 *  makeClipAdditive after: an additive delta clip cannot be transported bind-to-bind). */
export function toClip(spec, model, { additive = true } = {}) {
  const find = resolveBoneNames(model);
  const r = resolveTracks(spec);
  const tracks = [];
  for (const [bone, keys] of Object.entries(r.tracks)) {
    const name = find(bone);
    if (!name) continue;
    const times = new Float32Array(keys.map((k) => k.t));
    const values = new Float32Array(keys.flatMap((k) => k.q));
    tracks.push(new THREE.QuaternionKeyframeTrack(`${name}.quaternion`, times, values));
  }
  // ROOT MOTION: hips deltas are authored in CHARACTER metres [right, up, forward]. The bone's local
  // frame is NOTHING like that: Mixamo armatures come rotated (−90° X) and in centimetres — probed
  // live, the hips' parent world basis had scaleY 0 (local Y points HORIZONTAL). So each delta goes
  // character-space → world (the model's root basis, forward = −Z on this rig) → hips-parent local
  // (inverse parent basis — which absorbs both the rotation and the cm scale) before keying.
  if (r.hipsPos) {
    const hipsName = find('Hips');
    let hipsBone = null; model.traverse((o) => { if (o.isBone && o.name === hipsName && !hipsBone) hipsBone = o; });
    if (hipsBone) {
      model.updateMatrixWorld(true);
      const toWorld = new THREE.Matrix3().setFromMatrix4(model.matrixWorld);
      const toParent = new THREE.Matrix3().setFromMatrix4(hipsBone.parent.matrixWorld).invert();
      const rest = hipsBone.position;
      const d = new THREE.Vector3();
      const times = new Float32Array(r.hipsPos.map((k) => k.t));
      const values = new Float32Array(r.hipsPos.flatMap((k) => {
        d.set(k.p[0], k.p[1], -k.p[2]).applyMatrix3(toWorld).applyMatrix3(toParent);   // forwardLocal = −Z
        return [rest.x + d.x, rest.y + d.y, rest.z + d.z];
      }));
      tracks.push(new THREE.VectorKeyframeTrack(`${hipsName}.position`, times, values));
    }
  }
  const clip = new THREE.AnimationClip(r.name, r.duration, tracks);
  // ADDITIVE by default: converted to deltas vs frame 0 (= BASE pose), the gesture ADDS on top of
  // whatever locomotion is running — two normal-blend actions on the same bones just average 50/50
  // and the gesture comes out half-raised (caught on the first live screenshot)
  if (additive) THREE.AnimationUtils.makeClipAdditive(clip);
  clip.userData = { loop: r.loop, additive, contact: spec.contact ?? null };
  return clip;
}

/** Play a one-shot GESTURE over whatever is running (locomotion keeps the legs — the gesture's
 *  tracks only claim the bones it poses). Returns the action; it fades itself out at the end. */
export function playGesture(mixer, clip, { fade = 0.18, weight = 1, from = 0 } = {}) {
  const action = mixer.clipAction(clip);
  if (clip.userData?.additive) action.blendMode = THREE.AdditiveAnimationBlendMode;
  action.reset();
  action.setLoop(clip.userData?.loop ? THREE.LoopRepeat : THREE.LoopOnce, clip.userData?.loop ? Infinity : 1);
  action.clampWhenFinished = false;
  action.setEffectiveWeight(weight);
  // `from` starts the clip PART-WAY IN. A ball-contact move exists to be synchronised with the ball,
  // and the event that says "the ball has left" arrives at the instant of contact — not a backswing
  // earlier. Playing such a clip from t=0 puts the leg behind the body while the ball is already
  // travelling, which is exactly what reads as "the ball never really leaves his foot". Starting at the
  // move's own contact time costs the backswing and buys correct contact: the boot is ON the ball at
  // the frame it goes, and the follow-through plays out after.
  if (from > 0) action.time = Math.min(from, clip.duration - 1e-3);
  action.fadeIn(fade).play();
  if (!clip.userData?.loop) {
    const onDone = (e) => { if (e.action === action) { action.fadeOut(fade); mixer.removeEventListener('finished', onDone); } };
    mixer.addEventListener('finished', onDone);
  }
  return action;
}

/** Wind a LOOPING gesture down cleanly (fade to zero, then stop so the mixer drops it). */
export function stopGesture(action, { fade = 0.25 } = {}) {
  if (!action) return;
  action.fadeOut(fade);
  setTimeout(() => action.stop(), fade * 1000 + 60);
}
