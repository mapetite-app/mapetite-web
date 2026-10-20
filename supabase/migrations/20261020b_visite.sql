-- Migration: "I tuoi posti fissi" (docs/autonomia/PROPOSTE.md, proposta 8), 20/10/2026.
-- Quante volte l'utente è stato in un locale salvato. 0 = nessun "Ci sono tornato" registrato:
-- chi ha solo il tag "Già visitato" conta come 1 visita (calcolato nell'app, nessun dato riscritto).
-- La scrive il telefono sulla propria riga, come tags e visited_at (stesse regole RLS).
-- Idempotente, nessun dato toccato.
alter table public.saved_places add column if not exists visite smallint not null default 0;

alter table public.saved_places drop constraint if exists saved_places_visite_check;
alter table public.saved_places add constraint saved_places_visite_check check (visite between 0 and 999);
