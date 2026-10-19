-- Migration: "Buoni pasto: qui li accettano?" (docs/autonomia/PROPOSTE.md, 19/10/2026, proposta 2).
-- Chi c'è stato lo dice nel "Com'è andata?" (sì/no, nessun testo libero). La scheda del locale mostra
-- una riga solo quando almeno 2 persone concordano: mai da una sola risposta, mai inventata.
-- Solo aggiunte (tabella e funzione nuove), nessun dato esistente toccato. Idempotente.
create table if not exists public.buoni_pasto (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  place_id   uuid not null references public.places (id) on delete cascade,
  accetta    boolean not null,
  created_at timestamptz not null default now(),
  primary key (user_id, place_id)
);
create index if not exists buoni_pasto_place_idx on public.buoni_pasto (place_id);

alter table public.buoni_pasto enable row level security;
-- Ognuno vede e cambia solo le proprie risposte; gli altri vedono solo i conteggi (funzione sotto).
drop policy if exists buoni_pasto_select_own on public.buoni_pasto;
create policy buoni_pasto_select_own on public.buoni_pasto for select using (auth.uid() = user_id);
drop policy if exists buoni_pasto_insert_own on public.buoni_pasto;
create policy buoni_pasto_insert_own on public.buoni_pasto for insert with check (auth.uid() = user_id);
drop policy if exists buoni_pasto_update_own on public.buoni_pasto;
create policy buoni_pasto_update_own on public.buoni_pasto for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists buoni_pasto_delete_own on public.buoni_pasto;
create policy buoni_pasto_delete_own on public.buoni_pasto for delete using (auth.uid() = user_id);

-- Conteggi anonimi per la scheda (UUID del locale o Place ID Google): nessun dato personale esce.
create or replace function public.buoni_pasto_conteggio(p_place text)
returns table (si integer, no integer)
language sql
stable
security definer
set search_path = public
as $$
  select
    count(*) filter (where b.accetta)::integer as si,
    count(*) filter (where not b.accetta)::integer as no
  from public.buoni_pasto b
  join public.places p on p.id = b.place_id
  where p.id::text = p_place or p.google_place_id = p_place;
$$;
revoke all on function public.buoni_pasto_conteggio(text) from public;
grant execute on function public.buoni_pasto_conteggio(text) to anon, authenticated;
