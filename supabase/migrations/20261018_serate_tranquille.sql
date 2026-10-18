-- Migration: "Serate tranquille" (docs/autonomia/POSIZIONAMENTO.md, proposta 1), 18/10/2026.
-- Il titolare di un locale verificato sceglie i giorni della settimana in cui ha posto; la scheda
-- del locale mostra una riga ("Stasera c'è posto"). Idempotente, nessun dato toccato.
-- Scrive solo il server (chiave di servizio, /api/ristoratore/serate) dopo aver controllato che chi
-- scrive sia admin o titolare con una richiesta verificata: places resta in sola lettura per il
-- telefono (20261017d_places_solo_server.sql). La lettura è pubblica come il resto di places.
alter table public.places add column if not exists giorni_tranquilli smallint[];
alter table public.places add column if not exists giorni_tranquilli_at timestamptz;

alter table public.places drop constraint if exists places_giorni_tranquilli_check;
alter table public.places add constraint places_giorni_tranquilli_check check (
  giorni_tranquilli is null
  or (cardinality(giorni_tranquilli) <= 7 and giorni_tranquilli <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[])
);
