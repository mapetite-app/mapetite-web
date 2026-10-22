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
