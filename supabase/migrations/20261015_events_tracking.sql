-- Migration: tracciamento dell'uso (PIANO-25-OTTOBRE.md, sezione 7) — da applicare dopo 20261012_create_events.sql.
-- Finché non è applicata, l'app funziona uguale: i nuovi tipi vengono rifiutati dal vincolo e
-- src/lib/events.ts ignora l'errore in silenzio (un solo avviso nei log); senza la colonna
-- session_id la scrittura riprova senza.
--
-- Perché: capire se i tester usano Mapetite (tornano? cosa usano? dove si bloccano?) prima
-- del pitch. Pannello in /admin/numeri, visibile solo a Lorenzo.
--
-- Privacy (stesse regole di events): niente testo libero personale.
--   - sessione_inizio: solo giorni dall'ultima visita e se l'app è installata;
--   - pagina: nome della pagina (mappa, salvati, profilo…), mai l'indirizzo con la ricerca;
--   - funzione: nome della funzione toccata (filtri, import_link, sorprendimi…);
--   - errore: messaggio tecnico dell'errore (max 200 caratteri) e nome della pagina;
--   - utile: 👍/👎 sui risultati, senza la frase cercata.

-- 1. Nuovi tipi (nessuno tolto). Il vincolo creato inline si chiama events_type_check.
alter table public.events drop constraint if exists events_type_check;
alter table public.events add constraint events_type_check check (type in (
  'ricerca', 'apri_scheda', 'salva', 'rimuovi', 'ci_sono_stato', 'voglio_andarci',
  'percorso', 'chiama', 'sito', 'condividi',
  'sessione_inizio',  -- apertura dell'app (nuova sessione dopo 30 minuti di pausa)
  'pagina',           -- vista di una pagina
  'funzione',         -- uso di una funzione (props.nome)
  'errore',           -- errore JavaScript sul telefono
  'utile'             -- "Ti è stato utile?" 👍/👎
));

-- 2. Sessione: id casuale generato dal telefono, si rinnova dopo 30 minuti senza attività.
--    Serve per durata delle sessioni e imbuti dentro la stessa visita.
alter table public.events add column if not exists session_id text
  check (session_id is null or char_length(session_id) <= 40);

-- 3. Indici per il pannello (letture per periodo, per sessione, per visitatore anonimo).
create index if not exists events_created_idx on public.events (created_at desc);
create index if not exists events_session_idx on public.events (session_id, created_at) where session_id is not null;
create index if not exists events_anon_created_idx on public.events (anon_id, created_at desc) where anon_id is not null;
