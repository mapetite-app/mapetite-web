-- Migration: lato ristoratori (PIANO-25-OTTOBRE.md 8.1 e 8.2) — DA APPLICARE da Lorenzo.
-- Finché non è applicata l'app funziona uguale:
--   - il modulo "Rivendica questo locale" ripiega su un'email precompilata a Mapetite;
--   - la pagina del locale non mostra il badge "Verificato" (colonna places.verified_at assente);
--   - il pannello /ristoratore/[id] resta visibile solo agli admin.
--
-- Come si verifica una richiesta (dal pannello SQL di Supabase):
--   update public.claims set stato = 'verificata' where id = '<id della richiesta>';
-- Il trigger qui sotto accende il badge sul locale (places.verified_at) e il titolare
-- che ha inviato la richiesta (claims.user_id) vede il suo pannello in /ristoratore/<id del locale>.
-- Rimettendo la richiesta a 'rifiutata' o 'nuova' il badge si spegne (se non ce ne sono altre verificate).
--
-- Privacy: i dati del modulo (nome, telefono, email) li legge solo il server con la chiave di
-- servizio. Nessuna policy di lettura per gli utenti: chi invia non rilegge nemmeno la propria.

-- 1. Richieste di rivendica.
create table if not exists public.claims (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  user_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  place_id         uuid references public.places (id) on delete cascade,  -- UUID Supabase del locale (null se scritto a mano)
  google_place_id  text check (google_place_id is null or char_length(google_place_id) <= 200),
  locale_nome      text check (locale_nome is null or char_length(locale_nome) <= 120),  -- solo se place_id è null
  locale_citta     text check (locale_citta is null or char_length(locale_citta) <= 80),
  nome             text not null check (char_length(nome) between 2 and 100),
  ruolo            text not null check (char_length(ruolo) between 2 and 60),
  telefono         text not null check (char_length(telefono) between 5 and 30),
  email            text not null check (char_length(email) between 5 and 160),
  messaggio        text check (messaggio is null or char_length(messaggio) <= 1000),
  stato            text not null default 'nuova' check (stato in ('nuova', 'verificata', 'rifiutata')),
  verificata_at    timestamptz,
  constraint claims_locale_check check (place_id is not null or locale_nome is not null)
);

create index if not exists claims_place_idx on public.claims (place_id) where place_id is not null;
create index if not exists claims_user_idx on public.claims (user_id);
-- Una sola richiesta in attesa per persona e locale (niente doppioni con un tocco ripetuto).
create unique index if not exists claims_attesa_unica on public.claims (user_id, place_id)
  where stato = 'nuova' and place_id is not null;

alter table public.claims enable row level security;

-- Chiunque abbia fatto l'accesso inserisce la PROPRIA richiesta, sempre nello stato 'nuova'.
-- Nessuna policy di lettura, modifica o cancellazione: solo il server (chiave di servizio).
drop policy if exists "Chi ha l'accesso invia la propria richiesta" on public.claims;
create policy "Chi ha l'accesso invia la propria richiesta" on public.claims
  for insert to authenticated
  with check (user_id = auth.uid() and stato = 'nuova' and verificata_at is null);

-- 2. Badge "Verificato" sul locale: places ha già la lettura pubblica.
alter table public.places add column if not exists verified_at timestamptz;

-- 3. Il badge segue lo stato delle richieste.
create or replace function public.claims_aggiorna_verifica()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.stato = 'verificata' then
    new.verificata_at := coalesce(new.verificata_at, now());
    if new.place_id is not null then
      update public.places set verified_at = coalesce(verified_at, now()) where id = new.place_id;
    end if;
  elsif tg_op = 'UPDATE' and old.stato = 'verificata' then
    new.verificata_at := null;
    if old.place_id is not null and not exists (
      select 1 from public.claims c where c.place_id = old.place_id and c.stato = 'verificata' and c.id <> old.id
    ) then
      update public.places set verified_at = null where id = old.place_id;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists claims_aggiorna_verifica on public.claims;
create trigger claims_aggiorna_verifica
  before insert or update of stato on public.claims
  for each row execute function public.claims_aggiorna_verifica();
