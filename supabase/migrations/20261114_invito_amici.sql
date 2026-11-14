-- Invito che collega da solo (Lorenzo, 14/11: "non riesco a trovare nessuno").
-- Chi si registra dal link d'invito di un amico (/invito/<codice>) diventa subito suo amico,
-- in entrambi i sensi: due righe in follows. Il codice è il nome pubblico di chi invita oppure
-- "u-" + le prime 8 cifre del suo id (src/lib/invito.ts, myInviteCode).
--
-- Consenso: chi invita manda il proprio link personale (vuole essere seguito da chi lo apre);
-- chi arriva si registra da quel link e vede scritto "diventate amici" prima di iniziare.
-- Cosa si vede degli altri resta deciso solo da "Fatti trovare" (profiles.is_public): un follow
-- non apre nessun dato privato, le viste pubbliche non cambiano.
--
-- Limiti contro gli abusi: solo account creati da meno di 3 giorni (è un arrivo, non un modo per
-- farsi seguire da chiunque), mai se stessi, codice che deve indicare una persona sola.

create or replace function public.collega_invito(p_codice text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_codice text := lower(trim(coalesce(p_codice, '')));
  v_creato timestamptz;
  v_ids uuid[];
  v_amico uuid;
  v_nome text;
  v_pubblico boolean;
begin
  if v_me is null then
    return jsonb_build_object('stato', 'anonimo');
  end if;
  if v_codice !~ '^[a-z0-9._-]{2,30}$' then
    return jsonb_build_object('stato', 'codice');
  end if;

  select created_at into v_creato from auth.users where id = v_me;
  if v_creato is null or v_creato < now() - interval '3 days' then
    return jsonb_build_object('stato', 'vecchio');
  end if;

  if v_codice ~ '^u-[0-9a-f]{8}$' then
    select array_agg(id) into v_ids from (
      select id from profiles where replace(id::text, '-', '') like substr(v_codice, 3) || '%' limit 2
    ) t;
  else
    select array_agg(id) into v_ids from profiles where handle = v_codice;
  end if;

  if v_ids is null or array_length(v_ids, 1) <> 1 then
    return jsonb_build_object('stato', 'non-trovato');
  end if;
  v_amico := v_ids[1];
  if v_amico = v_me then
    return jsonb_build_object('stato', 'se-stesso');
  end if;

  insert into follows (follower_id, followed_id) values (v_me, v_amico), (v_amico, v_me)
  on conflict do nothing;

  select coalesce(nullif(trim(display_name), ''), case when is_public then handle end), is_public and handle is not null
    into v_nome, v_pubblico
    from profiles where id = v_amico;

  return jsonb_build_object('stato', 'ok', 'nome', v_nome, 'pubblico', coalesce(v_pubblico, false));
end;
$$;

revoke all on function public.collega_invito(text) from public;
revoke all on function public.collega_invito(text) from anon;
grant execute on function public.collega_invito(text) to authenticated;
