-- Migration: classifica personale (piano 4.3) — "Ti è piaciuto più o meno di X?" e top per città.
-- DA APPLICARE A MANO (Lorenzo), DOPO 20261015_social.sql. Finché non è applicata l'app funziona
-- uguale: il confronto dopo "Ci sono stato" e la classifica nel profilo restano nascosti.
-- Idempotente: sicura da ri-eseguire. Nessun dato esistente viene cancellato o riscritto.
--
-- rank_score: posizione nella classifica personale, più alto = piaciuto di più. Si confronta solo
-- tra i visitati della stessa città (la città si ricava dall'indirizzo nell'app). Un nuovo locale
-- prende il valore a metà tra i due vicini trovati con la ricerca binaria (numeric: precisione
-- arbitraria, nessun bisogno di rinumerare gli altri). NULL = non ancora in classifica.
-- La scrive l'utente stesso con la sua sessione: valgono le policy già esistenti su saved_places.

alter table public.saved_places add column if not exists rank_score numeric;

create index if not exists saved_places_user_rank_idx
  on public.saved_places (user_id, rank_score desc)
  where rank_score is not null;

-- Classifica sul profilo pubblico: vista a parte (non si tocca salvati_pubblici), solo per chi ha
-- il profilo pubblico, solo i visitati, senza note. Si crea solo se la parte social è applicata.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'is_public'
  ) then
    execute $v$
      create or replace view public.classifica_pubblica as
      select s.user_id, s.place_id, s.rank_score
      from public.saved_places s
      join public.profiles p on p.id = s.user_id and p.is_public and p.handle is not null
      where s.rank_score is not null and 'Già visitato' = any (s.tags)
    $v$;
    execute 'revoke all on public.classifica_pubblica from anon, authenticated';
    execute 'grant select on public.classifica_pubblica to anon, authenticated';
  end if;
end $$;
