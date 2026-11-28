# Retro del sabato

Bilancio della settimana, scritto dalla prima sessione del sabato (regola del team gstack). Fonti: `git log` di `main`, PR, `BACKLOG.md`, database di produzione.

## Settimana 21–27/11 (scritta sabato 28/11 alle 04:00, sessione delle 03:05)

### Cosa è stato fatto
- **In produzione (PR #177–#207):** 75 "prova con un reel", 74 e 56 (voto di gruppo), "Manda al gruppo" dalle raccolte, 72 "Avvisami quando c'è posto" (spenta finché mancano le chiavi), 52 "Salva il primo posto", 30 "Salvati di Instagram", 76, 78 "Potrebbe piacerti anche", app iPhone pronta da firmare (Condividi, accesso Google nativo), Segnala e nascondi con pagina Aiuto, persone nascoste, 84, 49, 87, 89 "Cena delle feste?", 90 "Menu delle feste", 88 "Già salvati da più di voi", segnali della scheda compatti.
- **Spente dopo due bocciature:** 91 "Per chi è celiaco" (27/11; ripresa oggi con il ✓ confermato dall'AI). **Fermata dal CEO:** 86 (1 frase utile su 40 locali), 38 (catalogo).

### Cosa è andato
- **Una sessione ogni notte, merge quasi ogni notte**, nessuna produzione rotta, nessun revert.
- **La doppia chiave regole + AI regge:** dove le regole da sole sbagliano (ironia, passato, "altro locale"), la conferma dell'AI a due giri le corregge. Oggi sulla 91: regole 9 ✓ falsi su 18 trabocchetti, con l'AI 0.

### Cosa non è andato
1. **Ancora nessuno usa l'app.** Database di produzione al 28/11: 7 utenti, **0 nuovi, 0 accessi e 0 posti salvati negli ultimi 7 giorni** (36 salvati in tutto). Seconda settimana di fila a zero.
2. **App Store fermo da 5 giorni:** il pacchetto iPhone è pronto dal 23/11, manca l'iscrizione Apple di Lorenzo (DA-FARE 14 e 15). Senza, niente TestFlight e niente tester.
3. **Proposte stagionali e di nicchia (89, 90, 91, 92)** danno valore vero ma a pochi; nessuna porta un utente nuovo dentro.

### 3 cambi per la settimana dopo
- **Prima della notifica di ogni sessione, una riga con i numeri d'uso** (utenti, accessi, salvati a 7 giorni), così Lorenzo vede che il collo di bottiglia sono i tester, non le funzioni.
- **Appena c'è l'iscrizione Apple: TestFlight prima di qualsiasi altra voce** (Prossima sessione, voce 1).
- **Voci nuove solo se entrano nel copione demo di 3 minuti (`DEMO.md`)** o se aiutano i primi 10 tester a restare (primo accesso, salva dal reel, avvisi).

### Revisione dei documenti del team
- **`PROPOSTE.md`:** 74–93 nuove in due settimane; fatte 30, 49, 52, 56, 72, 74–76, 78, 84, 87–90; 91 in seconda versione; 92 in costruzione; 93 (AFC con AIC) e 70 restano a Lorenzo.
- **`COMPETITOR.md`, `PROBLEMI.md`, `PARTNER.md`:** aggiornati ogni giorno (problemi fino al 38). In `PARTNER.md` le bozze per AIC, Quandoo e TheFork aspettano Lorenzo; nessun contatto partito, giusto così.

## Settimana 14–20/11 (scritta sabato 21/11 alle 03:30, sessione delle 03:05)

### Cosa è stato fatto
- **In produzione (18 PR unite, #143–#174):** Salvati a copertine, profilo dell'amico e Prenota (richieste di Lorenzo dell'8/11, sbloccate il 14/11); inviti tra amici e "Scegli tra 3"; "Te l'ha consigliato Giulia"; lucchetto "Solo per me" su posti e raccolte; "Nessun tetto"; recensisce solo chi ha segnato la visita; "Quanto si spende davvero"; prezzo a testa detto dal locale; "Perché ti piacerà" e "Fuori dai miei gusti"; "L'avevi salvato perché…"; "Da quando parla il verdetto"; "Dai un feedback" per i tester; "Dove c'è posto" tra i salvati; "Perché è qui" sull'ordine dei risultati.
- **Fermate dal CEO (4 su 4 voci che leggono il testo delle recensioni con regole):** 50 (lingua delle recensioni), 51 "Da ordinare", 60, 73 "il piatto chiesto". Con le 5 recensioni di Google le regole danno o frasi false o nessuna riga.
- **Ferma da Lorenzo:** 70 "Scarica i tuoi salvati" (termini Google, DA-FARE voce 12).

### Cosa è andato
- **Ritmo:** una sessione ogni notte, nessun buco (la settimana prima ne aveva 5), PR unite quasi ogni notte.
- **Il CEO ha fermato voci approvate dal design ma false sui dati veri** (50, 51): si è misurato su ricerche Google vere prima del merge, come vuole `VISIONE.md` ("mai inventare").

### Cosa non è andato
1. **Nessuno usa l'app.** Database di produzione al 21/11: 7 utenti in tutto, **0 nuovi e 0 accessi negli ultimi 7 giorni, 1 posto salvato, 0 segnalazioni** da "Dai un feedback". Abbiamo costruito 18 PR di dettagli (pillole, righe sotto il verdetto) per nessuno: il gruppo di tester di fine ottobre non è mai partito.
2. **Troppe voci piccole e invisibili:** righe grigie sotto il verdetto, frasi nel pannello; nessuna si nota in una demo da 3 minuti.
3. **Le voci sul testo delle recensioni sono state costruite 4 volte prima di capire che il dato non basta:** almeno 4 sessioni spese.

### 3 cambi per la settimana dopo
- **Niente voci nuove sul testo delle recensioni con regole** (bocciate 4 su 4): solo dati strutturati (Google, salvati, locale).
- **Prima voce della settimana: ciò che porta i primi tester dentro** (DA-FARE voci 3 e 9: telefoni veri, account demo): il CEO lo ricorda a Lorenzo nella notifica, con i numeri del database.
- **Ogni voce nuova deve vedersi nel copione demo di `DEMO.md`**; se non entra nel copione, passa dopo.

### Revisione dei documenti del team
- **`PROPOSTE.md`:** 66–73 nuove in settimana; fatte 46, 48, 54, 61, 62, 64–69; fermate 50, 51, 60, 73; 71 ferma (dipende dalla 51); 70 a Lorenzo. Prossime: 38 (catalogo per l'import, in corso il 21/11), 56 "Manda al gruppo".
- **`COMPETITOR.md`, `PROBLEMI.md`, `PARTNER.md`:** aggiornati ogni giorno dal CEO che chiude (problemi 24–30); nessun contatto partito, giusto così. `PARTNER.md`: le bozze Quandoo/TheFork aspettano Lorenzo dall'8/11 (DA-FARE voce 10).

## Settimana 7–13/11 (scritta sabato 14/11 alle 18:50, sessione delle 18:05)

### Cosa è stato fatto
- **In produzione (5 PR unite il 7 e l'8/11: #136–#140):** primo accesso e home approvati (8,6); demo provata dal vivo in produzione; la ricerca resta ricaricando; chi ha già salvati salta il primo accesso; famosi messi da parte in vista; Salva in un tocco dalla scheda; prima ricerca adatta all'ora.
- **Fermo:** le richieste di Lorenzo dell'8/11 (Salvati a scaffali, profilo dell'amico, Prenota con promemoria) sono rimaste in tre PR mai unite (#141, #142, #143), bocciate quattro volte dai revisori tra 7,0 e 8,2.
- **Nessuna sessione dal 9 al 13/11** (motivo non scritto da nessuna parte: probabilmente limiti di utilizzo).

### Cosa è andato
- **Le richieste di Lorenzo sono state prese tutte**, con commit separati per schermata e il giro che è cresciuto (2.389 controlli).
- **Decisione rapida quando serviva:** Lorenzo il 14/11 ha sbloccato il merge sotto 8,5 in chat.

### Cosa non è andato
1. **Cinque giorni senza nessuna sessione** e nessuna traccia del perché: Lorenzo non lo sa.
2. **La regola "alla terza bocciatura si ferma e si scrive a Lorenzo" (retro del 7/11) non è stata applicata:** le tre schermate sono passate da revisore a revisore per tre sessioni, sempre tra 7,5 e 8,2, senza una notifica a Lorenzo. È stato Lorenzo a doverlo chiedere.
3. **Il social era rotto alla radice e nessuno l'ha visto:** 7 profili, 0 pubblici, 0 follow. Abbiamo rifatto la grafica del profilo dell'amico per una settimana mentre nessuno poteva trovare nessuno.

### 3 cambi per la settimana dopo
- **Prima di rifare una schermata si guarda il database di produzione:** se la funzione non è usata (0 righe), si capisce perché prima di ritoccarne la grafica.
- **Alla terza bocciatura della stessa voce: notifica a Lorenzo con i voti e una domanda sola** ("la metto lo stesso?"), nella sessione stessa.
- **Ogni sessione che parte scrive in BACKLOG perché la precedente non c'è stata**, se sono passati più di 24 ore.

### Revisione dei documenti del team
- **`PROPOSTE.md`:** nuove 55–57 (14/11: "Tre, non trenta", "Manda al gruppo", Chiocciola Slow Food); nessuna fatta in settimana fuori dalle richieste dell'8/11.
- **`COMPETITOR.md`, `PROBLEMI.md`, `PARTNER.md`:** aggiornati il 14/11 dalla sessione delle 10:05; nessun contatto partito, giusto così.

## Settimana 1–6/11 (scritta sabato 7/11)

### Cosa è stato fatto
- **In produzione (6 PR unite: #121, #123, #125, #128, #130, #131):** Idee rifatte (massimo 6, per momento); Importa da Google con le liste che diventano raccolte; Salvati con ricerca sempre in vista, città, "Preferiti", "Da più tempo", "Ha chiuso"; mappa senza scatti e colori freddi al posto del beige; gusti con 54 tipi di locale; "Chiedi a Romantico"; budget nella frase di ricerca; scheda più pulita; card dei risultati senza pillole tagliate.
- **Fermo:** "Ti porterei qui" (spento, `?beta=consiglio`), "‹ 1 di 12 ›" sulla scheda (tolto dal merge).

### Cosa è andato
- **Il piano di Lorenzo del 1/11 ha funzionato:** solo cose visibili, una area per notte, sessioni piene con sviluppatori in parallelo. Sei PR in sei giorni, tutte su schermate che si vedono aprendo l'app.
- **Unire la parte che passa** (regola del 24/10): la scheda bocciata è uscita dal merge e il resto è andato in produzione lo stesso.

### Cosa non è andato
1. **Troppe bocciature sulle stesse voci:** mappa bocciata 3 volte, "Ti porterei qui" 4 volte (voti tra 6,5 e 8,0), scheda 2 volte. Ogni revisore nuovo trova difetti diversi: si corregge e si riparte da capo.
2. **"Ti porterei qui" è una voce AI che deve essere perfetta** (mai inventare): ogni giro ha trovato un caso nuovo in cui il perché era falso o tagliato. Costruita senza un elenco di casi di prova fissato prima.
3. **Le risposte Google salvate spariscono** ancora a ogni container nuovo: 3–6 ricerche vere al giorno solo per ricrearle.

### 3 cambi per la settimana dopo
- **Casi di prova scritti prima del codice** per le voci AI: 10 frasi con la risposta giusta attesa; il revisore le prova tutte e vota solo dopo.
- **Alla seconda bocciatura si taglia la voce**, non si rifà tutta: si unisce la parte sopra 8,5 e il resto diventa una voce nuova più piccola. Alla terza la voce si ferma e si scrive a Lorenzo.
- **Un mockup prima del codice per le schermate grandi** (scheda, primo accesso): il designer vota il mockup contro Places, poi si costruisce.

### Revisione dei documenti del team
- **`PROPOSTE.md`:** fatte nella settimana: 36, 39, 40, 44, 45; ferma senza un sì di Lorenzo: 43; nuove: 46–52 (tutte dal 9/11).
- **`COMPETITOR.md`:** controlli ogni notte; novità: BestieBite punta agli USA (round di giugno), Albo insegna il "Condividi" nel primo accesso, Corner fermo alla versione del 26/9.
- **`PROBLEMI.md`:** 22 problemi; aggiunto il 22 (trappole per turisti in centro).
- **`PARTNER.md`:** nessun contatto partito, giusto così; nessun partner nuovo emerso.

## Settimana 24–30/10 (scritta sabato 31/10 alle 03:30)

### Cosa è stato fatto
- **In produzione (12 PR unite, dalla #98 alla #109):** scheda nuova con foto vera e verdetto in alto; primo accesso nuovo acceso per tutti; avvisi push ("Avvisami quel giorno", nascosti finché mancano le chiavi su Vercel); "Scrivi che sei di parola" nel messaggio di prenotazione; "📍 Sul posto"; omaggio a chi torna (pannello e scheda); "Guarda il reel qui" per Instagram; "Chiedi ai tuoi posti" nei salvati e "Dai tuoi salvati" su ogni ricerca.
- **Costruito ma spento:** "Prenota su TheFork" (bocciato due volte, si prova con `?beta=prenota`).
- **Verificato e non fattibile:** leggere un reel Instagram dal link (l'oEmbed senza chiave non dà la didascalia).

### Cosa ha funzionato
- **Collaudo a due livelli** (bloccanti e minori, deciso nella retro scorsa): i merge sono ripartiti. Le voci passano a 8,5–8,8 al secondo revisore invece di fermarsi per giorni.
- **Voci piccole e collegate:** "Chiedi ai tuoi posti" (venerdì sera) è diventata "Dai tuoi salvati" la sessione dopo, riusando lo stesso server. Due funzioni in produzione in 5 ore.
- **Il credito Anthropic è tornato** (Lorenzo, 29/10): il verdetto c'è di nuovo sui locali nuovi.

### Cosa non ha funzionato
1. **Tanto lato ristoratore, ancora nessun ristoratore.** Omaggio, serate, "cliente di parola": tutto pronto e nessun locale verificato che lo usi. Resta lavoro fermo finché Lorenzo o Roberto non portano il primo.
2. **Nessuna prova dal vivo delle funzioni AI con salvati veri.** "Chiedi ai tuoi posti" e "Dai tuoi salvati" sono provati con dati simulati e un solo account di prova.
3. **Il primo revisore boccia quasi sempre** (7–8,2), il secondo approva. Il primo giro trova difetti veri, ma costa una sessione intera.
4. **Avvisi push fermi** per 4 variabili su Vercel (DA-FARE 8): codice in produzione e invisibile da 3 giorni.

### Cosa cambiamo da oggi
- **Prima il lato utente.** Finché non c'è un locale verificato, niente funzioni nuove per ristoratori: solo bozze in `PARTNER.md`. Le sessioni lavorano su "fatti suggerire" (proposta 27 da stanotte) e sul ritrovare.
- **Prima del revisore, un autocontrollo** con l'elenco dei difetti che i primi revisori hanno trovato più spesso (testo tagliato a 390 px, stato perso dopo una ricarica, tocco sotto la barra, riga duplicata). Obiettivo: approvata al primo giro.

### I 3 problemi da attaccare la settimana prossima
1. **"Fatti suggerire" con pochi dati** (problema 15, nuovo): chi ha pochi salvati non riceve consigli. "Altri come questo" parte da un solo posto amato.
2. **Disdette e tavoli vuoti** (problema 1): promemoria con risposta (proposta 31), ora che gli avvisi push esistono.
3. **Salvato ma mai andato** (problema 9): misurare quanti "Quando ci vai?" diventano "Ci sono stato".

### Revisione dei documenti del team
- **`PROPOSTE.md`:** fatte nella settimana: 3 (primo passo), 6, 12, 25 (bozza), 28, 33; progettata: 9. Da stanotte in costruzione: 27. Nuove: 34, 35.
- **`COMPETITOR.md`:** aggiunti Zest e WittyFood (consigli dai propri comportamenti o da una foto); aggiornata Beli (servono 15 posti in classifica prima dei consigli).
- **`PROBLEMI.md`:** 15 problemi. Aggiunto il 15 (consigli personali solo dopo tanti dati).
- **`PARTNER.md`:** nessun contatto partito, giusto così. Bozza per Roberto ("Stasera c'è posto") pronta dal 29/10.

## Settimana 17–23/10 (scritta sabato 24/10 alle 00:30)

### Cosa è stato fatto
- **In produzione:** mappa del gusto al primo accesso (PR #88/#90), salva dal reel in un gesto (#89/#90), home nuova "Dove andiamo stasera?" (#91), Salvati sul mockup C, pillola "✨ 12 posti · rooftop · romantico" e link TikTok (#92). Da sabato 18 a giovedì 22 alle 01:50: 28 PR unite.
- **Non in produzione:** scheda del locale sul mockup A, primo accesso sul mockup A ("Ti piace o no?", "Ecco cosa ho capito di te"), "✓ terrazza" con la prova. Sono nelle PR #93, #94 e #95, una dentro l'altra.

### Cosa ha funzionato
- **Collaudo da un revisore che non ha scritto il codice.** Ha trovato difetti veri che nessuno sviluppatore aveva visto: "✓ romantico" senza prove, frasi da recensioni da 1 stella, tasti sotto la barra su iPhone SE.
- **Risposte Google salvate su disco** (`GOOGLE_FIXTURES_ONLY=1`): i revisori lavorano senza consumare quota.
- **Pannello `/admin/numeri`** con "Google oggi" e "AI: ok": i problemi si vedono senza aprire i log.

### Cosa non ha funzionato
1. **Da giovedì 22 alle 01:50 nessun merge.** Tre sessioni di fila: tutto bocciato due volte, con voti tra 7,8 e 8,4. Ogni revisore nuovo trova difetti nuovi e diversi, quindi una schermata grande non arriva mai a 8,5. Per Lorenzo la produzione è ferma da tre giorni, a due giorni dalla scadenza.
2. **Il credito Anthropic è a zero da giovedì 22 alle 08:07.** Il verdetto Mapetite, cioè il differenziatore, non compare sui locali nuovi da 40 ore. Lo si è visto solo 17 ore dopo, perché non c'era un avviso: ora c'è, nel pannello.
3. **Il lavoro si ripete.** Quando il container si riavvia, la cartella delle risposte salvate (`scripts/fixtures`) sparisce. Stanotte sono servite di nuovo 3 ricerche Google vere per ricrearla.
4. **gstack non si installa** (permessi dell'ambiente). I ruoli si applicano a mano.

### Cosa cambiamo da oggi
- **Collaudo a due livelli.** Il revisore divide i difetti in *bloccanti* (rotto, falso, illeggibile, tocco impossibile, peggio di main) e *minori* (rifiniture). Il voto misura l'insieme rispetto a Places. I minori vanno nel backlog e non fermano il merge se il voto è ≥ 8,5. La regola "due bocciature, niente merge" resta.
- **Il revisore riceve l'elenco dei difetti del giro prima** e controlla per primi quelli. Così il giro misura il miglioramento invece di ripartire da capo.
- **Più piccolo è meglio.** Se una schermata viene bocciata due volte, si unisce la parte che passa (per esempio la scheda senza "Perché qui") invece di tenere tutto fuori.

### Cosa togliere
- Le proposte B2B nuove fino al 26/10: ce ne sono già 25 in `PROPOSTE.md` e nessuna è costruibile prima della demo.
- Le sezioni "Aggiornato il …" in cima a `BACKLOG.md` più vecchie di una settimana: vanno spostate in fondo, non cancellate.

### I 3 problemi da attaccare la settimana prossima
1. **Verdetto sempre presente (VISIONE: "deve esserci SEMPRE").** Problema 11 di `PROBLEMI.md`: serve credito Anthropic con avviso di spesa (Lorenzo). Poi rigenerare i verdetti in italiano zoppicante.
2. **Disdette e tavoli vuoti (problema 1).** È il primo problema dei ristoratori. Si parte da una prenotazione vera con promemoria, dopo il gruppo di prova.
3. **I posti salvati che non diventano una serata (problema 9).** È il cuore di "ritrova nel momento giusto": va misurato quanti "Stasera / Nel weekend" diventano un "Ci sono stato".

### Revisione dei documenti del team
- **`PROPOSTE.md`:**
  - fatte: 13, 14, 17, 24;
  - in pausa fino al 26/10: 6, 7, 9, 12;
  - restano DA DECIDERE LORENZO: 3, 6, 9, 12, 25;
  - le 18–23 dipendono tutte dai "✓ con la prova", ancora spenti.
- **`COMPETITOR.md`:** aggiornato fino al 23/10. Ultime novità: Places "Table Tonight", TheFork in ChatGPT.
- **`PROBLEMI.md`:** 11 problemi. Il più urgente per la demo è l'11 (l'AI si ferma).
- **`PARTNER.md`:** nessun contatto partito (giusto: tocca a Lorenzo o Roberto). Ordine invariato: Zenchef/CoverManager, Zucchetti, Fipe.
