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

Allocation lives in the **Programación de salidas** cockpit. Salidas are keyed by
**producing country → warehouse → month** (containers). The country is a tab
(Colombia / Rwanda); the cockpit is organised by **market → warehouse**. The
warehouse (not the producing region) is the salida's key — origin granularity
stops at the country. `KG_PER_CONTAINER = 17500` converts containers ⇄ kg.

Everything else is **derived** from those shipments:

- **Llegada** (arrival) = salida month + `round(warehouse.lead)` — shown under
  each warehouse's salida row (combined across countries).
- **Capacidad export.** row = `exportCapacity(schedules, country)`: how many of
  that country's origins have a despacho each month. Low/zero months are the
  **valle** (harvest bottleneck) — a soft signal, not a block.
- **Destino / market view** and **Consolidado** aggregate shipments (read-only);
  Consolidado shows salidas by country and llegadas by market vs target.
- **Metas** shows salidas (by country) / llegadas (by market) as context.

Persisted per country as scope `shipment`, one row each:
`{ ship: { whName: { monthIdx: containers } } }`. The month header carries the
campaign band (`campaignOfMonth`); shipments are otherwise **independent of the
cosecha calendar** — the **Cosechas** Gantt is purely informational.

### Goals (Metas tab)

Goals are kg targets, edited in the **Metas** tab, on **two different axes**:

- **By sales region (market)** — Community + MIRC kg per market. "Región" here
  means the *sales* region, not the producing region. Most markets take one
  market-level goal; a market flagged `goalsByWarehouse` in `markets.js` (Europa)
  is entered **per warehouse** instead (Rotterdam, UK).
- **MIRC by producing country** — a country-level MIRC target (`region.country`;
  today Colombia and Rwanda). Community has no country target (demand-driven).

- **Company-level general goal** — a total kg per category (`company: {community,
  mirc}`), shown at the top of Metas with reconciliation chips comparing it to the
  sum of market goals (demand) and, for MIRC, the country targets (supply).

Persisted as a single row, scope `goals`, slug `plan`:
`{ company: { community, mirc }, markets: { slug: { community, mirc } }, warehouses: { whName: { community, mirc } }, countriesMIRC: { country: kg } }`.
Salidas are not yet split by category, so the market card shows llegadas (kg) as
context and the country card shows salidas (kg) from its producing regions.

### Catalogue management (Gestionar productos modal)

The product catalogue is **editable** in the **Gestionar productos** modal
(`catalogModal.js`, opened from the Campaña tabs), persisted as one row, scope
`catalog`, slug `plan`: `{ categories: [{key,name,macro}], cortes: {1:[months],
2:[months]}, pools: [{id,name,campaign,meta}], products: [{id, name, category,
pool, startCorte}] }`. Seeds in `data/catalog.js` — the authoritative 2027
release list (products, categories, cortes, and the two Innovation pools) hard-
coded there; `emptyCatalog()` is the single source, and the **Cargar catálogo
base** button in the Productos tab (`resetCatalogToSeed`) replaces the whole
catalogue with it (needed because the persisted `catalog` row otherwise wins over
the seed). A product has **one** category and optionally **one pool**; the
modal supports **bulk** assignment of both (check several products, pick a
category or pool, apply). `normalizeCatalog` migrates legacy shapes on load.

- **Pools:** a pool groups products sold together against **one combined kg
  meta**, per campaign ("simple" mode — per-product capacity/allocation is
  unchanged; the pool is an independent lens). The Campaña tabs show a **Pools**
  summary (Σ member capacity vs pool meta, fill) and a pool tag per product.

- **Categorías:** Community + MIRC subcategories (Microlot, Innovation, Reserve,
  Competition), each with a macro; editable.
- **Cortes por campaña:** the cutoff months per campaign. On load and on edit,
  `setCampaignCortes(catalog.cortes)` in `model.js` overrides `CAMPAIGNS[n].cutoffMonths`
  at runtime, so `campaignOfMonth` / bands / grouping across the app reflect the
  edit — CAMPAIGNS stays the single source everything reads.
- **Productos:** each product has one **category** and a **startCorte** (the
  cutoff it is produced from; its campaign + colour derive from that month).
  Select several products (checkboxes) to apply a category in **bulk**.

### Product allocation (Campaña tabs)

The **Campaña 1 / 2** tabs (`products.js`) carry the commitment plan, **capacity
driven**. Per product you set a **Capacidad** (kg); `allocateProduct` in
`model.js` fair-shares it across sales regions weighted by each market's **total
meta**, then splits each region's total into **Comprometido** (a global % default
70) + **Libre**. Overrides lock a region's kg and the remaining capacity
redistributes over the non-locked markets by meta share; leftover shows as *Sin
asignar*. The top shows **fill rate** (Σ capacidad vs Σ meta) and a per-market
rollup (Comprometido / Libre vs meta). Persisted as one row, scope `alloc`, slug
`plan`: `{ pctComprometido, products: { [productKey]: { cap, pct, ov: { market: kg } } } }`
where `productKey = ${cutoffMonth}::${name}` and per-product `pct` (null = use
global) / `ov` are optional. Actual secured sales are **not** tracked yet —
Libre is the plan buffer; wiring real deals (HubSpot, backlog 4) is the next step.

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
    products.js      legacy raw release list (no longer imported; catalog.js is authoritative)
    catalog.js       editable catalogue seeds: categories, cortes, products
  views/
    consolidado.js   flow + salidas by country + llegadas by market
    programacion.js  salidas cockpit: country tab, market→warehouse, valle/meta
    metas.js         kg goals by category + country MIRC target ("Metas" tab)
    cosechas.js      read-only Gantt of every origin at once ("Cosechas" tab)
    market.js        per-market arrivals (derived, read-only)
    bodegas.js       edit warehouses + lead times per destination ("Bodegas" tab)
    products.js      catalogue-driven capacity allocation (Campaña tabs)
    catalogModal.js  "Gestionar productos": categories, cortes, products
  main.js            router, tabs, state
  forest-design-system.css  Forest Design System v1.0 (shell, tokens)
  styles.css         planning calendar + cards on the Forest light theme
supabase/schema.sql  table, audit trigger, realtime, RLS
```

**Cosechas** (`cosechas.js`) is a read-only master Gantt of all regions.
Salidas are captured in **Programación de salidas** (`programacion.js`); the
selected producing country lives in `state.planCountry`.

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
