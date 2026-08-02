/**
 * catalog.js — Editable product catalogue seeds.
 *
 * The catalogue (categories, cutoff months per campaign, and products) is edited
 * in the "Gestionar productos" modal and persisted (scope `catalog`). These are
 * only the defaults shown before anyone edits.
 *
 * A product declares its CATEGORY (one) and its START cutoff (`startCorte`, a
 * month index) — the corte it becomes available from, tied to production. Its
 * campaign and colour derive from that cutoff. Categories can be applied in bulk
 * (select several products, apply one category) from the modal.
 */
import { productReleases } from './products.js';

/** MIRC breaks into these; Community is the other macro. */
export const defaultCategories = [
  { key: 'community', name: 'Community', macro: 'community' },
  { key: 'microlot', name: 'Microlot', macro: 'mirc' },
  { key: 'innovation', name: 'Innovation', macro: 'mirc' },
  { key: 'reserve', name: 'Reserve', macro: 'mirc' },
  { key: 'competition', name: 'Competition', macro: 'mirc' },
];

/** Cutoff months per campaign (seed = current model). */
export const defaultCortes = {
  1: [9, 10, 11, 0], // Oct, Nov, Dic, Ene
  2: [5, 6, 7, 8], // Jun, Jul, Ago, Sep
};

/** Products flattened from the release catalogue; category starts unset. */
export const defaultProducts = productReleases.flatMap((r) =>
  r.items.map((name) => ({
    id: `${r.cutoffMonth}::${name}`,
    name,
    category: '', // one category — assign (in bulk) from the modal
    startCorte: r.cutoffMonth,
  })),
);

export const emptyCatalog = () => ({
  categories: defaultCategories.map((c) => ({ ...c })),
  cortes: { 1: [...defaultCortes[1]], 2: [...defaultCortes[2]] },
  products: defaultProducts.map((p) => ({ ...p })),
});
