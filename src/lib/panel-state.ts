// Autorità unica sulla visibilità dei pannelli della mappa.
// Un solo overlay è attivo alla volta: qui vive la regola di esclusione
// mutua che prima era sparsa in decine di handler.
//
// Reducer puro: nessun side effect, nessun riferimento a React.

export type Overlay =
  | { kind: "none" }                    // solo mappa
  | { kind: "list" }                    // BottomSheet risultati
  | { kind: "venue"; placeId: string }  // VenueSheet
  | { kind: "filters" }                 // FiltersSheet
  | { kind: "ai" };                     // AISearchPanel espanso

export type OverlayAction =
  | { type: "OPEN_VENUE"; placeId: string }
  | { type: "OPEN_FILTERS" }
  | { type: "OPEN_AI" }
  | { type: "OPEN_LIST" }
  | { type: "CLOSE" }   // chiude l'overlay corrente: torna a "list" se ci
                        //   sono risultati, altrimenti a "none"
  | { type: "RESET" };  // torna a "none" (cambio vista, azzeramento ricerca)

// ctx.hasResults risponde a "c'è qualcosa da mostrare in lista?"
// (cioè displayedPlaces non è vuoto), non "c'è una ricerca AI attiva".
export function overlayReducer(
  state: Overlay,
  action: OverlayAction,
  ctx: { hasResults: boolean },
): Overlay {
  switch (action.type) {
    case "OPEN_VENUE":
      return { kind: "venue", placeId: action.placeId };
    case "OPEN_FILTERS":
      return { kind: "filters" };
    case "OPEN_AI":
      return { kind: "ai" };
    case "OPEN_LIST":
      return { kind: "list" };
    case "CLOSE":
      // Da venue / filters / ai si ricade sulla lista se c'è qualcosa da
      // mostrare, altrimenti sulla mappa nuda. Da list si torna alla mappa.
      if (state.kind === "venue" || state.kind === "filters" || state.kind === "ai") {
        return ctx.hasResults ? { kind: "list" } : { kind: "none" };
      }
      return { kind: "none" };
    case "RESET":
      return { kind: "none" };
    default:
      return state;
  }
}
