-- Migration: avvisi push gratuiti (PROPOSTE.md, proposta 6, decisa da Lorenzo il 29/10/2026).
-- Un'iscrizione per telefono/browser: endpoint del servizio push e le due chiavi per cifrare il
-- messaggio. Nessun contenuto degli avvisi qui. Si cancella da sola con l'account (on delete cascade).
-- La scrive e la toglie il telefono sulla propria riga (RLS); l'invio la legge con la chiave di servizio.
-- Idempotente, nessun dato toccato.
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions(user_id);
alter table public.push_subscriptions enable row level security;
drop policy if exists "push: le mie iscrizioni" on public.push_subscriptions;
create policy "push: le mie iscrizioni" on public.push_subscriptions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
