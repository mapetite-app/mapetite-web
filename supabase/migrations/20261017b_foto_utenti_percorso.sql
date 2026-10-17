-- Migration: sicurezza delle foto degli utenti (correzione del 17/10/2026, revisione del codice).
-- Applicata in produzione con l'API di gestione Supabase il 17/10/2026 (tabella e bucket vuoti:
-- nessun dato toccato). Idempotente.
--
-- Problema: il controllo sul percorso accettava qualunque testo che iniziasse con "<user_id>/",
-- anche "<user_id>/../../..". /api/foto-utenti/<id> leggeva quel percorso con la chiave del server
-- e la libreria Storage non lo codifica: un utente poteva far leggere al server altri indirizzi di
-- Supabase (con la chiave segreta). Ora il percorso è uno solo, ricostruibile dagli id, e la route
-- non usa più il testo salvato (vedi src/app/api/foto-utenti/[id]/route.ts).

-- ── 1. Percorso esatto: <user_id>/<place_id>/<id>.jpg ───────────────────────
alter table public.foto_locali drop constraint if exists foto_locali_path_check;
alter table public.foto_locali add constraint foto_locali_path_check
  check (path = user_id::text || '/' || place_id::text || '/' || id::text || '.jpg');

-- ── 2. File: solo nomi <uuid>/<uuid>/<uuid>.jpg nella propria cartella, al massimo 300 a persona ─
-- (3 foto per 100 locali). Prima si potevano caricare file senza limite fino a riempire lo spazio.
drop policy if exists foto_utenti_insert_own on storage.objects;
create policy foto_utenti_insert_own on storage.objects for insert to authenticated
  with check (
    bucket_id = 'foto-utenti'
    and (storage.foldername(name))[1] = auth.uid()::text
    and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.jpg$'
    and (
      select count(*) from storage.objects o
      where o.bucket_id = 'foto-utenti' and (storage.foldername(o.name))[1] = auth.uid()::text
    ) < 300
  );
