# Problemi veri di ristoratori e clienti

Continua `RICERCA-RISTORATORI.md` (base di Lorenzo del 17/10). Qui ogni problema ha la stessa scheda:
- **Chi lo ha:** ristoratore, cliente o entrambi.
- **Quanto pesa:** numeri con fonte e link. Se non c'è un dato: "dato non trovato".
- **OGGI nell'app:** cosa possiamo fare subito, con sforzo S (meno di un giorno), M (1–3 giorni), L (oltre).
- **DAVVERO, in futuro:** cosa serve (partner, integrazioni, pagamenti, accordi, norme).
- **Primo passo** e **chi lo fa**: "team" (sessioni di sviluppo) oppure "Lorenzo/Roberto" (contatti, contratti, soldi).

Ultimo aggiornamento: 19/10/2026.

---

## 1. Disdette e tavoli vuoti all'ultimo minuto (no-show) — analisi completa

**Chi lo ha:** entrambi.
- Ristoratore: tavolo tenuto libero, cibo e personale pagati, coperto perso.
- Cliente: chi disdice si sente in colpa e spesso non avvisa perché è scomodo (telefono che non risponde, nessun canale rapido); chi cerca posto all'ultimo trova "tutto pieno" in locali che poi avranno tavoli vuoti.

**Quanto pesa:**
- No-show medio **12,8%** delle prenotazioni; il **33,8%** delle prenotazioni subisce variazioni, disdette o no-show (Osservatorio Incrementoo 2025, 212.000 prenotazioni in 300 ristoranti: [Beverfood](https://www.beverfood.com/ristorazione-2025-prenotazioni-digitali-e-fidelizzazione/), [BusinessOnline](https://www.businessonline.it/news/cosa-si-rischia-se-si-prenota-al-ristorante-e-non-ci-si-presenta_n83960.html)).
- La pre-autorizzazione sulla carta riduce i no-show di circa **3 volte** (39 ristoranti stellati in 18 paesi: [InTotheMinds](https://www.intotheminds.com/blog/it/carta-di-credito-deposito-ristorante/)).
- Promemoria: **−32%** di no-show (dato riportato in `POSIZIONAMENTO.md`, fonti Menumal e Beverfood; link originale non riaperto il 19/10).
- Il **51,5%** delle prenotazioni arriva quando il locale è chiuso (Cooperto, 500.000 prenotazioni: [Panorama](https://www.panorama.it/attualita/economia/prenotazioni-online-e-cancellazioni-lampo-otto-ristoranti-su-dieci-rischiano-di-perdere-la-meta-dei-clienti)): chi vuole disdire la sera spesso non trova nessuno al telefono.
- Casi in cronaca: tavolo da 25 persone mai presentato (aprile 2026, [Il Fatto Quotidiano](https://www.ilfattoquotidiano.it/2026/04/01/non-si-presentano-al-ristorante-dopo-aver-prenotato-per-25-persone-il-titolare-chiama-i-mancati-clienti-abbiamo-avuto-un-imprevisto-il-fenomeno-del-no-show-che-danneggia-i-ristoratori/8342176/)).
- Quanti tavoli liberati all'ultimo vengono riempiti di nuovo: dato non trovato (da chiedere nelle interviste).

**Cosa dice la legge oggi (non è un parere legale):**
- Non presentarsi non è un reato e non c'è una multa prevista ([Money.it](https://www.money.it/multa-per-chi-non-rispetta-prenotazione-ristorante-come-funziona)).
- Lo strumento usato è la **caparra**: quella chiesta online di solito vale come caparra confirmatoria del codice civile, e il locale la può trattenere se il cliente non si presenta ([QuiFinanza](https://quifinanza.it/fisco-tasse/leggi/caparra-digitale-ristorante-restituzione/918141/)).
- La penale va comunicata prima, con l'importo (associazione di categoria citata da QuiFinanza, sopra).
- Proposte di legge sul no-show nel 2026: non trovate nelle ricerche del 19/10.

**OGGI nell'app (già fatto, vedi `BACKLOG.md` e `POSIZIONAMENTO.md`):**
- Prenotazione assistita: messaggio già scritto per WhatsApp, telefono o sito; pagina "Le mie prenotazioni".
- Promemoria il giorno prima e il giorno stesso.
- "Non vado più": prepara la disdetta per il locale (WhatsApp, chiamata o testo copiato) in un tocco.
- "Serate tranquille" per i locali verificati: riempie i giorni vuoti con chi ha già salvato il locale.
- Limite di oggi: le prenotazioni stanno solo nel telefono dell'utente (`src/lib/booking.ts`); il locale non vede niente e noi non sappiamo se la persona si è presentata, salvo il "Com'è andata?".

**OGGI, cosa si può aggiungere senza partner:**
| Funzione | Cosa fa | Sforzo |
|---|---|---|
| Doppia prenotazione | Se l'utente ha due prenotazioni per la stessa sera: "Hai 2 tavoli sabato: quale tieni?" e prepara la disdetta per l'altro (vedi `PROPOSTE.md`, 19/10) | S |
| Disdetta fuori orario | "Non vado più" alle 23: se il locale ha solo il telefono, propone l'SMS o il messaggio da mandare la mattina dopo, con promemoria alle 10 | S |
| Promemoria a 3 ore | Oltre a giorno prima e giorno stesso, uno 3 ore prima con "Confermo / Non vado più" (come previsto in `RICERCA-RISTORATORI.md`, riga 1) | S |
| Contatore per il ristoratore | Nel pannello: "Disdette arrivate da Mapetite questo mese: N, in media X ore prima" (serve salvare l'evento lato server, già tracciato come `prenotazione_disdetta`) | M |

**DAVVERO, in futuro:**
- **Carta a garanzia o caparra:** il cliente lascia la carta, la penale scatta solo se non si presenta, secondo le regole del locale. Serve: un fornitore di pagamenti con conti per i singoli locali (per esempio Stripe Connect, citato in `RICERCA-RISTORATORI.md`), autenticazione forte della carta (regole europee sui pagamenti), condizioni scritte con un legale, gestione delle contestazioni. È un servizio a pagamento nuovo: decide Lorenzo.
- **Collegamento ai gestionali:** la prenotazione fatta da Mapetite entra direttamente nell'agenda del locale e la disdetta libera il tavolo da sola. Partner possibili: TheFork Manager, Zenchef/CoverManager, Zucchetti (Pienissimo Pro), Google (prenotazioni da Maps). Vedi `PARTNER.md`.
- **Pagamento della caparra con strumenti italiani:** Satispay (rete di esercenti già ampia, vedi `PARTNER.md`); buoni pasto (Edenred) solo per il pranzo, e da verificare se si possono usare come caparra.
- **Tavolo liberato rimesso in vendita:** chi ha salvato il locale riceve "si è liberato un tavolo stasera" (lo fa Corner). Serve che la disdetta arrivi al gestionale in tempo reale, cioè un'integrazione.

**Primo passo:** costruire "Doppia prenotazione" e il promemoria a 3 ore (team, questa settimana). In parallelo, 5 telefonate a ristoratori di Roma e Milano con 3 domande: quanti no-show a settimana, quanti tavoli liberati riempiono, accetterebbero una caparra chiesta da Mapetite (Lorenzo/Roberto).
**Chi lo fa:** team per le funzioni; Lorenzo/Roberto per interviste, scelta del fornitore di pagamenti e parere legale.

---

## 2. Prenotazioni perse quando il locale è chiuso

**Chi lo ha:** entrambi. Il cliente decide la sera o la mattina presto; il locale è chiuso o non risponde.
**Quanto pesa:** 51,5% delle prenotazioni arriva a locale chiuso; 8 ristoranti su 10 usano ancora l'agenda di carta (Cooperto: [Panorama](https://www.panorama.it/attualita/economia/prenotazioni-online-e-cancellazioni-lampo-otto-ristoranti-su-dieci-rischiano-di-perdere-la-meta-dei-clienti)).
**OGGI nell'app:** la prenotazione assistita prepara già il messaggio WhatsApp. Aggiunta possibile: se il locale è chiuso adesso, la scheda dice "Chiuso ora: il messaggio arriverà, risponderanno da domani alle 12" (orari Google già in memoria) e il promemoria ricorda di controllare la risposta. Sforzo S.
**DAVVERO:** richiesta strutturata che il locale conferma in un tocco (email, poi WhatsApp Business: costi e approvazione Meta) o integrazione con un gestionale (vedi `PARTNER.md`).
**FATTO il 19/10 notte (PR della notte):** nel foglio Prenota, con gli orari Google della ricerca (solo da mostrare, niente salvato), gli orari in cui il locale risulta chiuso sono barrati e scegliendoli compare "A quell'ora risulta chiuso"; a locale chiuso adesso, "Riapre domani alle 12:00: la risposta arriverà probabilmente da allora". Nessuna chiamata Google in più (gli orari erano già nella risposta della ricerca).
**Primo passo successivo:** il promemoria "Controlla la risposta" alla riapertura (team, S); WhatsApp Business resta da decidere (Lorenzo).
**Chi lo fa:** team; per WhatsApp Business serve l'ok di Lorenzo (costo nuovo).

---

## 3. Recensioni false e poca fiducia nelle stelle

**Chi lo ha:** entrambi. Il ristoratore subisce ricatti e recensioni pilotate; il cliente non sa più di cosa fidarsi.
**Quanto pesa:** il 60% dei ristoratori dichiara danni da recensioni false; l'8,6% delle recensioni 2024 sulle principali piattaforme è risultato falso ([Gambero Rosso, sondaggio Epam giugno 2025](https://www.gamberorosso.it/notizie/attualita/recensioni-negative-ristoranti-impatti-dati/)); casi di 100 recensioni offerte per 400 € con minacce ([Gambero Rosso, inchiesta](https://www.gamberorosso.it/ristoranti/recensioni-false/)).
**OGGI nell'app:** il verdetto legge i temi che si ripetono, non il singolo voto (già fatto); "Visite vere" nel pannello del ristoratore (già fatto). Aggiunta possibile: nella scheda, sotto il verdetto, "Secondo N persone di Mapetite che ci sono state" solo quando N ≥ 3 (dati "Com'è andata?" già raccolti). Sforzo S.
**DAVVERO:** visita legata a una prenotazione confermata dal locale (serve integrazione con il gestionale) e badge "visite verificate" da esporre sul sito del ristorante.
**Primo passo:** la riga "secondo N persone che ci sono state" nella scheda (team).
**Chi lo fa:** team.

---

## 4. Commissioni a coperto delle piattaforme di prenotazione

**Chi lo ha:** ristoratore (e indirettamente il cliente, se i costi finiscono nel conto).
**Quanto pesa:** TheFork 2–4 € + IVA a coperto a cena sul piano base (dato 2017, [La Rassegna](https://www.larassegna.it/scarica-pdf/prenotazioni-on-line-per-i-ristoratori-una-sfida-da-non-rimandare/)); +12,6% nel 2023, contestato da Fipe ([CorCom](https://www.corrierecomunicazioni.it/digital-economy/the-fork-le-commissioni-salgono-del-126-fipe-aumenti-ingiustificati/)). Zenchef e CoverManager si vendono proprio come "0 € di commissione" ([Hotel Tech Report](https://hoteltechreport.com/it/food-and-beverage/restaurant-reservation-software/zenchef)).
**OGGI nell'app:** nessuna commissione: la prenotazione va diretta al locale. La pagina "Per i ristoratori" lo deve dire in una riga ("Zero commissioni a coperto"). Sforzo S.
**DAVVERO:** canone fisso mensile per i piani Verified/Growth/Pro (decisione di business plan).
**Primo passo:** fissare il prezzo dei piani nel business plan.
**Chi lo fa:** Lorenzo/Roberto.

---

## 5. Pausa pranzo con i buoni pasto: dove li accettano, e dove si mangia bene

**Chi lo ha:** entrambi.
- Cliente: chi lavora ha i buoni pasto e deve scegliere in fretta un posto vicino che li accetti; le app dei circuiti dicono dove si possono usare, non se ci si mangia bene.
- Ristoratore: il pranzo dei giorni feriali è una fascia debole da riempire (`RICERCA-RISTORATORI.md`, riga 11).
**Quanto pesa:** Edenred dichiara oltre 150.000 esercizi convenzionati, 80.000 aziende clienti e 2 milioni di beneficiari in Italia (presentazione 2022, [ESTE](https://www.este.it/wp-content/uploads/2022/07/Edenred_TR-ES-WELFARE_evento-ESTE_Marco-Galizioli_28.06.22.pdf); [scheda Edenred](https://repo.edenred.it/Scheda_TR_aziende_e_piva.pdf)). Quanti clienti scartano un locale perché non sanno se accetta i buoni: dato non trovato.
**OGGI nell'app:** i dati Google che usiamo non dicono se un locale accetta i buoni pasto (non è nel nostro elenco di campi, `src/lib/google-places.ts`). Possiamo chiederlo a chi c'è stato e al titolare verificato (vedi `PROPOSTE.md`, 19/10). Sforzo M.
**DAVVERO:** elenco ufficiale dei locali convenzionati dai circuiti (Edenred, altri) con un accordo; pagamento con buono pasto dentro l'app.
**Primo passo:** la domanda "Accettano buoni pasto?" nel "Com'è andata?" (team); email a Edenred (Lorenzo, bozza in `PARTNER.md`).
**Chi lo fa:** team e Lorenzo.
