// Città nominata nella frase ("cocktail bar a Milano"), riconosciuta senza AI.
// Serve quando Haiku non risponde (errore, tempo scaduto, tetto AI): senza, la ricerca restava
// legata alla posizione della mappa e con la mappa su Roma "a Milano" mescolava bar di Roma
// ai risultati (visto il 14/10 con Google vero). Solo ordine e modo di cercare: nessuna chiamata in più.

// Nome come compare nella frase → nome nell'indirizzo Google in italiano ("20123 Milano MI").
const CITIES: { name: string; re: RegExp }[] = [
  { name: "Roma", re: /\broma\b/i },
  { name: "Milano", re: /\bmilano\b/i },
  { name: "Torino", re: /\btorino\b/i },
  { name: "Napoli", re: /\bnapoli\b/i },
  { name: "Firenze", re: /\bfirenze\b/i },
  { name: "Bologna", re: /\bbologna\b/i },
  { name: "Venezia", re: /\bvenezia\b/i },
  { name: "Genova", re: /\bgenova\b/i },
  { name: "Palermo", re: /\bpalermo\b/i },
  { name: "Bari", re: /\bbari\b/i },
  { name: "Verona", re: /\bverona\b/i },
];

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
