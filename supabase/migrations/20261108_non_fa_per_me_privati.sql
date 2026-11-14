-- Profilo pubblico (8/11): i posti segnati "Non fa per me" non si vedono più agli altri, nemmeno come "provati".
--
-- Prima la vista salvati_pubblici toglieva solo il tag: il posto restava tra i "Provati" del profilo
-- pubblico, nella mappa, nel feed di chi segue e in "N amici ci sono stati". Chi lo vedeva poteva
-- intuire il giudizio (un provato senza 👍). Ora la riga intera resta privata, e così il conteggio
-- "Provati" del profilo e la classifica pubblica.
--
-- Additiva e senza toccare dati: solo "create or replace view" con le stesse colonne, nello stesso
-- ordine (nessuna colonna tolta o rinominata, quindi nessun drop). Da applicare a mano (Lorenzo).
-- Dopo l'applicazione: in profilo-social.tsx e in /privacy togliere la frase "Un posto segnato
-- “Non fa per me” può comparire tra i provati, senza il giudizio" (non sarà più vera).

create or replace view public.profili_pubblici as
select
  p.id,
  p.handle,
  p.display_name,
  p.bio,
  p.city,
  p.created_at,
  (select count(*) from public.saved_places s where s.user_id = p.id and 'Già visitato' = any (s.tags)
     and not ('Non fa per me' = any (s.tags)))::int as visitati,
  -- da provare = salvato e non ancora visitato (come le liste della pagina /u/<handle>)
  (select count(*) from public.saved_places s where s.user_id = p.id and not ('Già visitato' = any (coalesce(s.tags, '{}')))
     and not ('Non fa per me' = any (coalesce(s.tags, '{}'))))::int as da_provare,
  (select count(*) from public.follows f join public.profiles q on q.id = f.follower_id and q.is_public
     where f.followed_id = p.id)::int as seguaci,
  (select count(*) from public.follows f join public.profiles q on q.id = f.followed_id and q.is_public
     where f.follower_id = p.id)::int as seguiti
from public.profiles p
where p.is_public and p.handle is not null;

create or replace view public.salvati_pubblici as
select
  s.user_id,
  p.handle,
  p.display_name,
  s.place_id,
  array_remove(coalesce(s.tags, '{}'), 'Non fa per me') as tags,  -- MAI la nota: colonna esclusa
  s.created_at,
  pl.name,
  pl.category,
  pl.address,
  pl.lat,
  pl.lng,
  pl.google_place_id
from public.saved_places s
join public.profiles p on p.id = s.user_id and p.is_public and p.handle is not null
join public.places pl on pl.id = s.place_id
where not ('Non fa per me' = any (coalesce(s.tags, '{}')));

revoke all on public.profili_pubblici from anon, authenticated;
revoke all on public.salvati_pubblici from anon, authenticated;
grant select on public.profili_pubblici to anon, authenticated;
grant select on public.salvati_pubblici to anon, authenticated;

-- Classifica pubblica: solo se la vista esiste già (migrazione 20261015_classifica applicata).
do $$
begin
  if exists (select 1 from information_schema.views where table_schema = 'public' and table_name = 'classifica_pubblica') then
    execute $v$
      create or replace view public.classifica_pubblica as
      select s.user_id, s.place_id, s.rank_score
      from public.saved_places s
      join public.profiles p on p.id = s.user_id and p.is_public and p.handle is not null
      where s.rank_score is not null and 'Già visitato' = any (s.tags)
        and not ('Non fa per me' = any (s.tags))
    $v$;
    execute 'revoke all on public.classifica_pubblica from anon, authenticated';
    execute 'grant select on public.classifica_pubblica to anon, authenticated';
  end if;
end $$;
