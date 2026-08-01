/**
 * markets.js — Destination declarations.
 *
 * `target`       annual container goal
 * `arrivalDelay` extra transit months beyond the standard Colombia lane
 */

export const markets = [
  { slug: 'usa',    name: 'USA',    target: 35, arrivalDelay: 0 },
  { slug: 'europa', name: 'Europa', target: 35, arrivalDelay: 0 },
  { slug: 'uk',     name: 'UK',     target: 5,  arrivalDelay: 0 },
  { slug: 'mena',   name: 'MENA',   target: 10, arrivalDelay: 1 },
  { slug: 'au',     name: 'AU',     target: 10, arrivalDelay: 1 },
];

export const ANNUAL_TARGET = markets.reduce((sum, m) => sum + m.target, 0);
