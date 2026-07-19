-- Migration: enrichment table (layer multi-fonte per il comparatore)
-- Applicata su Supabase il Day 21 Sprint 3 via SQL Editor.
-- Versionata in locale per avere git come fonte di verità sullo schema.
-- Idempotente: sicura da ri-eseguire.
--
-- Una riga per (locale + fonte). place_id = Google Places id (text),
-- coerente con place_synthesis. NESSUNA FK: il legame al mondo Google
-- è il Place ID, come nel resto del progetto.
-- Fonti automatiche (google, tripadvisor, youtube) + editoriali (michelin,
-- gambero_rosso, ...) inserite manualmente sui locali di punta.

create table if not exists public.enrichment (
  id           uuid primary key default gen_random_uuid(),
  place_id     text not null,
  source       text not null,
  source_kind  text not null default 'editorial',

  rating_value text,
  rating_scale text,
  ranking      text,
  comment      text,
  source_url   text,

  metadata     jsonb not null default '{}'::jsonb,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  unique (place_id, source)
);

create index if not exists idx_enrichment_place_id on public.enrichment (place_id);
create index if not exists idx_enrichment_source on public.enrichment (source);

alter table public.enrichment enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'enrichment' and policyname = 'enrichment_read_all') then
    create policy enrichment_read_all
      on public.enrichment
      for select
      using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'enrichment' and policyname = 'enrichment_write_service') then
    create policy enrichment_write_service
      on public.enrichment
      for all
      to service_role
      using (true)
      with check (true);
  end if;
end $$;
