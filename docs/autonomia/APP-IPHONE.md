# App iPhone di Mapetite — passi per Lorenzo (23/11/2026)

Il pacchetto è pronto nel progetto (`ios/`, PR della notte del 23/11). Tu fai l'iscrizione ad Apple e metti 4 chiavi su GitHub; poi un tasto su GitHub costruisce l'app e la manda su TestFlight. **Non serve un Mac.**

## Cosa c'è già nel pacchetto
- L'app apre la stessa Mapetite del sito (ogni cosa che mettiamo in produzione arriva subito anche nell'app, senza nuova revisione Apple).
- **Condividi → Mapetite** da Instagram, TikTok, Google Maps e Safari: apre l'app su "Salva dal reel" con il link già dentro. Sul sito non si può fare: è la funzione da app vera che chiede Apple (regola 4.2).
- **Accesso con Google** che funziona dentro l'app (Google lo blocca nelle app che mostrano un sito: lo apriamo nel foglio di Safari, come vuole Google).
- Icona Mapetite, solo iPhone in verticale, permessi spiegati in italiano (fotocamera, foto, posizione).
- Build nel cloud gratis: GitHub Actions su Mac, ~10 minuti a giro (i minuti Mac valgono 10 volte: con i 2.000 minuti gratuiti al mese ci stanno ~15 build).

## Passi tuoi, in ordine

### 1. Iscrizione ad Apple Developer (20 minuti + attesa Apple, di solito 1–2 giorni)
1. Sul telefono o sul computer apri https://developer.apple.com/programs/enroll/ e accedi con il tuo **Apple ID** (serve la verifica in due passaggi attiva).
2. Scegli **"Individual / Sole Proprietor"** (persona fisica). Consigliato per partire subito: basta un documento. In App Store come venditore comparirà il tuo nome e cognome.
   - In alternativa **"Organization"** (società): serve il numero **D-U-N-S** della società (gratuito, ma 1–2 settimane di attesa) e un sito aziendale. Si può passare da persona a società più avanti, chiedendo ad Apple.
3. Paga **99 € all'anno** (controlla il prezzo che ti mostra Apple).
4. Aspetta la mail "Welcome to the Apple Developer Program". **Scrivimi in chat quando arriva.**

### 2. Crea l'app in App Store Connect (10 minuti, dopo la mail di Apple)
1. https://developer.apple.com/account/resources/identifiers/list → **"+"** → **App IDs** → **App** → Continua.
   - Description: `Mapetite` · Bundle ID: **Explicit** → `app.mapetite` → Continua → Register.
2. Ancora **"+"** → App IDs → App → Description `Mapetite Condividi` · Bundle ID `app.mapetite.condividi` → Register.
3. https://appstoreconnect.apple.com/apps → **"+"** → **Nuova app**:
   - Piattaforme: **iOS** · Nome: **Mapetite** (se è preso: "Mapetite – la tua mappa del cibo") · Lingua principale: **Italiano** · ID bundle: **app.mapetite** · SKU: `mapetite-ios` · Accesso utente: Accesso completo → Crea.

### 3. La chiave per la build nel cloud (5 minuti)
1. https://appstoreconnect.apple.com/access/integrations/api → **"Genera chiave API"** (la prima volta chiede di accettare: "Richiedi accesso").
2. Nome: `GitHub build` · Accesso: **Admin** (serve per creare da sola i certificati di firma) → Genera.
3. **Scarica la chiave** (file `AuthKey_XXXXXXXXXX.p8`): si scarica **una volta sola**, tienila.
4. Annota **ID chiave** (Key ID, 10 caratteri) e **ID emittente** (Issuer ID, in alto nella pagina).
5. Il **Team ID**: https://developer.apple.com/account → Membership details → "Team ID" (10 caratteri).

### 4. Metti le 4 chiavi su GitHub (5 minuti, dal computer)
https://github.com/mapetite-app/mapetite-web/settings/secrets/actions → **"New repository secret"**, quattro volte:
| Nome | Valore |
|---|---|
| `APPLE_TEAM_ID` | il Team ID |
| `ASC_KEY_ID` | l'ID chiave |
| `ASC_ISSUER_ID` | l'ID emittente |
| `ASC_KEY_P8` | tutto il testo del file `.p8` (aprilo con TextEdit/Blocco note, copia anche le righe BEGIN/END) |

Le chiavi restano solo su GitHub: il team non le vede e non le scrive da nessuna parte.

### 5. Costruisci e manda su TestFlight (1 minuto + 15 di attesa)
1. https://github.com/mapetite-app/mapetite-web/actions/workflows/app-iphone.yml → **"Run workflow"** → branch `main` → spunta **"Carica su TestFlight"** → Run.
2. Dopo ~15 minuti, in App Store Connect → Mapetite → **TestFlight** compare la build (Apple la elabora per 5–30 minuti).
3. Sul tuo iPhone installa l'app **TestFlight** dall'App Store, poi in App Store Connect → TestFlight → **Tester interni** → aggiungi te stesso. Ti arriva l'invito: installa Mapetite e prova **Condividi → Mapetite** da un reel.
4. Se il giro fallisce, scrivimi: leggo l'errore da GitHub e lo correggo.

### 6. Dopo (lo prepara il team, ti chiederemo solo conferme)
- **"Accedi con Apple"** (proposta 79): il tasto è già nel codice e compare da solo appena Apple è acceso su Supabase. Passi tuoi (15 minuti, dopo l'iscrizione):
  1. https://developer.apple.com/account/resources/identifiers/list → apri l'App ID `app.mapetite` → spunta **Sign In with Apple** → Save.
  2. Identifiers → **"+"** → **Services IDs** → Description `Mapetite web`, Identifier `app.mapetite.web` → Register; poi aprilo, spunta Sign In with Apple → **Configure**: Primary App ID `app.mapetite`, Domains `ypcghfffzcffyhfvungc.supabase.co`, Return URL `https://ypcghfffzcffyhfvungc.supabase.co/auth/v1/callback` → Save.
  3. **Keys** → **"+"** → nome `Mapetite Apple login`, spunta Sign In with Apple (Configure → `app.mapetite`) → Register → scarica il file `.p8` e annota il Key ID.
  4. Supabase → https://supabase.com/dashboard/project/ypcghfffzcffyhfvungc/auth/providers → **Apple** → accendi; Client IDs: `app.mapetite.web,app.mapetite`; per la "Secret Key" Supabase chiede un codice generato da Team ID, Key ID, Services ID e file `.p8` (c'è il generatore nella stessa pagina) → Save. Il codice scade ogni 6 mesi: va rigenerato.
- **Avvisi push nell'app** (oggi sono solo per il sito installato): chiave APNs, stessa pagina delle Keys.
- **Scheda dell'App Store: testi pronti da incollare in `APP-STORE-SCHEDA.md` (23/11)**, con URL di assistenza `https://mapetite-web.vercel.app/aiuto`. Prima: descrizione, parole chiave, screenshot da 6,9" (li facciamo noi), indirizzo della privacy (https://mapetite-web.vercel.app/privacy), **età minima** (DA-FARE 11) e "Privacy nutrizionale" (dati raccolti: email, salvati, posizione approssimata; nessun tracciamento pubblicitario).
- **Invio alla revisione Apple**: 1–3 giorni. Il rischio principale è la regola 4.2 (app che è solo un sito): per questo ci sono Condividi e l'accesso nativo, e dopo arriveranno gli avvisi push.

## Note tecniche (per le sessioni)
- `capacitor.config.ts`: `server.url` = produzione; `app-ios-www/` serve solo perché Capacitor vuole una cartella locale. Senza rete l'app mostra il suo avviso "Sei senza rete" (NWPathMonitor in `MapetiteViewController`) e torna da sola quando la rete c'è; `server.errorPath` di Capacitor NON va usato: si accende anche sulle navigazioni annullate (-999), cioè all'avvio dal Condividi e quando l'accesso con Google ferma il redirect.
- `ios/App/App/AccessoNativoPlugin.swift` + `src/app/auth/app-ritorno/route.ts`: giro dell'accesso con provider (vedi commento in testa al plugin). Supabase accetta già `https://mapetite-web.vercel.app/**` tra i redirect.
- `ios/App/Condividi/`: estensione di condivisione, nessuna rete, nessun App Group.
- `.github/workflows/app-iphone.yml`: "prova" compila senza firma a ogni modifica di `ios/`; "carica" firma con la chiave API (firma automatica, `-allowProvisioningUpdates`) e carica. Il numero di build è il numero del giro di GitHub.
- Modifiche al progetto Xcode da Linux: gem `xcodeproj` (`gem install xcodeproj`).
