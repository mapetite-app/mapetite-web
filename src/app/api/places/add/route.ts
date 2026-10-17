import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { findOrCreatePlace } from "@/lib/places-store";
import { verifyCatalogEntry } from "@/lib/catalog-sig";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  // Solo in sviluppo, per il giro automatico (scripts/e2e/giro.mjs), come /api/places/search.
  const devUser = process.env.NODE_ENV === "development" ? process.env.E2E_FAKE_USER ?? null : null;

  if (!userData?.user && !devUser) {
    return NextResponse.json({ error: "Devi accedere per aggiungere un locale." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const { googlePlaceId, name, address, lat, lng, category, rating, priceLevel } = body ?? {};

  if (
    typeof googlePlaceId !== "string" ||
    googlePlaceId.trim() === "" ||
    typeof name !== "string" ||
    name.trim() === "" ||
    typeof address !== "string" ||
    typeof lat !== "number" ||
    typeof lng !== "number" ||
    // Il catalogo `places` è condiviso: il primo che salva un locale ne scrive i dati per tutti.
    // Almeno forma e limiti plausibili (Place ID di Google, coordinate vere, testi corti).
    !/^[A-Za-z0-9_-]{10,300}$/.test(googlePlaceId) ||
    name.length > 200 ||
    address.length > 300 ||
    !Number.isFinite(lat) || lat < -90 || lat > 90 ||
    !Number.isFinite(lng) || lng < -180 || lng > 180 ||
    (category != null && (typeof category !== "string" || category.length > 80)) ||
    (rating != null && (typeof rating !== "number" || rating < 0 || rating > 5)) ||
    (priceLevel != null && (typeof priceLevel !== "number" || priceLevel < 0 || priceLevel > 4))
  ) {
    return NextResponse.json({ error: "Dati del locale non validi." }, { status: 400 });
  }

  // Firma del server (src/lib/catalog-sig.ts): se c'è ed è valida, nel catalogo vanno i dati
  // firmati da Google, non quelli del corpo. Senza firma i dati restano del telefono: il locale
  // si salva lo stesso, ma non si collega a un Place ID nuovo (vedi "fonte" in places-store).
  const signed = verifyCatalogEntry(body?.firma, googlePlaceId);
  const result = signed
    ? await findOrCreatePlace(
        {
          googlePlaceId, name: signed.name, address: signed.address, lat: signed.lat, lng: signed.lng,
          category: signed.category, rating: signed.rating, priceLevel: signed.priceLevel, userRatingCount: signed.userRatingCount,
        },
        "add/route",
        "google",
      )
    : await findOrCreatePlace({ googlePlaceId, name, address, lat, lng, category, rating, priceLevel }, "add/route", "telefono");
  if (!signed) console.log(`[add/route] firma ${body?.firma ? "non valida" : "assente"} per ${googlePlaceId}`);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result);
}
