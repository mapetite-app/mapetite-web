-- Proposta 50 "Chi ha scritto le recensioni": con il verdetto si salvano quante delle recensioni lette
-- dall'AI sono scritte (in originale, originalText.languageCode di Google) in italiano e quante in inglese.
-- Solo due conteggi derivati, nessun testo Google. Nullable: i verdetti già in cache restano senza (nessuna
-- coda nella riga, non si inventa) e si riempiono al rinnovo (90 giorni) o al primo verdetto nuovo.
alter table public.place_synthesis add column if not exists recensioni_it int;
alter table public.place_synthesis add column if not exists recensioni_en int;
