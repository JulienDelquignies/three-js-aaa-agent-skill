// dealership — the car dealership's CATALOGUE as derived data (no prices typed per scene): which
// models are on display and at what price follows the CLUB LEVEL — the showcase supercar appears
// from level 3 (window-shopping) and becomes affordable at level 4. checkCatalog() is the contract:
// prices strictly ascending, unique ids, at least one model affordable with the DS's personal cash,
// every model has display colors. Pure data — the 3D (podiums, paint) lives in the scene.
const MODELS = [
  { kind: 'citadine', name: 'Citadine GO', price: 16, minLevel: 1 },
  { kind: 'berline', name: 'Berline GT', price: 42, minLevel: 1 },
  { kind: 'suv', name: 'SUV Prestige', price: 90, minLevel: 2 },
  { kind: 'gt', name: 'GT Corsa', price: 240, minLevel: 2 },                 // the meshkit-lofted coupé
  { kind: 'ferrari', name: 'Ferrari 458 Italia', price: 690, minLevel: 3 },   // three.js demo model (CC-BY vicent091036)
];
const COLORS = [0xb3252f, 0x14161a, 0xe8eaee, 0x1f3a93, 0xd4af37, 0x0b6e4f];

export function makeCatalog({ level = 1 } = {}) {
  return MODELS.filter((m) => level >= m.minLevel).map((m) => ({ ...m, colors: [...COLORS] }));
}

/** The dealership contract — run after generation AND after any manual patch of the catalogue. */
export function checkCatalog(catalog, state) {
  const issues = [];
  if (catalog.length < 2) issues.push('catalogue too small (fewer than 2 models)');
  for (let i = 1; i < catalog.length; i++) if (catalog[i].price <= catalog[i - 1].price) issues.push('prices not strictly ascending');
  if (new Set(catalog.map((m) => m.kind)).size !== catalog.length) issues.push('duplicate model in the catalogue');
  if (state && !catalog.some((m) => m.price <= state.cash)) issues.push('nothing affordable with the DS cash');
  for (const m of catalog) if (!m.colors?.length) issues.push(`${m.kind}: no display colors`);
  return { ok: issues.length === 0, issues };
}
