-- Proposta 61 sospesa (16/11 notte): l'interfaccia è stata bocciata due volte dai revisori e non va in produzione.
-- Senza la sua interfaccia il trigger farebbe fallire con un errore generico le recensioni di chi non ha segnato
-- "Ci sono stato": si toglie. Restano la funzione (inerte) e le due colonne della vista recensioni_pubbliche
-- (c_e_stato, visita_mese), che l'app di oggi non legge. Per riaccenderla: riapplicare il trigger della 20261116b
-- insieme all'interfaccia approvata.
drop trigger if exists reviews_da_visita on public.reviews;
