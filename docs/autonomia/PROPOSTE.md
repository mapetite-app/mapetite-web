# Proposte del CEO

Idee nuove per far crescere Mapetite oltre il piano. Le scrive il team dopo aver letto `VISIONE.md`, `BACKLOG.md`, `PIANO-25-OTTOBRE.md`, `POSIZIONAMENTO.md`, `RICERCA-RISTORATORI.md`, `COMPETITOR.md` e `PROBLEMI.md`: niente doppioni di cose già fatte o già in piano.

**Formato di ogni proposta** (una sezione per data, le più nuove in alto):
- **Problema:** quale problema risolve (rimando a `PROBLEMI.md` se c'è).
- **Cosa fa:** per chi usa l'app, in 2–3 righe.
- **Da dove nasce:** quale competitor lo fa (o perché nessuno lo fa) e come lo facciamo meglio.
- **Valore per l'utente.**
- **Valore per il ristoratore:** cosa pagherebbe e perché.
- **Sforzo:** S (meno di un giorno), M (1–3 giorni), L (oltre).
- **Costo Google/Haiku:** stima per uso.
- **Stato proposto:** PRONTA se è S o M, sta nel budget e non servono pagamenti o partner; altrimenti **DA DECIDERE LORENZO** con una domanda di una riga.

Regole che valgono per tutte: una cosa principale per schermata; nessun numero inventato; mai premiare la popolarità (VISIONE).

---

## 31/10/2026 (notte, sessione 03:06, CEO che chiude)

### 34. "Più così / meno così" sui simili (i consigli che imparano dal tuo 👍)
- **Problema:** `PROBLEMI.md`, 15. "Altri come questo" oggi usa i tratti del posto di partenza, non quello che fai dei risultati.
- **Cosa fa:** su ogni card di "Altri come …" due tocchi piccoli, 👍 "più così" e 👎 "meno così". Il 👍 aggiunge i punti forti di quel posto alla ricerca successiva, il 👎 li sposta in fondo (mai esclusi). Si salva nel profilo del gusto (`profiles.gusto`), che già guida ordine e verdetti.
- **Da dove nasce:** Beli chiede 15 confronti prima di consigliare; Zest vuole i pagamenti. Noi impariamo dal primo tocco, con un segnale implicito e visibile.
- **Valore per l'utente:** la seconda ricerca è già più sua della prima. **Valore per il ristoratore:** i dati "chi ama X ama anche Y" sono la base del futuro "clienti simili ai tuoi" nel pannello.
- **Sforzo:** M. **Costo:** zero Google in più (si usa al prossimo tocco); Haiku come oggi.
- **Stato proposto:** PRONTA, dopo una settimana di numeri su "Altri come questo".

### 35. "Altri come questo" dal reel appena salvato
- **Problema:** `PROBLEMI.md`, 8 e 15. Chi salva da un reel non ci è ancora stato: oggi i simili si offrono solo dopo "Ci sono stato" o 👍.
- **Cosa fa:** nel "✓ Salvato" del reel, sotto "Quando ci vai?", una riga "Ce ne sono altri così vicino a te?" che apre la stessa ricerca dei simili. Un tocco, una ricerca.
- **Da dove nasce:** WittyFood cerca piatti simili da una foto; nessuno collega il reel ai posti simili nella tua città.
- **Valore per l'utente:** dal video visto stasera a 5 alternative vere, nella stessa zona. **Valore per il ristoratore:** domanda da chi ama locali come il suo, prima ancora della scelta.
- **Sforzo:** S (riusa `queryAltriCome`). **Costo:** 1 ricerca Google e 1 Haiku per tocco, solo se toccata.
- **Stato proposto:** PRONTA. **FATTA il 31/10 mattina** (sessione 10:06): "✨ Altri come questo" nel "✓ Salvato" del reel apre `/mappa?come=<salvato>`. Scelta: la ricerca è attorno al posto del reel, non a te (il reel è spesso di un'altra zona: i simili servono lì).

## 30/10/2026 (notte, sessione 03:06, CEO che chiude)

### 32. "La tua settimana" sul telefono del titolare (il pannello che arriva da solo)
- **Problema:** `PROBLEMI.md`, 14 (dipendenti −10,3% nel 2025, Fipe): il titolare non apre un pannello in più.
- **Cosa fa:** il lunedì mattina, un avviso push al titolare verificato: "Settimana scorsa: 14 ti hanno salvato, 3 sono tornati, 2 omaggi mostrati". Un tocco apre il pannello. Usa gli avvisi push (proposta 6) e i numeri che il pannello calcola già.
- **Da dove nasce:** TheFork Manager e i gestionali mandano report per mail pieni di numeri; nessuno parla della domanda *prima* della prenotazione.
- **Valore per l'utente:** nessuno diretto. **Valore per il ristoratore:** vede ogni settimana che Mapetite gli porta gente (base per il piano a pagamento).
- **Sforzo:** M (iscrizione push dal pannello, calcolo settimanale nel cron esistente). **Costo:** zero.
- **Stato proposto:** PRONTA (dopo che Lorenzo accende gli avvisi, DA-FARE 8).

### 33. "Chiedi ai tuoi salvati" (la ricerca a parole dentro i posti che hai già scelto)
- **Problema:** VISIONE, "Ritrova": nel momento della scelta, in pochi secondi. Ask Maps di Google usa già i salvati per personalizzare (`COMPETITOR.md`, 30/10) e arriverà in Italia.
- **Cosa fa:** nella pagina dei salvati, una riga "Chiedi ai tuoi posti": "dove porto mia madre domenica a pranzo?". L'AI sceglie solo tra i salvati (nessuna ricerca Google), con il perché dalle recensioni già lette e dalle tue note.
- **Da dove nasce:** Corner cerca per atmosfera tra i posti della sua mappa, non tra i tuoi; Mapstr solo con filtri. Nessuno usa le tue note.
- **Valore per l'utente:** decide tra i posti che ha già raccolto, che è il motivo per cui li ha salvati. **Valore per il ristoratore:** chi lo aveva salvato ci va davvero (il dato "salvato → visita").
- **Sforzo:** M. **Costo:** zero Google; un Haiku per domanda (circa 2–3k token, sotto un decimo di centesimo).
- **Stato proposto:** PRONTA. **Costruita il 30/10 sera** (ricerca dei salvati: una frase di 3+ parole mostra "Chiedi ai tuoi posti"; prova dal vivo: 1,2–1,5 s, ~800 token in ingresso e 100 in uscita, circa 0,1 centesimi a domanda). **Estesa il 30/10 notte a ogni ricerca nel mondo** (home e mappa): riga "📌 Dai tuoi salvati" sopra i risultati, solo salvati vicini e non già in lista; una chiamata Haiku in più per ricerca, solo per chi ha almeno 3 salvati.

## 29/10/2026 (notte, sessione 22:08, CEO che chiude)

### 30. Importa i salvati di Instagram dal file di Meta
- **Problema:** `PROBLEMI.md`, 13. Anni di reel salvati su Instagram che nessuno riapre; Instagram non li fa leggere alle altre app.
- **Cosa fa:** in Importa, "Hai i salvati di Instagram?": la persona scarica i propri dati da Instagram (Centro gestione account → Le tue informazioni → Scarica, solo "Salvati") e carica il file. Mapetite elenca gli autori dei post salvati e le raccolte ("Roma food"); gli account che sono locali (nome come "trattoriadamario") si riconoscono con un tocco ciascuno, gli altri restano come "creator da cui salvi".
- **Da dove nasce:** nessun concorrente lo fa (Corner legge un link alla volta; Mapstr importa da Google Maps). È la "Raccogli" di VISIONE: "importando in blocco quello che hai già accumulato altrove".
- **Valore per l'utente:** in due minuti ritrova i posti di anni di reel. **Valore per il ristoratore:** sapere quante persone lo avevano salvato su Instagram (domanda già esistente).
- **Sforzo:** M (lettura del file nel telefono, nessun invio del file al server; riconoscimento a tocco come "Incolla più link"). **Costo:** zero Google finché non si tocca; 1 ricerca per locale confermato, nel tetto dell'import.
- **Stato proposto:** PRONTA.

### 31. "Domani sei da Mario: confermi?" (promemoria con risposta, contro il no-show)
- **Problema:** `PROBLEMI.md`, 1 (no-show 12,8%, 5–20% dei ricavi possibili, [Linkiesta 3/2026](https://www.linkiesta.it/2026/03/perche-devi-disdire-la-prenotazione-a-un-ristorante-se-sai-che-non-ci-andrai/)).
- **Cosa fa:** il giorno prima della prenotazione salvata, un avviso push: "Confermo" o "Non vado più" (messaggio pronto per il locale, come oggi nel promemoria). Usa gli avvisi push della proposta 6 (decisa da Lorenzo il 29/10).
- **Da dove nasce:** TheFork e i gestionali mandano promemoria solo per le prenotazioni fatte da loro; noi anche per quelle fatte al telefono e salvate in Mapetite.
- **Valore per l'utente:** non dimentica e disdice in un tocco anche a locale chiuso. **Valore per il ristoratore:** tavoli liberati in tempo; dato "clienti di parola" (proposta 3).
- **Sforzo:** M, dopo la proposta 6. **Costo:** zero (push del browser gratuite).
- **Stato proposto:** PRONTA (dopo la 6).

## 26/10/2026 (notte, sessione 04:06, CEO che chiude — ultimo giorno dello sprint, solo chiavi di volta)

### 28. "Ci sono stato" che vale come prova (risposta alla Legge 34/2026 sulle recensioni false)
- **Problema:** `PROBLEMI.md`, 12. Recensioni false e ricatti con recensioni negative; la Legge 34/2026 chiede di verificare che chi recensisce sia stato davvero nel locale.
- **Cosa fa:** quando segni "✓ Ci sono stato", l'app guarda (solo se la posizione è già permessa, sul telefono, senza salvarla) se nelle ultime 3 ore eri entro 150 m dal locale: la visita diventa "✓ visita vista dal telefono". Nella scheda, le opinioni della community mostrano quante vengono da visite viste così. Nessun dato di posizione esce dal telefono: si salva solo sì/no.
- **Da dove nasce:** Beli e Corner contano le visite dichiarate; TripAdvisor e Google non verificano la presenza. Noi possiamo farlo senza GPS continuo, solo nel momento del tocco.
- **Valore per l'utente:** opinioni della community di cui ci si può fidare.
- **Valore per il ristoratore:** opinioni che non si possono comprare né usare per ricattarlo; nel pannello futuro "N visite vere da Mapetite questo mese" (piano Growth).
- **Sforzo:** M (colonna sì/no sulla visita, controllo sul telefono, etichetta in scheda). **Costo Google/Haiku:** zero.
- **Stato proposto:** PRONTA, **dopo lo sprint** (dal 27/10): non è una chiave di volta.
- **RIFATTA il 30/10 notte (sessione 03:06):** "📍 Sul posto: il telefono era vicino al locale quando l'hai segnato" su una riga a parte, spiegazione già scritta; controlli nuovi per telefono lontano e "tornato" con data passata. Prima: **COSTRUITA il 30/10 notte ma BOCCIATA due volte dal collaudo (design), non unita.** Era: "📍 sul posto" nella scheda accanto al giorno della visita, solo l'ora sul server (`saved_places.visita_vista_al`). Manca: il conteggio nelle opinioni della community (serve una vista aggregata sul server) e l'uso come prova per l'omaggio (12).

### 29. Senza AI, il verdetto dalle recensioni in una riga onesta
- **Problema:** `PROBLEMI.md`, 11. Con il credito Anthropic a zero (dal 22/10) i locali nuovi mostrano una citazione tagliata di una recensione al posto del verdetto: alla demo sembra un buco.
- **Cosa fa:** quando l'AI non risponde, la card mostra "Da Google: " + la frase più informativa di una recensione con 5 stelle *e* quella di una con 3 o meno, se c'è ("piace: … · non convince: …"), sempre tra virgolette e attribuita. Nessun testo scritto da noi: solo scelta di frasi vere.
- **Da dove nasce:** Places mostra estratti di recensioni; nessuno mette a fianco il pro e il contro. È la forma più vicina al verdetto che si può fare senza inventare.
- **Valore per l'utente / ristoratore:** il verdetto "sempre" regge anche quando l'AI cade; il locale non viene mostrato muto.
- **Sforzo:** S. **Costo:** zero (recensioni già nella risposta Google).
- **Stato proposto:** PRONTA (chiave B, verdetto sempre).

## 24/10/2026 (notte, sessione 00:06, CEO che chiude — solo chiavi di volta)

### 26. "Verdetto in arrivo": nessun locale resta senza verdetto quando l'AI si ferma
- **Problema:** `PROBLEMI.md`, 11. Dal 22/10 alle 08:07 a oggi nessun verdetto nuovo: i locali cercati in quelle ore restano "Da Google" anche quando l'AI torna, finché qualcuno non li riapre.
- **Cosa fa:** quando l'AI non risponde, il locale entra in una coda (tabella `place_synthesis` con verdetto vuoto e "da fare"). Al ritorno dell'AI un lavoro notturno scrive i verdetti mancanti per i locali cercati o salvati, fino a 25 a notte. Sulla card, invece di "Da Google", compare "Verdetto in arrivo" solo se il locale è in coda.
- **Da dove nasce:** nessun competitor ha un verdetto scritto per ogni locale. Noi lo promettiamo "sempre" (VISIONE), quindi dobbiamo recuperare i buchi da soli.
- **Valore per l'utente:** riapri un salvato e il verdetto c'è, anche se l'hai salvato mentre l'AI era ferma.
- **Valore per il ristoratore:** la sua scheda non resta senza spiegazione per giorni.
- **Sforzo:** S. **Costo:** nessuna chiamata Google (si usano le recensioni già salvate nell'arricchimento); Haiku circa 25 verdetti a notte, gli stessi che si sarebbero spesi comunque.
- **Stato proposto:** PRONTA (dopo la ricarica del credito).

### 27. "Altri come questo": dal posto che ami, i 5 che gli somigliano davvero
- **Problema:** `PROBLEMI.md`, 9 e VISIONE ("fatti suggerire"). Chi ha un posto del cuore non sa come trovarne altri simili senza ripartire da zero.
- **Cosa fa:** nella scheda di un salvato con 👍 o "Ci sono stato", un tasto "Altri come questo". La ricerca parte dai tratti del verdetto (per esempio "trattoria romana · cucina di quartiere · prezzi onesti"), nella stessa città. Ogni risultato ha la riga "Come Da Cesare: …" con la frase della recensione che lo prova. I posti di massa vanno in fondo, come nella ricerca.
- **Da dove nasce:** "Mapstr Matching" consiglia posti dai tuoi salvati, ma non dice perché e lo fa pagare (Mapstr Plus, [TourMaG](https://www.tourmag.com/Mapstr-de-l-IA-mais-pourquoi-faire_a124504.html)). Noi lo spieghiamo con la prova, gratis.
- **Valore per l'utente:** dal posto che ama a 5 posti nuovi, in un tocco, senza scrivere niente.
- **Valore per il ristoratore:** clienti che arrivano perché amano locali come il suo, cioè la domanda più qualificata che esista. È la base di un futuro "sei simile a…" nel pannello.
- **Sforzo:** S (riusa la ricerca a parole e i tratti del verdetto). **Costo:** 1 ricerca Google per tocco, come una ricerca normale; Haiku come una ricerca.
- **Stato proposto:** PRONTA, dopo il 26/10 (fuori dalle chiavi di volta dello sprint). **Costruita il 31/10 notte:** tasto "✨ Altri come questo" nella scheda dei salvati con 👍 o "Ci sono stato" (non con 👎); ricerca nel mondo "tipo + punti forti + fuori dai soliti giri + città", attorno al posto; il posto di partenza non torna tra i risultati; pillola "N posti · come Nome"; sulle card i ✓ con la prova delle recensioni.

## 23/10/2026 (mattina, sessione 05:06, CEO che chiude — solo chiavi di volta)

### 24. "AI: ok" nel pannello e avviso prima che finisca il credito
- **Problema:** `PROBLEMI.md`, 11. Il 23/10 il credito dell'AI è finito di notte e nessuno se n'è accorto finché una sessione non ha provato a mano.
- **Cosa fa:** in `/admin/numeri` una riga "AI: ok · ultimo verdetto alle 21:40" oppure "AI ferma da 01:00 (credito finito)", letta dagli errori già registrati nei log del server; la sessione notturna la controlla per prima e, se è rossa, lo scrive in cima alla PR.
- **Da dove nasce:** nessun competitor lo mostra (è interno); serve a tenere la promessa "verdetto sempre" di VISIONE.
- **Valore per l'utente:** il verdetto non sparisce per giorni senza che nessuno lo sappia. **Valore per il ristoratore:** indiretto (la sua scheda resta spiegata).
- **Sforzo:** S. **Costo:** zero Google, zero AI (legge un evento già scritto).
- **Stato proposto:** PRONTA.

### 25. "Stasera c'è posto" vero, dai sistemi di prenotazione (come Table Tonight di Places)
- **Problema:** `PROBLEMI.md`, 1 e 2. Il venerdì alle 19 chi ha scelto il posto giusto scopre che è pieno; il ristoratore ha tavoli liberati da disdette che nessuno vede.
- **Cosa fa:** sulle card della ricerca "stasera", un segno "🟢 tavolo alle 21" preso dal sistema di prenotazione del locale; un tocco e si prenota lì. Mai cambia l'ordine dei risultati (il posto giusto resta primo anche se pieno).
- **Da dove nasce:** Places "Table Tonight" raccoglie i tavoli di oggi da più piattaforme ([Time Out](https://www.timeout.com/newyork/news/the-founder-of-dating-app-raya-has-a-new-way-to-score-last-minute-restaurant-reservations-010626)); noi lo uniamo al verdetto e ai gusti, cosa che Places non fa.
- **Valore per l'utente:** dalla scelta alla prenotazione senza telefonate. **Valore per il ristoratore:** riempie i tavoli delle disdette dell'ultima ora (no-show medio 12,8%: `PROBLEMI.md`, 1); pagherebbe per prenotazione arrivata, non per "esserci".
- **Sforzo:** L (servono accordi o API dei sistemi: TheFork, Zenchef/CoverManager, vedi `PARTNER.md`). **Costo:** zero Google; dipende dall'accordo.
- **Stato proposto:** DA DECIDERE LORENZO — "Prepariamo per Roberto la bozza di richiesta di accesso alle disponibilità a TheFork e Zenchef?"

## 23/10/2026 (notte, sessione 00:06, CEO che chiude — solo chiavi di volta)

### 22. "✓ terrazza · 3 recensioni su 5": quanto è sicura la prova
- **Problema:** un ✓ con una sola frase vale come uno detto da tutti. Chi sceglie per un anniversario vuole sapere se la terrazza c'è sempre o l'ha vista uno solo.
- **Cosa fa:** nella scheda, sotto la frase, "detto in 3 recensioni su 5" (conteggio delle frasi che passano la doppia chiave).
- **Da chi nasce:** Google Ask Maps e OpenTable rispondono senza dire da quante fonti; noi lo contiamo.
- **Valore utente:** fiducia, in un colpo d'occhio. **B2B:** il ristoratore vede quali caratteristiche i clienti confermano di più (dato per la pagina verificata, dopo il 26/10).
- **Sforzo:** S. **Costo:** zero Google; l'AI riceve fino a 3 frasi per requisito invece di 1 (~+5% di token nella chiamata del perché).

### 23. Dal reel alla prova: "Il reel dice terrazza: confermato"
- **Problema:** chi salva da un reel si fida del creator; la didascalia promette ("vista pazzesca") ma nessuno controlla (chiave A + B).
- **Cosa fa:** nel "✓ Salvato" dal reel, se la didascalia nomina un requisito (terrazza, vista, romantico) e le recensioni lo confermano con la doppia chiave, una riga "Il reel dice vista: confermato da una recensione". Se non lo conferma nessuno, niente (mai "falso").
- **Da chi nasce:** Corner e Mapstr salvano il pin del reel senza giudizio; noi lo verifichiamo.
- **Valore utente:** sa subito se il reel era vero. **B2B:** il locale vede quali promesse dei creator i clienti confermano.
- **Sforzo:** S/M. **Costo:** zero Google se la ricerca che riconosce il locale porta già le recensioni (da verificare nel codice prima di costruirla; altrimenti 1 dettaglio Google in più a salvataggio, da segnalare), una frase in più nella chiamata AI.

## 22/10/2026 (mattina, sessione 05:06, CEO che chiude — solo chiavi di volta, senza ricerche nuove: i documenti del giorno li ha già aggiornati la sessione delle 00:07)

### 20. "Solo quelli con la prova": un tocco sulla pillola tiene solo i posti con ✓ su tutti i requisiti
- **Problema:** `PROBLEMI.md`, 10. Con 20 risultati, chi ha chiesto "terrazza romantica" vuole vedere subito quali la terrazza ce l'hanno *di sicuro*.
- **Cosa fa:** nella pillola "✨ 20 posti · terrazza · romantico" compare "✓ 6 con la prova": un tocco e restano solo quelli con la frase di recensione per ogni requisito; un altro tocco li rimette tutti.
- **Da dove nasce:** Places e Mapstr filtrano per etichette scelte dall'utente, Google per attributi dichiarati; nessuno filtra per "le recensioni lo dicono, ecco la frase".
- **Valore per l'utente:** nella demo, "meglio 4 giusti che 20 approssimativi" (TEST-RICERCHE) diventa un tocco.
- **Valore per il ristoratore:** capire quale caratteristica, detta dai clienti, lo fa restare in lista (pannello, dopo).
- **Sforzo:** S. I ✓ arrivano già con le card, nessun dato nuovo.
- **Costo Google/Haiku:** zero.
- **Stato proposto:** PRONTA (chiave B).

### 21. Il ✓ anche dai salvati: "Nei tuoi posti con terrazza"
- **Problema:** VISIONE, "ritrova": nei salvati si cerca per parola ma non si sa se la parola è vera.
- **Cosa fa:** cercando nei salvati "terrazza", i posti la cui recensione salvata lo conferma mostrano "✓ terrazza" con la frase, come nei risultati.
- **Da dove nasce:** Mapstr e Corner cercano solo nei tag messi a mano; noi usiamo le recensioni già salvate con il verdetto.
- **Valore per l'utente:** ritrova il posto giusto tra i suoi in 2 secondi, con la prova.
- **Valore per il ristoratore:** nessuno diretto; più ritorni da chi l'ha già salvato.
- **Sforzo:** S/M (dipende da quante recensioni restano salvate per locale: da verificare, niente foto o contenuti Google oltre a ciò che i termini consentono).
- **Costo Google/Haiku:** zero.
- **Stato proposto:** PRONTA, dopo la 20 (verificare prima i termini Google sul testo delle recensioni salvate).

## 22/10/2026 (notte, sessione 00:07, CEO che chiude — solo chiavi di volta)

### 18. "Come lo sai?": la frase della recensione dietro ogni ✓
- **Problema:** `PROBLEMI.md`, 10: le risposte dell'AI sembrano vere ma non si vede da dove vengono.
- **Cosa fa:** nella scheda, toccando "✓ terrazza" si apre una riga: «"cena in terrazza al tramonto" — da una recensione su Google». Una frase sola, copiata dalle recensioni che la ricerca ha già (mai riscritta).
- **Da dove nasce:** Ask Maps di Google e l'AI Concierge di OpenTable rispondono ma non mostrano la prova (`COMPETITOR.md`, 22/10). Noi mostriamo la prova in un tocco.
- **Valore per l'utente:** si fida del ✓ senza leggere 20 recensioni; nella demo dal vivo è il momento "non inventa niente".
- **Valore per il ristoratore:** vede quali frasi delle recensioni gli portano clienti (nel pannello, dopo).
- **Sforzo:** S. L'AI indica il numero della recensione, il codice copia la frase (se la frase non c'è parola per parola, niente prova e niente ✓).
- **Costo Google/Haiku:** zero chiamate Google in più; Haiku pochi token in più per locale (stimato meno di 0,05 centesimi a ricerca).
- **Stato proposto:** PRONTA (chiave B).

### 19. "Il primo o il secondo?" in una riga
- **Problema:** con 12 posti tutti adatti si resta a scorrere; la decisione è il punto in cui gli altri lasciano soli (VISIONE: "scegli").
- **Cosa fa:** sopra il carosello, quando i primi due sono entrambi "molto adatti", una riga: "Terrazza Gallia se volete silenzio, Alto se volete il Duomo". Scritta solo dai verdetti già prodotti.
- **Da dove nasce:** Beli dà un numero ("Rec Score") ma non dice la differenza; Places non confronta. Noi diciamo la differenza in parole.
- **Valore per l'utente:** sceglie in 5 secondi.
- **Valore per il ristoratore:** sapere su cosa vince o perde contro il vicino (pannello, dopo).
- **Sforzo:** S/M. Una chiamata Haiku piccola dopo i verdetti, solo con i due verdetti in ingresso.
- **Costo Google/Haiku:** zero Google; Haiku circa 0,02 centesimi a ricerca.
- **Stato proposto:** PRONTA (chiave B, dopo la 18).

## 21/10/2026 (mattina, sessione 05:05, CEO che chiude — solo chiavi di volta)

### 16. Importa i preferiti di TikTok in blocco
- **Problema:** chi usa TikTok ha decine di video di locali tra i "Preferiti" e non li riaprirà mai (`PROBLEMI.md`, 8). Oggi in Mapetite si salvano uno alla volta.
- **Cosa fa:** in Importa, "Dai tuoi preferiti di TikTok": si carica il file della richiesta dati di TikTok (Impostazioni → Account → Scarica i tuoi dati, formato JSON); Mapetite prende i link dei preferiti, legge da solo ogni video (didascalia ufficiale, come oggi) e mostra l'elenco dei locali trovati, con "+ Salva" su ognuno (o "Salva tutti quelli sicuri").
- **Da dove nasce:** Mapstr importa da Google Maps, CSV e KML ([App Store](https://apps.apple.com/app/id917288465)); gli export dei salvati di Instagram esistono solo come estensioni a pagamento che danno link nudi ([Chrome Web Store](https://chromewebstore.google.com/detail/dibmfjgbnhbfhlajpahnbiiabpdabajo)). Nessuno trasforma i preferiti di un social in una mappa. Noi sì, con ogni locale verificato su Google prima di salvarlo.
- **Valore per l'utente:** "anni di TikTok" diventano una mappa in 2 minuti: è il "wow" del primo accesso (chiave 0).
- **Valore per il ristoratore:** sapere quanti lo avevano già nei preferiti dei social prima di Mapetite: misura vera della sua visibilità social.
- **Sforzo:** M. Da verificare su un file vero il nome del campo dei preferiti (non confermato dalle fonti). Tetto: 30 video per caricamento.
- **Costo Google/Haiku:** Haiku circa 0,1–0,3 centesimi a video (fino a 30); Google solo per i locali salvati, a tocco (o 1 per i "sicuri", dentro la quota).
- **Stato proposto:** PRONTA (dopo le chiavi di volta, dal 22/10).

### 17. "Quando ci vai?" appena salvato (il salvato che ritorna da solo)
- **Problema:** `PROBLEMI.md`, 9: il 56% della Gen Z trova locali sui social ma non arriva mai a prenotare.
- **Cosa fa:** nel "✓ Salvato" (reel, link, ricerca) tre chip: "Stasera", "Nel weekend", "Più avanti". Una data facoltativa nel salvato; quel giorno il locale sta in cima a "Stasera dove andiamo?" e nella home ("Avevi detto: stasera da Bar Rossi"). Nessuna notifica nuova.
- **Da dove nasce:** Corner e Mapstr salvano senza tempo ([Corner](https://apps.apple.com/app/id1668282277), [Mapstr](https://apps.apple.com/app/id917288465)); Beli lavora dopo la visita (classifica a coppie, consigli dopo 15 locali: [WSJ via To Vima](https://www.tovima.com/wsj/the-app-that-makes-rating-restaurants-fun-again-and-gets-better-the-more-you-use-it/)). Noi chiudiamo il buco tra "salvato" e "andato", con un tocco.
- **Valore per l'utente:** la lista diventa un piano, senza fatica.
- **Valore per il ristoratore:** domanda qualificata con una data: "12 persone pensano di venire questo weekend" (VISIONE: utenti già in fase di scelta).
- **Sforzo:** S (una colonna `piano_al` nei salvati: migrazione piccola, nessun dato toccato).
- **Costo Google/Haiku:** zero.
- **Stato proposto:** PRONTA.

## 21/10/2026 (notte, CEO che chiude — solo chiavi di volta, regola dello sprint)

### 13. Tutte le slide del carosello in un colpo ("5 posti a Roma" in 5 screenshot)
- **Problema:** i post "5 posti dove…" di Instagram sono caroselli: ogni locale sta su una slide. Oggi il Condividi di Android legge solo il primo screenshot e lo dice ("ho letto solo la prima"). Si perdono 4 posti su 5 (`PROBLEMI.md`, 8).
- **Cosa fa:** condividi fino a 5 screenshot insieme; Mapetite li legge tutti e mostra un elenco unico senza doppioni ("Nel post ci sono 5 posti"): il primo si salva come oggi, gli altri con "+ Salva".
- **Da dove nasce:** GeoTok e Korka leggono didascalia, scritte e profili taggati di un video, ma un video alla volta ([GeoTok](https://peerlist.io/shalex/project/geotok--save-every-tiktok-worth-eating-at), [Korka](https://apps.apple.com/app/id6762612703)). Places: Save & Organize è gratis solo per 2 posti ([App Store](https://apps.apple.com/us/app/-/id6737359980)). Noi: tutto il carosello, gratis, e ogni posto verificato su Google prima di salvarlo.
- **Valore per l'utente:** il post "classifica" diventa una lista in un gesto.
- **Valore per il ristoratore:** sapere da quali post arrivano i salvataggi del proprio locale ("3 persone ti hanno salvato da un post di @creator") nel pannello: dato che oggi nessuno gli dà.
- **Sforzo:** S. `ricevi` legge fino a 5 immagini, una chiamata Haiku ciascuna (o una sola con più immagini), unisce i locali con `fromParsed`.
- **Costo Google/Haiku:** Haiku circa 0,3 centesimi a immagine; Google invariato (1 ricerca automatica, le altre a tocco).
- **Stato proposto:** PRONTA.

### 14. Il verdetto subito, appena salvato dal reel
- **Problema:** chi salva dal reel vede "✓ Salvato" e un indirizzo: il differenziatore (il verdetto Mapetite) non si vede nel momento più forte della demo.
- **Cosa fa:** nella card "✓ Salvato in 📌 Voglio andarci" compare la riga del verdetto ("✦ Carbonara da manuale, sala piccola e rumorosa") presa dalla cache o scritta al volo con lo stesso tetto dei verdetti dei salvati (25 al giorno).
- **Da dove nasce:** Drawer, Corner e Go There trasformano il reel in un pin; nessuno dice se il posto merita ([Drawer](https://apps.apple.com/us/app/-/id582432085), [Corner](https://apps.apple.com/app/id1668282277), [Go There](https://hunted.space/product/go-there)). Noi sì, dalle recensioni e senza inventare.
- **Valore per l'utente:** sa subito se il posto visto sui social vale davvero, prima ancora di aprirlo.
- **Valore per il ristoratore:** il verdetto onesto è ciò che i locali verificati potranno arricchire (foto, serate) nel piano a pagamento.
- **Sforzo:** S. Riusa `/api/places/verdetto` (lo stesso della scheda dei salvati).
- **Costo Google/Haiku:** per i locali senza verdetto in cache: 1 Place Details + 1 Haiku, dentro il tetto di 25 al giorno già esistente.
- **Stato proposto:** PRONTA.

## 20/10/2026 (sessione delle 05:00, CEO che chiude)

### 10. "Prenota come l'ultima volta" (il tavolo del posto fisso in un tocco)
- **Problema:** `PROBLEMI.md` n. 7: i clienti che tornano valgono la metà del lavoro di un locale, ma per riprenotare si riparte da zero (app, orari, persone).
- **Cosa fa:** nella scheda di un posto fisso (2+ visite) il foglio Prenota si apre già con lo stesso numero di persone e la stessa fascia oraria dell'ultima prenotazione fatta da Mapetite su quel locale; resta solo da scegliere il giorno.
- **Da dove nasce:** Beli ora prenota con Resy dentro l'app ([blog Resy](https://blog.resy.com/?p=93063)), ma ogni volta da capo. Noi partiamo da quello che hai già fatto lì.
- **Valore per l'utente:** riprenotare il solito posto in 2 tocchi.
- **Valore per il ristoratore:** più prenotazioni dai clienti fedeli, senza commissioni a coperto (`PROBLEMI.md` n. 4).
- **Sforzo:** S (le prenotazioni sono già sul telefono; si legge l'ultima per quel locale).
- **Costo Google/Haiku:** zero.
- **Stato proposto:** PRONTA → **FATTA il 20/10** (per ogni locale già prenotato da Mapetite, non solo i posti fissi: il segnale c'è già).

### 11. "È la mia 3ª volta da voi" nella richiesta di prenotazione (scelto dall'utente)
- **Problema:** `PROBLEMI.md` n. 7 e n. 1: il ristoratore non riconosce i clienti fedeli quando prenotano, e non sa a chi tenere il tavolo.
- **Cosa fa:** se il locale è un tuo posto fisso, il messaggio di prenotazione propone una riga in più, spenta di default: "È la mia 3ª volta da voi". La accendi tu, una volta.
- **Da dove nasce:** SevenRooms e TheFork Manager riconoscono i clienti abituali solo se il locale ha il loro gestionale; noi lo portiamo nella richiesta stessa, decisa dal cliente, senza CRM.
- **Valore per l'utente:** essere riconosciuto (tavolo migliore, un saluto) senza tessere.
- **Valore per il ristoratore:** sa chi è un cliente fedele prima che arrivi; base di un piano Pro "i tuoi clienti fissi".
- **Sforzo:** S (testo della richiesta e un interruttore).
- **Costo Google/Haiku:** zero.
- **Stato proposto:** PRONTA → **FATTA il 20/10** ("Sarà la mia 3ª volta da voi", neutro rispetto al genere).

### 12. "Grazie di essere tornato": un piccolo omaggio deciso dal locale
- **Problema:** `PROBLEMI.md` n. 7: i programmi fedeltà funzionano (dati Toast, sotto) ma richiedono POS, tessere o QR.
- **Cosa fa:** il titolare verificato può offrire un omaggio semplice (un caffè, il dolce) a chi ha segnato "Ci sono tornato" 2+ volte; l'utente lo vede nella scheda e lo mostra al tavolo. Nessun pagamento.
- **Da dove nasce:** Toast dice che chi entra in un programma fedeltà torna molto di più ([Stacker via KEYT](https://keyt.com/?p=1472466)); Izicap/Nexi lo fanno dal POS. Noi senza hardware, legato alla visita vera.
- **Valore per l'utente:** un motivo in più per tornare dove sta bene.
- **Valore per il ristoratore:** fedeltà misurata (il numero "↻ tornati" del pannello) a costo quasi zero: è il cuore di un abbonamento.
- **Sforzo:** M (omaggio nel pannello, riga in scheda, controllo antiabuso). **Rischio:** "Ci sono tornato" si segna da soli: va legato a una prenotazione o a una prova.
- **Costo Google/Haiku:** zero.
- **Stato proposto:** **DA DECIDERE LORENZO.** "Lasciamo ai locali verificati offrire un omaggio a chi torna (nessun denaro, solo da mostrare al tavolo)?"
- **Decisione di Lorenzo (29/10): SÌ. Progetto del team (29/10 notte), da costruire nelle prossime sessioni:**
  1. **Nel pannello del locale verificato** (`/per-i-ristoratori`, dopo "Rivendica"): "Omaggio a chi torna" con un solo campo di testo breve ("un caffè", "il dolce", max 40 caratteri), da quante visite (2 o 3) e un interruttore acceso/spento. Niente sconti in denaro né percentuali: quelli sono pagamenti e restano a Lorenzo.
  2. **Per l'utente:** nella scheda, se ha segnato quel locale 2+ volte **con una prova** (prenotazione fatta da Mapetite con esito "Mi è piaciuto/Non fa per me", o "Ci sono stato" segnato sul posto, proposta 28), compare "🎁 Il locale ti offre un caffè: mostralo al tavolo". Si mostra una schermata con nome, data di oggi e un codice di 4 lettere che cambia ogni giorno (contro lo screenshot girato agli amici).
  3. **Antiabuso:** un omaggio per persona per locale ogni 30 giorni; "Ci sono tornato" senza prova non conta.
  4. **Dati:** tabella `omaggi` (locale, testo, soglia, acceso) e `omaggi_usati` (utente, locale, giorno); RLS: il titolare scrive solo il suo locale.
  5. **Nel pannello:** "Omaggi mostrati questo mese" accanto a "↻ tornati": la fedeltà misurata che il locale pagherebbe.
  - **Sforzo:** M. **Costo:** zero. **Prima di accenderlo:** almeno un locale verificato che lo voglia (contatto: Lorenzo/Roberto).
  - **COSTRUITA il 30/10 notte (sessione 03:06).** Scelte del team rispetto al progetto: la prova è la posizione **nel momento in cui si mostra l'omaggio al tavolo** (il telefono deve essere entro 150 m dal locale; può chiedere il permesso, solo dopo il tocco), non le visite passate: così vale anche per chi ha segnato le visite prima di "📍 sul posto". Il codice di 4 lettere è uguale per tutti i clienti del locale quel giorno, così il personale lo legge nel pannello. Colonne `places.omaggio_testo` / `omaggio_soglia` invece di una tabella `omaggi` (come le serate tranquille); `omaggi_usati` per il limite di 30 giorni. Parole come "sconto", "euro", "%" non si possono salvare.

## 20/10/2026 (seconda sessione della notte, CEO che chiude)

### 7. "Aperto da poco" (i locali nuovi giusti per te)
- **Problema:** `PROBLEMI.md` n. 6: i locali nuovi hanno poche recensioni e Google li mette dietro i famosi; quasi metà chiude entro 5 anni.
- **Cosa fa:** il titolare verificato scrive nel pannello il mese di apertura; in scheda compare "🆕 Aperto da 3 mesi"; nelle ricerche Mapetite un locale aperto da meno di 12 mesi non è penalizzato per le poche recensioni (sotto il pavimento qualità resta solo se ha almeno qualche voto buono). Dopo: in home "Nuovo vicino ai tuoi posti" per chi ha salvati dello stesso tipo e zona.
- **Da dove nasce:** Mapstr Plus dà accesso alle pre-aperture solo a Parigi e solo a chi paga ([Tendance Hôtellerie, 31/7/2026](https://www.tendancehotellerie.fr/articles-breves/communique-de-presse/23822-article/mapstr-offre-desormais-a-ses-utilisateurs-un-acces-exclusif-a-des-pre-ouvertures-de-nouveaux-lieux)); Places le sceglie a mano. Noi gratis, a Roma e Milano, legate ai gusti: mai al più popolare.
- **Valore per l'utente:** scopre prima degli altri il posto giusto per lui.
- **Valore per il ristoratore:** è il motivo per verificarsi nei primi mesi, i più fragili; base del piano Growth "fatti trovare da chi ama il tuo genere".
- **Sforzo:** M (una colonna `aperto_dal` sul locale verificato, riga in scheda, piccola regola nel ranking).
- **Costo Google/Haiku:** zero.
- **Stato proposto:** PRONTA.

### 8. "I tuoi posti fissi" (chi torna, senza tessere)
- **Problema:** la fedeltà oggi passa da POS e QR (Izicap con Nexi, Pubster); il ristoratore non sa se chi arriva da Mapetite torna.
- **Cosa fa:** il secondo "Com'è andata?" sullo stesso locale diventa "Ci sei tornato"; nel profilo "I tuoi posti fissi" (2+ visite), da proporre agli amici; nel pannello del ristoratore "N persone di Mapetite sono tornate 2 o più volte" (solo numeri aggregati).
- **Da dove nasce:** Izicap misura chi paga ([AziendaBanca](https://www.aziendabanca.it/notizie/tecno/izicap-smart-pos-nexi)); noi chi sceglie di tornare, senza tessera né POS.
- **Valore per l'utente:** una lista "sicuri" pronta, che si costruisce da sola.
- **Valore per il ristoratore:** prova di clienti fedeli, non solo nuovi: un numero da piano Growth.
- **Sforzo:** M (conteggio sulle visite già registrate nel diario, nessun dato nuovo da chiedere).
- **Costo Google/Haiku:** zero.
- **Stato proposto:** PRONTA → **FATTA il 20/10 (sessione delle 05:00).** Premi o tessera fedeltà: passo separato, DA DECIDERE LORENZO (proposta 12).

### 9. Serata di pre-apertura per chi ama il genere
- **Problema:** come la 7: i primi clienti giusti e le prime recensioni vere.
- **Cosa fa:** un locale verificato che sta per aprire invita 10–20 persone di Mapetite con salvati simili nella zona.
- **Da dove nasce:** Mapstr Plus lo fa per chi paga l'abbonamento; noi scegliamo gli invitati per gusto.
- **Valore per il ristoratore:** clienti giusti dalla prima sera; possibile servizio a pagamento più avanti.
- **Sforzo:** L (inviti, posti limitati, rapporto diretto con i locali).
- **Costo Google/Haiku:** zero.
- **Stato proposto:** DA DECIDERE LORENZO: "Proponiamo ai primi ristoratori verificati una serata di pre-apertura gratuita con utenti scelti per gusto?"
- **Decisione di Lorenzo (29/10): SÌ, si progetta; i contatti con i locali restano a Lorenzo/Roberto. Progetto del team (29/10 notte):**
  1. **Chi invitare (per gusto, non per popolarità):** persone con 3+ salvati dello stesso tipo nella zona del locale (es. "trattoria" a Monti) e "mappa del gusto" compatibile (cucina, spesa, diete). Mai in base a quanti follower o recensioni hanno: Mapstr lo dà a chi paga (`COMPETITOR.md`, 29/10), noi a chi ha il gusto giusto.
  2. **Come arriva l'invito:** avviso push (proposta 6, già costruita) e una card in home "Sei tra i 15 invitati alla pre-apertura di …": data, ora, posti, "Partecipo / No grazie". Posti limitati, primo che conferma.
  3. **Dopo la serata:** "Com'è andata?" come per le prenotazioni; le opinioni restano dentro Mapetite con l'etichetta "pre-apertura" (trasparenza, Legge 34/2026 sulle recensioni: `PROBLEMI.md`, 12).
  4. **Per il locale:** nel pannello quanti hanno confermato e quanti sono tornati dopo l'apertura. Gratis per i primi locali; un eventuale prezzo è "DA DECIDERE LORENZO".
  5. **Privacy:** al locale arrivano solo nome di battesimo e numero di persone, mai i salvati né i gusti.
  - **Sforzo:** L (inviti, posti, card in home, pannello). **Costo:** zero. **Primo passo:** Lorenzo o Roberto trovano un locale in apertura a Roma; il team costruisce gli inviti quando c'è una data vera.

## 20/10/2026 (notte, CEO che chiude)

### 4. "A quell'ora è chiuso? Ecco chi è aperto"
- **Problema:** prenotazioni perse quando il locale è chiuso (`PROBLEMI.md`, 2). Dal 19/10 il foglio Prenota dice se a quell'ora il locale risulta chiuso; oggi però l'utente resta senza alternativa.
- **Cosa fa:** quando l'ora scelta risulta chiusa, sotto l'avviso compaiono 1–2 locali della stessa ricerca (o dei tuoi salvati) aperti a quell'ora, con il loro verdetto: un tocco apre il loro foglio Prenota con giorno, ora e persone già scritti.
- **Da dove nasce:** TheFork mostra "altri ristoranti disponibili" ma solo tra i suoi locali affiliati e ordinati per promozione; noi tra i posti adatti alla TUA richiesta (stesso giudizio di Haiku), senza pagare posizioni.
- **Valore per l'utente:** la serata non salta: passa al secondo posto giusto in un tocco.
- **Valore per il ristoratore:** domanda qualificata nelle serate in cui altri sono chiusi; è una riga del pannello ("N persone sono arrivate da te perché un altro era chiuso").
- **Sforzo:** S. Dati già nel telefono (orari e verdetti della ricerca).
- **Costo Google/Haiku:** zero.
- **Stato proposto:** PRONTA.

### 5. "Lascia la recensione dove serve al locale"
- **Problema:** recensioni false e poca fiducia nelle stelle (`PROBLEMI.md`, 3); i piccoli locali bravi hanno poche recensioni e restano invisibili rispetto ai posti turistici.
- **Cosa fa:** dopo un "Com'è andata?" con 👍, una riga facoltativa: "Ti è piaciuto? Aiuta il locale: lascia due righe su Google" (link ufficiale di Google alla scrittura della recensione, nessun dato passa da noi). Solo per i locali con meno di 300 recensioni: chi ne ha migliaia non ne ha bisogno.
- **Da dove nasce:** Beli e Corner tengono le opinioni dentro l'app; il ristoratore piccolo vive delle recensioni Google. Noi siamo gli unici a spingere il passaparola verso chi è poco conosciuto (VISIONE: non mainstream), con recensioni vere di chi c'è stato.
- **Valore per l'utente:** un gesto utile in un tocco, senza scrivere niente in Mapetite.
- **Valore per il ristoratore:** recensioni vere di clienti contenti; nel pannello "N clienti Mapetite ti hanno lasciato una recensione". Argomento forte per il piano Verified.
- **Sforzo:** S.
- **Costo Google/Haiku:** zero (link pubblico, nessuna chiamata API).
- **Stato proposto:** PRONTA.

### 6. "Avvisami se si libera" (lista d'attesa della serata)
- **Problema:** no-show e tavoli liberati all'ultimo (`PROBLEMI.md`, 1). Un tavolo disdetto alle 19 resta vuoto perché nessuno lo sa.
- **Cosa fa:** su un locale salvato, "Avvisami se si libera stasera". Quando il locale (verificato) segna un tavolo libero nel pannello, chi aspetta riceve una notifica.
- **Da dove nasce:** Corner e Resy hanno la lista d'attesa ("Notify"); noi la leghiamo ai salvati e alle "Serate tranquille" già fatte.
- **Valore per l'utente:** entrare nel posto che voleva provare.
- **Valore per il ristoratore:** riempie il tavolo disdetto senza commissioni; è la funzione che si paga nel piano Growth.
- **Sforzo:** L. Servono notifiche push (oggi non ci sono) e il titolare attivo nel pannello.
- **Costo Google/Haiku:** zero; le notifiche push del browser sono gratuite ma vanno costruite.
- **Stato proposto:** DA DECIDERE LORENZO: "Costruiamo le notifiche push (gratuite) per avvisi come 'si è liberato un tavolo'?"

## 19/10/2026

### 1. "Hai due tavoli sabato: quale tieni?"
- **Problema:** prenotazioni multiple e no-show (`PROBLEMI.md`, 1). Il 33,8% delle prenotazioni subisce variazioni, disdette o no-show ([BusinessOnline](https://www.businessonline.it/news/cosa-si-rischia-se-si-prenota-al-ristorante-e-non-ci-si-presenta_n83960.html)); chi prenota in due posti per la stessa sera spesso non avvisa quello che scarta (`RICERCA-RISTORATORI.md`, riga 1).
- **Cosa fa:** se in "Le mie prenotazioni" ci sono due prenotazioni per la stessa sera (o lo stesso pranzo), il promemoria diventa uno solo: "Hai 2 tavoli sabato sera: quale tieni?". Tocchi quello che tieni; per l'altro si apre il "Non vado più" già pronto (WhatsApp, chiamata o testo). Nessun pulsante nuovo nelle altre schermate.
- **Da dove nasce:** nei concorrenti analizzati il 19/10 non l'abbiamo vista. TheFork, Zenchef e i gestionali vedono la prenotazione dentro il singolo locale: non possono sapere che la stessa persona ha prenotato anche altrove. Mapetite vede tutte le prenotazioni della persona, quindi è l'unico punto dove si può fare.
- **Valore per l'utente:** non deve ricordarsi di disdire, e lo fa in un tocco senza imbarazzo.
- **Valore per il ristoratore:** il tavolo scartato torna libero ore prima invece di restare vuoto. È un argomento per il piano Verified: "le prenotazioni da Mapetite si disdicono in anticipo". Da misurare con l'evento `prenotazione_disdetta` (già tracciato) aggiungendo il contesto "doppia".
- **Sforzo:** S. Tutto nel telefono, sui dati di `src/lib/booking.ts`; riusa `Disdetta` di `src/components/booking-reminder.tsx`. Controlli nuovi nel giro automatico.
- **Costo Google/Haiku:** zero.
- **Stato proposto:** PRONTA.

### 2. Buoni pasto: "Qui li accettano?" (detto da chi c'è stato)
- **Problema:** pausa pranzo con i buoni pasto (`PROBLEMI.md`, 5). Edenred da solo dichiara 2 milioni di beneficiari e oltre 150.000 esercizi convenzionati ([ESTE, 2022](https://www.este.it/wp-content/uploads/2022/07/Edenred_TR-ES-WELFARE_evento-ESTE_Marco-Galizioli_28.06.22.pdf)). I dati Google che usiamo non dicono se un locale li accetta (`src/lib/google-places.ts`, elenco dei campi).
- **Cosa fa:**
  - nel "Com'è andata?" di una visita a pranzo, una domanda facoltativa a pillole: "Accettavano buoni pasto? Sì / No / Non so";
  - nella scheda, una sola riga "🎫 Buoni pasto: sì, secondo 3 persone" quando almeno 2 risposte concordano (mai da una sola, mai inventata);
  - nel foglio Filtri, in Caratteristiche, "Buoni pasto"; il titolare verificato può confermarlo dal pannello.
- **Da dove nasce:** l'app del circuito Edenred mostra dove si possono usare i buoni, non se ci si mangia bene ([scheda Edenred](https://repo.edenred.it/Scheda_TR_aziende_e_piva.pdf), funzione "Cerca Locali"). BestieBite filtra per dieta e occasione, non per buoni pasto ([App Store](https://apps.apple.com/app/id6444921443)). Noi uniamo le due cose: "posto buono, vicino, che accetta i buoni", con il verdetto.
- **Valore per l'utente:** pranzo di lavoro scelto in pochi secondi, senza la domanda imbarazzante alla cassa.
- **Valore per il ristoratore:** il pranzo feriale è una fascia debole (`RICERCA-RISTORATORI.md`, riga 11). Nel pannello: "N persone hanno cercato pranzo con buoni pasto nella tua zona". Il titolare paga il piano Growth per confermare il dato e farsi trovare da chi cerca proprio questo, senza sconti. Prepara l'accordo con Edenred (`PARTNER.md`).
- **Sforzo:** M. Una migrazione (risposte degli utenti, solo "sì/no/non so" legato a visita, nessun testo libero); riga nella scheda; filtro sui risultati già arrivati e sui salvati.
- **Costo Google/Haiku:** zero (nessuna chiamata in più; il filtro lavora sui dati nostri).
- **Stato proposto:** PRONTA.

### 3. "Cliente di parola": la prenotazione arriva con la tua affidabilità
- **Problema:** no-show (`PROBLEMI.md`, 1). Il locale non sa se chi prenota si presenterà; per difendersi chiede la carta, che frena i clienti onesti.
- **Cosa fa:** quando l'utente prenota da Mapetite, il messaggio al locale può aggiungere una riga, solo se l'utente lo sceglie: "Con Mapetite: 5 prenotazioni, 5 volte presente o disdetto in tempo". La riga appare solo dopo 3 prenotazioni concluse. Nel pannello del ristoratore: quante prenotazioni da Mapetite sono arrivate da clienti di parola.
- **Da dove nasce:** SevenRooms e i gestionali tengono uno storico del cliente, ma (da quanto risulta dalle fonti viste, da verificare) resta chiuso dentro il singolo locale. TheFork chiede la carta a garanzia. Noi portiamo la reputazione del cliente da un locale all'altro, con il suo consenso, e diamo al locale un motivo per **non** chiedere la carta a chi è affidabile.
- **Valore per l'utente:** chi è puntuale viene trattato meglio e non deve lasciare la carta.
- **Valore per il ristoratore:** meno rischio senza spaventare i clienti con la caparra; lo pagherebbe nel piano Growth/Pro perché riduce i tavoli vuoti senza commissioni.
- **Sforzo:** L. Oggi le prenotazioni stanno solo nel telefono: vanno salvate sul server (migrazione), serve un modo onesto per sapere se la persona si è presentata (oggi solo il "Com'è andata?", cioè dichiarato dall'utente; la conferma vera arriva con il locale verificato o con un gestionale, `PARTNER.md`), consenso esplicito e informativa privacy.
- **Costo Google/Haiku:** zero.
- **Stato proposto:** DA DECIDERE LORENZO — "Possiamo salvare le prenotazioni sul server e mostrare al locale, solo con il consenso dell'utente, quante volte si è presentato?"
- **Avanzamento:** passo 1 FATTO il 29/10 (riga "di parola" nel messaggio, dal telefono). **Passo 2 FATTO il 31/10 pomeriggio:** "Tienile sul tuo account" in /prenotazioni, spento di base, informativa in /privacy; tabelle `prenotazioni` e `prenotazioni_consenso` (RLS: senza consenso il database rifiuta). Passo 3 PRONTA: nel pannello del locale verificato il numero di prenotazioni da Mapetite e quante da clienti di parola, senza nomi, con una riga in più nell'informativa e una nel consenso.
