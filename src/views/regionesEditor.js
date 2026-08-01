import {
  MONTHS, monthName, primaryCampaign, CAMPAIGNS, CUTOFF_DAY,
  shipmentArrival, warehouseAllocated, containersToKg, kgToContainers,
  KG_PER_CONTAINER,
} from '../model.js';

/**
 * Editar regiones — the real salidas plan, per region.
 *
 * Pick a region, then allocate containers per warehouse per month (salidas).
 * The landing row (llegadas) is derived from each warehouse's lead time, so both
 * departure and arrival are visible. Each region+warehouse carries a goal in kg;
 * progress is shown in containers and kg (1 container = KG_PER_CONTAINER kg).
 *
 * This is independent of the cosecha calendar (informational only). The region's
 * derived cutoff months are shown as reference markers, nothing more.
 */
export function renderRegionesEditor({
  schedules, selectedSlug, onSelect,
  shipment, allWarehouses, leadLookup,
  onGoal, onShip, onAddWarehouse, onRemoveWarehouse,
}) {
  const el = document.createElement('div');

  // Region picker
  const pills = document.createElement('div');
  pills.className = 'region-pills';
  schedules.forEach((s) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'region-pill' + (s.slug === selectedSlug ? ' active' : '');
    b.textContent = s.name;
    b.setAttribute('aria-pressed', s.slug === selectedSlug ? 'true' : 'false');
    b.addEventListener('click', () => onSelect(s.slug));
    pills.appendChild(b);
  });
  el.appendChild(pills);

  const schedule = schedules.find((s) => s.slug === selectedSlug) || schedules[0];
  const cfg = shipment || { goals: {}, ship: {} };

  // Which warehouses this region ships to (has a goal or an allocation).
  const added = orderWarehouses(
    [...new Set([...Object.keys(cfg.goals || {}), ...Object.keys(cfg.ship || {})])],
    allWarehouses,
  );

  el.appendChild(header(schedule, cfg, added, leadLookup));

  if (!added.length) {
    const empty = document.createElement('p');
    empty.className = 'wh-empty';
    empty.textContent = 'Esta región aún no envía a ninguna bodega. Agrega una abajo.';
    el.appendChild(empty);
  } else {
    el.appendChild(grid(schedule, cfg, added, leadLookup, onGoal, onShip, onRemoveWarehouse));
  }

  el.appendChild(addBar(selectedSlug, added, allWarehouses, onAddWarehouse));
  return el;
}

function header(s, cfg, added, leadLookup) {
  const wrap = document.createElement('div');
  wrap.className = 'view-head';
  const camp = primaryCampaign(s);
  let allocated = 0;
  let goalKg = 0;
  added.forEach((wh) => {
    allocated += warehouseAllocated(cfg, wh);
    goalKg += Number(cfg.goals?.[wh]) || 0;
  });
  const allocKg = containersToKg(allocated);
  const goalCont = kgToContainers(goalKg);
  const pct = goalKg ? Math.round((allocKg / goalKg) * 100) : 0;
  wrap.innerHTML = `
    <h2>${s.name}</h2>
    <p class="view-sub">
      ${CAMPAIGNS[camp]?.name ?? 'Sin campaña'} ·
      Salidas <strong>${allocated}</strong> cont (${fmtKg(allocKg)}) ·
      Meta <strong>${fmtKg(goalKg)}</strong> (${goalCont ? goalCont.toFixed(1) : 0} cont) ·
      <strong class="tally tally--${goalKg && allocKg > goalKg ? 'over' : pct === 100 ? 'exact' : 'under'}">${pct}%</strong> ·
      Cortes (ref.) el día ${CUTOFF_DAY}
    </p>`;
  return wrap;
}

function grid(s, cfg, added, leadLookup, onGoal, onShip, onRemoveWarehouse) {
  const g = document.createElement('div');
  g.className = 'grid grid--region';

  // Month header, marking the region's cutoff months as reference.
  g.appendChild(document.createElement('div'));
  MONTHS.forEach((m, i) => {
    const h = document.createElement('div');
    h.className = 'month-head';
    h.textContent = m;
    if (s.corte.includes(i)) h.classList.add('month-head--cut');
    g.appendChild(h);
  });

  added.forEach((wh) => {
    const info = leadLookup[wh] || { lead: 1, market: '' };
    const allocated = warehouseAllocated(cfg, wh);
    const goalKg = Number(cfg.goals?.[wh]) || 0;
    const allocKg = containersToKg(allocated);
    const pct = goalKg ? Math.round((allocKg / goalKg) * 100) : 0;

    // Group label: warehouse + market + lead + goal input + progress + remove.
    const gl = document.createElement('div');
    gl.className = 'group-label wh-group';
    const meta = document.createElement('div');
    meta.className = 'wh-group-inner';
    meta.innerHTML =
      `<span class="wh-group-name">${wh}</span>` +
      `<span class="wh-group-meta">${info.marketName || info.market} · lead ${leadLabel(info.lead)}</span>`;
    const goalWrap = document.createElement('label');
    goalWrap.className = 'wh-goal';
    goalWrap.innerHTML = '<span>Meta kg</span>';
    const goalInput = document.createElement('input');
    goalInput.type = 'number';
    goalInput.min = '0';
    goalInput.step = '1000';
    goalInput.value = goalKg || '';
    goalInput.placeholder = '0';
    goalInput.setAttribute('aria-label', `Meta en kg para ${wh}`);
    goalInput.addEventListener('change', (e) => onGoal(wh, Math.max(0, Number(e.target.value) || 0)));
    goalWrap.appendChild(goalInput);
    const prog = document.createElement('span');
    prog.className = 'wh-progress';
    prog.textContent = goalKg ? `${allocated} cont · ${pct}%` : `${allocated} cont`;
    const rm = document.createElement('button');
    rm.type = 'button';
    rm.className = 'wh-remove wh-remove--inline';
    rm.title = `Quitar ${wh} de ${s.name}`;
    rm.innerHTML = '<i data-lucide="x"></i>';
    rm.addEventListener('click', () => onRemoveWarehouse(wh));

    meta.appendChild(goalWrap);
    meta.appendChild(prog);
    meta.appendChild(rm);
    gl.appendChild(meta);
    g.appendChild(gl);

    // Salida row (editable)
    const salLabel = document.createElement('div');
    salLabel.className = 'row-label';
    salLabel.textContent = 'Salida';
    g.appendChild(salLabel);
    for (let i = 0; i < 12; i++) {
      const cell = document.createElement('div');
      cell.className = 'cell cell--tall';
      const input = document.createElement('input');
      input.type = 'number';
      input.min = '0';
      input.className = 'qty';
      input.value = cfg.ship?.[wh]?.[i] || '';
      input.placeholder = '0';
      input.setAttribute('aria-label', `Contenedores a ${wh} que salen en ${monthName(i)}`);
      input.addEventListener('change', (e) => onShip(wh, i, Math.max(0, parseInt(e.target.value, 10) || 0)));
      cell.appendChild(input);
      g.appendChild(cell);
    }

    // Llegada row (derived)
    const llegadas = new Array(12).fill(0);
    Object.entries(cfg.ship?.[wh] || {}).forEach(([m, n]) => {
      llegadas[shipmentArrival(m, info.lead)] += Number(n) || 0;
    });
    const llegLabel = document.createElement('div');
    llegLabel.className = 'row-label';
    llegLabel.textContent = 'Llega';
    g.appendChild(llegLabel);
    for (let i = 0; i < 12; i++) {
      const cell = document.createElement('div');
      cell.className = 'cell cell--num';
      if (llegadas[i] > 0) {
        cell.textContent = llegadas[i];
        cell.classList.add('cell--on', 'cell--market');
      } else {
        cell.textContent = '—';
        cell.classList.add('cell--empty');
      }
      g.appendChild(cell);
    }
  });

  return g;
}

function addBar(regionSlug, added, allWarehouses, onAddWarehouse) {
  const wrap = document.createElement('div');
  wrap.className = 'wh-addbar';

  const available = allWarehouses.filter((w) => !added.includes(w.name));
  const select = document.createElement('select');
  select.className = 'wh-select';
  select.setAttribute('aria-label', 'Bodega a agregar');
  if (!available.length) {
    const opt = document.createElement('option');
    opt.textContent = 'No quedan bodegas por agregar';
    opt.value = '';
    select.appendChild(opt);
    select.disabled = true;
  } else {
    const ph = document.createElement('option');
    ph.value = '';
    ph.textContent = 'Elegir bodega…';
    select.appendChild(ph);
    // Group by market
    const byMarket = {};
    available.forEach((w) => { (byMarket[w.marketName] ||= []).push(w); });
    Object.entries(byMarket).forEach(([mkName, list]) => {
      const grp = document.createElement('optgroup');
      grp.label = mkName;
      list.forEach((w) => {
        const opt = document.createElement('option');
        opt.value = w.name;
        opt.textContent = `${w.name} (lead ${leadLabel(w.lead)})`;
        grp.appendChild(opt);
      });
      select.appendChild(grp);
    });
  }

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'wh-add';
  btn.innerHTML = '<i data-lucide="plus"></i> Agregar bodega';
  btn.addEventListener('click', () => {
    if (select.value) onAddWarehouse(select.value);
  });

  wrap.appendChild(select);
  wrap.appendChild(btn);
  return wrap;
}

// --- helpers ---------------------------------------------------------------
function orderWarehouses(names, allWarehouses) {
  const order = allWarehouses.map((w) => w.name);
  return [...names].sort((a, b) => order.indexOf(a) - order.indexOf(b));
}

function leadLabel(lead) {
  const n = Number(lead) || 0;
  return `${n % 1 === 0 ? n : n.toFixed(1)} ${n === 1 ? 'mes' : 'meses'}`;
}

function fmtKg(kg) {
  return `${Math.round(Number(kg) || 0).toLocaleString('es-CO')} kg`;
}
