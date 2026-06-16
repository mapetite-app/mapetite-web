import { NextResponse } from "next/server";

const FIELD_MASK = "places.id,places.displayName,places.formattedAddress,places.location";

type GooglePlace = {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
};

type GoogleSearchTextResponse = {
  places?: GooglePlace[];
};

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const query = body?.query;

  if (typeof query !== "string" || query.trim() === "") {
    return NextResponse.json(
      { error: "Il campo 'query' è obbligatorio e deve essere una stringa non vuota." },
      { status: 400 }
    );
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GOOGLE_PLACES_API_KEY non configurata sul server." },
      { status: 500 }
    );
  }

  console.log("CHIAVE - lunghezza:", process.env.GOOGLE_PLACES_API_KEY?.length);
  console.log("CHIAVE - inizio:", process.env.GOOGLE_PLACES_API_KEY?.slice(0, 4));

  const googleResponse = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": FIELD_MASK,
    },
    body: JSON.stringify({ textQuery: query }),
  });

  if (!googleResponse.ok) {
    const errorBody = await googleResponse.text();
    console.error("Google Places error", googleResponse.status, errorBody);
    return NextResponse.json(
      { error: "Errore durante la chiamata a Google Places.", details: errorBody },
      { status: googleResponse.status }
    );
  }

  const data: GoogleSearchTextResponse = await googleResponse.json();

  const results = (data.places ?? []).map((place) => ({
    id: place.id,
    name: place.displayName?.text ?? "",
    address: place.formattedAddress ?? "",
    lat: place.location?.latitude ?? null,
    lng: place.location?.longitude ?? null,
  }));

  return NextResponse.json({ results });
}
