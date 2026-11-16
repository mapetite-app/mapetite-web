-- Proposta 61 "C'è stato davvero" (16/11 notte, PROBLEMI.md 26): una recensione Mapetite nuova (o modificata)
-- solo da chi ha segnato "Ci sono stato" su quel posto. Legge 34/2026 e linee guida AGCM di ottobre 2026:
-- misure "ragionevoli e proporzionate" per verificare che chi recensisce ci sia stato davvero.
--
-- Additiva: un trigger (le recensioni già scritte restano; si controlla solo quando si scrive) e la vista
-- recensioni_pubbliche con due colonne in più IN FONDO (create or replace, stesse colonne prima):
--   c_e_stato   = l'autore ha "Ci sono stato" su quel posto;
--   visita_mese = primo giorno del mese della visita (solo il mese, mai il giorno), se l'ha segnato.
-- La vista resta di proprietà di postgres (legge saved_places senza RLS, come prima legge profiles) ed
-- espone solo questi due campi, mai tag, note o lucchetti.

create or replace function public.recensione_da_visita() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Cambi che non toccano stelle o commento (nessuno oggi) non richiedono la visita.
  if tg_op = 'UPDATE' and new.rating is not distinct from old.rating and new.comment is not distinct from old.comment
     and new.place_id = old.place_id and new.user_id = old.user_id then
    return new;
  end if;
  if not exists (
    select 1 from public.saved_places s
    where s.user_id = new.user_id and s.place_id = new.place_id and 'Già visitato' = any (coalesce(s.tags, '{}'))
  ) then
    raise exception 'visita_mancante' using errcode = 'P0001', hint = 'Segna "Ci sono stato" prima di recensire';
  end if;
  return new;
end $$;

drop trigger if exists reviews_da_visita on public.reviews;
create trigger reviews_da_visita before insert or update on public.reviews
  for each row execute function public.recensione_da_visita();

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
  select true as c_e_stato, date_trunc('month', s.visited_at)::date as visita_mese
  from public.saved_places s
  where s.user_id = r.user_id and s.place_id = r.place_id and 'Già visitato' = any (coalesce(s.tags, '{}'))
  limit 1
) v on true;

revoke all on public.recensioni_pubbliche from anon, authenticated;
grant select on public.recensioni_pubbliche to anon, authenticated;
