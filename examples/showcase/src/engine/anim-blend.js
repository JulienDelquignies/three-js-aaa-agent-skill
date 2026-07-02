// Pure blend math for the animation state machine (dependency-free → node-testable via
// scripts/verify-anim-fsm.mjs). Kept separate from anim-state-machine.js so it imports without three.

/** 1D blend weights for anchors (each {at}) at a parameter value. Sums to 1, clamps past the ends, and
 *  only ever activates the two bracketing neighbours. Anchors must be sorted ascending by `at`. */
export function blend1dWeights(anchors, value) {
  const n = anchors.length, w = new Array(n).fill(0);
  if (n === 0) return w;
  if (value <= anchors[0].at) { w[0] = 1; return w; }
  if (value >= anchors[n - 1].at) { w[n - 1] = 1; return w; }
  for (let i = 0; i < n - 1; i++) {
    if (value >= anchors[i].at && value <= anchors[i + 1].at) {
      const t = (value - anchors[i].at) / (anchors[i + 1].at - anchors[i].at); w[i] = 1 - t; w[i + 1] = t; break;
    }
  }
  return w;
}
