-- "Cliente di parola", passo 2 (PROPOSTE.md 3, decisione di Lorenzo del 29/10/2026): le prenotazioni
-- fatte da Mapetite si possono tenere sull'account, SOLO se la persona lo sceglie (consenso esplicito
-- in /prenotazioni, informativa in /privacy). Servono a non perderle cambiando telefono e a contare
-- "di parola" ovunque. Spegnendo, le righe si cancellano e il consenso si toglie.
-- Il dato al locale (pannello) è un passo successivo: oggi nessun altro le legge.
-- Idempotente, nessun dato esistente toccato. Si cancellano da sole con l'account (on delete cascade).
create table if not exists public.prenotazioni_consenso (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.prenotazioni_consenso enable row level security;
drop policy if exists "prenotazioni_consenso: il mio" on public.prenotazioni_consenso;
create policy "prenotazioni_consenso: il mio" on public.prenotazioni_consenso
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.prenotazioni (
  user_id uuid not null references auth.users (id) on delete cascade,
  id text not null check (char_length(id) between 4 and 40),       -- id della prenotazione sul telefono
  place_id text not null check (char_length(place_id) between 1 and 200), -- id Mapetite (UUID) o Google (ChIJ…)
  giorno date,
  esito text check (esito in ('bene', 'male', 'non-andato')),
  disdetta_at timestamptz,
  dati jsonb not null,                                             -- la prenotazione come sul telefono
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
create index if not exists prenotazioni_place_giorno on public.prenotazioni (place_id, giorno);
alter table public.prenotazioni enable row level security;
drop policy if exists "prenotazioni: le mie" on public.prenotazioni;
-- Si scrive solo con il consenso acceso.
create policy "prenotazioni: le mie" on public.prenotazioni
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id and exists (select 1 from public.prenotazioni_consenso c where c.user_id = auth.uid()));

-- Dal collaudo (31/10): una prenotazione tolta resta come "lapide" (cancellata_at, dati svuotati),
-- così un altro telefono non la ricarica. "Spegni" cancella anche le lapidi.
alter table public.prenotazioni add column if not exists cancellata_at timestamptz;
