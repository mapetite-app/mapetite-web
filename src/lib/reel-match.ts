import { cityFromAddress } from "@/lib/city";

// Salva da reel: quando il locale trovato su Google è sicuramente quello letto nel video, si salva
// da solo (il gesto è stato il Condividi); altrimenti si chiede "È questo?". Funzioni pure.
// Regola anti-errore: nel dubbio si chiede. Un salvataggio sbagliato fatto da solo costa più di un tocco.

// Parole che non distinguono un locale da un altro ("Trattoria da Enzo" ≈ "Da Enzo al 29").
const GENERIC = new Set([
  "da", "di", "del", "della", "dei", "al", "alla", "ai", "il", "la", "lo", "le", "i", "gli", "l", "e", "and", "the", "of",
  "ristorante", "trattoria", "osteria", "pizzeria", "bar", "caffe", "cafe", "enoteca", "pub", "bistrot", "bistro",
  "gelateria", "pasticceria", "sushi", "cocktail", "wine", "food", "terrazza", "rooftop", "roma", "milano", "rome", "milan",
]);

export function wordsOf(s: string): string[] {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[@#_.'’]/g, " ")
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function distinctive(s: string): string[] {
  return wordsOf(s).filter((w) => w.length > 1 && !GENERIC.has(w));
}

// Nome scritto tutto attaccato come nei profili (@trattoriadaenzo): si confronta anche senza spazi.
const squash = (s: string) => wordsOf(s).join("");
const noDigits = (ws: string[]) => ws.filter((w) => !/^\d+$/.test(w));
const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((w) => b.includes(w));

// "Roma" ↔ "Rome": Google a volte risponde in inglese.
const ALIAS: Record<string, string> = { rome: "roma", milan: "milano", naples: "napoli", florence: "firenze", venice: "venezia", turin: "torino" };
const cityKey = (c: string) => { const k = wordsOf(c).join(" "); return ALIAS[k] ?? k; };

// Tipi di locale: "Bar Basso" e "Pasticceria Basso" non sono lo stesso posto.
const KINDS = new Set(["ristorante", "trattoria", "osteria", "pizzeria", "bar", "caffe", "cafe", "enoteca", "pub", "bistrot", "bistro", "gelateria", "pasticceria", "sushi", "cocktail", "wine"]);
const kindsOf = (s: string) => wordsOf(s).filter((w) => KINDS.has(w));

/** Stesso nome: stesse parole distintive (i numeri dell'insegna non contano: "Marchesi 1824"). */
export function sameName(read: string, google: string): boolean {
  const ka = kindsOf(read);
  const kb = kindsOf(google);
  if (ka.length > 0 && kb.length > 0 && !ka.some((k) => kb.includes(k))) return false;
  const mine = noDigits(distinctive(read));
  const theirs = noDigits(distinctive(google));
  if (mine.length > 0 && sameSet([...new Set(mine)], [...new Set(theirs)])) return true;
  // @profilo tutto attaccato: solo se il nome letto è una parola sola, e uguale per intero.
  if (!/\s/.test(read.trim())) {
    const b = theirs.join("");
    return b.length >= 5 && squash(read) === b;
  }
  return false;
}

/**
 * true solo se il nome è lo stesso e la città del post è quella dell'indirizzo Google
 * (la città ricavata dall'indirizzo, non una parola qualsiasi: "Via Roma" c'è in ogni comune).
 * Senza città nel post: false, si chiede.
 */
export function confidentMatch(
  read: { nome: string; citta?: string | null },
  google: { name: string; address?: string | null },
): boolean {
  if (!read.citta || !sameName(read.nome, google.name)) return false;
  const city = cityFromAddress(google.address);
  return city != null && cityKey(city) === cityKey(read.citta);
}

// Stesso locale letto su due slide anche con accenti o maiuscole diverse ("Caffè Verdi" = "caffe verdi").
export function stessoLocale(a: string, b: string): boolean {
  const n = (x: string) => x.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return n(a) === n(b);
}
