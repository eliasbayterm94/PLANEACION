/**
 * products.js — Catalogue released at each cutoff.
 *
 * `cutoffMonth` is the month index of the cutoff (always day 15).
 * Sample availability is derived in model.js (cutoff - 1 month).
 * Campaign is derived from the cutoff month — do not tag it here.
 */

export const productReleases = [
  // --- Cutoffs Oct / Nov / Dic / Ene -------------------------------------
  {
    cutoffMonth: 9, // Oct 15
    items: [
      'Bubble Gum', 'Decaf Natural', 'Guava Banana', 'Papayo Vergel Honey',
      'Papayo Vergel Natural Nuevo', 'Typica Washed / Varietal Washed',
    ],
  },
  {
    cutoffMonth: 9,
    label: 'Flavors Recommended',
    items: [
      'Galactic Crumble', 'Candy Blast', 'Summer Waves', 'Pineapple Ride',
      'Juicy Grape', 'Juicy Passion Fruit', 'Juicy Strawberry',
      'Tropical Splash', 'Kiwilu',
    ],
  },
  {
    cutoffMonth: 10, // Nov 15
    items: ['Wild Caturron', 'Pink Bourbon Creation', 'Ceiba Honey', 'Gesha Willow'],
  },
  {
    cutoffMonth: 11, // Dic 15
    items: [
      'Vergel Cold Temp Natural BF7', 'Vergel Dual Temp Natural',
      'Vergel Honey Anaerobic Twist', 'Vergel Washed Anaerobic Twist',
      'Pink Koji', 'Java Koji', 'Vergel Flowers',
    ],
  },
  {
    cutoffMonth: 0, // Ene 15
    items: [
      'Vergel Reserve', 'Chiroso San Carlos', 'Chiroso Carmen Montoya',
      'Chiroso Honey', 'Chiroso Natural',
    ],
  },

  // --- Cutoffs Jun / Jul / Ago / Sep -------------------------------------
  {
    cutoffMonth: 5, // Jun 15
    items: [
      'Guava Banana', 'Natural Guamo', 'Pink Volcano', 'Galactic Crumble',
      'Apple Explosion', 'Juicy Strawberry', 'Juicy Grape',
    ],
  },
  {
    cutoffMonth: 6, // Jul 15
    items: ['Pink Bourbon Punch', 'Wush Wush Vergel', 'Pink Honey'],
  },
  {
    cutoffMonth: 7, // Ago 15
    items: [
      'Honey Mountain', 'Papayo Paradise', 'Decaf Natural',
      'Vergel Temp Natural BF8', 'Vergel Washed Mosto Anaerobic',
      'Vergel River Natural BF1', 'Vergel Natural Anaerobic Twist',
      'Vanilla Heaven', 'New Crazy Infused',
    ],
  },
  {
    cutoffMonth: 8, // Sep 15
    items: [
      'Cinnamon', 'Christmas #1 Special Edition', 'Christmas #2 Special Edition',
      'Sunrise Pocket', 'Papayo Jungle', 'Vergel Reserve', 'Guava Koji',
      'Sidra Koji', 'Rocket Flower', 'Magnum Sidra',
    ],
  },
];
