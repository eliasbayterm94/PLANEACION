import {
  MONTHS, mod12, listCountries, totalSalidas, totalLlegadas,
  marketShipmentArrivals, containersToKg,
} from '../model.js';
import { downloadCSV } from '../store.js';

/**
 * Consolidated view — the whole plan from one source: shipments by country.
 *
 * Salidas (by producing country) and llegadas (by market, each warehouse by its
 * lead) come from the same data. The view surfaces the monthly flow, salidas by
 * country, llegadas by market, and allocated-vs-target.
 */
export function renderConsolidado({ schedules, markets, shipments, leadLookup }) {
  const el = document.createElement('div');

  const salidas = totalSalidas(shipments);
  const llegadas = totalLlegadas(shipments, leadLookup);
  const allocated = salidas.reduce((a, b) => a + b, 0);
  const target = markets.reduce((a, m) => a + m.target, 0);

  el.appendChild(header(allocated, target));
  el.appendChild(flowGrid(salidas, llegadas));
  el.appendChild(sectionTitle('Salidas por país productor'));
  el.appendChild(countryGrid(schedules, shipments));
  el.appendChild(sectionTitle('Llegadas por mercado'));
  el.appendChild(marketGrid(markets, shipments, leadLookup));
  el.appendChild(exportBar(schedules, markets, shipments, leadLookup, allocated, target));
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

function flowGrid(salidas, llegadas) {
  const g = document.createElement('div');
  g.className = 'grid grid--consolidado';
  headRow(g);
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

function countryMonthSalidas(shipments, country) {
  const arr = new Array(12).fill(0);
  const ship = shipments?.[country]?.ship || {};
  Object.values(ship).forEach((ms) => {
    Object.entries(ms).forEach(([m, n]) => { arr[mod12(Number(m))] += Number(n) || 0; });
  });
  return arr;
}

function countryGrid(schedules, shipments) {
  const g = document.createElement('div');
  g.className = 'grid grid--consolidado';
  headRow(g);
  listCountries(schedules).forEach((country) => {
    const arr = countryMonthSalidas(shipments, country);
    const l = document.createElement('div');
    l.className = 'row-label';
    l.textContent = country;
    g.appendChild(l);
    for (let i = 0; i < 12; i++) {
      const cell = document.createElement('div');
      cell.className = 'cell cell--num';
      if (arr[i] > 0) { cell.textContent = arr[i]; cell.classList.add('cell--on'); cell.style.background = 'var(--fc-yellow-200)'; }
      else { cell.textContent = '—'; cell.classList.add('cell--empty'); }
      g.appendChild(cell);
    }
  });
  return g;
}

function marketGrid(markets, shipments, leadLookup) {
  const g = document.createElement('div');
  g.className = 'grid grid--consolidado';
  headRow(g);
  markets.forEach((mk) => {
    const { llegadas, allocated } = marketShipmentArrivals(shipments, leadLookup, mk.slug);
    const over = allocated > mk.target;
    const l = document.createElement('div');
    l.className = 'row-label';
    l.innerHTML = `${mk.name} <span class="row-meta ${over ? 'row-meta--over' : ''}">${allocated}/${mk.target}</span>`;
    g.appendChild(l);
    for (let i = 0; i < 12; i++) {
      const cell = document.createElement('div');
      cell.className = 'cell cell--num';
      if (llegadas[i] > 0) { cell.textContent = llegadas[i]; cell.classList.add('cell--on', 'cell--market'); }
      else { cell.textContent = '—'; cell.classList.add('cell--empty'); }
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

function exportBar(schedules, markets, shipments, leadLookup, allocated, target) {
  const bar = document.createElement('div');
  bar.className = 'export-bar';
  const btn = document.createElement('button');
  btn.className = 'btn';
  btn.textContent = 'Descargar CSV';
  btn.addEventListener('click', () => {
    const rows = [['Tipo', 'Nombre', ...MONTHS, 'Total cont', 'Total kg']];
    listCountries(schedules).forEach((country) => {
      const arr = countryMonthSalidas(shipments, country);
      const t = arr.reduce((a, b) => a + b, 0);
      rows.push(['Salidas', country, ...arr, t, Math.round(containersToKg(t))]);
    });
    markets.forEach((mk) => {
      const { llegadas, allocated: a } = marketShipmentArrivals(shipments, leadLookup, mk.slug);
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
