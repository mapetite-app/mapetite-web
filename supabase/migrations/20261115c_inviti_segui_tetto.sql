-- Inviti tra amici, minori del revisore 15/11 (sesto giro). Solo funzioni e un trigger: nessun dato cancellato
-- o riscritto (al 15/11 inviti_usati è vuota in produzione).
-- 1. Chi toglie il "Segui" a un amico dal profilo pubblico (cancellazione diretta in follows, senza togli_amico)
--    rompe l'amicizia: ora un trigger ricorda chi l'ha rotta e quando, come "Togli dagli amici". Prima la coppia
--    restava senza "chi ha tolto" e nessun link la rimetteva più; e due amici senza invito tornavano amici col
--    vecchio link senza un nuovo sì.
-- 2. Il tetto di 30 conta le PERSONE amiche da invito, non le righe: due persone che si erano invitate a vicenda
--    (due righe) contavano due volte.
-- 3. "troppi" distingue chi ha raggiunto il tetto: chi accetta ('troppi') o chi invita ('troppi-lui').
-- search_path vuoto e nomi completi, lucchetti per persona, auth.uid().

create or replace function public.follows_amicizia_rotta()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Account cancellato (cascata da auth.users): niente da ricordare, e la cancellazione non deve fallire.
  if not exists (select 1 from auth.users where id = old.follower_id)
     or not exists (select 1 from auth.users where id = old.followed_id) then
    return old;
  end if;
  -- Era un'amicizia (l'altro segue ancora chi ha appena smesso di seguire): si ricorda chi l'ha rotta.
  if exists (select 1 from public.follows where follower_id = old.followed_id and followed_id = old.follower_id) then
    update public.inviti_usati set tolto_da = old.follower_id, tolto_at = now()
    where (invitato_id = old.follower_id and owner_id = old.followed_id)
       or (invitato_id = old.followed_id and owner_id = old.follower_id);
    if not found then
      insert into public.inviti_usati (invitato_id, owner_id, tolto_da, tolto_at)
      values (old.followed_id, old.follower_id, old.follower_id, now())
      on conflict (invitato_id, owner_id) do update set tolto_da = excluded.tolto_da, tolto_at = excluded.tolto_at;
    end if;
  end if;
  return old;
end;
$$;

revoke all on function public.follows_amicizia_rotta() from public, anon, authenticated;

drop trigger if exists follows_amicizia_rotta on public.follows;
create trigger follows_amicizia_rotta
  after delete on public.follows
  for each row execute function public.follows_amicizia_rotta();

-- Amici da invito ancora amici, contati per persona (una sola volta anche con due righe tra le stesse due persone).
create or replace function public.amici_da_invito(p_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(distinct case when u.invitato_id = p_id then u.owner_id else u.invitato_id end)::integer
  from public.inviti_usati u
  where (u.invitato_id = p_id or u.owner_id = p_id)
    and u.codice is not null
    and exists (select 1 from public.follows a where a.follower_id = u.invitato_id and a.followed_id = u.owner_id)
    and exists (select 1 from public.follows b where b.follower_id = u.owner_id and b.followed_id = u.invitato_id);
$$;

revoke all on function public.amici_da_invito(uuid) from public, anon, authenticated;

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
