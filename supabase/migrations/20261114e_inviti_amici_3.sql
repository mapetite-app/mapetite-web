-- Inviti tra amici, terza revisione (14/11 notte, revisore indipendente). Solo funzioni e permessi:
-- nessuna tabella cambia, nessun dato viene cancellato o riscritto.
-- - Chi è stato tolto dagli amici non torna amico da solo riaprendo lo stesso link: la coppia
--   (in un senso o nell'altro) già in inviti_usati e non più amica risponde 'gia-usato'.
-- - "Nuovo link" (nuovo_invito): un codice nuovo, il vecchio smette di funzionare (link girato troppo).
-- - Il tetto di 30 amicizie da invito vale anche per chi invita, sotto un lucchetto per persona
--   (pg_advisory_xact_lock), così due accettazioni insieme non lo superano.
-- - Nome obbligatorio anche qui: senza nome si risponde 'nome' (chi invita deve sapere chi ha accettato).
-- - Rubrica: solo impronte SHA-256 vere (64 cifre esadecimali), il resto si rifiuta.
-- - search_path vuoto e nomi completi in tutte le funzioni toccate.

create or replace function public.mio_invito()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  v_codice text;
begin
  if v_me is null then return null; end if;
  if not exists (select 1 from public.profiles where id = v_me and nullif(trim(display_name), '') is not null) then
    return null; -- prima il nome (la pagina d'invito deve dire chi invita)
  end if;
  select codice into v_codice from public.inviti where owner_id = v_me;
  if v_codice is null then
    v_codice := 'i-' || encode(extensions.gen_random_bytes(6), 'hex');
    insert into public.inviti (codice, owner_id) values (v_codice, v_me)
    on conflict (owner_id) do nothing;
    select codice into v_codice from public.inviti where owner_id = v_me;
  end if;
  return v_codice;
end;
$$;

-- "Nuovo link": cambia il codice; il link di prima porta a "invito non valido".
create or replace function public.nuovo_invito()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  v_codice text;
begin
  if v_me is null then return null; end if;
  if not exists (select 1 from public.profiles where id = v_me and nullif(trim(display_name), '') is not null) then
    return null;
  end if;
  v_codice := 'i-' || encode(extensions.gen_random_bytes(6), 'hex');
  insert into public.inviti (codice, owner_id) values (v_codice, v_me)
  on conflict (owner_id) do update set codice = excluded.codice, created_at = now();
  return v_codice;
end;
$$;

create or replace function public.anteprima_invito(p_codice text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'nome', nullif(trim(p.display_name), ''),
    'handle', case when p.is_public then p.handle end
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

  -- Massimo 30 amicizie da invito per persona, sia per chi accetta sia per chi invita.
  if (select count(*) from public.inviti_usati where invitato_id = v_me or owner_id = v_me) >= 30
     or (select count(*) from public.inviti_usati where invitato_id = v_owner or owner_id = v_owner) >= 30 then
    return jsonb_build_object('stato', 'troppi');
  end if;

  insert into public.inviti_usati (invitato_id, owner_id) values (v_me, v_owner) on conflict do nothing;
  insert into public.follows (follower_id, followed_id) values (v_me, v_owner), (v_owner, v_me)
  on conflict do nothing;
  select nullif(trim(display_name), '') into v_nome from public.profiles where id = v_owner;
  return jsonb_build_object('stato', 'ok', 'nome', v_nome);
end;
$$;

create or replace function public.togli_amico(p_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.follows
  where auth.uid() is not null
    and ((follower_id = auth.uid() and followed_id = p_id) or (follower_id = p_id and followed_id = auth.uid()));
$$;

create or replace function public.miei_amici()
returns table (id uuid, display_name text, handle text, is_public boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, nullif(trim(p.display_name), ''), case when p.is_public then p.handle end, p.is_public and p.handle is not null
  from public.follows a
  join public.follows b on b.follower_id = a.followed_id and b.followed_id = a.follower_id
  join public.profiles p on p.id = a.followed_id
  where a.follower_id = auth.uid()
  order by a.created_at desc
  limit 100;
$$;

create or replace function public.trova_da_contatti(p_hash text[])
returns table (id uuid, handle text, display_name text, city text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  v_n int;
begin
  if v_me is null or coalesce(array_length(p_hash, 1), 0) not between 1 and 200 then return; end if;
  -- Solo impronte SHA-256 (64 cifre esadecimali minuscole): niente email in chiaro né altro.
  if exists (select 1 from unnest(p_hash) h where h is null or h !~ '^[0-9a-f]{64}$') then return; end if;
  insert into public.contatti_ricerche (user_id, giorno, n) values (v_me, current_date, 1)
  on conflict (user_id, giorno) do update set n = public.contatti_ricerche.n + 1
  returning n into v_n;
  if v_n > 3 then raise exception 'troppe ricerche oggi' using errcode = 'P0001'; end if;
  return query
    select p.id, p.handle, p.display_name, p.city
    from public.profili_pubblici p
    join auth.users u on u.id = p.id
    where p.id <> v_me
      and encode(pg_catalog.sha256(convert_to(lower(trim(u.email)), 'UTF8')), 'hex') = any (p_hash)
    limit 50;
end;
$$;

revoke all on function public.nuovo_invito() from public, anon;
grant execute on function public.nuovo_invito() to authenticated;
revoke all on function public.mio_invito() from public, anon;
revoke all on function public.accetta_invito(text) from public, anon;
revoke all on function public.togli_amico(uuid) from public, anon;
revoke all on function public.miei_amici() from public, anon;
revoke all on function public.trova_da_contatti(text[]) from public, anon;
revoke all on function public.anteprima_invito(text) from public;
grant execute on function public.mio_invito() to authenticated;
grant execute on function public.accetta_invito(text) to authenticated;
grant execute on function public.togli_amico(uuid) to authenticated;
grant execute on function public.miei_amici() to authenticated;
grant execute on function public.trova_da_contatti(text[]) to authenticated;
grant execute on function public.anteprima_invito(text) to anon, authenticated;
