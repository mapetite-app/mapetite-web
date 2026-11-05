-- Proposta 45 "Ha chiuso?" (4/11): stato del locale letto da Google quando passa già da una ricerca
-- o dalla scheda (nessuna chiamata in più). Mai cancellato niente da solo: è solo un'etichetta.
alter table public.places add column if not exists business_status text;
alter table public.places add column if not exists business_status_at timestamptz;
