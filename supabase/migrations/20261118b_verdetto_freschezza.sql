-- Proposta 67 "Da quando parla il verdetto": con il verdetto si salvano quante recensioni Google con testo
-- ha letto l'AI e la data della più recente (publishTime di Google). Colonne nullable: i verdetti già in
-- cache restano senza (nessuna riga nella scheda, non si inventa) e si riempiono al rinnovo (90 giorni).
-- Solo numeri e una data derivati, nessun testo Google salvato.
alter table public.place_synthesis add column if not exists recensioni_n int;
alter table public.place_synthesis add column if not exists recensione_ultima timestamptz;
