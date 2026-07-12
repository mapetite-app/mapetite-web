const FIELD_MASK = "places.id,places.displayName,places.formattedAddress,places.location,places.primaryType,places.rating,places.userRatingCount,places.priceLevel,places.currentOpeningHours.openNow,places.reviews,places.editorialSummary,places.types,places.websiteUri,places.nationalPhoneNumber,places.photos";

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
  types?: string[];
  websiteUri?: string;
  editorialSummary?: { text?: string };
  reviews?: { text?: { text?: string }; rating?: number; relativePublishTimeDescription?: string }[];
  nationalPhoneNumber?: string;
  photos?: { name: string }[];
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
  types: string[] | null;
  websiteUri: string | null;
  editorialSummary: string | null;
  reviewTexts: string[] | null;   // solo i testi, max 5, già estratti
  phone: string | null;
  photoRef: string | null;   // il campo "name" della PRIMA foto, o null
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
  categories?: string[];
};

const DEFAULT_RADIUS = 1500;
const DEFAULT_LIMIT = 20;
const FETCH_MULTIPLIER = 4;

// Pavimento di qualita': sotto queste soglie un locale non entra mai nei risultati,
// indipendentemente dai filtri utente. Soglia bassa di proposito: lascia passare
// il locale "poco recensito ma buono", che l'arricchimento multi-fonte sapra' poi promuovere.
const FLOOR_RATING = 3.5;
const FLOOR_REVIEWS = 20;

const PRICE_LEVEL_MAP: Record<string, number> = {
  PRICE_LEVEL_FREE: 0,
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

const CATEGORY_TYPE_MAP: Record<string, string[]> = {
  restaurant: ["restaurant", "italian_restaurant", "fine_dining_restaurant"],
  cafe: ["cafe", "coffee_shop", "breakfast_restaurant"],
  pizza: ["pizza_restaurant"],
  sushi: ["sushi_restaurant", "japanese_restaurant"],
  pub: ["bar", "pub", "wine_bar"],
  gelato: ["ice_cream_shop", "dessert_shop"],
  bakery: ["bakery"],
  fastfood: ["fast_food_restaurant", "hamburger_restaurant"],
  vegetarian: ["vegetarian_restaurant", "vegan_restaurant"],
  seafood: ["seafood_restaurant"],
  steakhouse: ["steak_house", "barbecue_restaurant"],
  wine_bar: ["wine_bar"],
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
    categories,
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
    types: place.types ?? null,
    websiteUri: place.websiteUri ?? null,
    editorialSummary: place.editorialSummary?.text ?? null,
    reviewTexts: (() => {
      const texts = (place.reviews ?? [])
        .map((r) => r.text?.text)
        .filter((t): t is string => typeof t === "string" && t.trim().length > 0)
        .slice(0, 5);
      return texts.length > 0 ? texts : null;
    })(),
    phone: place.nationalPhoneNumber ?? null,
    photoRef: place.photos?.[0]?.name ?? null,
  }));

  const filtered = mapped.filter((p) => {
    // Pavimento di qualita': sempre attivo, prima dei filtri utente.
    if ((p.rating ?? 0) < FLOOR_RATING) return false;
    if ((p.userRatingCount ?? 0) < FLOOR_REVIEWS) return false;
    // Filtri utente: possono solo alzare l'asticella.
    if (minRating != null && (p.rating ?? 0) < minRating) return false;
    if (minReviews != null && (p.userRatingCount ?? 0) < minReviews) return false;
    if (minPriceLevel != null && (p.priceLevel ?? -1) < minPriceLevel) return false;
    if (maxPriceLevel != null && (p.priceLevel ?? 99) > maxPriceLevel) return false;
    if (openNowOnly === true && p.openNow !== true) return false;
    if (categories != null && categories.length > 0) {
      const allowedTypes = categories.flatMap((c) => CATEGORY_TYPE_MAP[c] ?? []);
      if (p.category == null || !allowedTypes.includes(p.category)) return false;
    }
    return true;
  });

  // Sort per qualita' sempre applicato: nel mondo Mapetite l'ordine e' la qualita', non la rilevanza Google.
  filtered.sort((a, b) => qualityScore(b.rating, b.userRatingCount) - qualityScore(a.rating, a.userRatingCount));

  return filtered.slice(0, limit);
}
