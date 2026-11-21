-- Proposta 56, minore del revisore (21/11 sera): la pulizia dei voti dopo 30 giorni girava solo quando
-- qualcuno creava un voto nuovo. Ora anche ogni notte alle 04:17 UTC con pg_cron (estensione di Supabase,
-- gratuita). Cancella solo voti di gruppo con più di 30 giorni (i voti dei singoli vanno con il sondaggio).
-- Idempotente: il job si ricrea con lo stesso nome.

create extension if not exists pg_cron;

select cron.unschedule(jobid) from cron.job where jobname = 'voti_gruppo_30gg';
select cron.schedule('voti_gruppo_30gg', '17 4 * * *', $$delete from public.voti_gruppo where created_at < now() - interval '30 days'$$);
