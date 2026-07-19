-- Migration: place_synthesis.go_for / dont_expect da text a text[] (CHIP)
-- I due poli del verdetto diventano array (più consigli/limiti, resi come chip).
--
-- Strategia dati vecchi: TRUNCATE + rigenerazione. I verdetti attuali sono frasi
-- lunghe, inutili come chip; cache piccola, zero utenti. Il truncate è una tantum
-- e va lanciato A MANO nel SQL Editor PRIMA di questa migration — NON è qui, non
-- appartiene allo schema versionato. A tabella vuota il cambio tipo è banale:
-- USING null::text[]. Le colonne restano NULLABLE.
--
-- Idempotente: il guard su information_schema esegue l'ALTER solo se la colonna
-- è ancora scalare (data_type = 'text'). Dopo la conversione data_type diventa
-- 'ARRAY', quindi un re-run salta l'ALTER senza errori.

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'place_synthesis'
      and column_name = 'go_for'
      and data_type = 'text'
  ) then
    alter table public.place_synthesis
      alter column go_for type text[] using null::text[];
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'place_synthesis'
      and column_name = 'dont_expect'
      and data_type = 'text'
  ) then
    alter table public.place_synthesis
      alter column dont_expect type text[] using null::text[];
  end if;
end $$;
