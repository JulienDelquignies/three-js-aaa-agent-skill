import * as THREE from 'three/webgpu';
import { attribute, color, dot, float, mix, mx_fractal_noise_float, mx_noise_float, sin, vec3 } from 'three/tsl';

// fabric — procedural CLOTH materials in the shader (TSL), zero texture files. Flat colors read
// as plastic; fabric is variation: a wash (low-frequency), fibre grain (high-frequency), and a
// structure (twill diagonal for denim, knit rows for jersey). Everything is computed from the
// garment's BIND-SPACE position (`attribute('position')`, pre-skinning) so the pattern is glued
// to the cloth — it moves WITH the garment instead of swimming through it. Deterministic, works
// on WebGPU and the WebGL2 fallback, resolution-independent.

/**
 * @param {object} o {kind: 'knit'|'denim'|'wool', tint, roughness, scale}
 * @returns {THREE.MeshStandardNodeMaterial}
 */
export function fabricMaterial({ kind = 'knit', tint = 0x8d939c, roughness = 0.85, scale = 1 } = {}) {
  const m = new THREE.MeshStandardNodeMaterial({ color: tint, roughness, metalness: 0.02 });
  const p = attribute('position').mul(scale);
  // MULTIPLICATIVE value modulation, mean 1.0 — the tint stays EXACTLY the tint. (Mixing between
  // lerped-to-white/black endpoints happens in linear space: +0.07 linear on a dark channel
  // doubles it (~+0.28 sRGB) and the jean turned powder — proved by the two-spheres A/B probe.)
  // Frequencies stay LOW: procedural patterns have no mips, high-frequency sin/noise turns into
  // chainmail moiré on screen (caught on the first close-up).
  const grain = mx_fractal_noise_float(p.mul(kind === 'wool' ? 34 : 26), 3);   // signed, ~0-centred
  const wash = mx_noise_float(p.mul(kind === 'knit' ? 9 : 2.4)).mul(0.5);
  let v = float(1.0).add(grain.mul(kind === 'knit' ? 0.16 : 0.3)).add(wash.mul(kind === 'knit' ? 0.16 : 0.35));
  if (kind === 'denim') v = v.add(sin(dot(p, vec3(64, 64, 26))).mul(0.06));    // faint twill hint
  m.colorNode = color(tint).mul(v.clamp(0.55, 1.4));
  m.roughnessNode = float(roughness - 0.04).add(grain.mul(0.12));
  m.userData.fabric = { kind, tint, scale };
  return m;
}
