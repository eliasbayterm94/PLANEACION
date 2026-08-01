/**
 * model.js — Single source of truth for the 2027 planning model.
 *
 * RULE: no view, no data file, and no component may hardcode a phase month.
 * Regions declare ONLY their harvest months (+ optional transit override).
 * Everything downstream — cutoff, shipping, delivery, samples, campaign —
 * is derived here. This is what prevented the five schedule inconsistencies
 * that existed in the original single-file prototype.
 */

export const YEAR = 2027;

/** Conversion factor: one container of green coffee = this many kilograms.
 *  Goals are set in kg; allocations are captured in containers. */
export const KG_PER_CONTAINER = 17500;

export const MONTHS = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
];

// ---------------------------------------------------------------------------
// Offsets, in months. Change these and the whole calendar recalculates.
// ---------------------------------------------------------------------------
export const OFFSETS = {
  cosechaToCorte: 1,     // harvest month -> commercial cutoff
  corteToDespacho: 1,    // cutoff -> vessel departure
  despachoToEntrega: 1,  // default ocean transit; per-region override via `transitMonths`
  corteToMuestra: -1,    // type samples land 1 month BEFORE the cutoff
};

/** Cutoffs always fall on the 15th. */
export const CUTOFF_DAY = 15;

/**
 * Campaign windows, defined by CUTOFF month — not by region.
 * A region can feed the tail of one campaign and the body of the next
 * (Huila Sur does exactly this), so campaign is a property of the cutoff.
 *
 * NOTE FOR ELIAS: confirm this naming. Campaign 1 = main crop (Oct-Ene
 * cutoffs), Campaign 2 = mitaca/traviesa (Jun-Sep cutoffs). The original
 * prototype's footer used this convention; its `regions` array used the
 * inverse. Flip `cutoffMonths` below if the intended meaning is reversed.
 */
// Colours follow the Forest design system closed palette (design system rule 6):
// Campaña 1 (main crop) = brand yellow, Campaña 2 (mitaca) = brand blue.
export const CAMPAIGNS = {
  1: { name: 'Campaña 1', cutoffMonths: [9, 10, 11, 0], color: '#e7e244' },
  2: { name: 'Campaña 2', cutoffMonths: [5, 6, 7, 8], color: '#95b5ce' },
};

/** Months in which nothing lands anywhere. Complement of the delivery calendar. */
export const NO_ARRIVAL_MONTHS = [3, 4, 5, 6]; // Abr, May, Jun, Jul

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
export const mod12 = (n) => ((n % 12) + 12) % 12;
export const shift = (months, by) => months.map((m) => mod12(m + by));
export const monthName = (i) => MONTHS[mod12(i)];
export const monthList = (arr) => (arr && arr.length ? arr.map(monthName).join(', ') : '—');

/** Total months from cutoff to landing, for a given transit. */
export const corteToEntrega = (transit = OFFSETS.despachoToEntrega) =>
  OFFSETS.corteToDespacho + transit;

// ---------------------------------------------------------------------------
// Region schedule derivation
// ---------------------------------------------------------------------------
/**
 * Build a full schedule from a region's harvest declaration.
 *
 * region.corteMode:
 *   'wave'   (default) — each harvest month produces its own cutoff wave
 *   'single'           — one cutoff after the whole harvest closes (Rwanda)
 */
export function buildSchedule(region) {
  const transit = region.transitMonths ?? OFFSETS.despachoToEntrega;
  const mode = region.corteMode ?? 'wave';

  const corte =
    mode === 'single'
      ? [mod12(region.cosecha[region.cosecha.length - 1] + OFFSETS.cosechaToCorte)]
      : shift(region.cosecha, OFFSETS.cosechaToCorte);

  const despacho = shift(corte, OFFSETS.corteToDespacho);
  const entrega = shift(despacho, transit);
  const muestra = shift(corte, OFFSETS.corteToMuestra);

  return { ...region, corte, despacho, entrega, muestra, transitMonths: transit, corteMode: mode };
}

export function buildSchedules(regions) {
  return regions.map(buildSchedule);
}

/** Which campaign a given cutoff month belongs to. */
export function campaignOfMonth(m) {
  const hit = Object.entries(CAMPAIGNS).find(([, c]) => c.cutoffMonths.includes(mod12(m)));
  return hit ? Number(hit[0]) : null;
}

/** A region's dominant campaign — for grouping and colour only, never for logic. */
export function primaryCampaign(schedule) {
  const counts = {};
  schedule.corte.forEach((m) => {
    const c = campaignOfMonth(m);
    if (c) counts[c] = (counts[c] || 0) + 1;
  });
  const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return ranked.length ? Number(ranked[0][0]) : null;
}

// ---------------------------------------------------------------------------
// Warehouses — destination lead time drives arrival timing
// ---------------------------------------------------------------------------
/**
 * Lead time (months, despacho -> landing) of a market's primary warehouse, or
 * null when the market has no warehouse configured.
 * @param cfg  { primary: string|null, warehouses: [{ name, lead }] }
 */
export function warehousePrimaryLead(cfg) {
  if (!cfg || !cfg.primary || !Array.isArray(cfg.warehouses)) return null;
  const w = cfg.warehouses.find((x) => x.name === cfg.primary);
  const lead = w ? Number(w.lead) : NaN;
  return Number.isFinite(lead) ? lead : null;
}

/**
 * Extra transit months beyond the 1-month base Colombia lane, for a market.
 * Driven by the primary warehouse lead time when present (rounded to a whole
 * month for the calendar grid), falling back to the static `arrivalDelay`.
 */
export function marketArrivalDelay(market, cfg) {
  const lead = warehousePrimaryLead(cfg);
  if (lead != null) return Math.max(0, Math.round(lead) - OFFSETS.despachoToEntrega);
  return market.arrivalDelay || 0;
}

// ---------------------------------------------------------------------------
// Shipments — warehouse-level allocation (the real salidas/llegadas plan)
// ---------------------------------------------------------------------------
/**
 * Shipments are captured on the ORIGIN side, per region, per warehouse, per
 * month (containers). Arrival is derived from the warehouse lead time, so both
 * the departure (salida) and the landing (llegada) are visible. This is
 * independent of the derived cosecha calendar, which stays informational.
 *
 * Per-region shape:  { goals: { whName: kg }, ship: { whName: { monthIdx: containers } } }
 */

/** name -> { lead, market } across every market's warehouses. */
export function warehouseLeadLookup(warehousesByMarket = {}) {
  const map = {};
  Object.entries(warehousesByMarket).forEach(([market, cfg]) => {
    (cfg?.warehouses || []).forEach((w) => {
      map[w.name] = { lead: Number(w.lead) || 0, market };
    });
  });
  return map;
}

/** Flat list of every warehouse with its market, for pickers. */
export function listWarehouses(warehousesByMarket = {}, markets = []) {
  const out = [];
  markets.forEach((m) => {
    (warehousesByMarket[m.slug]?.warehouses || []).forEach((w) => {
      out.push({ market: m.slug, marketName: m.name, name: w.name, lead: Number(w.lead) || 0 });
    });
  });
  return out;
}

/** Landing month for a departure, using the (rounded) warehouse lead. */
export const shipmentArrival = (month, lead) => mod12(Number(month) + Math.round(Number(lead) || 0));

/** Salidas / llegadas by month + total containers for one region's shipments. */
export function regionShipmentSummary(regionShip, leadLookup = {}) {
  const salidas = new Array(12).fill(0);
  const llegadas = new Array(12).fill(0);
  let allocated = 0;
  const ship = regionShip?.ship || {};
  Object.entries(ship).forEach(([wh, months]) => {
    const lead = leadLookup[wh]?.lead ?? OFFSETS.despachoToEntrega;
    Object.entries(months || {}).forEach(([m, n]) => {
      const c = Number(n) || 0;
      if (!c) return;
      salidas[mod12(Number(m))] += c;
      llegadas[shipmentArrival(m, lead)] += c;
      allocated += c;
    });
  });
  return { salidas, llegadas, allocated };
}

/** Containers allocated by one region to one warehouse. */
export function warehouseAllocated(regionShip, whName) {
  const months = regionShip?.ship?.[whName] || {};
  return Object.values(months).reduce((a, b) => a + (Number(b) || 0), 0);
}

/** Arrivals by month + total containers landing in a market, from ALL regions'
 *  shipments to that market's warehouses. */
export function marketShipmentArrivals(shipmentsByRegion = {}, leadLookup = {}, marketSlug) {
  const llegadas = new Array(12).fill(0);
  let allocated = 0;
  Object.values(shipmentsByRegion).forEach((rs) => {
    Object.entries(rs?.ship || {}).forEach(([wh, months]) => {
      const info = leadLookup[wh];
      if (!info || info.market !== marketSlug) return;
      Object.entries(months || {}).forEach(([m, n]) => {
        const c = Number(n) || 0;
        if (!c) return;
        llegadas[shipmentArrival(m, info.lead)] += c;
        allocated += c;
      });
    });
  });
  return { llegadas, allocated };
}

/** kg <-> container helpers. */
export const containersToKg = (c) => (Number(c) || 0) * KG_PER_CONTAINER;
export const kgToContainers = (kg) => (Number(kg) || 0) / KG_PER_CONTAINER;

// ---------------------------------------------------------------------------
// Goals — kg targets by category, and the country-level MIRC target
// ---------------------------------------------------------------------------
/** The two macro categories every region goal is split into. */
export const GOAL_CATEGORIES = [
  { key: 'community', name: 'Community' },
  { key: 'mirc', name: 'MIRC' },
];

/**
 * Goals shape:
 *   { markets:    { marketSlug: { community, mirc } }, // by SALES region (demand)
 *     warehouses: { whName:     { community, mirc } }, // for markets entered by warehouse (Europa)
 *     countriesMIRC: { country: kg } }                 // MIRC by PRODUCING country
 * Community/MIRC targets live on the sales region (market), or per warehouse when
 * the market has `goalsByWarehouse`. The MIRC country target lives on the
 * producing country (region.country).
 */
export const emptyGoals = () => ({ markets: {}, warehouses: {}, countriesMIRC: {} });

/** Distinct producing countries, in declaration order. */
export function listCountries(regions = []) {
  const seen = [];
  regions.forEach((r) => { if (r.country && !seen.includes(r.country)) seen.push(r.country); });
  return seen;
}

/** kg goal for a sales region (market) in one category. */
export function marketGoal(goals, marketSlug, category) {
  return Number(goals?.markets?.[marketSlug]?.[category]) || 0;
}

/** Total kg goal (community + mirc) for a sales region. */
export function marketGoalTotal(goals, marketSlug) {
  return marketGoal(goals, marketSlug, 'community') + marketGoal(goals, marketSlug, 'mirc');
}

/** kg goal for a warehouse (markets entered by warehouse, e.g. Europa). */
export function warehouseGoal(goals, whName, category) {
  return Number(goals?.warehouses?.[whName]?.[category]) || 0;
}

export function warehouseGoalTotal(goals, whName) {
  return warehouseGoal(goals, whName, 'community') + warehouseGoal(goals, whName, 'mirc');
}

/** Containers landing in one warehouse, across all regions' shipments. */
export function warehouseAllocatedAll(shipments, whName) {
  return Object.values(shipments || {}).reduce((s, rs) => s + warehouseAllocated(rs, whName), 0);
}

/** Containers shipped from a producing country's regions (all warehouses). */
export function countrySalidas(shipments, regions, country, leadLookup) {
  return regions
    .filter((r) => r.country === country)
    .reduce((sum, r) => sum + regionShipmentSummary(shipments[r.slug], leadLookup).allocated, 0);
}

// ---------------------------------------------------------------------------
// Market chains
// ---------------------------------------------------------------------------
/**
 * For a market, build the chain of cutoff -> landing.
 *
 * The extra transit delay (MENA / AU, or any market whose primary warehouse
 * lands later) is applied to BOTH the landing month and the label shown on the
 * cutoff cell. In the original prototype it was applied only to the arrivals
 * row, so those cutoff cells advertised a landing month one month early.
 *
 * @param cfg  optional warehouse config; its primary lead overrides arrivalDelay
 */
export function marketChains(market, cfg) {
  const delay = marketArrivalDelay(market, cfg);
  const lead = corteToEntrega();
  const chains = [];

  for (let base = 0; base < 12; base++) {
    if (NO_ARRIVAL_MONTHS.includes(base)) continue;
    const corteMonth = mod12(base - lead);
    chains.push({
      corteMonth,
      muestraMonth: mod12(corteMonth + OFFSETS.corteToMuestra),
      despachoMonth: mod12(corteMonth + OFFSETS.corteToDespacho),
      arrivalMonth: mod12(base + delay),
      campaign: campaignOfMonth(corteMonth),
    });
  }
  return chains;
}

/** Index a market's chains by the month the cutoff happens. */
export function chainsByCorte(market, cfg) {
  const map = {};
  marketChains(market, cfg).forEach((c) => { map[c.corteMonth] = c; });
  return map;
}

// ---------------------------------------------------------------------------
// Reconciliation — supply (origin) vs demand (destination)
// ---------------------------------------------------------------------------
/**
 * The control that did not exist before: region shipments and market arrivals
 * were two independent number sets that could silently diverge.
 *
 * @param schedules  derived region schedules
 * @param regionQty  { slug: { monthIndex: containers } }  entered on the shipping row
 * @param markets    market definitions
 * @param marketQty  { slug: { monthIndex: containers } }  entered on the cutoff row
 * @returns { byMonth: [{ month, supply, demand, delta }], totals }
 */
export function reconcile(schedules, regionQty, markets, marketQty, warehouses = {}) {
  const supply = new Array(12).fill(0);
  const demand = new Array(12).fill(0);

  schedules.forEach((r) => {
    const q = regionQty[r.slug] || {};
    r.despacho.forEach((m) => {
      const n = Number(q[m]) || 0;
      if (n) supply[mod12(m + r.transitMonths)] += n;
    });
  });

  markets.forEach((mk) => {
    const q = marketQty[mk.slug] || {};
    const chains = chainsByCorte(mk, warehouses[mk.slug]);
    Object.entries(chains).forEach(([corteMonth, chain]) => {
      const n = Number(q[corteMonth]) || 0;
      if (n) demand[chain.arrivalMonth] += n;
    });
  });

  const byMonth = supply.map((s, i) => ({
    month: i,
    supply: s,
    demand: demand[i],
    delta: s - demand[i],
  }));

  return {
    byMonth,
    totals: {
      supply: supply.reduce((a, b) => a + b, 0),
      demand: demand.reduce((a, b) => a + b, 0),
    },
  };
}

/** Annual target vs allocated, per market. */
export function marketProgress(market, marketQty) {
  const q = marketQty[market.slug] || {};
  const allocated = Object.values(q).reduce((a, b) => a + (Number(b) || 0), 0);
  return {
    target: market.target,
    allocated,
    remaining: market.target - allocated,
    over: allocated > market.target,
  };
}
