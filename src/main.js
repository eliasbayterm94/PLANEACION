import { regions } from './data/regions.js';
import { markets } from './data/markets.js';
import { defaultWarehouses, emptyWarehouseConfig } from './data/warehouses.js';
import {
  buildSchedules, CAMPAIGNS, YEAR, listWarehouses, warehouseLeadLookup, emptyGoals,
} from './model.js';
import {
  loadPlan, saveWarehouse, saveShipment, saveGoals, GOALS_SLUG,
  subscribeToPlan, isRemote, editor, setEditor,
} from './store.js';
import { renderMarket } from './views/market.js';
import { renderConsolidado } from './views/consolidado.js';
import { renderProducts } from './views/products.js';
import { renderCosechas } from './views/cosechas.js';
import { renderRegionesEditor } from './views/regionesEditor.js';
import { renderBodegas } from './views/bodegas.js';
import { renderMetas } from './views/metas.js';

const schedules = buildSchedules(regions);

const state = {
  view: 'consolidado',
  editRegion: schedules[0]?.slug ?? null, // selected origin in the edit tab
  shipments: {}, // { regionSlug: { warehouses: [wh], ship: {wh: {monthIdx: containers}} } }
  warehouses: {}, // { marketSlug: { primary, warehouses: [{name, lead}] } }
  goals: emptyGoals(), // { regions: {slug: {community, mirc}}, countriesMIRC: {country: kg} }
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
  { id: 'metas', label: 'Metas', group: 'Plan', icon: 'target' },
  { id: 'cosechas', label: 'Cosechas', group: 'Origen', icon: 'eye' },
  { id: 'regiones', label: 'Editar regiones', group: 'Origen', icon: 'square-pen' },
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

// --- Shipment mutations (origin allocation, per region/warehouse) ----------
function regionCopy(slug) {
  const cur = state.shipments[slug] || { warehouses: [], ship: {} };
  return {
    warehouses: [...(cur.warehouses || [])],
    ship: { ...(cur.ship || {}) },
  };
}

function saveRegion(slug, value) {
  state.shipments[slug] = value;
  saveShipment(slug, value, setStatus);
  render();
}

function setShip(slug, wh, month, containers) {
  const v = regionCopy(slug);
  const months = { ...(v.ship[wh] || {}) };
  if (containers > 0) months[month] = containers;
  else delete months[month];
  v.ship[wh] = months;
  if (!v.warehouses.includes(wh)) v.warehouses.push(wh);
  saveRegion(slug, v);
}

function addWarehouse(slug, wh) {
  const v = regionCopy(slug);
  if (!v.warehouses.includes(wh)) v.warehouses.push(wh);
  saveRegion(slug, v);
}

function removeWarehouse(slug, wh) {
  const v = regionCopy(slug);
  v.warehouses = v.warehouses.filter((w) => w !== wh);
  delete v.ship[wh];
  saveRegion(slug, v);
}

// --- Goal mutations (kg targets by category + country MIRC) ----------------
function saveGoalsState(value) {
  state.goals = value;
  saveGoals(value, setStatus);
  render();
}

function goalsCopy() {
  return {
    markets: { ...(state.goals.markets || {}) },
    warehouses: { ...(state.goals.warehouses || {}) },
    countriesMIRC: { ...(state.goals.countriesMIRC || {}) },
  };
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
  const allWarehouses = listWarehouses(state.warehouses, markets);

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
    }));
  } else if (kind === 'cosechas') {
    root.appendChild(renderCosechas({
      schedules,
      shipments: state.shipments,
    }));
  } else if (kind === 'regiones') {
    const slug = state.editRegion;
    root.appendChild(renderRegionesEditor({
      schedules,
      selectedSlug: slug,
      onSelect: (s) => { state.editRegion = s; render(); },
      shipment: state.shipments[slug] || { warehouses: [], ship: {} },
      allWarehouses,
      leadLookup,
      onShip: (wh, month, containers) => setShip(slug, wh, month, containers),
      onAddWarehouse: (wh) => addWarehouse(slug, wh),
      onRemoveWarehouse: (wh) => removeWarehouse(slug, wh),
    }));
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
    root.appendChild(renderProducts({ campaign: Number(arg) }));
  }
}

function render() {
  renderNav();
  renderView();
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

  const { warehouse, shipment, goals, error } = await loadPlan();
  state.warehouses = buildWarehouses(warehouse);
  state.shipments = shipment || {};
  state.goals = goals?.[GOALS_SLUG] || emptyGoals();
  if (error) setStatus('error', error);

  render();

  subscribeToPlan((scope, slug, value) => {
    if (scope === 'warehouse') state.warehouses[slug] = value;
    else if (scope === 'shipment') state.shipments[slug] = value;
    else if (scope === 'goals') state.goals = value;
    else return; // legacy region/market scopes are no longer rendered
    render();
  });
}

init();
