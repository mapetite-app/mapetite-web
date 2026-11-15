-- Proposta 59 "Solo per me" (15/11 sera): il lucchetto sul singolo posto salvato.
-- Un posto con il lucchetto resta solo tuo anche con il profilo pubblico: non compare nel profilo,
-- nella mappa vista dagli amici, nel feed, in "chi l'ha salvato" sul locale, nei conteggi del profilo,
-- nella classifica pubblica né tra le gemme degli Scopritori.
--
-- Additiva e senza toccare dati: una colonna con default false (tutti i salvati di oggi restano come sono)
-- e "create or replace view" con le stesse colonne, nello stesso ordine (nessun drop). La colonna è
-- leggibile solo dal proprietario (RLS di saved_places: auth.uid() = user_id).

alter table public.saved_places add column if not exists solo_per_me boolean not null default false;

create or replace view public.profili_pubblici as
select
  p.id,
  p.handle,
  p.display_name,
  p.bio,
  p.city,
  p.created_at,
  (select count(*) from public.saved_places s where s.user_id = p.id and 'Già visitato' = any (s.tags)
     and not ('Non fa per me' = any (s.tags)) and not s.solo_per_me)::int as visitati,
  (select count(*) from public.saved_places s where s.user_id = p.id and not ('Già visitato' = any (coalesce(s.tags, '{}')))
     and not ('Non fa per me' = any (coalesce(s.tags, '{}'))) and not s.solo_per_me)::int as da_provare,
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
  array_remove(coalesce(s.tags, '{}'), 'Non fa per me') as tags,  -- MAI la nota né consigliato_da
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
where not ('Non fa per me' = any (coalesce(s.tags, '{}'))) and not s.solo_per_me;

create or replace view public.classifica_pubblica as
select s.user_id, s.place_id, s.rank_score
from public.saved_places s
join public.profiles p on p.id = s.user_id and p.is_public and p.handle is not null
where s.rank_score is not null and 'Già visitato' = any (s.tags)
  and not ('Non fa per me' = any (s.tags)) and not s.solo_per_me;

create or replace view public.scopritori_pubblici as
select
  p.id,
  p.handle,
  p.display_name,
  (select count(*) from public.saved_places s join public.places pl on pl.id = s.place_id
     where s.user_id = p.id and pl.poco_conosciuto and not s.solo_per_me)::int as gemme,
  (select count(*) from public.saved_places s join public.places pl on pl.id = s.place_id
     where s.user_id = p.id and pl.poco_conosciuto and 'Già visitato' = any (coalesce(s.tags, '{}')) and not s.solo_per_me)::int as gemme_provate
from public.profiles p
where p.is_public and p.handle is not null;

revoke all on public.profili_pubblici from anon, authenticated;
revoke all on public.salvati_pubblici from anon, authenticated;
revoke all on public.classifica_pubblica from anon, authenticated;
revoke all on public.scopritori_pubblici from anon, authenticated;
grant select on public.profili_pubblici to anon, authenticated;
grant select on public.salvati_pubblici to anon, authenticated;
grant select on public.classifica_pubblica to anon, authenticated;
grant select on public.scopritori_pubblici to anon, authenticated;
