-- Proposta 66 "Non contarlo nei miei gusti" (18/11/2026).
-- Un salvato può restare salvato e visibile ma uscire dai segnali che guidano i consigli
-- ("Perché ti piacerà", "Sorprendimi", la zona abituale). Solo una colonna nuova: nessun dato toccato,
-- nessuna vista cambiata (la scelta è personale e non si mostra a nessuno). RLS di saved_places invariata.
alter table public.saved_places add column if not exists fuori_gusti boolean not null default false;
