const FIELD_MASK = "places.id,places.displayName,places.formattedAddress,places.location,places.primaryType";

type GooglePlace = {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  primaryType?: string;
};

type GoogleSearchTextResponse = {
  places?: GooglePlace[];
};

export type PlaceResult = {
  id: string;
  name: string;
  address: string;
  lat: number | null;
  lng: number | null;
  category: string | null;
};

export type SearchOptions = {
  lat?: number;
  lng?: number;
  radius?: number;
  limit?: number;
};

const DEFAULT_RADIUS = 1500;
const DEFAULT_LIMIT = 20;

export async function searchGooglePlaces(
  query: string,
  options: SearchOptions = {},
): Promise<PlaceResult[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_PLACES_API_KEY non configurata sul server.");
  }

  const { lat, lng, radius = DEFAULT_RADIUS, limit = DEFAULT_LIMIT } = options;

  const requestBody: Record<string, unknown> = { textQuery: query };
  if (typeof lat === "number" && typeof lng === "number") {
    requestBody.locationBias = {
      circle: {
        center: { latitude: lat, longitude: lng },
        radius,
      },
    };
  }

  const googleResponse = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": FIELD_MASK,
    },
    body: JSON.stringify(requestBody),
  });

  if (!googleResponse.ok) {
    const errorBody = await googleResponse.text();
    throw new Error(`Google Places error ${googleResponse.status}: ${errorBody}`);
  }

  const data: GoogleSearchTextResponse = await googleResponse.json();

  return (data.places ?? [])
    .slice(0, limit)
    .map((place) => ({
      id: place.id,
      name: place.displayName?.text ?? "",
      address: place.formattedAddress ?? "",
      lat: place.location?.latitude ?? null,
      lng: place.location?.longitude ?? null,
      category: place.primaryType ?? null,
    }));
}
