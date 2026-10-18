# Ricerca: problemi dei ristoratori (risk & mitigant)

Base di partenza di Lorenzo (versione 17/10/2026, file originale `riferimenti/Mapetite_Risk_Mitigant_Ristoratori.xlsx`). Va **ampliata** dal team: nuovi problemi B2B e B2C, dati aggiornati, soluzioni. Il lavoro continuo si fa in `PROBLEMI.md` e `PARTNER.md`; questo file resta la fonte iniziale.

- Punteggi 1–5 = stima qualitativa da validare con Roberto e con interviste ai ristoratori, non dati.
- Score = Valore×0,40 + Vantaggio Mapetite×0,35 + Fattibilità×0,25.
- Fasi: **Ora** = decisione per il pitch · **Fase 2** = pilota B2B con 3–5 locali dopo i tester · **Fase 3** = serve massa critica di utenti · **Non fare** = fuori dal core.
- Dove c'è scritto "n.d. – da validare" non esiste ancora un dato affidabile: non inventarlo.

## Classifica

| Rank | # | Problema | Fase | Score |
|---|---|---|---|---|
| 1 | 7 | Locali di qualità con poche recensioni penalizzati dagli algoritmi basati su volume e stelle. | Fase 2 | 4.35 |
| 2 | 4 | Commissioni per coperto delle piattaforme di prenotazione, percepite come elevate e unilaterali. | Ora (decisione pitch) | 4.25 |
| 3 | 2 | Tavolo liberato all'ultimo minuto che resta vuoto | Fase 3 | 4.1 |
| 3 | 6 | Recensioni false e ricatti ("paga o ti affossiamo"), review bombing dopo licenziamenti o per concorrenza. | Fase 3 | 4.1 |
| 3 | 8 | Il ristoratore non sa cosa cercano i clienti nella sua zona né perché viene scelto o scartato. | Fase 3 (logging subito) | 4.1 |
| 6 | 3 | Prenotazioni perse fuori orario | Fase 2 | 3.65 |
| 7 | 1 | No-show e prenotazioni multiple | Fase 2 | 3.45 |
| 8 | 9 | Clienti che non tornano; pochi locali hanno CRM o programmi fedeltà. | Fase 3 | 3.35 |
| 8 | 11 | Fasce orarie deboli (pranzo, inizio settimana) con sala vuota e costi fissi invariati. | Fase 3 | 3.35 |
| 10 | 10 | Informazioni errate o non aggiornate (orari, chiusure straordinarie, menu) che fanno perdere clienti o generano recensioni negative. | Fase 2 | 3.25 |
| 11 | 12 | Carenza di personale qualificato. | Non fare | 2.6 |
| 11 | 13 | Margini compressi da materie prime, energia, affitti e fisco. | Non fare | 2.6 |
| 13 | 5 | Commissioni delle piattaforme di delivery che azzerano il margine sugli ordini a domicilio. | Non fare | 1.8 |

## 1. Prenotazioni — No-show e prenotazioni multiple

- **Problema:** No-show e prenotazioni multiple: il cliente prenota più locali per la stessa sera e si presenta in uno solo, senza avvisare.
- **Evidenza:** No-show medio 12,8% delle prenotazioni; il 33,8% delle prenotazioni subisce variazioni, cancellazioni o no-show. La pre-autorizzazione su carta riduce i no-show di circa 3 volte (ristoranti stellati). (S1, S2, S4)
- **Mitigant:** Garanzia con carta / caparra + reminder con conferma attiva e rilascio del tavolo in un tap (il no-show diventa cancellazione anticipata).
- **Feature in Mapetite:** "Link garanzia": il ristoratore che prende prenotazioni al telefono o su WhatsApp invia un link Mapetite; il cliente salva la carta, la penale si addebita solo in caso di no-show secondo la policy del locale. Reminder automatici T-24h / T-3h con "Confermo" / "Libero il tavolo".
- **Complessità:** Media · **Prerequisiti e vincoli:** Stripe Connect (onboarding/KYC esercente), salvataggio carta per addebito successivo, autenticazione forte (SCA), policy e T&C chiari (parere legale), gestione contestazioni. Mini-pannello ristoratore.
- **Dipendenza da utenti Mapetite:** Bassa – funziona anche con i clienti propri del locale (cuneo B2B senza massa critica)
- **Già presidiato da:** TheFork (garanzia carta ai partner), Cooperto, gestionali internazionali (es. SevenRooms, Tock)
- **Fase:** Fase 2 · Valore 5 · Vantaggio 2 · Fattibilità 3 · **Score 3.45 (rank 7)**

## 2. Prenotazioni — Tavolo liberato all'ultimo minuto che resta vuoto

- **Problema:** Tavolo liberato all'ultimo minuto che resta vuoto: anche se il cliente avvisa, non c'è tempo per riempirlo.
- **Evidenza:** n.d. – da validare con interviste (tasso di ri-occupazione dei tavoli cancellati). (—)
- **Mitigant:** Rivendere subito il tavolo a domanda vicina e già intenzionata.
- **Feature in Mapetite:** "Tavolo appena liberato": il ristoratore preme un pulsante (o si attiva in automatico dalla cancellazione della riga 1); gli utenti Mapetite che stanno cercando in zona o hanno salvato il locale ricevono badge/notifica. Unisce discovery e intento: è nativo per Mapetite.
- **Complessità:** Media · **Prerequisiti e vincoli:** Notifiche push della PWA (su iPhone solo se l'app è aggiunta alla schermata Home), filtro per zona/ricerca attiva, pannello ristoratore.
- **Dipendenza da utenti Mapetite:** Alta – serve densità di utenti attivi nella stessa zona e fascia oraria
- **Già presidiato da:** Da verificare (formula real-time poco diffusa in Italia: non documentato)
- **Fase:** Fase 3 · Valore 4 · Vantaggio 5 · Fattibilità 3 · **Score 4.1 (rank 3)**

## 3. Prenotazioni — Prenotazioni perse fuori orario

- **Problema:** Prenotazioni perse fuori orario: il cliente cerca la sera o la mattina, il locale è chiuso o al telefono non risponde nessuno.
- **Evidenza:** Il 51,5% delle prenotazioni arriva quando il locale è chiuso; 8 ristoranti su 10 usano ancora l'agenda cartacea. (S3)
- **Mitigant:** Canale di richiesta asincrono 24/7, senza obbligo di gestionale.
- **Feature in Mapetite:** Pulsante "Richiedi tavolo" nella scheda locale: richiesta strutturata (data, ora, persone, note) inviata al ristoratore via email (poi WhatsApp); conferma con un tap. Nessuna integrazione con il gestionale del locale.
- **Complessità:** Bassa-Media · **Prerequisiti e vincoli:** Email transazionale; WhatsApp Business API in seconda battuta (costi e approvazione Meta). Gestione stato richiesta lato utente.
- **Dipendenza da utenti Mapetite:** Media – utile anche con pochi utenti, cresce con il traffico
- **Già presidiato da:** TheFork, Cooperto, gestionali di prenotazione
- **Fase:** Fase 2 · Valore 4 · Vantaggio 3 · Fattibilità 4 · **Score 3.65 (rank 6)**

## 4. Costi di intermediazione — Commissioni per coperto delle piattaforme di prenotazione, percepite come elevate e unilaterali.

- **Problema:** Commissioni per coperto delle piattaforme di prenotazione, percepite come elevate e unilaterali.
- **Evidenza:** TheFork piano base: €2–4 + IVA per coperto a cena (dato 2017); aumento del 12,6% nel 2023 contestato da Fipe. (S5, S6)
- **Mitigant:** Modello di prezzo prevedibile: canone fisso, zero commissione per coperto.
- **Feature in Mapetite:** Scelta di business model, non di codice: abbonamento mensile flat per le funzioni B2B (righe 1, 3, 7, 8), nessuna fee per coperto. Messaggio pitch: Mapetite è dalla parte del ristoratore.
- **Complessità:** Bassa · **Prerequisiti e vincoli:** Da fissare nel business plan con Roberto; coerenza con le proiezioni di ricavo.
- **Dipendenza da utenti Mapetite:** Alta – il ristoratore paga un canone solo se Mapetite porta clienti
- **Già presidiato da:** —
- **Fase:** Ora (decisione pitch) · Valore 4 · Vantaggio 4 · Fattibilità 5 · **Score 4.25 (rank 2)**

## 5. Costi di intermediazione — Commissioni delle piattaforme di delivery che azzerano il margine sugli ordini a domicilio.

- **Problema:** Commissioni delle piattaforme di delivery che azzerano il margine sugli ordini a domicilio.
- **Evidenza:** Commissioni 22–35% sull'ordine (Italia, 2020); 25–35% Deliveroo/Glovo (griglie Francia 2026). (S7, S8)
- **Mitigant:** Ordine diretto / ritiro al locale.
- **Feature in Mapetite:** NON entrare nel delivery (logistica, rider, capitale). Al massimo un link "Ordina direttamente dal locale" in scheda, se il locale lo fornisce.
- **Complessità:** Alta · **Prerequisiti e vincoli:** Logistica, rider, pagamenti, assistenza: fuori portata e fuori core.
- **Dipendenza da utenti Mapetite:** —
- **Già presidiato da:** Glovo, Deliveroo, Just Eat, Uber Eats
- **Fase:** Non fare · Valore 3 · Vantaggio 1 · Fattibilità 1 · **Score 1.8 (rank 13)**

## 6. Reputazione — Recensioni false e ricatti ("paga o ti affossiamo"), review bombing dopo licenziamenti o per concorrenza.

- **Problema:** Recensioni false e ricatti ("paga o ti affossiamo"), review bombing dopo licenziamenti o per concorrenza.
- **Evidenza:** Il 60% dei ristoratori dichiara danni da recensioni false; l'8,6% delle recensioni 2024 sulle principali piattaforme è risultato falso. Casi documentati di offerte da 100 recensioni per €400 con minacce. (S9, S10)
- **Mitigant:** Segnali verificati e lettura dei pattern ricorrenti, non dei singoli voti.
- **Feature in Mapetite:** (a) Il verdict AI sintetizza già pattern ricorrenti con vincolo anti-invenzione; (b) recensioni interne Mapetite solo da utenti con visita verificata (es. prenotazione via Mapetite); (c) badge "Recensioni verificate Mapetite" esportabile dal ristoratore.
- **Complessità:** Media · **Prerequisiti e vincoli:** Google Places restituisce al massimo 5 recensioni per locale: l'analisi anti-anomalie su dati Google non è possibile, solo su recensioni interne. Policy di moderazione.
- **Dipendenza da utenti Mapetite:** Alta per (b) e (c); (a) già operativo
- **Già presidiato da:** Google e TripAdvisor (con efficacia contestata dai ristoratori)
- **Fase:** Fase 3 · Valore 4 · Vantaggio 5 · Fattibilità 3 · **Score 4.1 (rank 3)**

## 7. Visibilità — Locali di qualità con poche recensioni penalizzati dagli algoritmi basati su volume e stelle.

- **Problema:** Locali di qualità con poche recensioni penalizzati dagli algoritmi basati su volume e stelle.
- **Evidenza:** n.d. – è la tesi di Mapetite; da validare con interviste e con dati d'uso. (—)
- **Mitigant:** Discovery basata sul match tra intento dell'utente e caratteristiche reali del locale.
- **Feature in Mapetite:** Già core (ricerca AI + verdict). Lato B2B: profilo rivendicato con informazioni curate dal locale (specialità, occasioni, atmosfera) che migliorano il matching. Nessun posizionamento a pagamento mescolato ai risultati organici: eventuale sponsorizzato solo etichettato e separato.
- **Complessità:** Media · **Prerequisiti e vincoli:** Verifica della titolarità del locale; regole editoriali scritte su organico vs sponsorizzato (credibilità verso utenti e investitori).
- **Dipendenza da utenti Mapetite:** Media – il profilo ha valore solo se l'app ha traffico
- **Già presidiato da:** Google Business Profile, TheFork, TripAdvisor
- **Fase:** Fase 2 · Valore 4 · Vantaggio 5 · Fattibilità 4 · **Score 4.35 (rank 1)**

## 8. Dati di mercato — Il ristoratore non sa cosa cercano i clienti nella sua zona né perché viene scelto o scartato.

- **Problema:** Il ristoratore non sa cosa cercano i clienti nella sua zona né perché viene scelto o scartato.
- **Evidenza:** n.d. – da validare con interviste. (—)
- **Mitigant:** Insight sulla domanda espressa (ricerche reali) e sulla propria performance.
- **Feature in Mapetite:** "Insight di domanda": dashboard aggregata dalle ricerche Mapetite – intenti più cercati in zona (es. "brunch vegano", "rooftop romantico"), quante volte il locale è apparso, aperto, salvato; domanda senza risposta in zona. Dato proprietario = argomento "data moat" per gli investitori.
- **Complessità:** Media · **Prerequisiti e vincoli:** Prerequisito: tabella search_logs (già in coda) – iniziare a registrare ORA. Solo dati aggregati e anonimi (GDPR, informativa).
- **Dipendenza da utenti Mapetite:** Molto alta – serve volume statistico per zona
- **Già presidiato da:** Da verificare
- **Fase:** Fase 3 (logging subito) · Valore 4 · Vantaggio 5 · Fattibilità 3 · **Score 4.1 (rank 3)**

## 9. Fidelizzazione — Clienti che non tornano; pochi locali hanno CRM o programmi fedeltà.

- **Problema:** Clienti che non tornano; pochi locali hanno CRM o programmi fedeltà.
- **Evidenza:** CRM attivo nel 41% dei ristoranti, loyalty nel 27%; ritorno entro 60 giorni 34% senza loyalty vs 48% con loyalty attiva. (S1)
- **Mitigant:** Canale leggero di contatto con chi ha già mostrato interesse.
- **Feature in Mapetite:** Chi ha salvato il locale diventa "follower": il ristoratore può inviare max 1 aggiornamento al mese (nuovo menu, evento) a chi ha dato consenso. Niente CRM completo.
- **Complessità:** Media · **Prerequisiti e vincoli:** Consenso marketing (GDPR), limiti anti-spam, gestione disiscrizione.
- **Dipendenza da utenti Mapetite:** Alta – il valore cresce con i salvataggi
- **Già presidiato da:** CRM di settore, gestionali di prenotazione
- **Fase:** Fase 3 · Valore 3 · Vantaggio 4 · Fattibilità 3 · **Score 3.35 (rank 8)**

## 10. Visibilità — Informazioni errate o non aggiornate (orari, chiusure straordinarie, menu) che fanno perdere clienti o generano recensioni negative.

- **Problema:** Informazioni errate o non aggiornate (orari, chiusure straordinarie, menu) che fanno perdere clienti o generano recensioni negative.
- **Evidenza:** n.d. – da validare con interviste. (—)
- **Mitigant:** Il locale corregge direttamente le proprie informazioni.
- **Feature in Mapetite:** Nel profilo rivendicato (riga 7): modifica di orari speciali, chiusure, menu (foto/PDF), con priorità sui dati Google in visualizzazione.
- **Complessità:** Bassa-Media · **Prerequisiti e vincoli:** Verifica titolarità; regola di precedenza dato locale vs Google.
- **Dipendenza da utenti Mapetite:** Bassa
- **Già presidiato da:** Google Business Profile
- **Fase:** Fase 2 · Valore 3 · Vantaggio 3 · Fattibilità 4 · **Score 3.25 (rank 10)**

## 11. Domanda — Fasce orarie deboli (pranzo, inizio settimana) con sala vuota e costi fissi invariati.

- **Problema:** Fasce orarie deboli (pranzo, inizio settimana) con sala vuota e costi fissi invariati.
- **Evidenza:** n.d. – da validare con interviste. (—)
- **Mitigant:** Proposte mirate sulle fasce deboli, mostrate solo a chi cerca qualcosa di coerente.
- **Feature in Mapetite:** "Occasioni": il ristoratore pubblica una proposta su una fascia (es. menu pranzo, degustazione del martedì); compare nei risultati solo se pertinente alla ricerca, senza logica da sconto aggressivo.
- **Complessità:** Media · **Prerequisiti e vincoli:** Regole di pertinenza nel ranking; evitare l'effetto "app di sconti" che svaluta il posizionamento.
- **Dipendenza da utenti Mapetite:** Alta
- **Già presidiato da:** TheFork (promozioni)
- **Fase:** Fase 3 · Valore 3 · Vantaggio 4 · Fattibilità 3 · **Score 3.35 (rank 8)**

## 12. Operatività — Carenza di personale qualificato.

- **Problema:** Carenza di personale qualificato.
- **Evidenza:** Un'impresa su due dichiara difficoltà nel reperire personale (Rapporto Ristorazione Fipe 2026). (S11)
- **Mitigant:** Ridurre il lavoro manuale non di servizio.
- **Feature in Mapetite:** NON fare un prodotto di recruiting/staffing. Beneficio indiretto: richieste di prenotazione strutturate (riga 3) riducono il tempo al telefono.
- **Complessità:** Alta · **Prerequisiti e vincoli:** Fuori core.
- **Dipendenza da utenti Mapetite:** —
- **Già presidiato da:** Piattaforme di recruiting e staffing dedicate
- **Fase:** Non fare · Valore 5 · Vantaggio 1 · Fattibilità 1 · **Score 2.6 (rank 11)**

## 13. Economics — Margini compressi da materie prime, energia, affitti e fisco.

- **Problema:** Margini compressi da materie prime, energia, affitti e fisco.
- **Evidenza:** Margini compressi da costi di materie prime, energia, affitti e pressione fiscale; 29.097 cessazioni contro 10.719 aperture nel 2024. (S12, S13)
- **Mitigant:** Software di food cost / acquisti.
- **Feature in Mapetite:** NON fare. Beneficio indiretto: più coperti su fasce deboli (riga 11) e meno no-show (riga 1).
- **Complessità:** Alta · **Prerequisiti e vincoli:** Fuori core.
- **Dipendenza da utenti Mapetite:** —
- **Già presidiato da:** Gestionali di magazzino e food cost
- **Fase:** Non fare · Valore 5 · Vantaggio 1 · Fattibilità 1 · **Score 2.6 (rank 11)**

## Fonti

- **S1** Osservatorio Incrementoo-Ristorazione 2025 (212.000 prenotazioni, 300 ristoranti, gen–ago 2025) – via Beverfood — https://www.beverfood.com/ristorazione-2025-prenotazioni-digitali-e-fidelizzazione/
- **S2** Incrementoo: 33,8% prenotazioni variate/cancellate/no-show – via BusinessOnline — https://www.businessonline.it/news/cosa-si-rischia-se-si-prenota-al-ristorante-e-non-ci-si-presenta_n83960.html
- **S3** Cooperto, analisi 500.000 prenotazioni gen–set 2025 – via Panorama — https://www.panorama.it/attualita/economia/prenotazioni-online-e-cancellazioni-lampo-otto-ristoranti-su-dieci-rischiano-di-perdere-la-meta-dei-clienti
- **S4** InTotheMinds, ricerca su 39 ristoranti stellati in 18 Paesi (pre-autorizzazione carta) — https://www.intotheminds.com/blog/it/carta-di-credito-deposito-ristorante/
- **S5** La Rassegna – condizioni TheFork per ristoratori (dato 2017, da aggiornare) — https://www.larassegna.it/scarica-pdf/prenotazioni-on-line-per-i-ristoratori-una-sfida-da-non-rimandare/
- **S6** CorCom – aumento commissioni TheFork +12,6% (gen 2023), posizione Fipe — https://www.corrierecomunicazioni.it/digital-economy/the-fork-le-commissioni-salgono-del-126-fipe-aumenti-ingiustificati/
- **S7** Gambero Rosso – costo del delivery per i ristoranti (Italia, 2020) — https://www.gamberorosso.it/notizie/quanto-costa-il-food-delivery-ai-ristoranti-conviene-davvero/
- **S8** Fooderise – commissioni piattaforme delivery (griglie Francia 2026) — https://www.fooderise.com/en/platforms
- **S9** Gambero Rosso – impatto recensioni false (sondaggio Epam, giu 2025) — https://www.gamberorosso.it/notizie/attualita/recensioni-negative-ristoranti-impatti-dati/
- **S10** Gambero Rosso – inchiesta racket recensioni — https://www.gamberorosso.it/ristoranti/recensioni-false/
- **S11** Milano Finanza – Rapporto Ristorazione Fipe 2026 (personale) — https://www.milanofinanza.it/news/ristorazione-nel-2025-i-consumi-aumentato-a-100-miliardi-ma-restano-sotto-il-livello-pre-covid-202604091301405893
- **S12** Gambero Rosso – Rapporto Fipe 2025 (imprese aperte/cessate 2024) — https://www.gamberorosso.it/notizie/attualita/ristorazione-rapporto-fipe-2025/
- **S13** BusinessOnline – Rapporto Fipe 2025 (margini e costi) — https://www.businessonline.it/news/come-va-ristorazione-italia-dati-statistiche-fatturazione-utili_n77121.html
