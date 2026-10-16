-- Migration: Scopritori (piano 5.6) — riconoscimento leggero per chi scopre posti poco conosciuti.
-- DA APPLICARE A MANO (Lorenzo). Finché non è applicata l'app funziona uguale: la riga
-- "💎 Scopritore" nel profilo, il badge sul profilo pubblico e la classifica in /amici
-- semplicemente non compaiono.
-- Idempotente: sicura da ri-eseguire. Nessun dato esistente viene cancellato o riscritto.
--
-- Dati: NON si salva nessun contenuto Google nuovo (né numero di recensioni né altro).
-- Si salva solo la NOSTRA classificazione derivata, sì/no, calcolata al salvataggio con la
-- stessa regola del badge "💎 Poco conosciuto" (src/lib/gem.ts: voto ≥ 4,5 e 20–400 recensioni).
-- null = non ancora classificato (locali salvati prima di questa migrazione): non conta.
--
-- Privacy: come 20261015_social.sql. La vista mostra solo i profili pubblici e solo due numeri
-- (gemme salvate, gemme provate): nessun locale, nessuna nota, nessun tag.

alter table public.places add column if not exists poco_conosciuto boolean;

create or replace view public.scopritori_pubblici as
select
  p.id,
  p.handle,
  p.display_name,
  (select count(*) from public.saved_places s join public.places pl on pl.id = s.place_id
     where s.user_id = p.id and pl.poco_conosciuto)::int as gemme,
  (select count(*) from public.saved_places s join public.places pl on pl.id = s.place_id
     where s.user_id = p.id and pl.poco_conosciuto and 'Già visitato' = any (coalesce(s.tags, '{}')))::int as gemme_provate
from public.profiles p
where p.is_public and p.handle is not null;

revoke all on public.scopritori_pubblici from anon, authenticated;
grant select on public.scopritori_pubblici to anon, authenticated;
