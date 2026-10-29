# Cose che restano a Lorenzo

Chiesto da Lorenzo il 21/10: "ricordami quello che devo fare anche nelle prossime chat se non l'ho fatto, perché è importante che tu possa andare avanti".

**Regola per ogni sessione e ogni chat con Lorenzo:** in fondo al messaggio finale (e in cima a ogni PR) c'è sempre una sezione **"Ti ricordo"** con le voci ancora APERTA di questo file, una riga ciascuna, prima le più importanti.
- Quando Lorenzo dice che una cosa è fatta, o quando la sessione lo verifica da sola (per esempio il pulsante Google funziona, la chiave c'è su Vercel), la voce passa a FATTA, con la data.
- Le voci non si tolgono mai: si segnano FATTA.

## Aperte

**Istruzioni passo passo con i link: `ISTRUZIONI-LORENZO.md` (22/10).**

00. **Ricarica il credito Anthropic (Haiku) — FATTA il 29/10** (verificato: primo verdetto nuovo in produzione alle 14:45 del 29/10, chiave di prova ok). Era aperta dal 23/10, 01:00. L'API risponde "credit balance is too low": in produzione l'AI non scrive più né verdetti per i locali nuovi né i "perché" (prova delle 01:00: 0 "perché" su 12, verdetto solo sui 10 già in memoria). La ricerca funziona ancora, ma senza AI non si capisce perché Mapetite è diversa.
   - console.anthropic.com → Plans & Billing → acquista credito (prepagato, senza ricarica automatica).
   - Come si verifica: le sessioni lo vedono da sole (il verdetto torna sui locali nuovi).
   - **24/10 alle 00:10: ancora a zero** (stesso errore; notifica mandata).
   - **23/10 alle 05:08: ancora a zero** (stesso errore). L'ultimo verdetto nuovo in produzione è delle 08:07 del 22/10. Da oggi `/admin/numeri` mostra "AI: ok" o "AI forse ferma" con l'ora dell'ultimo verdetto.
   - Consiglio: imposta anche un avviso di spesa nella console (Limits), così te ne accorgi prima che finisca.

0. **Una sola attività programmata — APERTA (22/10).** Metti in pausa quella del fine settimana e sostituisci il testo di quella dei feriali con `PROMPT-UNICO.md`, orari `5 3,10,14,18,22 * * *`. Così non partono mai due chat sulla stessa cosa.

1. **Accesso con Google in un tocco — FATTA il 29/10, in modalità "Test".** Google acceso su Supabase (verificato con l'API di gestione: `external_google_enabled` vero), Lorenzo ha provato e funziona. Per ora entrano solo gli account aggiunti come "Utenti di prova" (fino a 100).
1b. **Pubblicare l'app su Google ("Pubblica app") — APERTA, non urgente (29/10).** Il pulsante in Google Auth Platform → Pubblico non si può premere. Finché resta in Test, ogni tester va aggiunto a mano in Pubblico → "Utenti di prova" → "+ Add users". Da guardare insieme quando si apre a tutti (serve uno screenshot della scritta sotto il pulsante).
1-vecchia. **Accesso con Google in un tocco (sprint, chiave 0) — FATTA il 29/10 (vedi sopra).** Il pulsante "Continua con Google" è già pronto e compare da solo quando Google è acceso su Supabase.
   - Su console.cloud.google.com → API e servizi → Credenziali → "Crea credenziali" → "ID client OAuth", tipo "Applicazione web".
   - In "URI di reindirizzamento autorizzati" metti l'indirizzo che mostra Supabase in Authentication → Providers → Google ("Callback URL").
   - Copia ID client e chiave segreta in Supabase (stessa pagina) e accendi Google.
   - Come si verifica: in /login compare "Continua con Google". Le sessioni lo controllano anche da sole con l'API di gestione Supabase (`external_google_enabled`; il 21/10 alle 23:00 era ancora spento).
2. **Quota Google a 100 al giorno fino al 26/10 — APERTA (da controllare).** La regola dello sprint vale solo se la console Google mostra davvero 100.
   - Controlla su console.cloud.google.com → API e servizi → Places API (New) → Quote.
   - Dimmi il numero che vedi.
   - Dal 27/10 si torna a 50.
3. **Prove su telefoni veri (iPhone e Android) — APERTA.**
   - Installa l'app dalla home del telefono.
   - Fai il giro: salva da un reel, cerca, apri la scheda, segna "Ci sono stato".
   - Scrivi in una PR cosa non va. Da qui si prova solo un telefono simulato.
4. **Reel di Instagram letti dal link — APERTA, facoltativa.** Senza, Instagram funziona con lo screenshot.
   - Crea un'app gratuita su developers.facebook.com con il tuo account e aggiungi il prodotto "oEmbed".
   - Mandami ID dell'app e "client token" (Impostazioni → Avanzate), oppure mettili su Vercel come `META_OEMBED_TOKEN` nel formato `IDAPP|CLIENTTOKEN`.
   - Il codice per usarla lo aggiunge il team quando la chiave c'è.
5. **Voti veri di Tripadvisor nella scheda — APERTA, facoltativa.** Chiave ufficiale gratuita su tripadvisor.com/developers, da mettere su Vercel come `TRIPADVISOR_API_KEY`. Senza, resta solo il link di ricerca.
6. **Decisioni in sospeso — APERTE, una riga ciascuna** (dettagli in `BACKLOG.md`):
   - avvisi push gratuiti come "si è liberato un tavolo" (proposta 6);
   - omaggio del locale a chi torna (proposta 12);
   - serata di pre-apertura con utenti scelti per gusto (proposta 9);
   - "cliente di parola": prenotazioni salvate sul server e mostrate al locale, con consenso (proposta 3).
   - "stasera c'è posto" dai sistemi di prenotazione: prepariamo la richiesta a TheFork e Zenchef per Roberto? (proposta 25).

## Fatte

- **Scelta del design (PR #87) — FATTA il 21/10:** "tutto come consigliato", deciso da Claude su autorizzazione di Lorenzo.
- **Unire le PR #88 e #89 — FATTA il 21/10**, dalla sessione del mattino (PR #90).
