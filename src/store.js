/**
 * store.js — Container allocations, batched.
 *
 * The original prototype read one key per (region, month) — 132 sequential
 * round trips on load, and a rate-limited failure silently rendered zeros over
 * real data. Here the whole plan loads in ONE query and each edit writes ONE
 * row, debounced.
 *
 * Row shape:  { year, scope: 'region'|'market', slug, months: { "5": 3 } }
 *
 * Runs against localStorage until Supabase credentials are present, so the app
 * is usable before any backend setup.
 */

import { createClient } from '@supabase/supabase-js';
import { YEAR } from './model.js';

const TABLE = 'plan_allocations';
const LOCAL_KEY = `forest-plan-${YEAR}`;
const SAVE_DEBOUNCE_MS = 600;

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isRemote = Boolean(url && key);
const supabase = isRemote ? createClient(url, key) : null;

/** Who is editing — surfaced in the UI so the team can see attribution. */
export const editor =
  localStorage.getItem('forest-plan-editor') || '';

export function setEditor(name) {
  localStorage.setItem('forest-plan-editor', name);
}

// ---------------------------------------------------------------------------
// Load
// ---------------------------------------------------------------------------
/** @returns {{ region: Object, market: Object, error: string|null }} */
export async function loadPlan() {
  if (!isRemote) return { ...readLocal(), error: null };

  const { data, error } = await supabase
    .from(TABLE)
    .select('scope, slug, months, updated_at, updated_by')
    .eq('year', YEAR);

  if (error) {
    // Fall back to the local copy rather than showing zeros over real numbers.
    return { ...readLocal(), error: error.message };
  }

  const plan = { region: {}, market: {} };
  (data || []).forEach((row) => {
    if (!plan[row.scope]) plan[row.scope] = {};
    plan[row.scope][row.slug] = normalise(row.months);
  });

  writeLocal(plan); // keep an offline mirror
  return { ...plan, error: null };
}

// ---------------------------------------------------------------------------
// Save
// ---------------------------------------------------------------------------
const pending = new Map();
const timers = new Map();

/**
 * Queue a save for one slug. Coalesces rapid edits into a single upsert.
 * @param {'region'|'market'} scope
 * @param {string} slug
 * @param {Object} months  full month map for that slug
 * @param {(status: 'saving'|'saved'|'error', detail?: string) => void} onStatus
 */
export function savePlanSlug(scope, slug, months, onStatus = () => {}) {
  const id = `${scope}:${slug}`;
  pending.set(id, { scope, slug, months });

  mergeLocal(scope, slug, months);

  clearTimeout(timers.get(id));
  timers.set(
    id,
    setTimeout(async () => {
      const job = pending.get(id);
      pending.delete(id);
      if (!job) return;

      if (!isRemote) {
        onStatus('saved');
        return;
      }

      onStatus('saving');
      const { error } = await supabase.from(TABLE).upsert(
        {
          year: YEAR,
          scope: job.scope,
          slug: job.slug,
          months: job.months,
          updated_at: new Date().toISOString(),
          updated_by: editor || null,
        },
        { onConflict: 'year,scope,slug' },
      );

      if (error) onStatus('error', error.message);
      else onStatus('saved');
    }, SAVE_DEBOUNCE_MS),
  );
}

// ---------------------------------------------------------------------------
// Realtime — so the team sees each other's edits during a planning session
// ---------------------------------------------------------------------------
export function subscribeToPlan(onChange) {
  if (!isRemote) return () => {};

  const channel = supabase
    .channel('plan-allocations')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: TABLE, filter: `year=eq.${YEAR}` },
      (payload) => {
        const row = payload.new;
        if (!row) return;
        onChange(row.scope, row.slug, normalise(row.months), row.updated_by);
      },
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
}

// ---------------------------------------------------------------------------
// Local mirror
// ---------------------------------------------------------------------------
function readLocal() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return { region: parsed.region || {}, market: parsed.market || {} };
  } catch {
    return { region: {}, market: {} };
  }
}

function writeLocal(plan) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(plan));
  } catch {
    /* quota — non-fatal, remote is the source of truth */
  }
}

function mergeLocal(scope, slug, months) {
  const plan = readLocal();
  if (!plan[scope]) plan[scope] = {};
  plan[scope][slug] = months;
  writeLocal(plan);
}

/** Month maps arrive as JSONB with string keys; keep values numeric. */
function normalise(months) {
  const out = {};
  Object.entries(months || {}).forEach(([k, v]) => {
    const n = Number(v);
    if (n > 0) out[Number(k)] = n;
  });
  return out;
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------
export function toCSV(rows) {
  return rows
    .map((r) => r.map((c) => (/[",\n]/.test(String(c)) ? `"${String(c).replace(/"/g, '""')}"` : c)).join(','))
    .join('\n');
}

export function downloadCSV(filename, rows) {
  const blob = new Blob([toCSV(rows)], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
