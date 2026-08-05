import {
  MONTHS, monthName, mod12, FLUJO_AXIS, FLUJO_YSEP, flujoPos,
  despachoMonths, campaignOfDespacho, listWarehouses, containersToKg,
} from '../model.js';

/**
 * Flujo — read-only roadmap for operations & sales, fed by the salidas inputs.
 *
 * A 17-month axis (Ago–Dic of the operative year + Ene–Dic of the sales year)
 * shows two lenses on the same timeline:
 *   · Ventanas de campaña: cosechas (reference) + muestra→corte→producción→
 *     trilla→despacho→disponible per commercial campaign (from `windows`).
 *   · Destino por bodega: corte de confirmación → despacho → llegada, derived
 *     from the shipments and each warehouse's lead. Nothing is edited here.
 */
export function renderFlujo({ schedules, markets, warehouses, shipments, windows, filter, onFilter }) {
  const el = document.createElement('div');
  el.className = 'flujo-view';
  const whList = listWarehouses(warehouses, markets);
  const despWh = despachosByWarehouse(shipments);
  const totalCont = Object.values(despWh).reduce((s, m) => s + Object.values(m).reduce((a, b) => a + b, 0), 0);

  el.appendChild(header());
  el.appendChild(kpis(totalCont, schedules.length, whList.length));
  el.appendChild(filterBar(markets, whList, schedules, filter, onFilter));
  el.appendChild(windowsSection(schedules, windows, filter));
  el.appendChild(destinoSection(markets, whList, despWh, windows, filter));
  el.appendChild(foot(windows));
  return el;
}

// --- axis helpers -----------------------------------------------------------
const NOARR = new Set([3, 4, 5, 6]); // Abr–Jul, no arrival on the standard lane
const isNoArr = (p) => FLUJO_AXIS[p].block === 'venta' && NOARR.has(FLUJO_AXIS[p].month);

function headCells() {
  return FLUJO_AXIS.map((a, p) => {
    const cls = ['mhead'];
    if (isNoArr(p)) cls.push('q-off');
    if (p === FLUJO_YSEP) cls.push('ysep');
    return `<div class="${cls.join(' ')}">${MONTHS[a.month]}</div>`;
  }).join('');
}

function yearBand(hasSigma) {
  return '<div class="yb-lab"></div>'
    + '<div class="yb" style="grid-column:2 / 7">Año operativo</div>'
    + '<div class="yb yb-2" style="grid-column:7 / 19">Año de venta</div>'
    + (hasSigma ? '<div class="yb-lab"></div>' : '');
}

// --- header + kpis ----------------------------------------------------------
function header() {
  const head = document.createElement('div');
  head.className = 'view-head';
  head.innerHTML = `
    <h2>Flujo de programación</h2>
    <p class="view-sub">Roadmap de solo lectura, alimentado por <strong>Programación de salidas</strong>. La
      <strong>campaña</strong> es cuándo el café queda <strong>disponible para vender</strong>; corte, producción,
      trilla y despacho son las etapas operativas. El eje muestra el año de venta con el arranque operativo del año
      anterior.</p>`;
  return head;
}

function kpis(cont, nRegions, nWh) {
  const wrap = document.createElement('div');
  wrap.className = 'flujo-strip';
  const items = [
    [cont, 'Contenedores'],
    [Math.round(containersToKg(cont)).toLocaleString('es-CO'), 'kg planeados'],
    [nRegions, 'Regiones origen'],
    [nWh, 'Bodegas destino'],
  ];
  items.forEach(([n, l]) => {
    const k = document.createElement('div');
    k.className = 'flujo-kpi';
    k.innerHTML = `<div class="n">${n}</div><div class="l">${l}</div>`;
    wrap.appendChild(k);
  });
  return wrap;
}

// --- filters ----------------------------------------------------------------
function filterBar(markets, whList, schedules, filter, onFilter) {
  const bar = document.createElement('div');
  bar.className = 'flujo-filters';
  bar.innerHTML = '<span class="fl-label">Filtrar</span>';

  const mkOpts = [['', 'Todas'], ...markets.map((m) => [m.slug, m.name])];
  bar.appendChild(select('Región destino', mkOpts, filter.market, (v) => { onFilter('market', v); onFilter('wh', ''); }));

  const whInMarket = whList.filter((w) => !filter.market || w.market === filter.market);
  const whOpts = [['', 'Todas'], ...whInMarket.map((w) => [w.name, w.name])];
  bar.appendChild(select('Bodega', whOpts, filter.wh, (v) => onFilter('wh', v)));

  const orOpts = [['', 'Todas'], ...schedules.map((r) => [r.slug, r.name])];
  bar.appendChild(select('Región origen', orOpts, filter.origin, (v) => onFilter('origin', v)));
  return bar;
}

function select(label, options, value, onChange) {
  const l = document.createElement('label');
  l.textContent = label + ' ';
  const s = document.createElement('select');
  options.forEach(([val, txt]) => {
    const o = document.createElement('option');
    o.value = val; o.textContent = txt;
    if (val === value) o.selected = true;
    s.appendChild(o);
  });
  s.addEventListener('change', (e) => onChange(e.target.value));
  l.appendChild(s);
  return l;
}

// --- Ventanas de campaña (cosechas + campaign lanes) ------------------------
function feedsCampaign(schedule) {
  const late = (schedule.cosecha || []).filter((m) => m >= 7).length;
  return late > (schedule.cosecha || []).length / 2 ? 1 : 2;
}

function bar(styleKey, color) {
  if (styleKey === 'solid') return `<span class="fbar" style="background:${color}"></span>`;
  if (styleKey === 'mid') return `<span class="fbar" style="background:color-mix(in srgb, ${color} 48%, transparent)"></span>`;
  if (styleKey === 'faint') return `<span class="fbar" style="background:color-mix(in srgb, ${color} 22%, transparent)"></span>`;
  if (styleKey === 'op') return '<span class="fbar" style="background:repeating-linear-gradient(45deg,color-mix(in srgb,var(--fc-ink-500) 42%,transparent) 0 3px,transparent 3px 6px)"></span>';
  return `<span class="fbar" style="border:2px solid ${color};background:transparent"></span>`; // out
}

function laneRow(label, positions, styleKey, color) {
  const cells = FLUJO_AXIS.map((_, p) => {
    const b = positions.has(p) ? bar(styleKey, color) : '';
    return `<div class="flane${p === FLUJO_YSEP ? ' ysep' : ''}">${b}</div>`;
  }).join('');
  return `<div class="flabel flabel--op">${label}</div>${cells}`;
}

function posSet(months, campaign) {
  return new Set(months.map((m) => flujoPos(mod12(m), campaign)));
}

function windowsSection(schedules, windows, filter) {
  const sec = document.createElement('section');
  sec.className = 'flujo-sec';
  sec.innerHTML = '<div class="sec-head"><h3 class="section-title">Ventanas de campaña</h3></div>'
    + '<p class="sec-note">Cosechas por región (referencia) y el flujo operativo por campaña: '
    + 'corte → producción → trilla → despacho → disponible. Editable en <em>Ventanas de campaña</em>.</p>';

  const scroll = document.createElement('div');
  scroll.className = 'flujo-scroll';
  const grid = document.createElement('div');
  grid.className = 'flujo-grid';

  let html = yearBand(false) + '<div class="mhead corner">Ventana</div>' + headCells();
  html += '<div class="fgrp sub">Cosechas por región · referencia</div>';
  schedules.forEach((r) => {
    if (filter.origin && r.slug !== filter.origin) return;
    const feeds = feedsCampaign(r);
    const set = posSet(r.cosecha || [], feeds);
    const cells = FLUJO_AXIS.map((_, p) => `<div class="flane cos${p === FLUJO_YSEP ? ' ysep' : ''}">${set.has(p) ? '<span class="cbar"></span>' : ''}</div>`).join('');
    html += `<div class="flabel flabel--cos">${r.name}</div>${cells}`;
  });

  [1, 2].forEach((camp) => {
    const c = windows.campaigns[camp];
    html += `<div class="fgrp">${c.name} · disponible ${rangeLabel(c.disp)}</div>`;
    html += laneRow('Muestras', posSet(c.corte.map((m) => m - 1), camp), 'faint', c.color);
    html += laneRow('Corte', posSet(c.corte, camp), 'mid', c.color);
    html += laneRow('Producción', posSet(c.corte.flatMap((m) => [m, m + 1]), camp), 'op', c.color);
    html += laneRow('Trilla / empaque', posSet(c.corte.flatMap((m) => [m + 1, m + 2]), camp), 'op', c.color);
    html += laneRow(`Despacho (corte +${windows.despachoOffset})`, posSet(despachoMonths(windows, camp), camp), 'out', c.color);
    html += laneRow('Disponible', posSet(c.disp, camp), 'solid', c.color);
  });

  grid.innerHTML = html;
  scroll.appendChild(grid);
  sec.appendChild(scroll);
  return sec;
}

function rangeLabel(months) {
  if (!months.length) return '—';
  const s = [...months].sort((a, b) => a - b);
  return `${monthName(s[0])}–${monthName(s[s.length - 1])}`;
}

// --- Destino por bodega -----------------------------------------------------
function despachosByWarehouse(shipments) {
  const out = {};
  Object.values(shipments || {}).forEach((cty) => {
    const ship = cty?.ship || {};
    Object.entries(ship).forEach(([wh, months]) => {
      out[wh] = out[wh] || {};
      Object.entries(months || {}).forEach(([m, n]) => { out[wh][+m] = (out[wh][+m] || 0) + (Number(n) || 0); });
    });
  });
  return out;
}

function destinoSection(markets, whList, despWh, windows, filter) {
  const sec = document.createElement('section');
  sec.className = 'flujo-sec';
  sec.innerHTML = '<div class="sec-head"><h3 class="section-title">Destino — confirmación, despacho y llegada por bodega</h3></div>'
    + '<div class="flujo-legend">'
    + '<span class="li"><span class="fl fl-conf c1" style="padding:2px 8px">◆</span> Corte confirmación</span>'
    + '<span class="li"><span class="fl fl-d c1" style="padding:2px 8px">▸</span> Despacho C1</span>'
    + '<span class="li"><span class="fl fl-d c2" style="padding:2px 8px">▸</span> Despacho C2</span>'
    + '<span class="li"><span class="fl fl-l" style="padding:2px 8px">▮</span> Llegada · disponible</span>'
    + '<span class="li flujo-hint"><i data-lucide="mouse-pointer-2"></i> pasa el cursor sobre un marcador para trazar su cadena</span>'
    + '</div>';

  const scroll = document.createElement('div');
  scroll.className = 'flujo-scroll';
  const grid = document.createElement('div');
  grid.className = 'flujo-grid flujo-grid--destino';

  let html = yearBand(true) + '<div class="mhead corner">Mercado · bodega</div>' + headCells()
    + '<div class="mhead" style="text-align:right;padding-right:10px">Σ</div>';

  markets.forEach((mk) => {
    if (filter.market && mk.slug !== filter.market) return;
    const whs = whList.filter((w) => w.market === mk.slug && (!filter.wh || w.name === filter.wh));
    if (!whs.length) return;
    html += `<div class="fgrp">${mk.name}</div>`;
    whs.forEach((w, wi) => {
      const months = despWh[w.name] || {};
      // One "chain" (batch) per despacho month for this warehouse: its corte,
      // despacho and llegada share a data-chain id so hover can link them.
      const cell = Array.from({ length: 17 }, () => []);
      let tot = 0;
      Object.entries(months).forEach(([mm, n]) => {
        const month = +mm;
        const camp = campaignOfDespacho(windows, month) || 2;
        const lead = Math.round(w.lead);
        const dPos = flujoPos(month, camp);
        const cPos = dPos - windows.despachoOffset;
        const lPos = dPos + lead;
        const id = `${mk.slug}-${wi}-${month}`;
        const corteM = mod12(month - windows.despachoOffset);
        const llegaM = mod12(month + lead);
        const title = `Corte ${monthName(corteM)} → Despacho ${monthName(month)} → Llega ${w.name} ${monthName(llegaM)} · ${n} cont`;
        if (cPos >= 0 && cPos < 17) cell[cPos].push({ t: 'conf', n, camp, id, title });
        if (dPos >= 0 && dPos < 17) cell[dPos].push({ t: 'd', n, camp, id, title });
        if (lPos >= 0 && lPos < 17) cell[lPos].push({ t: 'l', n, id, title });
        tot += n;
      });
      const cells = FLUJO_AXIS.map((_, p) => {
        const inner = cell[p].map((m) => {
          if (m.t === 'conf') return `<div class="fl fl-conf c${m.camp}" data-chain="${m.id}" title="${m.title}"><span class="sym">◆</span> ${m.n}</div>`;
          if (m.t === 'd') return `<div class="fl fl-d c${m.camp}" data-chain="${m.id}" title="${m.title}"><span class="sym">▸</span> ${m.n}</div>`;
          return `<div class="fl fl-l" data-chain="${m.id}" title="${m.title}"><span class="sym">▮</span> ${m.n}</div>`;
        }).join('');
        return `<div class="fcell${isNoArr(p) ? ' noarr' : ''}${p === FLUJO_YSEP ? ' ysep' : ''}">${inner}</div>`;
      }).join('');
      html += `<div class="flabel"><span class="fl-name">${w.name}</span><span class="fl-sub">lead ${w.lead}m</span></div>${cells}<div class="ftot">${tot}</div>`;
    });
  });

  grid.innerHTML = html;
  // Hover any marker → highlight its whole corte→despacho→llegada chain.
  grid.addEventListener('mouseover', (e) => {
    const el = e.target.closest('[data-chain]');
    if (!el) return;
    grid.querySelectorAll(`[data-chain="${el.dataset.chain}"]`).forEach((m) => m.classList.add('chain-hi'));
  });
  grid.addEventListener('mouseout', (e) => {
    if (!e.target.closest('[data-chain]')) return;
    grid.querySelectorAll('.chain-hi').forEach((m) => m.classList.remove('chain-hi'));
  });
  scroll.appendChild(grid);
  sec.appendChild(scroll);
  return sec;
}

function foot(windows) {
  const p = document.createElement('p');
  p.className = 'view-sub flujo-foot';
  p.innerHTML = `Solo lectura — se alimenta de <strong>Programación de salidas</strong>. El <strong>corte de confirmación</strong>
    va <strong>${windows.despachoOffset} meses antes del despacho</strong> (producción + trilla); llegada = despacho + lead de bodega = disponible para vender.`;
  return p;
}
