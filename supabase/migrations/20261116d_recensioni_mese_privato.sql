-- Proposta 61, revisore del 16/11: il mese della visita non si mostra per i posti col lucchetto "Solo per me"
-- (singolo o di raccolta) né per date nel futuro. Stesse colonne, stesso ordine (create or replace).

create or replace view public.recensioni_pubbliche as
select
  r.id,
  r.place_id,
  r.rating,
  r.comment,
  r.created_at,
  case when p.is_public and p.handle is not null then r.user_id else null::uuid end as user_id,
  case when p.is_public and p.handle is not null then p.handle else null::text end as handle,
  case when p.is_public and p.handle is not null then p.display_name else null::text end as display_name,
  v.c_e_stato,
  v.visita_mese
from public.reviews r
left join public.profiles p on p.id = r.user_id
left join lateral (
  select true as c_e_stato,
    case when s.solo_per_me or coalesce(s.tags, '{}') && coalesce(p.raccolte_private, '{}') or s.visited_at > current_date
      then null else date_trunc('month', s.visited_at)::date end as visita_mese
  from public.saved_places s
  where s.user_id = r.user_id and s.place_id = r.place_id and 'Già visitato' = any (coalesce(s.tags, '{}'))
  limit 1
) v on true;

revoke all on public.recensioni_pubbliche from anon, authenticated;
grant select on public.recensioni_pubbliche to anon, authenticated;
