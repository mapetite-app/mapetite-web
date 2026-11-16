-- Proposta 61 riaccesa: da applicare SOLO dopo che l'interfaccia ("Ci sono stato" della scheda dentro la sezione
-- recensioni, un solo tasto per schermata) è approvata dal revisore separato e unita. Rimette il trigger della 20261116b,
-- sospeso dalla 20261116e. La funzione recensione_da_visita è già in produzione, invariata.
drop trigger if exists reviews_da_visita on public.reviews;
create trigger reviews_da_visita before insert or update on public.reviews
  for each row execute function public.recensione_da_visita();
