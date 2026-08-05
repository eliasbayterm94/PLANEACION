import {
  MONTHS, monthName, mod12, FLUJO_AXIS, FLUJO_YSEP, flujoPos,
  despachoMonths, listWarehouses, containersToKg, YEAR,
} from '../model.js';

/** Two-digit year for an axis position: the operative block is the prior year. */
const posYear = (p) => String(p < FLUJO_YSEP ? YEAR - 1 : YEAR).slice(2);

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
    + `<div class="yb" style="grid-column:2 / 7">${YEAR - 1} · operativo</div>`
    + `<div class="yb yb-2" style="grid-column:7 / 19">${YEAR} · año de venta</div>`
    + (hasSigma ? '<div class="yb-lab"></div>' : '');
}

// A shipment's despacho: Oct–Dic land in the prior/operative year (2026), the
// rest in the sales year — so the shipping cycle reads Oct→Sep left to right.
function despachoPos(m) {
  const mm = mod12(m);
  return mm >= 9 ? mm - 7 : 5 + mm;
}
// Commercial campaign of a despacho by calendar: Oct–Mar = C1, Abr–Sep = C2.
function despCamp(m) {
  const mm = mod12(m);
  return (mm >= 9 || mm <= 2) ? 1 : 2;
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

/** Container batches for a warehouse, numbered in cycle order (Oct→Sep). */
function warehouseChains(w, months, windows) {
  const lead = Math.round(w.lead);
  return Object.entries(months)
    .map(([mm, n]) => ({ month: +mm, n, d: despachoPos(+mm) }))
    .sort((a, b) => a.d - b.d)
    .map((bt, i) => ({
      id: `${w.name}-${i + 1}`,
      seq: i + 1,
      n: bt.n,
      camp: despCamp(bt.month),
      c: bt.d - windows.despachoOffset,
      d: bt.d,
      l: bt.d + lead,
      readout: `${w.name}-${i + 1} · Corte ${monthName(mod12(bt.month - windows.despachoOffset))} ${posYear(bt.d - windows.despachoOffset)} → `
        + `Despacho ${monthName(bt.month)} ${posYear(bt.d)} → Llega ${monthName(mod12(bt.month + lead))} ${posYear(bt.d + lead)} · ${bt.n} cont`,
    }))
    .filter((x) => x.c >= 0 && x.l < 17);
}

/**
 * Destino — "carriles con flujo": three fixed lanes per warehouse (Corte ·
 * Despacho · Llegada) so the stage is never ambiguous, with each container's
 * chain drawn as diagonals across the lanes. The diagonals run through the
 * gutter between lanes, so they stay visible even when every month carries a
 * marker; all chains share the same geometry, so they read as a cascade, and
 * a shallower slope literally means a longer lead.
 */
function destinoSection(markets, whList, despWh, windows, filter) {
  const sec = document.createElement('section');
  sec.className = 'flujo-sec';
  sec.innerHTML = '<div class="sec-head"><h3 class="section-title">Destino — corte, despacho y llegada por bodega</h3></div>'
    + '<div class="flujo-legend">'
    + '<span class="li"><span class="k-node k-c"></span><b>Corte</b> confirma e inicia producción</span>'
    + '<span class="li"><span class="k-run"></span> producción + trilla</span>'
    + '<span class="li"><span class="k-node k-d"></span><b>Despacho</b></span>'
    + '<span class="li"><span class="k-run"></span> tránsito</span>'
    + '<span class="li"><span class="k-node k-l"></span><b>Llegada</b> · disponible para vender</span>'
    + '<span class="li flujo-hint"><i data-lucide="mouse-pointer-2"></i> pasa el cursor por una cadena para aislarla</span>'
    + '</div>';

  const scroll = document.createElement('div');
  scroll.className = 'flujo-scroll';
  const inner = document.createElement('div');
  inner.className = 'fd-inner';

  let html = `<div class="fd-grid">${yearBand(false)}<div class="mhead corner">Bodega · etapa</div>${headCells()}</div>`;

  markets.forEach((mk) => {
    if (filter.market && mk.slug !== filter.market) return;
    const whs = whList.filter((w) => w.market === mk.slug && (!filter.wh || w.name === filter.wh));
    if (!whs.length) return;
    html += `<div class="fd-grid"><div class="fgrp">${mk.name}</div></div>`;

    whs.forEach((w) => {
      const chains = warehouseChains(w, despWh[w.name] || {}, windows);
      const tot = chains.reduce((s, x) => s + x.n, 0);
      const at = { c: {}, d: {}, l: {} };
      chains.forEach((x) => { at.c[x.c] = x; at.d[x.d] = x; at.l[x.l] = x; });

      let cells = '';
      [['c', 0], ['d', 1], ['l', 2]].forEach(([key, row]) => {
        for (let p = 0; p < 17; p += 1) {
          const x = at[key][p];
          let mk2 = '';
          if (x) {
            const cls = key === 'l' ? 'fdm-l' : `${key === 'c' ? 'fdm-c' : 'fdm-d'} c${x.camp}`;
            mk2 = `<span class="fdm ${cls}" data-cid="${x.id}">${x.n}<sup class="fseq">${x.seq}</sup></span>`;
          }
          const noarr = row === 2 && isNoArr(p) ? ' noarr' : '';
          cells += `<div class="fd-cell${row === 2 ? ' r3' : ''}${p === FLUJO_YSEP ? ' ysep' : ''}${noarr}">${mk2}</div>`;
        }
      });

      const paths = chains.map((x) => {
        const pts = [[x.c + 0.5, 0.5], [x.d + 0.5, 1.5], [x.l + 0.5, 2.5]].map(([a, b]) => `${a},${b}`).join(' ');
        const stroke = x.camp === 1 ? 'var(--fc-blue-700)' : 'var(--fc-yellow-700)';
        return `<polyline points="${pts}" stroke="${stroke}" vector-effect="non-scaling-stroke" data-cid="${x.id}"></polyline>`
          + `<polyline class="hit" points="${pts}" stroke="transparent" vector-effect="non-scaling-stroke" data-cid="${x.id}"></polyline>`;
      }).join('');

      html += `<div class="fd-grid fd-row">
        <div class="fd-head"><span class="n">${w.name}</span><span class="s">${mk.name} · lead ${w.lead}m · ${tot} cont · ${chains.length} embarques</span><span class="fd-readout" data-readout="${w.name}"></span></div>
        <div class="fd-labels"><div><span class="ic">◆</span>Corte</div><div><span class="ic">▸</span>Despacho</div><div><span class="ic">▮</span>Llegada</div></div>
        <div class="fd-canvas" data-wh="${w.name}">
          <svg class="fd-weave" viewBox="0 0 17 3" preserveAspectRatio="none">${paths}</svg>
          <div class="fd-cells">${cells}</div>
        </div>
      </div>`;
    });
  });

  inner.innerHTML = html;

  // Hover a marker or its line → isolate that chain, dim the rest, and spell it
  // out in the warehouse header (a fixed readout never covers the grid).
  inner.querySelectorAll('.fd-canvas').forEach((canvas) => {
    const readout = inner.querySelector(`[data-readout="${canvas.dataset.wh}"]`);
    const wh = whList.find((x) => x.name === canvas.dataset.wh);
    const byId = {};
    warehouseChains(wh, despWh[wh.name] || {}, windows).forEach((x) => { byId[x.id] = x.readout; });
    canvas.addEventListener('mouseover', (e) => {
      const t = e.target.closest('[data-cid]');
      if (!t) return;
      const { cid } = t.dataset;
      canvas.classList.add('has-focus');
      canvas.querySelectorAll('.on').forEach((n) => n.classList.remove('on'));
      canvas.querySelectorAll(`[data-cid="${cid}"]`).forEach((n) => n.classList.add('on'));
      if (readout) { readout.textContent = byId[cid] || ''; readout.classList.add('show'); }
    });
    canvas.addEventListener('mouseleave', () => {
      canvas.classList.remove('has-focus');
      canvas.querySelectorAll('.on').forEach((n) => n.classList.remove('on'));
      if (readout) readout.classList.remove('show');
    });
  });

  scroll.appendChild(inner);
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
