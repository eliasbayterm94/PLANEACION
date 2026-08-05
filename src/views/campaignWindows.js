import { MONTHS, monthName, mod12, despachoMonths } from '../model.js';

/**
 * Ventanas de campaña — edit the COMMERCIAL campaign windows (the Flujo layer).
 *
 * Per campaign you set the CORTE months and the DISPONIBILIDAD (destination
 * availability) months. Producción, trilla and despacho derive from the corte
 * via the offsets. This is a capa aparte: it never changes the products.
 *
 * Pure view: every edit calls a callback; state + persistence live in main.js.
 */
export function renderCampaignWindows({ windows, onToggleMonth, onOffset, onReset }) {
  const el = document.createElement('div');
  el.appendChild(header(onReset));
  [1, 2].forEach((camp) => el.appendChild(campaignCard(camp, windows, onToggleMonth)));
  el.appendChild(offsetsCard(windows, onOffset));
  return el;
}

function header(onReset) {
  const head = document.createElement('div');
  head.className = 'view-head';
  const bar = document.createElement('div');
  bar.className = 'prod-head-bar';
  const h = document.createElement('h2');
  h.textContent = 'Ventanas de campaña';
  bar.appendChild(h);
  const reset = document.createElement('button');
  reset.type = 'button';
  reset.className = 'fc-btn fc-btn-ghost';
  reset.innerHTML = '<i data-lucide="rotate-ccw"></i> Restablecer';
  reset.addEventListener('click', () => {
    if (window.confirm('¿Restablecer las ventanas de campaña a los valores base?')) onReset();
  });
  bar.appendChild(reset);
  head.appendChild(bar);

  const sub = document.createElement('p');
  sub.className = 'view-sub';
  sub.innerHTML = `
    La <strong>campaña</strong> se define por la <strong>disponibilidad en destino</strong>. Marca los meses de
    <strong>corte</strong> y de <strong>disponibilidad</strong>; producción, trilla y despacho se derivan del corte.
    Es una <strong>capa aparte</strong>: alimenta la vista <em>Flujo</em> y no cambia los productos.`;
  head.appendChild(sub);
  return head;
}

function monthChips(active, camp, onClick) {
  const wrap = document.createElement('div');
  wrap.className = 'cortes-months';
  const set = new Set(active);
  MONTHS.forEach((m, i) => {
    const on = set.has(i);
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'corte-chip' + (on ? ` on camp-${camp}` : '');
    b.textContent = m;
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
    b.addEventListener('click', () => onClick(i));
    wrap.appendChild(b);
  });
  return wrap;
}

/** Compact month-name list for a derived stage. */
function stageLine(label, months) {
  const uniq = [...new Set(months.map(mod12))].sort((a, b) => a - b);
  const row = document.createElement('div');
  row.className = 'win-derived-row';
  row.innerHTML = `<span class="win-derived-lab">${label}</span>` +
    `<span class="win-derived-val">${uniq.length ? uniq.map(monthName).join(' · ') : '—'}</span>`;
  return row;
}

function campaignCard(camp, windows, onToggleMonth) {
  const c = windows.campaigns[camp];
  const card = document.createElement('section');
  card.className = 'wh-card win-card';
  card.style.setProperty('--accent', c.color);

  const title = document.createElement('div');
  title.className = 'wh-card-head';
  title.innerHTML = `<span class="wh-card-title"><span class="win-dot" style="background:${c.color}"></span>${c.name}</span>`;
  card.appendChild(title);

  const corteLbl = document.createElement('div');
  corteLbl.className = 'win-block-lab';
  corteLbl.textContent = 'Corte (confirma · inicia producción)';
  card.appendChild(corteLbl);
  card.appendChild(monthChips(c.corte, camp, (m) => onToggleMonth(camp, 'corte', m)));

  const dispLbl = document.createElement('div');
  dispLbl.className = 'win-block-lab';
  dispLbl.textContent = 'Disponible en destino (venta)';
  card.appendChild(dispLbl);
  card.appendChild(monthChips(c.disp, camp, (m) => onToggleMonth(camp, 'disp', m)));

  // Derived stages from the corte + offsets.
  const off = windows.despachoOffset;
  const derived = document.createElement('div');
  derived.className = 'win-derived';
  derived.appendChild(stageLine('Muestras (−1)', c.corte.map((m) => m - 1)));
  derived.appendChild(stageLine('Producción', c.corte.flatMap((m) => [m, m + 1])));
  derived.appendChild(stageLine('Trilla / empaque', c.corte.flatMap((m) => [m + 1, m + 2])));
  derived.appendChild(stageLine(`Despacho (corte +${off})`, despachoMonths(windows, camp)));
  card.appendChild(derived);

  return card;
}

function offsetsCard(windows, onOffset) {
  const card = document.createElement('section');
  card.className = 'wh-card';
  const title = document.createElement('div');
  title.className = 'wh-card-head';
  title.innerHTML = '<span class="wh-card-title">Tiempos de producción</span>';
  card.appendChild(title);

  const intro = document.createElement('p');
  intro.className = 'view-sub';
  intro.innerHTML = 'Meses entre el <strong>corte</strong> y el <strong>despacho</strong> (producción + trilla), y el extra si el café es <strong>fuera de campaña</strong>.';
  card.appendChild(intro);

  const rows = [
    { key: 'despachoOffset', label: 'Corte → despacho (meses)' },
    { key: 'outExtra', label: 'Extra fuera de campaña (meses)' },
  ];
  rows.forEach(({ key, label }) => {
    const row = document.createElement('div');
    row.className = 'win-offset-row';
    const lab = document.createElement('span');
    lab.textContent = label;
    row.appendChild(lab);
    const input = document.createElement('input');
    input.type = 'number';
    input.min = '0'; input.max = '6'; input.step = '1';
    input.className = 'metas-input';
    input.value = windows[key];
    input.setAttribute('aria-label', label);
    input.addEventListener('change', (e) => onOffset(key, e.target.value));
    row.appendChild(input);
    card.appendChild(row);
  });
  return card;
}
