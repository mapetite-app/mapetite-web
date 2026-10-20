-- Migration: i salvati si possono modificare (20/10/2026).
-- Su saved_places c'erano solo le policy SELECT, INSERT e DELETE: senza una policy UPDATE la RLS
-- fa toccare 0 righe a ogni update del telefono, SENZA errore. Così raccolte, "Ci sono stato",
-- voto del diario, data della visita, nota e classifica sembravano salvati ma non lo erano
-- (in produzione il 20/10: 0 righe con visited_at su 30 salvati).
-- Ognuno modifica solo le proprie righe e non può passarle a un altro utente. Idempotente.
drop policy if exists "Gli utenti possono modificare i propri salvataggi" on public.saved_places;
create policy "Gli utenti possono modificare i propri salvataggi"
  on public.saved_places for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
