// Salvati di Instagram, seconda parte (proposta 30): quali account sembrano locali dal solo nome
// ("trattoriadamario", "osteria_bella", "barmilano"). Solo regole sul nome, nel telefono: nessuna
// chiamata. È un indizio, non un fatto: il tocco "Trova" passa il nome leggibile al flusso "Salva dal
// reel", che lo cerca su Google e chiede sempre "È questo?" prima di salvare. Precisione prima del
// numero: un creator scambiato per locale costa una ricerca Google, un locale mancato resta in "Tutti".
// Niente import: si prova anche da Node (scripts/e2e/giro.mjs).

// Parole che nel nome di un account indicano un locale. Senza "pizza", "food", "cucina", "kitchen":
// sono quasi sempre creator ("pizza.lover", "lacucinadimaria").
const LOCALE = [
  "trattoria", "osteria", "hostaria", "ristorante", "ristorantino", "pizzeria", "enoteca", "vineria",
  "bistrot", "bistro", "taverna", "locanda", "braceria", "gelateria", "pasticceria", "panificio",
  "rosticceria", "friggitoria", "piadineria", "focacceria", "macelleria", "salumeria", "birreria",
  "cantina", "caffetteria", "trapizzino", "sushi", "ramen", "restaurant", "bakery", "brewery",
  "cocktailbar", "speakeasy", "pastificio", "gastronomia", "cremeria", "pub", "bar", "caffe", "cafe", "forno",
];
// Segni di creator, guide e pagine di consigli: se ci sono, non è un locale.
const CREATOR = /food|eat|mangi|magn|blog|lover|guide|guida|travel|tips|critic|review|recens|gram|hunter|addict|diar|journal|explor|secret|best|top|tour|giro|chef|influenc|consigli|insider|life|vibes|daily|official_?fan/;
const CITTA = ["roma", "milano", "napoli", "torino", "firenze", "bologna", "venezia", "genova", "palermo", "bari", "verona", "catania", "trieste", "padova", "parma", "lecce", "cagliari", "brescia", "bergamo", "pisa"];
const UNIONI = ["dalla", "della", "delle", "degli", "alla", "alle", "agli", "dal", "del", "dei", "dai", "al", "ai", "da", "di", "il", "la", "lo", "le", "de"];

const LOCALE_RE = new RegExp(LOCALE.sort((a, b) => b.length - a.length).join("|"), "g");

// La parola-locale vale se è all'inizio o alla fine di un pezzo del nome (separati da . _ -), o è un pezzo
// intero: "barmilano" sì, "barbara" no ("bar" seguito da poco), "sushibar" sì.
function haParolaLocale(pezzo: string): boolean {
  for (const m of pezzo.matchAll(LOCALE_RE)) {
    const w = m[0];
    const i = m.index ?? 0;
    const prima = pezzo.slice(0, i);
    const dopo = pezzo.slice(i + w.length);
    // Parole corte ("bar", "pub", "sushi", "forno"): solo a inizio pezzo seguite da un nome ("barmilano",
    // "sushizen"; non "barbara", "pubblico"), o a fine pezzo ("sushibar").
    if (w.length <= 5) {
      if (pezzo === w) return true;
      if (i === 0 && dopo.length >= (w.length <= 3 ? 4 : 3) && !/^[aeioub]/.test(dopo)) return true;
      if (dopo === "" && prima.length >= 3) return true;
      continue;
    }
    return true;
  }
  return false;
}

export function sembraLocale(autore: string | null | undefined): boolean {
  if (!autore) return false;
  const h = autore.toLowerCase().replace(/^@/, "");
  if (h.length < 3 || CREATOR.test(h)) return false;
  return h.split(/[._-]+/).filter(Boolean).some(haParolaLocale);
}

// "trattoriadamario" → "Trattoria da Mario"; "sushizen.roma" → "Sushi Zen Roma". Solo spazi e maiuscole:
// l'AI della lettura lo ripulisce ancora, e Google decide se il locale esiste.
export function nomeDaAccount(autore: string): string {
  const h = autore.toLowerCase().replace(/^@/, "");
  const parole: string[] = [];
  for (const pezzo of h.split(/[._-]+/).filter(Boolean)) {
    let resto = pezzo.replace(LOCALE_RE, (w) => ` ${w} `);
    for (const c of CITTA) resto = resto.replace(new RegExp(`(\\S{3,})${c}$`), `$1 ${c}`);
    for (const w of resto.split(/\s+/).filter(Boolean)) {
      const u = UNIONI.find((x) => w.startsWith(x) && w.length - x.length >= 3);
      if (u && parole.length > 0 && LOCALE.includes(parole[parole.length - 1])) parole.push(u, w.slice(u.length));
      else parole.push(w);
    }
  }
  return parole
    .map((w, i) => (i > 0 && UNIONI.includes(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ")
    .replace(/\bCaffe\b/, "Caffè");
}

// La città dal nome dell'account o dalla raccolta ("Roma food"), per una ricerca Google più precisa.
export function cittaDa(...testi: (string | null | undefined)[]): string | null {
  for (const t of testi) {
    if (!t) continue;
    const s = t.toLowerCase();
    const c = CITTA.find((x) => new RegExp(`(^|[^a-z])${x}([^a-z]|$)`).test(s) || new RegExp(`[a-z]{3,}${x}$`).test(s.replace(/[._-]+/g, "")));
    if (c) return c.charAt(0).toUpperCase() + c.slice(1);
  }
  return null;
}

// Il testo che "Trova" passa a "Salva dal reel": nome leggibile e città, se c'è.
export function indizioLocale(autore: string, raccolte: string[]): string {
  const nome = nomeDaAccount(autore);
  const citta = cittaDa(autore, ...raccolte);
  return citta && !nome.toLowerCase().includes(citta.toLowerCase()) ? `${nome}, ${citta}` : nome;
}
