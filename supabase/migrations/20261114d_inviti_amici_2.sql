-- Inviti tra amici, seconda revisione (14/11 sera, secondo revisore separato).
-- - Valgono anche per chi ha già un account (prima solo nei primi 7 giorni: i 7 utenti di oggi restavano fuori):
--   ogni coppia una volta sola, massimo 30 amicizie da invito per account (freno contro i link inoltrati).
-- - Il codice nasce solo se chi invita ha un nome: chi riceve il link deve sapere chi è.
-- - "Togli dagli amici": toglie i due "segui" tra due persone (prima chi invitava non poteva farlo).

alter table public.inviti_usati drop constraint if exists inviti_usati_pkey;
alter table public.inviti_usati add primary key (invitato_id, owner_id);

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
  if not exists (select 1 from profiles where id = v_me and nullif(trim(display_name), '') is not null) then
    return null; -- prima il nome (la pagina d'invito deve dire chi invita)
  end if;
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

create or replace function public.accetta_invito(p_codice text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_owner uuid;
  v_nome text;
begin
  if v_me is null then return jsonb_build_object('stato', 'anonimo'); end if;
  select owner_id into v_owner from inviti where codice = lower(trim(p_codice));
  if v_owner is null then return jsonb_build_object('stato', 'non-trovato'); end if;
  if v_owner = v_me then return jsonb_build_object('stato', 'se-stesso'); end if;
  if not exists (select 1 from inviti_usati where invitato_id = v_me and owner_id = v_owner)
     and (select count(*) from inviti_usati where invitato_id = v_me or owner_id = v_me) >= 30 then
    return jsonb_build_object('stato', 'troppi');
  end if;
  insert into inviti_usati (invitato_id, owner_id) values (v_me, v_owner) on conflict do nothing;
  insert into follows (follower_id, followed_id) values (v_me, v_owner), (v_owner, v_me)
  on conflict do nothing;
  select nullif(trim(display_name), '') into v_nome from profiles where id = v_owner;
  return jsonb_build_object('stato', 'ok', 'nome', v_nome);
end;
$$;

create or replace function public.togli_amico(p_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  delete from follows
  where auth.uid() is not null
    and ((follower_id = auth.uid() and followed_id = p_id) or (follower_id = p_id and followed_id = auth.uid()));
$$;

revoke all on function public.togli_amico(uuid) from public, anon;
grant execute on function public.togli_amico(uuid) to authenticated;
