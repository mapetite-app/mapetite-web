-- Proposta 82 "Segnala e nascondi" (23/11/2026): regola 1.2 dell'App Store sui contenuti degli utenti.
-- Chi guarda può segnalare una recensione o una foto di un altro membro e smettere di vedere i contenuti
-- di quella persona. Nessuna policy per gli utenti (né lettura né scrittura): scrive solo la route
-- /api/moderazione con la chiave di servizio, dopo aver verificato l'utente e trovato l'autore dal
-- contenuto (l'autore di un profilo privato non si rivela mai a chi segnala). Le segnalazioni le legge
-- solo /admin/numeri.
create table if not exists public.contenuti_segnalati (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  tipo text not null check (tipo in ('recensione', 'foto')),
  contenuto_id uuid not null,
  autore_id uuid references auth.users on delete cascade,
  motivo text not null check (motivo in ('offensiva', 'falsa', 'fuori_tema', 'altro')),
  esito text check (esito in ('tolto', 'lasciato')),
  created_at timestamptz not null default now(),
  unique (user_id, tipo, contenuto_id)
);
create index if not exists contenuti_segnalati_created_idx on public.contenuti_segnalati (created_at desc);
alter table public.contenuti_segnalati enable row level security;

create table if not exists public.utenti_nascosti (
  user_id uuid not null references auth.users on delete cascade,
  nascosto_id uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, nascosto_id),
  check (user_id <> nascosto_id)
);
alter table public.utenti_nascosti enable row level security;
