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
create index if not exists contenuti_segnalati_user_created_idx on public.contenuti_segnalati (user_id, created_at desc);

-- Limite di 20 segnalazioni in 24 ore per persona, nel database (revisore 23/11): contare nella route e poi
-- inserire si aggirava con tante richieste in parallelo. Il lucchetto per utente mette in fila gli inserimenti.
create or replace function public.contenuti_segnalati_limite() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('contenuti_segnalati:' || new.user_id::text, 0));
  if (select count(*) from public.contenuti_segnalati
      where user_id = new.user_id and created_at > now() - interval '24 hours') >= 20 then
    raise exception 'limite segnalazioni' using errcode = 'P0001', hint = 'limite_giorno';
  end if;
  return new;
end $$;
drop trigger if exists contenuti_segnalati_limite on public.contenuti_segnalati;
create trigger contenuti_segnalati_limite before insert on public.contenuti_segnalati
  for each row execute function public.contenuti_segnalati_limite();
alter table public.contenuti_segnalati enable row level security;

create table if not exists public.utenti_nascosti (
  user_id uuid not null references auth.users on delete cascade,
  nascosto_id uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, nascosto_id),
  check (user_id <> nascosto_id)
);
alter table public.utenti_nascosti enable row level security;
