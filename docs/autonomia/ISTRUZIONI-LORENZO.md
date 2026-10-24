# Le cose da fare, passo passo (22/10/2026)

In ordine di importanza. Accanto a ognuna: quanto ci vuole e come capisci che è fatta. Le voci restano anche in `DA-FARE-LORENZO.md`.

---

## 1. Accesso con Google in un tocco (15 minuti, dal computer)
Il pulsante "Continua con Google" è già nell'app: compare da solo appena accendi Google su Supabase. Oggi (22/10 mattina) è ancora spento.

**A. Schermata di consenso (solo la prima volta)**
1. Apri https://console.cloud.google.com/auth/overview e controlla in alto che il progetto sia quello di Mapetite (lo stesso delle Places API).
2. Se chiede di configurare: "Inizia". Nome app: **Mapetite**. Email di assistenza: la tua. Pubblico: **Esterno**. Contatto: la tua email. Accetta e "Crea".
3. Vai su "Pubblico" (Audience) e premi **"Pubblica app"** (In produzione). Se resta "In test", solo gli utenti di prova che aggiungi a mano possono entrare.

**B. Credenziali**
1. Apri https://console.cloud.google.com/apis/credentials → **"+ Crea credenziali" → "ID client OAuth"**.
2. Tipo di applicazione: **Applicazione web**. Nome: `Mapetite Supabase`.
3. **Origini JavaScript autorizzate** → "Aggiungi URI": `https://mapetite-web.vercel.app`
4. **URI di reindirizzamento autorizzati** → "Aggiungi URI", copia esattamente:
   `https://ypcghfffzcffyhfvungc.supabase.co/auth/v1/callback`
5. "Crea". Copia **ID client** e **Client secret** (li vedi in una finestra; puoi anche scaricare il JSON).

**C. Supabase**
1. Apri https://supabase.com/dashboard/project/ypcghfffzcffyhfvungc/auth/providers
2. Tocca **Google** → accendi "Enable Sign in with Google".
3. Incolla **Client ID** e **Client Secret**. Lascia il resto com'è. **Save**.

**Come sai che è fatto:** apri https://mapetite-web.vercel.app/login dal telefono: c'è "Continua con Google", lo tocchi ed entri. La sessione notturna lo controlla anche da sola.

---

## 2. Quota Google: dimmi il numero (2 minuti)
1. Apri https://console.cloud.google.com/apis/api/places.googleapis.com/quotas (stesso progetto).
2. Nel filtro scrivi **"per day"** (al giorno).
3. Guarda le righe di **Text Search** (SearchTextRequest) e **Place Details**: scrivimi il numero nella colonna "Valore" (50 o 100).
- Se è 100, fino al 26/10 le sessioni possono usare fino a 30 ricerche al giorno; se è 50, restano 10. **Non toccare niente**: serve solo il numero. Dal 27/10 si torna a 50.

---

## 3. Prova su un telefono vero (10 minuti)
1. Dal telefono apri https://mapetite-web.vercel.app → Condividi → **"Aggiungi alla schermata Home"** (iPhone, Safari) oppure menu ⋮ → **"Installa app"** (Android, Chrome).
2. Apri l'app dall'icona e fai il giro:
   - **Salva da un reel:** su Instagram o TikTok → Condividi → copia link → in Mapetite "Salva" → incolla. Su Instagram, se non lo legge, usa lo screenshot.
   - **TikTok in particolare:** prova un link TikTok di un locale. Nei log non c'è ancora nessuna lettura dopo l'ultimo rilascio: mi serve la tua prova per capire se funziona.
   - **Cerca:** "ristorante romantico con terrazza".
   - **Apri la scheda** di un risultato, poi **"Ci sono stato"**.
   - Chiudi l'app, riaprila e controlla nei **Salvati** che ci sia.
3. Scrivimi cosa non va (anche una riga, anche in un commento alla PR #93: https://github.com/mapetite-app/mapetite-web/pull/93).

---

## 4. Unire le attività programmate in una sola (5 minuti) — vedi `PROMPT-UNICO.md`
Oggi ce ne sono due (feriali e fine settimana) e possono partire insieme sulla stessa cosa.
1. Apri https://claude.ai/code e vai nella sezione delle attività programmate (Routines / Scheduled).
2. Apri l'attività del **fine settimana** → **mettila in pausa o cancellala**.
3. Apri l'attività dei **giorni feriali** → sostituisci il testo con quello di `docs/autonomia/PROMPT-UNICO.md` (dalla riga "Sei lo sviluppatore autonomo" in giù).
4. Orario dell'unica attività, tutti i giorni: **22:05 e 03:05**, più **10:05, 14:05 e 18:05**. In alternativa scegli "ogni giorno" alle 5 ore indicate; se l'interfaccia accetta un'espressione cron: `5 3,10,14,18,22 * * *`.
   Di giorno, nei giorni feriali, l'attività parte, vede che è giorno feriale e si chiude subito senza fare niente (pochi secondi, non tocca i tuoi limiti). Sabato, domenica e festivi lavora.

---

## 5. Facoltativo: reel di Instagram letti dal link (20 minuti)
Senza questa chiave Instagram funziona già con lo screenshot.
1. Apri https://developers.facebook.com/apps/ → **"Crea app"** → caso d'uso "Altro" → tipo "Business" → nome `Mapetite`.
2. Nella dashboard dell'app cerca il prodotto **"oEmbed"** e aggiungilo.
3. Vai su **Impostazioni app → Avanzate** e copia il **Client token**; in **Impostazioni app → Di base** copia l'**ID app**.
4. Mettili su Vercel: https://vercel.com/lorenzomapetite/mapetite-web/settings/environment-variables → "Add" → nome `META_OEMBED_TOKEN`, valore `IDAPP|CLIENTTOKEN` (con la barra verticale in mezzo), ambienti Production e Preview → Save.
- Attenzione: Meta può chiedere di mettere l'app "in produzione" o una revisione per usare oEmbed. Se te lo chiede, fermati e dimmelo: non è indispensabile.
- Il codice per usarla lo aggiunge il team appena la chiave c'è.

---

## 6. Facoltativo: voti veri di Tripadvisor nella scheda (10 minuti)
1. Apri https://www.tripadvisor.com/developers → registrati con la tua email e chiedi la chiave della **Content API** (gratuita fino a una soglia; inserisci una carta solo se sei d'accordo, il tetto lo decidi tu).
2. Su Vercel (stesso link del punto 5) aggiungi `TRIPADVISOR_API_KEY` con la chiave, ambienti Production e Preview.
- Senza, nella scheda resta solo il link di ricerca su Tripadvisor.

---

## 7. Decisioni da prendere (una parola ciascuna basta: sì / no / dopo)
- **Avvisi push gratuiti** tipo "si è liberato un tavolo" (proposta 6).
- **Omaggio del locale a chi torna** (proposta 12).
- **Serata di pre-apertura** con utenti scelti per gusto (proposta 9).
- **"Cliente di parola":** prenotazioni salvate sul server e mostrate al locale, con il consenso dell'utente (proposta 3).
Dettagli in `docs/autonomia/PROPOSTE.md`.
