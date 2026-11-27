-- Proposta 88 "Piace già a più di voi" (27/11 notte): in cima a una lista di gruppo, fino a 3 posti
-- che almeno 2 membri hanno già salvato, da proporre in un tocco.
--
-- Privacy (decisa dal CEO, scritta in PR):
--   - solo chi è membro della lista (membro_gruppo) riceve qualcosa;
--   - contano i salvati di chi chiede e dei membri con il PROFILO PUBBLICO (gli stessi posti che già
--     vedono gli amici sul profilo); mai i posti col lucchetto "Solo per me" né quelli in una raccolta
--     privata; un profilo privato non conta mai;
--   - si restituisce solo il NUMERO di membri che l'hanno salvato e se l'hai salvato anche tu, mai i nomi;
--   - un salvato con "Non fa per me" non conta (come in salvati_pubblici); il posto sparisce del tutto solo
--     per il "Non fa per me" di chi guarda (revisore 27/11: escluderlo per il "Non fa per me" di un altro
--     membro faceva intuire un giudizio privato, anche col lucchetto o con il profilo privato);
--   - fuori quelli già nella lista, quelli chiusi per sempre, e i membri che chi chiede ha nascosto.
-- Additiva: una funzione nuova, nessuna tabella o dato toccato.

create or replace function public.in_comune_gruppo(p_gruppo uuid)
returns table (
  place_id uuid, google_place_id text, name text, category text, address text,
  lat double precision, lng double precision, quanti int, anche_tu boolean, piaciuto int
)
language sql
stable
security definer
set search_path = public
as $$
  with membri as (
    select m.user_id
    from public.gruppi_membri m
    join public.profiles p on p.id = m.user_id
    where m.gruppo_id = p_gruppo
      and public.membro_gruppo(p_gruppo)
      and (m.user_id = auth.uid() or (p.is_public and p.handle is not null))
      and not exists (select 1 from public.utenti_nascosti n where n.user_id = auth.uid() and n.nascosto_id = m.user_id)
  ),
  salvati as (
    select s.place_id, s.user_id, s.created_at, coalesce(s.tags, '{}') as tags
    from public.saved_places s
    join membri mb on mb.user_id = s.user_id
    join public.profiles p on p.id = s.user_id
    where not s.solo_per_me
      and not ('Non fa per me' = any (coalesce(s.tags, '{}')))
      and not (coalesce(s.tags, '{}') && coalesce(p.raccolte_private, '{}'))
  ),
  no_grazie as (
    -- Solo il "Non fa per me" di chi guarda.
    select s.place_id
    from public.saved_places s
    where s.user_id = auth.uid() and 'Non fa per me' = any (coalesce(s.tags, '{}'))
  )
  select pl.id, pl.google_place_id, pl.name, pl.category, pl.address,
    pl.lat::double precision, pl.lng::double precision,
    count(distinct sv.user_id)::int as quanti,
    bool_or(sv.user_id = auth.uid()) as anche_tu,
    count(distinct sv.user_id) filter (where 'Mi è piaciuto' = any (sv.tags))::int as piaciuto
  from salvati sv
  join public.places pl on pl.id = sv.place_id
  where sv.place_id not in (select place_id from no_grazie)
    and not exists (select 1 from public.gruppi_posti gp where gp.gruppo_id = p_gruppo and gp.place_id = sv.place_id)
    and coalesce(pl.business_status, '') <> 'CLOSED_PERMANENTLY'
  group by pl.id
  having count(distinct sv.user_id) >= 2
  order by quanti desc, piaciuto desc, max(sv.created_at) desc
  limit 5; -- se ne mostrano 3: dopo un "Proponi" la sezione si riempie senza ricaricare
$$;

revoke all on function public.in_comune_gruppo(uuid) from public, anon;
grant execute on function public.in_comune_gruppo(uuid) to authenticated;
