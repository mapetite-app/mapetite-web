-- Proposta 56 "Manda al gruppo" (21/11/2026): dai "Scegli tra 3" un link pubblico per votare dove andare.
-- Chi lo apre, senza account, scrive un nome e vota con un tocco; il voto si chiude all'ora scelta.
--
-- Cosa si salva (termini Google 3.2.3(b) "No Caching"): solo gli UUID dei locali del catalogo "places"
-- (che l'app già tiene per i salvati, con il Place ID), l'ora di chiusura, il nome scritto da chi vota e
-- un id casuale del telefono (cookie). Niente foto, recensioni, indirizzi o verdetti copiati qui: la pagina
-- li legge dal catalogo e da place_synthesis come la pagina pubblica del locale; la foto viaggia nel link.
--
-- Accesso: RLS accesa SENZA policy e tabelle revocate ad anon e authenticated. Scrive e legge solo il
-- server con la chiave di servizio (/api/voto, /voto/<codice>), come segnalazioni e prove_reel: così i
-- tetti (10 sondaggi al giorno per persona, 30 votanti per sondaggio) non si aggirano dal browser.
-- Le due funzioni sono atomiche (lucchetto di transazione) e solo service_role le può chiamare.
-- DA APPLICARE A MANO (coordinatore). Idempotente. Nessun dato esistente toccato.

create table if not exists public.voti_gruppo (
  id          uuid primary key default gen_random_uuid(),
  codice      text not null,
  creato_da   uuid not null references auth.users (id) on delete cascade,
  posti       uuid[] not null,
  chiude_alle timestamptz not null,
  created_at  timestamptz not null default now(),
  constraint voti_gruppo_codice_format check (codice ~ '^[A-Za-z0-9]{16,32}$'),
  constraint voti_gruppo_posti_n check (array_length(posti, 1) between 2 and 3),
  constraint voti_gruppo_chiusura check (chiude_alle > created_at and chiude_alle <= created_at + interval '2 days')
);
create unique index if not exists voti_gruppo_codice_key on public.voti_gruppo (codice);
create index if not exists voti_gruppo_creato_idx on public.voti_gruppo (creato_da, created_at desc);

create table if not exists public.voti_gruppo_voti (
  voto_id     uuid not null references public.voti_gruppo (id) on delete cascade,
  votante     text not null,
  nome        text not null,
  posto       uuid not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (voto_id, votante),
  constraint voti_gruppo_voti_votante check (votante ~ '^[A-Za-z0-9_-]{16,64}$'),
  constraint voti_gruppo_voti_nome check (char_length(btrim(nome)) between 1 and 30)
);

alter table public.voti_gruppo enable row level security;
alter table public.voti_gruppo_voti enable row level security;
revoke all on public.voti_gruppo, public.voti_gruppo_voti from anon, authenticated;

-- Nuovo sondaggio: al massimo p_tetto nelle ultime 24 ore per persona (lucchetto per persona: due
-- richieste insieme non superano il tetto). Ritorna l'id, oppure null se il tetto è raggiunto.
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

-- Un voto (o il cambio di voto) di un telefono. Esiti: 'ok', 'nessuno' (codice inesistente), 'chiuso',
-- 'posto' (non è uno dei posti), 'pieno' (già p_tetto votanti diversi). Il lucchetto sulla riga del
-- sondaggio mette in fila i voti, così il tetto dei votanti regge.
create or replace function public.vota_gruppo(p_codice text, p_votante text, p_nome text, p_posto uuid, p_tetto int)
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
  if not found then return 'nessuno'; end if;
  if v.chiude_alle <= now() then return 'chiuso'; end if;
  if not (p_posto = any (v.posti)) then return 'posto'; end if;
  if not exists (select 1 from public.voti_gruppo_voti where voto_id = v.id and votante = p_votante) then
    select count(*) into n from public.voti_gruppo_voti where voto_id = v.id;
    if n >= p_tetto then return 'pieno'; end if;
  end if;
  insert into public.voti_gruppo_voti (voto_id, votante, nome, posto)
    values (v.id, p_votante, btrim(p_nome), p_posto)
    on conflict (voto_id, votante) do update set nome = excluded.nome, posto = excluded.posto, updated_at = now();
  return 'ok';
end $$;

revoke all on function public.crea_voto_gruppo(uuid, text, uuid[], timestamptz, int) from public, anon, authenticated;
revoke all on function public.vota_gruppo(text, text, text, uuid, int) from public, anon, authenticated;
grant execute on function public.crea_voto_gruppo(uuid, text, uuid[], timestamptz, int) to service_role;
grant execute on function public.vota_gruppo(text, text, text, uuid, int) to service_role;
