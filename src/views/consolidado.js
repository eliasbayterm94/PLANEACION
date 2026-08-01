import {
  MONTHS, monthName, reconcile, primaryCampaign, CAMPAIGNS,
  marketProgress, mod12,
} from '../model.js';
import { downloadCSV } from '../store.js';

/**
 * Consolidated view — the control the prototype was missing.
 *
 * Origin shipments and destination arrivals were two independent number sets
 * with nothing checking them against each other. This surfaces the delta by
 * month so a gap shows up while there is still time to act on it.
 */
export function renderConsolidado({ schedules, markets, regionQty, marketQty }) {
  const el = document.createElement('div');
  const rec = reconcile(schedules, regionQty, markets, marketQty);

  el.appendChild(header(rec));
  el.appendChild(balanceGrid(rec));
  el.appendChild(sectionTitle('Origen — llegadas por región'));
  el.appendChild(regionGrid(schedules, regionQty));
  el.appendChild(sectionTitle('Destino — llegadas por mercado'));
  el.appendChild(marketGrid(markets, marketQty));
  el.appendChild(exportBar(schedules, markets, regionQty, marketQty, rec));
  return el;
}

function header(rec) {
  const gap = rec.totals.supply - rec.totals.demand;
  const wrap = document.createElement('div');
  wrap.className = 'view-head';
  wrap.innerHTML = `
    <h2>Plan consolidado 2027</h2>
    <p class="view-sub">
      Origen <strong>${rec.totals.supply}</strong> ·
      Destino <strong>${rec.totals.demand}</strong> ·
      <strong class="tally tally--${gap === 0 ? 'exact' : 'over'}">
        ${gap === 0 ? 'Cuadrado' : `Descuadre de ${Math.abs(gap)}`}
      </strong>
    </p>`;
  return wrap;
}

function sectionTitle(text) {
  const h = document.createElement('h3');
  h.className = 'section-title';
  h.textContent = text;
  return h;
}

function balanceGrid(rec) {
  const g = document.createElement('div');
  g.className = 'grid grid--consolidado';
  headRow(g);

  [
    ['Origen', (m) => rec.byMonth[m].supply, ''],
    ['Destino', (m) => rec.byMonth[m].demand, ''],
    ['Delta', (m) => rec.byMonth[m].delta, 'delta'],
  ].forEach(([label, fn, kind]) => {
    const l = document.createElement('div');
    l.className = 'row-label row-label--strong';
    l.textContent = label;
    g.appendChild(l);

    for (let i = 0; i < 12; i++) {
      const v = fn(i);
      const cell = document.createElement('div');
      cell.className = 'cell cell--num';
      if (kind === 'delta') {
        cell.textContent = v === 0 ? '·' : v > 0 ? `+${v}` : v;
        cell.classList.add(v === 0 ? 'delta--ok' : 'delta--off');
        if (v !== 0) cell.title = v > 0 ? 'Origen sin destino asignado' : 'Destino sin origen asignado';
      } else {
        cell.textContent = v > 0 ? v : '—';
        if (!v) cell.classList.add('cell--empty');
      }
      g.appendChild(cell);
    }
  });

  return g;
}

function regionGrid(schedules, regionQty) {
  const g = document.createElement('div');
  g.className = 'grid grid--consolidado';
  headRow(g);

  let lastCampaign = null;
  [...schedules]
    .sort((a, b) => (primaryCampaign(a) || 9) - (primaryCampaign(b) || 9))
    .forEach((s) => {
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

      const q = regionQty[s.slug] || {};
      const landed = new Array(12).fill(0);
      s.despacho.forEach((m) => {
        const n = Number(q[m]) || 0;
        if (n) landed[mod12(m + s.transitMonths)] += n;
      });

      for (let i = 0; i < 12; i++) {
        const cell = document.createElement('div');
        cell.className = 'cell cell--num';
        if (landed[i] > 0) {
          cell.textContent = landed[i];
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

function marketGrid(markets, marketQty) {
  const g = document.createElement('div');
  g.className = 'grid grid--consolidado';
  headRow(g);

  markets.forEach((mk) => {
    const p = marketProgress(mk, marketQty);
    const l = document.createElement('div');
    l.className = 'row-label';
    l.innerHTML = `${mk.name} <span class="row-meta ${p.over ? 'row-meta--over' : ''}">${p.allocated}/${p.target}</span>`;
    g.appendChild(l);

    const q = marketQty[mk.slug] || {};
    const landed = new Array(12).fill(0);
    Object.entries(q).forEach(([corteMonth, n]) => {
      const arrival = mod12(Number(corteMonth) + 2 + (mk.arrivalDelay || 0));
      landed[arrival] += Number(n) || 0;
    });

    for (let i = 0; i < 12; i++) {
      const cell = document.createElement('div');
      cell.className = 'cell cell--num';
      if (landed[i] > 0) {
        cell.textContent = landed[i];
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

function exportBar(schedules, markets, regionQty, marketQty, rec) {
  const bar = document.createElement('div');
  bar.className = 'export-bar';

  const btn = document.createElement('button');
  btn.className = 'btn';
  btn.textContent = 'Descargar CSV';
  btn.addEventListener('click', () => {
    const rows = [['Tipo', 'Nombre', ...MONTHS, 'Total']];

    schedules.forEach((s) => {
      const q = regionQty[s.slug] || {};
      const landed = new Array(12).fill(0);
      s.despacho.forEach((m) => {
        const n = Number(q[m]) || 0;
        if (n) landed[mod12(m + s.transitMonths)] += n;
      });
      rows.push(['Origen', s.name, ...landed, landed.reduce((a, b) => a + b, 0)]);
    });

    markets.forEach((mk) => {
      const q = marketQty[mk.slug] || {};
      const landed = new Array(12).fill(0);
      Object.entries(q).forEach(([m, n]) => {
        landed[mod12(Number(m) + 2 + (mk.arrivalDelay || 0))] += Number(n) || 0;
      });
      rows.push(['Destino', mk.name, ...landed, landed.reduce((a, b) => a + b, 0)]);
    });

    rows.push(['Balance', 'Delta', ...rec.byMonth.map((r) => r.delta), rec.totals.supply - rec.totals.demand]);
    downloadCSV('forest-plan-2027.csv', rows);
  });

  bar.appendChild(btn);
  return bar;
}
