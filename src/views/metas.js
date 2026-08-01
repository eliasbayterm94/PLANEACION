import {
  listCountries, regionGoal, regionGoalTotal, countryPlanned,
  regionShipmentSummary, containersToKg,
} from '../model.js';

/**
 * Metas — kg goals for the plan.
 *
 * Two macro categories per region: Community and MIRC. Community is
 * demand-driven (no country target); MIRC additionally rolls up to a
 * country-level target (Colombia, Rwanda). Salidas (containers shipped) are
 * shown in kg as context, but are not yet split by category.
 */
export function renderMetas({ schedules, goals, shipments, leadLookup, onRegionGoal, onCountryMirc }) {
  const el = document.createElement('div');
  el.appendChild(header());

  const countries = listCountries(schedules);
  countries.forEach((country) => {
    el.appendChild(countryCard(country, schedules, goals, shipments, leadLookup, onRegionGoal, onCountryMirc));
  });

  return el;
}

function header() {
  const wrap = document.createElement('div');
  wrap.className = 'view-head';
  wrap.innerHTML = `
    <h2>Metas 2027</h2>
    <p class="view-sub">
      Meta en kg por región, en dos categorías: <strong>Community</strong> y
      <strong>MIRC</strong>. La meta de <strong>MIRC</strong> tiene además un
      objetivo por país; <strong>Community</strong> va por demanda y proyecciones
      (sin meta de país). Las salidas se muestran en kg como referencia.
    </p>`;
  return wrap;
}

function countryCard(country, schedules, goals, shipments, leadLookup, onRegionGoal, onCountryMirc) {
  const card = document.createElement('section');
  card.className = 'wh-card';

  const regions = schedules.filter((s) => s.country === country);
  const mircTarget = Number(goals?.countriesMIRC?.[country]) || 0;
  const mircPlanned = countryPlanned(goals, schedules, country, 'mirc');
  const communityPlanned = countryPlanned(goals, schedules, country, 'community');
  const pct = mircTarget ? Math.round((mircPlanned / mircTarget) * 100) : 0;
  const state = mircTarget && mircPlanned > mircTarget ? 'over' : pct === 100 ? 'exact' : 'under';

  // Header: country + MIRC target + rollup
  const head = document.createElement('div');
  head.className = 'metas-country-head';
  const title = document.createElement('span');
  title.className = 'wh-card-title';
  title.textContent = country;
  head.appendChild(title);

  const targetWrap = document.createElement('label');
  targetWrap.className = 'metas-target';
  targetWrap.innerHTML = '<span>Meta MIRC país (kg)</span>';
  const targetInput = document.createElement('input');
  targetInput.type = 'number';
  targetInput.min = '0';
  targetInput.step = '1000';
  targetInput.value = mircTarget || '';
  targetInput.placeholder = '0';
  targetInput.setAttribute('aria-label', `Meta MIRC de ${country} en kg`);
  targetInput.addEventListener('change', (e) => onCountryMirc(country, Math.max(0, Number(e.target.value) || 0)));
  targetWrap.appendChild(targetInput);
  head.appendChild(targetWrap);

  const roll = document.createElement('span');
  roll.className = 'metas-rollup';
  roll.innerHTML = `MIRC plan <strong class="tally tally--${state}">${fmtKg(mircPlanned)}</strong>` +
    (mircTarget ? ` / ${fmtKg(mircTarget)} · ${pct}%` : '');
  head.appendChild(roll);

  card.appendChild(head);

  // Column header
  const heads = document.createElement('div');
  heads.className = 'metas-row metas-row--head';
  heads.innerHTML =
    '<span>Región</span>' +
    '<span>Community (kg)</span>' +
    '<span>MIRC (kg)</span>' +
    '<span>Total</span>' +
    '<span>Salidas</span>';
  card.appendChild(heads);

  regions.forEach((s) => {
    const row = document.createElement('div');
    row.className = 'metas-row';

    const name = document.createElement('span');
    name.className = 'metas-region';
    name.textContent = s.name;
    row.appendChild(name);

    ['community', 'mirc'].forEach((cat) => {
      const input = document.createElement('input');
      input.type = 'number';
      input.min = '0';
      input.step = '1000';
      input.className = 'metas-input';
      input.value = regionGoal(goals, s.slug, cat) || '';
      input.placeholder = '0';
      input.setAttribute('aria-label', `Meta ${cat} de ${s.name} en kg`);
      input.addEventListener('change', (e) => onRegionGoal(s.slug, cat, Math.max(0, Number(e.target.value) || 0)));
      row.appendChild(input);
    });

    const total = document.createElement('span');
    total.className = 'metas-total';
    total.textContent = fmtKg(regionGoalTotal(goals, s.slug));
    row.appendChild(total);

    const alloc = regionShipmentSummary(shipments[s.slug], leadLookup).allocated;
    const salidas = document.createElement('span');
    salidas.className = 'metas-salidas';
    salidas.textContent = fmtKg(containersToKg(alloc));
    row.appendChild(salidas);

    card.appendChild(row);
  });

  // Community total (informational)
  const foot = document.createElement('p');
  foot.className = 'metas-foot';
  foot.innerHTML = `Community plan (${country}): <strong>${fmtKg(communityPlanned)}</strong> · por demanda, sin meta de país.`;
  card.appendChild(foot);

  return card;
}

function fmtKg(kg) {
  return `${Math.round(Number(kg) || 0).toLocaleString('es-CO')} kg`;
}
