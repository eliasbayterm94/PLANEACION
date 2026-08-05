/**
 * campaignWindows.js — Commercial campaign windows (the "Flujo" roadmap layer).
 *
 * A COMMERCIAL campaign = when coffee is available to sell at destination.
 * This is a SEPARATE layer from the product campaigns (mitaca/principal in
 * `model.js` CAMPAIGNS); it never changes the products. Editable in the
 * "Ventanas de campaña" tab, persisted as one row (scope `windows`, slug `plan`).
 *
 * Per campaign we store the CORTE months and the DISPONIBILIDAD (destination
 * availability) months; producción, trilla and despacho derive from the corte
 * via the offsets (despacho = corte + despachoOffset). Colours match the closed
 * palette (Campaña 1 = blue, Campaña 2 = yellow).
 */

export const defaultCampaignWindows = () => ({
  campaigns: {
    1: { name: 'Campaña 1', color: '#95b5ce', corte: [8, 9, 10, 11, 0, 1], disp: [0, 1, 2, 3, 4, 5] },
    2: { name: 'Campaña 2', color: '#e7e244', corte: [2, 3, 4, 5, 6, 7, 8], disp: [6, 7, 8, 9, 10, 11] },
  },
  despachoOffset: 2, // meses del corte al despacho (producción + trilla)
  outExtra: 1, // +meses de producción si el café es fuera de campaña
});

/** Coerce a persisted/partial windows object into the full shape. */
export function normalizeWindows(w) {
  const base = defaultCampaignWindows();
  if (!w || !w.campaigns) return base;
  [1, 2].forEach((c) => {
    const src = w.campaigns[c] || {};
    base.campaigns[c] = {
      name: src.name || base.campaigns[c].name,
      color: src.color || base.campaigns[c].color,
      corte: Array.isArray(src.corte) ? src.corte.slice() : base.campaigns[c].corte,
      disp: Array.isArray(src.disp) ? src.disp.slice() : base.campaigns[c].disp,
    };
  });
  base.despachoOffset = Number.isFinite(w.despachoOffset) ? w.despachoOffset : base.despachoOffset;
  base.outExtra = Number.isFinite(w.outExtra) ? w.outExtra : base.outExtra;
  return base;
}
