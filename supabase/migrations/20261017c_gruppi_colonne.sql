-- Migration: liste di gruppo, colonne modificabili (correzione di sicurezza del 17/10/2026).
-- Applicata in produzione con l'API di gestione Supabase il 17/10/2026. Idempotente, nessun dato toccato.
--
-- Problema: il permesso di modifica copriva tutte le colonne. Un utente poteva spostare la propria
-- riga di gruppi_membri in un altro gruppo (gruppo_id) ed entrarci senza codice d'invito e oltre
-- il limite di 50 membri; il creatore poteva cambiare codice e date. Ora dal telefono si cambiano
-- solo il proprio nome nel gruppo e nome/simbolo del gruppo (le altre scritture passano dalle
-- funzioni del server, che non usano questi permessi).
revoke update on public.gruppi_membri from authenticated;
grant update (nome) on public.gruppi_membri to authenticated;
revoke update on public.gruppi from authenticated;
grant update (nome, emoji) on public.gruppi to authenticated;
