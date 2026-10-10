# Riferimenti di design e funzioni

Screenshot in `docs/autonomia/riferimenti/`. Guardali prima di toccare qualsiasi interfaccia.
Regola: si prende spunto da struttura, gerarchia ed esperienza d'uso. Non si copiano marchio, logo, testi o palette. Mapetite resta teal `#1a3c40` + corallo `#ff6b4a`.

## Places — riferimento principale (layout e sensazione)
Scelto da Lorenzo come app che gli piace di più per layout. Look editoriale, calmo, "da rivista".

- **Home = ricerca** (`places-01`): logo al centro, grande campo "Cosa cerchi?" in basso con microfono, 2–3 suggerimenti cliccabili sopra il campo. Nessun rumore.
- **Risposta AI editoriale** (`places-02`): frase di apertura, titolo grande ("Rome essentials"), sottotitolo, mini-mappa, poi ogni locale con 1–2 righe scritte come un consiglio di un amico, foto grande, "Saved". Campo "Fai un'altra domanda" fisso in basso. → È il modello per la risposta della ricerca AI di Mapetite: la sintesi Haiku e il matchReason si prestano esattamente a questo formato.
- **Mappa** (`places-03`, `04`): pin con miniatura foto + nome; chip filtro in alto ("Table Tonight", "Newly opened"); in basso un **carosello orizzontale di card scure a foto piena**: nome in serif, categoria in maiuscoletto monospazio, pill "Aperto ora", descrizione di una riga, 2 chip di punti forti. → Modello per la voce 5 (lista risultati).
- **Scheda locale** (`places-05`, `10`): carosello foto a tutta larghezza, nome grande serif, "Città · distanza", "Categoria · prezzo", pill "Aperto ora", azione principale "Voglio andarci", chip dei punti forti (incluso "Per te"), descrizione breve, **barra azioni flottante** (Prenota / minuti a piedi / Salva; Chiama / Percorso / Salva). → Modello per la voce 6. I chip `go_for` e il verdetto Mapetite vanno qui.
- **Salvataggio** (`places-07`): bottom sheet con "Voglio andarci" / "Ci sono stato", nota privata, raccolte. → Proposta futura: stati del salvato + raccolte (serve migrazione: DA DECIDERE).
- **Discover / People** (`places-06`, `08`, `09`): feed a foto piena per categoria, curatori, attività di chi segui. → Social: escluso finché non ci sono utenti reali.
- **Storico ricerche** (`places-12`). → Collegato a `search_logs` (DA DECIDERE).

## Albo — riferimento per primo accesso, salvataggio e tono
- **Onboarding** (`albo-01`…`07`): barra di avanzamento, una domanda per schermata, risposte a pillole grandi, momento "magia" (mostra subito cosa sa fare l'app), pagina motivazionale. → Modello per la voce 7 (primo accesso guidato), senza paywall.
- **Aggiungi qualsiasi cosa** (`albo-11`): sheet con card grandi e icone a oggetto: incolla link, screenshot, import in blocco, note. → Modello per l'import (screenshot già esistente in Mapetite, import Google Maps in coda).
- **Mappa con emoji** (`albo-08`) e **schede** (`albo-09`, `10`): emoji come avatar del locale, nome + categoria sotto il pin, post social collegato al locale, "Visitato?" / "Wanna", nota privata. → L'emoji per categoria esiste già in Mapetite (`src/lib/emoji.ts`): rafforzarla.
- **Libreria** (`albo-12`): stati vuoti curati con invito all'azione ("Mostrami come").

## Vecchio MVP di Simone — cosa tenere e cosa evitare
- Da tenere come idee: interruttore Preferiti / Esplora, filtri categoria a chip con emoji (`vecchio-mvp-02`), "Cerca in quest'area", riga azioni Chiama / WhatsApp / Prenota / Raggiungi (`11`).
- Da evitare: contenuti finti (recensioni "Marco R.", indirizzi inventati, schede senza foto — `08`, `09`), viola generico, mappa affollata di pin Google non pertinenti, risultati AI non legati a locali reali.

## Mapstr
Nessuno screenshot ancora. Lorenzo lo considera simile a Mapetite nelle funzioni ma meno bello graficamente.

## Cosa deve fare meglio Mapetite
- Verdetto AI + "perché fa per te" visibili in ogni card e scheda (nessun concorrente li ha così).
- Risultati rilevanti alla richiesta (vedi `TEST-RICERCHE.md`).
- Contenuti solo veri: niente placeholder.

## Decisioni grafiche aperte (chiedere a Lorenzo, proporre 2 varianti)
- Font dei titoli: oggi Poppins; Places usa un serif editoriale. Variante B con serif per nomi locali e titoli.
- Card risultati scure a foto piena (stile Places) vs card chiare (attuali).
