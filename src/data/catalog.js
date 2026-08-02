/**
 * catalog.js — Editable product catalogue seeds.
 *
 * The catalogue (categories, cutoff months per campaign, products, and pools) is
 * edited in the "Gestionar productos" modal and persisted (scope `catalog`).
 * These are the defaults — the authoritative 2027 release list — shown before
 * (and restored by "Cargar catálogo base") anyone edits.
 *
 * A product declares its CATEGORY (one) and its START cutoff (`startCorte`, a
 * month index) — the corte it becomes available from, tied to production. Its
 * campaign and colour derive from that cutoff. A product may belong to one POOL
 * (products sold together against one combined meta).
 */

/** MIRC breaks into these; Community is the other macro. */
export const defaultCategories = [
  { key: 'community', name: 'Community', macro: 'community' },
  { key: 'microlot', name: 'Microlot', macro: 'mirc' },
  { key: 'innovation', name: 'Innovation', macro: 'mirc' },
  { key: 'reserve', name: 'Reserve', macro: 'mirc' },
  { key: 'competition', name: 'Competition', macro: 'mirc' },
];

/**
 * Cutoff months per campaign.
 * Campaña 1 = mitaca (Jun–Sep, the smaller crop).
 * Campaña 2 = cosecha principal (Oct–Ene, the larger one in kg).
 */
export const defaultCortes = {
  1: [5, 6, 7, 8], // Jun, Jul, Ago, Sep  → primer, segundo, tercer, cuarto
  2: [9, 10, 11, 0], // Oct, Nov, Dic, Ene  → primer, segundo, tercer, cuarto
};

// Pools group products sold together against one combined kg meta, per campaign.
// POOL_MITACA = Jun–Sep Innovation pool (Campaña 1); POOL_PRINCIPAL = Oct–Ene
// Innovation pool (Campaña 2), the larger one.
const POOL_MITACA = 'pool_mitaca';
const POOL_PRINCIPAL = 'pool_principal';

export const defaultPools = [
  { id: POOL_MITACA, name: 'Pool Innovation Campaña 1', campaign: 1, meta: 106220 },
  { id: POOL_PRINCIPAL, name: 'Pool Innovation Campaña 2', campaign: 2, meta: 184420 },
];

/**
 * 2027 release list from the planning sheet (see the two campaign photos).
 * Rows: [name, category, startCorte (month index), pool id].
 * Campaña 2 (principal) cortes: primer=Oct(9), segundo=Nov(10), tercer=Dic(11), cuarto=Ene(0).
 * Campaña 1 (mitaca) cortes: primer=Jun(5), segundo=Jul(6), tercer=Ago(7), cuarto=Sep(8).
 */
const seedRows = [
  // ---- Campaña 2 — cosecha principal (Autumn / Christmas), ~300.000 kg ------
  // Microlots
  ['Guava Banana', 'microlot', 9, ''],
  ['Natural Guamo', 'microlot', 9, ''],
  ['Pink Volcano', 'microlot', 9, ''],
  ['Pink Borbon Punch', 'microlot', 10, ''],
  ['Wush Wush Vergel', 'microlot', 10, ''],
  ['Pink Honey', 'microlot', 10, ''],
  ['Honey Mountain', 'microlot', 11, ''],
  ['Papayo Paradise', 'microlot', 11, ''],
  ['Decaf Natural', 'microlot', 11, ''],
  ['Vergel Temp Natural BF8', 'microlot', 11, ''],
  ['Vergel Washed Mosto Anaerobic', 'microlot', 11, ''],
  ['Vergel River Natural BF1', 'microlot', 11, ''],
  ['Vergel Natural Anaerobic Twist', 'microlot', 11, ''],
  // Reserve
  ['Papayo Jungle', 'reserve', 0, ''],
  ['Vergel Reserve', 'reserve', 0, ''],
  // Innovation (sueltos)
  ['Guava Koji', 'innovation', 0, ''],
  ['Sidra Koji', 'innovation', 0, ''],
  ['Rocket Flower', 'innovation', 0, ''],
  ['Magnum Sidra', 'innovation', 0, ''],
  // Innovation — Pool Campaña 2 / principal (meta combinada 184.420 kg)
  ['Vanilla Heaven', 'innovation', 11, POOL_PRINCIPAL],
  ['Cinnamon', 'innovation', 0, POOL_PRINCIPAL],
  ['Christmas #1 Special Edition', 'innovation', 0, POOL_PRINCIPAL],
  ['Christmas #2 Special Edition', 'innovation', 0, POOL_PRINCIPAL],
  ['Sunrise Pocket', 'innovation', 0, POOL_PRINCIPAL],
  ['Galactic Crumble', 'innovation', 9, POOL_PRINCIPAL],
  ['Apple Explosion', 'innovation', 9, POOL_PRINCIPAL],
  ['Juicy Strawberry', 'innovation', 9, POOL_PRINCIPAL],
  ['Juicy Grape', 'innovation', 9, POOL_PRINCIPAL],
  ['NEW CRAZY INFUSED', 'innovation', 11, POOL_PRINCIPAL],

  // ---- Campaña 1 — mitaca (Spring / Summer), ~200.000 kg -------------------
  // Microlots
  ['Bubble Gum', 'microlot', 5, ''],
  ['Decaf Natural', 'microlot', 5, ''],
  ['Guava Banana', 'microlot', 5, ''],
  ['Papayo Vergel Honey', 'microlot', 6, ''],
  ['Papayo Vergel Natural Nuevo', 'microlot', 6, ''],
  ['Typica Lavado / Varietal Lavado', 'microlot', 6, ''],
  ['Wild Caturron', 'microlot', 7, ''],
  ['Pink Borbon Creation', 'microlot', 7, ''],
  ['Gesha Willow', 'microlot', 7, ''],
  ['Chiroso San Carlos', 'microlot', 8, ''],
  ['Chiroso Carmen Montoya', 'microlot', 8, ''],
  ['Chiroso Honey', 'microlot', 8, ''],
  ['Chiroso Natural', 'microlot', 8, ''],
  ['Ceiba Honey', 'microlot', 8, ''],
  ['Vergel Cold Temp Natural BF7', 'microlot', 8, ''],
  ['Vergel Dual Temp Natural', 'microlot', 8, ''],
  ['Vergel Honey Anaerobic Twist', 'microlot', 8, ''],
  ['Vergel Washed Anaerobic Twist', 'microlot', 8, ''],
  // Innovation (sueltos)
  ['Pink Koji', 'innovation', 7, ''],
  ['Java Koji', 'innovation', 7, ''],
  // Reserve (corte en blanco en la hoja → primer corte por defecto)
  ['Vergel Reserve', 'reserve', 5, ''],
  // Innovation — Pool Campaña 1 / mitaca (meta combinada 106.220 kg; cortes en blanco → primer corte)
  ['Red Symphony', 'innovation', 5, POOL_MITACA],
  ['Juicy Grape', 'innovation', 5, POOL_MITACA],
  ['Juicy Passion Fruit', 'innovation', 5, POOL_MITACA],
  ['Juicy Strawberry', 'innovation', 5, POOL_MITACA],
  ['Tropical Splash', 'innovation', 5, POOL_MITACA],
  ['Kiwilu', 'innovation', 5, POOL_MITACA],
  ['Vergel Flowers', 'innovation', 6, POOL_MITACA],
  ['Galactic Crumble', 'innovation', 5, POOL_MITACA],
  ['Candy Blast', 'innovation', 5, POOL_MITACA],
  ['Sumer Waves', 'innovation', 5, POOL_MITACA],
  ['Pinneapple Ride', 'innovation', 5, POOL_MITACA],
];

/** Products flattened from the release list; id = `${startCorte}::${name}`. */
export const defaultProducts = seedRows.map(([name, category, startCorte, pool]) => ({
  id: `${startCorte}::${name}`,
  name,
  category,
  pool,
  startCorte,
}));

export const emptyCatalog = () => ({
  categories: defaultCategories.map((c) => ({ ...c })),
  cortes: { 1: [...defaultCortes[1]], 2: [...defaultCortes[2]] },
  pools: defaultPools.map((p) => ({ ...p })),
  products: defaultProducts.map((p) => ({ ...p })),
});
