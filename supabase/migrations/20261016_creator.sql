-- Migration: creator e critici (piano 5.6b) — badge "Creator" sui profili pubblici e sezione
-- "Liste dei creator da seguire" in /amici.
-- DA APPLICARE A MANO (coordinatore/Lorenzo). Richiede 20261015_social.sql già applicata.
-- Finché non è applicata l'app funziona uguale: nessun badge e sezione dei creator nascosta.
-- Idempotente: sicura da ri-eseguire. Nessun dato esistente viene cancellato o riscritto.
--
-- Chi è creator lo decide SOLO Mapetite (admin), mai l'utente:
--   - la colonna si imposta dall'editor SQL di Supabase o con la chiave di servizio, es.
--       update public.profiles set is_creator = true, creator_tipo = 'Food blogger' where handle = 'nome';
--   - un trigger ignora ogni modifica di is_creator / creator_tipo fatta da un utente collegato
--     (ruoli anon/authenticated via API): resta il valore di prima.
--   - conta solo per profili pubblici (is_public) con un nome (handle): la vista lo filtra.

alter table public.profiles add column if not exists is_creator   boolean not null default false;
alter table public.profiles add column if not exists creator_tipo text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_creator_tipo_len') then
    alter table public.profiles
      add constraint profiles_creator_tipo_len check (creator_tipo is null or char_length(creator_tipo) <= 30);
  end if;
end $$;

create or replace function public.profiles_creator_solo_admin()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('anon', 'authenticated') then
    if tg_op = 'INSERT' then
      new.is_creator := false;
      new.creator_tipo := null;
    else
      new.is_creator := old.is_creator;
      new.creator_tipo := old.creator_tipo;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_creator_solo_admin on public.profiles;
create trigger profiles_creator_solo_admin
  before insert or update on public.profiles
  for each row execute function public.profiles_creator_solo_admin();

-- Vista pubblica in sola lettura: solo chi è creator, pubblico e con un nome.
create or replace view public.creator_pubblici as
select p.id, p.handle, p.creator_tipo
from public.profiles p
where p.is_creator and p.is_public and p.handle is not null;

revoke all on public.creator_pubblici from anon, authenticated;
grant select on public.creator_pubblici to anon, authenticated;
