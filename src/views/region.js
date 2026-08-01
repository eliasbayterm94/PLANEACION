import { MONTHS, monthList, monthName, primaryCampaign, CAMPAIGNS, CUTOFF_DAY } from '../model.js';

/**
 * Region view — the origin side of the plan.
 * Containers are entered on the SHIPPING row; the delivery row mirrors them
 * forward by the region's transit, so origin and destination can never drift.
 */
export function renderRegion({ schedule, qty, onQty }) {
  const camp = primaryCampaign(schedule);
  const el = document.createElement('div');

  el.appendChild(header(schedule, camp));
  el.appendChild(phaseChips(schedule));
  el.appendChild(grid(schedule, qty, onQty));
  return el;
}

function header(s, camp) {
  const wrap = document.createElement('div');
  wrap.className = 'view-head';
  wrap.innerHTML = `
    <h2>${s.name}</h2>
    <p class="view-sub">
      ${CAMPAIGNS[camp]?.name ?? 'Sin campaña'} ·
      Tránsito ${s.transitMonths} ${s.transitMonths === 1 ? 'mes' : 'meses'} ·
      Cortes el día ${CUTOFF_DAY}
    </p>`;
  return wrap;
}

function phaseChips(s) {
  const rows = [
    ['Cosecha', s.cosecha],
    ['Muestras', s.muestra],
    ['Corte', s.corte],
    ['Despacho', s.despacho],
    ['Entrega', s.entrega],
  ];
  const wrap = document.createElement('div');
  wrap.className = 'chips';
  rows.forEach(([label, months]) => {
    const chip = document.createElement('div');
    chip.className = 'chip';
    chip.style.setProperty('--chip', s.color);
    chip.innerHTML = `<span class="chip-label">${label}</span><span class="chip-value">${monthList(months)}</span>`;
    wrap.appendChild(chip);
  });
  return wrap;
}

function grid(s, qty, onQty) {
  const g = document.createElement('div');
  g.className = 'grid grid--region';

  g.appendChild(document.createElement('div'));
  MONTHS.forEach((m, i) => {
    const h = document.createElement('div');
    h.className = 'month-head';
    h.textContent = m;
    if (s.corte.includes(i)) h.classList.add('month-head--cut');
    g.appendChild(h);
  });

  const lines = [
    { label: 'Cosecha', months: s.cosecha, icon: '' },
    { label: 'Muestras', months: s.muestra, icon: 'coffee' },
    { label: 'Corte', months: s.corte, icon: 'scissors' },
    { label: 'Despacho', months: s.despacho, icon: '', input: true },
    { label: 'Entrega', months: s.entrega, icon: '', mirror: true },
  ];

  lines.forEach((line) => {
    const label = document.createElement('div');
    label.className = 'row-label';
    label.textContent = line.label;
    g.appendChild(label);

    for (let i = 0; i < 12; i++) {
      const active = line.months.includes(i);
      const cell = document.createElement('div');
      cell.className = 'cell' + (line.input ? ' cell--tall' : '');
      if (active) {
        cell.style.background = s.color;
        cell.classList.add('cell--on');
      }

      if (active && line.icon) {
        const tag = document.createElement('span');
        tag.className = 'cell-tag';
        tag.innerHTML = `<i data-lucide="${line.icon}"></i>`;
        cell.appendChild(tag);
      }

      if (active && line.input) {
        const input = document.createElement('input');
        input.type = 'number';
        input.min = '0';
        input.className = 'qty';
        input.value = qty[i] || '';
        input.placeholder = '0';
        input.setAttribute('aria-label', `Contenedores despachados en ${monthName(i)}`);
        input.addEventListener('change', (e) => {
          const val = Math.max(0, parseInt(e.target.value, 10) || 0);
          onQty(i, val);
        });
        cell.appendChild(input);
      }

      if (active && line.mirror) {
        // Delivery mirrors the shipment that produced it — read-only by design.
        const source = (i - s.transitMonths + 12) % 12;
        const n = qty[source] || 0;
        cell.textContent = n > 0 ? n : '—';
        cell.classList.add('cell--mirror');
      }

      g.appendChild(cell);
    }
  });

  return g;
}
