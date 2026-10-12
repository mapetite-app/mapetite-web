import { createAdminClient } from "@/lib/supabase/admin";

// Segnali di comportamento (VISIONE.md: il motore di raccomandazione impara da salvataggi,
// filtri e visite). Tabella `events` in supabase/migrations/20261012_create_events.sql,
// DA APPROVARE: finché non esiste, ogni scrittura fallisce in silenzio (un solo avviso nei log).
export const EVENT_TYPES = [
  "ricerca", "apri_scheda", "salva", "rimuovi", "ci_sono_stato", "voglio_andarci",
  "percorso", "chiama", "sito", "condividi",
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export type EventInput = {
  type: EventType;
  userId?: string | null;
  anonId?: string | null;
  placeId?: string | null;        // UUID Supabase
  googlePlaceId?: string | null;  // Place ID Google
  lat?: number | null;
  lng?: number | null;
  props?: Record<string, unknown>;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Posizione arrotondata a ~1 km: basta per la zona, non identifica una casa.
const round = (v: number | null | undefined) => (typeof v === "number" && Number.isFinite(v) ? Math.round(v * 100) / 100 : null);

let missingTableWarned = false;

export async function recordEvent(e: EventInput): Promise<void> {
  if (!process.env.SUPABASE_SECRET_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) return;
  try {
    const { error } = await createAdminClient().from("events").insert({
      type: e.type,
      user_id: e.userId && UUID.test(e.userId) ? e.userId : null,
      anon_id: e.anonId ? e.anonId.slice(0, 40) : null,
      place_id: e.placeId && UUID.test(e.placeId) ? e.placeId : null,
      google_place_id: e.googlePlaceId ? e.googlePlaceId.slice(0, 200) : null,
      lat: round(e.lat),
      lng: round(e.lng),
      props: e.props ?? {},
    });
    if (error) {
      // 42P01 / PGRST205 = tabella non ancora creata (migrazione da approvare).
      if (error.code === "42P01" || error.code === "PGRST205") {
        if (!missingTableWarned) console.warn("[events] tabella events non ancora creata: segnali non registrati");
        missingTableWarned = true;
        return;
      }
      console.error("[events] scrittura non riuscita:", error.code, error.message);
    }
  } catch (err) {
    console.error("[events] scrittura non riuscita:", err);
  }
}
