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

// Locale già nel catalogo, senza chiamare Google: per Place ID, oppure (link con nome e coordinate
// ma senza ID) per nome uguale entro ~150 m. Serve a "Incolla più link" per non spendere quota
// sui locali che qualcuno ha già salvato in Mapetite.
export async function findStoredPlace(
  q: { googlePlaceId?: string | null; name?: string | null; lat?: number | null; lng?: number | null },
): Promise<StoredPlace | null> {
  const admin = createAdminClient();
  if (q.googlePlaceId) {
    const { data } = await admin.from("places").select(COLUMNS).eq("google_place_id", q.googlePlaceId).maybeSingle();
    return (data as StoredPlace | null) ?? null;
  }
  if (!q.name || q.lat == null || q.lng == null) return null;
  const d = 0.0015; // ~150 m di latitudine
  const { data } = await admin
    .from("places")
    .select(COLUMNS)
    .gte("lat", q.lat - d).lte("lat", q.lat + d)
    .gte("lng", q.lng - d * 1.4).lte("lng", q.lng + d * 1.4)
    .limit(30);
  const want = sameName(q.name);
  return ((data ?? []) as StoredPlace[]).find((p) => sameName(p.name) === want) ?? null;
}

// Locale importato da un file (Google Takeout, KML) con nome e coordinate ma senza Place ID:
// si riusa quello già nel catalogo (stesso nome entro ~150 m), altrimenti si crea senza chiamare
// Google. Il Place ID resta vuoto: lo si aggiunge solo se in futuro arriva da Google, mai inventato.
export async function findOrCreateImportedPlace(
  input: { name: string; address: string; lat: number; lng: number },
  logTag = "import-file",
): Promise<FindOrCreateResult> {
  const known = await findStoredPlace({ name: input.name, lat: input.lat, lng: input.lng });
  if (known) return { place: known, created: false };
  const { data, error } = await createAdminClient()
    .from("places")
    .insert({ google_place_id: null, name: input.name, address: input.address || null, lat: input.lat, lng: input.lng, category: null })
    .select(COLUMNS)
    .single();
  if (error) {
    console.error(`[${logTag}] insertError:`, { message: error.message, code: error.code });
    return { error: "Errore nel salvataggio del locale.", status: 500 };
  }
  return { place: data as StoredPlace, created: true };
}

function sameName(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
