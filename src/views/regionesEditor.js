import { renderRegion } from './region.js';

/**
 * Editar regiones — the origin capture surface.
 *
 * A region picker at the top, then the full editable region grid for the
 * selected origin (renderRegion). Consolidates what used to be one tab per
 * region into a single tab with an internal selector. Editing still flows
 * through the same onQty callback, so the model and persistence are untouched.
 */
export function renderRegionesEditor({ schedules, selectedSlug, onSelect, qty, onQty }) {
  const el = document.createElement('div');

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
  el.appendChild(renderRegion({ schedule, qty, onQty }));

  return el;
}
