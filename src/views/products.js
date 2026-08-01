import {
  MONTHS, monthName, CUTOFF_DAY, OFFSETS, mod12,
  campaignOfMonth, CAMPAIGNS,
} from '../model.js';
import { productReleases } from '../data/products.js';

/**
 * Products view — what is released at each cutoff.
 * Sample availability is derived (cutoff - 1 month), not written per card,
 * so it can never drift from the market and region views.
 */
export function renderProducts({ campaign }) {
  const el = document.createElement('div');
  const releases = productReleases
    .filter((r) => campaignOfMonth(r.cutoffMonth) === campaign)
    .sort((a, b) => order(a.cutoffMonth, campaign) - order(b.cutoffMonth, campaign));

  const head = document.createElement('div');
  head.className = 'view-head';
  head.innerHTML = `
    <h2>Productos por corte — ${CAMPAIGNS[campaign].name}</h2>
    <p class="view-sub">
      Todo se vende desde el inicio de la campaña.
      Las muestras salen un mes antes de cada corte.
    </p>`;
  el.appendChild(head);

  const wrap = document.createElement('div');
  wrap.className = 'cards';

  releases.forEach((r, idx) => {
    const sampleMonth = mod12(r.cutoffMonth + OFFSETS.corteToMuestra);
    const card = document.createElement('article');
    card.className = 'card';
    card.style.setProperty('--accent', CAMPAIGNS[campaign].color);

    const h = document.createElement('header');
    h.className = 'card-head';
    h.innerHTML = `
      <span class="card-cut">Corte ${order(r.cutoffMonth, campaign)}${r.label ? ` · ${r.label}` : ''}</span>
      <span class="card-date">${monthName(r.cutoffMonth)} ${CUTOFF_DAY}</span>
      <span class="card-sample">Muestras desde ${monthName(sampleMonth)}</span>`;
    card.appendChild(h);

    const ul = document.createElement('ul');
    ul.className = 'card-list';
    r.items.forEach((item) => {
      const li = document.createElement('li');
      li.textContent = item;
      ul.appendChild(li);
    });
    card.appendChild(ul);
    wrap.appendChild(card);
  });

  el.appendChild(wrap);
  return el;
}

/** Cutoff ordinal within its campaign window. */
function order(month, campaign) {
  return CAMPAIGNS[campaign].cutoffMonths.indexOf(mod12(month)) + 1;
}
