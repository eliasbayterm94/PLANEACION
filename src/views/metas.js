import {
  listCountries, marketGoal, marketGoalTotal, countrySalidas,
  marketShipmentArrivals, containersToKg,
} from '../model.js';

/**
 * Metas — kg goals for the plan, on two axes:
 *
 *  1. Per SALES region (market): Community + MIRC kg. This is the demand plan.
 *  2. MIRC target per PRODUCING country (Colombia, Rwanda). Community has no
 *     country target (demand-driven).
 *
 * Salidas/llegadas (containers) are shown in kg as context; they are not yet
 * split by category.
 */
export function renderMetas({ schedules, markets, goals, shipments, leadLookup, onMarketGoal, onCountryMirc }) {
  const el = document.createElement('div');
  el.appendChild(header());
  el.appendChild(marketCard(markets, goals, shipments, leadLookup, onMarketGoal));
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
      <strong>Community</strong> y <strong>MIRC</strong>. Además, una meta de
      <strong>MIRC por país productor</strong> (Colombia, Rwanda);
      <strong>Community</strong> va por demanda y proyecciones (sin meta de país).
      Las salidas/llegadas se muestran en kg como referencia.
    </p>`;
  return wrap;
}

/** Section 1: Community + MIRC goals per sales region (market). */
function marketCard(markets, goals, shipments, leadLookup, onMarketGoal) {
  const card = document.createElement('section');
  card.className = 'wh-card';

  const title = document.createElement('div');
  title.className = 'wh-card-head';
  title.innerHTML = '<span class="wh-card-title">Metas por región de venta</span>';
  card.appendChild(title);

  const heads = document.createElement('div');
  heads.className = 'metas-row metas-row--head';
  heads.innerHTML =
    '<span>Mercado</span><span>Community (kg)</span><span>MIRC (kg)</span><span>Total</span><span>Llegadas</span>';
  card.appendChild(heads);

  let totCommunity = 0;
  let totMirc = 0;
  markets.forEach((mk) => {
    totCommunity += marketGoal(goals, mk.slug, 'community');
    totMirc += marketGoal(goals, mk.slug, 'mirc');

    const row = document.createElement('div');
    row.className = 'metas-row';

    const name = document.createElement('span');
    name.className = 'metas-region';
    name.textContent = mk.name;
    row.appendChild(name);

    ['community', 'mirc'].forEach((cat) => {
      const input = document.createElement('input');
      input.type = 'number';
      input.min = '0';
      input.step = '1000';
      input.className = 'metas-input';
      input.value = marketGoal(goals, mk.slug, cat) || '';
      input.placeholder = '0';
      input.setAttribute('aria-label', `Meta ${cat} de ${mk.name} en kg`);
      input.addEventListener('change', (e) => onMarketGoal(mk.slug, cat, Math.max(0, Number(e.target.value) || 0)));
      row.appendChild(input);
    });

    const total = document.createElement('span');
    total.className = 'metas-total';
    total.textContent = fmtKg(marketGoalTotal(goals, mk.slug));
    row.appendChild(total);

    const arr = marketShipmentArrivals(shipments, leadLookup, mk.slug).allocated;
    const llegadas = document.createElement('span');
    llegadas.className = 'metas-salidas';
    llegadas.textContent = fmtKg(containersToKg(arr));
    row.appendChild(llegadas);

    card.appendChild(row);
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
    row.appendChild(input);

    const salidas = document.createElement('span');
    salidas.className = 'metas-salidas';
    const cont = countrySalidas(shipments, schedules, country, leadLookup);
    salidas.textContent = fmtKg(containersToKg(cont));
    row.appendChild(salidas);

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
