# Piano fino al 25 ottobre 2026 — Mapetite pronta per i tester

Scritto il 15/10 su richiesta di Lorenzo. Le sessioni notturne lo seguono in quest'ordine (prima di `BACKLOG.md`).
Obiettivo del 25/10: un gruppo di tester usa Mapetite da solo e alla fine sappiamo **se ha senso**. Quindi servono tre cose:
1. l'app deve convincere in 10 secondi (grafica e velocità);
2. il differenziatore deve vedersi (verdetto sempre, locali giusti per te, non i più famosi);
3. dobbiamo **misurare** se i tester tornano e salvano, non solo chiederglielo.

Vincoli fissi: budget Google 20 €/mese e quote invariate; nessun servizio a pagamento nuovo; nessun contenuto Google salvato sui nostri server.

## Blocco A — Convincere in 10 secondi (15–18/10)

| # | Cosa | Perché | Stato |
|---|---|---|---|
| A1 | **Card dei risultati stile Places**: più basse, nome grande, categoria in maiuscoletto, verdetto Mapetite in 2 righe, 2 chip; senza foto una copertina col colore della cucina invece del blocco tutto teal; intestazione dei risultati in una riga sola; mappa più visibile | È la prima cosa che si vede dopo una ricerca: oggi è pesante e copre metà mappa | IN CORSO (15/10) |
| A2 | **Prima card in ~2 s dalla home** (oggi ~5): la comprensione della frase e Google lavorano in fila; frasi semplici capite senza AI e segnaposto subito | "Una ricerca da venti secondi non esiste" (VISIONE) | — |
| A3 | **Primo accesso per i tester**: link d'invito, 3 schermate (cosa fa Mapetite, una ricerca di esempio vera, importa i tuoi salvati da Google Maps), poi dritti alla mappa | Il tester deve capire da solo, senza spiegazioni a voce | — |
| A4 | **Scheda del locale rifinita** sul modello Places: foto grande, verdetto in evidenza, barra azioni fissa (Percorso, Chiama, Salva) | Dove si decide | — |

## Blocco B — Il differenziatore si vede (18–20/10)

| # | Cosa | Perché | Stato |
|---|---|---|---|
| B1 | **"Per te" che impara** dagli eventi (salvataggi, aperture, filtri, "Ci sono stato"): i risultati salgono se assomigliano a ciò che salvi, con il motivo scritto ("Come Trattoria X, che hai salvato") | È il vantaggio competitivo di VISIONE; la tabella `events` ora c'è | — |
| B2 | **Classifica personale** "Ti è piaciuto più di X?" dopo "Ci sono stato" (come Beli): la tua top per città | Fa tornare nell'app e dà un segnale di gusto vero | — |
| B3 | **Mappa dei salvati condivisibile** con un link (sola lettura, scelta dell'utente) | Effetto rete: ogni tester porta amici | — |

## Blocco C — Misurare se Mapetite ha senso (19–21/10)

| # | Cosa | Perché | Stato |
|---|---|---|---|
| C1 | **Pannello dei numeri per Lorenzo** (pagina protetta): tester attivi, ricerche, salvataggi per tester, ritorni dopo 1 e 7 giorni, ricerche finite senza salvare, ricerche più frequenti | Senza numeri, il 25/10 non si capisce niente | — |
| C2 | **"Ti è stato utile?" in un tocco** dopo una ricerca (👍/👎 + campo facoltativo) e feedback dalla barra | Il perché dietro i numeri | — |
| C3 | **Errori visibili a Lorenzo**: riepilogo giornaliero degli errori di produzione dai log Vercel | Sapere cosa si rompe prima che lo dicano i tester | — |

## Blocco D — Pronti per la consegna (22–24/10)

| # | Cosa | Stato |
|---|---|---|
| D1 | Controllo qualità completo a 390 e 360 px, con screenshot affiancati ai riferimenti | — |
| D2 | Account demo con salvati realistici a Roma e Milano, copione demo aggiornato (`DEMO.md`) | — |
| D3 | Lorenzo prova su iPhone e Android veri (unica cosa che Claude non può fare) | — |
| D4 | 24/10: solo correzioni, niente funzioni nuove. 25/10: link ai tester | — |

## Calendario

- **15/10 (giorno, con Lorenzo)**: A1.
- **Notte 15→16**: A1 rifinita, A2.
- **Notte 16→17**: C1, C2.
- **Sabato 17 (tutto il giorno)**: A3, A4, B1.
- **Domenica 18 (tutto il giorno)**: B2, B3, C3.
- **Notti 19→22**: D1, D2, correzioni dalle prove di Lorenzo.
- **Notti 22→24**: solo correzioni e velocità.

Se una voce si blocca, si passa alla successiva e lo si scrive in PR.
