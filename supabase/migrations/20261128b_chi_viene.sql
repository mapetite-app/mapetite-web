-- Proposta 94 "Chi viene?" (28/11/2026): a voto chiuso chi l'ha proposto dice quando e per quanti ha
-- prenotato il posto vincitore; lo stesso link chiede a tutti "Ci sei? Sì / No" (basta il nome, senza
-- account, come il voto). Chi organizza vede quanti ci sono, quanti no e quanti non hanno risposto, e se
-- il numero cambia ha il messaggio pronto per il locale.
--
-- Cosa si salva: sul sondaggio l'ora del tavolo, il numero di persone e l'UUID del posto (catalogo
-- "places"); per ogni telefono il nome scritto e sì/no. Niente dati Google. Tutto se ne va con il
-- sondaggio dopo 30 giorni (on delete cascade, pulizia già attiva da 20261121d/e).
--
-- Accesso: come voti_gruppo, RLS accesa SENZA policy e tabella revocata ad anon e authenticated; scrive
-- e legge solo il server con la chiave di servizio. Funzioni atomiche (lucchetto sulla riga del voto).
-- Idempotente. Nessun dato esistente toccato (solo 3 colonne nuove, vuote, e una tabella nuova).

alter table public.voti_gruppo add column if not exists tavolo_posto uuid;
alter table public.voti_gruppo add column if not exists tavolo_alle timestamptz;
alter table public.voti_gruppo add column if not exists tavolo_persone smallint;
do $$ begin
  alter table public.voti_gruppo add constraint voti_gruppo_tavolo_persone check (tavolo_persone is null or tavolo_persone between 2 and 30);
exception when duplicate_object then null; end $$;

create table if not exists public.voti_gruppo_presenze (
  voto_id     uuid not null references public.voti_gruppo (id) on delete cascade,
  votante     text not null,
  nome        text not null,
  ci_sono     boolean not null,
  updated_at  timestamptz not null default now(),
  primary key (voto_id, votante),
  constraint voti_gruppo_presenze_votante check (votante ~ '^[A-Za-z0-9_-]{16,64}$'),
  constraint voti_gruppo_presenze_nome check (char_length(btrim(nome)) between 1 and 30)
);
alter table public.voti_gruppo_presenze enable row level security;
revoke all on public.voti_gruppo_presenze from anon, authenticated;

-- Il tavolo prenotato. Esiti: 'ok', 'nessuno', 'tuo' (non l'hai proposto tu), 'aperto' (si vota ancora),
-- 'posto' (non è nel voto), 'quando' (ora già passata da più di un'ora o oltre 21 giorni dal voto).
create or replace function public.segna_tavolo_gruppo(p_utente uuid, p_codice text, p_posto uuid, p_alle timestamptz, p_persone int)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.voti_gruppo%rowtype;
begin
  select * into v from public.voti_gruppo where codice = p_codice for update;
  if not found or v.created_at < now() - interval '30 days' then return 'nessuno'; end if;
  if v.creato_da <> p_utente then return 'tuo'; end if;
  if v.chiude_alle > now() then return 'aperto'; end if;
  if not (p_posto = any (v.posti)) then return 'posto'; end if;
  if p_alle < now() - interval '1 hour' or p_alle > v.created_at + interval '21 days' then return 'quando'; end if;
  if p_persone < 2 or p_persone > 30 then return 'quando'; end if;
  update public.voti_gruppo set tavolo_posto = p_posto, tavolo_alle = p_alle, tavolo_persone = p_persone where id = v.id;
  return 'ok';
end $$;

-- "Ci sei?" di un telefono (si può cambiare). Esiti: 'ok', 'nessuno', 'senza' (nessun tavolo ancora),
-- 'passato' (il tavolo è di più di 3 ore fa), 'pieno' (già p_tetto telefoni diversi).
create or replace function public.presenza_gruppo(p_codice text, p_votante text, p_nome text, p_ci_sono boolean, p_tetto int)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.voti_gruppo%rowtype;
  n int;
begin
  select * into v from public.voti_gruppo where codice = p_codice for update;
  if not found or v.created_at < now() - interval '30 days' then return 'nessuno'; end if;
  if v.tavolo_alle is null then return 'senza'; end if;
  if v.tavolo_alle < now() - interval '3 hours' then return 'passato'; end if;
  if not exists (select 1 from public.voti_gruppo_presenze where voto_id = v.id and votante = p_votante) then
    select count(*) into n from public.voti_gruppo_presenze where voto_id = v.id;
    if n >= p_tetto then return 'pieno'; end if;
  end if;
  insert into public.voti_gruppo_presenze (voto_id, votante, nome, ci_sono)
    values (v.id, p_votante, btrim(p_nome), p_ci_sono)
    on conflict (voto_id, votante) do update set nome = excluded.nome, ci_sono = excluded.ci_sono, updated_at = now();
  return 'ok';
end $$;

revoke all on function public.segna_tavolo_gruppo(uuid, text, uuid, timestamptz, int) from public, anon, authenticated;
revoke all on function public.presenza_gruppo(text, text, text, boolean, int) from public, anon, authenticated;
grant execute on function public.segna_tavolo_gruppo(uuid, text, uuid, timestamptz, int) to service_role;
grant execute on function public.presenza_gruppo(text, text, text, boolean, int) to service_role;
