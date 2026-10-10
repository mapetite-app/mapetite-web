# Backlog Mapetite — sviluppo autonomo

Stati: PRONTA (si può fare in autonomia) · DA DECIDERE (serve una risposta di Lorenzo) · IN PR · FATTA.
L'ordine è la priorità. Lorenzo può riordinare o commentare direttamente qui o nelle PR.

## 1. Ricerca AI che resta quando chiudi e riapri il pannello — PRONTA
`aiSearch` deve sopravvivere a chiusura/riapertura del pannello; si azzera solo se l'utente cancella la ricerca o passa alla modalità filtri. Intervento su `overlayReducer` (`src/lib/panel-state.ts`) e `map-view.tsx`.
Perché prima: piccola, ben definita, serve a collaudare il ciclo notturno → PR → anteprima.

## 2. Ricerca più veloce: risultati subito, verdetti dopo — PRONTA
Oggi a cache fredda la ricerca impiega 13–22 s perché la risposta aspetta la sintesi Haiku. Obiettivo: mostrare i locali di Google appena arrivano (1–2 s) e caricare verdetti/matchReason in una seconda chiamata, con uno stato di caricamento elegante sulle card. Nessun aumento di costi.

## 3. Ricerca meno approssimativa — DA DECIDERE (servono esempi)
Servono da Lorenzo 3–5 ricerche reali che hanno dato risultati sbagliati o generici, con cosa si aspettava. Interventi possibili da valutare dopo: riscrittura della query in linguaggio naturale (zona, cucina, occasione) prima di Google; uso di `includedType` per restare nel food & beverage; esclusione catene; matchReason più specifica.

## 4. Nuova lista risultati (bottom sheet) — DA DECIDERE (direzione grafica)
Lorenzo: la lista attuale "non mi piace per niente"; la vuole più integrata e bella, collegata al pannello chat trascinabile (Block D, snap points). Proposta: 2 varianti dietro flag nella stessa PR.

## 5. Vista "salvati" ricercabile, filtrabile, raggruppata per città — DA DECIDERE (migrazione)
Richiede campo `city` su `saved_places` (migrazione Supabase + `addressComponents` nel FIELD_MASK, che può cambiare la fascia di costo). Raggruppamento per città con intestazioni richiudibili "Roma (12)", riuso di PlaceCard.

## 6. Import salvati da Google Maps per tutti gli utenti — DA DECIDERE
Upload del file Takeout dall'app (oggi esistono solo script in `scripts/`). Usa lo scoring ALTA/MEDIA/BASSA. Ogni locale importato consuma una Text Search: con la quota a 50/giorno un import da 500 locali non è fattibile in un giorno → serve decidere come gestirlo.

## 7. Backfill verdetti per i salvati senza sintesi — DA DECIDERE (costo)
Batch che genera `place_synthesis` mancanti. Costo Haiku da stimare prima.

## 8. Log delle ricerche (`search_logs`) — DA DECIDERE (migrazione, privacy)
Asset di dati comportamentali per l'argomento "data moat". Tabella nuova + attenzione privacy.

## 9. Prompt caching del system prompt Haiku — rimandata finché i volumi restano bassi

## Escluso per ora
Funzioni social (profili pubblici, follow, feed) finché non ci sono utenti reali.
