-- Migration: "Ci sono stato" che vale come prova (docs/autonomia/PROPOSTE.md, proposta 28), 30/10/2026.
-- Ultima volta in cui il telefono ha visto la persona vicino al locale (entro 150 m) nel momento in cui
-- ha toccato "Ci sono stato" o "Ci sono tornato". Si salva SOLO l'ora: mai la posizione.
-- La scrive il telefono sulla propria riga, come visited_at e visite (stesse regole RLS).
-- Idempotente, nessun dato toccato.
alter table public.saved_places add column if not exists visita_vista_al timestamptz;
