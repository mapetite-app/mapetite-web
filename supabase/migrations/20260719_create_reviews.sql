-- Migration: reviews (recensioni Mapetite dell'utente — stelle + commento)
-- Tabella PREESISTENTE: questa migration la porta sotto git come fonte di verità.
-- Nomi di vincoli e policy ALLINEATI al DB reale (verificati a schermo), così su
-- questo DB ogni statement è un NO-OP idempotente e non introduce drift.
--   place_id = UUID INTERNO di public.places (NON il Google Place ID: diverso
--   da enrichment/place_synthesis, che usano il Place ID text).
--   rating = 1..5 stelle. unique(user_id, place_id): una recensione per locale.
--
-- NOTA: "create table if not exists" è un no-op sulla tabella già esistente; i
-- nomi espliciti servono a riprodurre lo schema reale in ambienti nuovi e a
-- documentare la verità in git.

create table if not exists public.reviews (
  id         uuid not null default gen_random_uuid(),
  place_id   uuid not null,
  user_id    uuid not null,
  rating     int not null,
  comment    text,
  created_at timestamptz not null default now(),

  constraint reviews_pkey primary key (id),
  constraint reviews_place_id_fkey foreign key (place_id) references public.places (id) on delete cascade,
  constraint reviews_user_id_fkey foreign key (user_id) references auth.users (id) on delete cascade,
  constraint reviews_rating_check check (rating between 1 and 5),
  constraint reviews_user_id_place_id_key unique (user_id, place_id)
);

alter table public.reviews enable row level security;

do $$
begin
  -- Lettura pubblica (scheda locale): anon + authenticated.
  if not exists (select 1 from pg_policies where tablename = 'reviews' and policyname = 'reviews_select_public') then
    create policy reviews_select_public
      on public.reviews
      for select
      to anon, authenticated
      using (true);
  end if;
  -- Scrittura solo sulla propria recensione, per comando.
  if not exists (select 1 from pg_policies where tablename = 'reviews' and policyname = 'reviews_insert_own') then
    create policy reviews_insert_own
      on public.reviews
      for insert
      to authenticated
      with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'reviews' and policyname = 'reviews_update_own') then
    create policy reviews_update_own
      on public.reviews
      for update
      to authenticated
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'reviews' and policyname = 'reviews_delete_own') then
    create policy reviews_delete_own
      on public.reviews
      for delete
      to authenticated
      using (auth.uid() = user_id);
  end if;
end $$;
