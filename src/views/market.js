import {
  MONTHS, monthName, CAMPAIGNS, chainsByCorte, marketProgress, CUTOFF_DAY,
} from '../model.js';

/**
 * Market view — the destination side.
 * Containers are entered on the CUTOFF row. The arrivals row is derived,
 * including `arrivalDelay` for MENA and AU, and the cutoff cell label shows
 * the DELAYED landing month (the original prototype showed the undelayed one,
 * which meant MENA/AU cells advertised dates a month early).
 */
export function renderMarket({ market, qty, onQty }) {
  const el = document.createElement('div');
  const chains = chainsByCorte(market);
  const progress = marketProgress(market, { [market.slug]: qty });

  el.appendChild(header(market, progress));
  el.appendChild(grid(market, chains, qty, onQty));
  return el;
}

function header(mk, p) {
  const wrap = document.createElement('div');
  wrap.className = 'view-head';
  const state = p.over ? 'over' : p.remaining === 0 ? 'exact' : 'under';
  wrap.innerHTML = `
    <h2>${mk.name}</h2>
    <p class="view-sub">
      Meta anual <strong>${p.target}</strong> ·
      Asignados <strong class="tally tally--${state}">${p.allocated}</strong> ·
      ${p.over ? `Excedido en ${Math.abs(p.remaining)}` : `Faltan ${p.remaining}`}
      ${mk.arrivalDelay ? ` · +${mk.arrivalDelay} mes de tránsito` : ''} ·
      Cortes el día ${CUTOFF_DAY}
    </p>`;
  return wrap;
}

function grid(mk, chains, qty, onQty) {
  const g = document.createElement('div');
  g.className = 'grid grid--market';

  g.appendChild(document.createElement('div'));
  MONTHS.forEach((m) => {
    const h = document.createElement('div');
    h.className = 'month-head';
    h.textContent = m;
    g.appendChild(h);
  });

  // Row 1 — samples
  row(g, 'Muestras', (i) => {
    const chain = Object.values(chains).find((c) => c.muestraMonth === i);
    if (!chain) return null;
    return {
      campaign: chain.campaign,
      html: `<span class="cell-tag"><i data-lucide="coffee"></i></span><span class="cell-note">corte ${monthName(chain.corteMonth)}</span>`,
    };
  });

  // Row 2 — cutoff, editable
  const label = document.createElement('div');
  label.className = 'row-label';
  label.textContent = 'Corte';
  g.appendChild(label);
  for (let i = 0; i < 12; i++) {
    const chain = chains[i];
    const cell = document.createElement('div');
    cell.className = 'cell cell--tall';
    if (chain) {
      cell.classList.add('cell--on', `camp-${chain.campaign}`);
      const note = document.createElement('span');
      note.className = 'cell-note';
      note.textContent = `llega ${monthName(chain.arrivalMonth)}`;
      cell.appendChild(note);

      const input = document.createElement('input');
      input.type = 'number';
      input.min = '0';
      input.className = 'qty';
      input.value = qty[i] || '';
      input.placeholder = '0';
      input.setAttribute('aria-label', `Contenedores con corte ${monthName(i)}, llegada ${monthName(chain.arrivalMonth)}`);
      input.addEventListener('change', (e) => {
        onQty(i, Math.max(0, parseInt(e.target.value, 10) || 0));
      });
      cell.appendChild(input);
    }
    g.appendChild(cell);
  }

  // Row 3 — arrivals, derived
  row(g, 'Llegan', (i) => {
    const chain = Object.values(chains).find((c) => c.arrivalMonth === i);
    if (!chain) return null;
    const n = qty[chain.corteMonth] || 0;
    return {
      campaign: chain.campaign,
      html: `<span class="arrival">${n > 0 ? n : '—'}</span>`,
    };
  });

  return g;
}

function row(g, labelText, fn) {
  const label = document.createElement('div');
  label.className = 'row-label';
  label.textContent = labelText;
  g.appendChild(label);

  for (let i = 0; i < 12; i++) {
    const cell = document.createElement('div');
    cell.className = 'cell';
    const data = fn(i);
    if (data) {
      cell.classList.add('cell--on', `camp-${data.campaign}`);
      cell.innerHTML = data.html;
    }
    g.appendChild(cell);
  }
}
