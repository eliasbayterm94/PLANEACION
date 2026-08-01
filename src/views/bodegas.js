import { OFFSETS } from '../model.js';

/**
 * Bodegas — edit the warehouses (and lead times) per destination market.
 *
 * Each market lists its warehouses; every warehouse has a name, a lead time in
 * months (despacho -> landing, may be 1.5), and a "principal" flag. The primary
 * warehouse's lead time drives the market's arrival timing in the plan.
 *
 * Pure view: every edit calls onChange(marketSlug, newConfig); persistence and
 * state live in main.js.
 */
export function renderBodegas({ markets, warehouses, onChange }) {
  const el = document.createElement('div');
  el.appendChild(header());

  markets.forEach((mk) => {
    const cfg = warehouses[mk.slug] || { primary: null, warehouses: [] };
    el.appendChild(marketCard(mk, cfg, onChange));
  });

  return el;
}

function header() {
  const wrap = document.createElement('div');
  wrap.className = 'view-head';
  wrap.innerHTML = `
    <h2>Bodegas por destino</h2>
    <p class="view-sub">
      Las bodegas a las que llega el café en cada destino, con su
      <strong>lead time</strong> (meses desde que sale a que llega). La bodega
      marcada como <strong>principal</strong> define la llegada en la planeación
      del mercado. El lead puede ser fraccionario (p. ej. 1.5); la reja mensual
      redondea al mes más cercano.
    </p>`;
  return wrap;
}

function marketCard(mk, cfg, onChange) {
  const card = document.createElement('section');
  card.className = 'wh-card';

  const head = document.createElement('div');
  head.className = 'wh-card-head';
  const count = cfg.warehouses.length;
  head.innerHTML =
    `<span class="wh-card-title">${mk.name}</span>` +
    `<span class="wh-card-sub">Meta ${mk.target} · ${count} ${count === 1 ? 'bodega' : 'bodegas'}</span>`;
  card.appendChild(head);

  // Commit a new list/primary for this market.
  const commit = (list, primary) => {
    const names = list.map((w) => w.name);
    let prim = primary;
    if (!prim || !names.includes(prim)) prim = list.length ? list[0].name : null;
    onChange(mk.slug, { primary: prim, warehouses: list });
  };

  const list = document.createElement('div');
  list.className = 'wh-list';

  if (!count) {
    const empty = document.createElement('p');
    empty.className = 'wh-empty';
    empty.textContent = 'Sin bodegas. Agrega la primera.';
    list.appendChild(empty);
  } else {
    const heads = document.createElement('div');
    heads.className = 'wh-row wh-row--head';
    heads.innerHTML =
      '<span class="wh-col-primary">Ppal</span>' +
      '<span class="wh-col-name">Bodega</span>' +
      '<span class="wh-col-lead">Lead (meses)</span>' +
      '<span class="wh-col-actions"></span>';
    list.appendChild(heads);
  }

  cfg.warehouses.forEach((w, idx) => {
    const row = document.createElement('div');
    row.className = 'wh-row';

    // Primary radio
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = `primary-${mk.slug}`;
    radio.checked = w.name === cfg.primary;
    radio.className = 'wh-primary';
    radio.setAttribute('aria-label', `Marcar ${w.name} como principal`);
    radio.addEventListener('change', () => commit(clone(cfg.warehouses), w.name));
    row.appendChild(radio);

    // Name
    const name = document.createElement('input');
    name.type = 'text';
    name.className = 'wh-input wh-input-name';
    name.value = w.name;
    name.placeholder = 'Nombre';
    name.setAttribute('aria-label', 'Nombre de la bodega');
    name.addEventListener('change', (e) => {
      const next = clone(cfg.warehouses);
      const newName = e.target.value.trim() || `Bodega ${idx + 1}`;
      const wasPrimary = cfg.primary === next[idx].name;
      next[idx].name = newName;
      commit(next, wasPrimary ? newName : cfg.primary);
    });
    row.appendChild(name);

    // Lead
    const lead = document.createElement('input');
    lead.type = 'number';
    lead.min = '0';
    lead.step = '0.5';
    lead.className = 'wh-input wh-input-lead';
    lead.value = w.lead;
    lead.setAttribute('aria-label', `Lead time de ${w.name} en meses`);
    lead.addEventListener('change', (e) => {
      const next = clone(cfg.warehouses);
      const v = Math.max(0, Number(e.target.value) || 0);
      next[idx].lead = v;
      commit(next, cfg.primary);
    });
    row.appendChild(lead);

    // Remove
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'wh-remove';
    remove.title = `Eliminar ${w.name}`;
    remove.setAttribute('aria-label', `Eliminar ${w.name}`);
    remove.innerHTML = '<i data-lucide="trash-2"></i>';
    remove.addEventListener('click', () => {
      const next = clone(cfg.warehouses).filter((_, i) => i !== idx);
      const primary = cfg.primary === w.name ? null : cfg.primary;
      commit(next, primary);
    });
    row.appendChild(remove);

    list.appendChild(row);
  });

  card.appendChild(list);

  const add = document.createElement('button');
  add.type = 'button';
  add.className = 'wh-add';
  add.innerHTML = '<i data-lucide="plus"></i> Agregar bodega';
  add.addEventListener('click', () => {
    const next = clone(cfg.warehouses);
    next.push({ name: `Bodega ${next.length + 1}`, lead: OFFSETS.despachoToEntrega });
    commit(next, cfg.primary || next[next.length - 1].name);
  });
  card.appendChild(add);

  return card;
}

function clone(list) {
  return list.map((w) => ({ ...w }));
}
