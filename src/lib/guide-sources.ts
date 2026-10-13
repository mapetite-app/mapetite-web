// "Cosa dicono le guide": confronto tra le principali fonti del food per un locale.
//
// REGOLA: nessun voto inventato. Un voto compare solo se arriva da una fonte che
// possiamo usare legalmente. Oggi l'unica è Google (rating + userRatingCount,
// già nella risposta Places). Per tutte le altre mostriamo un link in uscita
// "Cerca su …" che apre la ricerca con nome + città: nessun dato viene letto dai
// loro siti (niente scraping, vedi LORENZO.md).
//
// Dove si attaccheranno le fonti future (solo dopo l'approvazione di Lorenzo):
// - TripAdvisor Content API (serve una chiave, servizio a pagamento oltre la
//   soglia gratuita): riempirà `rating` (scala 5), `count` e `url` della riga
//   "tripadvisor". ATTENZIONE: questi dati restano solo da mostrare, MAI passati
//   alla sintesi Haiku (contenuti TripAdvisor mai all'AI).
// - Guida Michelin: non ha API. Un elenco curato a mano (es. tabella Supabase
//   con google_place_id → stelle / Bib Gourmand / Selezionato, migrazione DA
//   APPROVARE) riempirà `badge` (es. "⭐ 1 stella", "Bib Gourmand").
// - Gambero Rosso / Puntarella Rossa: stessa logica dell'elenco curato (niente
//   scraping): `badge` o `rating` con la loro `scale`.
// Basta passare questi dati in `extra` a guideRatings(): la riga mostra il voto
// al posto del link di ricerca, senza toccare l'interfaccia.

export type GuideSource =
  | "google"
  | "tripadvisor"
  | "michelin"
  | "gamberorosso"
  | "puntarellarossa"
  | "thefork"
  | "dissapore";

export type GuideRating = {
  source: GuideSource;
  label: string; // nome mostrato ("Guida Michelin")
  mark: string; // logo testuale breve ("M"), non il marchio della fonte
  rating?: number; // voto, solo se arriva da una fonte reale
  scale?: number; // scala del voto (5 per Google)
  count?: number; // numero di recensioni
  badge?: string; // riconoscimento testuale (es. "⭐ 1 stella")
  url: string; // pagina della fonte (scheda o ricerca), link in uscita
};

export type GuideInput = {
  name: string;
  city: string | null;
  googlePlaceId?: string | null;
  rating?: number | null;
  userRatingCount?: number | null;
};

// Voti/riconoscimenti da fonti approvate, per fonte (vuoto finché Lorenzo non le approva).
export type GuideExtra = Partial<Record<GuideSource, Pick<GuideRating, "rating" | "scale" | "count" | "badge" | "url">>>;

// Rete in uscita non disponibile durante lo sviluppo: i formati delle ricerche
// interne dei siti non sono verificati. Usiamo quindi una ricerca Google
// limitata al sito ("site:"), che funziona sempre e porta alla scheda del
// locale sulla fonte. Quando un formato viene verificato si cambia solo qui.
const SITE: Record<Exclude<GuideSource, "google">, string> = {
  tripadvisor: "tripadvisor.it",
  michelin: "guide.michelin.com",
  gamberorosso: "gamberorosso.it",
  puntarellarossa: "puntarellarossa.it",
  thefork: "thefork.it",
  dissapore: "dissapore.com",
};

export function siteSearchUrl(source: Exclude<GuideSource, "google">, name: string, city: string | null): string {
  const q = `site:${SITE[source]} ${name}${city ? ` ${city}` : ""}`;
  return `https://www.google.com/search?q=${encodeURIComponent(q)}`;
}

// Stesso link della scheda: con il Place ID apre direttamente il locale su Google Maps.
export function googleMapsUrl(name: string, googlePlaceId?: string | null): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}${googlePlaceId ? `&query_place_id=${encodeURIComponent(googlePlaceId)}` : ""}`;
}

const isCity = (city: string | null, ...names: string[]) =>
  city != null && names.some((n) => city.trim().toLowerCase() === n);

export function guideRatings(input: GuideInput, extra: GuideExtra = {}): GuideRating[] {
  const { name, city } = input;
  const link = (source: Exclude<GuideSource, "google">, label: string, mark: string): GuideRating => ({
    source,
    label,
    mark,
    url: siteSearchUrl(source, name, city),
    ...extra[source],
  });

  const rows: GuideRating[] = [
    {
      source: "google",
      label: "Google",
      mark: "G",
      ...(input.rating != null ? { rating: input.rating, scale: 5 } : {}),
      ...(input.userRatingCount != null ? { count: input.userRatingCount } : {}),
      url: googleMapsUrl(name, input.googlePlaceId),
    },
    link("michelin", "Guida Michelin", "M"),
    link("tripadvisor", "TripAdvisor", "TA"),
    link("gamberorosso", "Gambero Rosso", "GR"),
  ];
  // Guide locali: solo dove hanno senso.
  if (isCity(city, "roma", "rome")) rows.push(link("puntarellarossa", "Puntarella Rossa", "PR"));
  if (isCity(city, "milano", "milan")) rows.push(link("dissapore", "Dissapore", "D"));
  rows.push(link("thefork", "TheFork", "TF"));
  return rows;
}

// "4,5" / "1.234": formati italiani.
export const formatRating = (r: number) =>
  r.toLocaleString("it-IT", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
export const formatCount = (n: number) => n.toLocaleString("it-IT");
