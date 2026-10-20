-- Migration: "Aperto da poco" (docs/autonomia/PROPOSTE.md, proposta 7), 20/10/2026.
-- Il titolare di un locale verificato indica il mese di apertura; la scheda mostra
-- "🆕 Aperto da 3 mesi" per i primi 12 mesi. Non cambia l'ordine dei risultati.
-- Scrive solo il server (/api/ristoratore/serate, chiave di servizio) dopo il controllo del titolare,
-- come giorni_tranquilli: places resta in sola lettura per il telefono. Idempotente, nessun dato toccato.
alter table public.places add column if not exists aperto_dal date;

alter table public.places drop constraint if exists places_aperto_dal_check;
alter table public.places add constraint places_aperto_dal_check check (
  aperto_dal is null or (aperto_dal >= date '1900-01-01' and extract(day from aperto_dal) = 1)
);
