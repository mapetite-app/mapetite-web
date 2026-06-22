-- Migration: profiles table (cold-start onboarding data)
-- Applicata su Supabase il Day 1 Sprint 2 via SQL Editor.
-- Versionata in locale per avere git come fonte di verità sullo schema.
-- Idempotente: sicura da ri-eseguire.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  cuisines text[] default '{}',
  occasions text[] default '{}',
  atmospheres text[] default '{}',
  price_range text,
  onboarding_completed boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;

-- RLS: ogni utente vede e modifica solo il proprio profilo
do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'profiles' and policyname = 'profiles_select_own') then
    create policy profiles_select_own on public.profiles
      for select using (auth.uid() = id);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'profiles' and policyname = 'profiles_update_own') then
    create policy profiles_update_own on public.profiles
      for update using (auth.uid() = id);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'profiles' and policyname = 'profiles_insert_own') then
    create policy profiles_insert_own on public.profiles
      for insert with check (auth.uid() = id);
  end if;
end $$;

-- Trigger: crea automaticamente una riga profiles al signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
