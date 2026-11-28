-- Migration: "Il locale dice: senza glutine" (docs/autonomia/PROPOSTE.md, proposta 92), 28/11/2026.
-- Il titolare di un locale verificato dice a tocco: piatti senza glutine (sì / su richiesta / no), se sono preparati
-- a parte (sì / no) e se è socio AFC di AIC (sì / no, dichiarato dal locale: non è una nostra certificazione).
-- Sulla scheda, nel riquadro unico del titolare: "🌾 Senza glutine su richiesta, preparati a parte · dice il locale".
-- Non cambia l'ordine dei risultati. Scrive solo il server (/api/ristoratore/serate, chiave di servizio) dopo il
-- controllo del titolare, come prezzo_min e feste_prezzo. Idempotente, solo aggiunta, nessun dato toccato.
alter table public.places add column if not exists glutine_piatti text;
alter table public.places add column if not exists glutine_separati boolean;
alter table public.places add column if not exists glutine_afc boolean;
alter table public.places add column if not exists glutine_at timestamptz;

alter table public.places drop constraint if exists places_glutine_check;
alter table public.places add constraint places_glutine_check check (
  (glutine_piatti is null and glutine_separati is null and glutine_afc is null)
  or (glutine_piatti in ('si', 'richiesta') and glutine_at is not null)
  or (glutine_piatti = 'no' and glutine_separati is null and glutine_afc is null and glutine_at is not null)
);
