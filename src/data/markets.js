/**
 * markets.js — Destination declarations.
 *
 * `target`       annual container goal
 * `arrivalDelay` extra transit months beyond the standard Colombia lane
 */

// UK is not a separate market: it is delivered under Europa (via the UK
// warehouse in warehouses.js). Its volume is folded into Europa's target.
export const markets = [
  { slug: 'usa',    name: 'USA',    target: 35, arrivalDelay: 0 },
  { slug: 'europa', name: 'Europa', target: 40, arrivalDelay: 0 },
  { slug: 'mena',   name: 'MENA',   target: 10, arrivalDelay: 1 },
  { slug: 'au',     name: 'AU',     target: 10, arrivalDelay: 1 },
];

export const ANNUAL_TARGET = markets.reduce((sum, m) => sum + m.target, 0);
