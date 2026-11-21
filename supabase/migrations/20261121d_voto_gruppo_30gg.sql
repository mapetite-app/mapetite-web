-- Proposta 56, minori (21/11/2026 sera): i voti di gruppo si cancellano dopo 30 giorni (minimizzazione GDPR).
-- I nomi scritti da chi vota e l'id casuale del telefono non servono più a nulla a voto chiuso da settimane.
-- La pulizia gira dentro crea_voto_gruppo (ogni volta che qualcuno crea un voto nuovo, niente cron da
-- accendere); il server intanto tratta come "non c'è più" ogni voto più vecchio di 30 giorni, anche se la
-- riga non è ancora stata tolta. I voti (voti_gruppo_voti) se ne vanno con il sondaggio (on delete cascade).
-- Idempotente. Cancella solo righe di voti con più di 30 giorni (nessun dato dei salvati o degli account).

create index if not exists voti_gruppo_created_idx on public.voti_gruppo (created_at);

create or replace function public.crea_voto_gruppo(p_utente uuid, p_codice text, p_posti uuid[], p_chiude timestamptz, p_tetto int)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  n int;
  v_id uuid;
begin
  delete from public.voti_gruppo where created_at < now() - interval '30 days';
  perform pg_advisory_xact_lock(5656, hashtext(p_utente::text));
  select count(*) into n from public.voti_gruppo
  where creato_da = p_utente and created_at >= now() - interval '24 hours';
  if n >= p_tetto then
    return null;
  end if;
  insert into public.voti_gruppo (codice, creato_da, posti, chiude_alle)
    values (p_codice, p_utente, p_posti, p_chiude)
    returning id into v_id;
  return v_id;
end $$;

revoke all on function public.crea_voto_gruppo(uuid, text, uuid[], timestamptz, int) from public, anon, authenticated;
grant execute on function public.crea_voto_gruppo(uuid, text, uuid[], timestamptz, int) to service_role;
