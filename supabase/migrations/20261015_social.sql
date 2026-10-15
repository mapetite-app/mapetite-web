-- Migration: social (piano 5.1–5.4) — profilo pubblico, seguire, feed degli amici.
-- DA APPLICARE A MANO (Lorenzo). Finché non è applicata l'app funziona uguale: le pagine
-- /u/<nome>, /amici e il riquadro "amici" nel locale mostrano lo stato "in arrivo".
-- Idempotente: sicura da ri-eseguire. Nessun dato esistente viene cancellato o riscritto.
--
-- Privacy (VISIONE.md: fiducia prima di tutto):
--   - il profilo pubblico è SPENTO per tutti (is_public default false): lo accende solo l'utente;
--   - chi non è pubblico non compare da nessuna parte (né ricerca, né feed, né conteggi);
--   - la NOTA PRIVATA dei salvati non è mai leggibile da altri. Per questo la lettura pubblica
--     NON passa da una policy su saved_places (la RLS filtra righe, non colonne: una policy
--     "pubblico se is_public" renderebbe leggibile anche la colonna note via API), ma da una
--     vista con le sole colonne pubbliche (salvati_pubblici). Lo stesso per profiles: i gusti
--     dichiarati (cucine, occasioni, budget) restano privati; si legge la vista profili_pubblici.
--   - l'opinione "Non fa per me" non si mostra agli altri (è un appunto personale).
--   - le viste sono in sola lettura per anon/authenticated (grant select e basta) e unite con
--     una join, quindi non aggiornabili: non si scrive mai attraverso di esse.

-- ── 1. Profilo pubblico ───────────────────────────────────────────────────────
alter table public.profiles add column if not exists handle       text;
alter table public.profiles add column if not exists display_name text;
alter table public.profiles add column if not exists bio          text;
alter table public.profiles add column if not exists city         text;
alter table public.profiles add column if not exists is_public    boolean not null default false;

do $$
begin
  -- handle: minuscolo, 3–20 caratteri tra lettere, numeri, "." e "_" (es. giulia.rm)
  if not exists (select 1 from pg_constraint where conname = 'profiles_handle_format') then
    alter table public.profiles
      add constraint profiles_handle_format check (handle is null or handle ~ '^[a-z0-9._]{3,20}$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_display_name_len') then
    alter table public.profiles
      add constraint profiles_display_name_len check (display_name is null or char_length(display_name) <= 40);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_bio_len') then
    alter table public.profiles
      add constraint profiles_bio_len check (bio is null or char_length(bio) <= 160);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_city_len') then
    alter table public.profiles
      add constraint profiles_city_len check (city is null or char_length(city) <= 40);
  end if;
end $$;

create unique index if not exists profiles_handle_key on public.profiles (handle) where handle is not null;

-- ── 2. Seguire ────────────────────────────────────────────────────────────────
create table if not exists public.follows (
  follower_id uuid not null references auth.users (id) on delete cascade,
  followed_id uuid not null references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (follower_id, followed_id),
  constraint follows_not_self check (follower_id <> followed_id)
);

create index if not exists follows_followed_idx on public.follows (followed_id);

alter table public.follows enable row level security;

do $$
begin
  -- Ognuno vede i follow che lo riguardano (chi segue lui, chi segue lui stesso).
  -- I numeri dei profili pubblici arrivano dalla vista profili_pubblici.
  if not exists (select 1 from pg_policies where tablename = 'follows' and policyname = 'follows_select_own') then
    create policy follows_select_own
      on public.follows
      for select
      to authenticated
      using (auth.uid() = follower_id or auth.uid() = followed_id);
  end if;
  -- Si segue solo a proprio nome e solo un profilo pubblico.
  if not exists (select 1 from pg_policies where tablename = 'follows' and policyname = 'follows_insert_own') then
    create policy follows_insert_own
      on public.follows
      for insert
      to authenticated
      with check (
        auth.uid() = follower_id
        and exists (select 1 from public.profiles p where p.id = followed_id and p.is_public)
      );
  end if;
  -- Smettere di seguire: solo i propri follow.
  if not exists (select 1 from pg_policies where tablename = 'follows' and policyname = 'follows_delete_own') then
    create policy follows_delete_own
      on public.follows
      for delete
      to authenticated
      using (auth.uid() = follower_id);
  end if;
end $$;

-- ── 3. Viste pubbliche (sola lettura, solo colonne non private) ──────────────
-- Girano con i permessi del proprietario (come una funzione security definer) e filtrano
-- da sole is_public = true: è questo il "lettura pubblica solo se il proprietario è pubblico".

create or replace view public.profili_pubblici as
select
  p.id,
  p.handle,
  p.display_name,
  p.bio,
  p.city,
  p.created_at,
  (select count(*) from public.saved_places s where s.user_id = p.id and 'Già visitato' = any (s.tags))::int as visitati,
  -- da provare = salvato e non ancora visitato (come le liste della pagina /u/<handle>)
  (select count(*) from public.saved_places s where s.user_id = p.id and not ('Già visitato' = any (coalesce(s.tags, '{}'))))::int as da_provare,
  (select count(*) from public.follows f join public.profiles q on q.id = f.follower_id and q.is_public
     where f.followed_id = p.id)::int as seguaci,
  (select count(*) from public.follows f join public.profiles q on q.id = f.followed_id and q.is_public
     where f.follower_id = p.id)::int as seguiti
from public.profiles p
where p.is_public and p.handle is not null;

create or replace view public.salvati_pubblici as
select
  s.user_id,
  p.handle,
  p.display_name,
  s.place_id,
  array_remove(coalesce(s.tags, '{}'), 'Non fa per me') as tags,  -- MAI la nota: colonna esclusa
  s.created_at,
  pl.name,
  pl.category,
  pl.address,
  pl.lat,
  pl.lng,
  pl.google_place_id
from public.saved_places s
join public.profiles p on p.id = s.user_id and p.is_public and p.handle is not null
join public.places pl on pl.id = s.place_id;

revoke all on public.profili_pubblici from anon, authenticated;
revoke all on public.salvati_pubblici from anon, authenticated;
grant select on public.profili_pubblici to anon, authenticated;
grant select on public.salvati_pubblici to anon, authenticated;
