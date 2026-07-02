import * as THREE from 'three/webgpu';
import { blend1dWeights } from './anim-blend.js';
export { blend1dWeights } from './anim-blend.js';

// AnimationStateMachine — clean state/transition control over an AnimationMixer. Two kinds of state:
//   • clip     — one clip (Idle, Jump, a celebration…), optional one-shot.
//   • blend1d  — a 1D blend space (e.g. Idle→Walk→Run) driven by a numeric parameter; the two bracketing
//                anchors crossfade by the param, and each anchor's clip can be cadence-synced to a `speed`
//                param via its `stride` (so legs turn over at ground speed at any blend — no foot-skate).
// Transitions crossfade over `fade` seconds. It owns weights + timeScales and calls mixer.update(dt).
//
//   const anim = new AnimationStateMachine(mixer);
//   anim.blend1d('locomotion', 'speed', [
//     { clip: idle, at: 0 }, { clip: walk, at: 1.8, stride: 1.5 }, { clip: run, at: 5.5, stride: 2.6 },
//   ]).clip('jump', jumpClip, { loop: false }).play('locomotion');
//   // per frame: anim.set('speed', ctrl.speed).update(dt);   // (or anim.play('jump', 0.1) on an event)
export class AnimationStateMachine {
  constructor(mixer) { this.mixer = mixer; this.states = new Map(); this.params = {}; this.current = null; this.prev = null; this.blend = 1; this.fade = 0.2; }
  set(p, v) { this.params[p] = v; return this; }

  clip(name, clip, { loop = true, timeScale = 1, clampWhenFinished = true } = {}) {
    const a = this.mixer.clipAction(clip);
    a.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity); a.clampWhenFinished = clampWhenFinished;
    a.enabled = true; a.weight = 0; a.play();
    this.states.set(name, { name, kind: 'clip', action: a, timeScale, dur: clip.duration });
    return this;
  }
  // anchors: [{ clip, at, stride? }] — `at` is the param value, `stride` (optional) cadence-syncs to params.speed
  blend1d(name, param, anchors) {
    const arr = anchors.map((an) => { const a = this.mixer.clipAction(an.clip); a.enabled = true; a.weight = 0; a.play(); return { ...an, action: a, dur: an.clip.duration }; }).sort((x, y) => x.at - y.at);
    this.states.set(name, { name, kind: 'blend1d', param, anchors: arr });
    return this;
  }

  play(name, fade = 0.2) {
    const next = this.states.get(name); if (!next || this.current === next) return this;
    if (next.kind === 'clip') next.action.reset();
    this.prev = this.current; this.current = next; this.blend = this.prev ? 0 : 1; this.fade = fade;
    return this;
  }
  get state() { return this.current?.name; }

  _apply(st, w) {
    if (!st) return;
    if (st.kind === 'clip') { st.action.weight = w; st.action.timeScale = st.timeScale; return; }
    const ws = blend1dWeights(st.anchors, this.params[st.param] ?? 0);
    const speed = this.params.speed ?? this.params[st.param] ?? 0;
    st.anchors.forEach((an, i) => {
      an.action.weight = w * ws[i];
      if (an.stride) an.action.timeScale = Math.max(0.01, (speed / an.stride) * an.dur); // cadence = ground speed
    });
  }

  update(dt) {
    if (this.blend < 1) this.blend = Math.min(1, this.blend + dt / Math.max(1e-3, this.fade));
    if (this.prev) { this._apply(this.prev, 1 - this.blend); if (this.blend >= 1) { this._apply(this.prev, 0); this.prev = null; } }
    this._apply(this.current, this.blend);
    this.mixer.update(dt);
  }
}
