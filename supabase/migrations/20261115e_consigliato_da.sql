-- "Te l'ha consigliato Giulia" (docs/autonomia/PROPOSTE.md, proposta 58), 15/11/2026.
-- Il nome di chi ha consigliato il posto, scritto sulla riga del salvato da chi salva (è la sua nota):
-- arriva dal link di condivisione (?da=Giulia) oppure lo mette a mano nel foglio del salvato.
--
-- Privato di chi salva: le viste pubbliche (profili_pubblici, salvati_pubblici, classifica_pubblica,
-- scopritori) selezionano colonne esplicite e NON la includono; la RLS di saved_places lascia leggere
-- e scrivere solo le proprie righe. Nessuna vista da ricreare.
--
-- Additiva e idempotente, nessun dato toccato. Da applicare a mano (prima sul progetto di prova).
alter table public.saved_places add column if not exists consigliato_da text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'saved_places_consigliato_da_check' and conrelid = 'public.saved_places'::regclass
  ) then
    alter table public.saved_places
      add constraint saved_places_consigliato_da_check
      check (consigliato_da is null or char_length(btrim(consigliato_da)) between 1 and 40);
  end if;
end $$;
