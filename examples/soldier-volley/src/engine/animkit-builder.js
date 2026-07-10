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

/** Build an AnimationClip from an animkit spec against a model's rig. */
export function toClip(spec, model) {
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
  const clip = new THREE.AnimationClip(r.name, r.duration, tracks);
  // ADDITIVE by default: converted to deltas vs frame 0 (= BASE pose), the gesture ADDS on top of
  // whatever locomotion is running — two normal-blend actions on the same bones just average 50/50
  // and the gesture comes out half-raised (caught on the first live screenshot)
  THREE.AnimationUtils.makeClipAdditive(clip);
  clip.userData = { loop: r.loop, additive: true };
  return clip;
}

/** Play a one-shot GESTURE over whatever is running (locomotion keeps the legs — the gesture's
 *  tracks only claim the bones it poses). Returns the action; it fades itself out at the end. */
export function playGesture(mixer, clip, { fade = 0.18, weight = 1 } = {}) {
  const action = mixer.clipAction(clip);
  if (clip.userData?.additive) action.blendMode = THREE.AdditiveAnimationBlendMode;
  action.reset();
  action.setLoop(clip.userData?.loop ? THREE.LoopRepeat : THREE.LoopOnce, clip.userData?.loop ? Infinity : 1);
  action.clampWhenFinished = false;
  action.setEffectiveWeight(weight);
  action.fadeIn(fade).play();
  if (!clip.userData?.loop) {
    const onDone = (e) => { if (e.action === action) { action.fadeOut(fade); mixer.removeEventListener('finished', onDone); } };
    mixer.addEventListener('finished', onDone);
  }
  return action;
}
