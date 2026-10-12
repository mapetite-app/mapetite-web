import { cache } from "react";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

// Pagina pubblica di un locale (link condiviso da "Condividi" nella scheda).
// Si leggono SOLO campi pubblici: il locale (tabella places, lettura pubblica)
// e il verdetto già in cache (place_synthesis, lettura pubblica). Nessun dato
// degli utenti (salvati, note, recensioni) e nessun testo nuovo generato qui.

export type PublicPlace = {
  id: string;
  name: string;
  address: string | null;
  lat: number;
  lng: number;
  category: string | null;
  rating: number | null;
  price_level: number | null;
  google_place_id: string | null;
};

export type PublicSynthesis = {
  verdict: string | null;
  synthesis: string | null;
  go_for: string[] | null;
  dont_expect: string[] | null;
};

export type PublicPlaceData = { place: PublicPlace; synthesis: PublicSynthesis | null };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PLACE_COLUMNS = "id, name, address, lat, lng, category, rating, price_level, google_place_id";

const dev = () => process.env.NODE_ENV === "development" && !!process.env.E2E_FAKE_USER;

// Solo in sviluppo con E2E_FAKE_USER: locale finto dal cookie "e2e_locale"
// (scritto da scripts/e2e/giro.mjs), perché il test non può simulare le letture del server.
// In produzione NODE_ENV è sempre "production" e questo ramo non si attiva.
async function e2ePlace(id: string): Promise<PublicPlaceData | null> {
  if (!dev()) return null;
  const raw = (await cookies()).get("e2e_locale")?.value;
  if (!raw) return null;
  try {
    const data = JSON.parse(decodeURIComponent(raw)) as PublicPlaceData;
    return data?.place?.id === id ? { place: data.place, synthesis: data.synthesis ?? null } : null;
  } catch {
    return null;
  }
}

// Utente collegato (per "Salva in Mapetite"). In sviluppo con E2E_FAKE_USER l'utente finto,
// o nessuno se c'è il cookie "e2e_anonimo", come in /stasera.
export async function currentUserId(): Promise<string | null> {
  if (dev()) {
    return (await cookies()).get("e2e_anonimo") ? null : process.env.E2E_FAKE_USER!;
  }
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data?.user?.id ?? null;
}

// Memorizzata per richiesta: pagina, metadati e immagine di anteprima leggono una volta sola.
export const loadPublicPlace = cache(async (id: string): Promise<PublicPlaceData | null> => {
  if (!UUID_RE.test(id)) return null;
  const fake = await e2ePlace(id);
  if (fake) return fake;

  const supabase = await createClient();
  const { data: place, error } = await supabase
    .from("places")
    .select(PLACE_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) console.error("[locali] lettura places fallita:", error.message);
  if (!place) return null;

  let synthesis: PublicSynthesis | null = null;
  if (place.google_place_id) {
    const { data: s, error: sErr } = await supabase
      .from("place_synthesis")
      .select("verdict, synthesis, go_for, dont_expect")
      .eq("place_id", place.google_place_id)
      .maybeSingle();
    if (sErr) console.error("[locali] lettura place_synthesis fallita:", sErr.message);
    synthesis = (s as PublicSynthesis | null) ?? null;
  }
  return { place: place as PublicPlace, synthesis };
});

// Foto: il riferimento Google viaggia nel link condiviso (?foto=places/<id>/photos/<ref>).
// Si accetta solo se appartiene a QUESTO locale; poi passa dal proxy in cache /api/places/photo.
const REF_PATTERN = /^places\/[A-Za-z0-9_-]+\/photos\/[A-Za-z0-9_-]+$/;
export function validPhotoRef(ref: string | undefined, googlePlaceId: string | null): string | null {
  if (!ref || !googlePlaceId || ref.length > 600 || !REF_PATTERN.test(ref)) return null;
  return ref.startsWith(`places/${googlePlaceId}/photos/`) ? ref : null;
}

export function priceLabel(level: number | null): string | null {
  return level != null && level > 0 ? "€".repeat(level) : null;
}

export function ratingLabel(rating: number | null): string | null {
  return rating != null
    ? `★ ${rating.toLocaleString("it-IT", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`
    : null;
}

export function cleanList(list: string[] | null | undefined): string[] {
  return Array.isArray(list) ? list.filter((c) => typeof c === "string" && c.trim() !== "").map((c) => c.trim()) : [];
}
