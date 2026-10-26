# Problemi veri di ristoratori e clienti

Continua `RICERCA-RISTORATORI.md` (base di Lorenzo del 17/10). Qui ogni problema ha la stessa scheda:
- **Chi lo ha:** ristoratore, cliente o entrambi.
- **Quanto pesa:** numeri con fonte e link. Se non c'è un dato: "dato non trovato".
- **OGGI nell'app:** cosa possiamo fare subito, con sforzo S (meno di un giorno), M (1–3 giorni), L (oltre).
- **DAVVERO, in futuro:** cosa serve (partner, integrazioni, pagamenti, accordi, norme).
- **Primo passo** e **chi lo fa**: "team" (sessioni di sviluppo) oppure "Lorenzo/Roberto" (contatti, contratti, soldi).

Ultimo aggiornamento: 26/10/2026 (notte).

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
- **Aggiornato 24/10:** nel 2025 il 38% dei pubblici esercizi con più di 10 addetti usava la prenotazione online (dato Istat citato da Fipe: [Teleborsa, 19/2/2026](https://www.teleborsa.it/News/2026/02/19/fipe-e-quandoo-uniscono-le-forze-per-le-prenotazioni-online-111.html)); Fipe ha scelto Quandoo come partner proprio contro i no-show. Stime internazionali: i no-show valgono dal 5 al 20% dei ricavi possibili ([Linkiesta, 3/2026](https://www.linkiesta.it/2026/03/perche-devi-disdire-la-prenotazione-a-un-ristorante-se-sai-che-non-ci-andrai/); stime non italiane). Dato italiano 2026 di Fipe sui no-show: non trovato.
- **Cosa cambia per noi (24/10):** la prenotazione con caparra la danno già TheFork, Quandoo e Zenchef. Il pezzo che manca a tutti è **disdire in un tocco quando il locale è chiuso** (51,5% delle prenotazioni arriva a locale chiuso, Cooperto, sopra). Oggi in app c'è già "Non vado più" nel promemoria della prenotazione, con il messaggio pronto per WhatsApp: funziona anche a locale chiuso (`src/components/booking-reminder.tsx`). Manca sapere se il tavolo viene poi riempito: nel pannello del ristoratore si contano i tavoli liberati per tempo, non quelli rivenduti. Domani: lo stesso tasto collegato al gestionale, così il tavolo torna libero da solo (partner Zenchef/CoverManager). Primo passo: Lorenzo o Roberto chiedono a 3 ristoratori di Roma quanti tavoli disdetti per WhatsApp riescono a rivendere (domanda da aggiungere a `RICERCA-RISTORATORI.md`).

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
| Doppia prenotazione — **FATTA (PR #81, 19/10)** | Se l'utente ha due prenotazioni per la stessa sera: "Hai 2 tavoli sabato: quale tieni?" e prepara la disdetta per l'altro (vedi `PROPOSTE.md`, 19/10) | S |
| Disdetta fuori orario | "Non vado più" alle 23: se il locale ha solo il telefono, propone l'SMS o il messaggio da mandare la mattina dopo, con promemoria alle 10 | S |
| Promemoria a 3 ore | Oltre a giorno prima e giorno stesso, uno 3 ore prima con "Confermo / Non vado più" (come previsto in `RICERCA-RISTORATORI.md`, riga 1) | S |
| Contatore per il ristoratore — **FATTO (notte 19→20)**: "🔁 N tavoli liberati per tempo, in media X ore prima" | Nel pannello: "Disdette arrivate da Mapetite questo mese: N, in media X ore prima" (serve salvare l'evento lato server, già tracciato come `prenotazione_disdetta`) | M |

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

## 6. I locali nuovi e piccoli non si fanno trovare (e metà chiude entro 5 anni) — 20/10
- **Chi lo ha:** entrambi. Il ristoratore nuovo ha poche recensioni e Google lo mette dietro i posti famosi; il cliente scopre le aperture solo per caso sui social.
- **Quanto pesa:**
  - sopravvivenza a 5 anni intorno al 53% ([Gambero Rosso, Rapporto Fipe 2025](https://www.gamberorosso.it/notizie/attualita/ristorazione-rapporto-fipe-2025/)); 54% per le imprese nate nel 2018 ([Linkiesta](https://www.linkiesta.it/2024/04/tutti-vogliono-aprire-un-ristorante-ma-dopo-cinque-anni-la-meta-chiude/));
  - nel 2024 10.719 aperture contro 29.097 chiusure (Rapporto Fipe 2025, link sopra);
  - nel 2025 le imprese del settore sono 324.436 (−1%), bar −2,2% ([Rapporto Fipe 2026, PDF](https://www.confcommerciomilano.it/export/sites/unione/doc/news_comunicati/pdf/2026/fipe_risto_rapp26.pdf); [Teleborsa, 9/4/2026](https://www.teleborsa.it/News/2026/04/09/ristorazione-consumi-a-quota-100-miliardi-di-euro-in-calo-imprese-e-lavoratori-dipendenti-139.html));
  - quanto pesi la visibilità sulle chiusure: dato non trovato.
- **OGGI nell'app:** "Aperto da poco" (proposta 7): il titolare verificato indica da quando è aperto, la scheda lo dice, le ricerche non lo penalizzano per le poche recensioni. Già oggi il badge 💎 "Poco conosciuto" spinge i posti con poche recensioni ma voti alti. Sforzo M.
- **DAVVERO, in futuro:** un elenco affidabile delle nuove aperture (camere di commercio o accordo con Fipe) e pre-aperture con invito (proposta 9).
- **Primo passo:** proposta 7 (team). **Chi lo fa:** team; i contatti con Fipe Lorenzo o Roberto.

## 7. I clienti che tornano valgono tanto, ma nessuno li vede (né il locale né il cliente) — 20/10
- **Chi lo ha:** entrambi. Il ristoratore non sa chi torna se non ha un gestionale con CRM; il cliente, quando deve scegliere "un posto sicuro", non ha una lista dei suoi posti fissi.
- **Quanto pesa (dati da fonti di settore, USA, da prendere come indicazione):**
  - circa il 7% degli ospiti con più visite può valere fino al 50% degli ordini (dati Toast, 2026, ripresi da Stacker: [KRDO, 4/9/2026](https://krdo.com/stacker-business-economy/2026/09/04/report-7-of-guests-can-drive-up-to-50-of-restaurant-order-volume/)); chi entra in un programma fedeltà torna molto più spesso (stessa fonte: [KEYT](https://keyt.com/?p=1472466));
  - il 78,8% degli ospiti non torna dopo un anno secondo Bloom Intelligence ([report 2025](https://bloomintelligence.com/blog/state-of-restaurant-guest-retention-2025/); metodo non visibile);
  - l'82% dei ristoratori intervistati da Square dice che il programma fedeltà porta visite ripetute (autodichiarato: [BusinessWire, 30/1/2025](https://www.businesswire.com/news/home/20250130230632/en/Squares));
  - Italia: dato sul ritorno dei clienti non trovato. Per i canali di prenotazione: piattaforme 38%, sito o Google 22%, telefono 21% su 212.000 prenotazioni in 300 ristoranti (osservatorio Incrementoo 2025, via [Beverfood](https://www.beverfood.com/ristorazione-2025-prenotazioni-digitali-e-fidelizzazione/)).
- **OGGI nell'app (fatto il 20/10):** "↻ Ci sono tornato" nella scheda, "I tuoi posti fissi" nel profilo con "Proponi" agli amici, e nel pannello del ristoratore "↻ N persone di Mapetite sono tornate da te 2 o più volte" (solo da 3 persone in su). Prossimi passi S: "Prenota come l'ultima volta" e "È la mia 3ª volta da voi" (proposte 10 e 11).
- **DAVVERO, in futuro:** visite confermate (non solo dichiarate) legando "Ci sono tornato" a una prenotazione onorata o al pagamento (Satispay, gestionali di cassa come Cassa in Cloud di TeamSystem: API pubbliche sui clienti non trovate); un omaggio per chi torna (proposta 12, DA DECIDERE LORENZO).
- **Primo passo:** proposte 10 e 11 (team). **Chi lo fa:** team; i contatti con i gestionali Lorenzo o Roberto.


## 8. I posti visti sui social si perdono (e i post "5 posti dove…" ancora di più) — 21/10
- **Chi lo ha:** il cliente (e di riflesso il ristoratore, che perde chi lo aveva scoperto).
- **Quanto pesa (dati da fonti di settore, USA, da prendere come indicazione):** secondo l'indagine di Toast (ottobre 2025, 1.466 adulti USA) TikTok è il primo canale di scoperta dei ristoranti per la Gen Z (circa 38%); su tutti gli adulti vince il passaparola (38%), con Instagram 15% e TikTok 14% ([Toast, 2026](https://pos.toasttab.com/blog/data/how-guests-discover-new-restaurants); Toast vende software ai ristoranti). Morning Consult (luglio 2025, 1.001 Gen Z) dà più peso alla ricerca "vicino a me" ([Morning Consult](https://pro.morningconsult.com/analysis/gen-z-social-media-restaurants-recipes)). Italia: dato non trovato. Quanti salvataggi sui social non vengono mai riaperti: dato non trovato.
- **OGGI nell'app (fatto il 21/10):** "Salva dal reel": TikTok e YouTube letti da soli dalla didascalia, Instagram in un passo (screenshot o nome), più locali per post, salvataggio da solo solo quando il nome e la città combaciano con Google, "Non è questo" per annullare, il reel resta collegato al locale. Prossimi passi S: tutte le slide del carosello (proposta 13), il verdetto subito (proposta 14).
- **DAVVERO, in futuro:** leggere i reel di Instagram dal link serve l'oEmbed ufficiale di Meta, che vuole un'app Meta (gratuita) con token; le scritte sovrapposte e l'audio dei video si leggerebbero solo scaricando il video, cosa che i termini delle piattaforme non permettono senza accordi. Con i creator: liste ufficiali "i posti del mio video" collegate al reel.
- **Primo passo:** app Meta per l'oEmbed (Lorenzo: si crea con il suo account; i passi li prepara il team). **Chi lo fa:** Lorenzo (account), team (codice, già pronto a usarlo).

## 9. Salvato ma mai andato: il "voglio andarci" non diventa una serata — 21/10 mattina
- **Chi lo ha:** entrambi. Il cliente ha la lista ma non decide; il ristoratore era stato scelto e non vede mai la prenotazione.
- **Quanto pesa:** nell'indagine SevenRooms "Making Booking Social" (Regno Unito, 2.012 persone dai 16 anni, novembre 2022) il **56% della Gen Z** dice di trovare sui social ristoranti dove vorrebbe andare ma di non arrivare mai a prenotare; il 58% prenoterebbe di più se potesse farlo direttamente da dove l'ha visto ([SevenRooms, comunicato](https://sevenrooms.com/press/nearly-2-in-3-restaurants-are-missing-booking-opportunities-enabled-by-social-media/), [PDF](https://go.sevenrooms.com/rs/519-YNM-008/images/Making_Booking_Social_UK.pdf); SevenRooms vende software di prenotazione). Italia: dato non trovato. Quanti salvati di Mapetite diventano "ci sono stato": si può misurare dagli eventi (`reel_salva`, `visita`), da fare nel pannello.
- **OGGI nell'app:** il verdetto subito dopo il salvataggio (fatto stamattina) dice se vale la pena; "Stasera dove andiamo?" e "sei vicino a un posto che volevi provare" riportano a galla i salvati. Proposta 17: "Quando ci vai?" al momento del salvataggio (S), così il salvato ha una data e ritorna da solo quel giorno.
- **DAVVERO, in futuro:** prenotazione vera dentro il "✓ Salvato" (collegamento con i sistemi di prenotazione dei locali: TheFork, Zenchef, CoverManager; vedi `PARTNER.md`), e per il ristoratore il numero "ti hanno salvato in 40 dopo il reel di @creator, 6 hanno prenotato".
- **Primo passo:** proposta 17 (team, S); misura "salvati → ci sono stato" nel pannello `/admin/numeri` (team, S). **Chi lo fa:** team; accordi di prenotazione: Lorenzo/Roberto.

## 10. Le risposte dell'AI sui locali sono plausibili, ma non si sa se sono vere — 22/10 notte
- **Chi lo ha:** il cliente (sceglie un "rooftop romantico" che non ha la terrazza) e il ristoratore (descritto con cose che non ha, o non trovato per quelle che ha).
- **Quanto pesa:** Google ha portato la ricerca a conversazione dentro Maps (Ask Maps, marzo 2026, USA e India: [GSMArena](https://www.gsmarena.com/google_maps_gets_geminipowered_ask_maps_and_immersive_navigation-news-71935.php)); OpenTable risponde alle domande sul dehors con l'AI ([OpenTable](https://www.opentable.com/blog/?p=140844)). Nessuna delle due fonti dice se e come le risposte sono verificate. Quante risposte AI sui locali sono sbagliate: dato non trovato. VISIONE: "un verdetto plausibile ma falso vale meno di nessun verdetto".
- **OGGI nell'app (fatto il 22/10):** per ogni locale l'AI dice quali requisiti scritti nella richiesta le recensioni confermano; la card mostra solo quelli ("✓ terrazza · ✓ romantico"), la pillola conta quanti posti li confermano. Nel dubbio non compare niente. Prossimo passo S/M: toccando "✓ terrazza" si legge la frase della recensione che lo conferma (proposta 18).
- **DAVVERO, in futuro:** dati dichiarati dal locale ("ha la terrazza", "posti all'aperto da maggio a settembre") nella pagina verificata del ristoratore, mostrati come "detto dal locale" accanto a "confermato dalle recensioni". Per il ristoratore: farsi trovare per ciò che ha davvero.
- **Primo passo:** proposta 18 (team, S). Il "detto dal locale" arriva con la pagina verificata (dopo il 26/10). **Chi lo fa:** team.
- **Approfondito il 22/10 mattina:** la causa vera delle due bocciature non era solo la regola della frase: sul telefono la prova si cercava su 3 recensioni tagliate a 300 caratteri e **senza voto** (il filtro "solo 4-5 stelle" non agiva mai). Una frase tagliata può perdere il "ma purtroppo" che la smentisce. Ora la prova si cerca nel primo tempo, sulle 5 recensioni intere con il voto, per i requisiti capiti dalla ricerca: sulle 3 ricerche vere di stamattina le card con un ✓ provato passano da 2 su 21 a 21 su 60, e nessuna prova è da 1-2 stelle. **Lezione per tutte le funzioni "non inventa":** controllare *quali dati* arrivano davvero al punto in cui si decide, non solo la regola.
- **Approfondito il 23/10 notte:** quanto pesa, con fonte nuova: nell'indagine BrightLocal 2026 il 45% dei consumatori USA ha usato un'AI per consigli su attività locali, contro il 6% dell'anno prima ([BrightLocal](https://www.brightlocal.com/research/local-consumer-review-survey/)). La domanda c'è; la fiducia si guadagna con la prova. **Lezione della terza bocciatura:** le regole sulle parole non capiscono l'ironia ("romantico come una mensa"), l'AI da sola invece afferma cose senza prova. **OGGI (fatto il 23/10): doppia chiave.** Le regole trovano la frase in una recensione da 4-5 stelle; l'AI dei verdetti dice solo se quella frase afferma davvero il requisito (sceglie, non scrive). Il ✓ compare solo con tutte e due. Costo: zero Google, qualche token in più nella chiamata che già c'è.

## 11. Quando l'AI si ferma, il verdetto sparisce (e con lui la differenza con Google Maps) — 23/10 mattina
- **Chi lo ha:** il cliente (vede una lista come Google, senza il perché) e di riflesso il ristoratore (la chicca giusta non viene spiegata e resta in mezzo alle altre).
- **Quanto pesa (dato nostro, non di settore):** il 23/10 il credito prepagato dell'AI è finito durante la notte. In produzione, alla prova delle 01:00, 0 "perché" su 12 posti. Alle 05:10 la prova "trattoria a Trastevere" in sviluppo: verdetto solo per i locali già in archivio (5 su 7), niente per i nuovi, primo in lista un locale senza verdetto. VISIONE: "il verdetto editoriale deve esserci SEMPRE". Quante app consumer si fermano per un fornitore AI: dato non trovato.
- **OGGI nell'app:** l'app non si rompe: i verdetti già scritti restano (archivio), la scheda mostra "Da Google" (descrizione di Google o una frase di recensione, con l'etichetta della fonte), mai testo inventato. Manca: sapere *subito* che il credito sta finendo. Proposta 24 (S): stato dell'AI nel pannello `/admin/numeri` e avviso automatico.
- **DAVVERO, in futuro:** budget mensile dell'AI con soglia di avviso nella console Anthropic (Lorenzo); verdetti scritti una volta e conservati (già così: costano solo la prima volta), così l'archivio cresce e la dipendenza cala con l'uso; un secondo fornitore di riserva solo se il costo resta nel budget (decisione di Lorenzo).
- **Primo passo:** ricaricare il credito (Lorenzo, `DA-FARE-LORENZO.md`); proposta 24 (team, S). **Chi lo fa:** Lorenzo (credito, soglia), team (pannello e avviso).

## 12. Recensioni false e ricatti: il ristoratore non si difende, il cliente non si fida — 26/10 notte
- **Chi lo ha:** entrambi.
- **Quanto pesa:** secondo uno studio Fipe-Confcommercio citato da Unione Sarda (2026), le recensioni incidono sul fatturato fino al 30%; nel 2024 l'8,6% delle recensioni sulle grandi piattaforme è risultato falso (Gambero Rosso, giugno 2025, fonte secondaria). Casi di ricatto documentati a Cagliari (Unione Sarda, 2026) e a Roma, Ripa 12 (Linkiesta, giugno 2025). Dal 7/4/2026 la **Legge 34/2026** fissa quando una recensione è valida: limiti di tempo, verifica della presenza reale dell'autore nel locale, divieto di compravendita (Unione Sarda). Fonti: https://www.unionesarda.it/info-aziende/boom-recensioni-false-un-danno-per-ristoratori-e-clienti-r4uirdbj · https://www.gamberorosso.it/notizie/attualita/recensioni-negative-ristoranti-impatti-dati/ · https://www.linkiesta.it/2025/06/a-che-punto-sono-le-norme-italiane-contro-le-false-recensioni-online/
- **OGGI nell'app:** il verdetto si scrive solo da recensioni Google e non inventa (già così); "✓ Ci sono stato" diventa una visita vista dal telefono nel momento del tocco (proposta 28, M); la community mostra quante opinioni vengono da visite viste.
- **DAVVERO, in futuro:** conferma della visita dal locale (prenotazione o conto pagato) tramite gestionali di cassa e prenotazione; la legge rende questo dato prezioso per il ristoratore. Serve un parere legale sulla legge prima di dire "conforme".
- **Primo passo:** proposta 28 dopo lo sprint (team). Lettura del testo della Legge 34/2026 e parere di un legale: Lorenzo/Roberto.

