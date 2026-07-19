-- Migration: profiles (preferenze dichiarate dall'utente)
-- Tabella PREESISTENTE: questa migration la porta sotto git come fonte di verità.
-- Nomi di policy ALLINEATI al DB reale (verificati a schermo), inclusi quelli con
-- spazi e maiuscole, così su questo DB ogni statement è un NO-OP idempotente.
--   cuisines/occasions/atmospheres = vocabolari chiusi in src/lib/preferences.ts
--   price_range = "€".."€€€€"
--
-- NOTA: "create table if not exists" è un no-op sulla tabella già esistente;
-- serve a riprodurre lo schema in ambienti nuovi e a documentare la verità in git.

create table if not exists public.profiles (
  id                   uuid primary key references auth.users (id),
  cuisines             text[] not null default '{}',
  occasions            text[] not null default '{}',
  atmospheres          text[] not null default '{}',
  price_range          text,
  onboarding_completed boolean not null default false,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

alter table public.profiles enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'profiles' and policyname = 'Users can view own profile') then
    create policy "Users can view own profile"
      on public.profiles
      for select
      to public
      using (auth.uid() = id);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'profiles' and policyname = 'Users can update own profile') then
    create policy "Users can update own profile"
      on public.profiles
      for update
      to public
      using (auth.uid() = id)
      with check (auth.uid() = id);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'profiles' and policyname = 'profiles_insert_own') then
    create policy profiles_insert_own
      on public.profiles
      for insert
      to public
      with check (auth.uid() = id);
  end if;
end $$;
