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
