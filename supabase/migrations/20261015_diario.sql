-- Migration: diario dei posti provati (piano 4.4) — data della visita.
-- DA APPLICARE A MANO (Lorenzo / coordinatore). Finché non è applicata l'app funziona uguale:
-- il diario mostra i posti provati senza date (niente date inventate) e il foglio "Com'è andata?"
-- chiede solo voto e nota. Idempotente: sicura da ri-eseguire. Nessun dato esistente viene
-- cancellato o riscritto.
--
-- Il resto del diario usa colonne che esistono già:
--   voto  = tag "Mi è piaciuto" / "Non fa per me" ("Com'era?", già letti da suggerimenti e Stasera);
--   nota  = saved_places.note (la nota privata della scheda);
--   visita = tag "Già visitato".
-- visited_at: giorno della visita (data senza ora, scelta dall'utente). NULL = non indicato.
-- La scrive l'utente stesso con la sua sessione: valgono le policy già esistenti su saved_places.
-- Non entra nelle viste pubbliche (salvati_pubblici, classifica_pubblica): resta privata.

alter table public.saved_places add column if not exists visited_at date;

create index if not exists saved_places_user_visited_idx
  on public.saved_places (user_id, visited_at desc)
  where visited_at is not null;
