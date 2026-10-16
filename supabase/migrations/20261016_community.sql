-- Migration: community Mapetite nella scheda del locale (piano 5.6c recensioni, 5.6d reel).
-- DA APPLICARE A MANO (coordinatore / Lorenzo), DOPO 20261015_social.sql.
-- Finché non è applicata l'app funziona uguale: le recensioni si leggono come oggi dalla tabella
-- reviews (anonime), la sezione "Visto su…" resta vuota e "Aggiungi un video" dice "in arrivo".
-- Idempotente: sicura da ri-eseguire. Nessun dato esistente viene cancellato o riscritto.
--
-- Privacy (stesse regole di 20261015_social.sql):
--   - RECENSIONI: si riusa la tabella reviews che esiste già (stelle 1–5 + commento). Oggi è
--     leggibile per intero da chiunque (policy reviews_select_public, using true), user_id compreso.
--     Da qui: la tabella la legge solo il proprietario; gli altri leggono la vista
--     recensioni_pubbliche, dove nome e id dell'autore compaiono SOLO se il profilo è pubblico.
--     Chi ha il profilo privato resta anonimo ("Un membro di Mapetite"), come oggi.
--   - REEL: tabella nuova contenuti_locali con il SOLO link (mai titolo, miniatura o testo del
--     video: l'anteprima arriva ogni volta dall'oEmbed ufficiale). La legge solo il proprietario;
--     gli altri vedono la vista contenuti_pubblici, solo per chi ha il profilo pubblico.
--   - Le viste sono in sola lettura (grant select e basta) e non si scrive mai attraverso di esse.
--   - Foto degli utenti: rimandate (non esiste ancora un bucket di Supabase Storage).

-- ── 1. Reel e video collegati ai locali ──────────────────────────────────────
create table if not exists public.contenuti_locali (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  place_id   uuid not null references public.places (id) on delete cascade,
  url        text not null,
  fonte      text not null,
  created_at timestamptz not null default now(),
  constraint contenuti_locali_url_check check (char_length(url) <= 500 and url ~ '^https://'),
  constraint contenuti_locali_fonte_check check (fonte in ('Instagram', 'TikTok', 'YouTube')),
  constraint contenuti_locali_unici unique (user_id, place_id, url)
);

create index if not exists contenuti_locali_place_idx on public.contenuti_locali (place_id, created_at desc);

alter table public.contenuti_locali enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'contenuti_locali' and policyname = 'contenuti_locali_select_own') then
    create policy contenuti_locali_select_own
      on public.contenuti_locali for select to authenticated
      using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'contenuti_locali' and policyname = 'contenuti_locali_insert_own') then
    create policy contenuti_locali_insert_own
      on public.contenuti_locali for insert to authenticated
      with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'contenuti_locali' and policyname = 'contenuti_locali_delete_own') then
    create policy contenuti_locali_delete_own
      on public.contenuti_locali for delete to authenticated
      using (auth.uid() = user_id);
  end if;
end $$;

-- ── 2. Recensioni: commento breve ────────────────────────────────────────────
-- "not valid": vale per le recensioni nuove, non si ricontrollano quelle già scritte.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'reviews_comment_len') then
    alter table public.reviews
      add constraint reviews_comment_len check (comment is null or char_length(comment) <= 500) not valid;
  end if;
end $$;

-- ── 3. Viste pubbliche e lettura stretta (solo se la parte social è applicata) ─
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'is_public'
  ) then
    execute $v$
      create or replace view public.recensioni_pubbliche as
      select
        r.id,
        r.place_id,
        r.rating,
        r.comment,
        r.created_at,
        case when p.is_public and p.handle is not null then r.user_id end      as user_id,
        case when p.is_public and p.handle is not null then p.handle end       as handle,
        case when p.is_public and p.handle is not null then p.display_name end as display_name
      from public.reviews r
      left join public.profiles p on p.id = r.user_id
    $v$;
    execute 'revoke all on public.recensioni_pubbliche from anon, authenticated';
    execute 'grant select on public.recensioni_pubbliche to anon, authenticated';

    execute $v$
      create or replace view public.contenuti_pubblici as
      select c.id, c.place_id, c.url, c.fonte, c.created_at, c.user_id, p.handle, p.display_name
      from public.contenuti_locali c
      join public.profiles p on p.id = c.user_id and p.is_public and p.handle is not null
    $v$;
    execute 'revoke all on public.contenuti_pubblici from anon, authenticated';
    execute 'grant select on public.contenuti_pubblici to anon, authenticated';

    -- La tabella reviews ora la legge solo il proprietario (profilo, gusti); gli altri dalla vista.
    if not exists (select 1 from pg_policies where tablename = 'reviews' and policyname = 'reviews_select_own') then
      create policy reviews_select_own
        on public.reviews for select to authenticated
        using (auth.uid() = user_id);
    end if;
    if exists (select 1 from pg_policies where tablename = 'reviews' and policyname = 'reviews_select_public') then
      drop policy reviews_select_public on public.reviews;
    end if;
  end if;
end $$;
