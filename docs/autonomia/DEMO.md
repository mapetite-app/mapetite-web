# Demo di Mapetite in 5 minuti (telefono in mano, per investitori)

## Copione di 3 minuti (7/11, corretto dopo la prova dal vivo dell'8/11) — quello da usare dal vivo
Aggiornato con le funzioni dal 1/11 al 7/11. I testi tra virgolette sono quelli dei tasti, **provati in produzione l'8/11** (sezione "Prova dal vivo 8/11" qui sotto). Il passo del TikTok è provato con un link di Google Maps: con un TikTok vero resta da provare.
**Prima (2 minuti):** in `/admin/numeri` "AI: ok", "Google oggi" sotto 40 e foto non sospese; posizione già permessa; negli appunti il link di un TikTok di un ristorante (o di Google Maps); account nuovo per il primo accesso; **account demo Sofia creato prima** (`DEMO_PASSWORD=… node scripts/demo/crea-account-demo.mjs`: l'8/11 in produzione non esisteva).

1. **0:00 — Primo accesso (40 s).** Account nuovo: "Roma" → "Continua" → "Cosa ti piace?": tocca Trattoria, Pizzeria, poi apri **"🥂 Bere"** e tocca Cocktail bar → "Continua" → "Le chicche" → **"Continua"** → diete: **"Mangio di tutto"** → occasioni: "Salta" → spesa "€€ Nella media" → "Continua" → **"Ecco cosa ho capito di te"**. Tocca "spendi il giusto", scegli un'altra fascia, **"Torna alla frase"**: la frase cambia. Dì: "Sette domande, trenta secondi. Nessun questionario." Tocca **"Apri la mia mappa"**.
2. **0:40 — I posti per te (30 s).** La mappa si apre già con una ricerca sui tuoi gusti ("Trattoria fuori dai giri turistici a Roma"): card in 6–8 s, il verdetto (riga con ✦) e "Per te: …" arrivano dopo **10–20 s**: parla intanto. Dì: "Non i più famosi: quelli giusti per te. E il verdetto non lo inventa: viene dalle recensioni vere." (Sulla card la scritta "Il verdetto Mapetite" non c'è: c'è nella scheda.)
3. **1:10 — Ricerca che rispetta i vincoli (40 s).** Barra in alto: "trattoria autentica non turistica a Trastevere". Sopra le card c'è "Dodici posti a Trastevere · Senza i locali più famosi"; tocca la pillola **"12 posti"** per la riga **"Ho messo da parte N locali molto famosi (Nannarella, …)"**: "Google qui metterebbe primi i posti con diecimila recensioni. Noi li mettiamo da parte, e lo diciamo." Tocca di nuovo la pillola per chiuderla. (Il secondo esempio "cena romantica massimo 50 euro" non è stato provato l'8/11.)
4. **1:50 — La scheda (25 s).** Tocca una card: verdetto in alto, "Per te", frasi dalle recensioni. In alto **"‹ 1 di N ›"**: tocca **›** e passi al posto dopo senza tornare alla lista; scorrendo resta la testata con nome e frecce. Tocca **"Salva"** in basso a destra → si apre "Salva locale" → tocca di nuovo **"Salva"**. (Non toccare "Prenota": è il tasto corallo grande, ma la conferma la dà il locale.)
5. **2:15 — Raccogli in un gesto (25 s).** Salvati → **+** (in alto a destra, "Aggiungi un posto") → **"Incolla un link"** (legge gli appunti): in 2 s "✅ Salvato in Mapetite: <nome>" con "Apri sulla mappa". Dì: "Il reel non si perde più. E tutti i salvati di Google Maps entrano insieme con 'Tutti i salvati di Google Maps'." (Oggi la conferma non mostra la foto.)
6. **2:40 — Ritrova (20 s).** Account Sofia, **Salvati**: città in alto (solo con posti in due città), cerca "romantico", in alto a destra il menu dell'ordine → **"Da più tempo"** ("i posti che aspettano da mesi"). Poi scrivi una domanda, es. **"dove porto una ragazza stasera?"** (con una parola sola il tasto non compare) → **"Chiedi ai tuoi posti"**: 3 posti in circa 3 s. Chiudi: "Raccogli, ritrova, scegli. Tutto in un'app."

**Se qualcosa va storto:** quota Google finita → cerca tra i salvati; AI ferma → i risultati Google restano, i posti già visti hanno il verdetto. Mai indirizzi con `?beta=` ("Ti porterei qui" è ancora in prova). Non ricaricare la pagina della mappa dopo una ricerca: la ricerca si perde e rifarla costa una ricerca Google.

## Prova dal vivo 8/11 (voce 7b)
Collaudatore separato, domenica 8/11 tra le 03:00 e le 03:30 (ora di Roma), produzione `mapetite-web.vercel.app`, telefono simulato 390×844, italiano, posizione Roma centro. Account nuovo `claude-demo-0811@example.com` (creato e poi cancellato) per i passi 1–5; per il passo 6 l'account di prova `claude-e2e@example.com` (5 salvati), perché **Sofia non esiste in produzione**. Ricerche Google vere: **4** (primo accesso, Trastevere due volte perché ricaricando la mappa la ricerca si perde, un link). Screenshot: `screenshots/2026-11-08/` (file `p1-…` fino a `p6-…`). Tempi misurati con l'automazione: a mano i tocchi aggiungono qualche secondo.

| Passo | Esito | Tempo reale | Cosa è diverso dal copione del 7/11 |
|---|---|---|---|
| 1 Primo accesso | **Funziona**, tasti diversi | ~7 s di tocchi automatici (a mano 35–40 s) | "Cocktail bar" sta dentro il gruppo "🥂 Bere"; "Le chicche" non va avanti da sola, serve "Continua"; nelle diete il tasto è "Mangio di tutto", non "Salta"; spesa: "€€ Nella media" poi "Continua". Il passo "Ci andresti?" non compare. Correzione della parola e "Torna alla frase": ok. `p1-01…p1-07c` |
| 2 Posti per te | **Funziona, lento** | mappa 2,5 s; card ~6–8 s; primo verdetto ~14 s; tutti ~21 s | La ricerca è solo "Trattoria fuori dai giri turistici a Roma" (né pizzerie né cocktail bar, anche se scelti); posti sparsi su tutta Roma (fino a 3,7 km). Sulla card non c'è la scritta "Il verdetto Mapetite", c'è la riga ✦. Metà delle foto risponde "Foto sospese per oggi" (429). `p2-mappa-*` |
| 3 Ricerca con vincoli | **Funziona**, un tocco in più | card 3,4–4 s; verdetti 5–14 s | "Ho messo da parte 5 locali molto famosi (Nannarella, Trattoria Da Enzo…)" si vede solo toccando la pillola "12 posti". In vista c'è "Senza i locali più famosi". Il secondo posto della fila cambia mentre arrivano i verdetti. `p3-*`, `p3b-*` |
| 4 Scheda | **Funziona**, testo del tasto diverso | apertura ~1 s | "‹ 1 di 12 ›" e "›" ok (2 di 12). "Salva" apre la finestra "Salva locale" (tag e nota): serve un secondo "Salva". Nessuna foto in cima alla scheda (emoji). Testata fissa scorrendo: vista sulla scheda da Salvati (`08c`). `p4-*` |
| 5 Raccogli | **Funziona** con un link di Google Maps; TikTok non provato | ~2 s | Il "+" porta a "Aggiungi un posto" → "Incolla un link". Conferma: "✅ Salvato in Mapetite: Trattoria da Augusto", **senza foto**. "Porta le tue liste" non esiste: si chiama "Tutti i salvati di Google Maps". Con zero salvati il "+" non c'è (al suo posto "📍 Da Google Maps"). `p5-*` |
| 6 Ritrova | **Non eseguibile come scritto** (manca Sofia); con l'account di prova funziona | risposta in 3,1 s | "romantico" trova Hostaria Del Moro dalla nota; "Da più tempo" è nel menu in alto a destra; "Chiedi ai tuoi posti" compare solo con una domanda (3+ parole o "?"), non con "romantico". `p6-*` |

**Da sistemare nel codice (in ordine di gravità):**
1. **Account Sofia assente in produzione**: senza, il passo 6 non si fa. Lanciare `scripts/demo/crea-account-demo.mjs` prima della demo (serve la password scelta da Lorenzo).
2. **Foto**: scheda e conferma del link senza foto; durante il primo accesso 6 richieste foto su 12 hanno risposto 429 "Foto sospese per oggi". Controllare il tetto in `/api/places/photo` e la quota prima della demo.
3. **Primo accesso → prima ricerca**: verdetti a 14–21 s e solo trattorie; per la demo è lungo da riempire a voce.
4. **"Ho messo da parte"** nascosto dietro la pillola: è la frase che vende il differenziatore, dovrebbe stare in vista (o il copione lo dice, come ora).
5. **Salva dalla scheda in due tocchi** con una finestra vecchio stile (Poppins, chip salmone): contro "in un gesto".
6. **Ricerca persa ricaricando `/mappa`** (D25 del 1/11, ancora aperto): ogni ricarica costa una ricerca Google.
7. Minori: banner "📲 Aggiungi Mapetite alla Home" sopra le card di caricamento; dopo il primo accesso la home mostra anche l'intro "Non perdere più i posti"; l'account di prova con 5 salvati finisce di nuovo su `/onboarding` dopo l'accesso (D2); la barra in basso compare su `/login` (D1).

## Copione di 3 minuti (sprint, 26/10) — superato dal 7/11, tenuto come storia
Le 4 chiavi di volta in fila: primo accesso, salva dal reel, ricerca con l'AI, scheda. Il copione lungo (5 minuti, 18/10) resta sotto per le domande.
**Prima (2 minuti):** credito Anthropic attivo (in `/admin/numeri` deve esserci "AI: ok"; senza, la ricerca funziona ma i verdetti dei posti nuovi non arrivano); link di un TikTok di un ristorante negli appunti; posizione già permessa.

1. **0:00 — "Ecco cosa ho capito di te" (40 s).** Account nuovo → il primo accesso: Roma e una zona, 4–5 card 👍/👎 dei tipi di posto, "Chicche", poi "Continua" fino alla frase. Tocca una parola sottolineata per mostrare che si corregge. Dì: "In 30 secondi l'app sa cosa ti piace. Nessun questionario."
2. **0:40 — "Mostrami i posti per me" (30 s).** Parte la prima ricerca già fatta sui tuoi gusti: card con **"Il verdetto Mapetite"** e "Per te". Dì: "Non i più famosi: quelli giusti per te."
3. **1:10 — Salva dal reel (40 s).** Salvati → **+** → **"Incolla un link"** → incolla il TikTok. Compare il locale riconosciuto con la foto: "✓ Salvato". Tocca **"Quando ci vai?" → Nel weekend**. Dì: "Un gesto. Il reel non si perde più."
4. **1:50 — Ricerca con l'AI (40 s).** Mappa → barra in alto: "trattoria autentica non turistica a Trastevere". Mostra la pillola con cosa ha capito e i ✓ dei requisiti; apri **"Ho messo da parte"**: "Google qui metterebbe primi i posti con diecimila recensioni. Noi li mettiamo in fondo, e diciamo perché."
5. **2:30 — Scheda e "Ci sono stato" (30 s).** Tocca una card: scheda a tutto schermo con foto, verdetto in alto, "Orari, contatti, recensioni". Tocca **"✓ Ci sono stato"**. Torna in Salvati: il posto è lì. Chiudi: "Raccogli, ritrova, scegli. Tutto in un'app."

**Se qualcosa va storto:** senza rete o con la quota Google finita, cerca tra i salvati (Salvati → cerca); senza AI i posti già visti hanno comunque il verdetto, i nuovi mostrano una frase vera di una recensione.

Aggiornata il 18/10 (prima il 16/10, voce 9.2). Ogni passo è controllato nel codice: i testi tra virgolette sono quelli dei pulsanti dell'app.
Il filo del discorso è la visione: **raccogli, organizza, ritrova, scegli**, e il differenziatore: **posti non mainstream, adatti ai gusti di chi cerca**.

## Prima della demo (una volta, 10 minuti)
1. **Account demo pronto.** Dal computer, nella cartella del progetto:
   `DEMO_PASSWORD='scegli-una-password' node scripts/demo/crea-account-demo.mjs`
   (prima, se vuoi vedere cosa fa: aggiungi `--dry-run`). Crea:
   - **Sofia** (`demo@mapetite.app`, profilo pubblico `@sofia.mangia`): 25 salvati veri, 23 a Roma e 2 a Milano; 9 "✓ Ci sono stato" con data, 16 "📌 Voglio andarci"; raccolte "Romantico", "Con amici", "Aperitivi", "Pranzi veloci", "Speciale", "Economico", "Viaggio a Milano"; note personali; classifica; 2 recensioni; gusti ricordati "niente posti turistici" e "niente posti rumorosi".
   - **Marco** (`@marco.mangia`), l'amico: pubblico, 6 salvati in comune con Sofia. Sofia e Marco si seguono.
   - Rilanciarlo dopo una demo rimette tutto a posto; con `--reset` toglie anche i salvati aggiunti durante la demo.
   - Usa solo locali già nel nostro database: nessuna chiamata a Google.
2. App installata sulla Home (Safari → Condividi → "Aggiungi alla schermata Home"; Android: "Installa"). Entra con l'account demo.
3. In appunti o in una nota: il link di un **video TikTok di un ristorante** (nome del locale nella descrizione) e due link di Google Maps.
4. Posizione attiva **e già permessa a Mapetite** (apri la mappa una volta e tocca il pulsante della posizione). Così all'apertura la mappa parte da dove sei. Salva come "📌 Voglio andarci" un posto a 2–3 minuti a piedi dal luogo della demo: aprendo la mappa compare da solo "📌 A 200 m c'è …, che volevi provare". Rete buona. Una ricerca di prova 10 minuti prima: se compare "Il verdetto Mapetite", l'AI è attiva.
5. Le prenotazioni non si preparano prima (restano nel telefono): la prima si fa dal vivo al minuto 1:40.

## Il copione (5 minuti)

**0:00 — Il problema (a voce, 20 secondi).**
"Vedi un posto su Instagram, lo salvi. Sabato non lo ritrovi più. Mapetite tiene i posti che scopri e te li ripropone quando devi scegliere. E ti porta dove piace a te, non dove vanno tutti."

**0:15 — Ritrovalo nel momento giusto.** Apri la mappa (pulsante al centro della barra in basso): parte da dove sei e, se il posto salvato prima è vicino, compare "📌 A 200 m c'è …, che volevi provare" con **"Apri"**.
- Dì: "Non devo cercarlo io: me lo ricorda lei quando ci passo davanti."

**0:30 — Chiedi all'assistente.** Barra in basso → **Assistente**. Scrivi (o detta con 🎤): "trattoria non turistica a Testaccio" (c'è già tra gli esempi).
- Dì: "Non è un motore di ricerca: è una conversazione. Capisce cosa chiedi e lo rispetta tutto."
- Mostra la riga "Ho capito: …" e le card con **"Il verdetto Mapetite"**: "Una frase onesta, scritta dalle recensioni vere. Mai inventata."
- Se compare "Ho messo in fondo i posti più turistici.": "Google li metterebbe primi. Noi no: è il punto su cui ci giochiamo tutto."
- Tocca **"💎 Meno conosciuti"** sotto le risposte: "Più lo chiedi, più scava fuori dal giro dei soliti posti."
- Sofia ha detto "niente posti turistici" una volta: l'assistente se lo ricorda e lo usa da solo.

**1:00 — La serata a tappe.** Sempre nell'assistente: "organizzami sabato sera: aperitivo, cena, dopocena a Trastevere".
- Arrivano tre tappe in ordine, ognuna vicina alla precedente, con i minuti a piedi e la mappa.
- Dì: "Non un elenco da scorrere: un piano. Per ogni tappa c'è un'alternativa."

**1:40 — Prenotazione assistita.** Tocca l'esempio "Prenotami domani alle 21 per 2 con terrazza a Roma".
- Sulla card che ti piace: **"Prenota"**. Il messaggio per il locale è già scritto (giorno, ora, persone, "in terrazza").
- Tocca **"Invia su WhatsApp"** (o **"Chiama"**): "Un tocco e la richiesta parte. Domani l'app chiede com'è andata."
- Onestà: "La conferma la dà il locale. La prenotazione automatica arriva con i ristoratori partner."

**2:10 — Raccogli in un gesto.** Profilo → tessera **"Importa"**.
- Incolla il link del video TikTok → **"✨ Trova il locale dal video"**: legge la descrizione e propone il locale. Un tocco ed è salvato.
- Oppure **"Incolla più link"**: incolla la nota con i due link di Maps → **"Trova i locali"**: "Tutto quello che hai accumulato negli anni entra in un colpo."
- Finisce in "📌 Voglio andarci", senza moduli.

**2:40 — Organizza e ritrova.** Barra in basso → **Salvati**: la mappa di Sofia, pin corallo "Ci sono stato", teal "Voglio andarci".
- Torna su **Profilo** → "Le tue raccolte": cartelle "Romantico", "Aperitivi", "Viaggio a Milano"… Tocca "Romantico".
- Dì: "Per occasione, non per categoria di Google: è così che ragionano le persone."

**3:05 — Scegli: "Stasera dove andiamo?".** Barra in basso → **Salvati** → **"Stasera"** (accanto a "Cerca in … salvati") → "Che occasione?" Romantico → **"📌 Mai provati"** → **"Proponimi 3 posti"**.
- Tre posti di Sofia, con la sua nota ("Aperitivo al tramonto con Luca") e il verdetto. Tocca il nome per aprirlo sulla mappa, **"Percorso"** per andarci. "Dai tuoi salvati, in dieci secondi."

**3:25 — Diario e classifica.** Profilo → tessera **"Diario"**: i posti dove è stata, con data e voto 👍/👎. Indietro → tessera **"Classifica"** (Roma · Milano): "Non stelle: un ordine personale. 'Ti è piaciuto più di X?' e il posto trova il suo posto."
- Dì: "Questi gesti sono i segnali con cui Mapetite impara i tuoi gusti. Niente voti da dare: basta usarla."

**3:45 — Gli amici.** Barra in basso → **Amici**: "I posti di chi ha gusti come i tuoi, non quelli di tutti." Le card dell'attività di Marco hanno il verdetto Mapetite. Tocca Marco: profilo pubblico con "Da provare" e "Già provati", anche qui con il verdetto.
- Apri un locale in comune (es. Trattoria Della Stampa): nella scheda "1 amico ci è stato".
- Dì: "Il passaparola, che oggi passa da WhatsApp, passa da qui." Profilo → ⚙️ in alto → "Profilo pubblico" → **"Condividi profilo"**: il link si apre anche senza app.

**4:10 — Sorprendimi.** Torna su **Esplora** (home) → **"🎲 Sorprendimi"**: un posto mai provato, "💎 Poco conosciuto" se lo è, con **"Perché te lo propongo"**.
- Dì: "Questo è il differenziatore in un tocco: un posto nuovo per te, scelto dai tuoi gusti, non dalla classifica di TripAdvisor."

**4:30 — I ristoratori (il modello di business).** Apri `mapetite-web.vercel.app/per-i-ristoratori` (nell'app non c'è ancora un pulsante: scrivilo nel browser, o tieni la scheda aperta) → **"Guarda un pannello d'esempio"**.
- Il pannello: persone che hanno visto la scheda, "Cosa chiedevano", "Quando cercano", confronto con la media della zona.
- Nella Panoramica, il riquadro scuro: "31 ti vogliono provare" e "👍 10 su 11" (visite vere: persone che l'avevano salvato e ci sono andate). Dì: "Non sono recensioni anonime: dietro ogni numero c'è una persona che l'aveva salvato."
- Scheda **Promozione → Serate tranquille**: tocca un giorno, "Salva". Dì: "Il martedì è vuoto? Lo dice qui, e chi l'ha salvato vede 'Martedì c'è posto' nella scheda. Niente sconti, niente commissioni sul coperto."
- Dì: "I ristoratori non pagano per esserci. Pagano per domanda qualificata: persone che stanno già scegliendo. E per sapere cosa cerca la gente nella loro zona: un dato che nessun altro ha, perché nessun altro è verticale sul food."

**4:50 — Chiusura (a voce).** "Instagram ti fa scoprire, Google Maps ti fa arrivare. Mapetite è il pezzo in mezzo: non perdi il posto, lo ritrovi quando serve, e scopri quelli giusti per te. Partiamo da Roma e Milano."

## Se qualcosa va storto
- Verdetto che tarda: "Preparo il verdetto" sulla card. Parla 3–4 secondi, arriva. Se non arriva, l'AI è ferma: i risultati Google restano, passa al punto successivo.
- Serata: se una tappa dice "Per una tappa non ho trovato posti", cambia zona (es. "Monti").
- "Le ricerche nuove sono finite per ora: ripartono alle 9:00": è finita la quota Google del giorno (controlla prima su `/admin/numeri`, riga "Google oggi"). Tocca **"Cerca nei tuoi salvati"** e continua da Salvati, Stasera, Diario, Amici.
- "Riprova tra qualche minuto": limite anti-abuso (oltre ~30 ricerche AI in un'ora). Salta ai punti senza AI: Salvati, Stasera, Diario, Amici, Ristoratori.

## Cose da evitare
- Ricerche fuori Roma/Milano: la densità iniziale è lì.
- Indirizzi con `?beta=…`: le funzioni in prova non sono rifinite.
- Promettere la prenotazione automatica o numeri veri del pannello: oggi sono dimostrativi, va detto.
