import { createAdminClient } from "@/lib/supabase/admin";

// Unico punto in cui si crea (o si ritrova) un locale nella tabella "places",
// usato da /api/places/add e /api/places/from-link. Chiave: Google Place ID.

export type NewPlace = {
  googlePlaceId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  category?: string | null;
  rating?: number | null;
  priceLevel?: number | null;
};

const COLUMNS = "id, name, category, address, lat, lng, google_place_id, rating, price_level";

export type StoredPlace = {
  id: string;
  name: string;
  category: string | null;
  address: string | null;
  lat: number;
  lng: number;
  google_place_id: string;
  rating: number | null;
  price_level: number | null;
};

export type FindOrCreateResult =
  | { place: StoredPlace; created: boolean }
  | { error: string; status: number };

export async function findOrCreatePlace(input: NewPlace, logTag = "places-store"): Promise<FindOrCreateResult> {
  const admin = createAdminClient();

  const { data: existing, error: selectError } = await admin
    .from("places")
    .select(COLUMNS)
    .eq("google_place_id", input.googlePlaceId)
    .maybeSingle();

  if (selectError) {
    console.error(`[${logTag}] selectError:`, {
      message: selectError.message,
      details: selectError.details,
      hint: selectError.hint,
      code: selectError.code,
    });
    return { error: "Errore nella verifica del locale.", status: 500 };
  }

  if (existing) return { place: existing as StoredPlace, created: false };

  const { data: inserted, error: insertError } = await admin
    .from("places")
    .insert({
      google_place_id: input.googlePlaceId,
      name: input.name,
      address: input.address,
      lat: input.lat,
      lng: input.lng,
      category: input.category ?? null,
      rating: typeof input.rating === "number" ? input.rating : null,
      price_level: typeof input.priceLevel === "number" ? input.priceLevel : null,
    })
    .select(COLUMNS)
    .single();

  if (insertError) {
    console.error(`[${logTag}] insertError:`, {
      message: insertError.message,
      details: insertError.details,
      hint: insertError.hint,
      code: insertError.code,
    });
    return { error: "Errore nel salvataggio del locale.", status: 500 };
  }

  return { place: inserted as StoredPlace, created: true };
}
