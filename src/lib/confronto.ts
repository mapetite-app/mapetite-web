// "A confronto" nella scheda del locale (richiesta di Lorenzo, 17/10): Mapetite, Google,
// Tripadvisor, Guida Michelin e TheFork in poche righe. Qui solo regole pure (nessun import),
// così il giro automatico le controlla senza server.
// Niente scraping e nessun dato inventato: Michelin e TheFork sono solo link alla ricerca
// ufficiale del sito; Tripadvisor mostra numeri solo dall'API ufficiale (src/lib/tripadvisor.ts).

export type FonteConfronto = "mapetite" | "google" | "tripadvisor" | "michelin" | "thefork";

// Tipi Google (e categorie scritte a mano) che sono ristoranti veri: Michelin e TheFork hanno
// senso solo qui. Bar, caffè, forni e gelaterie restano con Google e Tripadvisor.
const NON_RISTORANTI = new Set([
  "fast_food_restaurant",
  "dessert_restaurant",
  "breakfast_restaurant",
  "brunch_restaurant",
  "hamburger_restaurant",
]);
const RISTORANTI_EXTRA = new Set(["bistro", "steak_house", "bar_and_grill", "diner"]);
const PAROLE_RISTORANTE = /\b(ristorante|trattoria|osteria|pizzeria|bistrot|locanda)\b/i;

export function isRistorante(category: string | null | undefined): boolean {
  const c = category?.trim().toLowerCase() ?? "";
  if (!c) return false;
  if (NON_RISTORANTI.has(c)) return false;
  if (c.endsWith("_restaurant") || c === "restaurant" || RISTORANTI_EXTRA.has(c)) return true;
  return PAROLE_RISTORANTE.test(c);
}

// Il sito di Michelin non elenca pizzerie al taglio, hamburgerie o fast food: per quelli il link
// porterebbe a una ricerca vuota.
export function mostraMichelin(category: string | null | undefined): boolean {
  return isRistorante(category);
}

export function mostraTheFork(category: string | null | undefined): boolean {
  return isRistorante(category);
}

// Tripadvisor copre anche bar, caffè e gelaterie: la riga c'è per tutti i locali.
export function mostraTripadvisor(): boolean {
  return true;
}

const q = (s: string) => encodeURIComponent(s.replace(/\s+/g, " ").trim());
const conCitta = (nome: string, citta: string | null | undefined) =>
  citta && !nome.toLowerCase().includes(citta.toLowerCase()) ? `${nome} ${citta}` : nome;

/** Ricerca ufficiale di Tripadvisor (nessuna chiamata nostra: la apre il telefono). */
export function tripadvisorSearchUrl(nome: string, citta?: string | null): string {
  return `https://www.tripadvisor.it/Search?q=${q(conCitta(nome, citta))}`;
}

/** Ricerca della Guida Michelin per nome (nessuna API pubblica: solo il link). */
export function michelinSearchUrl(nome: string): string {
  return `https://guide.michelin.com/it/it/search?q=${q(nome)}`;
}

/** Ricerca di TheFork per nome e città. */
export function theforkSearchUrl(nome: string, citta?: string | null): string {
  return `https://www.thefork.it/search?queryText=${q(conCitta(nome, citta))}`;
}

/** Media dei voti Mapetite (1–5) con il numero; null se non ce ne sono. */
export function mediaVoti(voti: number[]): { media: number; n: number } | null {
  const v = voti.filter((x) => Number.isFinite(x) && x >= 1 && x <= 5);
  if (v.length === 0) return null;
  return { media: v.reduce((a, b) => a + b, 0) / v.length, n: v.length };
}

/** "4,5" come nel resto della scheda. */
export function votoIt(n: number): string {
  return n.toLocaleString("it-IT", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}
