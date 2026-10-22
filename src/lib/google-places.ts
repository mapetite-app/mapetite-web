import { distanceMeters } from "@/lib/distance";
import { dedupeSamePlace } from "@/lib/dedupe-places";
import { CATEGORY_TYPE_MAP } from "@/lib/category-types";
import { refineCategory } from "@/lib/refine-category";
import { GOOGLE_ATTRIBUTES, isOpenAt, type GoogleAttribute, type WeekTime } from "@/lib/filter-options";
// Costo: la richiesta è già nella fascia più cara ("Text Search Enterprise + Atmosphere", per
// reviews ed editorialSummary) e Google fattura la fascia più alta tra i campi chiesti, una volta per
// richiesta. I campi delle caratteristiche (outdoorSeating, allowsDogs…) sono della stessa fascia
// Atmosphere; gli orari (currentOpeningHours/regularOpeningHours) della fascia Enterprise, più bassa.
// Aggiungerli non cambia il prezzo di una ricerca (verificato sul listino il 15/10/2026).
const FIELD_MASK = [
  "places.id,places.displayName,places.formattedAddress,places.location,places.primaryType,places.rating,places.userRatingCount,places.priceLevel",
  "places.currentOpeningHours.openNow,places.currentOpeningHours.periods,places.regularOpeningHours.periods",
  "places.reviews,places.editorialSummary,places.types,places.websiteUri,places.nationalPhoneNumber,places.photos",
  ...GOOGLE_ATTRIBUTES.map((a) => `places.${a}`),
].join(",");

type OpeningPeriod = { open?: { day?: number; hour?: number; minute?: number }; close?: { day?: number; hour?: number; minute?: number } };

type GooglePlace = {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  primaryType?: string;
  rating?: number;
  userRatingCount?: number;
  priceLevel?: string;
  currentOpeningHours?: { openNow?: boolean; periods?: OpeningPeriod[] };
  regularOpeningHours?: { periods?: OpeningPeriod[] };
  types?: string[];
  websiteUri?: string;
  editorialSummary?: { text?: string };
  reviews?: { text?: { text?: string }; rating?: number; relativePublishTimeDescription?: string }[];
  nationalPhoneNumber?: string;
  photos?: { name: string; authorAttributions?: { displayName?: string }[] }[];
} & Partial<Record<GoogleAttribute, boolean>>;

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
  // Le stesse recensioni con il voto (per la riga di ripiego della card: mai una stroncatura). Solo server.
  reviewItems?: { text: string; rating: number | null }[] | null;
  phone: string | null;
  photoRef: string | null;   // il campo "name" della PRIMA foto, o null
  photoAuthor?: string | null; // autore della prima foto: Google chiede di mostrarlo
  // Caratteristiche dichiarate su Google (solo quelle presenti) e orari: servono ai filtri. Solo server.
  attributes?: Partial<Record<GoogleAttribute, boolean>>;
  openingPeriods?: OpeningPeriod[] | null;
  // Orari della settimana tipo (regularOpeningHours): per il foglio Prenota. I periodi "current" coprono
  // 7 date tagliate ai bordi: ridotti a giorni della settimana davano il lunedì sera chiuso (QA 20/10).
  regularPeriods?: OpeningPeriod[] | null;
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
  // Caratteristiche richieste dai Filtri (cani ammessi, all'aperto…): fuori solo chi su Google ha false.
  requiredAttributes?: GoogleAttribute[];
  // "Aperto stasera alle 21": fuori solo chi ha orari su Google e in quel momento è chiuso.
  openAt?: WeekTime;
  // Distanza scelta dall'utente nei filtri ("entro 1 km"): Google la tratta solo come preferenza,
  // quindi i locali più lontani si tolgono dopo. Senza questo, "1 km" mostrava posti a 5-8 km.
  maxDistanceMeters?: number;
  // "quality" (default): ordina per qualityScore. "relevance": preserva l'ordine
  // di rilevanza di Google (nessun sort). Floor e filtri utente invariati in entrambi.
  sortMode?: "relevance" | "quality";
  // Tipo Google (Table A) per restringere la Text Search; vuoto = nessun vincolo.
  includedType?: string;
  // "bias" (default): preferenza di zona intorno a lat/lng. "restrict": solo
  // risultati dentro il rettangolo intorno a lat/lng. "none": nessun vincolo
  // (la zona è già nel testo della query, es. "Trastevere").
  locationMode?: "bias" | "restrict" | "none";
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

// Categorie dei Filtri → tipi Google: in src/lib/category-types.ts (servono anche ai salvati, nel telefono).

// Punteggio per le ricerche con i filtri: conta il VOTO, non la fama (VISIONE.md).
// Le recensioni servono solo a fidarsi del voto: oltre REVIEWS_ENOUGH non aggiungono nulla.
// Prima (media bayesiana senza tetto) un 4,4 con 10.000 recensioni turistiche batteva
// un 4,7 di quartiere con 180: il sistema premiava i locali di massa, contro la richiesta.
// Ora: 4,7 con 180 → 4,53; 4,4 con 10.000 → 4,30; 4,9 con 25 (poco affidabile) → 4,30.
const GLOBAL_AVG_RATING = 4.0;
const CONFIDENCE = 50;
const REVIEWS_ENOUGH = 150;
export function qualityScore(rating: number | null, count: number | null): number {
  const r = rating ?? 0;
  const n = Math.min(count ?? 0, REVIEWS_ENOUGH);
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
    requiredAttributes,
    openAt,
    maxDistanceMeters,
    sortMode = "quality",
    includedType,
    locationMode = "bias",
  } = options;

  // Risposte in italiano: riassunto editoriale e recensioni tradotti da Google
  // (prima arrivavano in inglese nella scheda). È un parametro della richiesta,
  // non un campo: FIELD_MASK e costo invariati.
  const requestBody: Record<string, unknown> = { textQuery: query, languageCode: "it" };
  if (includedType) requestBody.includedType = includedType;
  if (typeof lat === "number" && typeof lng === "number" && locationMode !== "none") {
    if (locationMode === "restrict") {
      // locationRestriction accetta solo un rettangolo: lo ricavo dal raggio.
      const dLat = radius / 111_320;
      const dLng = radius / (111_320 * Math.max(Math.cos((lat * Math.PI) / 180), 0.01));
      requestBody.locationRestriction = {
        rectangle: {
          low: { latitude: lat - dLat, longitude: lng - dLng },
          high: { latitude: lat + dLat, longitude: lng + dLng },
        },
      };
    } else {
      requestBody.locationBias = {
        circle: {
          center: { latitude: lat, longitude: lng },
          radius,
        },
      };
    }
  }

  // Solo in sviluppo con GOOGLE_FIXTURES=<cartella> (es. scripts/fixtures, esclusa da git): la stessa
  // richiesta si legge dal disco invece di richiamare Google, così le prove ripetute non consumano quota.
  const fixturePath = process.env.NODE_ENV === "development" && process.env.GOOGLE_FIXTURES
    ? `${process.env.GOOGLE_FIXTURES}/search-${(await import("node:crypto")).createHash("sha1").update(JSON.stringify(requestBody)).digest("hex").slice(0, 16)}.json`
    : null;
  const fixture = fixturePath ? await (await import("node:fs/promises")).readFile(fixturePath, "utf8").catch(() => null) : null;
  if (fixturePath) console.log(`[google-fixture] ${fixture ? "letta" : "nuova"} ${fixturePath}`);
  // GOOGLE_FIXTURES_ONLY=1: solo risposte salvate, mai Google vero (collaudi senza consumare quota).
  if (fixturePath && !fixture && process.env.GOOGLE_FIXTURES_ONLY === "1") throw new Error(`Google Places error 429: nessuna risposta salvata per questa richiesta (GOOGLE_FIXTURES_ONLY)`);

  const googleResponse = fixture ? new Response(fixture) : await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": FIELD_MASK,
    },
    body: JSON.stringify(requestBody),
    // Senza limite una risposta lenta di Google teneva la ricerca appesa fino al timeout della piattaforma.
    signal: AbortSignal.timeout(8000),
  });

  if (!googleResponse.ok) {
    const errorBody = await googleResponse.text();
    throw new Error(`Google Places error ${googleResponse.status}: ${errorBody}`);
  }

  const data: GoogleSearchTextResponse = await googleResponse.json();
  if (fixturePath && !fixture) {
    const fs = await import("node:fs/promises");
    await fs.mkdir(process.env.GOOGLE_FIXTURES!, { recursive: true });
    await fs.writeFile(fixturePath, JSON.stringify(data));
  }

  const mapped: PlaceResult[] = (data.places ?? []).map(mapGooglePlace);

  const excludedByChoice: string[] = [];
  const filtered = dedupeSamePlace(mapped).filter((p) => {
    // Pavimento di qualita': sempre attivo, prima dei filtri utente.
    if ((p.rating ?? 0) < FLOOR_RATING) return false;
    if ((p.userRatingCount ?? 0) < FLOOR_REVIEWS) return false;
    // Filtri utente: possono solo alzare l'asticella.
    if (minRating != null && (p.rating ?? 0) < minRating) return false;
    if (minReviews != null && (p.userRatingCount ?? 0) < minReviews) return false;
    // Prezzo: chi non ha la fascia su Google resta. Spesso sono proprio i locali di quartiere poco
    // recensiti: escluderli lasciava solo i posti più documentati, cioè i più famosi (VISIONE.md).
    if (minPriceLevel != null && p.priceLevel != null && p.priceLevel < minPriceLevel) return false;
    if (maxPriceLevel != null && p.priceLevel != null && p.priceLevel > maxPriceLevel) return false;
    if (openNowOnly === true && openAt == null && p.openNow !== true) return false;
    // Caratteristiche e orario scelti: nel dubbio (dato assente su Google) il locale resta.
    const noAttr = requiredAttributes?.find((a) => p.attributes?.[a] === false);
    if (noAttr) { excludedByChoice.push(`${p.name} (${noAttr}=false)`); return false; }
    if (openAt != null && isOpenAt(p.openingPeriods, openAt) === false) { excludedByChoice.push(`${p.name} (chiuso all'ora scelta)`); return false; }
    if (categories != null && categories.length > 0) {
      // Tutti i tipi del locale, non solo il principale: una pizzeria segnata "restaurant" con il
      // tipo "pizza_restaurant" tra gli altri spariva da "Pizzerie".
      const allowedTypes = categories.flatMap((c) => CATEGORY_TYPE_MAP[c] ?? []);
      const placeTypes = [p.category, ...(p.types ?? [])];
      if (!placeTypes.some((t) => t != null && allowedTypes.includes(t))) return false;
    }
    if (maxDistanceMeters != null && lat != null && lng != null && p.lat != null && p.lng != null) {
      if (distanceMeters({ lat, lng }, { lat: p.lat, lng: p.lng }) > maxDistanceMeters) return false;
    }
    return true;
  });

  if (excludedByChoice.length > 0) {
    console.log(`[search-filtri] esclusi per caratteristiche/orario scelti: ${JSON.stringify(excludedByChoice)}`);
  }

  // [search-funnel] conteggi diagnostici — SOLO lettura, nessun effetto sulla pipeline.
  // floorSurvivors ricalcola il solo pavimento (il .filter reale fonde floor + filtri utente).
  const floorSurvivors = mapped.filter(
    (p) => (p.rating ?? 0) >= FLOOR_RATING && (p.userRatingCount ?? 0) >= FLOOR_REVIEWS,
  ).length;
  // Catturati PRIMA del sort: .slice non muta, quindi non altera l'ordine reale.
  const preSortNames = filtered.slice(0, 3).map((p) => p.name);

  // Sort per qualita' SOLO in sortMode "quality" (default): nel mondo Mapetite
  // l'ordine e' la qualita', non la rilevanza Google. In "relevance" si preserva
  // l'ordine restituito da Google (utile per query dove la rilevanza semantica
  // conta piu' del rating aggregato, es. "trattoria autentica non turistica").
  if (sortMode === "quality") {
    filtered.sort((a, b) => qualityScore(b.rating, b.userRatingCount) - qualityScore(a.rating, a.userRatingCount));
  }

  const postSortNames = filtered.slice(0, 3).map((p) => p.name);
  console.log(
    `[search-funnel] sent=${JSON.stringify(query)} sortMode=${sortMode} radius=${radius} limit=${limit} ` +
      `google=${mapped.length} floor=${floorSurvivors} userFilters=${filtered.length} ` +
      `final=${Math.min(filtered.length, limit)} ` +
      `preSort=[${preSortNames.join(",")}] postSort=[${postSortNames.join(",")}]`,
  );

  return filtered.slice(0, limit);
}

function mapGooglePlace(place: GooglePlace): PlaceResult {
  return ({
    id: place.id,
    name: place.displayName?.text ?? "",
    address: place.formattedAddress ?? "",
    lat: place.location?.latitude ?? null,
    lng: place.location?.longitude ?? null,
    category: refineCategory(place.primaryType ?? null, place.types ?? null),
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
    reviewItems: (() => {
      const items = (place.reviews ?? [])
        .filter((r) => typeof r.text?.text === "string" && r.text.text.trim().length > 0)
        .slice(0, 5)
        .map((r) => ({ text: r.text!.text!, rating: typeof r.rating === "number" ? r.rating : null }));
      return items.length > 0 ? items : null;
    })(),
    phone: place.nationalPhoneNumber ?? null,
    photoRef: place.photos?.[0]?.name ?? null,
    photoAuthor: place.photos?.[0]?.authorAttributions?.[0]?.displayName ?? null,
    attributes: Object.fromEntries(
      GOOGLE_ATTRIBUTES.filter((a) => typeof place[a] === "boolean").map((a) => [a, place[a]]),
    ) as Partial<Record<GoogleAttribute, boolean>>,
    openingPeriods: place.currentOpeningHours?.periods ?? place.regularOpeningHours?.periods ?? null,
    regularPeriods: place.regularOpeningHours?.periods ?? null,
  });
}

// Scheda di un locale salvato senza verdetto (/api/places/verdetto): una Place Details con gli stessi
// dati della ricerca (recensioni comprese, quindi stessa fascia di prezzo: Enterprise + Atmosphere).
// I dati Google si mostrano e basta: si salva solo il verdetto scritto da Haiku (place_synthesis).
const DETAILS_FIELD_MASK = FIELD_MASK.split(",").map((f) => f.replace(/^places\./, "")).join(",");
export async function fetchPlaceDetails(placeId: string): Promise<PlaceResult | null> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey || !/^[A-Za-z0-9_-]{10,300}$/.test(placeId)) return null;
  const res = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?languageCode=it`, {
    headers: { "X-Goog-Api-Key": apiKey, "X-Goog-FieldMask": DETAILS_FIELD_MASK },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) {
    console.error(`[place-details] Google error ${res.status} per ${placeId}`);
    return null;
  }
  return mapGooglePlace((await res.json()) as GooglePlace);
}
