-- Inviti: due persone già amiche ricevono sempre 'ok', anche se una ha raggiunto il tetto di 30 (revisore 15/11,
-- settimo giro). Solo la funzione: nessun dato cancellato o riscritto.

create or replace function public.accetta_invito(p_codice text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  v_codice text := lower(trim(coalesce(p_codice, '')));
  v_owner uuid;
  v_creato timestamptz;
  v_nome text;
  v_tolto_da uuid;
  v_tolto_at timestamptz;
begin
  if v_me is null then return jsonb_build_object('stato', 'anonimo'); end if;
  select owner_id, created_at into v_owner, v_creato from public.inviti where codice = v_codice;
  if v_owner is null then return jsonb_build_object('stato', 'non-trovato'); end if;
  if v_owner = v_me then return jsonb_build_object('stato', 'se-stesso'); end if;
  if not exists (select 1 from public.profiles where id = v_me and nullif(trim(display_name), '') is not null) then
    return jsonb_build_object('stato', 'nome');
  end if;

  perform pg_advisory_xact_lock(hashtext(least(v_me, v_owner)::text));
  perform pg_advisory_xact_lock(hashtext(greatest(v_me, v_owner)::text));

  -- Già amici (anche senza invito): va bene, prima del tetto (revisore 15/11, settimo giro: con uno dei due a 30
  -- due amici ricevevano "troppi").
  if exists (select 1 from public.follows where follower_id = v_me and followed_id = v_owner)
     and exists (select 1 from public.follows where follower_id = v_owner and followed_id = v_me) then
    select nullif(trim(display_name), '') into v_nome from public.profiles where id = v_owner;
    return jsonb_build_object('stato', 'ok', 'nome', v_nome);
  end if;

  if exists (
    select 1 from public.inviti_usati
    where (invitato_id = v_me and owner_id = v_owner) or (invitato_id = v_owner and owner_id = v_me)
  ) then
    if exists (select 1 from public.follows where follower_id = v_me and followed_id = v_owner)
       and exists (select 1 from public.follows where follower_id = v_owner and followed_id = v_me) then
      select nullif(trim(display_name), '') into v_nome from public.profiles where id = v_owner;
      return jsonb_build_object('stato', 'ok', 'nome', v_nome);
    end if;
    select u.tolto_da, u.tolto_at into v_tolto_da, v_tolto_at
    from public.inviti_usati u
    where (u.invitato_id = v_me and u.owner_id = v_owner) or (u.invitato_id = v_owner and u.owner_id = v_me)
    order by u.tolto_at desc nulls last
    limit 1;
    if not (
      v_tolto_da = v_owner
      and v_tolto_at is not null
      and v_creato > v_tolto_at
      and not exists (
        select 1 from public.inviti_usati u
        where ((u.invitato_id = v_me and u.owner_id = v_owner) or (u.invitato_id = v_owner and u.owner_id = v_me))
          and u.codice = v_codice
      )
    ) then
      if v_tolto_da = v_me then return jsonb_build_object('stato', 'tolto-da-te'); end if;
      return jsonb_build_object('stato', 'gia-usato');
    end if;
  end if;

  if public.amici_da_invito(v_me) >= 30 then return jsonb_build_object('stato', 'troppi'); end if;
  if public.amici_da_invito(v_owner) >= 30 then
    select nullif(trim(display_name), '') into v_nome from public.profiles where id = v_owner;
    return jsonb_build_object('stato', 'troppi-lui', 'nome', v_nome);
  end if;

  update public.inviti_usati set tolto_da = null, tolto_at = null
  where (invitato_id = v_me and owner_id = v_owner) or (invitato_id = v_owner and owner_id = v_me);
  insert into public.inviti_usati (invitato_id, owner_id, codice) values (v_me, v_owner, v_codice)
  on conflict (invitato_id, owner_id) do update set codice = excluded.codice;
  insert into public.follows (follower_id, followed_id) values (v_me, v_owner), (v_owner, v_me)
  on conflict do nothing;
  select nullif(trim(display_name), '') into v_nome from public.profiles where id = v_owner;
  return jsonb_build_object('stato', 'ok', 'nome', v_nome);
end;
$$;

revoke all on function public.accetta_invito(text) from public, anon;
grant execute on function public.accetta_invito(text) to authenticated;
