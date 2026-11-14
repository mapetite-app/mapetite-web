-- Inviti tra amici, quarta revisione (14/11 notte, revisore indipendente). Solo funzioni:
-- nessuna tabella cambia, nessun dato viene cancellato o riscritto.
-- - Il tetto di 30 amicizie da invito conta solo le coppie ancora amiche (si seguono a vicenda):
--   prima contava ogni riga di inviti_usati per sempre, anche le amicizie tolte.
-- - anteprima_invito dice anche se chi guarda è già amico di chi invita ("amico": true/false),
--   così la pagina d'invito e Amici mostrano "Siete già amici" invece di "Diventa amico".
--   Per chi non ha fatto l'accesso è sempre false. Nient'altro su chi invita.
-- - search_path vuoto e nomi completi.

create or replace function public.anteprima_invito(p_codice text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'nome', nullif(trim(p.display_name), ''),
    'handle', case when p.is_public then p.handle end,
    'amico', auth.uid() is not null
      and exists (select 1 from public.follows a where a.follower_id = auth.uid() and a.followed_id = i.owner_id)
      and exists (select 1 from public.follows b where b.follower_id = i.owner_id and b.followed_id = auth.uid())
  )
  from public.inviti i join public.profiles p on p.id = i.owner_id
  where i.codice = lower(trim(p_codice));
$$;

create or replace function public.accetta_invito(p_codice text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  v_owner uuid;
  v_nome text;
begin
  if v_me is null then return jsonb_build_object('stato', 'anonimo'); end if;
  select owner_id into v_owner from public.inviti where codice = lower(trim(p_codice));
  if v_owner is null then return jsonb_build_object('stato', 'non-trovato'); end if;
  if v_owner = v_me then return jsonb_build_object('stato', 'se-stesso'); end if;
  if not exists (select 1 from public.profiles where id = v_me and nullif(trim(display_name), '') is not null) then
    return jsonb_build_object('stato', 'nome');
  end if;

  -- Un lucchetto per ciascuna delle due persone, sempre nello stesso ordine (niente stalli).
  perform pg_advisory_xact_lock(hashtext(least(v_me, v_owner)::text));
  perform pg_advisory_xact_lock(hashtext(greatest(v_me, v_owner)::text));

  -- La coppia ha già usato un invito: se sono ancora amici va bene (tocco ripetuto), altrimenti
  -- qualcuno ha tolto l'amicizia e lo stesso link non la rimette.
  if exists (
    select 1 from public.inviti_usati
    where (invitato_id = v_me and owner_id = v_owner) or (invitato_id = v_owner and owner_id = v_me)
  ) then
    if exists (select 1 from public.follows where follower_id = v_me and followed_id = v_owner)
       and exists (select 1 from public.follows where follower_id = v_owner and followed_id = v_me) then
      select nullif(trim(display_name), '') into v_nome from public.profiles where id = v_owner;
      return jsonb_build_object('stato', 'ok', 'nome', v_nome);
    end if;
    return jsonb_build_object('stato', 'gia-usato');
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

  insert into public.inviti_usati (invitato_id, owner_id) values (v_me, v_owner) on conflict do nothing;
  insert into public.follows (follower_id, followed_id) values (v_me, v_owner), (v_owner, v_me)
  on conflict do nothing;
  select nullif(trim(display_name), '') into v_nome from public.profiles where id = v_owner;
  return jsonb_build_object('stato', 'ok', 'nome', v_nome);
end;
$$;
