import {
  MONTHS, primaryCampaign, CAMPAIGNS, CUTOFF_DAY,
} from '../model.js';

/**
 * Cosechas view — a single Gantt with every origin at once.
 *
 * One row per region: a colour band running from cosecha to entrega, with a
 * Lucide icon in each month marking the phase(s) active there, plus a total of
 * captured containers. Read-only; editing lives in "Editar regiones".
 */
const PHASES = [
  { key: 'cosecha', name: 'Cosecha', icon: 'sprout' },
  { key: 'muestra', name: 'Muestras', icon: 'coffee' },
  { key: 'corte', name: 'Corte', icon: 'scissors' },
  { key: 'despacho', name: 'Despacho', icon: 'ship' },
  { key: 'entrega', name: 'Entrega', icon: 'package-check' },
];

export function renderCosechas({ schedules, regionQty }) {
  const el = document.createElement('div');
  el.appendChild(header());
  el.appendChild(legend());

  const g = document.createElement('div');
  g.className = 'grid grid--gantt';

  // Header row: corner + months + total.
  g.appendChild(document.createElement('div'));
  MONTHS.forEach((m) => {
    const h = document.createElement('div');
    h.className = 'month-head';
    h.textContent = m;
    g.appendChild(h);
  });
  const totalHead = document.createElement('div');
  totalHead.className = 'month-head gantt-total-head';
  totalHead.textContent = 'Total';
  g.appendChild(totalHead);

  [...schedules]
    .sort((a, b) => (primaryCampaign(a) || 9) - (primaryCampaign(b) || 9))
    .forEach((s) => {
      const camp = primaryCampaign(s);
      const q = regionQty[s.slug] || {};

      const label = document.createElement('div');
      label.className = 'row-label';
      const dot = document.createElement('span');
      dot.className = 'camp-dot';
      dot.style.background = CAMPAIGNS[camp]?.color ?? 'var(--fc-ink-300)';
      dot.title = CAMPAIGNS[camp]?.name ?? 'Sin campaña';
      label.appendChild(dot);
      label.append(s.name);
      g.appendChild(label);

      for (let i = 0; i < 12; i++) {
        const active = PHASES.filter((p) => s[p.key].includes(i));
        const cell = document.createElement('div');
        cell.className = 'cell';
        if (active.length) {
          cell.style.background = s.color;
          cell.classList.add('cell--on');
          const icons = document.createElement('span');
          icons.className = 'gantt-cell-icons';
          active.forEach((p) => {
            const ico = document.createElement('i');
            ico.setAttribute('data-lucide', p.icon);
            ico.title = p.name;
            icons.appendChild(ico);
          });
          cell.appendChild(icons);
        }
        g.appendChild(cell);
      }

      const total = Object.values(q).reduce((a, b) => a + (Number(b) || 0), 0);
      const totalCell = document.createElement('div');
      totalCell.className = 'cell gantt-total';
      totalCell.textContent = total > 0 ? total : '—';
      if (total === 0) totalCell.classList.add('cell--empty');
      g.appendChild(totalCell);
    });

  el.appendChild(g);
  return el;
}

function header() {
  const wrap = document.createElement('div');
  wrap.className = 'view-head';
  wrap.innerHTML = `
    <h2>Cosechas 2027</h2>
    <p class="view-sub">
      Gantt de todas las regiones en una vista. Cada banda va de cosecha a
      entrega; los íconos marcan la fase de cada mes y el punto indica la
      campaña. El total son los contenedores despachados capturados.
      Para editar, usa la pestaña <strong>Editar regiones</strong>.
      Los cortes son siempre el día ${CUTOFF_DAY}.
    </p>`;
  return wrap;
}

function legend() {
  const wrap = document.createElement('div');
  wrap.className = 'gantt-legend';
  PHASES.forEach((p) => {
    const item = document.createElement('span');
    item.className = 'gantt-legend-item';
    item.innerHTML = `<i data-lucide="${p.icon}"></i>${p.name}`;
    wrap.appendChild(item);
  });
  return wrap;
}
