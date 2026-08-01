import {
  MONTHS, primaryCampaign, CAMPAIGNS, mod12,
  regionShipmentSummary, marketShipmentArrivals, containersToKg, kgToContainers,
} from '../model.js';
import { downloadCSV } from '../store.js';

/**
 * Consolidated view — the whole plan from a single source: region shipments.
 *
 * Salidas (per region) and llegadas (per market, derived from each warehouse
 * lead) come from the same data, so origin and destination can no longer
 * silently diverge. What the view surfaces instead is allocated vs target.
 */
export function renderConsolidado({ schedules, markets, shipments, leadLookup }) {
  const el = document.createElement('div');

  const regionSummaries = schedules.map((s) => ({
    s, ...regionShipmentSummary(shipments[s.slug], leadLookup),
  }));
  const marketSummaries = markets.map((mk) => ({
    mk, ...marketShipmentArrivals(shipments, leadLookup, mk.slug),
  }));

  const allocated = regionSummaries.reduce((a, r) => a + r.allocated, 0);
  const target = markets.reduce((a, m) => a + m.target, 0);

  el.appendChild(header(allocated, target));
  el.appendChild(flowGrid(regionSummaries));
  el.appendChild(sectionTitle('Salidas por región'));
  el.appendChild(regionGrid(regionSummaries));
  el.appendChild(sectionTitle('Llegadas por mercado'));
  el.appendChild(marketGrid(marketSummaries));
  el.appendChild(exportBar(regionSummaries, marketSummaries, allocated, target));
  return el;
}

function header(allocated, target) {
  const wrap = document.createElement('div');
  wrap.className = 'view-head';
  const pct = target ? Math.round((allocated / target) * 100) : 0;
  const state = allocated > target ? 'over' : pct === 100 ? 'exact' : 'under';
  wrap.innerHTML = `
    <h2>Plan consolidado 2027</h2>
    <p class="view-sub">
      Asignado <strong>${allocated}</strong> cont (${fmtKg(containersToKg(allocated))}) ·
      Meta <strong>${target}</strong> cont ·
      <strong class="tally tally--${state}">${pct}%</strong>
    </p>`;
  return wrap;
}

/** Monthly salidas vs llegadas across all regions. */
function flowGrid(regionSummaries) {
  const g = document.createElement('div');
  g.className = 'grid grid--consolidado';
  headRow(g);

  const salidas = new Array(12).fill(0);
  const llegadas = new Array(12).fill(0);
  regionSummaries.forEach((r) => {
    r.salidas.forEach((n, i) => { salidas[i] += n; });
    r.llegadas.forEach((n, i) => { llegadas[i] += n; });
  });

  [['Salidas', salidas], ['Llegadas', llegadas]].forEach(([label, arr]) => {
    const l = document.createElement('div');
    l.className = 'row-label row-label--strong';
    l.textContent = label;
    g.appendChild(l);
    for (let i = 0; i < 12; i++) {
      const cell = document.createElement('div');
      cell.className = 'cell cell--num';
      cell.textContent = arr[i] > 0 ? arr[i] : '—';
      if (!arr[i]) cell.classList.add('cell--empty');
      g.appendChild(cell);
    }
  });

  return g;
}

function regionGrid(regionSummaries) {
  const g = document.createElement('div');
  g.className = 'grid grid--consolidado';
  headRow(g);

  let lastCampaign = null;
  [...regionSummaries]
    .sort((a, b) => (primaryCampaign(a.s) || 9) - (primaryCampaign(b.s) || 9))
    .forEach(({ s, salidas }) => {
      const camp = primaryCampaign(s);
      if (camp !== lastCampaign) {
        const sep = document.createElement('div');
        sep.className = 'group-label';
        sep.textContent = CAMPAIGNS[camp]?.name ?? 'Sin campaña';
        g.appendChild(sep);
        lastCampaign = camp;
      }

      const l = document.createElement('div');
      l.className = 'row-label';
      l.textContent = s.name;
      g.appendChild(l);

      for (let i = 0; i < 12; i++) {
        const cell = document.createElement('div');
        cell.className = 'cell cell--num';
        if (salidas[i] > 0) {
          cell.textContent = salidas[i];
          cell.style.background = s.color;
          cell.classList.add('cell--on');
        } else {
          cell.textContent = '—';
          cell.classList.add('cell--empty');
        }
        g.appendChild(cell);
      }
    });

  return g;
}

function marketGrid(marketSummaries) {
  const g = document.createElement('div');
  g.className = 'grid grid--consolidado';
  headRow(g);

  marketSummaries.forEach(({ mk, llegadas, allocated }) => {
    const over = allocated > mk.target;
    const l = document.createElement('div');
    l.className = 'row-label';
    l.innerHTML = `${mk.name} <span class="row-meta ${over ? 'row-meta--over' : ''}">${allocated}/${mk.target}</span>`;
    g.appendChild(l);

    for (let i = 0; i < 12; i++) {
      const cell = document.createElement('div');
      cell.className = 'cell cell--num';
      if (llegadas[i] > 0) {
        cell.textContent = llegadas[i];
        cell.classList.add('cell--on', 'cell--market');
      } else {
        cell.textContent = '—';
        cell.classList.add('cell--empty');
      }
      g.appendChild(cell);
    }
  });

  return g;
}

function headRow(g) {
  g.appendChild(document.createElement('div'));
  MONTHS.forEach((m) => {
    const h = document.createElement('div');
    h.className = 'month-head';
    h.textContent = m;
    g.appendChild(h);
  });
}

function sectionTitle(text) {
  const h = document.createElement('h3');
  h.className = 'section-title';
  h.textContent = text;
  return h;
}

function exportBar(regionSummaries, marketSummaries, allocated, target) {
  const bar = document.createElement('div');
  bar.className = 'export-bar';

  const btn = document.createElement('button');
  btn.className = 'btn';
  btn.textContent = 'Descargar CSV';
  btn.addEventListener('click', () => {
    const rows = [['Tipo', 'Nombre', ...MONTHS, 'Total cont', 'Total kg']];
    regionSummaries.forEach(({ s, salidas, allocated: a }) => {
      rows.push(['Salidas', s.name, ...salidas, a, Math.round(containersToKg(a))]);
    });
    marketSummaries.forEach(({ mk, llegadas, allocated: a }) => {
      rows.push(['Llegadas', mk.name, ...llegadas, a, Math.round(containersToKg(a))]);
    });
    rows.push(['Total', 'Asignado vs meta', ...new Array(12).fill(''), `${allocated}/${target}`, '']);
    downloadCSV('forest-plan-2027.csv', rows);
  });

  bar.appendChild(btn);
  return bar;
}

function fmtKg(kg) {
  return `${Math.round(Number(kg) || 0).toLocaleString('es-CO')} kg`;
}
