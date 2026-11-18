-- Proposta 54 "Qualcosa non va?" (19/11/2026): i tester del gruppo chiuso segnalano un difetto dal Profilo.
-- Si salvano il testo, la pagina (solo il percorso, senza query string), il browser (troncato) e la
-- larghezza dello schermo. Niente screenshot. Gli utenti possono solo scrivere le proprie righe:
-- nessuna policy di lettura, le legge solo il server con la chiave di servizio (/admin/numeri).
-- Il limite di 10 al giorno per persona lo applica la route /api/segnalazioni.
create table if not exists public.segnalazioni (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  testo text not null check (char_length(testo) between 5 and 1000),
  pagina text check (char_length(pagina) <= 200),
  user_agent text check (char_length(user_agent) <= 200),
  larghezza int,
  created_at timestamptz not null default now()
);

create index if not exists segnalazioni_user_created_idx on public.segnalazioni (user_id, created_at desc);
create index if not exists segnalazioni_created_idx on public.segnalazioni (created_at desc);

alter table public.segnalazioni enable row level security;

drop policy if exists segnalazioni_insert_own on public.segnalazioni;
create policy segnalazioni_insert_own on public.segnalazioni
  for insert to authenticated
  with check (auth.uid() = user_id);
