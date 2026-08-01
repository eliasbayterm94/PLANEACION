/**
 * regions.js — Origin declarations.
 *
 * Declare ONLY what is observed at origin: harvest months, and transit if it
 * differs from the default. Cutoff / shipping / delivery / samples / campaign
 * are derived in model.js. Do not add them here.
 *
 * Month indices are 0-based: 0 = Ene ... 11 = Dic.
 *
 * Colours are light tints from the Forest design system closed palette so cells
 * stay legible with dark ink text. Region identity is carried by the row label;
 * colour is a secondary distinguisher only.
 */

export const regions = [
  {
    slug: 'tolima-traviesa',
    name: 'Tolima (traviesa)',
    color: '#e7e244', // yellow
    cosecha: [4, 5, 6], // May, Jun, Jul
  },
  {
    slug: 'huila-norte',
    name: 'Huila Norte',
    color: '#c7d8e6', // blue-200
    cosecha: [4, 5, 6],
  },
  {
    slug: 'narino',
    name: 'Nariño',
    color: '#95b5ce', // blue
    cosecha: [4, 5, 6, 7], // May–Ago
  },
  {
    slug: 'rwanda',
    name: 'Rwanda',
    color: '#c9c422', // yellow-600
    cosecha: [2, 3, 4, 5], // Mar–Jun
    corteMode: 'single',   // one cutoff once the harvest closes, not a wave per month
    transitMonths: 2,      // longer transit from East Africa
  },
  {
    slug: 'huila-sur',
    name: 'Huila Sur',
    color: '#f5f08a', // yellow-200
    cosecha: [7, 8, 9, 10, 11], // Ago–Dic
  },
  {
    slug: 'tolima-full',
    name: 'Tolima Full',
    color: '#e6eef5', // blue-100
    cosecha: [9, 10], // Oct, Nov
  },
];
