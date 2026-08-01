import {
  MONTHS, CUTOFF_DAY, shipmentArrival, warehousePrimaryLead, containersToKg,
} from '../model.js';

/**
 * Market view — the destination side, now DERIVED from region shipments.
 *
 * There is no manual capture here: arrivals come from what regions ship to this
 * market's warehouses (see "Editar regiones"), each landing by its warehouse
 * lead time. The view shows the annual target, what is allocated so far, and the
 * monthly landings per warehouse.
 */
export function renderMarket({ market, warehouses, shipments, leadLookup }) {
  const el = document.createElement('div');
  const cfg = warehouses || { primary: null, warehouses: [] };
  const list = cfg.warehouses || [];

  const arrivalsByWh = {};
  const total = new Array(12).fill(0);
  let allocated = 0;
  list.forEach((w) => {
    const arr = warehouseArrivals(shipments, leadLookup, w.name);
    arrivalsByWh[w.name] = arr;
    arr.forEach((n, i) => { total[i] += n; allocated += n; });
  });

  el.appendChild(header(market, allocated, cfg));
  if (list.length) el.appendChild(grid(list, arrivalsByWh, total, cfg));
  else {
    const empty = document.createElement('p');
    empty.className = 'wh-empty';
    empty.textContent = 'Este mercado no tiene bodegas. Agrégalas en la pestaña Bodegas.';
    el.appendChild(empty);
  }
  return el;
}

function header(mk, allocated, cfg) {
  const wrap = document.createElement('div');
  wrap.className = 'view-head';
  const remaining = mk.target - allocated;
  const state = allocated > mk.target ? 'over' : remaining === 0 ? 'exact' : 'under';
  const lead = warehousePrimaryLead(cfg);
  const transit = lead != null ? ` · Tránsito ${leadLabel(lead)} (bodega principal)` : '';
  wrap.innerHTML = `
    <h2>${mk.name}</h2>
    <p class="view-sub">
      Meta anual <strong>${mk.target}</strong> cont ·
      Asignados <strong class="tally tally--${state}">${allocated}</strong>
      (${fmtKg(containersToKg(allocated))}) ·
      ${allocated > mk.target ? `Excedido en ${Math.abs(remaining)}` : `Faltan ${remaining}`}
      ${transit} · Llegadas derivadas de las salidas · Cortes (ref.) el día ${CUTOFF_DAY}
    </p>`;
  return wrap;
}

function grid(list, arrivalsByWh, total, cfg) {
  const g = document.createElement('div');
  g.className = 'grid grid--consolidado';

  g.appendChild(document.createElement('div'));
  MONTHS.forEach((m) => {
    const h = document.createElement('div');
    h.className = 'month-head';
    h.textContent = m;
    g.appendChild(h);
  });

  list.forEach((w) => {
    const label = document.createElement('div');
    label.className = 'row-label';
    const primary = w.name === cfg.primary;
    label.innerHTML =
      `${w.name}${primary ? ' <span class="row-meta">ppal</span>' : ''} ` +
      `<span class="row-meta">${leadLabel(w.lead)}</span>`;
    g.appendChild(label);

    const arr = arrivalsByWh[w.name] || [];
    for (let i = 0; i < 12; i++) {
      const cell = document.createElement('div');
      cell.className = 'cell cell--num';
      if (arr[i] > 0) {
        cell.textContent = arr[i];
        cell.classList.add('cell--on', 'cell--market');
      } else {
        cell.textContent = '—';
        cell.classList.add('cell--empty');
      }
      g.appendChild(cell);
    }
  });

  // Total arrivals
  const tl = document.createElement('div');
  tl.className = 'row-label row-label--strong';
  tl.textContent = 'Total llega';
  g.appendChild(tl);
  for (let i = 0; i < 12; i++) {
    const cell = document.createElement('div');
    cell.className = 'cell cell--num';
    cell.textContent = total[i] > 0 ? total[i] : '—';
    if (!total[i]) cell.classList.add('cell--empty');
    g.appendChild(cell);
  }

  return g;
}

/** Monthly arrivals into one warehouse, summed across every region's shipments. */
function warehouseArrivals(shipments, leadLookup, whName) {
  const arr = new Array(12).fill(0);
  const lead = leadLookup[whName]?.lead ?? 1;
  Object.values(shipments || {}).forEach((rs) => {
    const months = rs?.ship?.[whName];
    if (!months) return;
    Object.entries(months).forEach(([m, n]) => {
      arr[shipmentArrival(m, lead)] += Number(n) || 0;
    });
  });
  return arr;
}

function leadLabel(lead) {
  const n = Number(lead) || 0;
  return `${n % 1 === 0 ? n : n.toFixed(1)} ${n === 1 ? 'mes' : 'meses'}`;
}

function fmtKg(kg) {
  return `${Math.round(Number(kg) || 0).toLocaleString('es-CO')} kg`;
}
