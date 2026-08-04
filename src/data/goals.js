/**
 * goals.js — Seed kg goals per sales region (market), loaded on demand from the
 * Metas tab ("Cargar metas de mercado"). Merged into the current goals so it
 * never wipes other axes (company total, MIRC by country, other warehouses).
 *
 * Europa is entered PER WAREHOUSE (Rotterdam, UK), so its market total is seeded
 * on the primary warehouse (Rotterdam); split part to UK in the Metas tab if
 * needed.
 */

/** { marketSlug: { mirc, community } } — direct market-level goals. */
export const defaultMarketGoals = {
  usa: { mirc: 142650, community: 583793 },
  mena: { mirc: 75150, community: 45314 },
  au: { mirc: 41850, community: 138926 },
};

/** { warehouseName: { mirc, community } } — Europa (by warehouse) on Rotterdam. */
export const defaultWarehouseGoals = {
  Rotterdam: { mirc: 190350, community: 352583 },
};
