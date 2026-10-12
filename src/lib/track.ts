"use client";

// Invia un segnale di comportamento a /api/events senza mai disturbare l'utente:
// nessuna attesa, nessun errore mostrato. Vedi src/lib/events.ts.
type TrackType = "apri_scheda" | "salva" | "rimuovi" | "ci_sono_stato" | "voglio_andarci" | "percorso" | "chiama" | "sito" | "condividi";

const ANON_KEY = "mapetite.anon";
function anonId(): string | null {
  try {
    let id = window.localStorage.getItem(ANON_KEY);
    if (!id) {
      id = crypto.randomUUID();
      window.localStorage.setItem(ANON_KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function track(
  type: TrackType,
  place?: { id: string; lat?: number; lng?: number } | null,
  props?: Record<string, string | number>,
): void {
  try {
    const id = place?.id ?? null;
    void fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        type,
        anonId: anonId(),
        placeId: id && UUID.test(id) ? id : null,
        googlePlaceId: id && !UUID.test(id) ? id : null,
        lat: place?.lat ?? null,
        lng: place?.lng ?? null,
        props: props ?? {},
      }),
    }).catch(() => {});
  } catch {
    // mai bloccare l'interfaccia per un segnale
  }
}
