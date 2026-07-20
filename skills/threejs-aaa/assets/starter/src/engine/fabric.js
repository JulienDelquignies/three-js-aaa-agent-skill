import * as THREE from 'three/webgpu';
import { attribute, bumpMap, color, dot, float, mx_fractal_noise_float, mx_noise_float, sin, vec3 } from 'three/tsl';

// fabric — procedural CLOTH materials in the shader (TSL), zero texture files. Flat colors read
// as plastic; fabric is variation: a wash (low-frequency), fibre grain (high-frequency), and for
// denim the SEAMS — dark seam lines with contrast stitching beside them, the single strongest
// "this is a jean" cue. Everything is computed from the garment's BIND-SPACE position
// (`attribute('position')`, pre-skinning) so the pattern is glued to the cloth.
//
// Probe-won rules (reference/44): modulate the tint MULTIPLICATIVELY (linear-space lerps toward
// white wash dark channels out — the powder-jean bug); keep frequencies LOW (no mips on
// procedural patterns → chainmail moiré); seam masks use cos(angleΔ) dot-math (no atan wrap).

function base(kind, tint, roughness, scale) {
  const m = new THREE.MeshStandardNodeMaterial({ color: tint, roughness, metalness: 0.02 });
  const p = attribute('position').mul(scale);
  const grain = mx_fractal_noise_float(p.mul(kind === 'wool' ? 34 : 26), 3);
  const wash = mx_noise_float(p.mul(kind === 'knit' ? 9 : 2.4)).mul(0.5);
  // RELIEF: a bump normal from soft wrinkles + weave so light catches the folds/threads (the
  // single biggest "real cloth vs painted tube" win). Height is a SIGNED field; bumpMap takes its
  // screen-space derivative to perturb the normal. The SAME field also shades the colour (folds
  // darker, raised areas faded) — multiplicative, so it can never wash the tint out.
  const wrinkle = mx_fractal_noise_float(p.mul(kind === 'wool' ? 5 : 6.5), 4).sub(0.5);
  const weave = kind === 'denim' ? sin(dot(p, vec3(230, 230, 96))).mul(0.5)
    : kind === 'knit' ? sin(p.y.mul(300)).mul(0.5).add(mx_noise_float(p.mul(70)).sub(0.5).mul(0.5))
    : mx_noise_float(p.mul(42)).sub(0.5);
  const height = wrinkle.mul(1.0).add(weave.mul(0.4));
  m.normalNode = bumpMap(height, float(kind === 'denim' ? 0.85 : 0.6));
  // colour value (MULTIPLICATIVE, mean ~1): fibre grain + low-freq wash + fold/fade shading
  let v = float(1.0).add(grain.mul(kind === 'knit' ? 0.16 : 0.3)).add(wash.mul(kind === 'knit' ? 0.16 : 0.35))
    .add(wrinkle.mul(kind === 'denim' ? 0.24 : 0.14));                          // raised = faded, folds = shaded
  if (kind === 'denim') v = v.add(sin(dot(p, vec3(64, 64, 26))).mul(0.06));
  m.roughnessNode = float(roughness - 0.04).add(grain.mul(0.12)).add(weave.abs().mul(0.05));
  m.userData.fabric = { kind, tint, scale };
  return { m, p, v };
}

/** Plain fabric: 'knit' (heather jersey), 'denim' (washed), 'wool' (nap). */
export function fabricMaterial({ kind = 'knit', tint = 0x8d939c, roughness = 0.85, scale = 1 } = {}) {
  const { m, v } = base(kind, tint, roughness, scale);
  m.colorNode = color(tint).mul(v.clamp(0.55, 1.4));
  return m;
}

/**
 * Denim with SEAMS + stitching for a tube-shaped piece (jean leg). The frame localises angles
 * around the piece's own axis: c (a point on the axis), u/v (the ring basis used to build it).
 * seams: [{ angle, stitch }] — a dark seam line at `angle` (radians in the u/v plane), with a
 * contrast stitch line offset beside it when `stitch` is true.
 */
export function denimSeamMaterial({ tint = 0x3d5a80, roughness = 0.85, scale = 1, frame, seams = [], stitchTint = 0xc9913f, stitchWidth = 0.05 } = {}) {
  const { m, p, v } = base('denim', tint, roughness, scale);
  let col = color(tint).mul(v.clamp(0.55, 1.4));
  if (frame && seams.length) {
    const c = vec3(...frame.c), u = vec3(...frame.u), vv = vec3(...frame.v);
    const q = attribute('position').sub(c);
    const qu = dot(q, u), qv = dot(q, vv);
    const len = qu.mul(qu).add(qv.mul(qv)).sqrt().add(1e-5);
    const cosd = (A) => qu.mul(Math.cos(A)).add(qv.mul(Math.sin(A))).div(len);   // cos(angle − A)
    // A thin line where the vertex angle ≈ A: cosd(A)=cos(angleΔ) peaks at 1 on the seam. Explicit
    // clamp math (no smoothstep — the TSL arg order bit us). `line(A,wid)` ≈1 on the seam, 0 off it.
    const line = (A, wid) => cosd(A).sub(Math.cos(wid)).mul(1 / (1.0001 - Math.cos(wid))).clamp(0, 1);
    for (const s of seams) {
      // pressed fold: a hard dark crease line, flanked by a soft lighter highlight (the pressed
      // ridge catches light). Multiplicative only — a shadow can never wash the base to gold.
      col = col.mul(float(1).sub(line(s.angle, 0.03).mul(0.4)));                  // dark crease valley
      if (s.stitch) {                                                             // felled seam: raised ridge = subtle lightening beside the crease (a shader topstitch mix floods — line() reads broad in the fallback path; do topstitch as geometry instead)
        const ridge = line(s.angle + 0.05, 0.035).add(line(s.angle - 0.05, 0.035)).clamp(0, 1);
        col = col.mul(float(1).add(ridge.mul(0.12)));
      }
    }
  }
  m.colorNode = col;
  m.userData.fabric = { kind: 'denim', tint, scale, seams: seams.length };
  return m;
}
