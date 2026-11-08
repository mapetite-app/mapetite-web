# Prima e dopo — 1/11 → 8/11/2026

Le stesse schermate del giro del 1/11 (`GIRO-2026-11-01.md`), rifatte in produzione domenica 8/11 dal collaudatore separato. Telefono simulato 390×844, italiano, posizione Roma centro, account di prova `claude-e2e@example.com` (5 salvati, gli stessi del 1/11) e un account nuovo per il primo accesso e la ricerca.
A sinistra il 1/11, a destra oggi. Voti severi, contro Places e Mapstr (`riferimenti/`).
Screenshot di oggi: `screenshots/2026-11-08/`; immagini affiancate: `screenshots/2026-11-08/affiancate/`.

## In breve
- **Media da 5,6 a 6,8.** Nessuna schermata arriva ancora all'8,5 richiesto per la produzione; tre ci si avvicinano (Importa, Primo accesso, Salvati).
- **Cosa si vede subito di meglio**: un solo stile (titoli serif ovunque, fondo carta), scheda a tutto schermo con le frecce dentro, risultati inquadrati sulla zona giusta con un titolo ("Dodici posti a Trastevere · Senza i locali più famosi"), Salvati e Profilo molto più corti e puliti.
- **Cosa manca ancora, ed è la prima cosa che si nota**: le **foto** (Salvati, scheda, home, conferma del link sono ancora emoji) e la **mappa vuota** all'apertura. Sono i difetti 1 e 2 del 1/11: entrambi aperti.

## I 10 difetti principali del 1/11

| # | Difetto del 1/11 | Oggi |
|---|---|---|
| 1 | Foto vere ovunque ci sia un locale | **Aperto.** Emoji in Salvati, scheda, home, Stasera, conferma del link. Nei risultati alcune foto ci sono, ma l'8/11 metà delle richieste foto rispondeva "Foto sospese per oggi". |
| 2 | Mappa piena all'apertura | **Aperto.** `/mappa` vuota anche dopo 6 s, con Hostaria Del Moro salvata a 250 m. |
| 3 | Avviso fisso "A 250 m c'è…" | **In parte.** Ora ha la ✕ e non copre più la lista dei Salvati, ma compare ancora sulla mappa e sotto Idee. |
| 4 | Inquadratura dopo la ricerca | **Chiuso.** Solo i risultati di Trastevere, nessun salvato lontano che allarga la mappa. |
| 5 | Scheda a tutto schermo e pulita | **Chiuso.** "‹ 1 di 5 ›" dentro la testata, niente lista grigia dietro, testata fissa scorrendo. |
| 6 | Dati essenziali nella scheda | **In parte.** Voto e prezzo sì; dai risultati anche "Chiuso · apre alle 12:30". Dai Salvati mancano orari e telefono e resta "Orari e foto su Google Maps →". |
| 7 | Un solo stile di titolo | **Quasi chiuso.** Stasera, Importa, Profilo, Assistente ora serif. Restano in Poppins la finestra "Salva locale", "La tua mappa è ancora vuota" e il riquadro delle raccolte. |
| 8 | Risultati stabili mentre arrivano | **In parte.** La mappa resta visibile, segnalini con emoji, prima card ferma. Il secondo posto della fila cambia ancora mentre arrivano i verdetti. |
| 9 | Raccolte da rifare | **In parte.** Il numero ora è giusto ("Crea la prima"), ma le raccolte stanno ancora in fondo al Profilo, senza copertine; nei Salvati c'è solo il chip "Nuova raccolta". |
| 10 | Profilo corto | **Chiuso.** Una schermata: nome, 3 numeri, "Il tuo gusto", "Le mie cose", Impostazioni. |

Chiusi 3, quasi chiuso 1, in parte 4, aperti 2.

## Voti per schermata

| Schermata | 1/11 | 8/11 |
|---|---|---|
| Accesso | 7 | 7 |
| Intro al primo avvio | 7 | 6,5 |
| Home | 6,5 | 7,5 |
| Mappa all'apertura | 4 | 4,5 |
| Idee | 5,5 | 7 |
| Ricerca: attesa | 5 | 6,5 |
| Ricerca: risultati | 6 | 7,5 |
| Scheda locale (da Salvati) | 5 | 6,5 |
| Salvati: lista | 6 | 7,5 |
| Salvati: mappa | 5 | 7 |
| Stasera dove andiamo? | 6 | 7,5 |
| Raccolte | 3,5 | 4,5 |
| Importa | 6,5 | 8 |
| Profilo | 4,5 | 7 |
| Assistente | 5,5 | 6,5 |
| Primo accesso | 7 | 8 |
| **Media** | **5,6** | **6,8** |

---

## Accesso — 7 → 7
![](screenshots/2026-11-08/affiancate/01-accesso.png)
Uguale. Restano la barra in basso sulla pagina di accesso (D1) e l'account con 5 salvati mandato a `/onboarding` dopo l'accesso (D2).

## Intro al primo avvio — 7 → 6,5
![](screenshots/2026-11-08/affiancate/02-intro.png)
Più curata (fonti a pillole che finiscono in "Salvato · Nella tua mappa"), ma compare ancora a chi ha già 5 salvati (D3) e anche a chi ha appena finito il primo accesso: due benvenuti di fila.

## Home — 6,5 → 7,5
![](screenshots/2026-11-08/affiancate/03-home.png)
"Mappa" non è più accesa sulla home, le card "Per te" sono più piccole e non sembrano più segnaposti, "I tuoi posti · 5" è in vista. Ancora senza foto, e il banner "Fai la tua mappa del gusto" resta (anche in Profilo).

## Mappa all'apertura — 4 → 4,5
![](screenshots/2026-11-08/affiancate/04-mappa-apertura.png)
L'avviso ora si chiude con la ✕. La mappa è ancora vuota: nessun segnalino, nemmeno il salvato a 250 m di cui parla l'avviso. Places e Mapstr aprono con la mappa piena.

## Idee — 5,5 → 7
![](screenshots/2026-11-08/affiancate/05-idee.png)
Da nove righe a tre idee dell'ora ("Da mangiare a tarda notte", "Vicino a me, aperto adesso", "Sorprendimi") e chip "Prova a chiedere". Niente più doppioni. Copre ancora mezza mappa.

## Ricerca: attesa — 5 → 6,5
![](screenshots/2026-11-08/affiancate/06-ricerca-attesa.png)
La mappa resta visibile, la card di caricamento dice cosa cerca, i segnalini hanno l'emoji. Verdetti tra 5 e 14 s (21 s alla prima ricerca dopo il primo accesso). A un account nuovo il banner "Aggiungi Mapetite alla Home" si sovrappone alle card di caricamento.

## Ricerca: risultati — 6 → 7,5
![](screenshots/2026-11-08/affiancate/07-risultati.png)
Inquadratura giusta, titolo editoriale, verdetto e "Per te" sulla card, filtri rapidi. Contro Places: prima card senza foto (emoji su teal), e ricaricando la pagina la ricerca sparisce (D25). Prima e dopo hanno richieste diverse (1/11 "cena romantica a Trastevere", oggi quella del copione demo).

## Scheda locale (da Salvati) — 5 → 6,5
![](screenshots/2026-11-08/affiancate/08-scheda.png)
Tutto schermo, frecce nella testata, "Salvato" corallo invece che verde, voto e prezzo sotto il nome. Ma in cima c'è ancora un'emoji su fondo teal invece del carosello di foto di Places 05, e orari e telefono non ci sono.

## Salvati: lista — 6 → 7,5
![](screenshots/2026-11-08/affiancate/09-salvati-lista.png)
Nomi interi, verdetto su due righe, "Ci sono stato" ovunque, una sola barra di ricerca, ordine nel menu, "Stasera" come pulsante distinto. Miniature ancora emoji su grigio: con le foto sarebbe vicina a Mapstr.

## Salvati: mappa — 5 → 7
![](screenshots/2026-11-08/affiancate/10-salvati-mappa.png)
Un solo campo, nome sotto i segnalini, tutti e 5 i salvati in vista (anche Bar Necci), card teal con la nota. Senza foto.

## Stasera dove andiamo? — 6 → 7,5
![](screenshots/2026-11-08/affiancate/11-stasera.png)
Stesso fondo e caratteri del resto, scelte attive in teal e solo il pulsante in corallo. Resta "Che occasione?" con la sola scelta "Qualsiasi" più una spiegazione (D46).

## Raccolte — 3,5 → 4,5
![](screenshots/2026-11-08/affiancate/12-raccolte.png)
Il numero è coerente. Ma si arriva ancora dal riquadro "Raccolte" del Profilo a metà pagina, con un riquadro grande "5 salvati senza raccolta"; `/raccolte` dà "Questa pagina non esiste". Albo 12 e Places 07: copertine in cima alla libreria.

## Importa — 6,5 → 8
![](screenshots/2026-11-08/affiancate/13-importa.png)
"Aggiungi un posto": un pulsante grande "Incolla un link", tre "Altri modi" chiari, "Ultimi aggiunti". È la schermata più vicina ad Albo 11. Dopo il salvataggio la conferma è un riquadro verde senza foto.

## Profilo — 4,5 → 7
![](screenshots/2026-11-08/affiancate/14-profilo.png)
Da cinque schermate a una. Restano "Fai la tua mappa del gusto" (doppione della home), "Ci sei stato?" in mezzo e il nome preso dall'email senza foto.

## Assistente — 5,5 → 6,5
![](screenshots/2026-11-08/affiancate/15-assistente.png)
Titolo serif, esempi con emoji per tipo, "Riparti da qui" con i propri posti, niente più "Prenota domani". Resta un terzo ingresso per la stessa ricerca, con un testo diverso ("Chiedi all'AI…" contro "Cosa cerchi?").

## Primo accesso — 7 → 8
![](screenshots/2026-11-08/affiancate/16-primo-accesso.png)
Contatore "N di 7", una domanda per schermata, chip con spunta, frase finale con parole da toccare che si correggono davvero. Le card sono ancora tipi di posto, non locali veri con foto (D60).

## Cosa farei per primo
1. **Foto** in scheda, Salvati e conferma del link (e capire perché l'8/11 metà delle foto era "sospesa"): è il salto più visibile verso Places.
2. **Mappa con i salvati all'apertura.**
3. **Raccolte in cima ai Salvati**, come copertine.
