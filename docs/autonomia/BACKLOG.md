# Backlog Mapetite — piano 2 settimane verso il test con utenti

Ordine di priorità deciso da Lorenzo (10/10): 1) funzioni che oggi impediscono di far usare l'app ai tester; 2) grafica vicina ai riferimenti; 3) tutto ciò che si può prendere dai concorrenti e migliorare. Social e profili dei locali vengono dopo (Fase 5).

Obiettivo: entro fine ottobre 2026 un'app che un gruppo ristretto di persone possa usare davvero: ricerca precisa, interfaccia chiara, niente errori evidenti.
Stati: PRONTA (si fa in autonomia) · DA DECIDERE (serve risposta di Lorenzo) · IN PR · FATTA.
L'ordine è la priorità. Lorenzo può riordinare o commentare qui o nelle PR.

## Avanzamento verso il 25/10
Aggiornato 11/10 sera (dopo la #18). **In produzione (PR #13–#18):** voci 1–8 e 10; lista B collegata alla mappa con foto; home nuova; mappa pulita; feedback; salvati per città; "Ci sono stato"; momento magia e "✨ Per te"; ricerca in corso con card fantasma; link Google Maps per gli orari.
**In PR #19:** risposta come articolo (`?beta=articolo`), barra "Cosa cerchi?" in cima (`?beta=barra`), nuovo "Salva" (`?beta=salva`), `?stile=places` che accende tutto lo stile Places, ricerche "non turistiche" senza i locali di massa in cima.
**Manca:** scelte di Lorenzo sulle varianti (`?stile=places` = scheda B, home B, pin con foto, titoli serif, articolo, nuovo Salva; `?beta=barra`; `?mappa=chiara`; `?beta=gemme`); prova dal vivo con Haiku (manca `ANTHROPIC_API_KEY` nell'ambiente cloud); giro completo con un account vero; esempi di ricerche che non andavano.

## Fase 1 — La ricerca funziona (notti 1–4)

### 1. Ricerca AI che resta quando chiudi e riapri il pannello — FATTA (PR #11)
`aiSearch` deve sopravvivere a chiusura/riapertura del pannello; si azzera solo se l'utente cancella la ricerca o passa ai filtri. `src/lib/panel-state.ts` + `map-view.tsx`.

### 2. Ricerca veloce: risultati subito, verdetti dopo — FATTA (PR #11)
Oggi a cache fredda 13–22 s perché la risposta aspetta la sintesi Haiku. Mostrare i locali di Google appena arrivano (1–2 s), poi caricare verdetti/matchReason con una seconda chiamata e uno stato di caricamento curato sulle card. Nessun aumento di costi.

### 3. Ricerca precisa: capire la richiesta — FATTA (PR #11), DA RIFINIRE con gli esempi reali di Lorenzo (11/10)
Problema (Lorenzo): "rooftop romantico per la fidanzata" restituisce osterie semplici o pub. Casi di prova in `TEST-RICERCHE.md`.
Prima di Google, Haiku estrae dalla frase: zona/città, tipo di locale, requisiti fisici (rooftop, vista, all'aperto), occasione (coppia, amici, lavoro), atmosfera; poi costruisce una query Google mirata con `includedType` coerente e, se c'è una zona, `locationRestriction` invece di `locationBias`. Stesso numero di chiamate Google (1 per ricerca).

### 4. Ricerca precisa: scartare ciò che non c'entra — FATTA (PR #11), DA RIFINIRE con gli esempi reali di Lorenzo (11/10)
Anche con la query giusta Google restituisce locali fuori tema. Proposta: Haiku valuta per ogni locale, usando recensioni e attributi Google, se soddisfa i requisiti della richiesta; i locali che chiaramente non li soddisfano vengono esclusi o spostati in fondo, con la motivazione registrata nei log. Regola aggiornata in LORENZO.md. Nel dubbio il locale resta; nessuna chiamata Google in più.
Possibile complemento senza costi aggiuntivi: chiedere a Google attributi come `outdoorSeating`, `servesCocktails`, `liveMusic`, `goodForGroups`, `reservable`. Sono nella stessa fascia di prezzo dei campi già richiesti (recensioni, editorialSummary), quindi non dovrebbero aumentare il costo per chiamata. Da verificare sul listino: se non è certo che il costo resti uguale, non attivarli e segnalalo in PR.

## Fase 2 — L'interfaccia è chiara (notti 5–9)

### 5. Nuova lista risultati — FATTA: Lorenzo ha scelto B (11/10), ora predefinita; `?lista=a` per la vecchia
Lorenzo: la lista attuale "non mi piace per niente"; la vuole più integrata e bella. Pannello trascinabile con 3 altezze (mappa / metà / pieno), card più leggibili con foto, verdetto in una riga e motivo per cui è adatto alla ricerca. Consegnare 2 varianti attivabili da un parametro nell'URL (`?lista=a` / `?lista=b`) per far scegliere Lorenzo.
Riferimenti visivi: `RIFERIMENTI-DESIGN.md` (Places per lista, mappa e scheda; Albo per primo accesso e salvataggio).

### 6. Scheda locale rifinita — FATTA (PR #11)
Gerarchia chiara: foto, nome, verdetto, perché è adatto, azioni (salva, indicazioni, chiama, sito). Verifica che ogni pulsante funzioni su iPhone.
Riferimenti visivi: `RIFERIMENTI-DESIGN.md` (Places per lista, mappa e scheda; Albo per primo accesso e salvataggio).

### 7. Primo accesso guidato — FATTA (PR #11)
Un tester nuovo deve capire in 10 secondi cosa fare: schermata iniziale con 3–4 ricerche di esempio cliccabili, permesso posizione spiegato, stati vuoti ed errori con messaggi umani.
Riferimenti visivi: `RIFERIMENTI-DESIGN.md` (Places per lista, mappa e scheda; Albo per primo accesso e salvataggio).

### 8. Vista "salvati" ricercabile e raggruppata per città — FATTA 11/10 (approvata da Lorenzo)
Casella di ricerca e chip per città. La città si ricava dall\'indirizzo già salvato: nessuna migrazione e nessun campo Google in più (era la proposta iniziale, non serve più).

## Fase 3 — Pronta per i tester (notti 10–12)

### 9. Giro completo di controllo — QUASI FATTA (PR #15): manca solo il giro con un account vero
Provati con dati simulati (nessuna scrittura vera): ricerca, scheda, salvataggio con tag e nota, errore del server, rimozione, salvati per città, schermate pubbliche. Bug trovati e corretti in PR #15: barra della scheda fuori schermo a 390px, "Percorso" tagliato dopo il salvataggio, errori di accesso in inglese, campi che facevano zoomare l'iPhone, selettore file in inglese.
Percorsi completi con Playwright a viewport mobile: registrazione, ricerca, apertura scheda, salvataggio, profilo. Correzione dei bug trovati, screenshot di ogni schermata in PR.

### 10. Raccolta feedback dei tester — FATTA 11/10
Voce "Feedback" nella barra in basso: apre un\'email precompilata verso founder.mapetite@gmail.com con pagina e telefono. Scelta di Lorenzo: la cosa più semplice, leggibile dal telefono. Niente database.

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
- **Risposta come un articolo — IN PROVA (PR #19, `?beta=articolo`, accesa anche da `?stile=places`)**: dal carosello "☰ Leggi la risposta" apre la ricerca a tutto schermo come Places (`places-02`): la richiesta, "Ho scelto N posti per te: …", titolo grande, ogni locale con verdetto + motivo, foto grande e Salva; in fondo "Fai un'altra domanda". Nessun costo (dati già arrivati), nessuna migrazione. Niente mini-mappa: sarebbe un caricamento Mapbox in più.
- **Barra "Cosa cerchi?" sempre in cima — IN PROVA (PR #19, `?beta=barra`)**: campo di ricerca fisso in alto sulla mappa (`places-03/04`) al posto dell'icona ✨. Non è dentro `?stile=places` perché si sovrappone alla home B (due campi uguali): da scegliere quale tenere.
- **Nuovo "Salva" — IN PROVA (PR #19, `?beta=salva`, acceso anche da `?stile=places`)**: foglio dal basso come `places-07` con "📌 Voglio andarci / ✓ Ci sono stato", nota, tag, "Fatto". Stessi tag di prima, nessuna migrazione.
- **Ricerche "non turistiche" — FATTA (PR #19), accesa per tutti**: con "non turistico", "autentico", "poco conosciuto", "dove vanno i romani"… i locali con molte più recensioni degli altri (oltre 8.000 e oltre 3× la mediana) scendono in fondo, mai esclusi; log `[search-mainstream]`. Caso 3 di TEST-RICERCHE: prima Tonnarello (110k) e Nannarella (47k) erano in top 5. Nessun costo.
- **Momento magia a fine onboarding e "✨ Per te" — FATTE (PR #18)**: prima ricerca e suggerimento costruiti sui gusti dell'onboarding. Costo: 1 ricerca a fine onboarding, una volta per utente.
- **Stati "Voglio andarci / Ci sono stato" — FATTA (PR #17, corretta nella #18)** con i tag esistenti "Da provare" / "Già visitato", senza migrazione (sostituisce la proposta con colonna nuova).
- **Fatte 11/10 pomeriggio (PR #16), accese per tutti, nessun costo né migrazione:** carosello e mappa collegati con foto nel pin a fuoco; suggerimento in base all'ora; "Più vicini"; "Affina"; segnalibro Salva sulle card; condividi una ricerca (`/mappa?q=…&at=lat,lng`, accesa per tutti: unita alla versione della PR #15); nuova home come Places; ricerca scritta nella card iniziale; punto blu "tu sei qui" e pulsante posizione; invito ad aggiungere alla Home (iPhone/Android); tipi di locale in italiano; riga "Roma · 600 m" nella scheda; Accedi, Registrati, Profilo e Importa nei colori Mapetite; pulsanti quando non trova nulla.
- **Gemme — IN PROVA (`?beta=gemme`, spenta di default)**: badge "💎 Poco conosciuto" su voto ≥ 4,5 e 20–400 recensioni. Da decidere se accenderla per tutti.
- Pagine non collegate da nessuna parte e ancora nello stile vecchio: `/miei-locali`, `/locali/[id]`, `site-header`. Proposta: eliminarle (serve ok di Lorenzo).
- **Mappa chiara — DA SCEGLIERE (`?mappa=chiara`)**: mappa grigia stile Places contro quella attuale (già senza etichette di hotel e negozi).
- **Varianti grafiche stile Places — IN PROVA (PR #15, portate nella #16), da scegliere**: `?scheda=b` (foto grande, nome grande, "Roma · 350 m", "Cocktail bar · €€ · ★ 4,5", barra scura a riquadri), `?home=b` (campo "Cosa cerchi?" subito scrivibile, esempi a schede), `?titoli=serif` (nomi e titoli in serif editoriale). Si combinano; ognuna resta sul telefono finché non si apre `=a` / `=sans`. Nessun costo, nessuna migrazione.
- **Pin con foto — IN PROVA (PR #15, portata nella #16), `?pin=b`**: miniatura della foto al posto dell'emoji per i locali che hanno la foto nella card (stesse immagini: nessun costo in più).
- **PROPOSTA — Salva da link** (Corner: incolli un link Instagram/TikTok o Google Maps e diventa un pin): un link Google Maps con Place ID si risolve con 1 Place Details per salvataggio; un link social richiede di leggere la didascalia (Haiku, come l'import da screenshot). Nessuna migrazione; costo 1 chiamata Google per link. DA DECIDERE per il costo.
- **PROPOSTA — Mappa dei salvati condivisibile** (Mapstr: la mappa si apre da browser senza app): serve una lettura pubblica di `saved_places` di un utente → modifica RLS/migrazione, DA DECIDERE, e una scelta di privacy.
- **Foto dei locali — FATTA 11/10 (autorizzata da Lorenzo)**: foto sulle prime 6 card (liste A e B) e in cima alla scheda, tramite `/api/places/photo` con cache 7 giorni e tetto 100 foto/giorno per istanza; se la quota finisce resta l'emoji. Costo stimato: ~0 € con pochi tester (1.000 foto/mese gratuite, 7 $ ogni 1.000 dopo); caso peggiore senza cache ~60 €/mese. Consigliato: quota Google "Place Photos" a 100/giorno e avviso di budget a 10 €. Non verificato dal vivo il download dell'immagine (dall'ambiente di sviluppo l'host immagini non è raggiungibile): la prima chiamata a Google funziona.
- **Mappa viva — FATTA 11/10**: dopo una ricerca la mappa si sposta da sola per mostrare tutti i risultati; i pin hanno emoji in un cerchio bianco e il nome; il pin del locale aperto è più grande con anello corallo; le card mostrano la distanza. Limite noto: i filtri rapidi nascondono le card ma non i pin.
- **Filtri rapidi sulla lista — FATTA e ACCESA per tutti dall'11/10 (`?beta=off` per spegnere)**: chip "Aperto ora", "Fino a €€", "Voto 4,5+" sopra la lista. Nessun costo (filtra i dati già arrivati), nessuna migrazione.
- **Condividi un locale — FATTA e ACCESA per tutti dall'11/10**: pulsante nella scheda; apre il foglio di condivisione del telefono (o copia il link) con nome, verdetto e link Google Maps. Nessun costo, nessuna migrazione.
- **Ricerche recenti — FATTA e ACCESA per tutti dall'11/10**: nella card iniziale, le ultime 5 ricerche fatte su quel telefono (salvate solo nel browser). Nessun costo, nessuna migrazione.


## Fase 5 — Social e profili dei locali (dopo il 25/10, DA DECIDERE)
Lorenzo vuole sviluppare un layout completo per la parte social e per i profili dei locali. Riferimenti: Places (`places-06` Discover, `places-08` attività, `places-09` curatori) e Albo (`albo-09` post social collegato al locale).
- Profili utente pubblici, seguire persone, feed attività, curatori.
- Profilo del locale arricchito (contenuti social collegati, chi l'ha salvato).
Richiedono nuove tabelle e regole di privacy: Claude prepara una proposta con le schermate e le migrazioni necessarie, Lorenzo approva prima di costruire.
