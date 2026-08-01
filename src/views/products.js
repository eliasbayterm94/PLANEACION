import {
  monthName, CUTOFF_DAY, OFFSETS, mod12, campaignOfMonth, CAMPAIGNS,
  productKey, allocCell, allocMarketRollup, marketGoalTotal, warehouseGoalTotal,
  containersToKg, kgToContainers,
} from '../model.js';
import { productReleases } from '../data/products.js';

/**
 * Products view — catalogue per cutoff PLUS the commitment layer.
 *
 * Per product, per sales region (market): Base (reserved) + Libre (available) in
 * kg; Asegurado (secured sales) commits Libre first. Top of the campaign shows a
 * rollup per market (Base / Asegurado / Libre disponible) against the market's
 * kg goal. Quantities are in kg (1 container = KG_PER_CONTAINER kg).
 */
export function renderProducts({
  campaign, markets, warehouses, goals, alloc,
  onAlloc, onAddRegion, onRemoveRegion,
}) {
  const el = document.createElement('div');
  const releases = productReleases
    .filter((r) => campaignOfMonth(r.cutoffMonth) === campaign)
    .sort((a, b) => order(a.cutoffMonth, campaign) - order(b.cutoffMonth, campaign));

  el.appendChild(header(campaign));
  el.appendChild(rollup(releases, markets, warehouses, goals, alloc));

  releases.forEach((r) => {
    el.appendChild(releaseCard(r, campaign, markets, alloc, onAlloc, onAddRegion, onRemoveRegion));
  });

  return el;
}

function header(campaign) {
  const head = document.createElement('div');
  head.className = 'view-head';
  head.innerHTML = `
    <h2>Productos y compromisos — ${CAMPAIGNS[campaign].name}</h2>
    <p class="view-sub">
      Por producto y <strong>región de venta</strong>: <strong>Base</strong> (reservado) +
      <strong>Libre</strong> (disponible). Las <strong>ventas aseguradas</strong> comprometen
      lo Libre primero. En kg; el equivalente en contenedores se muestra al lado.
    </p>`;
  return head;
}

/** All product keys in a campaign (for the market rollup). */
function campaignKeys(releases) {
  const keys = [];
  releases.forEach((r) => r.items.forEach((name) => keys.push(productKey(r.cutoffMonth, name))));
  return keys;
}

function marketMeta(goals, mk, warehouses) {
  if (mk.goalsByWarehouse) {
    return (warehouses[mk.slug]?.warehouses || []).reduce((s, w) => s + warehouseGoalTotal(goals, w.name), 0);
  }
  return marketGoalTotal(goals, mk.slug);
}

function rollup(releases, markets, warehouses, goals, alloc) {
  const keys = campaignKeys(releases);
  const wrap = document.createElement('div');
  wrap.className = 'prod-rollup';

  markets.forEach((mk) => {
    const r = allocMarketRollup(alloc, keys, mk.slug);
    const meta = marketMeta(goals, mk, warehouses);
    const cov = meta ? Math.round((r.total / meta) * 100) : 0;

    const card = document.createElement('div');
    card.className = 'prod-rollup-card';
    card.innerHTML =
      `<div class="prod-rollup-name">${mk.name}</div>` +
      `<div class="prod-rollup-bar">` +
        `<span class="seg seg-base" style="flex:${r.base || 0}"></span>` +
        `<span class="seg seg-aseg" style="flex:${Math.min(r.asegurado, r.libre) || 0}"></span>` +
        `<span class="seg seg-libre" style="flex:${Math.max(0, r.libreDisp) || 0}"></span>` +
      `</div>` +
      `<div class="prod-rollup-nums">` +
        `<span><i class="dot dot-base"></i>Base ${fmtKg(r.base)}</span>` +
        `<span><i class="dot dot-aseg"></i>Aseg ${fmtKg(r.asegurado)}</span>` +
        `<span><i class="dot dot-libre"></i>Libre ${fmtKg(Math.max(0, r.libreDisp))}</span>` +
      `</div>` +
      `<div class="prod-rollup-meta">${fmtKg(r.total)} plan${meta ? ` · meta ${fmtKg(meta)} · ${cov}%` : ''}</div>`;
    wrap.appendChild(card);
  });

  return wrap;
}

function releaseCard(r, campaign, markets, alloc, onAlloc, onAddRegion, onRemoveRegion) {
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
    list.appendChild(productItem(r.cutoffMonth, name, markets, alloc, onAlloc, onAddRegion, onRemoveRegion));
  });
  card.appendChild(list);

  return card;
}

function productItem(cutoffMonth, name, markets, alloc, onAlloc, onAddRegion, onRemoveRegion) {
  const key = productKey(cutoffMonth, name);
  const allocated = alloc[key] || {};
  const wrap = document.createElement('div');
  wrap.className = 'prod-item';

  // Header: name + total
  const head = document.createElement('div');
  head.className = 'prod-item-head';
  let total = 0;
  markets.forEach((mk) => { total += allocCell(alloc, key, mk.slug).total; });
  head.innerHTML =
    `<span class="prod-item-name">${name}</span>` +
    (total > 0 ? `<span class="prod-item-total">${fmtKg(total)} · ${kgToContainers(total).toFixed(1)} cont</span>` : '');
  wrap.appendChild(head);

  // Allocation rows for markets already added
  markets.filter((mk) => allocated[mk.slug]).forEach((mk) => {
    const c = allocCell(alloc, key, mk.slug);
    const row = document.createElement('div');
    row.className = 'prod-alloc-row';

    const mkName = document.createElement('span');
    mkName.className = 'prod-alloc-mk';
    mkName.textContent = mk.name;
    row.appendChild(mkName);

    [['base', c.base, 'Base'], ['libre', c.libre, 'Libre'], ['asegurado', c.asegurado, 'Aseg']].forEach(([field, val, ph]) => {
      const input = document.createElement('input');
      input.type = 'number';
      input.min = '0';
      input.step = '1000';
      input.className = 'alloc-input';
      input.value = val || '';
      input.placeholder = ph;
      input.setAttribute('aria-label', `${ph} de ${name} en ${mk.name} (kg)`);
      input.addEventListener('change', (e) => onAlloc(key, mk.slug, field, Math.max(0, Number(e.target.value) || 0)));
      row.appendChild(input);
    });

    const disp = document.createElement('span');
    const over = c.libreDisp < 0;
    disp.className = 'prod-alloc-disp' + (over ? ' is-over' : '');
    disp.textContent = over ? `sobre ${fmtKg(-c.libreDisp)}` : `libre ${fmtKg(c.libreDisp)}`;
    disp.title = over ? 'Asegurado excede lo Libre' : 'Libre disponible (Libre − Asegurado)';
    row.appendChild(disp);

    const rm = document.createElement('button');
    rm.type = 'button';
    rm.className = 'wh-remove wh-remove--inline';
    rm.title = `Quitar ${mk.name}`;
    rm.innerHTML = '<i data-lucide="x"></i>';
    rm.addEventListener('click', () => onRemoveRegion(key, mk.slug));
    row.appendChild(rm);

    wrap.appendChild(row);
  });

  // Add-region chips (markets not yet allocated)
  const available = markets.filter((mk) => !allocated[mk.slug]);
  if (available.length) {
    const add = document.createElement('div');
    add.className = 'prod-add';
    available.forEach((mk) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'prod-add-chip';
      b.textContent = `+ ${mk.name}`;
      b.addEventListener('click', () => onAddRegion(key, mk.slug));
      add.appendChild(b);
    });
    wrap.appendChild(add);
  }

  return wrap;
}

/** Cutoff ordinal within its campaign window. */
function order(month, campaign) {
  return CAMPAIGNS[campaign].cutoffMonths.indexOf(mod12(month)) + 1;
}

function fmtKg(kg) {
  return `${Math.round(Number(kg) || 0).toLocaleString('es-CO')} kg`;
}
