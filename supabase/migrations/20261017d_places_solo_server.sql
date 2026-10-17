-- Migration: catalogo dei locali (places) scrivibile solo dal server (sicurezza, 17/10/2026).
-- NON ancora applicata. Idempotente, nessun dato toccato.
--
-- Stato in produzione al 17/10: RLS attiva su places con la sola regola "Lettura pubblica dei
-- locali" (SELECT). Il telefono quindi oggi NON può già scrivere in places con la chiave anon:
-- ogni scrittura passa dalle route del server (chiave di servizio, src/lib/places-store.ts), che
-- dal 17/10 accettano i dati Google solo con la firma del server (src/lib/catalog-sig.ts).
-- Restano però i permessi di tabella predefiniti di Supabase (INSERT, UPDATE, DELETE, TRUNCATE
-- per anon e authenticated): basterebbe una regola RLS aggiunta per sbaglio, o RLS spenta, per
-- riaprire la scrittura dal telefono. Qui si tolgono: resta solo la lettura.
--
-- Prima di applicarla: nessun codice del telefono scrive in places (verificato il 17/10 con
-- grep: solo letture con il client anon/utente). La funzione claims_aggiorna_verifica è
-- SECURITY DEFINER e non usa questi permessi. La chiave di servizio non è toccata.
revoke insert, update, delete, truncate on public.places from anon, authenticated;
grant select on public.places to anon, authenticated;
