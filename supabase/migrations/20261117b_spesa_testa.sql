-- Migration: "Quanto si spende davvero (detto da chi c'è stato)" (docs/autonomia/PROPOSTE.md, proposta 64), 17/11/2026.
-- Dopo "Ci sono stato", nel foglio "Com'è andata?", chi c'è stato può dire quanto ha speso a testa in 4 fasce
-- (1 = meno di 15 €, 2 = 15–30, 3 = 30–50, 4 = oltre 50 €). La risposta sta sul proprio salvato, privata come la
-- nota (RLS di saved_places: auth.uid() = user_id). La scheda mostra la fascia più scelta solo da 3 risposte in su:
-- mai chi ha risposto, mai una risposta singola, mai mescolata con la fascia € di Google né col prezzo del locale (65).
-- Solo aggiunte (una colonna senza default, un vincolo, una funzione), nessun dato toccato. Idempotente.

alter table public.saved_places add column if not exists spesa_testa smallint;

alter table public.saved_places drop constraint if exists saved_places_spesa_testa_check;
alter table public.saved_places add constraint saved_places_spesa_testa_check
  check (spesa_testa is null or spesa_testa between 1 and 4);

-- Fascia più scelta e numero di risposte per la scheda (UUID del locale o Place ID Google, come buoni_pasto_conteggio).
-- Contano solo i salvati con la visita ("Già visitato") e non nascosti agli altri: niente "Solo per me" (20261115f),
-- niente salvati che stanno in una raccolta col lucchetto (20261116). Sotto le 3 risposte nessuna riga.
-- La fascia esce solo se l'hanno scelta almeno 2 persone e nessun'altra fascia la pareggia (revisore 17/11): altrimenti niente.
create or replace function public.spesa_testa_fascia(p_place text)
returns table (fascia smallint, risposte integer)
language sql
stable
security definer
set search_path = ''
as $$
  with r as (
    select s.spesa_testa as f
    from public.saved_places s
    join public.places pl on pl.id = s.place_id
    left join public.profiles pr on pr.id = s.user_id
    where (pl.id::text = p_place or pl.google_place_id = p_place)
      and s.spesa_testa between 1 and 4
      and 'Già visitato' = any (coalesce(s.tags, '{}'))
      and not s.solo_per_me
      and not (coalesce(s.tags, '{}') && coalesce(pr.raccolte_private, '{}'))
  ),
  tot as (select count(*)::integer as n from r),
  -- Revisore 17/11: con risposte tutte diverse (1, 3, 4) non si mostra niente. La fascia esce solo se l'hanno
  -- scelta almeno 2 persone ed è davanti a tutte le altre (nessun pareggio): mai la scelta di una persona sola.
  conta as (select r.f, count(*)::integer as c from r group by r.f),
  top as (
    select c1.f, c1.c from conta c1
    where c1.c >= 2 and not exists (select 1 from conta c2 where c2.f <> c1.f and c2.c >= c1.c)
  )
  select top.f, tot.n from top, tot where tot.n >= 3;
$$;
revoke all on function public.spesa_testa_fascia(text) from public;
grant execute on function public.spesa_testa_fascia(text) to anon, authenticated;
