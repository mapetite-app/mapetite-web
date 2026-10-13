# Cosa sbloccare per lasciare a Claude piena libertà su Mapetite

Scritto il 14/10/2026 notte, su richiesta di Lorenzo. Escluso il tetto di spesa mensile, che resta tuo.
L'ordine segue l'impatto: le prime cose sono quelle che oggi mi fermano più spesso.
Per ogni voce: cosa fare, dove, quanto tempo serve.

## A. Accessi tecnici (5–30 minuti ciascuno)

1. **Chiave Haiku nell'ambiente cloud di prova** (5 min). È il blocco più grave: il "verdetto Mapetite" è il cuore del prodotto e non l'ho mai visto funzionare dal vivo. Senza chiave anche la comprensione della frase non parte, quindi ogni ricerca che provo è "solo Google".
   - claude.ai/code → ambiente di questa routine → Variabili d'ambiente → `ANTHROPIC_API_KEY=…`.
   - Meglio una chiave separata da quella di produzione, su un workspace Anthropic con un credito piccolo (es. 5 €) e senza ricarica automatica: così il tetto è garantito.

2. **Un progetto Supabase di prova** (20 min). Oggi ho solo il database vero. La lettura del database di produzione mi è bloccata (stanotte non ho potuto controllare se la tabella `events` esiste) e le migrazioni non le posso provare da nessuna parte.
   - Crea un secondo progetto Supabase gratuito (es. `mapetite-staging`) e applica le migrazioni di `supabase/migrations/`.
   - Metti nell'ambiente cloud: URL, chiave anon e chiave secret del progetto di prova, al posto di quelle vere. Aggiungi anche un **access token Supabase** (Account → Access Tokens): serve per applicare le migrazioni da riga di comando.
   - Crea un utente di prova (email + password) e mettili come `E2E_EMAIL` / `E2E_PASSWORD`: così faccio finalmente il "giro con un account vero" (voce 9).

3. **Rete dell'ambiente cloud** (5 min). Oggi sono bloccati:
   - `lh3.googleusercontent.com` (le foto dei locali: non ho mai visto una foto vera nei miei test);
   - `api.vercel.com` (non posso leggere i deploy e i log di Vercel);
   - `supabase.com` / `api.supabase.com` (gestione di Supabase da riga di comando).
   Si aggiungono alla lista dei domini permessi dell'ambiente (claude.ai/code → ambiente → Rete).

4. **Anteprime Vercel senza login** (2 min). Vercel → progetto → Settings → Deployment Protection → disattiva "Vercel Authentication" per le Preview, oppure crea un link di bypass e mettilo in `VERCEL_BYPASS`. Così io posso provare l'anteprima vera dopo ogni push (oggi provo solo in locale) e tu la apri dal telefono senza accedere.

5. **Token Vercel in sola lettura** (5 min), nell'ambiente cloud come `VERCEL_TOKEN`: leggo i log di produzione e vedo gli errori veri dei tester, invece di aspettare che me li racconti tu.

6. **Supabase → Authentication → URL Configuration** (2 min, dal 13/10 ancora da fare). Ai Redirect URLs aggiungi `https://<dominio>/login*` e `https://<dominio>/reimposta-password`. Senza, "Password dimenticata?" e il ritorno dopo la registrazione rischiano di non funzionare in produzione. Con il token del punto 2 lo potrei fare io.

7. **Dipendenze già installate a inizio sessione** (lo faccio io se mi dici sì). Ogni sessione parte senza `node_modules` e perde minuti a installarle. Basta uno script di avvio nel repository (`.claude/settings.json`, comando `npm ci`).

## B. Regole di `LORENZO.md` da allentare (una riga di risposta ciascuna)

Oggi queste regole mi impongono di fermarmi e aspettare te. Dimmi quali togliere, anche con un limite:

8. **Merge su `main`.** Proposta: posso fare merge da solo quando il giro automatico è tutto ok, tsc passa e la PR è aperta da almeno N ore senza tuoi commenti. Tu ricontrolli dopo, in produzione. Alternativa più prudente: un branch `staging` collegato a un secondo dominio Vercel, dove faccio merge io, e tu porti su `main` una volta al giorno.
9. **Migrazioni Supabase.** Proposta: libere sul progetto di prova (punto 2); su produzione solo migrazioni che *aggiungono* (tabelle o colonne nuove, mai cancellazioni), con il file in PR.
10. **Scelte grafiche definitive.** Oggi faccio tutto dietro un flag spento e aspetto il tuo sì: per questo 7 funzioni sono ancora spente (`?beta=...`). Proposta: posso accendere per tutti ciò che ha superato il giro automatico, e tu mi dici "torna indietro" se non ti piace.
11. **`SYNTHESIS_LIMIT`, `max_tokens`, FIELD_MASK, modello AI.** Rientrano nella spesa: se il tetto mensile è garantito dai crediti prepagati (punto 1) e dalle quote Google, posso regolarli io dentro quel tetto, scrivendo in PR la stima del costo.
12. **Cancellare pagine e codice vecchi** (`/miei-locali`, `site-header`): proposta di sì quando nessun link ci porta più.
13. **Voci "DA DECIDERE".** Proposta: se una voce resta senza risposta per 48 ore, scelgo io l'opzione più prudente e lo scrivo in PR.
14. **Orari.** Oggi nei giorni feriali lavoro solo 22–08 per lasciarti i limiti di utilizzo. Se ti va bene, posso lavorare anche di giorno quando tu non usi Claude.

## C. Decisioni già aperte (rispondi sì/no e le chiudo io)

Dall'elenco "Cosa serve decidere" di `BACKLOG.md`:
15. Migrazione `events` (segnali di comportamento): applicarla?
16. Verdetto su 20 risultati invece di 12 (circa il doppio del costo Haiku per ricerca)?
17. Accendere per tutti: primo accesso (3 schermate), "Ci sei stato?", pin dei salvati, gemme 💎, nuovo Salva, copertine delle raccolte.
18. "Collega Google Maps" con la Data Portability API (richiede la verifica dell'app da parte di Google: settimane, quindi va avviata presto).
19. Classifica personale dei posti visitati (serve una colonna nuova).
20. "Autentico" deve contare come "non turistico"? (vedi la PR #33).

## D. Cose che solo tu (o un telefono vero) potete fare

21. **Prova su iPhone e Android veri.** Posso simulare solo il browser del telefono. In alternativa, un servizio di dispositivi remoti (es. BrowserStack) è a pagamento: decidi tu.
22. **5 amici tester.** Basta un messaggio con il link. Le loro segnalazioni ("Feedback" e "Questi risultati non vanno?") oggi arrivano per email solo a te, e io non le vedo. Per farle arrivare anche a me: una tabella `feedback` in Supabase (migrazione, vedi punto 9) oppure incollale in un commento della PR della notte.
