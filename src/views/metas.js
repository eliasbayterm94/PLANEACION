import {
  listCountries, marketGoal, marketGoalTotal, warehouseGoal, warehouseGoalTotal,
  countrySalidas, marketShipmentArrivals, warehouseAllocatedAll, containersToKg,
} from '../model.js';

/**
 * Metas — kg goals for the plan, on two axes:
 *
 *  1. Per SALES region (market): Community + MIRC kg. Most markets enter one
 *     market-level goal; markets flagged `goalsByWarehouse` (Europa) enter a
 *     goal per warehouse (Rotterdam, UK) instead.
 *  2. MIRC target per PRODUCING country (Colombia, Rwanda). Community has no
 *     country target (demand-driven).
 *
 * Salidas/llegadas (containers) are shown in kg as context; they are not yet
 * split by category.
 */
export function renderMetas({
  schedules, markets, warehouses, goals, shipments, leadLookup, onMarketGoal, onWarehouseGoal, onCountryMirc,
}) {
  const el = document.createElement('div');
  el.appendChild(header());
  el.appendChild(marketCard(markets, warehouses, goals, shipments, leadLookup, onMarketGoal, onWarehouseGoal));
  el.appendChild(countryCard(schedules, goals, shipments, leadLookup, onCountryMirc));
  return el;
}

function header() {
  const wrap = document.createElement('div');
  wrap.className = 'view-head';
  wrap.innerHTML = `
    <h2>Metas 2027</h2>
    <p class="view-sub">
      Meta en kg por <strong>región de venta</strong> (mercado), en dos categorías:
      <strong>Community</strong> y <strong>MIRC</strong>. Europa se ingresa
      <strong>por bodega</strong> (Rotterdam, UK). Además, una meta de
      <strong>MIRC por país productor</strong> (Colombia, Rwanda);
      <strong>Community</strong> va por demanda (sin meta de país).
      Las salidas/llegadas se muestran en kg como referencia.
    </p>`;
  return wrap;
}

/** A labelled cell: the label shows on mobile (the column header hides there). */
function field(labelText, node) {
  const wrap = document.createElement('div');
  wrap.className = 'metas-field';
  const lab = document.createElement('span');
  lab.className = 'metas-field-label';
  lab.textContent = labelText;
  wrap.appendChild(lab);
  wrap.appendChild(node);
  return wrap;
}

function goalInput(category, value, cb, ariaBase) {
  const input = document.createElement('input');
  input.type = 'number';
  input.min = '0';
  input.step = '1000';
  input.className = 'metas-input';
  input.value = value || '';
  input.placeholder = '0';
  input.setAttribute('aria-label', `Meta ${category} de ${ariaBase} en kg`);
  input.addEventListener('change', (e) => cb(Math.max(0, Number(e.target.value) || 0)));
  return input;
}

function valueSpan(cls, text) {
  const s = document.createElement('span');
  s.className = cls;
  s.textContent = text;
  return s;
}

function goalRow({ label, indent, community, mirc, total, context, onCommunity, onMirc, ariaBase }) {
  const row = document.createElement('div');
  row.className = 'metas-row' + (indent ? ' metas-row--sub' : '');

  const name = document.createElement('span');
  name.className = 'metas-region';
  name.textContent = label;
  row.appendChild(name);

  row.appendChild(field('Community (kg)', goalInput('community', community, onCommunity, ariaBase)));
  row.appendChild(field('MIRC (kg)', goalInput('mirc', mirc, onMirc, ariaBase)));
  row.appendChild(field('Total', valueSpan('metas-total', fmtKg(total))));
  row.appendChild(field('Llegadas', valueSpan('metas-salidas', fmtKg(context))));

  return row;
}

/** Section 1: Community + MIRC goals per sales region (market or warehouse). */
function marketCard(markets, warehouses, goals, shipments, leadLookup, onMarketGoal, onWarehouseGoal) {
  const card = document.createElement('section');
  card.className = 'wh-card';

  const title = document.createElement('div');
  title.className = 'wh-card-head';
  title.innerHTML = '<span class="wh-card-title">Metas por región de venta</span>';
  card.appendChild(title);

  const heads = document.createElement('div');
  heads.className = 'metas-row metas-row--head';
  heads.innerHTML =
    '<span>Mercado / bodega</span><span>Community (kg)</span><span>MIRC (kg)</span><span>Total</span><span>Llegadas</span>';
  card.appendChild(heads);

  let totCommunity = 0;
  let totMirc = 0;

  markets.forEach((mk) => {
    if (mk.goalsByWarehouse) {
      // Market subheader + one row per warehouse.
      const sub = document.createElement('div');
      sub.className = 'group-label';
      sub.textContent = mk.name;
      card.appendChild(sub);

      (warehouses[mk.slug]?.warehouses || []).forEach((w) => {
        totCommunity += warehouseGoal(goals, w.name, 'community');
        totMirc += warehouseGoal(goals, w.name, 'mirc');
        card.appendChild(goalRow({
          label: w.name,
          indent: true,
          community: warehouseGoal(goals, w.name, 'community'),
          mirc: warehouseGoal(goals, w.name, 'mirc'),
          total: warehouseGoalTotal(goals, w.name),
          context: containersToKg(warehouseAllocatedAll(shipments, w.name)),
          onCommunity: (kg) => onWarehouseGoal(w.name, 'community', kg),
          onMirc: (kg) => onWarehouseGoal(w.name, 'mirc', kg),
          ariaBase: w.name,
        }));
      });
    } else {
      totCommunity += marketGoal(goals, mk.slug, 'community');
      totMirc += marketGoal(goals, mk.slug, 'mirc');
      card.appendChild(goalRow({
        label: mk.name,
        community: marketGoal(goals, mk.slug, 'community'),
        mirc: marketGoal(goals, mk.slug, 'mirc'),
        total: marketGoalTotal(goals, mk.slug),
        context: containersToKg(marketShipmentArrivals(shipments, leadLookup, mk.slug).allocated),
        onCommunity: (kg) => onMarketGoal(mk.slug, 'community', kg),
        onMirc: (kg) => onMarketGoal(mk.slug, 'mirc', kg),
        ariaBase: mk.name,
      }));
    }
  });

  const foot = document.createElement('p');
  foot.className = 'metas-foot';
  foot.innerHTML =
    `Total <strong>Community ${fmtKg(totCommunity)}</strong> · ` +
    `<strong>MIRC ${fmtKg(totMirc)}</strong> (demanda por mercado)`;
  card.appendChild(foot);

  return card;
}

/** Section 2: MIRC target per producing country. */
function countryCard(schedules, goals, shipments, leadLookup, onCountryMirc) {
  const card = document.createElement('section');
  card.className = 'wh-card';

  const title = document.createElement('div');
  title.className = 'wh-card-head';
  title.innerHTML = '<span class="wh-card-title">Meta MIRC por país productor</span>';
  card.appendChild(title);

  const heads = document.createElement('div');
  heads.className = 'metas-row metas-row--head metas-row--country';
  heads.innerHTML = '<span>País</span><span>Meta MIRC (kg)</span><span>Salidas</span>';
  card.appendChild(heads);

  listCountries(schedules).forEach((country) => {
    const row = document.createElement('div');
    row.className = 'metas-row metas-row--country';

    const name = document.createElement('span');
    name.className = 'metas-region';
    name.textContent = country;
    row.appendChild(name);

    const input = document.createElement('input');
    input.type = 'number';
    input.min = '0';
    input.step = '1000';
    input.className = 'metas-input';
    input.value = (Number(goals?.countriesMIRC?.[country]) || 0) || '';
    input.placeholder = '0';
    input.setAttribute('aria-label', `Meta MIRC de ${country} en kg`);
    input.addEventListener('change', (e) => onCountryMirc(country, Math.max(0, Number(e.target.value) || 0)));
    row.appendChild(field('Meta MIRC (kg)', input));

    const cont = countrySalidas(shipments, schedules, country, leadLookup);
    row.appendChild(field('Salidas', valueSpan('metas-salidas', fmtKg(containersToKg(cont)))));

    card.appendChild(row);
  });

  const foot = document.createElement('p');
  foot.className = 'metas-foot';
  foot.textContent = 'La meta de país es solo MIRC. Community va por demanda, sin meta de país.';
  card.appendChild(foot);

  return card;
}

function fmtKg(kg) {
  return `${Math.round(Number(kg) || 0).toLocaleString('es-CO')} kg`;
}
