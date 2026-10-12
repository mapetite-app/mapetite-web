-- Migration: events (segnali di comportamento) — DA APPROVARE da Lorenzo prima di applicarla.
-- Finché non è applicata, l'app funziona uguale: /api/events e la ricerca ignorano l'errore
-- "tabella mancante" (nessun messaggio all'utente).
--
-- Perché (VISIONE.md): il motore di raccomandazione si basa sui comportamenti (salvataggi,
-- filtri, visite), non sui voti espliciti; e i dati per i ristoratori ("cosa cerca la gente
-- nella tua zona") vanno progettati da subito.
--
-- Privacy:
--   - niente testo libero personale: per le ricerche si salva cosa ha capito l'AI
--     (tipo, requisiti, zona), non la frase scritta;
--   - posizione arrotondata a ~1 km (2 decimali);
--   - si scrive SOLO dal server (service role): nessuna policy di lettura/scrittura per gli utenti;
--   - cancellando l'account si cancellano anche i suoi eventi (on delete cascade);
--   - visitatori non registrati: anon_id casuale salvato nel telefono, nessun dato personale.

create table if not exists public.events (
  id               bigint generated always as identity primary key,
  created_at       timestamptz not null default now(),
  user_id          uuid references auth.users (id) on delete cascade,
  anon_id          text check (anon_id is null or char_length(anon_id) <= 40),
  type             text not null check (type in (
                     'ricerca',        -- ricerca AI o con i filtri (dal server)
                     'apri_scheda',    -- apertura della scheda di un locale
                     'salva',          -- locale salvato
                     'rimuovi',        -- locale tolto dai salvati
                     'ci_sono_stato',  -- stato "Ci sono stato"
                     'voglio_andarci', -- stato "Voglio andarci"
                     'percorso',       -- tocco su Percorso/Indicazioni
                     'chiama',         -- tocco su Chiama
                     'sito',           -- tocco su Sito
                     'condividi'       -- condivisione di un locale o di una ricerca
                   )),
  place_id         uuid references public.places (id) on delete set null,  -- UUID Supabase, se il locale è già in places
  google_place_id  text,                                                    -- Place ID Google (risultati non ancora salvati)
  lat              numeric(5, 2),
  lng              numeric(5, 2),
  props            jsonb not null default '{}'::jsonb   -- es. {"tipo":"bar","requisiti":["rooftop"],"zona":"Trastevere","risultati":12}
);

create index if not exists events_user_created_idx on public.events (user_id, created_at desc);
create index if not exists events_type_created_idx on public.events (type, created_at desc);
create index if not exists events_place_idx on public.events (place_id) where place_id is not null;
create index if not exists events_google_place_idx on public.events (google_place_id) where google_place_id is not null;

-- RLS attiva e nessuna policy: gli utenti (anon/authenticated) non leggono né scrivono.
-- Scrive solo il server con la chiave di servizio (che ignora la RLS).
alter table public.events enable row level security;
