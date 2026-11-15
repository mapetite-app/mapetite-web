-- Inviti tra amici: si torna amici con un link nuovo di chi aveva tolto l'amicizia (revisore 14/11, quinto giro).
-- Prima una coppia passata da un invito e poi tolta restava fuori per sempre ('gia-usato').
-- Regola decisa:
-- - chi ha tolto l'amicizia la ripristina mandando un link NUOVO (creato dopo averla tolta: "Nuovo link",
--   o il primo link se non ne aveva uno);
-- - chi è stato tolto non rientra da solo: né col vecchio link di chi l'ha tolto, né con un link suo
--   (chi ha tolto e apre il link dell'altro riceve 'tolto-da-te': tocca a lui mandare un link nuovo).
-- Solo colonne nuove (vuote) e funzioni: nessun dato cancellato o riscritto. Al 15/11 inviti_usati è vuota
-- in produzione, quindi non ci sono coppie tolte senza "chi ha tolto".
-- search_path vuoto e nomi completi, lucchetti per persona, tetto di 30, auth.uid().

alter table public.inviti_usati add column if not exists codice text;          -- il codice dell'invito usato
alter table public.inviti_usati add column if not exists tolto_da uuid references auth.users (id) on delete set null;
alter table public.inviti_usati add column if not exists tolto_at timestamptz;

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

  -- Un lucchetto per ciascuna delle due persone, sempre nello stesso ordine (niente stalli).
  perform pg_advisory_xact_lock(hashtext(least(v_me, v_owner)::text));
  perform pg_advisory_xact_lock(hashtext(greatest(v_me, v_owner)::text));

  -- La coppia ha già usato un invito.
  if exists (
    select 1 from public.inviti_usati
    where (invitato_id = v_me and owner_id = v_owner) or (invitato_id = v_owner and owner_id = v_me)
  ) then
    -- Ancora amici: va bene (tocco ripetuto).
    if exists (select 1 from public.follows where follower_id = v_me and followed_id = v_owner)
       and exists (select 1 from public.follows where follower_id = v_owner and followed_id = v_me) then
      select nullif(trim(display_name), '') into v_nome from public.profiles where id = v_owner;
      return jsonb_build_object('stato', 'ok', 'nome', v_nome);
    end if;
    -- Amicizia tolta: chi l'ha tolta e quando.
    select u.tolto_da, u.tolto_at into v_tolto_da, v_tolto_at
    from public.inviti_usati u
    where (u.invitato_id = v_me and u.owner_id = v_owner) or (u.invitato_id = v_owner and u.owner_id = v_me)
    order by u.tolto_at desc nulls last
    limit 1;
    -- Si torna amici solo se il link è di chi ha tolto ed è nato dopo (link nuovo), e non è uno già usato dalla coppia.
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

  -- Massimo 30 amicizie da invito per persona, sia per chi accetta sia per chi invita: contano solo
  -- le coppie che sono ancora amiche (chi toglie un amico libera un posto).
  if (
       select count(*) from public.inviti_usati u
       where (u.invitato_id = v_me or u.owner_id = v_me)
         and exists (select 1 from public.follows a where a.follower_id = u.invitato_id and a.followed_id = u.owner_id)
         and exists (select 1 from public.follows b where b.follower_id = u.owner_id and b.followed_id = u.invitato_id)
     ) >= 30
     or (
       select count(*) from public.inviti_usati u
       where (u.invitato_id = v_owner or u.owner_id = v_owner)
         and exists (select 1 from public.follows a where a.follower_id = u.invitato_id and a.followed_id = u.owner_id)
         and exists (select 1 from public.follows b where b.follower_id = u.owner_id and b.followed_id = u.invitato_id)
     ) >= 30 then
    return jsonb_build_object('stato', 'troppi');
  end if;

  -- Di nuovo amici: "tolto" si azzera su tutte le righe della coppia, e questa riga ricorda il codice usato.
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

-- "Togli dagli amici": toglie i due "segui" e, se eravate amici da invito, ricorda chi l'ha tolta e quando.
-- Solo se eravate amici (vi seguivate a vicenda): chi è stato tolto non può "ritogliere" (per esempio dopo un
-- "Segui" su un profilo pubblico) per passare dalla parte di chi ha tolto e poi rientrare con un link suo.
create or replace function public.togli_amico(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  v_amici boolean;
begin
  if v_me is null or p_id is null or p_id = v_me then return; end if;
  perform pg_advisory_xact_lock(hashtext(least(v_me, p_id)::text));
  perform pg_advisory_xact_lock(hashtext(greatest(v_me, p_id)::text));
  v_amici := exists (select 1 from public.follows where follower_id = v_me and followed_id = p_id)
    and exists (select 1 from public.follows where follower_id = p_id and followed_id = v_me);
  delete from public.follows
  where (follower_id = v_me and followed_id = p_id) or (follower_id = p_id and followed_id = v_me);
  if v_amici then
    update public.inviti_usati set tolto_da = v_me, tolto_at = now()
    where (invitato_id = v_me and owner_id = p_id) or (invitato_id = p_id and owner_id = v_me);
  end if;
end;
$$;

revoke all on function public.accetta_invito(text) from public, anon;
revoke all on function public.togli_amico(uuid) from public, anon;
grant execute on function public.accetta_invito(text) to authenticated;
grant execute on function public.togli_amico(uuid) to authenticated;
