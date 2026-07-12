-- Cache delle sintesi editoriali generate da Haiku sul ramo world.
-- place_id = Google Places id (stringa, non l'UUID interno di `places`).
-- matchReason NON è persistito qui: dipende dalla query e va rigenerato ogni volta.
create table if not exists public.place_synthesis (
  place_id     text primary key,
  synthesis    text not null,
  tags         text[] not null default '{}',
  verdict      text not null,
  generated_at timestamptz not null default now()
);

-- Solo il server (service role) scrive; lettura pubblica.
alter table public.place_synthesis enable row level security;

create policy "place_synthesis_read_all"
  on public.place_synthesis
  for select
  using (true);

create policy "place_synthesis_write_service"
  on public.place_synthesis
  for all
  to service_role
  using (true)
  with check (true);
