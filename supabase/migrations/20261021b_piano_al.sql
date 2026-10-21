-- Migration: "Quando ci vai?" appena salvato (docs/autonomia/PROPOSTE.md, proposta 17), 21/10/2026.
-- Giorno in cui l'utente pensa di andarci ("Stasera" = oggi, "Nel weekend" = il sabato).
-- Quel giorno (e il seguente) il locale va in cima a "Stasera dove andiamo?".
-- La scrive il telefono sulla propria riga, come tags e visite (stesse regole RLS).
-- Idempotente, nessun dato toccato.
alter table public.saved_places add column if not exists piano_al date;
