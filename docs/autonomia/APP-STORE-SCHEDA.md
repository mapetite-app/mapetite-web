# Scheda App Store di Mapetite — testi pronti da incollare (23/11/2026)

Si usa dopo il punto 2 di `APP-IPHONE.md` (app creata in App Store Connect). Tutto in italiano; i limiti di caratteri sono quelli di Apple e sono già rispettati. Dove serve una tua decisione c'è scritto **TU**.

Dove si incolla: https://appstoreconnect.apple.com/apps → Mapetite → **Distribuzione** (versione 1.0) e **Informazioni app**.

## Informazioni app
| Campo | Valore |
|---|---|
| Nome (max 30) | `Mapetite` |
| Sottotitolo (max 30) | `I locali dei reel, sulla mappa` (30) |
| Categoria principale | **Cibi e bevande** |
| Categoria secondaria | **Viaggi** |
| URL norme sulla privacy | `https://mapetite-web.vercel.app/privacy` |
| URL di assistenza | `https://mapetite-web.vercel.app/aiuto` (pagina nuova del 23/11, aperta senza account) |
| URL di marketing (facoltativo) | `https://mapetite-web.vercel.app` |
| Copyright | `2026 ` + **TU**: il tuo nome e cognome (persona fisica) |

## Versione 1.0
**Testo promozionale (max 170, si cambia senza nuova revisione):**
> Visto un posto in un reel? Condividilo a Mapetite: lo trovi sulla mappa con il verdetto delle recensioni, e lo ritrovi quando devi scegliere dove andare.

**Descrizione (max 4000):**
> Un reel su Instagram, un video su TikTok, un amico che dice "devi andarci". Ogni giorno scopri locali che poi perdi tra screenshot, post salvati e note.
>
> Mapetite li tiene tutti sulla tua mappa, e te li fa ritrovare quando serve.
>
> SALVA IN UN GESTO
> • Da Instagram e TikTok: tocca Condividi → Mapetite. Ti mostriamo il locale e chiediamo "È questo?" prima di salvarlo.
> • Da Google Maps: porta le tue liste in un colpo solo.
> • Dai salvati di Instagram: carica il file del tuo account e ritrova i locali che avevi messo da parte.
>
> RITROVA NEL MOMENTO GIUSTO
> • Tutti i tuoi posti sulla mappa, divisi tra da provare e già visitati.
> • Raccolte tue: romantici, aperitivo, viaggi, quello che vuoi.
> • Cerca come parli: "trattoria non turistica a Trastevere", "terrazza per un aperitivo".
>
> UN VERDETTO, NON UNA LISTA
> • Per ogni locale un giudizio in due righe, scritto leggendo le recensioni vere. Se le recensioni non dicono una cosa, non la diciamo.
> • Ti facciamo scoprire i posti di quartiere giusti per te, non solo i più famosi.
>
> PIÙ LO USI, PIÙ TI CONOSCE
> • Dai tuoi salvati e dalle tue visite Mapetite capisce cosa ti piace e ti propone posti simili.
>
> CON GLI AMICI
> • Manda tre posti al gruppo e decidete con un voto, anche chi non ha l'app.
>
> Solo cibo e bevande. Gratis, senza limite di posti.

**Parole chiave (max 100, separate da virgola, senza spazi):**
`ristoranti,reel,instagram,tiktok,mappa,salvati,trattoria,cena,aperitivo,locali,roma,milano,food` (95)

**Novità di questa versione:** `Prima versione per iPhone.`

**Screenshot iPhone 6,9" (1320×2868, da 3 a 10):** li prepara il team in `docs/autonomia/app-store/` quando la build è su TestFlight (servono dall'app vera, con dati veri; non foto del sito con l'account di prova).

## Valutazione dell'età (questionario)
- Contenuti generati dagli utenti: **Sì** (recensioni e foto dei membri; si possono segnalare e nascondere con "⋯", proposta 82).
- Tutto il resto (violenza, alcol come tema principale, gioco d'azzardo, ecc.): **No / Nessuno**. Alcol: i locali includono bar e cocktail bar, ma l'app non promuove il consumo → "Rari/lievi riferimenti" a **TU** se vuoi essere prudente.
- Età minima di registrazione: dipende da DA-FARE 11 (**TU**).

## Privacy dell'app ("etichetta nutrizionale")
"Raccogliete dati da questa app?" → **Sì**. Nessun dato è usato per il **tracciamento** (niente pubblicità, niente broker di dati).

| Tipo di dato | Collegato all'utente | Uso |
|---|---|---|
| Informazioni di contatto → Indirizzo email | Sì | Funzionalità dell'app |
| Informazioni di contatto → Nome (solo con Google/Apple) | Sì | Funzionalità dell'app |
| Contenuti dell'utente → Foto | Sì | Funzionalità dell'app |
| Contenuti dell'utente → Altri contenuti (recensioni, note, raccolte) | Sì | Funzionalità dell'app |
| Posizione → Posizione approssimativa | Sì | Funzionalità dell'app, Analisi |
| Cronologia delle ricerche | Sì | Funzionalità dell'app, Personalizzazione, Analisi |
| Identificativi → ID utente | Sì | Funzionalità dell'app |
| Dati di utilizzo → Interazione con il prodotto | Sì | Analisi, Personalizzazione |

Note: la posizione si usa solo con il permesso e solo mentre l'app è aperta; con le ricerche si registra il punto arrotondato a circa 1 km (`src/lib/events.ts`). Contatti della rubrica: **non** raccolti (la funzione "Trova amici dalla rubrica" è solo Android e manda impronte, non contatti).

## Informazioni per la revisione di Apple
- **Accesso:** serve un account di prova. **TU**: crea un account solo per Apple (es. `revisione.apple@…`) con password, oppure usa l'account Sofia della demo (DA-FARE 9), e scrivi email e password nei campi "Nome utente" e "Password".
- **Contatto:** il tuo nome, telefono ed email (**TU**).
- **Note (incollare così):**
> Mapetite salva i locali visti nei reel. Per provare la funzione principale: apri un reel di un ristorante su Instagram o un video su TikTok → Condividi → Mapetite (se non compare, "Altro" in fondo alla fila delle app). L'app apre "Salva dal reel" con il link già dentro e chiede conferma del locale prima di salvarlo.
> Accesso: email e password dell'account di prova qui sopra; sono disponibili anche "Continua con Google" e "Continua con Apple" (si aprono nel foglio di sistema, non dentro l'app).
> Contenuti degli utenti: le recensioni e le foto degli altri membri hanno "⋯" per segnalarle o per non vedere più i contenuti di quella persona; le segnalazioni arrivano a noi e le decidiamo entro 24 ore. L'account si elimina da Profilo → Impostazioni → "Elimina il mio account".
> I dati dei locali (nomi, indirizzi, orari, recensioni) vengono da Google Places; i verdetti sono scritti da un modello AI solo a partire da quelle recensioni.

## Cosa resta da fare prima dell'invio
1. Account di prova per Apple (**TU**, 2 minuti).
2. Età minima (DA-FARE 11, **TU**).
3. Screenshot dall'app vera su TestFlight (team).
4. "Continua con Apple" acceso su Supabase (`APP-IPHONE.md`, punto 6): Apple lo chiede quando c'è l'accesso con Google (regola 4.8).
5. Impegno delle 24 ore sulle segnalazioni: le vedi in `/admin/numeri`, sezione "Contenuti segnalati", con "Togli per tutti" e "Lascia".
