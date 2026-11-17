-- Lucchetto sulla raccolta (revisore 16/11, difetto minore 4): dopo rinomina, unisci o elimina il telefono contava i
-- posti con il nome vecchio e POI toglieva il nome dall'elenco dei privati, in due richieste. Se nel frattempo un
-- altro telefono metteva un posto nella raccolta col nome vecchio, quel posto diventava visibile agli amici.
-- Qui il controllo e la scrittura sono una sola istruzione: il nome esce dall'elenco solo se ADESSO nessun proprio
-- salvato ha quel tag. Solo sulla propria riga (auth.uid()), RLS valida comunque.
-- Solo una funzione nuova, nessun dato toccato. Idempotente. Ritorna true se il nome non è (più) nell'elenco.
create or replace function public.raccolta_privata_se_vuota(p_nome text) returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  ancora boolean;
begin
  if p_nome is null or btrim(p_nome) = '' then
    raise exception 'nome_non_valido' using errcode = 'P0001';
  end if;
  update public.profiles p
     set raccolte_private = array_remove(p.raccolte_private, p_nome)
   where p.id = auth.uid()
     and p_nome = any (p.raccolte_private)
     and not exists (
       select 1 from public.saved_places s
        where s.user_id = auth.uid() and p_nome = any (coalesce(s.tags, '{}'))
     );
  select p_nome = any (p.raccolte_private) into ancora from public.profiles p where p.id = auth.uid();
  return not coalesce(ancora, false);
end $$;

revoke all on function public.raccolta_privata_se_vuota(text) from public, anon;
grant execute on function public.raccolta_privata_se_vuota(text) to authenticated;
