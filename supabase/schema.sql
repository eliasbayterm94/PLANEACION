-- Forest Coffee — plan 2027
-- One row per (year, scope, slug). The month map is JSONB, so the whole plan
-- loads in a single query and each edit is a single upsert.

create table if not exists plan_allocations (
  year        int         not null,
  scope       text        not null check (scope in ('region', 'market')),
  slug        text        not null,
  months      jsonb       not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  updated_by  text,
  primary key (year, scope, slug)
);

comment on column plan_allocations.months is
  'Month index (0=Ene) -> container count. Origin rows are keyed by shipping month, destination rows by cutoff month.';

-- Change log, so a planning session is auditable after the fact.
create table if not exists plan_changes (
  id          bigserial primary key,
  year        int         not null,
  scope       text        not null,
  slug        text        not null,
  months      jsonb       not null,
  changed_by  text,
  changed_at  timestamptz not null default now()
);

create or replace function log_plan_change() returns trigger as $$
begin
  insert into plan_changes (year, scope, slug, months, changed_by)
  values (new.year, new.scope, new.slug, new.months, new.updated_by);
  return new;
end;
$$ language plpgsql;

drop trigger if exists plan_allocations_audit on plan_allocations;
create trigger plan_allocations_audit
  after insert or update on plan_allocations
  for each row execute function log_plan_change();

-- Realtime, so the team sees each other's edits live during a session.
alter publication supabase_realtime add table plan_allocations;

-- ---------------------------------------------------------------------------
-- Row level security
--
-- The policies below are OPEN — anyone with the anon key can read and write.
-- That is fine for an internal link behind Netlify password protection, but
-- tighten to authenticated-only before this goes anywhere wider.
-- ---------------------------------------------------------------------------
alter table plan_allocations enable row level security;
alter table plan_changes enable row level security;

create policy "plan read" on plan_allocations for select using (true);
create policy "plan write" on plan_allocations for all using (true) with check (true);
create policy "changes read" on plan_changes for select using (true);
