# Backlog Mapetite — piano 2 settimane verso il test con utenti

Ordine di priorità deciso da Lorenzo (10/10): 1) funzioni che oggi impediscono di far usare l'app ai tester; 2) grafica vicina ai riferimenti; 3) tutto ciò che si può prendere dai concorrenti e migliorare. Social e profili dei locali vengono dopo (Fase 5).

Obiettivo: entro fine ottobre 2026 un'app che un gruppo ristretto di persone possa usare davvero: ricerca precisa, interfaccia chiara, niente errori evidenti.
Stati: PRONTA (si fa in autonomia) · DA DECIDERE (serve risposta di Lorenzo) · IN PR · FATTA.
L'ordine è la priorità. Lorenzo può riordinare o commentare qui o nelle PR.

## Avanzamento verso il 25/10
**Aggiornato 14/10 notte (sessione delle 22:00, PR della notte).** PR #30, #31, #32 unite in produzione. Nessuna voce PRONTA e nessun commento nuovo di Lorenzo: stanotte solo controlli dal vivo e 2 difetti visti corretti (cocktail bar con 🍝; mappa con "Rome"/"Milan" in inglese). Le 10 ricerche di TEST-RICERCHE sono ora tutte provate con Google vero almeno una volta: tutte passano. Per andare avanti servono le decisioni in fondo ("Cosa serve decidere").
**Aggiornato 13/10 alle 04:30 (sessione delle 03:05, PR #32).** Le due PR della sera (#30 e #31) sono unite in una sola, senza conflitti rimasti: basta fare il merge della #32 e chiudere le altre due. Nessuna voce PRONTA rimasta: tutto il resto aspetta una decisione (elenco sotto, "Cosa serve decidere").
**Aggiornato 13/10 mattina (notte 12→13, PR #30).** Fatto in questa notte: primo accesso in 10 secondi, "Stasera dove andiamo?", raccolte organizzabili, condividi un locale con link Mapetite + ritorno dopo la registrazione, "Com'era?", aggiungi a mano, link Instagram/TikTok, il differenziatore visibile (verdetto etichettato, "🧭 messi da parte", "Dai tuoi salvati"), QA completo a 390/360px (27 difetti), copione demo.
**Manca per il 25/10:** chiave Haiku nell'ambiente di prova (verdetti mai visti dal vivo da Claude); migrazione `events` da applicare; prova su iPhone e Android veri; "Collega Google Maps" (da decidere); scelte sulle grafiche fatte in una sola versione; contrasto del corallo (palette).
Aggiornato 12/10 notte. **In produzione (PR #13–#20):** voci 1–8 e 10; lista B collegata alla mappa con foto; home nuova; mappa pulita; feedback; salvati per città; "Ci sono stato"; momento magia e "✨ Per te"; ricerca in corso con card fantasma; link Google Maps per gli orari; ricerche "non turistiche"; barra "✨ Chiedi all'AI…" + "Filtri"; in prova articolo (`?beta=articolo`) e nuovo Salva (`?beta=salva`), accesi da `?stile=places`.
**In PR #21 (notte 11→12/10):** filtri più chiari e risultati dei filtri con intestazione e mappa che si sposta; "Chiedi all'AI / Oppure cerca con i filtri" anche in home; "+ Nuovo tag"; "Ho capito" leggibile; "Chiuso ora" (card, articolo, pin più chiari); "‹ 2 di 8 ›" nella scheda; "📌 Voglio andarci / ✓ Ci sono stato" nella scheda dei non salvati; "Condividi" la lista dei salvati; "Più vicini" e conteggi dei tag nei salvati; salvati del profilo toccabili; "Cerca in quest'area" dopo i filtri; avviso senza rete; "Salta" e "✨ Mostrami i posti per me" nell'onboarding; Esc da computer; "Copia" indirizzo; ricerche recenti in home con "Cancella"; "Questi risultati non vanno?" in fondo al carosello; articolo con "Condividi" e follow-up che continua la ricerca; "🎲 Scegli tu" (`?beta=sorprendimi`); 🎤 per dettare la ricerca (`?beta=voce`, acceso anche da `?stile=places`); scorciatoie dell'app installata; "Apro la mappa…" mentre carica; errori in italiano (onboarding, gusti, importa); correzioni da tre revisioni del codice.
**In PR #23 (contiene la #21 e la #22 già unite, senza conflitti tra loro; branch `claude/cool-rubin-vyvnv0`):** in più, i locali di tutt'altro tipo vanno in fondo (pub per la colazione).
**PR #22 (notte 11→12/10, branch `claude/cool-rubin-s37nql`):** correzioni trovate provando con ricerche Google vere: recensioni e descrizioni in italiano; i primi 5 risultati sempre visibili sulla mappa con il nome; card mai vuote quando manca il verdetto; Da Enzo in fondo nelle ricerche "non turistiche".
**In produzione dalla PR #25 (12/10):** una sola barra di ricerca con frasi d'esempio (mappa e home); "Salvati" nella barra in basso; profilo come "la mia guida"; salva in un tocco; "Nei tuoi salvati" mentre scrivi; pin dei salvati (`?beta=pin-salvati`); "Salva da Google Maps" con link o Condividi (voce 13, livello 1).
**In PR #26:** torna il riquadro "Il verdetto Mapetite" nella scheda (Lorenzo 12/10: "come era fatto mi piaceva"); etichetta dei salvati sulle card; riga tipo/voto/prezzo/distanza leggibile.
**Decisioni di Lorenzo (12/10 mattina):** delle varianti Places tiene solo la **scheda del locale** (ora predefinita per tutti, PR di oggi); per il resto preferisce lo stile attuale, da migliorare perché l'utente trovi subito le informazioni importanti. Ricerca provata da Lorenzo: "va molto meglio"; il verdetto c'è solo sui primi ~10. Nuova priorità: **salvati e profilo** (Fase 2b) e **import semplice dei salvati da Google** (voce 13).
**In PR #31 (notte 12→13/10):** card dei salvati con il verdetto Mapetite (già in memoria, senza costi) e la città; salvati vuoti con "Salva da Google Maps"; indirizzi senza ", Italy"; link di una ricerca aperto a freddo che inquadra i risultati; nomi dei pin che non si sovrappongono; "Password dimenticata?"; "Salva" senza accesso che si completa da solo dopo il login.
**Manca:** prova dal vivo con Haiku (Lorenzo deve aggiungere `ANTHROPIC_API_KEY` all'ambiente cloud: istruzioni date il 12/10); giro con un account vero; risposta sulla quota Google per l'import (voce 13).

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

## Fase 2b — Salvati e profilo: ritrovare subito i propri locali (decisa da Lorenzo il 12/10)
Lorenzo: "sviluppare tutte le funzionalità per salvare e accedere facilmente ai locali salvati nel profilo, così la ricerca va molto più spedita". Tutte senza migrazioni e senza chiamate Google in più (usano `saved_places` e i tag già esistenti). Grafica: stile attuale Mapetite, informazioni importanti in vista (stato, città, distanza, nota).

### 11a. "Salvati" nella barra in basso — FATTA (PR #25)
Voce fissa "Salvati" (icona segnalibro) al posto di "Importa": un tocco apre la mappa sui propri salvati con la lista. "Importa" si sposta dentro Salvati e Profilo ("+ Aggiungi dai tuoi salvati Google").

### 11b. Lista dei salvati divisa per stato — FATTA (già presente: "Tutti", "📌 Voglio andarci · N", "✓ Ci sono stato · N" in testa ai filtri dei salvati; dal profilo si arriva già filtrati)
In cima tre schede: "📌 Voglio andarci · N", "✓ Ci sono stato · N", "Tutti · N" (dai tag "Da provare"/"Già visitato"). Restano città, ricerca, tag e "Più vicini". Card con nota, tag, città e distanza in vista.

### 11c. I tuoi salvati sempre sulla mappa — IN PROVA (PR #25) (`?beta=pin-salvati`, spenta finché Lorenzo non la vede)
Anche in "Esplora" e dopo una ricerca, i locali salvati restano come pin piccoli con il segnalibro corallo (come Mapstr): si vede subito cosa hai già vicino.

### 11d. La ricerca guarda prima nei salvati — FATTA (PR #25 + etichetta "📌 Voglio andarci / ✓ Ci sono stato" sulle card AI nella PR #26)
Quando scrivi nella barra, se qualche salvato corrisponde (nome, tag, nota, tipo, città) compare in cima "Nei tuoi salvati: …" con 1–3 card; tocco = scheda. Filtro fatto nel telefono sui dati già caricati: nessun costo. Nei risultati AI le card dei locali già salvati mostrano "📌 Salvato".

### 11e. Profilo come "la mia guida" — FATTA (PR #25); stile delle raccolte da confermare
In cima numeri toccabili (Salvati · Voglio andarci · Ci sono stato · Città), poi le "raccolte" = i tuoi tag (Romantico, Con amici, …) come riquadri con il numero di locali; tocco = mappa filtrata su quel tag. Niente tabelle nuove.

### 11g. Card dei salvati che dicono qualcosa — IN PR #31 (13/10 notte)
Le card dei salvati erano quasi vuote (nome, tipo, tag). Ora mostrano il verdetto Mapetite quando c'è già in memoria (`place_synthesis`, letto all'avvio: nessuna chiamata) e la città ("Ristorante · Roma"), tolta quando si filtra per città. Salvati vuoti: oltre a "Cerca un locale", "Salva da Google Maps". Indirizzi senza ", Italy" in fondo.

### 11f. Salvataggio in un tocco — FATTA (PR #25)
Il segnalibro su card e scheda salva subito come "Voglio andarci" e mostra un avviso in basso "Salvato · Aggiungi nota" (tocco = apre il foglio con tag e nota). Oggi si apre sempre la finestra: un passaggio in più.

## Fase 3 — Pronta per i tester (notti 10–12)

### 9. Giro completo di controllo — QUASI FATTA (PR #15): manca solo il giro con un account vero
Provati con dati simulati (nessuna scrittura vera): ricerca, scheda, salvataggio con tag e nota, errore del server, rimozione, salvati per città, schermate pubbliche. Bug trovati e corretti in PR #15: barra della scheda fuori schermo a 390px, "Percorso" tagliato dopo il salvataggio, errori di accesso in inglese, campi che facevano zoomare l'iPhone, selettore file in inglese.
Percorsi completi con Playwright a viewport mobile: registrazione, ricerca, apertura scheda, salvataggio, profilo. Correzione dei bug trovati, screenshot di ogni schermata in PR.

### 10. Raccolta feedback dei tester — FATTA 11/10
Voce "Feedback" nella barra in basso: apre un\'email precompilata verso founder.mapetite@gmail.com con pagina e telefono. Scelta di Lorenzo: la cosa più semplice, leggibile dal telefono. Niente database.

### 13. Salvati da Google Maps senza file — livello 1 IN PR (12/10), livello 2 DA DECIDERE
Lorenzo (12/10): "non posso chiedere alle persone di condividere un CSV, non lo faranno mai". Il Takeout è scartato.
**Livello 1 — fatto, nessuna approvazione serviva:** "Salva da Google Maps". In Google Maps apri il locale → Condividi → Copia link → in Mapetite "📋 Incolla link" (anche più link insieme). Su Android, con Mapetite installata, Mapetite compare direttamente nel "Condividi" di Google Maps (`share_target`): un tocco e il locale è salvato come "📌 Voglio andarci". Mapetite legge dal link solo nome e coordinate (segue il link corto senza leggere la pagina: niente scraping) e chiede a Google solo l'ID del locale (Text Search con il solo campo `places.id`, fascia gratuita "IDs Only" — da ricontrollare sul listino). Limiti: alcuni link condivisi non hanno coordinate (formato `?q=Nome,+Indirizzo&ftid=…`) e oggi danno un errore chiaro; servirebbe 1 Place Details a pagamento per link (DA DECIDERE). Non provato con link veri (rete chiusa nell'ambiente di prova). Ogni link conta 1 nella quota giornaliera Text Search (50).
**Livello 2 — "Collega Google Maps" in un tocco (DA DECIDERE):** Google offre la **Data Portability API** (gratuita, pensata per gli utenti UE): l'utente tocca "Collega Google", accetta, e Mapetite riceve in automatico le sue liste salvate (`dataportability.saved.collections`, ambito "Sensibile") e i luoghi con la stella (`dataportability.maps.starred_places`, ambito "Riservato"). Nessun file da gestire. Serve: progetto Google Cloud con schermata di consenso OAuth, verifica dell'app da parte di Google (settimane; per l'ambito "Riservato" anche una valutazione di sicurezza), nuove variabili d'ambiente. Si può iniziare solo con `saved.collections` (verifica più leggera). Poi per ogni locale serve l'ID Google come nel livello 1.

### 15. Pronti per i tester: accesso senza intoppi — IN PR #31 (13/10 notte)
Trovati provando l'app come un tester nuovo. Nessuna migrazione, nessun costo.
- **"Password dimenticata?"** al login: email con link (Supabase) e pagina per la nuova password. Il link funziona anche se l'email si apre in un altro browser. **Da fare per Lorenzo (1 minuto):** in Supabase → Authentication → URL Configuration, aggiungere `https://mapetite-web.vercel.app/reimposta-password` (e, per le anteprime, `https://*-lorenzomapetite.vercel.app/**`) ai "Redirect URLs"; altrimenti il link porta alla home senza far scegliere la password. Il servizio email gratuito di Supabase manda poche email l'ora: per un gruppo di tester basta.
- **"Salva" senza accesso**: prima portava al login e il locale si perdeva. Ora il login dice "Accedi o registrati per salvare “X”" e dopo l'accesso (o la registrazione + onboarding) il locale si salva da solo come "📌 Voglio andarci".
- **Link di una ricerca aperto a freddo**: se i risultati arrivavano prima della mappa, la mappa restava sul punto di chi aveva condiviso (es. Trastevere fuori schermo). Ora si sposta sui risultati.

### 14. Verdetto Mapetite oltre i primi risultati — DA DECIDERE
Oggi Haiku scrive il verdetto solo per i primi 12 (`SYNTHESIS_LIMIT`); dopo il 12° le card mostrano la descrizione o una recensione di Google. Portarlo a 20 circa raddoppia il costo Haiku per ricerca (i verdetti già in cache non si ripagano). Serve l'ok di Lorenzo (regola: non aumentare `SYNTHESIS_LIMIT` senza approvazione).

## Dopo il test con utenti
- Import salvati da Google Maps: vedi voce 13 (link/Condividi fatto; "Collega Google" da decidere).
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
- **Una sola barra di ricerca — IN PR (12/10), accesa per tutti (`?beta=-suggerimenti` per la card di prima)**: richiesta di Lorenzo ("abbiamo ancora due barre, occupiamo solo spazio"; gli piace suggerire frasi pronte). Mappa: niente card in basso, frasi toccabili sotto la barra. Home: frasi tra virgolette e "Filtri" dentro la barra.
- **Filtri più chiari — IN PR #21, per tutti**: "Che tipo di locale?" in cima, distanza e voto a pulsanti, "Azzera", intestazione "Filtri: Pizzerie · entro 3 km · ★ 4,5+" e mappa che inquadra i risultati. Segue la richiesta di Lorenzo (si deve capire che si cerca anche per filtri). Nessun costo.
- **PROPOSTA (dalla ricerca su Beli, 12/10) — Classifica personale dei posti visitati**: dopo "Ci sono stato", una domanda "Ti è piaciuto più o meno di X?" e la tua top 10 per città (Beli trasforma i confronti in un voto 1–10 e li usa per consigliare). Aiuta i tester a tornare nell'app e darebbe a Mapetite un segnale di gusto vero per "Per te". Costo: nessuna chiamata. **Serve una colonna nuova (punteggio) in `saved_places`: DA DECIDERE.**
- **PROPOSTA (Mapstr, 12/10) — Import dei salvati da file Google Takeout/KML/CSV**: Mapstr importa da Google Maps, CSV e KML. Da Takeout arrivano solo nome e link, quindi serve 1 Place Details per locale (con 50/giorno di quota: import grandi impossibili). Possibile solo per file con coordinate (KML) senza costi Google. DA DECIDERE.
- **PROPOSTA (Mapstr, 12/10) — Mappa dei salvati da aprire nel browser senza app**: come già in elenco, serve lettura pubblica (RLS). Per ora c'è "Condividi" con i link (PR #21).
- **"Questi risultati non vanno?" — IN PR #21, per tutti**: ultima card del carosello, email già scritta con ricerca e locali proposti: i tester segnalano le ricerche sbagliate.
- **🎤 Detta la ricerca — IN PROVA (PR #21, `?beta=voce`, acceso da `?stile=places`)**: microfono nella barra come Places, con il riconoscimento vocale del telefono (gratis). Da provare su iPhone: dall'icona sulla Home iOS potrebbe non essere permesso.
- **"🎲 Scegli tu" — IN PROVA (PR #21, `?beta=sorprendimi`)**: nei salvati apre un locale a caso tra quelli mostrati, prima i "Voglio andarci". Nessun costo.
- **Condividi la lista dei salvati — IN PR #21, per tutti**: messaggio con nomi e link Google Maps (senza note private). Alternativa gratuita alla mappa pubblica di Mapstr (quella resta DA DECIDERE: serve RLS).
- **"‹ 2 di 8 ›" nella scheda — IN PR #21, per tutti**: si passa al risultato successivo senza tornare alla lista.
- **Tag scritti da te ("+ Nuovo tag") — IN PR #21, per tutti**: come le raccolte di Places/Mapstr, nella stessa colonna `tags`: nessuna migrazione.
- **Risposta come un articolo — IN PROVA (in produzione dalla PR #19, `?beta=articolo`, accesa anche da `?stile=places`)**: dal carosello "☰ Leggi la risposta" apre la ricerca a tutto schermo come Places (`places-02`): la richiesta, "Ho scelto N posti per te: …", titolo grande, ogni locale con verdetto + motivo, foto grande e Salva; in fondo "Fai un'altra domanda". Nessun costo (dati già arrivati), nessuna migrazione. Niente mini-mappa: sarebbe un caricamento Mapbox in più.
- **Barra "✨ Chiedi all'AI…" + "Filtri" sempre in cima — FATTA (PR #20), accesa per tutti (`?beta=-barra` per l'icona ✨ di prima)**: richiesta di Lorenzo (11/10): si deve capire subito che si può cercare con l'AI o per filtri; la scelta della soluzione è stata lasciata a Claude. Campo fisso in alto (`places-03/04`) con la stellina AI e accanto "Filtri" con la scritta; nella card iniziale "✨ Chiedi all'AI, per esempio:" e "Oppure usa i filtri". Con la barra, le home A e B non hanno più un secondo campo; "Affina" porta il cursore nella barra e mostra sotto i suggerimenti rapidi ("+ economico"…).
- **Nuovo "Salva" — IN PROVA (in produzione dalla PR #19, `?beta=salva`, acceso anche da `?stile=places`)**: foglio dal basso come `places-07` con "📌 Voglio andarci / ✓ Ci sono stato", nota, tag, "Fatto". Stessi tag di prima, nessuna migrazione.
- **Rifiniture dalla prova con Google vero — IN PR (notte 11→12/10)**: (1) Google risponde in italiano (`languageCode: "it"`): prima recensioni e descrizioni nella scheda erano in inglese; stesso costo. (2) Mappa: i primi 5 risultati e il pin della card al centro non finiscono mai in un cerchio "2"/"3"; dopo una ricerca il nome compare solo su di loro. (3) Card e articolo senza verdetto (oltre i primi 12 o se l'AI non risponde): descrizione o recensione di Google invece dello spazio vuoto. (4) Ricerche non turistiche: soglia 2,5× la mediana (era 3×), così Da Enzo a Trastevere va in fondo. Nessuna migrazione, nessuna chiamata in più.
- **Locali di tutt'altro tipo in fondo — IN PR #23, per tutti**: con "colazione", "cocktail bar", "ristorante" i locali con tipo Google chiaramente diverso (pub, birreria, discoteca…) scendono in fondo, mai esclusi; restano se il nome dice il contrario ("Flumen cocktail house" segnato come pub). Rete di sicurezza quando Haiku non c'è. Log `[search-tipo]`. Nessun costo. Sulle 3 ricerche vere del 12/10 non ha spostato nessuno (i risultati erano già giusti); prende il pub irlandese visto l'11/10 nel caso 4.
- **"Ci sei stato?" — IN PROVA (PR #31, `?beta=ci-sei-stato`, spenta di default)**: nel profilo, un locale "📌 Voglio andarci" salvato da più di una settimana con "✓ Sì, ci sono stato" / "Non ancora" (lo nasconde 30 giorni su quel telefono). Le visite sono il segnale di gusto più forte per "Per te" (VISIONE.md), ma quasi nessuno le segna da solo; Albo chiede "Visitato?" sulla scheda. Stessi tag di sempre: nessuna migrazione, nessun costo.
- **Nomi dei pin senza sovrapposizioni — IN PR #31, per tutti**: dopo una ricerca, se il nome di un risultato finirebbe sopra quello di uno più in alto in lista, si nasconde il nome meno importante (il pin resta; il nome torna avvicinando la mappa). Visto sulla ricerca vera "trattoria autentica non turistica a Trastevere": "Hostaria Da Corrado" finiva sotto "Trattoria da Augusto". Nessun costo.
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


## Fase 6 — Dalla visione (VISIONE.md, 12/10): cosa manca per superare i concorrenti
Rilettura del prodotto contro la visione di Lorenzo. Ordine = impatto sulla demo e sul differenziatore.
- **Ranking contro la fama — FATTO (PR del 12/10 pomeriggio)**: le ricerche con i filtri usavano ancora la media bayesiana senza tetto (premiava i locali di massa). Ora oltre 150 recensioni non contano più: vince il voto. Da controllare ogni nuova soglia con la domanda di VISIONE.md.
- **Verdetto sempre — FATTO (stessa PR)**: si mostrano solo i 12 risultati con il verdetto (prima 20, di cui 8 muti). Resta da fare: verdetto anche per i salvati che non l'hanno (backfill Haiku, costo da stimare: DA DECIDERE).
- **"Per te" dai comportamenti — PRIMO PASSO IN PR (12/10 sera): "✨ Come <salvato>, che hai salvato" sulle card; il riordino resta da fare quando ci saranno dati veri**: i risultati AI si riordinano un poco verso ciò che la persona ha già salvato (tipi, fascia di prezzo, zone, tag come "Romantico") e la card lo dice: "✨ Simile a Trattoria X che hai salvato". Primo uso concreto dei segnali impliciti, calcolato nel telefono sui dati già caricati. Mai sopra un locale più adatto alla richiesta: solo a parità.
- **Raccogli dai social in un gesto — IN PR (12/10 sera), non provato su un Android vero**: oggi da Instagram/TikTok si condivide solo il link (la didascalia non si può leggere senza scraping). Mapetite diventa destinazione anche per le **immagini** condivise: screenshot di un post o di una storia → "Condividi" → Mapetite → l'import da screenshot che esiste già (Haiku legge nome e città) → salvato. Costo: quello attuale dell'import da screenshot. Su iPhone resta "Importa → screenshot".
- **Segnali di comportamento registrati — CODICE IN PR (12/10 sera), MIGRAZIONE DA APPROVARE (`supabase/migrations/20261012_create_events.sql`): finché non è applicata non si registra nulla**: tabella `events` (utente, tipo: ricerca / filtro / apertura scheda / salvataggio / "ci sono stato" / percorso, locale, zona, momento; mai testo libero personale). È la base del motore di raccomandazione e dei dati per i ristoratori ("cosa cerca la gente nella tua zona"), che vanno progettati da subito. Serve: migrazione + RLS + informativa privacy. Prima si raccoglie, prima i dati valgono.
- **Collega Google Maps in un tocco — DA DECIDERE** (voce 13, livello 2).
- **Densità Roma e Milano — FATTO (12/10 sera)**: 5 casi su Milano in TEST-RICERCHE, provati dal vivo; "aperitivo sui Navigli non turistico" era sbagliato (locali da turisti in cima), corretto.
- **Protezione dei costi AI — IN PR (12/10 sera, approvata da Lorenzo): 30 ricerche AI/ora per persona, 1.500 azioni AI/giorno per server; tetto di spesa vero = credito prepagato Anthropic senza ricarica automatica.** Testo originale della proposta: chi non ha fatto login può far partire Haiku (ricerca, import da screenshot) senza limiti; su Google ci protegge la quota giornaliera, su Haiku nessun tetto. Proposta: limite di richieste per telefono/indirizzo (es. 30 ricerche AI all'ora) e avviso di spesa sulla console Anthropic. Nessun costo.

## Notte 12→13/10 (PR della notte)
- **Primo accesso in 10 secondi — IN PR**: tre schermate sulla home per chi arriva la prima volta (raccogli / ritrova / posti giusti per te), "Salta", "Crea il tuo account" o "Prova senza account"; "Come funziona" per rivederla. DA APPROVARE la grafica (una sola variante); la card d'esempio è etichettata "esempio".
- **"Stasera dove andiamo?" — IN PR**: `/stasera`, tre proposte dai propri salvati (occasione = le tue raccolte, dove = vicino / città / ovunque, mai provati o anche visitati), prima i "Voglio andarci" e i più vicini, mai il voto Google (VISIONE: non il più popolare). Dal profilo, da "I miei salvati" e dalla scorciatoia dell'app.
- **Aggiungi a mano + link Instagram/TikTok — IN PR**: su Importa "✍️ Aggiungi a mano" (nome e città → 5 risultati → Salva, 1 ricerca Google per tocco su Cerca); i link di Instagram/TikTok/Shorts spiegano di fare uno screenshot e propongono "Cerca '…'" se nel testo c'è un nome.
- **Etichetta "Il verdetto Mapetite" sulle card — IN PR.**
- **Organizza nel profilo — IN PR**: ogni raccolta ha "⋯" con Rinomina / Unisci con… / Elimina (i locali restano salvati); "+ Nuova raccolta" scegliendo tra i salvati; "Le tue ricerche" (come `places-12`) con "Cerca di nuovo". Nessuna migrazione: le raccolte sono i tag.
- **Salvati vuoti — IN PR**: "La tua mappa è ancora vuota" con Da Google Maps / Da uno screenshot / A mano.
- **"🧭 Ho messo da parte N locali turistici (…)" — IN PR**: il differenziatore si vede sotto "Ho capito".
- **"✨ Dai tuoi salvati: Bar a Roma, poco conosciuti" — IN PR**: proposta dal tipo e dalla città dei tuoi salvati, cercata "poco conosciuti".
- **Condividi un locale con un link Mapetite — IN PR**: "Condividi" manda `/locali/<id>`, pagina pubblica con foto, verdetto Mapetite (solo se già in cache), Percorso e "📌 Salva in Mapetite" per chi la riceve; anteprima per WhatsApp. Sostituisce la vecchia pagina `/locali/[id]` non collegata (il suo modulo recensioni resta nella scheda della mappa). Limite: dopo la registrazione l'amico non torna alla pagina (serve un "next" nel flusso di accesso).
- **"Com'era?" — IN PR**: dopo "Ci sono stato", 👍 Mi è piaciuto / 👎 Non fa per me (tag, nessuna migrazione); "Stasera" non ripropone i 👎 e i suggerimenti dai salvati li ignorano.
- **Controllo qualità a 390 e 360 px — IN PR**: 16 difetti corretti (nomi delle raccolte spezzati, testi tagliati nei campi, link troppo piccoli, striscia bianca su Stasera, pulsanti fuori stile, barra su iPhone installata); elenco e difetti lasciati in `docs/autonomia/QA-2026-10-13.md`.
- **Copione della demo in 3 minuti — `docs/autonomia/DEMO.md`.**
- **Dopo l'accesso si torna dove si era — IN PR**: parametro `next` controllato (niente rimandi verso altri siti) da login, registrazione, email di conferma e onboarding; il locale condiviso torna con "Ci sei! Tocca qui sotto per salvarlo". DA FARE da Lorenzo: in Supabase → Authentication → URL Configuration, controllare che i "Redirect URLs" accettino `…/login?next=…` (es. `https://<dominio>/login*`).
- **Controllo qualità della mappa e della scheda — IN PR**: 11 difetti corretti (verdetto delle card di nuovo su 2 righe: le card non coprono più i pin; avviso "Salvato" sopra la barra azioni; "›" apre il locale dall'inizio; zoom iPhone sul commento; pulsanti piccoli). DA DECIDERE (in `QA-2026-10-13-mappa.md`): a 360px l'intestazione dei risultati lascia poca mappa; pulsanti secondari da 36px.

## Mattina 13/10 (sessione delle 03:05, PR #32)
- **PR #30 + PR #31 in una sola — IN PR #32**: 8 file in conflitto risolti tenendo entrambe le parti (salvati vuoti con i tre modi di salvare; "Ci sei stato?" sopra le raccolte; verdetti dei salvati riusati anche nelle ricerche con "🧭 messi da parte"). Giro automatico: 497 controlli, TUTTO OK.
- **Cocktail bar con 🍸 — IN PR #32**: avevano il boccale di birra su pin e card (visto nella ricerca vera sui Navigli). Regola aggiunta prima di "bar", nessuna regola spostata: cambia solo chi aveva 🍺 e ha "cocktail" nel tipo o nel nome.
- **5 ricerche Google vere (casi 2, 3, 5, 6, 9)**: tutte con almeno 3 risultati giusti nei primi 5 e nessun locale "da non proporre". "🧭 Ho messo da parte" funziona dal vivo (Trastevere: Da Enzo, Nannarella, Tonnarello…; Navigli: Spritz Navigli, La Prosciutteria…). Verdetti Haiku non provati: manca `ANTHROPIC_API_KEY` nell'ambiente di prova.

## Notte 13→14/10 (sessione delle 22:00)
- **Controlli su main dopo il merge della #32**: giro automatico 497 controlli TUTTO OK; `tsc` ok; eslint invariato (11 errori, 5 warning preesistenti).
- **5 ricerche Google vere (casi 1, 4, 7, 8, 10)**: tutte con almeno 3 risultati giusti nei primi 5 e nessun locale "da non proporre". Insieme a quelle del 13/10 mattina (2, 3, 5, 6, 9) i 10 casi sono tutti provati dal vivo. Verdetti Haiku ancora non provati (manca `ANTHROPIC_API_KEY`).
- **Cocktail bar con 🍸 anche se il nome dice "Restaurant" — IN PR**: "The Vista Rooftop | Pantheon Terrace Bar & Restaurant" (tipo Google cocktail_bar) aveva gli spaghetti. Sui 60 locali delle ricerche vere cambia solo lui. Controlli in `scripts/e2e/regole-ricerca.mjs`.
- **Mappa in italiano — IN PR**: "Roma", "Milano" invece di "Rome", "Milan" (opzione `language` di Mapbox, nessun costo).
- **Dubbio da decidere (ricerca)**: con "trattoria milanese **autentica** con cotoletta" la regola dei locali di massa mette da parte Al Garghet (trattoria fuori dal centro) e lo annuncia sotto "🧭 Ho messo da parte … turistici". "Autentico" oggi vale come "non turistico": una trattoria con tante recensioni ma lontana dai giri turistici finisce in fondo ed è chiamata turistica, cosa forse non vera (VISIONE: mai inventare). Non ho verificato i numeri di Al Garghet: era oltre il 12° posto. Proposta: far scattare la regola solo con "non turistico / poco conosciuto / nascosto / dove vanno i …", non con "autentico" da solo. Non toccato senza ok.

## Cosa serve decidere (in ordine di impatto per il 25/10)
1. ~~Merge della PR #32~~ (fatto 13/10). Resta: in Supabase → Authentication → URL Configuration aggiungere ai Redirect URLs `…/login*` e `…/reimposta-password`.
2. **Migrazione `events`** (`supabase/migrations/20261012_create_events.sql`, DA APPROVARE): senza, i segnali di comportamento non si registrano. Prima parte, prima i dati valgono.
3. **`ANTHROPIC_API_KEY` nell'ambiente cloud di prova**: i verdetti non sono mai stati provati dal vivo da Claude.
4. **Voce 14**: verdetto su 20 risultati invece di 12 (`SYNTHESIS_LIMIT`, raddoppia il costo Haiku per ricerca).
5. **Grafiche fatte in una sola versione**: primo accesso (3 schermate); accendere per tutti "Ci sei stato?" (`?beta=ci-sei-stato`), pin dei salvati (`?beta=pin-salvati`), gemme (`?beta=gemme`), nuovo Salva (`?beta=salva`, mostra il nome del locale).
6. **Voce 13, livello 2**: "Collega Google Maps" con la Data Portability API.
7. **Classifica personale dei visitati** (serve una colonna in `saved_places`).
8. **Eliminare le pagine vecchie non collegate** (`/miei-locali`, `site-header`).
9. **"Autentico" = "non turistico"?** (dubbio della notte 13→14/10, sopra): oggi sì; proposta di no.

## Fase 5 — Social e profili dei locali (dopo il 25/10, DA DECIDERE)
Lorenzo vuole sviluppare un layout completo per la parte social e per i profili dei locali. Riferimenti: Places (`places-06` Discover, `places-08` attività, `places-09` curatori) e Albo (`albo-09` post social collegato al locale).
- Profili utente pubblici, seguire persone, feed attività, curatori.
- Profilo del locale arricchito (contenuti social collegati, chi l'ha salvato).
Richiedono nuove tabelle e regole di privacy: Claude prepara una proposta con le schermate e le migrazioni necessarie, Lorenzo approva prima di costruire.
