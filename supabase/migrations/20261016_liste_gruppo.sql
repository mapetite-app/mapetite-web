-- Migration: liste di gruppo (piano 5.5) — "Cene del giovedì" con gli amici.
-- Chi è nella lista aggiunge posti (dai propri salvati o dalla scheda di un locale), ognuno mette
-- 👍 ai posti che preferisce e il più votato sale in cima. Si entra solo con il link d'invito.
-- DA APPLICARE A MANO (coordinatore / Lorenzo). Finché non è applicata l'app funziona uguale:
-- /gruppi e /gruppi/<id> mostrano lo stato "in arrivo".
-- Idempotente: sicura da ri-eseguire. Nessun dato esistente viene cancellato o riscritto.
--
-- Privacy:
--   - legge e scrive SOLO chi è membro della lista (RLS su tutte e quattro le tabelle);
--   - il nome con cui si compare nella lista lo sceglie la persona entrando (gruppi_membri.nome):
--     nessuna lettura dei profili altrui, nessuna email;
--   - dei locali si leggono solo i campi già pubblici dell'app (nome, tipo, indirizzo,
--     coordinate, place id), nessun contenuto Google in più;
--   - le note private dei salvati non c'entrano: la lista ha i suoi posti, separati da saved_places.

-- ── 1. Tabelle ───────────────────────────────────────────────────────────────
create table if not exists public.gruppi (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  emoji       text not null default '🍽️',
  codice      text not null,
  creato_da   uuid not null references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  constraint gruppi_nome_len check (char_length(btrim(nome)) between 1 and 60),
  constraint gruppi_emoji_len check (char_length(emoji) between 1 and 8),
  constraint gruppi_codice_format check (codice ~ '^[a-z0-9]{8,16}$')
);
create unique index if not exists gruppi_codice_key on public.gruppi (codice);

create table if not exists public.gruppi_membri (
  gruppo_id   uuid not null references public.gruppi (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  nome        text not null default 'Amico',
  created_at  timestamptz not null default now(),
  primary key (gruppo_id, user_id),
  constraint gruppi_membri_nome_len check (char_length(btrim(nome)) between 1 and 40)
);
create index if not exists gruppi_membri_user_idx on public.gruppi_membri (user_id);

create table if not exists public.gruppi_posti (
  id          uuid primary key default gen_random_uuid(),
  gruppo_id   uuid not null references public.gruppi (id) on delete cascade,
  place_id    uuid not null references public.places (id) on delete cascade,
  aggiunto_da uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (gruppo_id, place_id)
);
create index if not exists gruppi_posti_gruppo_idx on public.gruppi_posti (gruppo_id);

create table if not exists public.gruppi_voti (
  posto_id    uuid not null references public.gruppi_posti (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (posto_id, user_id)
);

alter table public.gruppi        enable row level security;
alter table public.gruppi_membri enable row level security;
alter table public.gruppi_posti  enable row level security;
alter table public.gruppi_voti   enable row level security;

-- ── 2. Chi è membro (usata dalle policy: security definer per non ricorrere su gruppi_membri) ──
create or replace function public.membro_gruppo(g uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.gruppi_membri m where m.gruppo_id = g and m.user_id = auth.uid());
$$;
revoke all on function public.membro_gruppo(uuid) from public, anon;
grant execute on function public.membro_gruppo(uuid) to authenticated;

-- ── 3. Policy: solo i membri ─────────────────────────────────────────────────
do $$
begin
  -- gruppi: si legge solo se membri; si crea e si rinomina passando dalle funzioni sotto
  -- (crea_gruppo), il creatore può rinominare o eliminare.
  if not exists (select 1 from pg_policies where tablename = 'gruppi' and policyname = 'gruppi_select_membri') then
    create policy gruppi_select_membri on public.gruppi for select to authenticated
      using (public.membro_gruppo(id));
  end if;
  if not exists (select 1 from pg_policies where tablename = 'gruppi' and policyname = 'gruppi_update_creatore') then
    create policy gruppi_update_creatore on public.gruppi for update to authenticated
      using (auth.uid() = creato_da) with check (auth.uid() = creato_da);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'gruppi' and policyname = 'gruppi_delete_creatore') then
    create policy gruppi_delete_creatore on public.gruppi for delete to authenticated
      using (auth.uid() = creato_da);
  end if;

  -- membri: si vedono gli altri membri della stessa lista; si esce da soli; ci si rinomina da soli.
  -- Si entra solo con il codice (entra_gruppo), mai con un insert diretto.
  if not exists (select 1 from pg_policies where tablename = 'gruppi_membri' and policyname = 'gruppi_membri_select') then
    create policy gruppi_membri_select on public.gruppi_membri for select to authenticated
      using (public.membro_gruppo(gruppo_id));
  end if;
  if not exists (select 1 from pg_policies where tablename = 'gruppi_membri' and policyname = 'gruppi_membri_update_own') then
    create policy gruppi_membri_update_own on public.gruppi_membri for update to authenticated
      using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'gruppi_membri' and policyname = 'gruppi_membri_delete_own') then
    create policy gruppi_membri_delete_own on public.gruppi_membri for delete to authenticated
      using (auth.uid() = user_id);
  end if;

  -- posti: li vedono i membri; un membro aggiunge a proprio nome; toglie chi l'ha aggiunto.
  if not exists (select 1 from pg_policies where tablename = 'gruppi_posti' and policyname = 'gruppi_posti_select') then
    create policy gruppi_posti_select on public.gruppi_posti for select to authenticated
      using (public.membro_gruppo(gruppo_id));
  end if;
  if not exists (select 1 from pg_policies where tablename = 'gruppi_posti' and policyname = 'gruppi_posti_insert') then
    create policy gruppi_posti_insert on public.gruppi_posti for insert to authenticated
      with check (auth.uid() = aggiunto_da and public.membro_gruppo(gruppo_id));
  end if;
  if not exists (select 1 from pg_policies where tablename = 'gruppi_posti' and policyname = 'gruppi_posti_delete') then
    create policy gruppi_posti_delete on public.gruppi_posti for delete to authenticated
      using (auth.uid() = aggiunto_da and public.membro_gruppo(gruppo_id));
  end if;

  -- voti: li vedono i membri; si vota e si toglie il voto solo a proprio nome, solo nelle proprie liste.
  if not exists (select 1 from pg_policies where tablename = 'gruppi_voti' and policyname = 'gruppi_voti_select') then
    create policy gruppi_voti_select on public.gruppi_voti for select to authenticated
      using (exists (select 1 from public.gruppi_posti p where p.id = posto_id and public.membro_gruppo(p.gruppo_id)));
  end if;
  if not exists (select 1 from pg_policies where tablename = 'gruppi_voti' and policyname = 'gruppi_voti_insert') then
    create policy gruppi_voti_insert on public.gruppi_voti for insert to authenticated
      with check (
        auth.uid() = user_id
        and exists (select 1 from public.gruppi_posti p where p.id = posto_id and public.membro_gruppo(p.gruppo_id))
      );
  end if;
  if not exists (select 1 from pg_policies where tablename = 'gruppi_voti' and policyname = 'gruppi_voti_delete') then
    create policy gruppi_voti_delete on public.gruppi_voti for delete to authenticated
      using (auth.uid() = user_id);
  end if;
end $$;

grant select, update, delete on public.gruppi to authenticated;
grant select, update, delete on public.gruppi_membri to authenticated;
grant select, insert, delete on public.gruppi_posti to authenticated;
grant select, insert, delete on public.gruppi_voti to authenticated;
revoke all on public.gruppi, public.gruppi_membri, public.gruppi_posti, public.gruppi_voti from anon;

-- ── 4. Funzioni (security definer, controllano da sole chi chiama) ──────────────

-- Nuova lista: crea la lista con un codice d'invito casuale e mette dentro chi la crea.
create or replace function public.crea_gruppo(p_nome text, p_emoji text, p_mio_nome text)
returns table (id uuid, codice text)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
  v_id uuid;
  v_codice text;
  v_n int;
begin
  if v_uid is null then raise exception 'accesso richiesto' using errcode = '42501'; end if;
  -- freno: al massimo 30 liste create da una persona
  select count(*) into v_n from public.gruppi g where g.creato_da = v_uid;
  if v_n >= 30 then raise exception 'troppe liste' using errcode = 'P0001'; end if;
  loop
    v_codice := substr(md5(random()::text || clock_timestamp()::text || v_uid::text), 1, 10);
    exit when not exists (select 1 from public.gruppi g where g.codice = v_codice);
  end loop;
  insert into public.gruppi (nome, emoji, codice, creato_da)
    values (btrim(p_nome), coalesce(nullif(btrim(p_emoji), ''), '🍽️'), v_codice, v_uid)
    returning gruppi.id into v_id;
  insert into public.gruppi_membri (gruppo_id, user_id, nome)
    values (v_id, v_uid, coalesce(nullif(left(btrim(p_mio_nome), 40), ''), 'Amico'));
  return query select v_id, v_codice;
end;
$$;

-- Anteprima del link d'invito: solo nome, emoji e numero di persone (niente nomi, niente posti).
-- Leggibile anche senza account, così chi riceve il link capisce dove sta entrando.
create or replace function public.gruppo_da_invito(p_codice text)
returns table (id uuid, nome text, emoji text, membri int, posti int, sono_dentro boolean)
language sql
stable
security definer
set search_path = public
as $$
  select g.id, g.nome, g.emoji,
    (select count(*) from public.gruppi_membri m where m.gruppo_id = g.id)::int,
    (select count(*) from public.gruppi_posti p where p.gruppo_id = g.id)::int,
    exists (select 1 from public.gruppi_membri m where m.gruppo_id = g.id and m.user_id = auth.uid())
  from public.gruppi g
  where g.codice = lower(btrim(p_codice));
$$;

-- Entrare con il codice d'invito (idempotente: chi è già dentro resta dentro).
create or replace function public.entra_gruppo(p_codice text, p_mio_nome text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
  v_n int;
begin
  if v_uid is null then raise exception 'accesso richiesto' using errcode = '42501'; end if;
  select g.id into v_id from public.gruppi g where g.codice = lower(btrim(p_codice));
  if v_id is null then raise exception 'invito non valido' using errcode = 'P0002'; end if;
  select count(*) into v_n from public.gruppi_membri m where m.gruppo_id = v_id;
  if v_n >= 50 and not exists (select 1 from public.gruppi_membri m where m.gruppo_id = v_id and m.user_id = v_uid) then
    raise exception 'lista piena' using errcode = 'P0001';
  end if;
  insert into public.gruppi_membri (gruppo_id, user_id, nome)
    values (v_id, v_uid, coalesce(nullif(left(btrim(p_mio_nome), 40), ''), 'Amico'))
    on conflict (gruppo_id, user_id) do nothing;
  return v_id;
end;
$$;

-- Le mie liste, con i numeri per l'elenco.
create or replace function public.miei_gruppi()
returns table (id uuid, nome text, emoji text, codice text, creato_da uuid, created_at timestamptz, membri int, posti int, voti int)
language sql
stable
security definer
set search_path = public
as $$
  select g.id, g.nome, g.emoji, g.codice, g.creato_da, g.created_at,
    (select count(*) from public.gruppi_membri m where m.gruppo_id = g.id)::int,
    (select count(*) from public.gruppi_posti p where p.gruppo_id = g.id)::int,
    (select count(*) from public.gruppi_voti v join public.gruppi_posti p on p.id = v.posto_id where p.gruppo_id = g.id)::int
  from public.gruppi g
  join public.gruppi_membri me on me.gruppo_id = g.id and me.user_id = auth.uid()
  order by g.created_at desc;
$$;

-- I posti di una lista, con i voti, per chi ne è membro (nessuna riga per gli altri).
-- Del locale solo i campi già pubblici dell'app (come la vista salvati_pubblici).
create or replace function public.posti_gruppo(p_gruppo uuid)
returns table (
  posto_id uuid, place_id uuid, google_place_id text, name text, category text, address text,
  lat double precision, lng double precision, aggiunto_da uuid, aggiunto_da_nome text,
  created_at timestamptz, voti int, votanti text[], ho_votato boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, pl.id, pl.google_place_id, pl.name, pl.category, pl.address,
    pl.lat::double precision, pl.lng::double precision, p.aggiunto_da, am.nome, p.created_at,
    (select count(*) from public.gruppi_voti v where v.posto_id = p.id)::int,
    coalesce((select array_agg(m.nome order by v.created_at) from public.gruppi_voti v
       join public.gruppi_membri m on m.gruppo_id = p.gruppo_id and m.user_id = v.user_id
       where v.posto_id = p.id), '{}'),
    exists (select 1 from public.gruppi_voti v where v.posto_id = p.id and v.user_id = auth.uid())
  from public.gruppi_posti p
  join public.places pl on pl.id = p.place_id
  left join public.gruppi_membri am on am.gruppo_id = p.gruppo_id and am.user_id = p.aggiunto_da
  where p.gruppo_id = p_gruppo and public.membro_gruppo(p_gruppo)
  order by 12 desc, p.created_at asc;
$$;

revoke all on function public.crea_gruppo(text, text, text) from public, anon;
revoke all on function public.entra_gruppo(text, text) from public, anon;
revoke all on function public.miei_gruppi() from public, anon;
revoke all on function public.posti_gruppo(uuid) from public, anon;
revoke all on function public.gruppo_da_invito(text) from public;
grant execute on function public.crea_gruppo(text, text, text) to authenticated;
grant execute on function public.entra_gruppo(text, text) to authenticated;
grant execute on function public.miei_gruppi() to authenticated;
grant execute on function public.posti_gruppo(uuid) to authenticated;
grant execute on function public.gruppo_da_invito(text) to anon, authenticated;
