# Retro del sabato

Bilancio della settimana, scritto dalla prima sessione del sabato (regola del team gstack). Fonti: `git log` di `main`, PR, `BACKLOG.md`, database di produzione.

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
