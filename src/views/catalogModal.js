import { MONTHS, monthName, campaignOfMonth, CAMPAIGNS } from '../model.js';

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
  onProdAdd, onProdUpdate, onProdRemove,
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
  [['cortes', 'Cortes por campaña'], ['categorias', 'Categorías'], ['productos', 'Productos']].forEach(([id, label]) => {
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
  else body.appendChild(productsSection(catalog, onProdAdd, onProdUpdate, onProdRemove));
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

  [1, 2].forEach((camp) => {
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

// --- Productos -------------------------------------------------------------
function corteOptions(catalog, currentStart) {
  const opts = [];
  [1, 2].forEach((camp) => {
    (catalog.cortes?.[camp] || []).forEach((m) => opts.push({ value: m, label: `${CAMPAIGNS[camp].name} · ${monthName(m)}` }));
  });
  if (currentStart != null && !opts.some((o) => o.value === currentStart)) {
    opts.push({ value: currentStart, label: `${monthName(currentStart)} (sin corte)` });
  }
  return opts;
}

function productsSection(catalog, onProdAdd, onProdUpdate, onProdRemove) {
  const wrap = document.createElement('div');
  const intro = document.createElement('p');
  intro.className = 'view-sub';
  intro.innerHTML = 'Cada producto: nombre, categoría y <strong>corte de inicio</strong> (desde qué corte se produce; define su campaña y color).';
  wrap.appendChild(intro);

  const heads = document.createElement('div');
  heads.className = 'prod-cat-row prod-cat-row--head';
  heads.innerHTML = '<span>Producto</span><span>Categoría</span><span>Corte de inicio</span><span></span>';
  wrap.appendChild(heads);

  const cats = catalog.categories || [];
  const sorted = [...(catalog.products || [])].sort((a, b) => a.startCorte - b.startCorte || a.name.localeCompare(b.name));

  sorted.forEach((p) => {
    const row = document.createElement('div');
    row.className = 'prod-cat-row';
    const camp = campaignOfMonth(p.startCorte);
    if (camp) row.classList.add(`prod-cat-row--c${camp}`);

    const name = document.createElement('input');
    name.type = 'text';
    name.className = 'metas-input';
    name.value = p.name;
    name.setAttribute('aria-label', 'Nombre del producto');
    name.addEventListener('change', (e) => onProdUpdate(p.id, 'name', e.target.value.trim() || p.name));
    row.appendChild(name);

    const cat = document.createElement('select');
    cat.className = 'wh-select';
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
    corte.className = 'wh-select';
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

  const add = document.createElement('button');
  add.type = 'button';
  add.className = 'wh-add';
  add.innerHTML = '<i data-lucide="plus"></i> Agregar producto';
  add.addEventListener('click', () => onProdAdd());
  wrap.appendChild(add);
  return wrap;
}
