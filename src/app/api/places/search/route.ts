import { NextResponse } from "next/server";
import { searchGooglePlaces } from "@/lib/google-places";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const query = body?.query;

  if (typeof query !== "string" || query.trim() === "") {
    return NextResponse.json(
      { error: "Il campo 'query' è obbligatorio e deve essere una stringa non vuota." },
      { status: 400 }
    );
  }

  try {
    const results = await searchGooglePlaces(query.trim());
    return NextResponse.json({ results });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Errore durante la chiamata a Google Places.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
