-- Migration: "Avvisami quando c'è posto" su un salvato (PROPOSTE.md 72), 21/11/2026.
-- Una riga per persona e locale: chi vuole l'avviso quando il titolare di un locale VERIFICATO dice che ha posto.
-- Solo UUID (persona e locale) e due date: nessun contenuto Google. Si cancella con l'account o con il locale.
-- La scrive e la toglie la persona sulla propria riga (RLS); l'invio la legge con la chiave di servizio.
-- avvisato_at: ultimo avviso mandato, per non mandarne più di uno ogni 6 giorni per lo stesso locale.
-- Idempotente, nessun dato toccato.
create table if not exists public.avvisi_posto (
  user_id uuid not null references auth.users(id) on delete cascade,
  place_id uuid not null references public.places(id) on delete cascade,
  created_at timestamptz not null default now(),
  avvisato_at timestamptz,
  primary key (user_id, place_id)
);
create index if not exists avvisi_posto_place_idx on public.avvisi_posto(place_id);
alter table public.avvisi_posto enable row level security;
drop policy if exists "avvisi_posto: i miei" on public.avvisi_posto;
create policy "avvisi_posto: i miei" on public.avvisi_posto
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- Il telefono non scrive avvisato_at (lo fa solo il server): solo insert e delete, niente update.
revoke update on public.avvisi_posto from anon, authenticated;
revoke all on public.avvisi_posto from anon;
