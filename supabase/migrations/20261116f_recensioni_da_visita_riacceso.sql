-- Proposta 61 riaccesa (16/11 sera): l'interfaccia ("Ci sono stato" della scheda dentro la sezione recensioni,
-- un solo tasto per schermata) è passata dal revisore separato. Si rimette il trigger della 20261116b,
-- sospeso dalla 20261116e. La funzione recensione_da_visita è già in produzione, invariata.
drop trigger if exists reviews_da_visita on public.reviews;
create trigger reviews_da_visita before insert or update on public.reviews
  for each row execute function public.recensione_da_visita();
