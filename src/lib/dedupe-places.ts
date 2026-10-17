// Senza import: lo usano anche le regole di ricerca provate con node (scripts/e2e/regole-ricerca.mjs).
const metri = (lat1: number, lng1: number, lat2: number, lng2: number) => {
  const r = Math.PI / 180;
  const x = (lng2 - lng1) * r * Math.cos(((lat1 + lat2) / 2) * r);
  return Math.hypot(x, (lat2 - lat1) * r) * 6371000;
};

// Lo stesso locale registrato due volte su Google (visto a Milano: "drinc.different" e
// "drinc. Cocktail & Conversation", stesso civico): entro 30 m e con la stessa prima parola del
// nome resta una sola card, al posto della prima, con i dati della scheda più recensita.
// Prima parola "propria" del nome: si saltano le parole generiche, altrimenti "Bar Rossi" e
// "Bar Bianchi" nello stesso palazzo diventerebbero un locale solo.
const GENERICHE = new Set(["bar", "the", "caffe", "cafe", "ristorante", "trattoria", "osteria", "hostaria", "pizzeria", "enoteca", "pub", "bistrot", "antica", "antico", "da", "dal", "dai", "del", "della", "les", "los", "gli", "cocktail", "wine", "pasticceria", "gelateria", "forno", "panificio", "taverna", "locanda", "rooftop", "terrazza", "roma", "milano", "hotel", "mercato", "market", "food", "hall", "il", "la", "lo", "al", "alla", "all", "sul", "pizza", "sushi", "bistro", "gelato"]);
// Parole che dicono il tipo di locale: "Hotel X Bar" e "Hotel X Restaurant" nello stesso palazzo sono
// due locali diversi (revisione del 17/10), anche se la prima parola propria coincide.
const TIPI = new Set(["bar", "restaurant", "ristorante", "lounge", "terrace", "terrazza", "rooftop", "bistrot", "bistro", "cafe", "caffe", "pizzeria", "pasticceria", "gelateria", "enoteca", "pub", "sushi", "spa", "club", "trattoria", "osteria"]);
const words = (name: string) => name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").match(/[a-z0-9]{3,}/g) ?? [];
const tipi = (name: string) => words(name).filter((w) => TIPI.has(w)).sort().join(",");
const firstWord = (name: string) => words(name).find((w) => !GENERICHE.has(w)) ?? null;
export function dedupeSamePlace<T extends { name: string; lat: number | null; lng: number | null; userRatingCount: number | null }>(places: T[]): T[] {
  const out: T[] = [];
  for (const p of places) {
    const w = firstWord(p.name);
    const i = w == null || p.lat == null || p.lng == null ? -1 : out.findIndex((q) =>
      q.lat != null && q.lng != null && firstWord(q.name) === w && tipi(q.name) === tipi(p.name) && metri(p.lat!, p.lng!, q.lat, q.lng) <= 30);
    if (i < 0) { out.push(p); continue; }
    console.log(`[search-doppioni] "${p.name}" è lo stesso locale di "${out[i].name}"`);
    if ((p.userRatingCount ?? 0) > (out[i].userRatingCount ?? 0)) out[i] = p;
  }
  return out;
}
