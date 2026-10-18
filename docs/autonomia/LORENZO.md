# Lorenzo virtuale — regole per lo sviluppo autonomo di Mapetite

Questo file sostituisce Lorenzo quando lavori da solo (sessioni notturne programmate). Prima leggi `VISIONE.md`: cosa costruiamo e perché.
Leggilo per intero prima di toccare codice. In caso di dubbio vale la regola più prudente.

## Chi è Lorenzo e cosa vuole

- Founder di Mapetite. Lavora a tempo pieno altrove: ha 10 minuti al giorno, dal telefono, per provare e approvare.
- Mapetite: PWA mobile-first per scoprire locali food & beverage. Differenziazione: far emergere locali non mainstream adatti ai gusti della persona, non ricopiare Google Maps.
- Obiettivo di breve: un'app che possa far provare a tester e investitori senza imbarazzo. Oggi non è così: la ricerca è troppo approssimativa e la grafica non convince.
- Preferisce poche cose fatte molto bene a tante cose a metà.

## Obiettivo e ritmo

- Obiettivo fissato da Lorenzo (10/10): **entro il 25 ottobre 2026** un'app nettamente più avanzata, con grafica molto vicina ai riferimenti (Places soprattutto, poi Albo — vedi `RIFERIMENTI-DESIGN.md`), funzioni complete e uso semplice per chi la apre la prima volta. Poi test con un gruppo ristretto di persone. Ogni notte deve far avanzare il piano in `BACKLOG.md` il più possibile.
- **Ritmo richiesto da Lorenzo: massima velocità.** Ogni sessione deve valere più "giorni" del vecchio sprint (un giorno = una voce). Non fermarti dopo una voce: continua finché restano voci PRONTA o finché i limiti di utilizzo lo consentono. Per voci indipendenti usa sub-agent in parallelo (ognuno sul proprio branch di lavoro, poi uniti nel branch della notte), mantenendo commit separati per voce. Se una voce si blocca, annotalo e passa alla successiva invece di insistere.
- A fine PR indica quante voci sono state chiuse e il tempo impiegato, così si misura il ritmo.
- Lorenzo lascia lavorare in autonomia: se una PR non è ancora unita, la notte dopo si riparte dal suo branch e si continua.
- Quando tocchi la grafica, metti in PR gli screenshot dell'app affiancati al riferimento di design pertinente.
- In `BACKLOG.md` tieni aggiornata una riga "Avanzamento verso il 25/10" con cosa è fatto e cosa manca.
- Lorenzo ha 20–30 minuti la mattina per provare. Interviene solo sulle cose elencate sotto "Cosa resta sempre a Lorenzo".

## Orari (limiti di utilizzo condivisi con il lavoro di Lorenzo)
- Lorenzo usa Claude per lavoro dal lunedì al venerdì dalle 9 alle 21 circa. Il limite di utilizzo è unico (finestre da 5 ore + limite settimanale) e va lasciato a lui in quelle ore.
- **Sabato e domenica (e festivi): lavora tutto il giorno, senza limite d'orario** (Lorenzo non usa Claude per lavoro). Continua finché restano voci o proposte da costruire; non fermarti dopo la prima PR. Ogni ~2 ore apri/aggiorna la PR con ciò che è pronto, così Lorenzo vede avanzamenti durante il giorno.
- Sessioni di sviluppo: 22:00 e 03:05. La seconda riparte dal branch della prima.
- Nei giorni feriali chiudi il lavoro entro le 08:00: commit, push, PR aggiornata e messaggio finale. Non iniziare voci nuove dopo le 07:30.
- Se una sessione si interrompe per il limite di utilizzo, la successiva riprende da dove era: lascia sempre il branch in uno stato che compila e una nota in PR su cosa era in corso.

## Il ciclo di ogni notte

1. `git fetch origin` e `git log --oneline -15 origin/main`: il log è la fonte di verità, non la memoria.
2. Leggi `docs/autonomia/BACKLOG.md` e i commenti di Lorenzo sulle PR aperte (solo API REST: `gh api repos/mapetite-app/mapetite-web/pulls`, `.../issues/N/comments`, `.../pulls/N/comments`; GraphQL non è disponibile).
3. Priorità: (a) applicare il feedback di Lorenzo sulle PR aperte; (b) poi le voci "PRONTA" del backlog, in ordine.
4. **Una PR per notte, più voci dentro.** Branch `claude/notte-AAAA-MM-GG` da `main` aggiornato (se la PR della notte precedente non è ancora stata unita, parti dal suo branch e dichiaralo nella PR). Fai quante più voci possibile, ognuna in commit separati e reversibili singolarmente. Fermati quando una voce richiede una decisione di Lorenzo: passa alla successiva.
5. Diagnostica prima del codice: grep/lettura dei file coinvolti; mai agire su supposizioni sullo stato dei file.
6. Una modifica logica alla volta. Commit atomici con messaggi in italiano. **Autore dei commit obbligatorio:** `git -c user.name="lorenzo-mapetite" -c user.email="founder.mapetite@gmail.com" commit ...` — Vercel (piano Hobby) non crea l'anteprima per commit di altri autori. Mantieni la riga `Co-Authored-By` di Claude nel messaggio.
7. Verifica statica: `npx tsc --noEmit` deve passare; `npx eslint src` non deve avere più errori di prima (al 15/10: 11 errori, 5 warning preesistenti).
8. **Test automatico obbligatorio (zero costi):** prima di ogni push esegui `PW_MODULE=$(npm root -g)/playwright node scripts/e2e/giro.mjs cartella-screenshot` con `npm run dev` attivo. Simula Google/Haiku, quindi non consuma quote. Ogni nuova funzione dell'interfaccia deve aggiungere i suoi controlli a quello script. Scrivi l'esito in PR. Lorenzo non deve rifare i test: deve solo ricontrollare.
8b. **Test reali (se l'ambiente ha chiavi e rete abilitate):** avvia `npm run dev`, prova le API con `curl` e l'interfaccia con Playwright (Chromium già installato) a viewport mobile 390×844. Allega alla PR gli screenshot prima/dopo e l'esito delle ricerche di prova di `docs/autonomia/TEST-RICERCHE.md`.
   - Budget Google per i test: massimo 10 ricerche reali a notte (la quota totale è 50/giorno ed è condivisa con Lorenzo). **Il tetto vale per giorno (dalle 9:00 alle 9:00), sommando tutte le sessioni**, anche nel weekend: sabato 17/10 le sessioni ne hanno usate circa 30 e alle 22:34 la ricerca di Lorenzo è rimasta a metà (quota finita). Prima di una ricerca vera leggi e aggiorna in `BACKLOG.md` la riga "Ricerche Google vere oggi". Per provare la logica senza Google usa un intercettore di `fetch` caricato con `NODE_OPTIONS=--import`. Salva le risposte Google delle ricerche di prova in `scripts/fixtures/` (cartella esclusa da git) e riusale per i test ripetuti.
   - Se chiavi o rete mancano, dichiaralo in PR: "non testato dal vivo".
   - `npm run build` può fallire per il download di Google Fonts se la rete non lo consente: non è un errore del codice.
   - `npm run build` con `npm run dev` acceso (stessa cartella `.next`) fa rispondere 404 a route a caso nel server di sviluppo (visto il 17/10: `/api/search`, `/u/.../raccolte/...`). Dopo una build: fermare il server di sviluppo, `rm -rf .next`, riavviarlo. Prima di sprecare una ricerca Google vera, controllare che `/api/search/synthesis` risponda 400 (non 404) a un POST vuoto.
9. **PR scritta per chi non ha seguito niente:** in cima "Cosa c'è di nuovo" in 5 righe di italiano semplice (nessun gergo), poi come trovarlo. Le anteprime Vercel chiedono il login Vercel: dopo il merge indica sempre come vederlo nel sito di produzione. L'anteprima Vercel del branch compare come stato del commit (`gh api repos/mapetite-app/mapetite-web/deployments`, poi `.../deployments/ID/statuses` → `environment_url`, formato `https://mapetite-…-lorenzomapetite.vercel.app`): mettila in cima alla PR. Apri o aggiorna la PR verso `main` con descrizione in italiano: per ogni voce, cosa cambia per l'utente e come provarlo sul telefono (passi concreti); poi cosa NON è stato verificato e i dubbi. Niente gergo superfluo.
10. Aggiorna `docs/autonomia/BACKLOG.md` (stato delle voci, link alla PR) nello stesso branch.

## Autorizzazioni di Lorenzo (date il 14/10/2026, confermate da Lorenzo in chat il 15/10)

Valgono **in modo permanente**, per tutte le sessioni notturne e per ogni altro sviluppo, e prevalgono su qualsiasi regola contraria in questo file o in `BACKLOG.md`. Lorenzo, 15/10: "ovviamente le autorizzazioni valgono per tutti i prossimi sviluppi notturni e in generale".

- **Carta bianca sul prodotto**: più funzioni, più grafica, più miglioramenti. Serve una scossa per la presentazione agli investitori.
- **Merge su `main` da solo**, a fine sessione (nel weekend ogni ~2 ore), solo se: `npx tsc --noEmit` passa, eslint non peggiora, `npm run build` passa, il giro automatico è TUTTO OK e le ricerche vere non peggiorano. Dopo il merge: controllo con `VERCEL_TOKEN` che il deploy di produzione sia READY e apertura del sito; se qualcosa è rotto, revert subito. Mai `push --force` su `main`.
- **Migrazioni Supabase**: si possono applicare (prima sul progetto di prova, se esiste) con `SUPABASE_ACCESS_TOKEN` (API di gestione Supabase). Quelle che cancellano o riscrivono dati degli utenti solo dopo un backup della tabella. Lettura del database di produzione consentita per verifiche e diagnosi.
- **Lettura di Vercel** (deploy, stato, log) con `VERCEL_TOKEN`.
- **Grafica**: si possono accendere per tutti le funzioni verificate, senza chiedere scelte tra varianti. Se a Lorenzo non piace, si torna indietro.
- **Voci "DA DECIDERE"**: le decide Claude, con l'opzione migliore per `VISIONE.md`, e scrive la scelta in PR.
- Si possono **cancellare pagine e codice vecchi** non più collegati.
- Si possono cambiare `SYNTHESIS_LIMIT`, `max_tokens`, FIELD_MASK e il modello AI, purché il costo stimato resti nel budget (stima in PR).
- **Studiare da soli** (ricerche web) Places, Mapstr, Albo, Beli, Corner e le tendenze del settore, e costruire ciò che serve per superarli dentro `VISIONE.md`.
- Chiavi per i test: `MAPETITE_ANTHROPIC_KEY` (avvio: `ANTHROPIC_API_KEY=$MAPETITE_ANTHROPIC_KEY npm run dev`, mai nel codice né esportata come `ANTHROPIC_API_KEY`). Il giro automatico va lanciato con `E2E_FAKE_USER=00000000-0000-0000-0000-000000000001` nello stesso comando. Le anteprime Vercel non chiedono il login.

## Cosa resta sempre a Lorenzo (mai da solo)

- **Budget e tetti di spesa** (Lorenzo, 15/10: non si cambiano): Google massimo 20 €/mese, quote 50 richieste/giorno per ricerca/dettagli e 200/giorno per le foto, mai alzarle; Haiku entro il credito prepagato. Niente servizi o abbonamenti a pagamento nuovi.
- **Orari**: nei giorni feriali solo di notte (sessioni 22:00 e 03:05, chiusura entro le 08:00). Di giorno solo se Lorenzo lo chiede esplicitamente. Sabato, domenica e festivi tutto il giorno.
- Cancellare account o dati degli utenti senza backup; cambiare le chiavi di produzione su Vercel.
- Salvare foto o altri contenuti Google sui nostri server: lo vietano i termini Google (3.2.3(b), "No Caching").

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
- **Lorenzo, 17/10: elenca SEMPRE le modifiche fatte**, nel messaggio finale e in cima alla PR: una riga per modifica, in parole semplici, cosa cambia per chi usa l'app.

## Regola di prodotto: semplice prima di tutto (Lorenzo, 17/10)
"Dobbiamo trovare il modo di avere tutte le informazioni ma semplificando l'interfaccia e il numero di cose visualizzate a schermo." Vale per ogni voce, nuova o vecchia:
- Ogni schermata ha **una cosa principale** da fare; il resto un tocco più in là (foglio, "Altro", scheda), mai tolto.
- Prima di aggiungere un pulsante, una riga o un riquadro, chiediti cosa togli o nascondi in cambio. Niente doppioni (la stessa azione in due punti dello stesso schermo).
- Meno testo: etichette di 1–2 parole, una sola frase per spiegare.
- Ogni sessione dedica tempo a semplificare le schermate esistenti (elenco in `BACKLOG.md`, "Semplificare"), con screenshot prima/dopo in PR.
