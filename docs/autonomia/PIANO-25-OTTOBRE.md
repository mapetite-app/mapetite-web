# Piano fino al 25 ottobre 2026 — Mapetite completa per i tester

Riscritto il 15/10 dopo il feedback di Lorenzo: "deve essere 100 volte di più". Le sessioni notturne lo seguono prima di `BACKLOG.md`.

## Cosa deve essere Mapetite il 25/10 (parole di Lorenzo, 15/10)
L'app che **risolve qualunque problema nella scelta del food & beverage**: ti fa scoprire posti nuovi e gente nuova, ti semplifica la vita, ti stuzzica a provare qualcosa di diverso invece dei soliti posti. Il passaparola passa da Mapetite: vedi il profilo di un amico, dove è stato, cosa ha salvato, e condividi.
Il business è soprattutto **B2B**: i ristoratori pagheranno pagine verificate, pubblicità mirata e trend di chi usa l'app. Senza base utenti non si vende niente, quindi il 25/10 serve un prodotto che i tester usino davvero, e **dati per dimostrarlo**.

Vincoli fissi: Google 20 €/mese e quote invariate; nessun servizio a pagamento nuovo; nessun contenuto Google salvato sui nostri server; niente scraping.

---

## 1. Assistente Mapetite (la ricerca diventa una conversazione)
- **1.1 Chat con l'assistente**: dalla barra "Chiedi all'AI" si apre una conversazione. Risposte con card dei locali veri, domande di chiarimento ("Per quante persone? Che zona?"), seguiti ("più economico", "solo con terrazza", "e per dopo cena un cocktail bar vicino?").
- **1.2 Serata completa**: "organizzami sabato sera: aperitivo, cena, dopocena a Trastevere" → percorso a tappe sulla mappa, con distanze a piedi.
- **1.3 Prenotazione assistita**: "prenotami domani alle 21 per 2 con terrazza a Roma". L'assistente trova i locali giusti e aperti a quell'ora, poi prepara la prenotazione: link di prenotazione del locale se c'è (sito o piattaforma), altrimenti **messaggio già scritto** per WhatsApp, chiamata o email ("Buonasera, vorrei prenotare per 2 persone domani alle 21, in terrazza se possibile. Lorenzo"). L'utente conferma con un tocco. Promemoria e "Com'è andata?" il giorno dopo.
  - *Limite onesto*: la prenotazione **automatica** senza tocco richiede accordi con TheFork/OpenTable o con i locali (API riservate ai partner). Per il 25/10 il tocco di conferma resta; l'automatico arriva con i primi ristoratori partner (vedi 8).
- **1.4 Memoria dei gusti**: l'assistente ricorda preferenze dichiarate e comportamenti ("non ami il pesce", "spesso a Monti") e le usa senza chiederle ogni volta.
- **1.5b Le mie prenotazioni** (dal MVP): sezione con prenotazioni richieste, in corso e passate, con stato (richiesta / confermata da me / fatta), promemoria e "Com'è andata?".
- **1.5 Voce**: dettatura 🎤 accesa per tutti nell'assistente.

## 2. Ricerca, filtri e posizione
- 2.1 **Dove?** nei filtri e città intera (FATTO 15/10). Aggiungere: "vicino a me adesso", raggio sulla mappa trascinando, "lungo il mio percorso".
- 2.2 **Filtri completi**: tipo, cucina (romana, giapponese, napoletana…), prezzo, voto, aperto ora/aperto a un'ora scelta, occasione (appuntamento, amici, lavoro, famiglia, da solo), caratteristiche (terrazza, all'aperto, vista, dehors, cani ammessi, vegetariano/vegano, senza glutine, prenotabile, gruppi), "poco conosciuto" 💎.
- 2.3 **Suggerimenti di partenza** legati a ora, meteo e giorno ("Aperitivo all'aperto, oggi 22°"), e ai tuoi gusti.
- 2.4 **Prima card in ~2 s** dalla home (oggi ~5).
- 2.5 **"Sorprendimi"** fuori dai salvati: un posto mai provato che probabilmente ti piace, con il perché.

## 3. Raccogliere e importare (Raccogli, VISIONE)
- 3.1 Salva in un tocco da qualsiasi schermata (c'è); stati "Voglio andarci / Ci sono stato".
- 3.2 **Import da Instagram, TikTok, YouTube, Google Maps**: link singoli (c'è), più link incollati insieme, screenshot multipli, **file di Google Takeout/KML** con import in blocco senza costi Google quando ci sono le coordinate.
- 3.3 **Condividi verso Mapetite** da qualsiasi app su Android (c'è), e istruzioni per iPhone (scorciatoia).
- 3.4 **Dal reel al tavolo**: il locale salvato da un video mostra il video collegato nella scheda.

## 4. Organizzare e ritrovare (Organizza, Ritrova)
- 4.1 **Raccolte** come cartelle con copertina, ordinabili, condivisibili; raccolte automatiche ("Romantici", "Per il pranzo veloce", "Viaggio a Milano") proposte dall'AI sui tuoi salvati.
- 4.2 **Riclassificazione automatica**: l'AI propone tag e raccolte per i salvati senza tag; un tocco per accettare.
- 4.3 **Classifica personale** "Ti è piaciuto più di X?" (Beli) e top per città.
- 4.4 **Diario**: posti visitati con data, nota, voto personale, foto tua (le tue, non di Google).
- 4.5 **Ricerca nei salvati** in linguaggio naturale ("quel giapponese che avevo salvato a Milano").

## 5. Social (passaparola dentro Mapetite)
- 5.1 **Profilo pubblico** (scelta dell'utente): foto, nome, città, raccolte pubbliche, posti visitati, top personale.
- 5.2 **Segui** amici e persone; **feed attività** ("Giulia ha salvato Mariù", "Marco è stato da…").
- 5.3 **Mappa di un amico**: vedi sulla mappa i posti di chi segui; "3 amici ci sono stati".
- 5.4 **Condividi** un locale, una raccolta o la tua mappa con un link che si apre anche senza app; invito a Mapetite dentro il link.
- 5.5 **Liste di gruppo**: "Cene del giovedì" con amici, ognuno aggiunge posti, voto per scegliere.
- 5.6b **Creator e critici** (pitch): profili di food blogger e guide con liste curate da seguire; badge "Creator".
- 5.6c **Recensioni e foto degli utenti** (MVP): la tua valutazione, il tuo commento, le tue foto sul locale, visibili agli amici e (se pubblico) a tutti. Mai mescolate ai dati Google.
- 5.6d **Reel e contenuti** (MVP): pagina con i video/reel collegati ai locali (da link Instagram/TikTok/YouTube salvati dagli utenti, con l'anteprima ufficiale oEmbed, niente scraping).
- 5.6 **Trova amici** dai contatti/link d'invito; classifica di chi scopre più posti nuovi (gioco leggero).

## 6. Grafica e sensazione da app (non da sito)
- 6.1 **Card dei risultati stile Places** (IN CORSO 15/10): più basse, copertina col colore della cucina, verdetto e perché sempre visibili.
- 6.2 **Scheda locale** stile Places: carosello foto, barra azioni fissa (Prenota, Percorso, Salva), verdetto in evidenza, "chi dei tuoi amici c'è stato".
- 6.3 **Transizioni e gesti** da app: pannelli che scorrono, tocco con feedback, niente salti, caricamenti con segnaposto, schermo iniziale (splash), icona e nome sull'iPhone.
- 6.4 **Barra in basso** ridisegnata: Esplora, Assistente, Salvati, Amici, Profilo.
- 6.5 **Versione web da computer** degna: mappa grande a sinistra, lista a destra.
- 6.6 Controllo qualità a 390 e 360 px con screenshot affiancati ai riferimenti, ogni sera.

## 7. Tracciamento (per capire se Mapetite ha senso)
- 7.1 **Eventi di uso** su ogni funzione (ricerca, assistente, filtri, salva, import, condividi, segui, prenota…) nella tabella `events` (c'è da oggi).
- 7.2 **Sessioni e ritorni**: chi torna dopo 1, 3, 7 giorni; quante volte a settimana; durata.
- 7.3 **Imbuti**: ricerca → apertura scheda → salva/prenota; dove si abbandona.
- 7.4 **Funzioni più e meno usate**, ricerche senza risultati utili, errori e blocchi (errori del telefono registrati automaticamente, con la pagina in cui succedono).
- 7.5 **Pannello di Lorenzo** (pagina protetta): tutti questi numeri, per giorno e per tester.
- 7.6 **"Ti è stato utile?"** in un tocco dopo ricerche e prenotazioni, e domanda settimanale breve.

## 8. Lato ristoratori (B2B, il modello di business)
- 8.1 **Pagina del locale verificata**: "Sei il titolare? Rivendica" → richiesta di verifica; il titolare aggiorna foto proprie, menu, orari speciali, eventi.
- 8.2 **Pannello del ristoratore** (versione dimostrativa per gli investitori con dati veri aggregati): quante persone hanno visto, salvato, prenotato il locale; cosa cerca la gente in zona ("terrazza", "brunch", "vegano") e a che ora.
- 8.3 **Posti in evidenza (sponsorizzati)** dichiarati come tali, mostrati solo se adatti alla ricerca (mai contro la richiesta: VISIONE).
- 8.3b **Piani per ristoratori** (pitch): Verified (profilo verificato, info, link prenotazione, numeri base), Growth (contenuti premium, cosa cercano e salvano gli utenti, priorità organica migliorata), Pro (numeri avanzati, trend e confronto di zona, strumenti promo). Per il 25/10: pagina "Per i ristoratori" con i piani e il percorso di richiesta (senza pagamenti).
- 8.4 **Trend di zona** (anonimi e aggregati) come prodotto da vendere.
Per il 25/10: 8.1 e 8.2 in versione dimostrativa; 8.3 e 8.4 come schermate per la presentazione, attive quando ci saranno ristoratori.

## 8b. Utente premium (dopo il 25/10, da preparare)
- Funzioni premium per gli utenti (dal business plan): ad esempio assistente senza limiti, mappe e raccolte illimitate, serate organizzate. Per il 25/10 solo l'elenco di cosa sarà premium, nessun pagamento.

## 9. Pronti per i tester
- 9.1 **Invito**: link personale, primo accesso in 3 schermate, import dei salvati da Google Maps proposto subito.
- 9.2 **Account demo** con salvati realistici a Roma e Milano; copione demo per gli investitori.
- 9.3 Prova su iPhone e Android veri (Lorenzo).
- 9.4 24/10 solo correzioni; 25/10 link ai tester.

---

## Come si lavora (ritmo)
- Più sviluppatori in parallelo, ognuno su una parte diversa dell'app, uniti in main ogni sera dopo i controlli (giro automatico, build, prove vere).
- Ogni sera: PR unita in produzione, elenco di cosa è cambiato, screenshot.
- Ogni funzione nuova manda i suoi eventi al tracciamento (punto 7) dal primo giorno.

## Ordine di attacco
1. **Subito (15–16/10)**: 7.1–7.5 tracciamento e pannello; 6.1 card; 1.1 + 1.3 assistente e prenotazione assistita; 5.1–5.4 profili, segui, condividi.
2. **17–18/10 (weekend, tutto il giorno)**: 2.2 filtri completi, 4.1–4.3 raccolte e classifica, 6.2–6.4 scheda e barra, 8.1–8.2 ristoratori, 3.2 import in blocco.
3. **19–22/10**: 1.2 serata completa, 1.4 memoria, 2.3–2.5, 5.5–5.6, 4.4–4.5, 6.5, 7.6, 9.1–9.2.
4. **23–24/10**: controllo qualità, velocità, correzioni. 25/10: tester.
