import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  console.log("[add/route] env check — NEXT_PUBLIC_SUPABASE_URL:", !!process.env.NEXT_PUBLIC_SUPABASE_URL, "| SUPABASE_SECRET_KEY:", !!process.env.SUPABASE_SECRET_KEY);

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData?.user) {
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
    typeof lng !== "number"
  ) {
    return NextResponse.json({ error: "Dati del locale non validi." }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: existing, error: selectError } = await admin
    .from("places")
    .select("id, name, category, address, lat, lng, google_place_id, rating, price_level")
    .eq("google_place_id", googlePlaceId)
    .maybeSingle();

  if (selectError) {
    console.error("[add/route] selectError:", {
      message: selectError.message,
      details: selectError.details,
      hint: selectError.hint,
      code: selectError.code,
    });
    return NextResponse.json({ error: "Errore nella verifica del locale." }, { status: 500 });
  }

  if (existing) {
    return NextResponse.json({ place: existing, created: false });
  }

  const { data: inserted, error: insertError } = await admin
    .from("places")
    .insert({
      google_place_id: googlePlaceId,
      name,
      address,
      lat,
      lng,
      category: category ?? null,
      rating: typeof rating === "number" ? rating : null,
      price_level: typeof priceLevel === "number" ? priceLevel : null,
    })
    .select("id, name, category, address, lat, lng, google_place_id, rating, price_level")
    .single();

  if (insertError) {
    console.error("[add/route] insertError:", {
      message: insertError.message,
      details: insertError.details,
      hint: insertError.hint,
      code: insertError.code,
    });
    return NextResponse.json({ error: "Errore nel salvataggio del locale." }, { status: 500 });
  }

  return NextResponse.json({ place: inserted, created: true });
}
