# Forest Coffee — Plan 2027

Planning tool for the 2027 green coffee campaign. The team uses it to agree on
how many containers ship from each origin, in which month, and against which
market's annual target. It replaces a spreadsheet that nobody trusted.

Owner: Elias Bayter (COO). Audience: commercial and operations team.

---

## The model — read this before changing anything

Every schedule in this app is **derived**, never stored. `src/model.js` is the
only place offsets live.

```
cosecha  →  corte      (+1 month)
corte    →  despacho   (+1 month)
despacho →  entrega    (+1 month, or region.transitMonths)
corte    →  muestra    (-1 month)
```

Cutoffs always fall on **day 15**. Nothing lands in **Abr–Jul**.

Regions declare only their harvest months in `src/data/regions.js`. Two escape
hatches exist and no others should be added:

- `corteMode: 'single'` — one cutoff after the harvest closes, instead of a
  wave per harvest month. Only Rwanda uses this.
- `transitMonths` — override ocean transit. Rwanda is 2.

Markets declare `target` and `arrivalDelay` in `src/data/markets.js`. MENA and
AU carry `arrivalDelay: 1`.

### Warehouses drive the arrival delay

Each market delivers into named **warehouses**, each with a `lead` (months from
despacho to landing). Seeds live in `src/data/warehouses.js`; the **Bodegas** tab
edits them and persists per market (scope `warehouse`, one row each). The
market's **primary** warehouse lead time drives arrival timing via
`marketArrivalDelay(market, cfg)` in `model.js` = `round(primaryLead) −
despachoToEntrega`, falling back to the static `arrivalDelay` when a market has
no warehouse. Lead may be fractional (Annex = 1.5); the exact value is stored,
the monthly grid rounds it. This is the only sanctioned way arrival timing
varies per market now — do not reintroduce hardcoded per-market offsets in views.

### Campaigns are a property of the cutoff, not the region

`CAMPAIGNS` in `model.js` maps cutoff months to a campaign window. A region can
feed the tail of one campaign and the body of the next — Huila Sur does exactly
this, with a Sep cutoff in one window and Oct–Ene in the other. Never add a
`campaign` field to a region; use `primaryCampaign(schedule)` for grouping and
colour only.

**Open question for Elias:** confirm which window is called "Campaña 1". The
code currently uses Campaña 1 = Oct/Nov/Dic/Ene cutoffs (main crop), Campaña 2 =
Jun/Jul/Ago/Sep (mitaca). The original prototype's footer said this; its data
array said the opposite. If the intended meaning is reversed, swap
`cutoffMonths` in `CAMPAIGNS` — nothing else needs to change.

**Second open question:** `NO_ARRIVAL_MONTHS` (Abr–Jul) is defined on the
standard Colombia lane. With `arrivalDelay: 1`, MENA and AU shift one month
later, so they gain an **Abr** arrival and lose the **Ago** one. That falls out
of the model rather than being chosen — confirm it matches reality, or make
`NO_ARRIVAL_MONTHS` per-market.

---

## Where containers are entered

Allocation is **origin-driven and warehouse-aware**. In **Editar regiones** you
pick a region, add the warehouses it ships to, and enter containers per warehouse
per month (the **salida**). Each region+warehouse carries a **goal in kg**
(`KG_PER_CONTAINER = 17500` in `model.js` converts containers ⇄ kg).

Everything else is **derived** from those shipments:

- **Llegada** (arrival) = salida month + `round(warehouse.lead)` — visible right
  under the salida row.
- **Destino / market view** is read-only: it aggregates every region's shipments
  to that market's warehouses into arrivals, shown against the market target.
  There is no manual "Corte" capture anymore.
- **Consolidado** shows salidas by region and llegadas by market — both from the
  same shipment data — plus allocated-vs-target. (No more supply/demand delta:
  there is a single source now.)

Persisted per region as scope `shipment`, one row each:
`{ goals: { whName: kg }, ship: { whName: { monthIdx: containers } } }`.

Shipments are **independent of the cosecha calendar**. The derived cutoff months
are shown as reference markers only; the **Cosechas** Gantt is informational.

### Goals (Metas tab)

Goals are kg targets, edited in the **Metas** tab, not inline with shipments.
Two macro categories per region: **Community** and **MIRC**. MIRC additionally
rolls up to a **country-level target** (`region.country`; today Colombia and
Rwanda); Community is demand-driven and has no country target. Persisted as a
single row, scope `goals`, slug `plan`:
`{ regions: { slug: { community, mirc } }, countriesMIRC: { country: kg } }`.
Salidas are not yet split by category, so progress shows total salidas (kg) vs a
region's total goal, and the country card compares planned MIRC (sum of region
MIRC goals) against the country target.

---

## Architecture

```
src/
  model.js           offsets, derivation, reconciliation — the core
  store.js           Supabase persistence + localStorage fallback + CSV
  data/
    regions.js       harvest declarations + country (for the MIRC goal rollup)
    markets.js       targets and transit delays
    warehouses.js    destination warehouses + lead times (seed defaults)
    products.js      catalogue keyed by cutoff month
  views/
    consolidado.js   supply vs demand reconciliation
    metas.js         kg goals by category + country MIRC target ("Metas" tab)
    cosechas.js      read-only overview of every origin at once ("Cosechas" tab)
    regionesEditor.js  region picker + editable grid ("Editar regiones" tab)
    region.js        per-origin grid (used by regionesEditor)
    market.js        per-market gantt + warehouse panel
    bodegas.js       edit warehouses + lead times per destination ("Bodegas" tab)
    products.js      releases per cutoff
  main.js            router, tabs, state
  forest-design-system.css  Forest Design System v1.0 (shell, tokens)
  styles.css         planning calendar + cards on the Forest light theme
supabase/schema.sql  table, audit trigger, realtime, RLS
```

The origin side is split across two tabs: **Cosechas** (`cosechas.js`) is a
read-only master calendar of all regions; **Editar regiones**
(`regionesEditor.js`) is where despacho is captured, one region at a time via a
picker. The selected origin lives in `state.editRegion`.

State lives in `main.js` and flows down. Views are pure render functions that
take data and callbacks — they never import the store or mutate state directly.
Keep it that way.

## Persistence

One row per `(year, scope, slug)` with a JSONB month map. The whole plan loads
in one query; each edit is one debounced upsert. **Do not** go back to a
key-per-cell scheme — the original prototype did 132 sequential reads on load
and silently rendered zeros over real data when they failed.

Without Supabase env vars the app runs on localStorage, so `npm run dev` works
with no backend.

## Conventions

- **Spanish UI, English code and comments.** Matches every other Forest repo.
- **Forest Design System v1.0.** The app shell (navy sidebar + slim topbar +
  cream content), typography (Archivo / Montserrat / DM Mono), tokens, and
  components come from `src/forest-design-system.css` — the same portable sheet
  used across Forest apps. `src/styles.css` only holds the planning calendar and
  its cards, layered on top. Reference copy of the system and its live demo live
  in `docs/`. Follow the brand's non-negotiables: no emojis (use Lucide icons),
  no gradients, display text uppercase + wide-tracked, numbers monospace, and
  the **closed palette** (yellow / blue / navy / ink / paper).
- **Campaign colour = closed palette.** The team's mental map survives, remapped
  to the brand: Campaña 1 (main crop) = brand yellow, Campaña 2 (mitaca) = brand
  blue. Region tints are light shades of the same palette; region identity is
  carried by the row label, colour is a secondary cue. Colours live only in
  `model.js` (`CAMPAIGNS`) and `data/regions.js`.
- Vanilla JS + Vite. No framework — deliberate, matches the CTRM and quote
  systems.
- Keyboard focus visible, reduced motion respected, works down to mobile.

## Deploy

Netlify, same as `forest-coffee-ctrm` and `forest-contract-bot`. Set
`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the Netlify env. RLS is
currently open — tighten before the link goes past the internal team.

---

## Backlog

1. **Lock the campaign naming** with Elias, then delete the note above.
2. **Scenario layer** — base / alto / bajo, switchable, so the plan can be
   stress-tested instead of overwritten.
3. **Per-product allocation** inside a cutoff, not just container totals.
4. **Client commitments** — tie market containers to actual HubSpot deals so
   the plan reflects contracted vs. speculative volume.
5. **Presentation mode** — full-screen consolidated view for the planning
   meeting, no inputs.
6. **Price and margin layer** — containers × differential, to see cash timing
   alongside volume. This is where the tool stops being a calendar and starts
   informing the hedge.
7. Rwanda currently assumes a single cutoff; confirm whether 2027 splits into
   two.
