-- Proposta 74 "Recensioni come vuole la legge" (21/11, PROBLEMI.md 31; L. 34/2026): una recensione Mapetite
-- si scrive entro 30 giorni dalla visita e non si mostra agli altri dopo 2 anni.
--
-- Additiva, nessun dato toccato:
--  * il trigger reviews_da_visita (proposta 61) controlla anche la data: se la visita ha una data (visited_at,
--    scelta da chi l'ha segnata) più vecchia di 30 giorni, la recensione nuova o modificata non passa
--    ('visita_vecchia'). Senza data si accetta come prima (le visite segnate senza data non si possono datare);
--    da oggi "Ci sono stato" dalla sezione recensioni scrive anche la data di oggi.
--  * la vista recensioni_pubbliche non mostra le recensioni di oltre 2 anni (restano all'autore nella tabella
--    reviews, che legge solo le proprie). Stesse colonne e stesso mese privato della 20261116d.

create or replace function public.recensione_da_visita() returns trigger
language plpgsql
set search_path = ''
as $$
declare
  giorno date;
  visitato boolean := false;
begin
  if tg_op = 'UPDATE' and new.rating is not distinct from old.rating and new.comment is not distinct from old.comment
     and new.place_id = old.place_id and new.user_id = old.user_id then
    return new;
  end if;
  select true, s.visited_at into visitato, giorno
  from public.saved_places s
  where s.user_id = new.user_id and s.place_id = new.place_id and 'Già visitato' = any (coalesce(s.tags, '{}'))
  limit 1;
  if not coalesce(visitato, false) then
    raise exception 'visita_mancante' using errcode = 'P0001', hint = 'Segna "Ci sono stato" prima di recensire';
  end if;
  -- Data futura (visita programmata scritta in anticipo): come senza data, decide il "Già visitato".
  if giorno is not null and giorno < ((now() at time zone 'Europe/Rome')::date - 30) then
    raise exception 'visita_vecchia' using errcode = 'P0001', hint = 'La recensione si scrive entro 30 giorni dalla visita';
  end if;
  return new;
end $$;

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
) v on true
where r.created_at > now() - interval '2 years';

revoke all on public.recensioni_pubbliche from anon, authenticated;
grant select on public.recensioni_pubbliche to anon, authenticated;
