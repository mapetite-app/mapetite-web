// src/lib/enrichment.ts
// Data layer del comparatore multi-fonte (Sprint 3 Block 1).
// UN solo canale di scrittura (upsertEnrichment) + un mapper per fonte.
// place_id = Google Places id (text), coerente con place_synthesis. Nessuna FK.

import { createAdminClient } from "@/lib/supabase/admin";

export type EnrichmentSource =
  | "google"
  | "youtube"
  | "tripadvisor"
  | "michelin"
  | "gambero_rosso";

export type SourceKind = "automatic" | "editorial";

export interface EnrichmentRow {
  place_id: string;
  source: EnrichmentSource;
  source_kind: SourceKind;
  rating_value: string | null;
  rating_scale: string | null;
  ranking: string | null;
  comment: string | null;
  source_url: string | null;
  metadata: Record<string, unknown>;
}

// Sottoinsieme dei campi Google normalizzati che ci servono qui.
// Combacia con il tipo prodotto da google-places.ts (rating/userRatingCount/priceLevel).
interface GoogleEnrichmentInput {
  rating: number | null;
  userRatingCount: number | null;
  priceLevel: number | null;
  websiteUri?: string | null;
  googleMapsUri?: string | null;
}

// --- MAPPER: Google → riga enrichment -----------------------------------
// Traduce i dati Google (che abbiamo GIÀ in mano all'apertura scheda) in una
// riga enrichment. Nessuna nuova chiamata API: costo marginale zero.
export function mapGoogleToEnrichment(
  placeId: string,
  g: GoogleEnrichmentInput
): EnrichmentRow {
  return {
    place_id: placeId,
    source: "google",
    source_kind: "automatic",
    rating_value: g.rating != null ? String(g.rating) : null,
    rating_scale: "5",
    ranking: null,
    comment: null,
    source_url: g.googleMapsUri ?? g.websiteUri ?? null,
    metadata: {
      userRatingCount: g.userRatingCount ?? null,
      priceLevel: g.priceLevel ?? null,
    },
  };
}

// --- SCRITTURA: canale unico su enrichment ------------------------------
// Upsert idempotente sulla unique(place_id, source). Degrada in sicurezza:
// logga e ritorna false invece di lanciare — l'arricchimento è additivo.
export async function upsertEnrichment(row: EnrichmentRow): Promise<boolean> {
  try {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("enrichment")
      .upsert(
        { ...row, updated_at: new Date().toISOString() },
        { onConflict: "place_id,source" }
      );
    if (error) {
      console.error("[enrichment] upsert fallito:", error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[enrichment] upsert exception:", err);
    return false;
  }
}

// --- LETTURA: tutte le fonti di un locale -------------------------------
// Ordine stabile per il Block 2: google, tripadvisor, michelin, poi il resto.
const SOURCE_ORDER: Record<string, number> = {
  google: 0,
  tripadvisor: 1,
  michelin: 2,
  gambero_rosso: 3,
  youtube: 4,
};

export async function getEnrichment(placeId: string): Promise<EnrichmentRow[]> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("enrichment")
      .select("place_id,source,source_kind,rating_value,rating_scale,ranking,comment,source_url,metadata")
      .eq("place_id", placeId);
    if (error) {
      console.error("[enrichment] select fallito:", error.message);
      return [];
    }
    const rows = (data ?? []) as EnrichmentRow[];
    return rows.sort(
      (a, b) => (SOURCE_ORDER[a.source] ?? 99) - (SOURCE_ORDER[b.source] ?? 99)
    );
  } catch (err) {
    console.error("[enrichment] select exception:", err);
    return [];
  }
}
