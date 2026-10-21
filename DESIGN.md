# Design di Mapetite

Regole brevi per chi tocca l'interfaccia. Fonti: `src/app/globals.css` (token), `docs/autonomia/RIFERIMENTI-DESIGN.md` (riferimenti), `docs/autonomia/VISIONE.md` e `docs/autonomia/LORENZO.md` (regole di prodotto). Se questo file e il codice non concordano, vale `globals.css`: aggiorna questo file.

## 1. Principi
1. **Semplice prima di tutto** (Lorenzo, 17/10). Ogni schermata ha **una cosa principale** da fare; il resto è un tocco più in là (foglio, "Altro", scheda), mai tolto. Prima di aggiungere un pulsante, una riga o un riquadro, decidi cosa togli o nascondi. Niente doppioni della stessa azione sullo stesso schermo.
2. **Meno testo.** Etichette di 1–2 parole, una sola frase per spiegare. Tutto in italiano.
3. **Il verdetto Mapetite si vede sempre** su card e scheda. È ciò che ci distingue.
4. **Mai inventare.** Nessun contenuto segnaposto, nessuna chip generica, nessun dato finto. Se un dato manca, non si mostra (o si mostra la frase di Google).
5. **Sembra un'app, non un sito.** Fogli dal basso, tocco con feedback, niente salti quando arrivano i dati (riservare lo spazio), caricamenti con segnaposto.
6. **Regge una demo dal vivo** su telefono a 390×844 e 360×800.

## 2. Riferimenti
- **Places** — principale: layout, gerarchia, sensazione editoriale e calma. Home = ricerca; risposta AI come un consiglio; mappa con carosello di card scure; scheda con barra azioni fissa. Screenshot `docs/autonomia/riferimenti/places-*`.
- **Albo** — primo accesso e salvataggio: una domanda per schermata, risposte a pillole grandi, momento "magia", foglio "Aggiungi" con card grandi, stati vuoti curati. Screenshot `albo-*`.
- **Mapstr** — secondario (funzioni di salvataggio e tag).
- Si prende struttura ed esperienza, **mai** marchio, testi o palette. Mapetite resta teal + corallo.

## 3. Token (da `src/app/globals.css`)
Tailwind v4: i token stanno in `globals.css` (`:root` + `@theme inline`). Non esiste `tailwind.config.ts`. Usa le classi dei token, non colori scritti a mano.

**Colori**
| Token | Valore | Classe | Uso |
|---|---|---|---|
| brand | `#1a3c40` | `bg-brand`, `text-brand` | teal: barra, pulsanti principali, bordi dei pin |
| brand-light | `#2a5b60` | `bg-brand-light` | stati premuti, varianti del teal |
| accent | `#ff6b4a` | `bg-accent`, `text-accent` | corallo: scintilla AI, elemento attivo, una sola azione forte per schermo |
| accent-light | `#ffe8e2` | `bg-accent-light` | sfondi tenui dell'accento |
| bg | `#ffffff` | `bg-bg` | sfondo pagina |
| surface | `#f5f5f4` | `bg-surface` | riquadri e campi |
| text | `#1c1c1e` | `text-text` | testo |
| text-muted | `#6b7280` | `text-text-muted` | testo secondario |
| border | `#e7e5e4` | `border-border` | bordi |
| success | `#22a06b` | `bg-success` | "Aperto ora" |
| star | `#f5a623` | `text-star` | stelle del voto |
| error | `#C7442E` | `text-error` | errori (rosso desaturato, coerente col corallo) |

**Font**
- `font-display` = Poppins: titoli, pulsanti, nomi dei locali.
- `font-sans` = Inter: testo.
- `font-title` = Poppins di default; serif editoriale (Newsreader) solo in prova con `?titoli=serif`.

**Raggi:** `rounded-card` 1rem (card, fogli) · `rounded-btn` 0.75rem (pulsanti, riquadri) · `rounded-pill` (pillole, chip, Salva tondo).
**Ombre:** `shadow-card` (card su fondo chiaro) · `shadow-float` (barre ed elementi sopra la mappa).
**Layout:** `--nav-height-mobile` = 64px + area sicura (barra in basso su telefono; 0 da computer); `--sheet-max-h` = 85dvh per i fogli dal basso. Margini laterali 16px. Bersagli al tocco almeno 44px.

## 4. Componenti chiave

### Card dei risultati — variante B "Carosello scuro" (scelta da Lorenzo il 18/10)
Mockup: `docs/autonomia/riferimenti/mapetite-lista-risultati-B-scelta.jpg` (prima: `mapetite-lista-risultati-prima.png`; modello: `places-04`). Nel mockup nomi, foto e frasi sono inventati: si prende la struttura, mai i contenuti.
- **Sopra la mappa:** barra di ricerca con scintilla corallo e ✕, "Filtri" a destra; sotto, una pillola piccola "12 posti" (apre Ho capito / Affina / Condividi). Nessuna intestazione sopra le card, nessuna seconda ✕.
- **Carosello:** card alte a foto piena, la card attiva al centro, le vicine visibili ai lati. Niente puntini di pagina: solo "1 di 12".
- **Dentro la card, dall'alto:** Salva (cerchio con bordo, in alto a destra) → categoria in maiuscoletto piccolo e spaziato ("ROOFTOP BAR") → nome grande in Poppins bianco → pillola verde "Aperto ora" (o "Chiuso ora") → verdetto su una riga con la scintilla corallo → fino a 2 chip con bordo dai `goFor` veri → "1 di 12".
- **Contrasto:** testo bianco su sfumatura scura dal basso, leggibile anche su foto chiare.
- **Pin:** foto del locale in un cerchio con bordo teal e nome sotto; il pin attivo più grande con bordo e nome in corallo. Senza foto resta l'emoji (`src/lib/emoji.ts`).
- **Vincoli:** chip solo da `goFor` (se mancano, niente chip); verdetto assente → frase di Google; spazio di verdetto e chip riservato fin dall'inizio (la card non salta più di ±24 px); restano "Questi risultati non vanno?" come ultima card, "📌 Salvato", "✨ Come … che hai salvato"; card e pin sincronizzati; foto con le regole di oggi (nessuna foto Google salvata sui nostri server).

### Scheda del locale (Places `places-05`, `places-10`)
Foto in alto a tutta larghezza, nome grande, "Città · distanza", "Categoria · prezzo", pillola aperto/chiuso, **verdetto Mapetite in evidenza**, chip dei punti forti, barra azioni fissa in basso (Prenota / Percorso / Salva). Una sola azione di salvataggio; "Ci sono stato" e "Condividi" dentro "Altro".

### Salvataggio e primo accesso (Albo)
- Salva: foglio dal basso con "📌 Voglio andarci / ✓ Ci sono stato", nota, raccolte, "Fatto".
- Primo accesso: barra di avanzamento, una domanda per schermata, pillole grandi, subito un risultato vero ("magia"). Nessun paywall.

### Salvati — mockup C "Card bianche" vestito in stile A (scelto da Lorenzo, PR #87)
`src/components/salvati-lista.tsx`. Cosa principale: **ritrovare un posto**. Fondo carta `#f8f6f2`, titolo serif "I tuoi posti" (Newsreader) con sopra "N posti · città vere"; icone Cerca / Mappa / + (Aggiungi). Filtri "Tutti N / Da provare N / Ci sono stato N" (conteggi veri); raccolte come cerchi (le storie), prima "Stasera", ultima "Nuova"; lista in una card bianca, per vicinanza se la posizione è già permessa, nomi in serif, badge di stato solo se lo stato c'è, "Reel Instagram" se c'è un reel collegato (`contenuti_locali`), altrimenti il verdetto in cache. Città, tipo, voto e prezzo nel foglio "Filtri"; la mappa dei salvati (carosello di prima) a un tocco, con "Vedi la lista" per tornare. Nessuna foto: emoji su fondi caldi.

### Barra in basso
Assistente · Salvati · **Mappa** (cerchio teal al centro) · Amici · Profilo. Etichette di una parola.

## 5. Prima di consegnare un lavoro grafico
- Screenshot a 390×844 e 360×800 affiancati al riferimento (Places o Albo) nella PR.
- Controlli nuovi nel giro automatico `scripts/e2e/giro.mjs`.
- Chiediti: cosa ho tolto in cambio di quello che ho aggiunto? Qual è la cosa principale di questa schermata?
