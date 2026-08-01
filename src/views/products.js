import {
  monthName, CUTOFF_DAY, OFFSETS, mod12, campaignOfMonth, CAMPAIGNS,
  productKey, allocateProduct, marketGoalTotal, warehouseGoalTotal,
  kgToContainers, DEFAULT_COMPROMETIDO_PCT,
} from '../model.js';
import { productReleases } from '../data/products.js';

/**
 * Products view — catalogue per cutoff + capacity-driven commitment plan.
 *
 * Per product you set a Capacidad (kg). It is fair-share allocated across sales
 * regions weighted by each market's total meta, then split into Comprometido
 * (global % default 70) + Libre. Overrides lock a region's kg and the rest
 * redistributes. Top: fill rate (capacity vs meta) per market and global.
 */
export function renderProducts({
  campaign, markets, warehouses, goals, alloc,
  onCap, onProductPct, onOverride, onGlobalPct,
}) {
  const el = document.createElement('div');
  const products = alloc?.products || {};
  const globalPct = alloc?.pctComprometido ?? DEFAULT_COMPROMETIDO_PCT;

  const marketMetas = markets.map((mk) => ({
    slug: mk.slug, name: mk.name, meta: marketMeta(goals, mk, warehouses),
  }));

  const releases = productReleases
    .filter((r) => campaignOfMonth(r.cutoffMonth) === campaign)
    .sort((a, b) => order(a.cutoffMonth, campaign) - order(b.cutoffMonth, campaign));

  el.appendChild(header(campaign, globalPct, onGlobalPct));
  el.appendChild(rollup(releases, marketMetas, products, globalPct));

  releases.forEach((r) => {
    el.appendChild(releaseCard(r, campaign, marketMetas, products, globalPct, onCap, onProductPct, onOverride));
  });

  return el;
}

function marketMeta(goals, mk, warehouses) {
  if (mk.goalsByWarehouse) {
    return (warehouses[mk.slug]?.warehouses || []).reduce((s, w) => s + warehouseGoalTotal(goals, w.name), 0);
  }
  return marketGoalTotal(goals, mk.slug);
}

function header(campaign, globalPct, onGlobalPct) {
  const head = document.createElement('div');
  head.className = 'view-head';
  head.innerHTML = `
    <h2>Productos y compromisos — ${CAMPAIGNS[campaign].name}</h2>
    <p class="view-sub">
      Pon una <strong>capacidad</strong> por producto (kg). Se reparte por región de
      venta según su <strong>meta</strong>, y se divide en
      <strong>Comprometido</strong> + <strong>Libre</strong>. El Libre se vende por
      demanda. Overrides fijan kg por región; el resto se redistribuye.
    </p>`;
  const ctl = document.createElement('div');
  ctl.className = 'prod-global';
  ctl.innerHTML = '<span>Comprometido global</span>';
  const input = document.createElement('input');
  input.type = 'number';
  input.min = '0'; input.max = '100'; input.step = '5';
  input.className = 'metas-input';
  input.value = globalPct;
  input.setAttribute('aria-label', 'Porcentaje comprometido global');
  input.addEventListener('change', (e) => {
    const v = Math.min(100, Math.max(0, Number(e.target.value) || 0));
    onGlobalPct(v);
  });
  ctl.appendChild(input);
  const suffix = document.createElement('span');
  suffix.textContent = `% · Libre ${100 - globalPct}%`;
  ctl.appendChild(suffix);
  head.appendChild(ctl);
  return head;
}

function campaignAlloc(releases, marketMetas, products, globalPct) {
  // Aggregate comprometido/libre per market + total capacity, across the campaign.
  const perMarket = {};
  marketMetas.forEach((m) => { perMarket[m.slug] = { comprometido: 0, libre: 0 }; });
  let totalCap = 0;
  releases.forEach((r) => r.items.forEach((name) => {
    const p = products[productKey(r.cutoffMonth, name)];
    if (!p) return;
    totalCap += Number(p.cap) || 0;
    const a = allocateProduct(p, marketMetas, globalPct);
    marketMetas.forEach((m) => {
      perMarket[m.slug].comprometido += a.byMarket[m.slug].comprometido;
      perMarket[m.slug].libre += a.byMarket[m.slug].libre;
    });
  }));
  return { perMarket, totalCap };
}

function rollup(releases, marketMetas, products, globalPct) {
  const { perMarket, totalCap } = campaignAlloc(releases, marketMetas, products, globalPct);
  const totalMeta = marketMetas.reduce((s, m) => s + m.meta, 0);

  const wrap = document.createElement('div');

  const fill = document.createElement('div');
  fill.className = 'prod-fill';
  const fillPct = totalMeta ? Math.round((totalCap / totalMeta) * 100) : 0;
  fill.innerHTML =
    `Capacidad total <strong>${fmtKg(totalCap)}</strong> (${kgToContainers(totalCap).toFixed(1)} cont) · ` +
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

function releaseCard(r, campaign, marketMetas, products, globalPct, onCap, onProductPct, onOverride) {
  const sampleMonth = mod12(r.cutoffMonth + OFFSETS.corteToMuestra);
  const card = document.createElement('article');
  card.className = 'card prod-card';
  card.style.setProperty('--accent', CAMPAIGNS[campaign].color);

  const h = document.createElement('header');
  h.className = 'card-head';
  h.innerHTML =
    `<span class="card-cut">Corte ${order(r.cutoffMonth, campaign)}${r.label ? ` · ${r.label}` : ''}</span>` +
    `<span class="card-date">${monthName(r.cutoffMonth)} ${CUTOFF_DAY}</span>` +
    `<span class="card-sample">Muestras desde ${monthName(sampleMonth)}</span>`;
  card.appendChild(h);

  const list = document.createElement('div');
  list.className = 'prod-items';
  r.items.forEach((name) => {
    list.appendChild(productItem(r.cutoffMonth, name, marketMetas, products, globalPct, onCap, onProductPct, onOverride));
  });
  card.appendChild(list);
  return card;
}

function productItem(cutoffMonth, name, marketMetas, products, globalPct, onCap, onProductPct, onOverride) {
  const key = productKey(cutoffMonth, name);
  const p = products[key] || {};
  const cap = Number(p.cap) || 0;

  const wrap = document.createElement('div');
  wrap.className = 'prod-item';

  const head = document.createElement('div');
  head.className = 'prod-item-head prod-cap-head';
  const nm = document.createElement('span');
  nm.className = 'prod-item-name';
  nm.textContent = name;
  head.appendChild(nm);

  const capInput = document.createElement('input');
  capInput.type = 'number';
  capInput.min = '0'; capInput.step = '1000';
  capInput.className = 'alloc-input prod-cap-input';
  capInput.value = cap || '';
  capInput.placeholder = 'Capacidad kg';
  capInput.setAttribute('aria-label', `Capacidad de ${name} en kg`);
  capInput.addEventListener('change', (e) => onCap(key, Math.max(0, Number(e.target.value) || 0)));
  head.appendChild(capInput);

  const pctInput = document.createElement('input');
  pctInput.type = 'number';
  pctInput.min = '0'; pctInput.max = '100'; pctInput.step = '5';
  pctInput.className = 'alloc-input prod-pct-input';
  pctInput.value = p.pct != null ? p.pct : '';
  pctInput.placeholder = `${globalPct}%`;
  pctInput.title = 'Comprometido % (vacío = global)';
  pctInput.setAttribute('aria-label', `Comprometido % de ${name}`);
  pctInput.addEventListener('change', (e) => {
    const raw = e.target.value;
    onProductPct(key, raw === '' ? null : Math.min(100, Math.max(0, Number(raw) || 0)));
  });
  head.appendChild(pctInput);

  wrap.appendChild(head);

  if (cap > 0) {
    const a = allocateProduct(p, marketMetas, globalPct);
    const grid = document.createElement('div');
    grid.className = 'prod-breakdown';
    marketMetas.filter((m) => m.meta > 0 || (p.ov && p.ov[m.slug] != null)).forEach((m) => {
      const cell = a.byMarket[m.slug];
      const row = document.createElement('div');
      row.className = 'prod-bd-row';
      row.innerHTML =
        `<span class="prod-bd-mk">${m.name}${cell.locked ? ' <span class="row-meta">fijo</span>' : ''}</span>` +
        `<span class="prod-bd-val">C ${fmtKg(cell.comprometido)} · L ${fmtKg(cell.libre)}</span>`;
      const ovInput = document.createElement('input');
      ovInput.type = 'number';
      ovInput.min = '0'; ovInput.step = '1000';
      ovInput.className = 'alloc-input prod-ov-input';
      ovInput.value = p.ov && p.ov[m.slug] != null ? p.ov[m.slug] : '';
      ovInput.placeholder = `auto ${Math.round(cell.total).toLocaleString('es-CO')}`;
      ovInput.title = 'Override kg (vacío = automático por meta)';
      ovInput.setAttribute('aria-label', `Override de ${name} en ${m.name} (kg)`);
      ovInput.addEventListener('change', (e) => {
        const raw = e.target.value;
        onOverride(key, m.slug, raw === '' ? null : Math.max(0, Number(raw) || 0));
      });
      row.appendChild(ovInput);
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
