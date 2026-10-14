// Città nominata nella frase ("cocktail bar a Milano"), riconosciuta senza AI.
// Serve quando Haiku non risponde (errore, tempo scaduto, tetto AI): senza, la ricerca restava
// legata alla posizione della mappa e con la mappa su Roma "a Milano" mescolava bar di Roma
// ai risultati (visto il 14/10 con Google vero). Solo ordine e modo di cercare: nessuna chiamata in più.

// Nome come compare nella frase → nome nell'indirizzo Google in italiano ("20123 Milano MI").
// Coordinate del centro: servono a dire in che città è la mappa (cityNear), senza chiamate.
const CITIES: { name: string; re: RegExp; lat: number; lng: number }[] = [
  { name: "Roma", re: /\broma\b/i, lat: 41.893, lng: 12.483 },
  { name: "Milano", re: /\bmilano\b/i, lat: 45.464, lng: 9.19 },
  { name: "Torino", re: /\btorino\b/i, lat: 45.07, lng: 7.686 },
  { name: "Napoli", re: /\bnapoli\b/i, lat: 40.852, lng: 14.268 },
  { name: "Firenze", re: /\bfirenze\b/i, lat: 43.769, lng: 11.256 },
  { name: "Bologna", re: /\bbologna\b/i, lat: 44.494, lng: 11.343 },
  { name: "Venezia", re: /\bvenezia\b/i, lat: 45.438, lng: 12.327 },
  { name: "Genova", re: /\bgenova\b/i, lat: 44.407, lng: 8.934 },
  { name: "Palermo", re: /\bpalermo\b/i, lat: 38.116, lng: 13.361 },
  { name: "Bari", re: /\bbari\b/i, lat: 41.117, lng: 16.872 },
  { name: "Verona", re: /\bverona\b/i, lat: 45.438, lng: 10.992 },
];

// Città della mappa: la più vicina entro 25 km dal centro, altrimenti null.
export function cityNear(lat: number, lng: number): string | null {
  let best: string | null = null;
  let bestKm = 25;
  for (const c of CITIES) {
    const dy = (c.lat - lat) * 111.32;
    const dx = (c.lng - lng) * 111.32 * Math.cos((lat * Math.PI) / 180);
    const km = Math.hypot(dx, dy);
    if (km < bestKm) { bestKm = km; best = c.name; }
  }
  return best;
}

// "trattoria Monti" → "trattoria quartiere Monti": da solo il nome del quartiere viene preso per il
// nome di un locale (1 risultato invece di 20). "centro" diventa "zona centro". Se la parola
// davanti è già quartiere/rione/zona, o il quartiere non compare nella query, non cambia nulla.
export function withDistrict(query: string, zona: string): string {
  const i = query.toLowerCase().indexOf(zona.toLowerCase());
  if (i === -1) return query;
  const before = query.slice(0, i);
  if (/(quartiere|rione|zona)\s*$/i.test(before)) return query;
  const prefix = /^centro\b/i.test(zona) ? "zona" : "quartiere";
  return `${before}${prefix} ${query.slice(i)}`;
}

// Una sola città nominata: con due ("tra Roma e Milano") non si sceglie.
// "Cucina romana", "alla milanese" non contano: servono le parole intere.
export function namedCity(query: string): string | null {
  const found = CITIES.filter((c) => c.re.test(query));
  return found.length === 1 ? found[0].name : null;
}

// I locali con un indirizzo fuori dalla città nominata vanno in fondo, mai esclusi.
// Se sono la maggioranza forse l'indirizzo non dice la città (frazioni, comuni vicini): non si tocca nulla.
export function demoteOtherCity<T extends { name: string; address: string | null }>(
  city: string,
  places: T[],
): { places: T[]; demoted: string[] } {
  const re = CITIES.find((c) => c.name === city)?.re;
  if (!re) return { places, demoted: [] };
  const isOther = (p: T) => p.address != null && p.address !== "" && !re.test(p.address);
  const kept = places.filter((p) => !isOther(p));
  if (kept.length === places.length || kept.length < places.length / 2) return { places, demoted: [] };
  const other = places.filter(isOther);
  return { places: [...kept, ...other], demoted: other.map((p) => p.name) };
}
