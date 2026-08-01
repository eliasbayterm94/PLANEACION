/**
 * markets.js — Destination declarations.
 *
 * `target`       annual container goal
 * `arrivalDelay` extra transit months beyond the standard Colombia lane
 */

// UK is not a separate market: it is delivered under Europa (via the UK
// warehouse in warehouses.js). Its volume is folded into Europa's target.
//
// `goalsByWarehouse`: Metas are entered per warehouse for this market instead of
// a single market-level goal. Europa splits into Rotterdam / UK.
export const markets = [
  { slug: 'usa',    name: 'USA',    target: 35, arrivalDelay: 0 },
  { slug: 'europa', name: 'Europa', target: 40, arrivalDelay: 0, goalsByWarehouse: true },
  { slug: 'mena',   name: 'MENA',   target: 10, arrivalDelay: 1 },
  { slug: 'au',     name: 'AU',     target: 10, arrivalDelay: 1 },
];

export const ANNUAL_TARGET = markets.reduce((sum, m) => sum + m.target, 0);
