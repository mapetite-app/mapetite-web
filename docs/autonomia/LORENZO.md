# Lorenzo virtuale — regole per lo sviluppo autonomo di Mapetite

Questo file sostituisce Lorenzo quando lavori da solo (sessioni notturne programmate).
Leggilo per intero prima di toccare codice. In caso di dubbio vale la regola più prudente.

## Chi è Lorenzo e cosa vuole

- Founder di Mapetite. Lavora a tempo pieno altrove: ha 10 minuti al giorno, dal telefono, per provare e approvare.
- Mapetite: PWA mobile-first per scoprire locali food & beverage. Differenziazione: far emergere locali non mainstream adatti ai gusti della persona, non ricopiare Google Maps.
- Obiettivo di breve: un'app che possa far provare a tester e investitori senza imbarazzo. Oggi non è così: la ricerca è troppo approssimativa e la grafica non convince.
- Preferisce poche cose fatte molto bene a tante cose a metà.

## Il ciclo di ogni sessione autonoma

1. `git fetch origin main` e `git log --oneline -15`: il log è la fonte di verità, non la memoria.
2. Leggi `docs/autonomia/BACKLOG.md` e i commenti di Lorenzo sulle PR aperte (`gh pr list`, `gh pr view N --comments`).
3. Priorità: (a) correggere una PR aperta su cui Lorenzo ha lasciato feedback; (b) altrimenti la prima voce "PRONTA" del backlog.
4. Lavora su UNA voce sola. Branch: `claude/<numero-voce>-<slug>` creato da `main` aggiornato.
5. Diagnostica prima del codice: grep/lettura dei file coinvolti; mai agire su supposizioni sullo stato dei file.
6. Una modifica logica alla volta. Commit atomici con messaggi in italiano.
7. Verifica: `npx tsc --noEmit` deve passare; `npx eslint src` non deve avere più errori di prima (oggi: 11 errori, 8 warning preesistenti). `npm run build` in questo ambiente fallisce per il download di Google Fonts: è un limite dell'ambiente, la build vera è quella della preview Vercel.
8. Apri una PR verso `main` con descrizione in italiano: cosa cambia per l'utente, come provarlo sul telefono (passi concreti), cosa NON è stato verificato, eventuali dubbi. Niente gergo superfluo.
9. Aggiorna `docs/autonomia/BACKLOG.md` (stato della voce, link alla PR) nello stesso branch.
10. Se la voce è troppo grande per una sessione, consegna un primo pezzo funzionante e scrivi nella PR cosa resta.

## Cosa NON fare mai senza approvazione esplicita di Lorenzo

- Merge su `main` o push diretto su `main` (ogni push su main va in produzione).
- Migrazioni Supabase, nuove tabelle/colonne, modifiche RLS. Puoi scrivere il file di migrazione nella PR, ma marcalo "DA APPROVARE" e non dare per scontato che sia applicato.
- Nuove API o servizi a pagamento, aumento dei campi richiesti a Google Places (FIELD_MASK), aumento di `SYNTHESIS_LIMIT` o dei `max_tokens`.
- Cancellare dati, file di migrazione esistenti o funzionalità.
- Cambiare modello AI (oggi Claude Haiku 4.5) o le chiavi/variabili d'ambiente.
- Scelte grafiche definitive: per UI nuove proponi, se possibile, 2 varianti dietro un flag o in due commit distinti e chiedi quale tenere.

## Regole tecniche (vincolanti)

- Next.js 16: leggi la guida pertinente in `node_modules/next/dist/docs/` prima di scrivere codice (vedi AGENTS.md).
- Chiavi server-side mai con prefisso `NEXT_PUBLIC_`. Mai valori hardcoded dipendenti dall'ambiente ("regola anti-Simone").
- Google è l'unica fonte dei fatti. Haiku produce solo campi derivati: non riordina i risultati, non inventa locali, e se fallisce l'app degrada senza rompersi.
- Pavimento qualità (`FLOOR_RATING=3.5`, `FLOOR_REVIEWS=20`) volutamente basso: non alzarlo.
- `dont_expect` è orientamento, mai giudizio negativo; array vuoto se non c'è un segnale ricorrente nelle recensioni. Il vincolo anti-invenzione va preservato in ogni modifica del prompt.
- Google Place ID (`ChIJ...`) e UUID Supabase sono distinti: operazioni Supabase con UUID, Google con Place ID.
- Un solo canale di scrittura per l'arricchimento (`upsertEnrichment`), con mapper per fonte.
- Contenuti TripAdvisor non devono mai alimentare la sintesi LLM. Niente scraping (TripAdvisor, Gambero Rosso, Puntarella Rossa).
- Emoji: riordinare le keyword in `src/lib/emoji.ts` cambia silenziosamente l'emoji dei locali esistenti: verifica prima.
- Tailwind v4: token in `globals.css` (`@theme inline`), non esiste `tailwind.config.ts`. Colori: `bg-brand` teal `#1a3c40`, `accent` corallo `#ff6b4a`; font `font-display` Poppins, `font-sans` Inter.
- Testi dell'interfaccia in italiano.

## Costi (tetto Lorenzo: 20 €/mese su Google)

- Quote Google già impostate a 50 richieste/giorno per Text Search, Place Details, Nearby; 200/giorno per le foto.
- Ogni Text Search con il FIELD_MASK attuale (include reviews ed editorialSummary) è fatturata nella fascia più cara. Una chiamata Text Search restituisce fino a 20 locali per un solo addebito: spostare le recensioni su Place Details per singolo locale costerebbe di più, non di meno.
- Ogni modifica che aumenta le chiamate per ricerca va segnalata in PR con la stima dell'impatto.

## Come comunicare con Lorenzo

- Italiano, frasi brevi, niente recap di cose che già sa. Domande dirette, una per volta.
- In PR: prima "cosa vedi di diverso", poi "come provarlo", poi i dettagli tecnici.
- Segnala sempre i limiti di quello che hai verificato. Se una tua affermazione precedente era sbagliata, dillo.
