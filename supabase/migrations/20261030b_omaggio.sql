-- "Grazie di essere tornato" (PROPOSTE.md 12, decisione di Lorenzo del 29/10): il titolare di un
-- locale verificato offre un piccolo omaggio (testo breve, niente denaro) a chi torna per la 2ª o 3ª volta.
-- Si scrive solo dal server (chiave di servizio), dopo i controlli in /api/ristoratore/serate e /api/omaggio.
alter table public.places add column if not exists omaggio_testo text check (char_length(omaggio_testo) between 2 and 40);
alter table public.places add column if not exists omaggio_soglia smallint check (omaggio_soglia in (2, 3));

-- Un omaggio per persona per locale ogni 30 giorni (antiabuso): una riga per ogni volta che lo mostra al tavolo.
create table if not exists public.omaggi_usati (
  user_id uuid not null references auth.users (id) on delete cascade,
  place_id uuid not null references public.places (id) on delete cascade,
  giorno date not null,
  created_at timestamptz not null default now(),
  primary key (user_id, place_id, giorno)
);
create index if not exists omaggi_usati_place_giorno on public.omaggi_usati (place_id, giorno);
alter table public.omaggi_usati enable row level security;
drop policy if exists "omaggi_usati: leggo i miei" on public.omaggi_usati;
create policy "omaggi_usati: leggo i miei" on public.omaggi_usati for select using (auth.uid() = user_id);
