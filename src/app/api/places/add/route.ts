import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { findOrCreatePlace } from "@/lib/places-store";

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

  const result = await findOrCreatePlace(
    { googlePlaceId, name, address, lat, lng, category, rating, priceLevel },
    "add/route",
  );
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result);
}
