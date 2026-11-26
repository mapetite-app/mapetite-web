-- Migration: "Menu delle feste" detto dal locale (docs/autonomia/PROPOSTE.md, proposta 90), 26/11/2026.
-- Il titolare di un locale verificato indica i giorni delle feste con il menu (24, 25, 26, 31 dicembre, 1 gennaio),
-- il prezzo a persona e se le bevande sono incluse (feste_gruppi resta per dopo: oggi la scheda non lo mostra). La scheda mostra
-- "🎄 Menu delle feste 65 € · … · dice il locale" solo nella stagione in cui è stato scritto (1/11–6/1).
-- Non cambia l'ordine dei risultati. Scrive solo il server (/api/ristoratore/serate, chiave di servizio) dopo il
-- controllo del titolare, come prezzo_min. Idempotente, solo aggiunta, nessun dato toccato.
alter table public.places add column if not exists feste_prezzo smallint;
alter table public.places add column if not exists feste_bevande boolean;
alter table public.places add column if not exists feste_giorni text[];
alter table public.places add column if not exists feste_gruppi smallint;
alter table public.places add column if not exists feste_at timestamptz;

alter table public.places drop constraint if exists places_feste_check;
alter table public.places add constraint places_feste_check check (
  (feste_prezzo is null and feste_giorni is null and feste_gruppi is null and feste_bevande is null)
  or (
    feste_prezzo between 1 and 500
    and feste_bevande is not null
    and cardinality(feste_giorni) between 1 and 5
    and feste_giorni <@ array['12-24', '12-25', '12-26', '12-31', '01-01']::text[]
    and (feste_gruppi is null or feste_gruppi between 2 and 99)
  )
);
