import { createAdminClient } from "@/lib/supabase/admin";

// Segnali di comportamento (VISIONE.md: il motore di raccomandazione impara da salvataggi,
// filtri e visite). Tabella `events` in supabase/migrations/20261012_create_events.sql;
// i tipi di tracciamento (sessione, pagina, funzione, errore, utile) e session_id arrivano con
// 20261015_events_tracking.sql: finché non è applicata, quelle scritture falliscono in silenzio.
export const EVENT_TYPES = [
  "ricerca", "apri_scheda", "salva", "rimuovi", "ci_sono_stato", "voglio_andarci",
  "percorso", "chiama", "sito", "condividi",
  "sessione_inizio", "pagina", "funzione", "errore", "utile",
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export type EventInput = {
  type: EventType;
  userId?: string | null;
  anonId?: string | null;
  sessionId?: string | null;
  placeId?: string | null;        // UUID Supabase
  googlePlaceId?: string | null;  // Place ID Google
  lat?: number | null;
  lng?: number | null;
  props?: Record<string, unknown>;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Posizione arrotondata a ~1 km: basta per la zona, non identifica una casa.
const round = (v: number | null | undefined) => (typeof v === "number" && Number.isFinite(v) ? Math.round(v * 100) / 100 : null);

// Cookie scritti da src/lib/track.ts: le scritture fatte dal server (es. "ricerca") restano
// legate allo stesso visitatore e alla stessa sessione anche senza accesso.
export const ANON_COOKIE = "mapetite_anon";
export const SESSION_COOKIE = "mapetite_sessione";

let missingTableWarned = false;
let newTypesWarned = false;
// Colonna session_id assente (migrazione 20261015 non ancora applicata): si scrive senza.
let noSessionColumn = false;

export async function recordEvent(e: EventInput): Promise<void> {
  if (!process.env.SUPABASE_SECRET_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) return;
  // Giro automatico (sviluppo con utente finto): niente dati di prova nel database vero.
  if (process.env.NODE_ENV === "development" && process.env.E2E_FAKE_USER) return;
  const row: Record<string, unknown> = {
    type: e.type,
    user_id: e.userId && UUID.test(e.userId) ? e.userId : null,
    anon_id: e.anonId ? e.anonId.slice(0, 40) : null,
    place_id: e.placeId && UUID.test(e.placeId) ? e.placeId : null,
    google_place_id: e.googlePlaceId ? e.googlePlaceId.slice(0, 200) : null,
    lat: round(e.lat),
    lng: round(e.lng),
    props: e.props ?? {},
  };
  if (e.sessionId && !noSessionColumn) row.session_id = e.sessionId.slice(0, 40);
  try {
    let { error } = await createAdminClient().from("events").insert(row);
    // PGRST204 = colonna sconosciuta: session_id non ancora creata, si riprova senza.
    if (error?.code === "PGRST204" && "session_id" in row) {
      noSessionColumn = true;
      delete row.session_id;
      ({ error } = await createAdminClient().from("events").insert(row));
    }
    if (error) {
      // 42P01 / PGRST205 = tabella non ancora creata (migrazione da approvare).
      if (error.code === "42P01" || error.code === "PGRST205") {
        if (!missingTableWarned) console.warn("[events] tabella events non ancora creata: segnali non registrati");
        missingTableWarned = true;
        return;
      }
      // 23514 = vincolo sul tipo: i tipi nuovi aspettano la migrazione 20261015.
      if (error.code === "23514") {
        if (!newTypesWarned) console.warn("[events] tipo non ancora ammesso dal database (migrazione 20261015 da applicare):", e.type);
        newTypesWarned = true;
        return;
      }
      console.error("[events] scrittura non riuscita:", error.code, error.message);
    }
  } catch (err) {
    console.error("[events] scrittura non riuscita:", err);
  }
}
