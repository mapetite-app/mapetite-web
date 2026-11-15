-- "Togli dagli amici" anche per chi era amico senza invito (revisore 15/11, bloccante): due profili pubblici che si
-- seguivano a vicenda non avevano una riga in inviti_usati, quindi dopo "Togli" il vecchio link di chi aveva tolto
-- rifaceva amici senza un nuovo sì. Ora "Togli" registra sempre la coppia con chi ha tolto e quando: valgono le
-- stesse regole degli amici da invito (si torna solo con un link NUOVO di chi ha tolto).
-- Solo la funzione: nessun dato cancellato o riscritto.

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
    if not found then
      insert into public.inviti_usati (invitato_id, owner_id, tolto_da, tolto_at) values (p_id, v_me, v_me, now())
      on conflict (invitato_id, owner_id) do update set tolto_da = excluded.tolto_da, tolto_at = excluded.tolto_at;
    end if;
  end if;
end;
$$;

revoke all on function public.togli_amico(uuid) from public, anon;
grant execute on function public.togli_amico(uuid) to authenticated;
