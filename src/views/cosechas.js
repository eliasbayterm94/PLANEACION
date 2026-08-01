import {
  MONTHS, primaryCampaign, CAMPAIGNS, CUTOFF_DAY,
} from '../model.js';

/**
 * Cosechas view — read-only overview of every origin at once.
 *
 * One shared month header, then a block per region (grouped by campaign) with
 * its full derived timeline: cosecha → muestras → corte → despacho → entrega.
 * Editing lives in the "Editar regiones" tab; this tab never mutates state.
 */
export function renderCosechas({ schedules, regionQty }) {
  const el = document.createElement('div');
  el.appendChild(header());

  const g = document.createElement('div');
  g.className = 'grid grid--consolidado grid--cosechas';

  // Shared month header.
  g.appendChild(document.createElement('div'));
  MONTHS.forEach((m) => {
    const h = document.createElement('div');
    h.className = 'month-head';
    h.textContent = m;
    g.appendChild(h);
  });

  [...schedules]
    .sort((a, b) => (primaryCampaign(a) || 9) - (primaryCampaign(b) || 9))
    .forEach((s) => {
      const camp = primaryCampaign(s);
      const label = document.createElement('div');
      label.className = 'group-label';
      const transit = `${s.transitMonths} ${s.transitMonths === 1 ? 'mes' : 'meses'}`;
      label.textContent =
        `${s.name} · ${CAMPAIGNS[camp]?.name ?? 'Sin campaña'} · tránsito ${transit}`;
      g.appendChild(label);

      const q = regionQty[s.slug] || {};
      const lines = [
        { name: 'Cosecha', months: s.cosecha },
        { name: 'Muestras', months: s.muestra, icon: 'coffee' },
        { name: 'Corte', months: s.corte, icon: 'scissors' },
        { name: 'Despacho', months: s.despacho, number: (i) => q[i] || 0 },
        { name: 'Entrega', months: s.entrega, mirror: true },
      ];

      lines.forEach((line) => {
        const rowLabel = document.createElement('div');
        rowLabel.className = 'row-label';
        rowLabel.textContent = line.name;
        g.appendChild(rowLabel);

        for (let i = 0; i < 12; i++) {
          const active = line.months.includes(i);
          const cell = document.createElement('div');
          cell.className = 'cell';
          if (active) {
            cell.style.background = s.color;
            cell.classList.add('cell--on');

            if (line.icon) {
              const tag = document.createElement('span');
              tag.className = 'cell-tag';
              tag.innerHTML = `<i data-lucide="${line.icon}"></i>`;
              cell.appendChild(tag);
            }
            if (line.number) {
              const n = line.number(i);
              if (n > 0) { cell.classList.add('cell--num'); cell.append(String(n)); }
            }
            if (line.mirror) {
              // Delivery mirrors the shipment that produced it.
              const source = (i - s.transitMonths + 12) % 12;
              const n = q[source] || 0;
              cell.classList.add('cell--mirror');
              if (n > 0) cell.append(String(n));
            }
          }
          g.appendChild(cell);
        }
      });
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
      Vista de todas las regiones a la vez. Cada bloque muestra el ciclo derivado:
      cosecha, muestras, corte, despacho y entrega. Los números en
      <strong>Despacho</strong> y <strong>Entrega</strong> reflejan lo capturado.
      Para editar, usa la pestaña <strong>Editar regiones</strong>.
      Los cortes son siempre el día ${CUTOFF_DAY}.
    </p>`;
  return wrap;
}
