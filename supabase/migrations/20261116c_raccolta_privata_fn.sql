-- Lucchetto sulla raccolta (16/11 notte, revisore): aggiungere o togliere UN nome alla volta, in modo atomico.
-- Prima il telefono leggeva e riscriveva tutto l'elenco: con due schede aperte una scrittura poteva cancellare
-- l'altra e far tornare pubblica una raccolta. Solo sulla propria riga (auth.uid()), RLS valida comunque.
create or replace function public.raccolta_privata(p_nome text, p_on boolean) returns text[]
language plpgsql
security invoker
set search_path = ''
as $$
declare
  risultato text[];
begin
  -- Revisore 16/11: mai i nomi degli stati (nasconderebbero tutti i visitati o i da provare).
  if p_nome is null or btrim(p_nome) = '' or char_length(p_nome) > 40
     or p_nome in ('Già visitato', 'Da provare', 'Non fa per me', 'Mi è piaciuto') then
    raise exception 'nome_non_valido' using errcode = 'P0001';
  end if;
  update public.profiles
     set raccolte_private = case
           when p_on then (case when p_nome = any (raccolte_private) then raccolte_private else array_append(raccolte_private, p_nome) end)
           else array_remove(raccolte_private, p_nome)
         end
   where id = auth.uid()
  returning raccolte_private into risultato;
  return risultato;
end $$;

revoke all on function public.raccolta_privata(text, boolean) from public, anon;
grant execute on function public.raccolta_privata(text, boolean) to authenticated;
