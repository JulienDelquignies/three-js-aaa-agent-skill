// Seeded, reproducible randomness. NEVER use Math.random() for procedural content —
// it cannot be seeded, so worlds are not reproducible. Derive an independent sub-seed
// per subsystem (terrain, scatter, props) so changing one system doesn't shift the others.

/** mulberry32: fast 32-bit seeded PRNG → float in [0, 1). */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** xmur3: hash a string into a 32-bit seed generator (use to derive sub-seeds). */
export function xmur3(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}

/** Derive an independent PRNG for a named subsystem from a master seed. */
export function subRng(masterSeed, name) {
  const seedGen = xmur3(`${masterSeed}:${name}`);
  return mulberry32(seedGen());
}
