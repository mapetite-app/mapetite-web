# Visione di Mapetite — cosa costruiamo e perché

Scritta da Lorenzo il 12/10/2026. Vincolante quanto `LORENZO.md`: leggila prima di ogni sessione.
Metà delle decisioni tecniche dipendono da qui. Senza questa visione si finisce per costruire un clone di Google Maps con sopra un'AI.

## Il problema
Le persone scoprono locali tutto il giorno: un reel su Instagram, il video di un creator, un amico che dice "devi andarci". Ogni volta pensano "questo posto me lo devo ricordare".
Poi quel ricordo si disperde: post salvati che non riapriranno mai, screenshot nella galleria, note scritte di fretta, link mandati a sé stessi su WhatsApp, bandierine su Maps senza contesto.
Arriva sabato: "Dove andiamo a cena?". Si riparte da zero: si torna sui social a cercare ispirazione, si chiede in giro, si finisce nel solito posto.
**Il bisogno non è trovare un ristorante. È non perderlo quando lo incontri, e ritrovarlo nel momento giusto.**

Oggi nessuno copre quel percorso per intero:
- Instagram e TikTok fanno scoprire ma non organizzano.
- Google Maps organizza ma è generalista: nessuna dimensione sociale, nessuna raccomandazione che capisca i gusti.
- TripAdvisor e TheFork servono la scelta finale ma non raccolgono niente nel tempo.
- Mapstr e Places fanno bookmarking geografico, ma generalista, senza AI e senza legame con la scoperta social.

Scoperta, organizzazione, ricerca e decisione vivono su strumenti diversi. Nessuno li unisce.

## Cosa deve essere Mapetite
La mappa personale e intelligente del food & beverage: **raccogli, organizza, ritrova, scegli**.
- **Raccogli**: salvi un locale da qualsiasi fonte in un gesto: social, mappe, link condiviso, ricerca, inserimento manuale, o importando in blocco quello che hai già accumulato altrove negli anni.
- **Organizza**: tutto geolocalizzato, categorizzato, filtrabile. Per zona, per occasione, per contesto: da provare, già visitati, romantici, viaggi.
- **Ritrova**: nel momento della scelta, in pochi secondi, senza saltare tra app.
- **Fatti suggerire**: il sistema impara dai tuoi comportamenti (cosa salvi, cosa filtri, dove torni). Più lo usi, più ti conosce.

## Il differenziatore — da tenere presente in ogni scelta tecnica
Mapetite deve far emergere i locali **NON mainstream** che corrispondono al gusto personale di chi cerca.
È il punto su cui ci giochiamo tutto, ed è quello in cui è più facile sbagliare in modo invisibile.

Esempio reale: un sort per "qualità" basato su media bayesiana di voto e numero di recensioni sembrava sensato. In pratica premiava chi ha più recensioni, cioè i locali più turistici. Alla query "trattoria autentica non turistica" metteva primo un posto con 4.396 recensioni in inglese, davanti alle trattorie di quartiere che Google aveva correttamente trovato. **Il sistema stava ottimizzando CONTRO la richiesta dell'utente, in silenzio.**

**Regola:** ogni volta che introduci un ranking, un filtro o una soglia, chiediti se spinge verso il posto giusto per questa persona o verso il posto più popolare. Se la risposta è "il più popolare", stiamo costruendo Google Maps con più passaggi.

Il motore di raccomandazione non si basa su voti espliciti ma sui **comportamenti**: salvataggi, filtri, visite. Sono segnali impliciti più ricchi e meno manipolabili, che migliorano con l'accumularsi dei dati. È qui che nasce il vantaggio competitivo: un patrimonio di dati sui comportamenti di scoperta nel food che nessun altro ha, perché nessun altro è verticale su questo.

**Verticale è una scelta, non un limite.** Solo food & beverage. Permette un'esperienza ottimizzata, dati qualitativamente superiori e una proposta credibile verso i ristoratori.

## L'asticella di qualità
Il metro non è "funziona". Il metro è: una persona che usa Instagram e Google Maps ogni giorno apre Mapetite e capisce **in dieci secondi** perché dovrebbe usare questo invece di quelli.
- "Un ristorante romantico con terrazza per la mia ragazza" non deve far uscire osterie e pub. O la ricerca rispetta tutti i vincoli espressi, o non è una ricerca intelligente.
- Una ricerca da venti secondi non esiste: nessuno aspetta.
- Una lista risultati che è un elenco grezzo da scorrere perde il confronto con i concorrenti prima ancora di iniziare.
- **Il verdetto editoriale deve esserci SEMPRE**, non a volte. È ciò che ci rende diversi: se compare a intermittenza, l'utente non capisce nemmeno che esiste.
- **L'app non deve mai inventare niente.** Un verdetto plausibile ma falso vale meno di nessun verdetto.

Riferimenti di layout: Places come principale, Mapstr secondario, Albo per onboarding e flusso di salvataggio. Prendere ispirazione e superarli: non è un esercizio di copia, è il livello minimo da raggiungere prima di poterci distinguere.

## A chi serve
Due lati, che si alimentano a vicenda.
- **Utenti**: persone tra i 22 e i 45 anni che escono spesso, scoprono locali sui social e tengono alla qualità dell'esperienza. Per loro il valore è immediato: zero luoghi persi, archivio ordinato, meno tempo per scegliere, decisioni migliori.
- **Ristoratori**: non pagheranno per "esserci". Pagheranno per domanda qualificata (utenti già in fase di scelta, vicini alla conversione), per il controllo della propria presenza e per capire cosa cerca davvero la gente nella loro zona. Questo lato arriva dopo, ma **i dati vanno progettati sapendo che arriverà**.

Più utenti rendono la piattaforma interessante per i ristoratori; più locali curati rendono la mappa più utile agli utenti. È l'effetto rete, per cui la densità iniziale conta più del numero assoluto: **si parte concentrati su Roma e Milano**.

## Dove siamo e dove dobbiamo arrivare
Oggi l'app non è ancora mostrabile: la ricerca è troppo approssimativa e la grafica non è al livello. Sono i due bloccanti, in quest'ordine.
Entro fine ottobre deve essere pronta per un gruppo chiuso di persone vere: non un prototipo da spiegare a voce, ma qualcosa che si installa, si usa e si capisce da solo.
Dopo c'è il pitch agli investitori: **ogni funzione deve reggere a una demo dal vivo, su un telefono, con qualcuno che guarda.** Niente che funzioni solo se sai dove cliccare.

Lorenzo non cerca un'app che faccia le cose del piano: cerca che Mapetite superi i concorrenti. Se mancano funzionalità, proponile. Se c'è un modo migliore di fare qualcosa, dillo. Lavora con l'ambizione di chi costruisce il prodotto che userà, non con quella di chi chiude un ticket.
