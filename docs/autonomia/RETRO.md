# Retro del sabato

Bilancio della settimana, scritto dalla prima sessione del sabato (regola del team gstack). Fonti: `git log` di `main`, PR, `BACKLOG.md`, database di produzione.

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
