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
  // Badge "Verificato" (migrazione 20261015_ristoratori.sql): null finché non è applicata.
  verified_at?: string | null;
  // Prezzo a testa detto dal titolare (migrazione 20261117_prezzo_medio.sql, PROPOSTE.md 65): con questo, niente € di Google.
  prezzo_min?: number | null;
  prezzo_max?: number | null;
  prezzo_bevande?: boolean | null;
};

export type PublicSynthesis = {
  verdict: string | null;
  synthesis: string | null;
  go_for: string[] | null;
  dont_expect: string[] | null;
  // Proposta 67 (migrazione 20261118b): da quante recensioni Google parla il verdetto. Assenti prima.
  recensioni_n?: number | null;
  recensione_ultima?: string | null;
};

export type PublicPlaceData = { place: PublicPlace; synthesis: PublicSynthesis | null };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PLACE_COLUMNS = "id, name, address, lat, lng, category, rating, price_level, google_place_id";
// Senza la colonna verified_at (migrazione non applicata) si rilegge senza: la pagina non si rompe.
let noVerifiedColumn = false;
let noPrezzoColumns = false;

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
  const read = (cols: string) => supabase.from("places").select(cols).eq("id", id).maybeSingle<PublicPlace>();
  let { data: place, error } = await read(noVerifiedColumn ? PLACE_COLUMNS : noPrezzoColumns ? `${PLACE_COLUMNS}, verified_at` : `${PLACE_COLUMNS}, verified_at, prezzo_min, prezzo_max, prezzo_bevande`);
  // 42703 = colonna inesistente: prima si rinuncia al prezzo del titolare (20261117_prezzo_medio.sql), poi a verified_at (20261015_ristoratori.sql).
  if (error?.code === "42703" && !noVerifiedColumn && !noPrezzoColumns) {
    noPrezzoColumns = true;
    ({ data: place, error } = await read(`${PLACE_COLUMNS}, verified_at`));
  }
  if (error?.code === "42703" && !noVerifiedColumn) {
    noVerifiedColumn = true;
    ({ data: place, error } = await read(PLACE_COLUMNS));
  }
  if (error) console.error("[locali] lettura places fallita:", error.message);
  if (!place) return null;

  let synthesis: PublicSynthesis | null = null;
  if (place.google_place_id) {
    const COLS = "verdict, synthesis, go_for, dont_expect";
    const gid = place.google_place_id;
    const leggi = (conFreschezza: boolean) => supabase
      .from("place_synthesis")
      .select((conFreschezza ? `${COLS}, recensioni_n, recensione_ultima` : COLS) as typeof COLS)
      .eq("place_id", gid)
      .maybeSingle();
    let { data: s, error: sErr } = await leggi(true);
    // 42703 = migrazione 20261118b non applicata: si rilegge senza le colonne della freschezza.
    if (sErr?.code === "42703") ({ data: s, error: sErr } = await leggi(false));
    if (sErr) console.error("[locali] lettura place_synthesis fallita:", sErr.message);
    synthesis = (s as PublicSynthesis | null) ?? null;
  }
  return { place, synthesis };
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
