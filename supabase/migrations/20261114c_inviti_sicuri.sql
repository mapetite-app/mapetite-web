-- Inviti tra amici rifatti dopo la revisione indipendente del 14/11 (sera). La prima versione
-- (20261114_invito_amici) collegava chiunque conoscesse un @nome, in automatico e senza un "sì".
-- Il permesso di eseguirla è stato tolto in produzione alle 19:15, con 0 follow creati.
--
-- Ora:
-- - ogni persona ha un codice d'invito casuale e segreto ("i-" + 12 cifre esadecimali, 48 bit),
--   che esiste solo nel link che manda lei (tabella inviti);
-- - chi arriva dal link vede il nome di chi invita e sceglie "Diventa amico" oppure "Non ora";
-- - un solo invito accettato per account, e solo nei primi 7 giorni dalla registrazione;
-- - gli amici (si seguono a vicenda) si vedono per nome in Amici anche con il profilo privato:
--   solo il nome, mai i posti (quelli restano decisi da "Profilo pubblico").
-- - "Trova amici dalla rubrica": al massimo 200 impronte per volta e 3 ricerche al giorno.

drop function if exists public.collega_invito(text);

create table if not exists public.inviti (
  codice     text primary key check (codice ~ '^i-[0-9a-f]{12}$'),
  owner_id   uuid not null unique references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.inviti enable row level security; -- nessuna policy: solo dalle funzioni qui sotto

create table if not exists public.inviti_usati (
  invitato_id uuid primary key references auth.users (id) on delete cascade,
  owner_id    uuid not null references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now()
);
alter table public.inviti_usati enable row level security;

-- Il mio codice (creato la prima volta).
create or replace function public.mio_invito()
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_me uuid := auth.uid();
  v_codice text;
begin
  if v_me is null then return null; end if;
  select codice into v_codice from inviti where owner_id = v_me;
  if v_codice is null then
    v_codice := 'i-' || encode(extensions.gen_random_bytes(6), 'hex');
    insert into inviti (codice, owner_id) values (v_codice, v_me)
    on conflict (owner_id) do nothing;
    select codice into v_codice from inviti where owner_id = v_me;
  end if;
  return v_codice;
end;
$$;

-- Anteprima per la pagina d'arrivo e il primo accesso: solo il nome scelto da chi invita
-- (che ha mandato lui il link), il @nome solo se il profilo è pubblico.
create or replace function public.anteprima_invito(p_codice text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'nome', nullif(trim(p.display_name), ''),
    'handle', case when p.is_public then p.handle end
  )
  from inviti i join profiles p on p.id = i.owner_id
  where i.codice = lower(trim(p_codice));
$$;

-- "Diventa amico": un solo invito per account, nei primi 7 giorni, mai se stessi.
create or replace function public.accetta_invito(p_codice text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_owner uuid;
  v_creato timestamptz;
  v_nome text;
begin
  if v_me is null then return jsonb_build_object('stato', 'anonimo'); end if;
  select owner_id into v_owner from inviti where codice = lower(trim(p_codice));
  if v_owner is null then return jsonb_build_object('stato', 'non-trovato'); end if;
  if v_owner = v_me then return jsonb_build_object('stato', 'se-stesso'); end if;
  select created_at into v_creato from auth.users where id = v_me;
  if v_creato is null or v_creato < now() - interval '7 days' then
    return jsonb_build_object('stato', 'vecchio');
  end if;
  insert into inviti_usati (invitato_id, owner_id) values (v_me, v_owner)
  on conflict (invitato_id) do nothing;
  if not found then
    if not exists (select 1 from inviti_usati where invitato_id = v_me and owner_id = v_owner) then
      return jsonb_build_object('stato', 'gia-usato');
    end if;
  end if;
  insert into follows (follower_id, followed_id) values (v_me, v_owner), (v_owner, v_me)
  on conflict do nothing;
  select nullif(trim(display_name), '') into v_nome from profiles where id = v_owner;
  return jsonb_build_object('stato', 'ok', 'nome', v_nome);
end;
$$;

-- I miei amici (ci seguiamo a vicenda): nome sempre, @nome solo se pubblico.
create or replace function public.miei_amici()
returns table (id uuid, display_name text, handle text, is_public boolean)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, nullif(trim(p.display_name), ''), case when p.is_public then p.handle end, p.is_public and p.handle is not null
  from follows a
  join follows b on b.follower_id = a.followed_id and b.followed_id = a.follower_id
  join profiles p on p.id = a.followed_id
  where a.follower_id = auth.uid()
  order by a.created_at desc
  limit 100;
$$;

-- Rubrica: tetto di 200 impronte e 3 ricerche al giorno per persona.
create table if not exists public.contatti_ricerche (
  user_id uuid not null references auth.users (id) on delete cascade,
  giorno  date not null default current_date,
  n       int  not null default 0,
  primary key (user_id, giorno)
);
alter table public.contatti_ricerche enable row level security;

drop function if exists public.trova_da_contatti(text[]);
create or replace function public.trova_da_contatti(p_hash text[])
returns table (id uuid, handle text, display_name text, city text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_n int;
begin
  if v_me is null or coalesce(array_length(p_hash, 1), 0) not between 1 and 200 then return; end if;
  insert into contatti_ricerche (user_id, giorno, n) values (v_me, current_date, 1)
  on conflict (user_id, giorno) do update set n = contatti_ricerche.n + 1
  returning n into v_n;
  if v_n > 3 then raise exception 'troppe ricerche oggi' using errcode = 'P0001'; end if;
  return query
    select p.id, p.handle, p.display_name, p.city
    from profili_pubblici p
    join auth.users u on u.id = p.id
    where p.id <> v_me
      and encode(sha256(convert_to(lower(trim(u.email)), 'UTF8')), 'hex') = any (p_hash)
    limit 50;
end;
$$;

revoke all on function public.mio_invito() from public, anon;
revoke all on function public.accetta_invito(text) from public, anon;
revoke all on function public.miei_amici() from public, anon;
revoke all on function public.trova_da_contatti(text[]) from public, anon;
revoke all on function public.anteprima_invito(text) from public;
grant execute on function public.mio_invito() to authenticated;
grant execute on function public.accetta_invito(text) to authenticated;
grant execute on function public.miei_amici() to authenticated;
grant execute on function public.trova_da_contatti(text[]) to authenticated;
grant execute on function public.anteprima_invito(text) to anon, authenticated;
