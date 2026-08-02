import {
  monthName, CUTOFF_DAY, OFFSETS, mod12, campaignOfMonth, CAMPAIGNS,
  allocateProduct, marketGoalTotal, warehouseGoalTotal,
  kgToContainers, DEFAULT_COMPROMETIDO_PCT, poolCapacity,
} from '../model.js';

/**
 * Products view — editable catalogue (via the modal) + capacity commitment plan.
 *
 * Products come from `state.catalog` (name, category, startCorte). They are
 * grouped by their start cutoff within the campaign. Per product: Capacidad (kg)
 * fair-shared across sales regions by meta, split Comprometido/Libre. Category
 * (MIRC subcats / Community) shows as a tag.
 */
export function renderProducts({
  campaign, markets, warehouses, goals, alloc, catalog,
  onCap, onProductPct, onOverride, onGlobalPct, onManage, onPoolPct, onPoolOverride,
}) {
  const el = document.createElement('div');
  const products = alloc?.products || {};
  const globalPct = alloc?.pctComprometido ?? DEFAULT_COMPROMETIDO_PCT;
  const catById = Object.fromEntries((catalog?.categories || []).map((c) => [c.key, c]));

  const marketMetas = markets.map((mk) => ({
    slug: mk.slug, name: mk.name, meta: marketMeta(goals, mk, warehouses),
  }));

  // Products of this campaign, grouped by start cutoff.
  const mine = (catalog?.products || []).filter((p) => campaignOfMonth(p.startCorte) === campaign);
  const cortes = [...new Set(mine.map((p) => p.startCorte))]
    .sort((a, b) => order(a, campaign) - order(b, campaign));

  const poolById = Object.fromEntries((catalog?.pools || []).map((pl) => [pl.id, pl]));

  const camPools = (catalog?.pools || []).filter((pl) => Number(pl.campaign) === campaign);

  el.appendChild(header(campaign, globalPct, onGlobalPct, onManage));
  el.appendChild(rollup(mine, camPools, marketMetas, alloc, globalPct, catalog));

  if (camPools.length) {
    const sec = document.createElement('div');
    const title = document.createElement('h3');
    title.className = 'section-title';
    title.textContent = 'Pools — reparto a nivel pool';
    sec.appendChild(title);
    camPools.forEach((pl) => sec.appendChild(poolCard(pl, catalog, alloc, marketMetas, globalPct, onPoolPct, onPoolOverride)));
    el.appendChild(sec);
  }

  cortes.forEach((corte) => {
    const items = mine.filter((p) => p.startCorte === corte).sort((a, b) => a.name.localeCompare(b.name));
    el.appendChild(corteCard(corte, campaign, items, catById, poolById, marketMetas, products, globalPct, onCap, onProductPct, onOverride));
  });

  if (!mine.length) {
    const empty = document.createElement('p');
    empty.className = 'wh-empty';
    empty.textContent = 'No hay productos en esta campaña. Agrégalos en Gestionar productos.';
    el.appendChild(empty);
  }

  return el;
}

function marketMeta(goals, mk, warehouses) {
  if (mk.goalsByWarehouse) {
    return (warehouses[mk.slug]?.warehouses || []).reduce((s, w) => s + warehouseGoalTotal(goals, w.name), 0);
  }
  return marketGoalTotal(goals, mk.slug);
}

function header(campaign, globalPct, onGlobalPct, onManage) {
  const head = document.createElement('div');
  head.className = 'view-head';

  const bar = document.createElement('div');
  bar.className = 'prod-head-bar';
  const h = document.createElement('h2');
  h.textContent = `Productos y compromisos — ${CAMPAIGNS[campaign].name}`;
  bar.appendChild(h);
  const manage = document.createElement('button');
  manage.type = 'button';
  manage.className = 'btn';
  manage.innerHTML = '<i data-lucide="settings-2"></i> Gestionar productos';
  manage.addEventListener('click', onManage);
  bar.appendChild(manage);
  head.appendChild(bar);

  const sub = document.createElement('p');
  sub.className = 'view-sub';
  sub.innerHTML = `
    Capacidad por producto (kg) repartida por región de venta según su
    <strong>meta</strong>, dividida en <strong>Comprometido</strong> + <strong>Libre</strong>.
    Overrides fijan kg; el resto se redistribuye.`;
  head.appendChild(sub);

  const ctl = document.createElement('div');
  ctl.className = 'prod-global';
  ctl.innerHTML = '<span>Comprometido global</span>';
  const input = document.createElement('input');
  input.type = 'number';
  input.min = '0'; input.max = '100'; input.step = '5';
  input.className = 'metas-input';
  input.value = globalPct;
  input.setAttribute('aria-label', 'Porcentaje comprometido global');
  input.addEventListener('change', (e) => onGlobalPct(Math.min(100, Math.max(0, Number(e.target.value) || 0))));
  ctl.appendChild(input);
  const suffix = document.createElement('span');
  suffix.textContent = `% · Libre ${100 - globalPct}%`;
  ctl.appendChild(suffix);
  head.appendChild(ctl);

  return head;
}

function poolEntry(pl, catalog, alloc) {
  const a = alloc?.pools?.[pl.id] || {};
  const memberCap = poolCapacity(catalog, alloc, pl.id);
  // Fall back to the pool's meta as planned capacity when no per-member caps are
  // set yet (the sheet only gives the pool's combined kg). Real member caps win.
  const cap = memberCap > 0 ? memberCap : (Number(pl.meta) || 0);
  return { cap, memberCap, pct: a.pct ?? null, ov: a.ov || {} };
}

function rollup(mine, camPools, marketMetas, alloc, globalPct, catalog) {
  const products = alloc?.products || {};
  const perMarket = {};
  marketMetas.forEach((m) => { perMarket[m.slug] = { comprometido: 0, libre: 0 }; });
  let totalCap = 0;
  const add = (entry) => {
    const a = allocateProduct(entry, marketMetas, globalPct);
    marketMetas.forEach((m) => {
      perMarket[m.slug].comprometido += a.byMarket[m.slug].comprometido;
      perMarket[m.slug].libre += a.byMarket[m.slug].libre;
    });
  };
  // Non-pooled products allocate individually; pooled products roll into the pool.
  mine.filter((p) => !p.pool).forEach((p) => {
    const entry = products[p.id];
    if (!entry) return;
    totalCap += Number(entry.cap) || 0;
    add(entry);
  });
  camPools.forEach((pl) => {
    const entry = poolEntry(pl, catalog, alloc);
    totalCap += entry.cap;
    add(entry);
  });
  const totalMeta = marketMetas.reduce((s, m) => s + m.meta, 0);

  const wrap = document.createElement('div');
  const fill = document.createElement('div');
  fill.className = 'prod-fill';
  const fillPct = totalMeta ? Math.round((totalCap / totalMeta) * 100) : 0;
  const capLabel = camPools.length ? 'Capacidad total (incl. pools)' : 'Capacidad total';
  fill.innerHTML =
    `${capLabel} <strong>${fmtKg(totalCap)}</strong> (${kgToContainers(totalCap).toFixed(1)} cont) · ` +
    `Meta total <strong>${fmtKg(totalMeta)}</strong> · ` +
    `<strong class="tally tally--${fillPct >= 100 ? 'exact' : 'under'}">fill ${fillPct}%</strong>`;
  wrap.appendChild(fill);

  const cards = document.createElement('div');
  cards.className = 'prod-rollup';
  marketMetas.forEach((m) => {
    const r = perMarket[m.slug];
    const total = r.comprometido + r.libre;
    const cov = m.meta ? Math.round((total / m.meta) * 100) : 0;
    const card = document.createElement('div');
    card.className = 'prod-rollup-card';
    card.innerHTML =
      `<div class="prod-rollup-name">${m.name}</div>` +
      `<div class="prod-rollup-bar">` +
        `<span class="seg seg-base" style="flex:${r.comprometido || 0}"></span>` +
        `<span class="seg seg-libre" style="flex:${r.libre || 0}"></span>` +
        `<span class="seg seg-gap" style="flex:${Math.max(0, m.meta - total) || 0}"></span>` +
      `</div>` +
      `<div class="prod-rollup-nums">` +
        `<span><i class="dot dot-base"></i>Comp ${fmtKg(r.comprometido)}</span>` +
        `<span><i class="dot dot-libre"></i>Libre ${fmtKg(r.libre)}</span>` +
      `</div>` +
      `<div class="prod-rollup-meta">${fmtKg(total)} plan${m.meta ? ` · meta ${fmtKg(m.meta)} · ${cov}%` : ' · sin meta'}</div>`;
    cards.appendChild(card);
  });
  wrap.appendChild(cards);
  return wrap;
}

function poolCard(pl, catalog, alloc, marketMetas, globalPct, onPoolPct, onPoolOverride) {
  const entry = poolEntry(pl, catalog, alloc);
  const cap = entry.cap;
  const memberCap = entry.memberCap;
  const meta = Number(pl.meta) || 0;
  const members = (catalog.products || []).filter((p) => p.pool === pl.id).length;
  const fill = meta ? Math.round((memberCap / meta) * 100) : 0;

  const card = document.createElement('article');
  card.className = 'card prod-card';
  const camp = Number(pl.campaign) || 1;
  card.style.setProperty('--accent', CAMPAIGNS[camp].color);

  const h = document.createElement('header');
  h.className = 'card-head';
  const capLabel = memberCap > 0
    ? `${fmtKg(memberCap)} cap${meta ? ` · meta ${fmtKg(meta)} · ${fill}%` : ''}`
    : `${fmtKg(cap)} plan (= meta)`;
  h.innerHTML =
    `<span class="card-cut">${pl.name}</span>` +
    `<span class="card-sample">${capLabel} · ${members} productos</span>`;
  card.appendChild(h);

  const body = document.createElement('div');
  body.className = 'prod-items';

  const item = document.createElement('div');
  item.className = 'prod-item';
  const head = document.createElement('div');
  head.className = 'prod-item-head prod-cap-head';
  head.innerHTML = '<span class="prod-item-name">Reparto del pool por mercado</span>';
  const pctInput = document.createElement('input');
  pctInput.type = 'number'; pctInput.min = '0'; pctInput.max = '100'; pctInput.step = '5';
  pctInput.className = 'alloc-input prod-pct-input';
  pctInput.value = entry.pct != null ? entry.pct : '';
  pctInput.placeholder = `${globalPct}%`;
  pctInput.title = 'Comprometido % del pool (vacío = global)';
  pctInput.setAttribute('aria-label', `Comprometido % del pool ${pl.name}`);
  pctInput.addEventListener('change', (e) => {
    const raw = e.target.value;
    onPoolPct(pl.id, raw === '' ? null : Math.min(100, Math.max(0, Number(raw) || 0)));
  });
  head.appendChild(pctInput);
  item.appendChild(head);

  if (cap > 0) {
    const a = allocateProduct(entry, marketMetas, globalPct);
    const grid = document.createElement('div');
    grid.className = 'prod-breakdown';
    marketMetas.filter((m) => m.meta > 0 || (entry.ov && entry.ov[m.slug] != null)).forEach((m) => {
      const c = a.byMarket[m.slug];
      const row = document.createElement('div');
      row.className = 'prod-bd-row';
      row.innerHTML =
        `<span class="prod-bd-mk">${m.name}${c.locked ? ' <span class="row-meta">fijo</span>' : ''}</span>` +
        `<span class="prod-bd-val">C ${fmtKg(c.comprometido)} · L ${fmtKg(c.libre)}</span>`;
      const ov = document.createElement('input');
      ov.type = 'number'; ov.min = '0'; ov.step = '1000';
      ov.className = 'alloc-input prod-ov-input';
      ov.value = entry.ov && entry.ov[m.slug] != null ? entry.ov[m.slug] : '';
      ov.placeholder = `auto ${Math.round(c.total).toLocaleString('es-CO')}`;
      ov.title = 'Override kg del pool (vacío = automático por meta)';
      ov.setAttribute('aria-label', `Override del pool ${pl.name} en ${m.name}`);
      ov.addEventListener('change', (e) => {
        const raw = e.target.value;
        onPoolOverride(pl.id, m.slug, raw === '' ? null : Math.max(0, Number(raw) || 0));
      });
      row.appendChild(ov);
      grid.appendChild(row);
    });
    if (a.unassigned > 0) {
      const warn = document.createElement('div');
      warn.className = 'prod-unassigned';
      warn.textContent = `Sin asignar: ${fmtKg(a.unassigned)} (revisa metas u overrides)`;
      grid.appendChild(warn);
    }
    item.appendChild(grid);
  } else {
    const note = document.createElement('p');
    note.className = 'view-sub';
    note.style.margin = '4px 0 0';
    note.textContent = 'Sin capacidad aún — carga capacidad en los productos del pool.';
    item.appendChild(note);
  }

  body.appendChild(item);
  card.appendChild(body);
  return card;
}

function corteCard(corte, campaign, items, catById, poolById, marketMetas, products, globalPct, onCap, onProductPct, onOverride) {
  const sampleMonth = mod12(corte + OFFSETS.corteToMuestra);
  const card = document.createElement('article');
  card.className = 'card prod-card';
  card.style.setProperty('--accent', CAMPAIGNS[campaign].color);

  const h = document.createElement('header');
  h.className = 'card-head';
  const ord = order(corte, campaign);
  h.innerHTML =
    `<span class="card-cut">Corte ${ord > 0 ? ord : '—'} · ${monthName(corte)} ${CUTOFF_DAY}</span>` +
    `<span class="card-sample">Muestras desde ${monthName(sampleMonth)}</span>`;
  card.appendChild(h);

  const list = document.createElement('div');
  list.className = 'prod-items';
  items.forEach((p) => {
    list.appendChild(productItem(p, catById, poolById, marketMetas, products, globalPct, onCap, onProductPct, onOverride));
  });
  card.appendChild(list);
  return card;
}

function productItem(p, catById, poolById, marketMetas, products, globalPct, onCap, onProductPct, onOverride) {
  const key = p.id;
  const entry = products[key] || {};
  const cap = Number(entry.cap) || 0;

  const wrap = document.createElement('div');
  wrap.className = 'prod-item';

  const head = document.createElement('div');
  head.className = 'prod-item-head prod-cap-head';
  const nameWrap = document.createElement('span');
  nameWrap.className = 'prod-item-name';
  nameWrap.textContent = p.name;
  const cat = catById[p.category];
  if (cat) {
    const tag = document.createElement('span');
    tag.className = 'prod-cat-tag' + (cat.macro === 'mirc' ? ' is-mirc' : ' is-community');
    tag.textContent = cat.name;
    nameWrap.appendChild(tag);
  }
  if (p.pool && poolById[p.pool]) {
    const ptag = document.createElement('span');
    ptag.className = 'prod-cat-tag is-pool';
    ptag.textContent = poolById[p.pool].name;
    nameWrap.appendChild(ptag);
  }
  head.appendChild(nameWrap);

  const capInput = document.createElement('input');
  capInput.type = 'number';
  capInput.min = '0'; capInput.step = '1000';
  capInput.className = 'alloc-input prod-cap-input';
  capInput.value = cap || '';
  capInput.placeholder = 'Capacidad kg';
  capInput.setAttribute('aria-label', `Capacidad de ${p.name} en kg`);
  capInput.addEventListener('change', (e) => onCap(key, Math.max(0, Number(e.target.value) || 0)));
  head.appendChild(capInput);

  if (!p.pool) {
    const pctInput = document.createElement('input');
    pctInput.type = 'number';
    pctInput.min = '0'; pctInput.max = '100'; pctInput.step = '5';
    pctInput.className = 'alloc-input prod-pct-input';
    pctInput.value = entry.pct != null ? entry.pct : '';
    pctInput.placeholder = `${globalPct}%`;
    pctInput.title = 'Comprometido % (vacío = global)';
    pctInput.setAttribute('aria-label', `Comprometido % de ${p.name}`);
    pctInput.addEventListener('change', (e) => {
      const raw = e.target.value;
      onProductPct(key, raw === '' ? null : Math.min(100, Math.max(0, Number(raw) || 0)));
    });
    head.appendChild(pctInput);
  }
  wrap.appendChild(head);

  if (p.pool && poolById[p.pool]) {
    const note = document.createElement('div');
    note.className = 'prod-pool-note';
    note.textContent = `Aporta al pool "${poolById[p.pool].name}" — el reparto por mercado se hace a nivel pool.`;
    wrap.appendChild(note);
  } else if (cap > 0) {
    const a = allocateProduct(entry, marketMetas, globalPct);
    const grid = document.createElement('div');
    grid.className = 'prod-breakdown';
    marketMetas.filter((m) => m.meta > 0 || (entry.ov && entry.ov[m.slug] != null)).forEach((m) => {
      const c = a.byMarket[m.slug];
      const row = document.createElement('div');
      row.className = 'prod-bd-row';
      row.innerHTML =
        `<span class="prod-bd-mk">${m.name}${c.locked ? ' <span class="row-meta">fijo</span>' : ''}</span>` +
        `<span class="prod-bd-val">C ${fmtKg(c.comprometido)} · L ${fmtKg(c.libre)}</span>`;
      const ov = document.createElement('input');
      ov.type = 'number'; ov.min = '0'; ov.step = '1000';
      ov.className = 'alloc-input prod-ov-input';
      ov.value = entry.ov && entry.ov[m.slug] != null ? entry.ov[m.slug] : '';
      ov.placeholder = `auto ${Math.round(c.total).toLocaleString('es-CO')}`;
      ov.title = 'Override kg (vacío = automático por meta)';
      ov.setAttribute('aria-label', `Override de ${p.name} en ${m.name} (kg)`);
      ov.addEventListener('change', (e) => {
        const raw = e.target.value;
        onOverride(key, m.slug, raw === '' ? null : Math.max(0, Number(raw) || 0));
      });
      row.appendChild(ov);
      grid.appendChild(row);
    });
    if (a.unassigned > 0) {
      const warn = document.createElement('div');
      warn.className = 'prod-unassigned';
      warn.textContent = `Sin asignar: ${fmtKg(a.unassigned)} (revisa metas u overrides)`;
      grid.appendChild(warn);
    }
    wrap.appendChild(grid);
  }

  return wrap;
}

function order(month, campaign) {
  return CAMPAIGNS[campaign].cutoffMonths.indexOf(mod12(month)) + 1;
}

function fmtKg(kg) {
  return `${Math.round(Number(kg) || 0).toLocaleString('es-CO')} kg`;
}
