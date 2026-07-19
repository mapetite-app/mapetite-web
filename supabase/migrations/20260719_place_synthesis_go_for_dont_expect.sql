-- Migration: place_synthesis — colonne go_for / dont_expect
-- Estende il verdetto editoriale Haiku con due campi strutturati:
--   go_for      → "Ci dovresti andare per…"  (il motivo per cui vale la pena)
--   dont_expect → "Non aspettarti…"          (il limite da mettere in conto)
-- Idempotente: SOLO ADD COLUMN IF NOT EXISTS, ri-eseguibile senza mai perdere dati.
--
-- Il prompt che popola i due nuovi campi arriva in un commit successivo: fino ad
-- allora le colonne restano NULL e vengono lette come "".
--
-- NOTA: l'azzeramento dei verdetti vecchi (truncate place_synthesis, per la
-- rigenerazione pulita) è un'operazione una tantum, NON parte dello schema
-- versionato — va lanciata a mano nel SQL Editor, non qui.

alter table public.place_synthesis
  add column if not exists go_for text;

alter table public.place_synthesis
  add column if not exists dont_expect text;
