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

/**
 * true solo se tutte le parole distintive del nome letto sono nel nome Google (o il nome Google,
 * senza spazi, è dentro il @profilo letto) e, se il video dice la città, l'indirizzo è in quella città.
 */
export function confidentMatch(
  read: { nome: string; citta?: string | null },
  google: { name: string; address?: string | null },
): boolean {
  const mine = distinctive(read.nome);
  const theirs = new Set(distinctive(google.name));
  let nameOk = mine.length > 0 && mine.every((w) => theirs.has(w));
  if (!nameOk) {
    const a = squash(read.nome);
    const b = distinctive(google.name).join("");
    nameOk = b.length >= 5 && a.includes(b);
  }
  if (!nameOk) return false;
  if (!read.citta) return true;
  const city = wordsOf(read.citta).join(" ");
  const addr = wordsOf(google.address ?? "").join(" ");
  // "Roma" ↔ "Rome": Google a volte risponde in inglese.
  const alias: Record<string, string> = { roma: "rome", milano: "milan", napoli: "naples", firenze: "florence", venezia: "venice", torino: "turin" };
  return addr.includes(city) || (alias[city] != null && addr.includes(alias[city]));
}
