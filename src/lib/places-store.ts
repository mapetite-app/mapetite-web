import { createAdminClient } from "@/lib/supabase/admin";
import { isGem } from "@/lib/gem";

// Unico punto in cui si crea (o si ritrova) un locale nella tabella "places",
// usato da /api/places/add, from-link, link-preview e import-file. Chiave: Google Place ID.
//
// Il catalogo è condiviso: il primo che salva un locale ne scrive i dati per tutti. Per questo
// ogni scrittura dichiara da dove arrivano i dati ("fonte"):
//  - "google":   dati usciti da Google sul server (risultato di ricerca firmato, Place Details).
//                Crea il locale e, se era già nel catalogo, ne corregge i dati con quelli veri.
//  - "link":     Place ID scelto da Google, ma nome e posizione letti dal link incollato
//                (il caso normale di "Condividi → Copia link", che costa solo un "IDs Only").
//                Crea il locale ma non tocca mai uno già esistente.
//  - "telefono": tutto deciso dal telefono (corpo non firmato, file di Takeout, Place ID scritto
//                nel link). Mai collegato a un Place ID nuovo: se il locale non c'è, entra nel
//                catalogo SENZA Place ID (come i posti importati senza ID), così nessuno può dare
//                un nome falso al locale vero che poi vedrebbero tutti.
export type Fonte = "google" | "link" | "telefono";

export type NewPlace = {
  googlePlaceId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  category?: string | null;
  rating?: number | null;
  priceLevel?: number | null;
  // Solo per calcolare "poco conosciuto" (Scopritori, piano 5.6): il numero NON si salva.
  userRatingCount?: number | null;
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

export async function findOrCreatePlace(input: NewPlace, logTag: string, fonte: Fonte): Promise<FindOrCreateResult> {
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

  if (existing) {
    // Niente aggiornamento di "poco conosciuto" da un locale già in catalogo (17/10): il badge
    // si decide solo alla creazione.
    if (fonte === "google") return { place: await healPlace(existing as StoredPlace, input, logTag), created: false };
    return { place: existing as StoredPlace, created: false };
  }

  if (fonte === "telefono") {
    console.log(`[${logTag}] dati non verificati per ${input.googlePlaceId}: entra nel catalogo senza Place ID`);
    return findOrCreateImportedPlace({ name: input.name, address: input.address, lat: input.lat, lng: input.lng }, logTag);
  }

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

  // Il numero di recensioni conta solo se viene da Google (firma): mai dal telefono.
  if (fonte === "google") await markPocoConosciuto((inserted as StoredPlace).id, input);
  return { place: inserted as StoredPlace, created: true };
}

// Locale già nel catalogo e dati appena arrivati da Google: se nome, indirizzo, posizione, tipo,
// voto o prezzo sono diversi (es. scritti da un link, o cambiati su Google) si correggono.
// I campi che Google non ha dato restano come sono. Mai sui locali verificati da un ristoratore
// (verified_at): lì decide lui. Senza la colonna verified_at l'aggiornamento fallisce in silenzio.
async function healPlace(p: StoredPlace, input: NewPlace, logTag: string): Promise<StoredPlace> {
  const fix: Partial<Record<"name" | "address" | "lat" | "lng" | "category" | "rating" | "price_level", string | number>> = {};
  if (input.name && input.name !== p.name) fix.name = input.name;
  if (input.address && input.address !== p.address) fix.address = input.address;
  if (input.lat !== p.lat) fix.lat = input.lat;
  if (input.lng !== p.lng) fix.lng = input.lng;
  if (input.category && input.category !== p.category) fix.category = input.category;
  if (typeof input.rating === "number" && (p.rating == null || Number(p.rating) !== input.rating)) fix.rating = input.rating;
  if (typeof input.priceLevel === "number" && p.price_level !== input.priceLevel) fix.price_level = input.priceLevel;
  if (Object.keys(fix).length === 0) return p;
  try {
    const { data, error } = await createAdminClient()
      .from("places")
      .update(fix)
      .eq("id", p.id)
      .is("verified_at", null)
      .select(COLUMNS)
      .maybeSingle();
    if (error) {
      if (error.code !== "42703") console.error(`[${logTag}] correzione dati:`, error.message);
      return p;
    }
    if (data && ("name" in fix || "address" in fix || "lat" in fix || "lng" in fix)) {
      console.log(`[${logTag}] catalogo corretto con i dati Google per ${input.googlePlaceId}:`, Object.keys(fix).join(","));
    }
    return (data as StoredPlace | null) ?? p;
  } catch {
    return p;
  }
}

// Scopritori (piano 5.6): si salva solo la NOSTRA classificazione sì/no (regola del badge
// "💎 Poco conosciuto"), mai il numero di recensioni di Google. Serve la migrazione
// 20261016_scopritori.sql: senza la colonna l'aggiornamento fallisce in silenzio e il
// salvataggio resta identico. Solo alla creazione del locale.
async function markPocoConosciuto(id: string, input: NewPlace): Promise<void> {
  if (typeof input.rating !== "number" || typeof input.userRatingCount !== "number") return;
  try {
    const { error } = await createAdminClient()
      .from("places")
      .update({ poco_conosciuto: isGem(input.rating, input.userRatingCount, input.name) })
      .eq("id", id);
    if (error && error.code !== "42703" && error.code !== "PGRST204") console.error("[places-store] poco_conosciuto:", error.message);
  } catch {
    // mai bloccare un salvataggio per il gioco degli Scopritori
  }
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
