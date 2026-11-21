-- Proposta 75 "Provalo senza account": tetto delle prove anonime (ognuna può costare 1 ricerca Google).
-- Tabella a parte (non events, dove anche il telefono scrive) e una funzione che prenota la prova in modo
-- atomico: un lucchetto di transazione mette in fila le richieste, la riga si scrive, poi si contano quelle
-- del giorno di Roma. Solo il server (chiave di servizio) la chiama: RLS accesa senza policy, funzione
-- revocata ad anon e authenticated. Nessun dato personale: solo l'istante.
create table if not exists public.prove_reel (
  id bigserial primary key,
  created_at timestamptz not null default now()
);
alter table public.prove_reel enable row level security;

create or replace function public.prenota_prova_reel(tetto int) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  n int;
begin
  perform pg_advisory_xact_lock(7505);
  select count(*) into n from public.prove_reel
  where created_at >= ((now() at time zone 'Europe/Rome')::date::timestamp at time zone 'Europe/Rome');
  if n >= tetto then
    return false;
  end if;
  insert into public.prove_reel default values;
  return true;
end $$;

revoke all on function public.prenota_prova_reel(int) from public, anon, authenticated;
grant execute on function public.prenota_prova_reel(int) to service_role;
