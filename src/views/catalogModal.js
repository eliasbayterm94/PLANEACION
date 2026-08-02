import { MONTHS, monthName, productCampaign, CAMPAIGNS } from '../model.js';

const CAMPAIGN_IDS = [1, 2, 3];
const COUNTRIES = ['Colombia', 'Rwanda'];

/**
 * "Gestionar productos" modal — edit the catalogue.
 *   · Cortes por campaña: which months have a cutoff (per campaign, coloured).
 *   · Categorías: Community + MIRC subcategories (Microlot, Innovation, ...).
 *   · Productos: name, category, and START cutoff (tied to production).
 *
 * Pure view: every edit calls a granular callback; state + persistence live in
 * main.js. Text fields commit on change (blur) to avoid re-render focus loss.
 */
export function renderCatalogModal({
  catalog, tab, onTab, onClose,
  onToggleCorte, onCatAdd, onCatUpdate, onCatRemove,
  onProdAdd, onProdUpdate, onProdRemove, onResetCatalog,
  selected, bulkCategory, bulkPool, bulkCountry,
  onToggleSelect, onSelectAll, onBulkCategory, onBulkApply, onBulkPool, onBulkApplyPool,
  onBulkCountry, onBulkApplyCountry,
  onPoolAdd, onPoolUpdate, onPoolRemove,
}) {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) onClose(); });

  const panel = document.createElement('div');
  panel.className = 'modal-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Gestionar productos');

  // Header
  const head = document.createElement('div');
  head.className = 'modal-head';
  head.innerHTML = '<span class="modal-title">Gestionar productos</span>';
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'modal-close';
  close.setAttribute('aria-label', 'Cerrar');
  close.innerHTML = '<i data-lucide="x"></i>';
  close.addEventListener('click', onClose);
  head.appendChild(close);
  panel.appendChild(head);

  // Tabs
  const tabs = document.createElement('div');
  tabs.className = 'modal-tabs';
  [['cortes', 'Cortes por campaña'], ['categorias', 'Categorías'], ['pools', 'Pools'], ['productos', 'Productos']].forEach(([id, label]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'modal-tab' + (tab === id ? ' active' : '');
    b.textContent = label;
    b.addEventListener('click', () => onTab(id));
    tabs.appendChild(b);
  });
  panel.appendChild(tabs);

  const body = document.createElement('div');
  body.className = 'modal-body';
  if (tab === 'cortes') body.appendChild(cortesSection(catalog, onToggleCorte));
  else if (tab === 'categorias') body.appendChild(categoriesSection(catalog, onCatAdd, onCatUpdate, onCatRemove));
  else if (tab === 'pools') body.appendChild(poolsSection(catalog, onPoolAdd, onPoolUpdate, onPoolRemove));
  else body.appendChild(productsSection(catalog, {
    onProdAdd, onProdUpdate, onProdRemove, onResetCatalog,
    selected: selected || new Set(), bulkCategory: bulkCategory || '', bulkPool: bulkPool || '', bulkCountry: bulkCountry || '',
    onToggleSelect, onSelectAll, onBulkCategory, onBulkApply, onBulkPool, onBulkApplyPool,
    onBulkCountry, onBulkApplyCountry,
  }));
  panel.appendChild(body);

  backdrop.appendChild(panel);
  return backdrop;
}

// --- Cortes ----------------------------------------------------------------
function cortesSection(catalog, onToggleCorte) {
  const wrap = document.createElement('div');
  const intro = document.createElement('p');
  intro.className = 'view-sub';
  intro.innerHTML = 'Marca los meses que tienen corte en cada campaña. Define las bandas y el color en toda la app.';
  wrap.appendChild(intro);

  CAMPAIGN_IDS.forEach((camp) => {
    const months = catalog.cortes?.[camp] || [];
    const block = document.createElement('div');
    block.className = 'cortes-block';
    const label = document.createElement('div');
    label.className = 'cortes-camp';
    label.innerHTML = `<span class="camp-dot" style="background:${CAMPAIGNS[camp].color}"></span>${CAMPAIGNS[camp].name}`;
    block.appendChild(label);

    const chips = document.createElement('div');
    chips.className = 'cortes-months';
    MONTHS.forEach((m, i) => {
      const on = months.includes(i);
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'corte-chip' + (on ? ` on camp-${camp}` : '');
      b.textContent = m;
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      b.addEventListener('click', () => onToggleCorte(camp, i));
      chips.appendChild(b);
    });
    block.appendChild(chips);
    wrap.appendChild(block);
  });
  return wrap;
}

// --- Categorías ------------------------------------------------------------
function categoriesSection(catalog, onCatAdd, onCatUpdate, onCatRemove) {
  const wrap = document.createElement('div');
  const intro = document.createElement('p');
  intro.className = 'view-sub';
  intro.innerHTML = '<strong>Community</strong> y <strong>MIRC</strong> son las macro; las subcategorías de MIRC (Microlot, Innovation, Reserve, Competition) se editan aquí.';
  wrap.appendChild(intro);

  (catalog.categories || []).forEach((c) => {
    const row = document.createElement('div');
    row.className = 'cat-row';

    const name = document.createElement('input');
    name.type = 'text';
    name.className = 'metas-input cat-name';
    name.value = c.name;
    name.setAttribute('aria-label', 'Nombre de categoría');
    name.addEventListener('change', (e) => onCatUpdate(c.key, 'name', e.target.value.trim() || c.name));
    row.appendChild(name);

    const macro = document.createElement('select');
    macro.className = 'wh-select cat-macro';
    [['mirc', 'MIRC'], ['community', 'Community']].forEach(([val, txt]) => {
      const o = document.createElement('option');
      o.value = val; o.textContent = txt; if (c.macro === val) o.selected = true;
      macro.appendChild(o);
    });
    macro.addEventListener('change', (e) => onCatUpdate(c.key, 'macro', e.target.value));
    row.appendChild(macro);

    const rm = document.createElement('button');
    rm.type = 'button';
    rm.className = 'wh-remove wh-remove--inline';
    rm.title = `Quitar ${c.name}`;
    rm.innerHTML = '<i data-lucide="trash-2"></i>';
    rm.addEventListener('click', () => onCatRemove(c.key));
    row.appendChild(rm);

    wrap.appendChild(row);
  });

  const add = document.createElement('button');
  add.type = 'button';
  add.className = 'wh-add';
  add.innerHTML = '<i data-lucide="plus"></i> Agregar categoría';
  add.addEventListener('click', () => onCatAdd());
  wrap.appendChild(add);
  return wrap;
}

// --- Pools -----------------------------------------------------------------
function poolsSection(catalog, onPoolAdd, onPoolUpdate, onPoolRemove) {
  const wrap = document.createElement('div');
  const intro = document.createElement('p');
  intro.className = 'view-sub';
  intro.innerHTML = 'Un <strong>pool</strong> agrupa productos con una <strong>meta combinada</strong> (kg), por campaña. Los productos se marcan en la pestaña <strong>Productos</strong>.';
  wrap.appendChild(intro);

  const heads = document.createElement('div');
  heads.className = 'pool-row pool-row--head';
  heads.innerHTML = '<span>Pool</span><span>Campaña</span><span>Meta (kg)</span><span></span>';
  wrap.appendChild(heads);

  (catalog.pools || []).forEach((pool) => {
    const row = document.createElement('div');
    row.className = 'pool-row';
    const camp = Number(pool.campaign) || 1;
    row.classList.add(`prod-cat-row--c${camp}`);

    const name = document.createElement('input');
    name.type = 'text';
    name.className = 'metas-input';
    name.value = pool.name;
    name.setAttribute('aria-label', 'Nombre del pool');
    name.addEventListener('change', (e) => onPoolUpdate(pool.id, 'name', e.target.value.trim() || pool.name));
    row.appendChild(name);

    const campSel = document.createElement('select');
    campSel.className = 'wh-select';
    CAMPAIGN_IDS.forEach((n) => {
      const o = document.createElement('option');
      o.value = n; o.textContent = CAMPAIGNS[n].name;
      if (camp === n) o.selected = true;
      campSel.appendChild(o);
    });
    campSel.addEventListener('change', (e) => onPoolUpdate(pool.id, 'campaign', Number(e.target.value)));
    row.appendChild(campSel);

    const meta = document.createElement('input');
    meta.type = 'number';
    meta.min = '0'; meta.step = '1000';
    meta.className = 'metas-input';
    meta.value = pool.meta || '';
    meta.placeholder = '0';
    meta.setAttribute('aria-label', 'Meta del pool en kg');
    meta.addEventListener('change', (e) => onPoolUpdate(pool.id, 'meta', Math.max(0, Number(e.target.value) || 0)));
    row.appendChild(meta);

    const rm = document.createElement('button');
    rm.type = 'button';
    rm.className = 'wh-remove wh-remove--inline';
    rm.title = `Quitar ${pool.name}`;
    rm.innerHTML = '<i data-lucide="trash-2"></i>';
    rm.addEventListener('click', () => onPoolRemove(pool.id));
    row.appendChild(rm);

    wrap.appendChild(row);
  });

  const add = document.createElement('button');
  add.type = 'button';
  add.className = 'wh-add';
  add.innerHTML = '<i data-lucide="plus"></i> Agregar pool';
  add.addEventListener('click', () => onPoolAdd(1));
  wrap.appendChild(add);
  return wrap;
}

// --- Productos -------------------------------------------------------------
function corteOptions(catalog, currentStart) {
  const opts = [];
  CAMPAIGN_IDS.forEach((camp) => {
    (catalog.cortes?.[camp] || []).forEach((m) => opts.push({ value: m, label: `${CAMPAIGNS[camp].name} · ${monthName(m)}` }));
  });
  if (currentStart != null && !opts.some((o) => o.value === currentStart)) {
    opts.push({ value: currentStart, label: `${monthName(currentStart)} (sin corte)` });
  }
  return opts;
}

function productsSection(catalog, cb) {
  const {
    onProdAdd, onProdUpdate, onProdRemove, onResetCatalog,
    selected, bulkCategory, bulkPool, bulkCountry, onToggleSelect, onSelectAll,
    onBulkCategory, onBulkApply, onBulkPool, onBulkApplyPool, onBulkCountry, onBulkApplyCountry,
  } = cb;
  const cats = catalog.categories || [];
  const pools = catalog.pools || [];
  const poolById = Object.fromEntries(pools.map((p) => [p.id, p]));
  const sorted = [...(catalog.products || [])].sort((a, b) => a.startCorte - b.startCorte || a.name.localeCompare(b.name));
  const ids = sorted.map((p) => p.id);

  const wrap = document.createElement('div');
  const intro = document.createElement('p');
  intro.className = 'view-sub';
  intro.innerHTML = 'Selecciona varios productos y aplícales una <strong>categoría</strong> en lote. Cada producto tiene una categoría y un <strong>corte de inicio</strong> (define su campaña y color).';
  wrap.appendChild(intro);

  // Bulk action bar
  const bulk = document.createElement('div');
  bulk.className = 'bulk-bar';
  const count = document.createElement('span');
  count.className = 'bulk-count';
  count.textContent = `${selected.size} seleccionado${selected.size === 1 ? '' : 's'}`;
  bulk.appendChild(count);

  const sel = document.createElement('select');
  sel.className = 'wh-select';
  const ph = document.createElement('option'); ph.value = ''; ph.textContent = '— categoría —';
  if (!bulkCategory) ph.selected = true; sel.appendChild(ph);
  cats.forEach((c) => {
    const o = document.createElement('option');
    o.value = c.key; o.textContent = `${c.name} (${c.macro === 'mirc' ? 'MIRC' : 'Community'})`;
    if (bulkCategory === c.key) o.selected = true;
    sel.appendChild(o);
  });
  sel.addEventListener('change', (e) => onBulkCategory(e.target.value));
  bulk.appendChild(sel);

  const apply = document.createElement('button');
  apply.type = 'button';
  apply.className = 'fc-btn fc-btn-primary bulk-apply';
  apply.textContent = 'Aplicar categoría';
  apply.disabled = !selected.size;
  apply.addEventListener('click', () => onBulkApply());
  bulk.appendChild(apply);

  // Pool bulk assignment
  const poolSel = document.createElement('select');
  poolSel.className = 'wh-select';
  const pph = document.createElement('option'); pph.value = ''; pph.textContent = '— pool —';
  if (!bulkPool) pph.selected = true; poolSel.appendChild(pph);
  pools.forEach((pl) => {
    const o = document.createElement('option');
    o.value = pl.id; o.textContent = `${pl.name} (${CAMPAIGNS[Number(pl.campaign) || 1].name})`;
    if (bulkPool === pl.id) o.selected = true;
    poolSel.appendChild(o);
  });
  poolSel.addEventListener('change', (e) => onBulkPool(e.target.value));
  bulk.appendChild(poolSel);

  const applyPool = document.createElement('button');
  applyPool.type = 'button';
  applyPool.className = 'fc-btn fc-btn-navy bulk-apply';
  applyPool.textContent = 'Aplicar pool';
  applyPool.disabled = !selected.size;
  applyPool.addEventListener('click', () => onBulkApplyPool());
  bulk.appendChild(applyPool);

  // Country (origin) bulk assignment — Colombia / Rwanda
  if (onBulkCountry) {
    const cSel = document.createElement('select');
    cSel.className = 'wh-select';
    const cph = document.createElement('option'); cph.value = ''; cph.textContent = '— país —';
    if (!bulkCountry) cph.selected = true; cSel.appendChild(cph);
    COUNTRIES.forEach((name) => {
      const o = document.createElement('option');
      o.value = name; o.textContent = name;
      if (bulkCountry === name) o.selected = true;
      cSel.appendChild(o);
    });
    cSel.addEventListener('change', (e) => onBulkCountry(e.target.value));
    bulk.appendChild(cSel);

    const applyCountry = document.createElement('button');
    applyCountry.type = 'button';
    applyCountry.className = 'fc-btn fc-btn-navy bulk-apply';
    applyCountry.textContent = 'Aplicar país';
    applyCountry.disabled = !selected.size || !bulkCountry;
    applyCountry.addEventListener('click', () => onBulkApplyCountry());
    bulk.appendChild(applyCountry);
  }
  wrap.appendChild(bulk);

  // Header with select-all
  const heads = document.createElement('div');
  heads.className = 'prod-cat-row prod-cat-row--head';
  const allOn = ids.length > 0 && ids.every((id) => selected.has(id));
  const selAll = document.createElement('input');
  selAll.type = 'checkbox';
  selAll.className = 'prod-check';
  selAll.checked = allOn;
  selAll.setAttribute('aria-label', 'Seleccionar todos');
  selAll.addEventListener('change', (e) => onSelectAll(ids, e.target.checked));
  heads.appendChild(selAll);
  ['Producto', 'Categoría', 'Corte de inicio', ''].forEach((t) => {
    const s = document.createElement('span'); s.textContent = t; heads.appendChild(s);
  });
  wrap.appendChild(heads);

  sorted.forEach((p) => {
    const row = document.createElement('div');
    row.className = 'prod-cat-row' + (selected.has(p.id) ? ' is-selected' : '');
    const camp = productCampaign(p);
    if (camp) row.classList.add(`prod-cat-row--c${camp}`);

    const check = document.createElement('input');
    check.type = 'checkbox';
    check.className = 'prod-check';
    check.checked = selected.has(p.id);
    check.setAttribute('aria-label', `Seleccionar ${p.name}`);
    check.addEventListener('change', () => onToggleSelect(p.id));
    row.appendChild(check);

    const nameCell = document.createElement('div');
    nameCell.className = 'prod-name-cell';
    const name = document.createElement('input');
    name.type = 'text';
    name.className = 'metas-input';
    name.value = p.name;
    name.setAttribute('aria-label', 'Nombre del producto');
    name.addEventListener('change', (e) => onProdUpdate(p.id, 'name', e.target.value.trim() || p.name));
    nameCell.appendChild(name);
    if (p.country === 'Rwanda') {
      const ctag = document.createElement('span');
      ctag.className = 'prod-pool-tag prod-country-tag';
      ctag.textContent = 'Rwanda';
      nameCell.appendChild(ctag);
    }
    if (p.pool && poolById[p.pool]) {
      const ptag = document.createElement('span');
      ptag.className = 'prod-pool-tag';
      ptag.textContent = `pool: ${poolById[p.pool].name}`;
      nameCell.appendChild(ptag);
    }
    row.appendChild(nameCell);

    const cat = document.createElement('select');
    cat.className = 'wh-select cat-select';
    const none = document.createElement('option'); none.value = ''; none.textContent = '— sin categoría —';
    if (!p.category) none.selected = true; cat.appendChild(none);
    cats.forEach((c) => {
      const o = document.createElement('option');
      o.value = c.key; o.textContent = `${c.name} (${c.macro === 'mirc' ? 'MIRC' : 'Community'})`;
      if (p.category === c.key) o.selected = true;
      cat.appendChild(o);
    });
    cat.addEventListener('change', (e) => onProdUpdate(p.id, 'category', e.target.value));
    row.appendChild(cat);

    const corte = document.createElement('select');
    corte.className = 'wh-select corte-select';
    corteOptions(catalog, p.startCorte).forEach((o) => {
      const opt = document.createElement('option');
      opt.value = o.value; opt.textContent = o.label;
      if (p.startCorte === o.value) opt.selected = true;
      corte.appendChild(opt);
    });
    corte.addEventListener('change', (e) => onProdUpdate(p.id, 'startCorte', Number(e.target.value)));
    row.appendChild(corte);

    const rm = document.createElement('button');
    rm.type = 'button';
    rm.className = 'wh-remove wh-remove--inline';
    rm.title = `Quitar ${p.name}`;
    rm.innerHTML = '<i data-lucide="trash-2"></i>';
    rm.addEventListener('click', () => onProdRemove(p.id));
    row.appendChild(rm);

    wrap.appendChild(row);
  });

  const actions = document.createElement('div');
  actions.className = 'prod-actions';

  const add = document.createElement('button');
  add.type = 'button';
  add.className = 'wh-add';
  add.innerHTML = '<i data-lucide="plus"></i> Agregar producto';
  add.addEventListener('click', () => onProdAdd());
  actions.appendChild(add);

  if (onResetCatalog) {
    const reset = document.createElement('button');
    reset.type = 'button';
    reset.className = 'fc-btn fc-btn-ghost prod-reset';
    reset.innerHTML = '<i data-lucide="rotate-ccw"></i> Cargar catálogo base';
    reset.title = 'Reemplaza categorías, cortes, pools, productos y capacidades con la lista base';
    reset.addEventListener('click', () => {
      if (window.confirm('¿Reemplazar todo el catálogo (categorías, cortes, pools, productos) y cargar las capacidades por producto con la lista base? Esto borra los productos actuales.')) {
        onResetCatalog();
      }
    });
    actions.appendChild(reset);
  }

  wrap.appendChild(actions);
  return wrap;
}
