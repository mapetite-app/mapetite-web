-- Memoria dei gusti dell'assistente (piano 1.4): preferenze dichiarate in chat e confermate con "Sì"
-- ("vegetariano", "no-pesce", "tranquillo", "budget-30"…). Solo identificativi conosciuti dal codice
-- (src/lib/gusti.ts), mai il testo scritto dall'utente.
-- ADDITIVA: nessun dato esistente cambia. Le policy di profiles (lettura/modifica del proprio
-- profilo) valgono già per la colonna nuova. Senza questa migrazione l'app tiene i gusti nel telefono.
alter table public.profiles
  add column if not exists gusti_ricordati text[] not null default '{}';
