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
const CREATOR = /food|eat|mangi|magn|blog|lover|guide|guida|travel|tips|critic|review|recens|gram|hunter|addict|diar|journal|explor|secret|best|top|tour|giro|chef|influenc|consigli|insider|life|vibes|daily|fan|magazine|news|mania|guru|week|quiz|band|trip|masterclass|academy|school|scuola|corso|award|festival|club|lab|media|tv|radio|channel/;
// Città (anche in inglese: "drinkkong_rome") → come si scrive in italiano.
const CITTA: Record<string, string> = {
  roma: "Roma", rome: "Roma", milano: "Milano", milan: "Milano", napoli: "Napoli", naples: "Napoli", torino: "Torino", turin: "Torino",
  firenze: "Firenze", florence: "Firenze", bologna: "Bologna", venezia: "Venezia", venice: "Venezia", genova: "Genova", palermo: "Palermo",
  bari: "Bari", verona: "Verona", catania: "Catania", trieste: "Trieste", padova: "Padova", parma: "Parma", lecce: "Lecce",
  cagliari: "Cagliari", brescia: "Brescia", bergamo: "Bergamo", pisa: "Pisa",
};
const NOMI_CITTA = Object.keys(CITTA).sort((a, b) => b.length - a.length);
const UNIONI = ["dalla", "della", "delle", "degli", "alla", "alle", "agli", "dal", "del", "dei", "dai", "al", "ai", "da", "di", "il", "la", "lo", "le", "de"];

const LOCALE_RE = new RegExp(LOCALE.sort((a, b) => b.length - a.length).join("|"), "g");
// "bar", "pub", "cafe" stanno dentro troppi nomi ("enrico_bartolini", "bargello", "pubblico"): valgono solo da
// soli ("bar_basso"), a fine pezzo ("sushibar") o seguiti da una città ("barmilano").
const CORTE = new Set(["bar", "pub", "cafe"]);

// Le parole-locale di un pezzo del nome (separati da . _ -) nella posizione in cui contano davvero.
function paroleLocale(pezzo: string): { w: string; i: number }[] {
  const out: { w: string; i: number }[] = [];
  for (const m of pezzo.matchAll(LOCALE_RE)) {
    const w = m[0];
    const i = m.index ?? 0;
    const prima = pezzo.slice(0, i);
    const dopo = pezzo.slice(i + w.length);
    if (dopo === "s") continue; // plurale inglese: "restaurants", "bars" (guide e liste)
    let vale: boolean;
    if (pezzo === w) vale = true;
    else if (CORTE.has(w)) vale = (dopo === "" && prima.length >= 3) || (i === 0 && NOMI_CITTA.includes(dopo));
    else if (w.length <= 5) vale = (dopo === "" && prima.length >= 3) || (i === 0 && dopo.length >= 3 && !/^[aeioub]/.test(dopo));
    else vale = true;
    if (vale) out.push({ w, i });
  }
  return out;
}

export function sembraLocale(autore: string | null | undefined): boolean {
  if (!autore) return false;
  const h = autore.toLowerCase().replace(/^@/, "");
  if (h.length < 3 || CREATOR.test(h)) return false;
  return h.split(/[._-]+/).filter(Boolean).some((p) => paroleLocale(p).length > 0);
}

// "trattoriadamario" → "Trattoria da Mario"; "sushizen.roma" → "Sushi Zen Roma". Solo spazi e maiuscole:
// l'AI della lettura lo ripulisce ancora, e Google decide se il locale esiste.
export function nomeDaAccount(autore: string): string {
  const h = autore.toLowerCase().replace(/^@/, "");
  const parole: string[] = [];
  for (const pezzo of h.split(/[._-]+/).filter(Boolean)) {
    let resto = pezzo;
    for (const { w, i } of paroleLocale(pezzo).reverse()) resto = `${resto.slice(0, i)} ${w} ${resto.slice(i + w.length)}`;
    for (const c of NOMI_CITTA) resto = resto.replace(new RegExp(`(\\S{3,})${c}$`), `$1 ${c}`);
    for (const w of resto.split(/\s+/).filter(Boolean)) {
      const u = UNIONI.includes(w) ? undefined : UNIONI.find((x) => w.startsWith(x) && w.length - x.length >= 3);
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
    const c = NOMI_CITTA.find((x) => new RegExp(`(^|[^a-z])${x}([^a-z]|$)`).test(s) || new RegExp(`[a-z]{3,}${x}$`).test(s.replace(/[._-]+/g, "")));
    if (c) return CITTA[c];
  }
  return null;
}

// Il testo che "Trova" passa a "Salva dal reel": nome leggibile e città, se c'è.
export function indizioLocale(autore: string, raccolte: string[]): string {
  const nome = nomeDaAccount(autore);
  const citta = cittaDa(autore, ...raccolte);
  const conCitta = citta && !NOMI_CITTA.some((c) => CITTA[c] === citta && new RegExp(`\\b${c}\\b`, "i").test(nome));
  return conCitta ? `${nome}, ${citta}` : nome;
}
