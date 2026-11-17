-- Migration: "Fascia di prezzo confermata dal locale" (docs/autonomia/PROPOSTE.md, proposta 65), 17/11/2026.
-- Il titolare di un locale verificato indica quanto si spende a testa (da/a, in euro) e se le bevande
-- sono incluse; la scheda mostra "💶 25–35 € a testa · dice il locale". Non cambia l'ordine dei risultati
-- e non tocca la fascia € di Google (la scheda la nasconde solo accanto al prezzo del titolare). Scrive solo il server (/api/ristoratore/serate, chiave di
-- servizio) dopo il controllo del titolare, come aperto_dal. Idempotente, solo aggiunta, nessun dato toccato.
alter table public.places add column if not exists prezzo_min smallint;
alter table public.places add column if not exists prezzo_max smallint;
alter table public.places add column if not exists prezzo_bevande boolean;

alter table public.places drop constraint if exists places_prezzo_check;
alter table public.places add constraint places_prezzo_check check (
  (prezzo_min is null and prezzo_max is null)
  or (prezzo_min between 1 and 500 and prezzo_max between 1 and 500 and prezzo_min <= prezzo_max)
);
