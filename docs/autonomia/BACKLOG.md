# Backlog Mapetite — piano 2 settimane verso il test con utenti

Ordine di priorità deciso da Lorenzo (10/10): 1) funzioni che oggi impediscono di far usare l'app ai tester; 2) grafica vicina ai riferimenti; 3) tutto ciò che si può prendere dai concorrenti e migliorare. Social e profili dei locali vengono dopo (Fase 5).

Obiettivo: entro fine ottobre 2026 un'app che un gruppo ristretto di persone possa usare davvero: ricerca precisa, interfaccia chiara, niente errori evidenti.
Stati: PRONTA (si fa in autonomia) · DA DECIDERE (serve risposta di Lorenzo) · IN PR · FATTA.
L'ordine è la priorità. Lorenzo può riordinare o commentare qui o nelle PR.

## Avanzamento verso il 25/10
Notte 10/10: voci 1–7 e 9 (parziale) in PR `claude/notte-2026-10-10`. Mancano: scelta tra lista A e B (Lorenzo), foto nelle card e nella scheda (richiedono Place Photos, a pagamento: DA DECIDERE), prova dal vivo di intento ed esclusioni con Haiku (nell'ambiente di sviluppo manca `ANTHROPIC_API_KEY`), giro completo con account reale (registrazione, salvataggio), voci 8 e 10 (DA DECIDERE).

## Fase 1 — La ricerca funziona (notti 1–4)

### 1. Ricerca AI che resta quando chiudi e riapri il pannello — IN PR (notte 10/10)
`aiSearch` deve sopravvivere a chiusura/riapertura del pannello; si azzera solo se l'utente cancella la ricerca o passa ai filtri. `src/lib/panel-state.ts` + `map-view.tsx`.

### 2. Ricerca veloce: risultati subito, verdetti dopo — IN PR (notte 10/10)
Oggi a cache fredda 13–22 s perché la risposta aspetta la sintesi Haiku. Mostrare i locali di Google appena arrivano (1–2 s), poi caricare verdetti/matchReason con una seconda chiamata e uno stato di caricamento curato sulle card. Nessun aumento di costi.

### 3. Ricerca precisa: capire la richiesta — IN PR (notte 10/10, Haiku non testato dal vivo)
Problema (Lorenzo): "rooftop romantico per la fidanzata" restituisce osterie semplici o pub. Casi di prova in `TEST-RICERCHE.md`.
Prima di Google, Haiku estrae dalla frase: zona/città, tipo di locale, requisiti fisici (rooftop, vista, all'aperto), occasione (coppia, amici, lavoro), atmosfera; poi costruisce una query Google mirata con `includedType` coerente e, se c'è una zona, `locationRestriction` invece di `locationBias`. Stesso numero di chiamate Google (1 per ricerca).

### 4. Ricerca precisa: scartare ciò che non c'entra — IN PR (notte 10/10, Haiku non testato dal vivo)
Anche con la query giusta Google restituisce locali fuori tema. Proposta: Haiku valuta per ogni locale, usando recensioni e attributi Google, se soddisfa i requisiti della richiesta; i locali che chiaramente non li soddisfano vengono esclusi o spostati in fondo, con la motivazione registrata nei log. Regola aggiornata in LORENZO.md. Nel dubbio il locale resta; nessuna chiamata Google in più.
Possibile complemento senza costi aggiuntivi: chiedere a Google attributi come `outdoorSeating`, `servesCocktails`, `liveMusic`, `goodForGroups`, `reservable`. Sono nella stessa fascia di prezzo dei campi già richiesti (recensioni, editorialSummary), quindi non dovrebbero aumentare il costo per chiamata. Da verificare sul listino: se non è certo che il costo resti uguale, non attivarli e segnalalo in PR.

## Fase 2 — L'interfaccia è chiara (notti 5–9)

### 5. Nuova lista risultati — IN PR (varianti A e B dietro ?lista=; senza foto)
Lorenzo: la lista attuale "non mi piace per niente"; la vuole più integrata e bella. Pannello trascinabile con 3 altezze (mappa / metà / pieno), card più leggibili con foto, verdetto in una riga e motivo per cui è adatto alla ricerca. Consegnare 2 varianti attivabili da un parametro nell'URL (`?lista=a` / `?lista=b`) per far scegliere Lorenzo.
Riferimenti visivi: `RIFERIMENTI-DESIGN.md` (Places per lista, mappa e scheda; Albo per primo accesso e salvataggio).

### 6. Scheda locale rifinita — IN PR (notte 10/10)
Gerarchia chiara: foto, nome, verdetto, perché è adatto, azioni (salva, indicazioni, chiama, sito). Verifica che ogni pulsante funzioni su iPhone.
Riferimenti visivi: `RIFERIMENTI-DESIGN.md` (Places per lista, mappa e scheda; Albo per primo accesso e salvataggio).

### 7. Primo accesso guidato — IN PR (notte 10/10)
Un tester nuovo deve capire in 10 secondi cosa fare: schermata iniziale con 3–4 ricerche di esempio cliccabili, permesso posizione spiegato, stati vuoti ed errori con messaggi umani.
Riferimenti visivi: `RIFERIMENTI-DESIGN.md` (Places per lista, mappa e scheda; Albo per primo accesso e salvataggio).

### 8. Vista "salvati" ricercabile e raggruppata per città — DA DECIDERE (migrazione)
Richiede campo `city` su `saved_places` (migrazione Supabase) e `addressComponents` nel FIELD_MASK.

## Fase 3 — Pronta per i tester (notti 10–12)

### 9. Giro completo di controllo — IN PR (parziale: schermate pubbliche; flussi con account non provati)
Percorsi completi con Playwright a viewport mobile: registrazione, ricerca, apertura scheda, salvataggio, profilo. Correzione dei bug trovati, screenshot di ogni schermata in PR.

### 10. Raccolta feedback dei tester — DA DECIDERE
Pulsante "Dai un feedback" nell'app. Dove far arrivare i messaggi (email, tabella Supabase) lo decide Lorenzo.

## Dopo il test con utenti
- Import salvati da Google Maps per tutti (quota Google insufficiente per import grandi: da ripensare).
- Backfill verdetti per i salvati senza sintesi (costo Haiku da stimare).
- Log delle ricerche `search_logs` (migrazione + privacy).
- Prompt caching Haiku quando i volumi crescono.
- Funzioni social: escluse finché non ci sono utenti reali.

## Fase 4 — Funzioni nuove proposte da Claude (sempre attiva quando le voci PRONTA finiscono o sono bloccate)
Lorenzo vuole che Mapetite cresca oltre il piano, al livello delle app concorrenti (Google Maps, Mapstr, TripAdvisor e simili), con funzioni che oggi non sono previste.
Regole:
- Prima di proporre, studia cosa fanno i concorrenti (ricerca web) e scegli solo funzioni coerenti con la differenziazione di Mapetite: scoprire locali non mainstream adatti ai gusti della persona.
- Aggiungi ogni idea qui sotto come "PROPOSTA" con: cosa fa per l'utente, perché aiuta i tester/investitori, costo stimato (chiamate Google/Haiku), se serve una migrazione.
- Puoi costruire una PROPOSTA senza aspettare l'ok solo se: non richiede migrazioni, non aumenta i costi per ricerca, ed è nascosta dietro un flag spento di default (es. `?beta=nome-funzione` nell'URL). Lorenzo la prova nell'anteprima e decide se accenderla.
- Le fasi 1–3 restano la priorità: una funzione nuova non deve mai rallentare o rompere la ricerca e la lista risultati.

### Proposte
- **Foto dei locali — FATTA 11/10 (autorizzata da Lorenzo)**: foto sulle prime 6 card (liste A e B) e in cima alla scheda, tramite `/api/places/photo` con cache 7 giorni e tetto 100 foto/giorno per istanza; se la quota finisce resta l'emoji. Costo stimato: ~0 € con pochi tester (1.000 foto/mese gratuite, 7 $ ogni 1.000 dopo); caso peggiore senza cache ~60 €/mese. Consigliato: quota Google "Place Photos" a 100/giorno e avviso di budget a 10 €. Non verificato dal vivo il download dell'immagine (dall'ambiente di sviluppo l'host immagini non è raggiungibile): la prima chiamata a Google funziona.
- **Mappa viva — FATTA 11/10**: dopo una ricerca la mappa si sposta da sola per mostrare tutti i risultati; i pin hanno emoji in un cerchio bianco e il nome; il pin del locale aperto è più grande con anello corallo; le card mostrano la distanza. Limite noto: i filtri rapidi nascondono le card ma non i pin.
- **Filtri rapidi sulla lista — FATTA e ACCESA per tutti dall'11/10 (`?beta=off` per spegnere)**: chip "Aperto ora", "Fino a €€", "Voto 4,5+" sopra la lista. Nessun costo (filtra i dati già arrivati), nessuna migrazione.
- **Condividi un locale — FATTA e ACCESA per tutti dall'11/10**: pulsante nella scheda; apre il foglio di condivisione del telefono (o copia il link) con nome, verdetto e link Google Maps. Nessun costo, nessuna migrazione.
- **Ricerche recenti — FATTA e ACCESA per tutti dall'11/10**: nella card iniziale, le ultime 5 ricerche fatte su quel telefono (salvate solo nel browser). Nessun costo, nessuna migrazione.
- **Foto dei locali (DA DECIDERE, costo)**: Place Photos è fatturata a parte (quota attuale 200/giorno). Il campo `photos` è già nel FIELD_MASK, quindi serve solo l'endpoint di download. Senza foto le card restano più povere dei riferimenti Places. Stima: 1 chiamata foto per card visibile; con 6–8 card/ricerca, ~8 chiamate extra per ricerca.


## Fase 5 — Social e profili dei locali (dopo il 25/10, DA DECIDERE)
Lorenzo vuole sviluppare un layout completo per la parte social e per i profili dei locali. Riferimenti: Places (`places-06` Discover, `places-08` attività, `places-09` curatori) e Albo (`albo-09` post social collegato al locale).
- Profili utente pubblici, seguire persone, feed attività, curatori.
- Profilo del locale arricchito (contenuti social collegati, chi l'ha salvato).
Richiedono nuove tabelle e regole di privacy: Claude prepara una proposta con le schermate e le migrazioni necessarie, Lorenzo approva prima di costruire.
