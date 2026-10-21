-- Migration: "mappa del gusto" del primo accesso (sprint 25/10), 21/10/2026.
-- Zone dove si esce, tipi di posto piaciuti e non, "famosi o chicche?". Formato in src/lib/mappa-gusto.ts.
-- La scrive l'utente sulla propria riga di profiles (stesse regole di cuisines e gusti_ricordati).
-- Idempotente, nessun dato toccato.
alter table public.profiles add column if not exists gusto jsonb;
