-- Migration: foto degli utenti (piani 4.4 diario e 5.6c community).
-- Applicata in produzione con l'API di gestione Supabase il 17/10/2026.
-- Idempotente: sicura da ri-eseguire. Solo aggiunte: nessun dato esistente cancellato o riscritto.
--
-- Cosa sono: 1–3 foto SCATTATE DALL'UTENTE (o dalla sua galleria) per locale. Mai foto Google
-- (i termini Google vietano di copiarle sui nostri server): qui finiscono solo file caricati dal
-- telefono dell'utente, già ridimensionati lì (lato lungo 1600 px, JPEG, sotto i 500 KB).
--
-- Spazio file: Supabase Storage (incluso nel piano gratuito), bucket "foto-utenti" PRIVATO.
--   - Percorso: <user_id>/<place_id>/<id>.jpg. Ognuno scrive, legge e cancella solo nella
--     propria cartella <user_id>/ (policy su storage.objects).
--   - Nessuno legge il bucket direttamente dal telefono: le immagini passano da /api/foto-utenti/<id>,
--     che controlla la visibilità (vista foto_pubbliche o foto propria) e poi legge il file con la
--     chiave del server. Così l'indirizzo dell'immagine non contiene mai l'id dell'autore (che resta
--     nascosto per chi ha il profilo privato, come nelle recensioni).
--
-- Visibilità (stesse regole di recensioni_pubbliche, 20261016_community.sql):
--   - pubblica = false (default, foto aggiunte dal diario): le vede solo l'autore, come la nota.
--   - pubblica = true (foto aggiunte alla recensione, o "Mostrale nella scheda" dal diario): le
--     vedono tutti nella sezione "Dalla community Mapetite"; il nome dell'autore compare SOLO se
--     il profilo è pubblico, altrimenti "un membro di Mapetite".

-- ── 1. Bucket privato, solo JPEG, al massimo 512 KB per file ────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('foto-utenti', 'foto-utenti', false, 524288, array['image/jpeg'])
on conflict (id) do update
  set public = false, file_size_limit = 524288, allowed_mime_types = array['image/jpeg'];

-- ── 2. Policy sui file: solo nella propria cartella ─────────────────────────
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'foto_utenti_select_own') then
    create policy foto_utenti_select_own on storage.objects for select to authenticated
      using (bucket_id = 'foto-utenti' and (storage.foldername(name))[1] = auth.uid()::text);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'foto_utenti_insert_own') then
    create policy foto_utenti_insert_own on storage.objects for insert to authenticated
      with check (bucket_id = 'foto-utenti' and (storage.foldername(name))[1] = auth.uid()::text);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'foto_utenti_delete_own') then
    create policy foto_utenti_delete_own on storage.objects for delete to authenticated
      using (bucket_id = 'foto-utenti' and (storage.foldername(name))[1] = auth.uid()::text);
  end if;
end $$;

-- ── 3. Collegamento foto → (utente, locale) ─────────────────────────────────
create table if not exists public.foto_locali (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  place_id   uuid not null references public.places (id) on delete cascade,
  path       text not null unique,
  pubblica   boolean not null default false,
  created_at timestamptz not null default now(),
  -- Il file deve stare nella cartella dell'autore (niente foto "prese in prestito" da altri).
  constraint foto_locali_path_check check (path like user_id::text || '/%' and char_length(path) <= 200)
);

create index if not exists foto_locali_place_idx on public.foto_locali (place_id, created_at desc);
create index if not exists foto_locali_user_place_idx on public.foto_locali (user_id, place_id);

-- Al massimo 3 foto per locale per utente (controllo anche nel database, non solo nell'app).
create or replace function public.foto_locali_max3() returns trigger
language plpgsql as $$
begin
  if (select count(*) from public.foto_locali where user_id = new.user_id and place_id = new.place_id) >= 3 then
    raise exception 'massimo 3 foto per locale' using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists foto_locali_max3 on public.foto_locali;
create trigger foto_locali_max3 before insert on public.foto_locali
  for each row execute function public.foto_locali_max3();

alter table public.foto_locali enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'foto_locali' and policyname = 'foto_locali_select_own') then
    create policy foto_locali_select_own on public.foto_locali for select to authenticated using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'foto_locali' and policyname = 'foto_locali_insert_own') then
    create policy foto_locali_insert_own on public.foto_locali for insert to authenticated with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'foto_locali' and policyname = 'foto_locali_update_own') then
    create policy foto_locali_update_own on public.foto_locali for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'foto_locali' and policyname = 'foto_locali_delete_own') then
    create policy foto_locali_delete_own on public.foto_locali for delete to authenticated using (auth.uid() = user_id);
  end if;
end $$;

-- ── 4. Vista pubblica (sola lettura): solo le foto pubbliche, autore solo se profilo pubblico ─
create or replace view public.foto_pubbliche as
select
  f.id,
  f.place_id,
  f.created_at,
  case when p.is_public and p.handle is not null then f.user_id end      as user_id,
  case when p.is_public and p.handle is not null then p.handle end       as handle,
  case when p.is_public and p.handle is not null then p.display_name end as display_name,
  -- Serve solo a non mostrare all'autore le sue stesse foto tra quelle "degli altri".
  f.user_id = auth.uid() as mia
from public.foto_locali f
left join public.profiles p on p.id = f.user_id
where f.pubblica;

revoke all on public.foto_pubbliche from anon, authenticated;
grant select on public.foto_pubbliche to anon, authenticated;
