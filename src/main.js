import { regions } from './data/regions.js';
import { markets } from './data/markets.js';
import { defaultWarehouses, emptyWarehouseConfig } from './data/warehouses.js';
import { emptyCatalog } from './data/catalog.js';
import {
  buildSchedules, CAMPAIGNS, YEAR, warehouseLeadLookup, emptyGoals,
  DEFAULT_COMPROMETIDO_PCT, setCampaignCortes,
} from './model.js';
import {
  loadPlan, saveWarehouse, saveShipment, saveGoals, saveAlloc, saveCatalog,
  GOALS_SLUG, ALLOC_SLUG, CATALOG_SLUG,
  subscribeToPlan, isRemote, editor, setEditor,
} from './store.js';
import { renderCatalogModal } from './views/catalogModal.js';
import { renderMarket } from './views/market.js';
import { renderConsolidado } from './views/consolidado.js';
import { renderProducts } from './views/products.js';
import { renderCosechas } from './views/cosechas.js';
import { renderProgramacion } from './views/programacion.js';
import { renderBodegas } from './views/bodegas.js';
import { renderMetas } from './views/metas.js';

const schedules = buildSchedules(regions);

const state = {
  view: 'consolidado',
  planCountry: null, // selected producing country in the Programación cockpit
  shipments: {}, // { country: { ship: { wh: { monthIdx: containers } } } }
  warehouses: {}, // { marketSlug: { primary, warehouses: [{name, lead}] } }
  goals: emptyGoals(), // { markets, warehouses, countriesMIRC }
  alloc: {}, // { pctComprometido, products: { productId: { cap, pct, ov } } }
  catalog: emptyCatalog(), // { categories, cortes, products }
  modalOpen: false,
  modalTab: 'cortes',
  prodSel: new Set(), // product ids selected for bulk category assignment
  bulkCategory: '', // category to apply in bulk
  status: '',
};

/** Effective warehouse config per market: stored override, else seed default. */
function buildWarehouses(stored = {}) {
  const out = {};
  markets.forEach((m) => {
    out[m.slug] = stored[m.slug] || defaultWarehouses[m.slug] || emptyWarehouseConfig();
  });
  return out;
}

// A Lucide icon name per navigation group (brand rule 1: no emojis).
const GROUP_ICON = {
  Plan: 'layout-dashboard',
  Origen: 'sprout',
  Destino: 'globe',
  Productos: 'package',
};

const TABS = [
  { id: 'consolidado', label: 'Consolidado', group: 'Plan', icon: 'layout-dashboard' },
  { id: 'programacion', label: 'Programación de salidas', group: 'Plan', icon: 'ship' },
  { id: 'metas', label: 'Metas', group: 'Plan', icon: 'target' },
  { id: 'cosechas', label: 'Cosechas', group: 'Origen', icon: 'eye' },
  ...markets.map((m) => ({ id: `market:${m.slug}`, label: m.name, group: 'Destino' })),
  { id: 'bodegas', label: 'Bodegas', group: 'Destino', icon: 'warehouse' },
  { id: 'products:1', label: CAMPAIGNS[1].name, group: 'Productos' },
  { id: 'products:2', label: CAMPAIGNS[2].name, group: 'Productos' },
];

// Refresh Lucide icons after any render that injects [data-lucide] nodes.
function paintIcons() {
  if (window.lucide?.createIcons) window.lucide.createIcons();
}

// ---------------------------------------------------------------------------
function setStatus(kind, detail) {
  const el = document.getElementById('status');
  const text = {
    saving: 'Guardando…',
    saved: 'Guardado',
    error: `No se pudo guardar — ${detail || 'revisa la conexión'}`,
  }[kind] || '';
  el.textContent = text;
  el.className = `fp-status fp-status--${kind}`;
  if (kind === 'saved') setTimeout(() => { el.textContent = ''; }, 1800);
}

// --- Shipment mutations (by producing country -> warehouse -> month) --------
function setShip(country, wh, month, containers) {
  const cur = state.shipments[country] || { ship: {} };
  const ship = { ...(cur.ship || {}) };
  const months = { ...(ship[wh] || {}) };
  if (containers > 0) months[month] = containers;
  else delete months[month];
  ship[wh] = months;
  const value = { ship };
  state.shipments[country] = value;
  saveShipment(country, value, setStatus);
  render();
}

// --- Goal mutations (kg targets by category + country MIRC) ----------------
function saveGoalsState(value) {
  state.goals = value;
  saveGoals(value, setStatus);
  render();
}

function goalsCopy() {
  return {
    company: { ...(state.goals.company || {}) },
    markets: { ...(state.goals.markets || {}) },
    warehouses: { ...(state.goals.warehouses || {}) },
    countriesMIRC: { ...(state.goals.countriesMIRC || {}) },
  };
}

function setCompanyGoal(category, kg) {
  const g = goalsCopy();
  g.company[category] = kg;
  saveGoalsState(g);
}

function setMarketGoal(marketSlug, category, kg) {
  const g = goalsCopy();
  g.markets[marketSlug] = { ...(g.markets[marketSlug] || {}), [category]: kg };
  saveGoalsState(g);
}

function setWarehouseGoal(whName, category, kg) {
  const g = goalsCopy();
  g.warehouses[whName] = { ...(g.warehouses[whName] || {}), [category]: kg };
  saveGoalsState(g);
}

function setCountryMirc(country, kg) {
  const g = goalsCopy();
  g.countriesMIRC[country] = kg;
  saveGoalsState(g);
}

// --- Product allocation mutations (capacity-driven, fair-share by meta) ------
function saveAllocState(value) {
  state.alloc = value;
  saveAlloc(value, setStatus);
  render();
}

function allocBase() {
  return {
    pctComprometido: state.alloc?.pctComprometido ?? DEFAULT_COMPROMETIDO_PCT,
    products: { ...(state.alloc?.products || {}) },
  };
}

function productCopy(a, key) {
  const cur = a.products[key] || {};
  return { cap: cur.cap || 0, pct: cur.pct ?? null, ov: { ...(cur.ov || {}) } };
}

function setGlobalPct(pct) {
  const a = allocBase();
  a.pctComprometido = pct;
  saveAllocState(a);
}

function setCap(key, kg) {
  const a = allocBase();
  const p = productCopy(a, key);
  p.cap = kg;
  a.products[key] = p;
  saveAllocState(a);
}

function setProductPct(key, pct) {
  const a = allocBase();
  const p = productCopy(a, key);
  p.pct = pct; // number or null
  a.products[key] = p;
  saveAllocState(a);
}

function setOverride(key, market, kg) {
  const a = allocBase();
  const p = productCopy(a, key);
  if (kg == null) delete p.ov[market];
  else p.ov[market] = kg;
  a.products[key] = p;
  saveAllocState(a);
}

// --- Catalog mutations (categories, cortes per campaign, products) ----------
/** Ensure every product has a single `category` string (migrate legacy shapes). */
function normalizeCatalog(cat) {
  return {
    ...cat,
    products: (cat.products || []).map((p) => {
      const { categories, ...rest } = p;
      let category = typeof p.category === 'string' ? p.category : '';
      if (!category && Array.isArray(categories) && categories.length) category = categories[0];
      return { ...rest, category };
    }),
  };
}

function catalogCopy() {
  const c = state.catalog;
  return {
    categories: (c.categories || []).map((x) => ({ ...x })),
    cortes: { 1: [...(c.cortes?.[1] || [])], 2: [...(c.cortes?.[2] || [])] },
    products: (c.products || []).map((x) => ({ ...x })),
  };
}

function saveCatalogState(cat, cortesChanged) {
  state.catalog = cat;
  if (cortesChanged) setCampaignCortes(cat.cortes);
  saveCatalog(cat, setStatus);
  render();
}

function toggleCorte(camp, month) {
  const c = catalogCopy();
  const arr = c.cortes[camp];
  const i = arr.indexOf(month);
  if (i >= 0) arr.splice(i, 1);
  else arr.push(month);
  saveCatalogState(c, true);
}

function catAdd() {
  const c = catalogCopy();
  c.categories.push({ key: `cat_${Date.now()}`, name: 'Nueva categoría', macro: 'mirc' });
  saveCatalogState(c, false);
}

function catUpdate(key, field, val) {
  const c = catalogCopy();
  const cat = c.categories.find((x) => x.key === key);
  if (cat) cat[field] = val;
  saveCatalogState(c, false);
}

function catRemove(key) {
  const c = catalogCopy();
  c.categories = c.categories.filter((x) => x.key !== key);
  c.products.forEach((p) => { if (p.category === key) p.category = ''; });
  saveCatalogState(c, false);
}

function prodAdd() {
  const c = catalogCopy();
  const start = c.cortes[1]?.[0] ?? c.cortes[2]?.[0] ?? 9;
  c.products.push({ id: `p_${Date.now()}`, name: 'Nuevo producto', category: '', startCorte: start });
  saveCatalogState(c, false);
}

function prodUpdate(id, field, val) {
  const c = catalogCopy();
  const p = c.products.find((x) => x.id === id);
  if (p) p[field] = val;
  saveCatalogState(c, false);
}

// --- Bulk category assignment (select several products, apply one category) ---
function toggleProdSel(id) {
  if (state.prodSel.has(id)) state.prodSel.delete(id);
  else state.prodSel.add(id);
  render();
}

function selectProds(ids, on) {
  ids.forEach((id) => { if (on) state.prodSel.add(id); else state.prodSel.delete(id); });
  render();
}

function setBulkCategory(key) {
  state.bulkCategory = key;
  render();
}

function bulkApplyCategory() {
  if (!state.prodSel.size) return;
  const c = catalogCopy();
  c.products.forEach((p) => { if (state.prodSel.has(p.id)) p.category = state.bulkCategory; });
  state.prodSel = new Set();
  saveCatalogState(c, false);
}

function prodRemove(id) {
  const c = catalogCopy();
  c.products = c.products.filter((x) => x.id !== id);
  saveCatalogState(c, false);
}

function renderModal() {
  const root = document.getElementById('modal-root');
  if (!root) return;
  // Preserve the modal body scroll across re-renders (checkbox/edits re-render).
  const prevBody = root.querySelector('.modal-body');
  const scrollTop = prevBody ? prevBody.scrollTop : 0;
  root.innerHTML = '';
  if (!state.modalOpen) return;
  root.appendChild(renderCatalogModal({
    catalog: state.catalog,
    tab: state.modalTab,
    onTab: (t) => { state.modalTab = t; render(); },
    onClose: () => { state.modalOpen = false; render(); },
    onToggleCorte: toggleCorte,
    onCatAdd: catAdd,
    onCatUpdate: catUpdate,
    onCatRemove: catRemove,
    onProdAdd: prodAdd,
    onProdUpdate: prodUpdate,
    onProdRemove: prodRemove,
    selected: state.prodSel,
    bulkCategory: state.bulkCategory,
    onToggleSelect: toggleProdSel,
    onSelectAll: selectProds,
    onBulkCategory: setBulkCategory,
    onBulkApply: bulkApplyCategory,
  }));
  const newBody = root.querySelector('.modal-body');
  if (newBody) newBody.scrollTop = scrollTop;
}

// ---------------------------------------------------------------------------
function closeDrawer() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('backdrop').classList.remove('open');
}

function renderNav() {
  const nav = document.getElementById('sidebar-nav');
  nav.innerHTML = '';

  let lastGroup = null;
  TABS.forEach((t) => {
    if (t.group !== lastGroup) {
      const section = document.createElement('div');
      section.className = 'fc-sidebar-section-label';
      section.textContent = t.group;
      nav.appendChild(section);
      lastGroup = t.group;
    }

    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'fc-sidebar-link' + (state.view === t.id ? ' active' : '');
    b.setAttribute('aria-current', state.view === t.id ? 'page' : 'false');
    b.innerHTML = `<i data-lucide="${t.icon || GROUP_ICON[t.group] || 'circle'}"></i><span class="label"></span>`;
    b.querySelector('.label').textContent = t.label;
    b.addEventListener('click', () => {
      state.view = t.id;
      history.replaceState(null, '', `#${t.id}`);
      closeDrawer();
      render();
    });
    nav.appendChild(b);
  });
}

function currentLabel() {
  return TABS.find((t) => t.id === state.view)?.label || 'Plan';
}

function renderView() {
  document.getElementById('page-title').textContent = currentLabel();

  const root = document.getElementById('view');
  root.innerHTML = '';
  const [kind, arg] = state.view.split(':');

  const leadLookup = warehouseLeadLookup(state.warehouses);

  if (kind === 'consolidado') {
    root.appendChild(renderConsolidado({
      schedules, markets,
      shipments: state.shipments,
      leadLookup,
    }));
  } else if (kind === 'metas') {
    root.appendChild(renderMetas({
      schedules, markets,
      warehouses: state.warehouses,
      goals: state.goals,
      shipments: state.shipments,
      leadLookup,
      onMarketGoal: (slug, category, kg) => setMarketGoal(slug, category, kg),
      onWarehouseGoal: (wh, category, kg) => setWarehouseGoal(wh, category, kg),
      onCountryMirc: (country, kg) => setCountryMirc(country, kg),
      onCompanyGoal: (category, kg) => setCompanyGoal(category, kg),
    }));
  } else if (kind === 'programacion') {
    root.appendChild(renderProgramacion({
      schedules, markets,
      warehouses: state.warehouses,
      goals: state.goals,
      shipments: state.shipments,
      leadLookup,
      planCountry: state.planCountry,
      onCountry: (c) => { state.planCountry = c; render(); },
      onShip: (country, wh, month, containers) => setShip(country, wh, month, containers),
    }));
  } else if (kind === 'cosechas') {
    root.appendChild(renderCosechas({ schedules }));
  } else if (kind === 'market') {
    const market = markets.find((m) => m.slug === arg);
    root.appendChild(renderMarket({
      market,
      warehouses: state.warehouses[arg],
      shipments: state.shipments,
      leadLookup,
    }));
  } else if (kind === 'bodegas') {
    root.appendChild(renderBodegas({
      markets,
      warehouses: state.warehouses,
      onChange: (slug, config) => {
        state.warehouses[slug] = config;
        saveWarehouse(slug, config, setStatus);
        render();
      },
    }));
  } else if (kind === 'products') {
    root.appendChild(renderProducts({
      campaign: Number(arg),
      markets,
      warehouses: state.warehouses,
      goals: state.goals,
      alloc: state.alloc,
      catalog: state.catalog,
      onCap: (key, kg) => setCap(key, kg),
      onProductPct: (key, pct) => setProductPct(key, pct),
      onOverride: (key, market, kg) => setOverride(key, market, kg),
      onGlobalPct: (pct) => setGlobalPct(pct),
      onManage: () => { state.modalOpen = true; state.modalTab = 'productos'; render(); },
    }));
  }
}

function render() {
  renderNav();
  renderView();
  renderModal();
  paintIcons();
}

// ---------------------------------------------------------------------------
function wireShell() {
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('backdrop');

  document.getElementById('hamburger').addEventListener('click', () => {
    sidebar.classList.add('open');
    backdrop.classList.add('open');
  });
  backdrop.addEventListener('click', closeDrawer);

  // Brand + footer button both collapse the rail on desktop.
  const toggleCollapse = () => sidebar.classList.toggle('collapsed');
  document.getElementById('brand').addEventListener('click', toggleCollapse);
  document.getElementById('collapse').addEventListener('click', toggleCollapse);
}

// ---------------------------------------------------------------------------
async function init() {
  document.getElementById('year').textContent = YEAR;
  wireShell();

  const mode = document.getElementById('mode');
  mode.textContent = isRemote ? 'Compartido con el equipo' : 'Solo en este navegador';
  mode.className = `fp-mode fp-mode--${isRemote ? 'remote' : 'local'}`;

  const who = document.getElementById('editor');
  who.value = editor;
  who.addEventListener('change', (e) => setEditor(e.target.value.trim()));

  const fromHash = location.hash.slice(1);
  if (fromHash && TABS.some((t) => t.id === fromHash)) state.view = fromHash;

  const { warehouse, shipment, goals, alloc, catalog, error } = await loadPlan();
  state.warehouses = buildWarehouses(warehouse);
  state.shipments = shipment || {};
  state.goals = goals?.[GOALS_SLUG] || emptyGoals();
  state.alloc = alloc?.[ALLOC_SLUG] || { pctComprometido: DEFAULT_COMPROMETIDO_PCT, products: {} };
  const storedCatalog = catalog?.[CATALOG_SLUG];
  state.catalog = normalizeCatalog(storedCatalog && storedCatalog.products ? storedCatalog : emptyCatalog());
  setCampaignCortes(state.catalog.cortes);
  if (error) setStatus('error', error);

  render();

  subscribeToPlan((scope, slug, value) => {
    if (scope === 'warehouse') state.warehouses[slug] = value;
    else if (scope === 'shipment') state.shipments[slug] = value;
    else if (scope === 'goals') state.goals = value;
    else if (scope === 'alloc') state.alloc = value;
    else if (scope === 'catalog') { state.catalog = normalizeCatalog(value); setCampaignCortes(value.cortes); }
    else return; // legacy region/market scopes are no longer rendered
    render();
  });
}

init();
