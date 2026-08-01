/**
 * warehouses.js — Destination warehouses per market (seed defaults).
 *
 * Each market can deliver into several named warehouses, each with its own
 * lead time (months from vessel departure / despacho to landing). The market's
 * PRIMARY warehouse drives the arrival timing in the plan; the rest are captured
 * for reference and future per-warehouse allocation.
 *
 * These are only the defaults. The "Bodegas" tab edits them and persists the
 * result (scope 'warehouse', one row per market), so the seed is what the app
 * shows before anyone edits.
 *
 * `lead` is in months and may be fractional (e.g. Annex = 1.5). The monthly
 * planning grid rounds it to the nearest whole month; the exact value is kept
 * as the source of truth.
 */
export const defaultWarehouses = {
  usa: {
    primary: 'NJ',
    warehouses: [
      { name: 'NJ', lead: 1 },
      { name: 'Annex', lead: 1.5 },
      { name: 'Dupuy', lead: 1 },
      { name: 'GBH', lead: 1 },
    ],
  },
  europa: {
    primary: 'Rotterdam',
    warehouses: [
      { name: 'Rotterdam', lead: 1 },
      { name: 'UK', lead: 1 },
    ],
  },
  au: {
    primary: 'Melbourne',
    warehouses: [{ name: 'Melbourne', lead: 2 }],
  },
  mena: {
    primary: 'Dubai',
    warehouses: [{ name: 'Dubai', lead: 2 }],
  },
  uk: {
    primary: null,
    warehouses: [],
  },
};

/** A blank config for a market with no warehouses yet. */
export const emptyWarehouseConfig = () => ({ primary: null, warehouses: [] });
