const FIELD_MASK = "places.id,places.displayName,places.formattedAddress,places.location,places.primaryType,places.rating,places.userRatingCount,places.priceLevel,places.currentOpeningHours.openNow";

type GooglePlace = {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  primaryType?: string;
  rating?: number;
  userRatingCount?: number;
  priceLevel?: string;
  currentOpeningHours?: { openNow?: boolean };
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
  rating: number | null;
  userRatingCount: number | null;
  priceLevel: number | null;
  openNow: boolean | null;
};

export type SearchOptions = {
  lat?: number;
  lng?: number;
  radius?: number;
  limit?: number;
  minRating?: number;
  minReviews?: number;
  minPriceLevel?: number;
  maxPriceLevel?: number;
  openNowOnly?: boolean;
};

const DEFAULT_RADIUS = 1500;
const DEFAULT_LIMIT = 20;
const FETCH_MULTIPLIER = 3;

const PRICE_LEVEL_MAP: Record<string, number> = {
  PRICE_LEVEL_FREE: 0,
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

// Bayesian-style quality score: bilancia rating e numero di recensioni
// così un 4.8 con molte recensioni batte un 5.0 con pochissime.
const GLOBAL_AVG_RATING = 4.0;
const CONFIDENCE = 50;
function qualityScore(rating: number | null, count: number | null): number {
  const r = rating ?? 0;
  const n = count ?? 0;
  return (CONFIDENCE * GLOBAL_AVG_RATING + n * r) / (CONFIDENCE + n);
}

export async function searchGooglePlaces(
  query: string,
  options: SearchOptions = {},
): Promise<PlaceResult[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_PLACES_API_KEY non configurata sul server.");
  }

  const {
    lat,
    lng,
    radius = DEFAULT_RADIUS,
    limit = DEFAULT_LIMIT,
    minRating,
    minReviews,
    minPriceLevel,
    maxPriceLevel,
    openNowOnly,
  } = options;

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

  const mapped: PlaceResult[] = (data.places ?? []).map((place) => ({
    id: place.id,
    name: place.displayName?.text ?? "",
    address: place.formattedAddress ?? "",
    lat: place.location?.latitude ?? null,
    lng: place.location?.longitude ?? null,
    category: place.primaryType ?? null,
    rating: place.rating ?? null,
    userRatingCount: place.userRatingCount ?? null,
    priceLevel:
      place.priceLevel != null ? PRICE_LEVEL_MAP[place.priceLevel] ?? null : null,
    openNow: place.currentOpeningHours?.openNow ?? null,
  }));

  const filtered = mapped.filter((p) => {
    if (minRating != null && (p.rating ?? 0) < minRating) return false;
    if (minReviews != null && (p.userRatingCount ?? 0) < minReviews) return false;
    if (minPriceLevel != null && (p.priceLevel ?? -1) < minPriceLevel) return false;
    if (maxPriceLevel != null && (p.priceLevel ?? 99) > maxPriceLevel) return false;
    if (openNowOnly === true && p.openNow !== true) return false;
    return true;
  });

  const hasFilters =
    minRating != null ||
    minReviews != null ||
    minPriceLevel != null ||
    maxPriceLevel != null ||
    openNowOnly === true;

  if (hasFilters) {
    filtered.sort((a, b) => qualityScore(b.rating, b.userRatingCount) - qualityScore(a.rating, a.userRatingCount));
  }

  return filtered.slice(0, limit);
}
