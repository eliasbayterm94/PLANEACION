/**
 * embarques.js — "Calendario de EMBARQUE" seed: containers per warehouse per
 * month (month index 0 = Ene … 11 = Dic). Loaded into Programación de salidas
 * (producing country Colombia) from a button; totals 77 containers.
 *
 * Only non-zero months are listed. The Flujo view places Oct–Dic despachos in
 * the operative year (2026) and the rest in the sales year (2027).
 */
export const embarqueSeed = {
  NJ: { 0: 1, 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 2, 7: 1, 8: 1, 9: 2, 10: 1, 11: 1 }, // 14
  Annex: { 0: 1, 1: 1, 4: 1, 5: 1, 6: 1, 7: 1, 8: 1, 9: 1, 10: 1, 11: 1 }, // 10
  Dupuy: { 0: 1, 1: 1, 4: 1, 6: 1, 7: 1, 8: 1, 10: 1, 11: 1 }, // 8
  GBH: { 0: 1, 6: 1, 9: 1, 11: 1 }, // 4
  Rotterdam: { 0: 1, 1: 1, 2: 1, 3: 1, 4: 2, 5: 2, 6: 1, 7: 2, 8: 2, 9: 2, 10: 2, 11: 2 }, // 19
  UK: { 1: 1, 4: 1, 6: 1, 7: 1, 9: 1, 11: 1 }, // 6
  Dubai: { 1: 1, 3: 1, 5: 1, 6: 1, 9: 1, 10: 1, 11: 1 }, // 7
  Melbourne: { 1: 1, 3: 1, 4: 1, 5: 1, 6: 1, 8: 1, 9: 1, 10: 1, 11: 1 }, // 9
};
