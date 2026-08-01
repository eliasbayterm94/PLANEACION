import { regions } from './data/regions.js';
import { markets } from './data/markets.js';
import { buildSchedules, CAMPAIGNS, YEAR } from './model.js';
import { loadPlan, savePlanSlug, subscribeToPlan, isRemote, editor, setEditor } from './store.js';
import { renderRegion } from './views/region.js';
import { renderMarket } from './views/market.js';
import { renderConsolidado } from './views/consolidado.js';
import { renderProducts } from './views/products.js';

const schedules = buildSchedules(regions);

const state = {
  view: 'consolidado',
  regionQty: {},
  marketQty: {},
  status: '',
};

// A Lucide icon name per navigation group (brand rule 1: no emojis).
const GROUP_ICON = {
  Plan: 'layout-dashboard',
  Origen: 'sprout',
  Destino: 'globe',
  Productos: 'package',
};

const TABS = [
  { id: 'consolidado', label: 'Consolidado', group: 'Plan' },
  ...schedules.map((s) => ({ id: `region:${s.slug}`, label: s.name, group: 'Origen' })),
  ...markets.map((m) => ({ id: `market:${m.slug}`, label: m.name, group: 'Destino' })),
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

function updateQty(scope, slug, month, value) {
  const bucket = scope === 'region' ? state.regionQty : state.marketQty;
  const months = { ...(bucket[slug] || {}) };
  if (value > 0) months[month] = value;
  else delete months[month];
  bucket[slug] = months;

  savePlanSlug(scope, slug, months, setStatus);
  render();
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
    b.innerHTML = `<i data-lucide="${GROUP_ICON[t.group] || 'circle'}"></i><span class="label"></span>`;
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

  if (kind === 'consolidado') {
    root.appendChild(renderConsolidado({
      schedules, markets,
      regionQty: state.regionQty,
      marketQty: state.marketQty,
    }));
  } else if (kind === 'region') {
    const schedule = schedules.find((s) => s.slug === arg);
    root.appendChild(renderRegion({
      schedule,
      qty: state.regionQty[arg] || {},
      onQty: (month, value) => updateQty('region', arg, month, value),
    }));
  } else if (kind === 'market') {
    const market = markets.find((m) => m.slug === arg);
    root.appendChild(renderMarket({
      market,
      qty: state.marketQty[arg] || {},
      onQty: (month, value) => updateQty('market', arg, month, value),
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

  const { region, market, error } = await loadPlan();
  state.regionQty = region;
  state.marketQty = market;
  if (error) setStatus('error', error);

  render();

  subscribeToPlan((scope, slug, months) => {
    const bucket = scope === 'region' ? state.regionQty : state.marketQty;
    bucket[slug] = months;
    render();
  });
}

init();
