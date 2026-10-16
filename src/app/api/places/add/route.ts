import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { findOrCreatePlace } from "@/lib/places-store";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData?.user) {
    return NextResponse.json({ error: "Devi accedere per aggiungere un locale." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const { googlePlaceId, name, address, lat, lng, category, rating, priceLevel, userRatingCount } = body ?? {};

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

  // Numero di recensioni: serve solo a classificare "poco conosciuto" (Scopritori), non si salva.
  const reviews = typeof userRatingCount === "number" && Number.isFinite(userRatingCount) && userRatingCount >= 0 ? userRatingCount : null;
  const result = await findOrCreatePlace(
    { googlePlaceId, name, address, lat, lng, category, rating, priceLevel, userRatingCount: reviews },
    "add/route",
  );
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result);
}
