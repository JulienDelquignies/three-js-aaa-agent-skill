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

// (264) LES FLUX RNG NOMMÉS (Modèle 01 §3.1 « abandonner les générateurs à état séquentiel », test 8 la neutralité du flux).
// Un tirage est une FONCTION PURE DE COORDONNÉES u = Φ(graine, sous-système, tick, entité, index) : aucun état, aucune
// dépendance à l'ordre d'appel — un tirage ajouté dans le module de tir ne décale plus la séquence du module de passe,
// les rejeux tiennent à travers les changements de code, les A/B tactiques restent lisibles. Le mélange est un finaliseur
// murmur3 (mix32) sur des entiers 32 bits exacts (Math.imul, jamais de flottant) — « dans le style » Philox / Squares, à
// passer sur PractRand avant de le tenir pour acquis (le contrat d'appel seul compte, l'algorithme est remplaçable).
export const FLUX = { passe: 1, tir: 2, duel: 3, perception: 4, geste: 5, arbitre: 6, intention: 7, cpa: 8 };
export function mix32(x) {
  x ^= x >>> 16; x = Math.imul(x, 0x85ebca6b);
  x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16; return x >>> 0;
}
export function draw(seed, s, tick, entity, k) {
  let h = seed >>> 0;
  h = mix32(h ^ Math.imul(s, 0x9e3779b9));
  h = mix32(h ^ Math.imul(tick, 0x85ebca6b));
  h = mix32(h ^ Math.imul(entity, 0xc2b2ae35));
  h = mix32(h ^ Math.imul(k, 0x27d4eb2f));
  return h / 4294967296;
}
/** Le tirage NOMMÉ d'un sous-système pour une entité : sous cfg.flux (st._flux posé par matchStep : graine, tick physique,
 *  compteur k par (flux, entité) remis à zéro chaque pas), une fonction pure de coordonnées ; sinon `hier` — le flux
 *  séquentiel d'hier, au bit. */
export function tirage(st, nom, entite, hier) {
  const F = st._flux; if (!F) return hier;
  const e = entite ?? 99, key = nom + ':' + e, s = FLUX[nom] ?? 9;
  return () => { const k = F.k.get(key) ?? 0; F.k.set(key, k + 1); return draw(F.seed, s, F.tick, e, k); };
}
