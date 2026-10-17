// Ricerca nei salvati in linguaggio naturale (voce 4.5): "quel giapponese che avevo salvato a
// Milano", "il bar dove sono stato a Monti", "sushi da provare". Tutto nel telefono, sui dati già
// caricati: nessuna chiamata Google né AI, risposta immediata.
// Ogni parola che conta deve ritrovarsi nel locale (nome, tipo, indirizzo, nota, tag); le parole di
// contorno ("quel", "avevo", "salvato") si ignorano; i tipi di cucina hanno i loro sinonimi.

// Parole di contorno: non dicono niente sul locale.
const CONTORNO = new Set([
  "quel", "quello", "quella", "quelli", "quelle", "che", "chi", "cui", "dove", "come", "quando",
  "avevo", "avevi", "aveva", "ho", "hai", "ha", "abbiamo", "era", "erano", "è", "sono", "siamo", "stato", "stata", "stati",
  "salvato", "salvata", "salvati", "salvate", "salvo", "messo", "segnato", "visto", "vista",
  "posto", "posti", "locale", "locali", "il", "lo", "la", "i", "gli", "le", "l", "un", "una", "uno", "un'",
  "a", "ad", "in", "di", "da", "del", "della", "dello", "dei", "delle", "al", "alla", "allo", "ai", "alle", "nel", "nella", "nei",
  "per", "con", "su", "sul", "sulla", "tra", "fra", "e", "o", "mi", "ti", "ci", "si", "me", "mio", "mia", "miei", "mie",
  "zona", "vicino", "verso", "tipo", "cerco", "trova", "trovami", "dammi", "voglio", "volevo", "quelo",
  "buono", "buona", "buoni", "bello", "bella", "belli", "carino", "carina", "ottimo", "ottima", "famoso", "famosa",
]);

// Stato del salvato: "provato", "ci sono stato" → Già visitato; "da provare" → Da provare.
const VISITATO = /\b(?:provat[oaie]|visitat[oaie]|andat[oaie]|ci\s+sono\s+stat[oaie]|ci\s+siamo\s+stat[ie]|già\s+fatto)\b/i;
const DA_PROVARE = /\b(?:da\s+provare|voglio\s+andarci|volevo\s+(?:provare|andarci|andare)|non\s+(?:ci\s+)?sono\s+(?:ancora\s+)?stat[oaie]|mai\s+provat[oaie])\b/i;

// Parola dell'utente → frammenti che possono comparire nel tipo Google, nell'etichetta o nel nome.
const SINONIMI: Record<string, string[]> = {
  giapponese: ["giappon", "japanese", "sushi", "ramen"],
  sushi: ["sushi", "japanese", "giappon"],
  ramen: ["ramen", "japanese", "giappon"],
  cinese: ["cines", "chinese"],
  indiano: ["indian"],
  thai: ["thai", "thailand"],
  thailandese: ["thai", "thailand"],
  messicano: ["messican", "mexican"],
  greco: ["grec", "greek"],
  spagnolo: ["spagnol", "spanish", "tapas"],
  francese: ["frances", "french", "bistro"],
  pizza: ["pizz"],
  pizzeria: ["pizz"],
  pesce: ["pesce", "seafood", "fish", "mare"],
  carne: ["steak", "carne", "griglia", "grill", "braceria"],
  hamburger: ["hamburger", "burger"],
  burger: ["hamburger", "burger"],
  panino: ["panin", "sandwich"],
  panini: ["panin", "sandwich"],
  vegano: ["vegan"],
  vegetariano: ["vegetarian", "vegan"],
  cocktail: ["cocktail", "lounge", "speakeasy"],
  aperitivo: ["cocktail", "wine_bar", "wine bar", "bar", "enoteca", "aperitiv"],
  vino: ["wine", "enoteca", "vino", "vineria"],
  enoteca: ["wine", "enoteca", "vineria"],
  birra: ["pub", "birr", "brew", "beer"],
  pub: ["pub", "birr"],
  caffè: ["cafe", "caff", "coffee", "bar"],
  caffe: ["cafe", "caff", "coffee", "bar"],
  colazione: ["cafe", "caff", "coffee", "bakery", "pasticc", "breakfast", "colazion", "cornett"],
  brunch: ["brunch", "breakfast"],
  dolci: ["pasticc", "dessert", "bakery", "dolc", "pastry"],
  pasticceria: ["pasticc", "bakery", "pastry"],
  gelato: ["gelat", "ice_cream", "ice cream"],
  gelateria: ["gelat", "ice_cream", "ice cream"],
  trattoria: ["trattoria", "osteria", "hostaria", "italian_restaurant", "ristorante italiano"],
  osteria: ["osteria", "hostaria", "trattoria", "italian_restaurant", "ristorante italiano"],
  ristorante: ["restaurant", "ristorant", "trattoria", "osteria"],
  romantico: ["romantic"],
  rooftop: ["rooftop", "terrazz", "roof"],
  terrazza: ["terrazz", "rooftop", "roof"],
};

const norm = (s: string) => s.toLocaleLowerCase("it").normalize("NFD").replace(/[̀-ͯ]/g, "");

export type FiltroSalvati = { parole: string[][]; stato: "Già visitato" | "Da provare" | null };

// Capisce la frase una volta: per ogni parola che conta, i frammenti di cui basta trovarne uno.
export function capisciRicercaSalvati(query: string): FiltroSalvati {
  const q = query.toLocaleLowerCase("it");
  const stato = DA_PROVARE.test(q) ? "Da provare" : VISITATO.test(q) ? "Già visitato" : null;
  const senzaStato = q.replace(DA_PROVARE, " ").replace(VISITATO, " ");
  const parole = senzaStato
    .split(/[^\p{L}\p{N}']+/u)
    .map((w) => w.replace(/^[a-z]+'/, "")) // "all'aperto" → "aperto", "l'osteria" → "osteria"
    .filter((w) => w.length >= 2 && !CONTORNO.has(w))
    .map((w) => {
      const syn = SINONIMI[w] ?? SINONIMI[norm(w)];
      // Senza sinonimi: la radice basta ("romani" trova "romana", "giapponesi" trova "giapponese").
      const radice = norm(w).length > 4 ? norm(w).slice(0, -1) : norm(w);
      // "~" = radice: vale solo come parola intera, al più con 2 lettere in più ("mont" trova
      // "Monti" ma non "Monteverde"). "!" = parola di tipo o cucina: se non c'è, niente risultati.
      return syn ? ["!", ...syn.map(norm), `~${radice}`] : [`~${radice}`];
    });
  return { parole, stato };
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// Revisione del 17/10: "pub" trovava "Piazza della Repubblica", "bar" trovava "Barberini".
// I frammenti valgono solo a inizio parola, quelli di 3 lettere o meno solo come parola intera.
function trova(t: string, a: string): boolean {
  if (a === "!") return false;
  if (a.startsWith("~")) return new RegExp(`(?:^|[^a-z0-9])${esc(a.slice(1))}[a-z]{0,2}(?![a-z0-9])`).test(t);
  return new RegExp(`(?:^|[^a-z0-9])${esc(a)}${a.length <= 3 ? "(?![a-z0-9])" : ""}`).test(t);
}

// testo = tutto quello che si sa del locale (nome, tipo ed etichetta, indirizzo, nota, tag).
export function corrispondeSalvato(f: FiltroSalvati, testo: string, tags: string[] | null): boolean {
  if (f.stato && !(tags ?? []).includes(f.stato)) return false;
  if (f.parole.length === 0) return f.stato != null;
  const t = norm(testo);
  return f.parole.every((alternative) => alternative.some((a) => trova(t, a)));
}

// Sulla lista intera: le parole che non compaiono in NESSUN salvato (un rione che l'indirizzo non
// riporta, un aggettivo) non svuotano il risultato, si ignorano. Un tipo o una cucina invece no:
// "quel giapponese a Milano" senza giapponesi salvati non deve proporre tutto Milano.
// Se nessuna parola resta e non c'è uno stato, non c'è niente da proporre.
export function filtraSalvatiNaturale<T>(list: T[], query: string, testoDi: (p: T) => string, tagsDi: (p: T) => string[] | null): T[] {
  const f = capisciRicercaSalvati(query);
  const testi = list.map((p) => norm(testoDi(p)));
  const presenti = (alt: string[]) => testi.some((t) => alt.some((a) => trova(t, a)));
  if (f.parole.some((alt) => alt[0] === "!" && !presenti(alt))) return [];
  const utili = f.parole.filter(presenti);
  if (utili.length === 0 && f.stato == null) return [];
  const g = { parole: utili, stato: f.stato };
  return list.filter((p, i) => corrispondeSalvato(g, testi[i], tagsDi(p)));
}
