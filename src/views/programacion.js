import {
  MONTHS, monthName, campaignOfMonth, CAMPAIGNS, CUTOFF_DAY, mod12,
  exportCapacity, laneSalidas, warehouseLlegadas, marketShipmentArrivals,
  marketGoalTotal, warehouseGoalTotal, containersToKg, listCountries,
  totalSalidas, totalLlegadas,
} from '../model.js';

/**
 * Programación de salidas — the planning cockpit.
 *
 * Salidas are captured by producing COUNTRY (tab) -> warehouse -> month. The
 * cockpit is organised by sales region (market -> warehouse). Overlays connect
 * the plan to the goal (meta), the campaign calendar, and harvest capacity: the
 * "Capacidad export." row is derived from each origin's despacho months, so the
 * valle months (low harvest) show up as a soft ceiling — a signal, not a block.
 */
export function renderProgramacion({
  schedules, markets, warehouses, goals, shipments, leadLookup,
  planCountry, onCountry, onShip,
}) {
  const el = document.createElement('div');
  const countries = listCountries(schedules);
  const country = planCountry && countries.includes(planCountry) ? planCountry : countries[0];

  el.appendChild(header(shipments, leadLookup, countries, country, onCountry));

  const g = document.createElement('div');
  g.className = 'grid grid--consolidado grid--prog';

  // Month header with campaign band.
  g.appendChild(document.createElement('div'));
  MONTHS.forEach((m, i) => {
    const h = document.createElement('div');
    const camp = campaignOfMonth(i);
    h.className = 'month-head' + (camp ? ` month-head--c${camp}` : '');
    h.textContent = m;
    if (camp) h.title = CAMPAIGNS[camp].name;
    g.appendChild(h);
  });

  // Capacity row (valle signal) for the selected country.
  const cap = exportCapacity(schedules, country);
  const capMax = Math.max(1, ...cap);
  const capLabel = document.createElement('div');
  capLabel.className = 'row-label';
  capLabel.innerHTML = 'Capacidad export. <span class="row-meta">cosecha</span>';
  g.appendChild(capLabel);
  for (let i = 0; i < 12; i++) {
    const cell = document.createElement('div');
    cell.className = 'cell cap-cell' + (cap[i] === 0 ? ' cap-valle' : '');
    cell.title = cap[i] === 0 ? 'Mes valle — poca cosecha disponible' : `${cap[i]} origen(es) despachando`;
    if (cap[i] > 0) {
      const bar = document.createElement('span');
      bar.className = 'cap-bar';
      bar.style.height = `${Math.round((cap[i] / capMax) * 100)}%`;
      cell.appendChild(bar);
    }
    g.appendChild(cell);
  }

  // Markets -> warehouses.
  markets.forEach((mk) => {
    const whList = warehouses[mk.slug]?.warehouses || [];

    const goalKg = mk.goalsByWarehouse
      ? whList.reduce((s, w) => s + warehouseGoalTotal(goals, w.name), 0)
      : marketGoalTotal(goals, mk.slug);
    const llegKg = containersToKg(marketShipmentArrivals(shipments, leadLookup, mk.slug).allocated);
    const pct = goalKg ? Math.round((llegKg / goalKg) * 100) : 0;

    const gl = document.createElement('div');
    gl.className = 'group-label wh-group';
    const inner = document.createElement('div');
    inner.className = 'wh-group-inner';
    inner.innerHTML =
      `<span class="wh-group-name">${mk.name}</span>` +
      `<span class="wh-progress">${fmtKg(llegKg)} llegan` +
      (goalKg ? ` · meta ${fmtKg(goalKg)} · <strong class="tally tally--${llegKg > goalKg ? 'over' : pct === 100 ? 'exact' : 'under'}">${pct}%</strong>` : '') +
      `</span>`;
    gl.appendChild(inner);
    g.appendChild(gl);

    if (!whList.length) {
      const none = document.createElement('div');
      none.className = 'row-label';
      none.style.gridColumn = '1 / -1';
      none.innerHTML = '<span class="row-meta">Sin bodegas — agrégalas en Bodegas</span>';
      g.appendChild(none);
      return;
    }

    whList.forEach((w) => {
      // Salida row (editable, selected country).
      const salidas = laneSalidas(shipments, country, w.name);
      const salLabel = document.createElement('div');
      salLabel.className = 'row-label';
      salLabel.innerHTML = `${w.name} <span class="row-meta">${leadLabel(w.lead)}</span>`;
      g.appendChild(salLabel);
      for (let i = 0; i < 12; i++) {
        const cell = document.createElement('div');
        cell.className = 'cell cell--tall';
        const input = document.createElement('input');
        input.type = 'number';
        input.min = '0';
        input.className = 'qty';
        input.value = salidas[i] || '';
        input.placeholder = '0';
        input.setAttribute('aria-label', `Salidas ${country} a ${w.name} en ${monthName(i)}`);
        input.addEventListener('change', (e) => onShip(country, w.name, i, Math.max(0, parseInt(e.target.value, 10) || 0)));
        cell.appendChild(input);
        g.appendChild(cell);
      }

      // Llega row (derived, all countries).
      const lleg = warehouseLlegadas(shipments, leadLookup, w.name);
      const llegLabel = document.createElement('div');
      llegLabel.className = 'row-label';
      llegLabel.innerHTML = '<span class="row-sub">↳ llega</span>';
      g.appendChild(llegLabel);
      for (let i = 0; i < 12; i++) {
        const cell = document.createElement('div');
        cell.className = 'cell cell--num';
        if (lleg[i] > 0) {
          cell.textContent = lleg[i];
          cell.classList.add('cell--on', 'cell--market');
        } else {
          cell.textContent = '—';
          cell.classList.add('cell--empty');
        }
        g.appendChild(cell);
      }
    });
  });

  el.appendChild(g);
  return el;
}

function header(shipments, leadLookup, countries, country, onCountry) {
  const wrap = document.createElement('div');
  wrap.className = 'view-head';

  const sal = totalSalidas(shipments).reduce((a, b) => a + b, 0);
  const lle = totalLlegadas(shipments, leadLookup).reduce((a, b) => a + b, 0);

  const h = document.createElement('h2');
  h.textContent = 'Programación de salidas';
  wrap.appendChild(h);

  const sub = document.createElement('p');
  sub.className = 'view-sub';
  sub.innerHTML =
    `Salidas por país → bodega → mes. <strong>${sal}</strong> cont programados (${fmtKg(containersToKg(sal))}), ` +
    `<strong>${lle}</strong> llegan. La fila <strong>Capacidad export.</strong> marca los meses valle ` +
    `(poca cosecha). Cortes (ref.) el día ${CUTOFF_DAY}.`;
  wrap.appendChild(sub);

  const tabs = document.createElement('div');
  tabs.className = 'region-pills prog-country';
  countries.forEach((c) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'region-pill' + (c === country ? ' active' : '');
    b.textContent = c;
    b.addEventListener('click', () => onCountry(c));
    tabs.appendChild(b);
  });
  wrap.appendChild(tabs);

  return wrap;
}

function leadLabel(lead) {
  const n = Number(lead) || 0;
  return `${n % 1 === 0 ? n : n.toFixed(1)} ${n === 1 ? 'mes' : 'meses'}`;
}

function fmtKg(kg) {
  return `${Math.round(Number(kg) || 0).toLocaleString('es-CO')} kg`;
}
