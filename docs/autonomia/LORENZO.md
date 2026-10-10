# Lorenzo virtuale — regole per lo sviluppo autonomo di Mapetite

Questo file sostituisce Lorenzo quando lavori da solo (sessioni notturne programmate).
Leggilo per intero prima di toccare codice. In caso di dubbio vale la regola più prudente.

## Chi è Lorenzo e cosa vuole

- Founder di Mapetite. Lavora a tempo pieno altrove: ha 10 minuti al giorno, dal telefono, per provare e approvare.
- Mapetite: PWA mobile-first per scoprire locali food & beverage. Differenziazione: far emergere locali non mainstream adatti ai gusti della persona, non ricopiare Google Maps.
- Obiettivo di breve: un'app che possa far provare a tester e investitori senza imbarazzo. Oggi non è così: la ricerca è troppo approssimativa e la grafica non convince.
- Preferisce poche cose fatte molto bene a tante cose a metà.

## Obiettivo e ritmo

- Obiettivo: versione da far usare a un gruppo ristretto di persone entro circa 2 settimane (fine ottobre 2026). Ogni notte deve far avanzare il piano in `BACKLOG.md` il più possibile.
- Lorenzo ha 20–30 minuti la mattina per provare e approvare. Interviene solo nei momenti critici (merge, decisioni elencate sotto "Cosa NON fare mai").

## Il ciclo di ogni notte

1. `git fetch origin` e `git log --oneline -15 origin/main`: il log è la fonte di verità, non la memoria.
2. Leggi `docs/autonomia/BACKLOG.md` e i commenti di Lorenzo sulle PR aperte (solo API REST: `gh api repos/mapetite-app/mapetite-web/pulls`, `.../issues/N/comments`, `.../pulls/N/comments`; GraphQL non è disponibile).
3. Priorità: (a) applicare il feedback di Lorenzo sulle PR aperte; (b) poi le voci "PRONTA" del backlog, in ordine.
4. **Una PR per notte, più voci dentro.** Branch `claude/notte-AAAA-MM-GG` da `main` aggiornato (se la PR della notte precedente non è ancora stata unita, parti dal suo branch e dichiaralo nella PR). Fai quante più voci possibile, ognuna in commit separati e reversibili singolarmente. Fermati quando una voce richiede una decisione di Lorenzo: passa alla successiva.
5. Diagnostica prima del codice: grep/lettura dei file coinvolti; mai agire su supposizioni sullo stato dei file.
6. Una modifica logica alla volta. Commit atomici con messaggi in italiano. **Autore dei commit obbligatorio:** `git -c user.name="lorenzo-mapetite" -c user.email="founder.mapetite@gmail.com" commit ...` — Vercel (piano Hobby) non crea l'anteprima per commit di altri autori. Mantieni la riga `Co-Authored-By` di Claude nel messaggio.
7. Verifica statica: `npx tsc --noEmit` deve passare; `npx eslint src` non deve avere più errori di prima (oggi: 11 errori, 8 warning preesistenti).
8. **Test reali (se l'ambiente ha chiavi e rete abilitate):** avvia `npm run dev`, prova le API con `curl` e l'interfaccia con Playwright (Chromium già installato) a viewport mobile 390×844. Allega alla PR gli screenshot prima/dopo e l'esito delle ricerche di prova di `docs/autonomia/TEST-RICERCHE.md`.
   - Budget Google per i test: massimo 10 ricerche reali a notte (la quota totale è 50/giorno ed è condivisa con Lorenzo). Salva le risposte Google delle ricerche di prova in `scripts/fixtures/` (cartella esclusa da git) e riusale per i test ripetuti.
   - Se chiavi o rete mancano, dichiaralo in PR: "non testato dal vivo".
   - `npm run build` può fallire per il download di Google Fonts se la rete non lo consente: non è un errore del codice.
9. L'anteprima Vercel del branch compare come stato del commit (`gh api repos/mapetite-app/mapetite-web/deployments`, poi `.../deployments/ID/statuses` → `environment_url`, formato `https://mapetite-…-lorenzomapetite.vercel.app`): mettila in cima alla PR. Apri o aggiorna la PR verso `main` con descrizione in italiano: per ogni voce, cosa cambia per l'utente e come provarlo sul telefono (passi concreti); poi cosa NON è stato verificato e i dubbi. Niente gergo superfluo.
10. Aggiorna `docs/autonomia/BACKLOG.md` (stato delle voci, link alla PR) nello stesso branch.

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
- Google è l'unica fonte dei fatti. Haiku produce campi derivati e non inventa mai locali; se fallisce, l'app degrada mostrando i risultati Google senza rompersi.
- Approvato da Lorenzo (10/10/2026): Haiku può escludere o spostare in fondo i locali che chiaramente non rispettano i requisiti espliciti della richiesta (tipo di locale, caratteristica fisica, occasione, atmosfera), basandosi solo su recensioni e attributi Google. Ogni esclusione va registrata nei log con il motivo. Nel dubbio il locale resta.
- Pavimento qualità (`FLOOR_RATING=3.5`, `FLOOR_REVIEWS=20`) volutamente basso: non alzarlo.
- `dont_expect` è orientamento, mai giudizio negativo; array vuoto se non c'è un segnale ricorrente nelle recensioni. Il vincolo anti-invenzione va preservato in ogni modifica del prompt.
- Google Place ID (`ChIJ...`) e UUID Supabase sono distinti: operazioni Supabase con UUID, Google con Place ID.
- Un solo canale di scrittura per l'arricchimento (`upsertEnrichment`), con mapper per fonte.
- Contenuti TripAdvisor non devono mai alimentare la sintesi LLM. Niente scraping (TripAdvisor, Gambero Rosso, Puntarella Rossa).
- Emoji: riordinare le keyword in `src/lib/emoji.ts` cambia silenziosamente l'emoji dei locali esistenti: verifica prima.
- Tailwind v4: token in `globals.css` (`@theme inline`), non esiste `tailwind.config.ts`. Colori: `bg-brand` teal `#1a3c40`, `accent` corallo `#ff6b4a`; font `font-display` Poppins, `font-sans` Inter.
- Testi dell'interfaccia in italiano.
- Prima di qualsiasi lavoro grafico leggi `docs/autonomia/RIFERIMENTI-DESIGN.md` e guarda gli screenshot in `docs/autonomia/riferimenti/`.

## Costi (tetto Lorenzo: 20 €/mese su Google)

- Quote Google già impostate a 50 richieste/giorno per Text Search, Place Details, Nearby; 200/giorno per le foto.
- Ogni Text Search con il FIELD_MASK attuale (include reviews ed editorialSummary) è fatturata nella fascia più cara. Una chiamata Text Search restituisce fino a 20 locali per un solo addebito: spostare le recensioni su Place Details per singolo locale costerebbe di più, non di meno.
- Ogni modifica che aumenta le chiamate per ricerca va segnalata in PR con la stima dell'impatto.

## Come comunicare con Lorenzo

- Italiano, frasi brevi, niente recap di cose che già sa. Domande dirette, una per volta.
- In PR: prima "cosa vedi di diverso", poi "come provarlo", poi i dettagli tecnici.
- Segnala sempre i limiti di quello che hai verificato. Se una tua affermazione precedente era sbagliata, dillo.
