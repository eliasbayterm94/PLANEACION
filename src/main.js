import { regions } from './data/regions.js';
import { markets } from './data/markets.js';
import { defaultWarehouses, emptyWarehouseConfig } from './data/warehouses.js';
import {
  buildSchedules, CAMPAIGNS, YEAR, warehouseLeadLookup, emptyGoals,
} from './model.js';
import {
  loadPlan, saveWarehouse, saveShipment, saveGoals, saveAlloc, GOALS_SLUG, ALLOC_SLUG,
  subscribeToPlan, isRemote, editor, setEditor,
} from './store.js';
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
  alloc: {}, // { productKey: { marketSlug: { base, libre, asegurado } } }
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

// --- Product allocation mutations (Base/Libre/Asegurado per product/market) --
function saveAllocState(value) {
  state.alloc = value;
  saveAlloc(value, setStatus);
  render();
}

function allocCopy(key) {
  const cur = state.alloc[key] || {};
  const out = {};
  Object.entries(cur).forEach(([mk, v]) => { out[mk] = { ...v }; });
  return out;
}

function setAlloc(key, market, field, kg) {
  const a = { ...state.alloc };
  const forKey = allocCopy(key);
  forKey[market] = { base: 0, libre: 0, asegurado: 0, ...(forKey[market] || {}), [field]: kg };
  a[key] = forKey;
  saveAllocState(a);
}

function addAllocRegion(key, market) {
  const a = { ...state.alloc };
  const forKey = allocCopy(key);
  if (!forKey[market]) forKey[market] = { base: 0, libre: 0, asegurado: 0 };
  a[key] = forKey;
  saveAllocState(a);
}

function removeAllocRegion(key, market) {
  const a = { ...state.alloc };
  const forKey = allocCopy(key);
  delete forKey[market];
  if (Object.keys(forKey).length) a[key] = forKey;
  else delete a[key];
  saveAllocState(a);
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
      onAlloc: (key, market, field, kg) => setAlloc(key, market, field, kg),
      onAddRegion: (key, market) => addAllocRegion(key, market),
      onRemoveRegion: (key, market) => removeAllocRegion(key, market),
    }));
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

  const { warehouse, shipment, goals, alloc, error } = await loadPlan();
  state.warehouses = buildWarehouses(warehouse);
  state.shipments = shipment || {};
  state.goals = goals?.[GOALS_SLUG] || emptyGoals();
  state.alloc = alloc?.[ALLOC_SLUG] || {};
  if (error) setStatus('error', error);

  render();

  subscribeToPlan((scope, slug, value) => {
    if (scope === 'warehouse') state.warehouses[slug] = value;
    else if (scope === 'shipment') state.shipments[slug] = value;
    else if (scope === 'goals') state.goals = value;
    else if (scope === 'alloc') state.alloc = value;
    else return; // legacy region/market scopes are no longer rendered
    render();
  });
}

init();
