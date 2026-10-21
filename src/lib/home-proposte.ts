import { scopertaDedotta, tipoDa, type MappaGusto, type TipoPosto } from "@/lib/mappa-gusto";

// Home (Lorenzo 21/10: "più fica e utile, con classifiche o proposte in base alle ricerche precedenti").
// Tutto qui sono RICERCHE pronte, non locali: un tocco apre /mappa?q=… e i posti veri arrivano da Google
// con il verdetto Mapetite. Nessuna chiamata a pagamento in home, nessun locale inventato.
// Funzioni pure: le usano il server (momento, classifiche) e il telefono (proposte dalle ricerche recenti).

export type Momento = "colazione" | "pranzo" | "pomeriggio" | "aperitivo" | "cena" | "dopocena";

const GIORNI = ["Domenica", "Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"];

/** Ora di Roma → momento della giornata, etichetta ("MERCOLEDÌ SERA") e domanda del titolo. */
export function momentoDi(now: Date): { momento: Momento; etichetta: string; domanda: string; weekend: boolean } {
  const parts = new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", weekday: "long", hour: "numeric", minute: "numeric", hourCycle: "h23" }).formatToParts(now);
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? 12);
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  const wd = parts.find((p) => p.type === "weekday")?.value ?? "";
  const t = h + m / 60;
  let giorno = GIORNI.find((g) => g.toLowerCase() === wd.toLowerCase()) ?? (wd.charAt(0).toUpperCase() + wd.slice(1));
  // All'una di sabato, per chi esce, è ancora la notte di venerdì.
  if (t < 5 && GIORNI.includes(giorno)) giorno = GIORNI[(GIORNI.indexOf(giorno) + 6) % 7];
  const weekend = giorno === "Sabato" || giorno === "Domenica";
  if (t >= 5 && t < 11) return { momento: "colazione", etichetta: `${giorno} mattina`, domanda: "Dove facciamo colazione", weekend };
  if (t >= 11 && t < 15) return { momento: "pranzo", etichetta: `${giorno} a pranzo`, domanda: "Dove mangiamo oggi", weekend };
  if (t >= 15 && t < 18) return { momento: "pomeriggio", etichetta: `${giorno} pomeriggio`, domanda: "Dove andiamo stasera", weekend };
  if (t >= 18 && t < 20.5) return { momento: "aperitivo", etichetta: `${giorno} sera`, domanda: "Dove facciamo aperitivo", weekend };
  if (t >= 20.5 && t < 23.5) return { momento: "cena", etichetta: `${giorno} sera`, domanda: "Dove andiamo stasera", weekend };
  return { momento: "dopocena", etichetta: `${giorno} notte`, domanda: "Dove andiamo a bere", weekend };
}

export type Proposta = { emoji: string; titolo: string; perche: string; q: string; sfondo: string };

// Tipi adatti a ogni momento (in ordine): il pomeriggio si pensa già alla sera.
const PER_MOMENTO: Record<Momento, string[]> = {
  colazione: ["brunch"],
  pranzo: ["mondo", "trattoria", "pizza", "brunch"],
  pomeriggio: ["enoteca", "rooftop", "speakeasy", "trattoria"],
  aperitivo: ["enoteca", "rooftop", "speakeasy"],
  cena: ["trattoria", "bistrot", "mondo", "pizza", "storica", "gourmet"],
  dopocena: ["speakeasy", "enoteca"],
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// "al Pigneto", "ai Navigli", "all'Isola": come si dice davvero, non "a Pigneto".
const PREP: Record<string, string> = {
  Pigneto: "al", Ostiense: "all'", Garbatella: "alla", Esquilino: "all'", "Centro Storico": "nel", Parioli: "ai",
  Navigli: "ai", Isola: "all'", "Paolo Sarpi": "in", Tortona: "in zona", Quadraro: "al", Flaminio: "al", Vomero: "al",
};
export function aZona(z: string): string {
  const p = PREP[z];
  if (!p) return `a ${z}`;
  return p.endsWith("'") ? `${p}${z}` : `${p} ${z}`;
}

// Parole delle ricerche fatte → tipo di posto. Serve a proporre "le chicche" di quello che si cerca.
const DA_RICERCA: { re: RegExp; tipo: string; nome: string }[] = [
  { re: /trattori/i, tipo: "trattoria", nome: "trattorie" },
  { re: /osteri/i, tipo: "trattoria", nome: "osterie" },
  { re: /pizz/i, tipo: "pizza", nome: "pizzerie" },
  { re: /cocktail|speakeasy|drink/i, tipo: "speakeasy", nome: "cocktail bar" },
  { re: /wine|enotec|vin[oi]/i, tipo: "enoteca", nome: "enoteche" },
  { re: /rooftop|terrazz|vista/i, tipo: "rooftop", nome: "posti con vista" },
  { re: /brunch|colazion|caff[eè]/i, tipo: "brunch", nome: "posti per la colazione" },
  { re: /sushi|ramen|giappon|indian|thai|cines|etnic|curry|poke|tacos|messican|corean/i, tipo: "mondo", nome: "" },
  { re: /bistrot|creativ|gourmet|degustazion/i, tipo: "bistrot", nome: "bistrot" },
];

// Zona scritta nella ricerca ("… a Monti", "… in Brera"): parola con la maiuscola dopo "a"/"in"/"al".
function zonaDi(q: string): string | null {
  const m = q.match(/\b(?:a|in|al|ai|zona)\s+([A-ZÀ-Ý][\p{L}']+(?:\s+[A-ZÀ-Ý][\p{L}']+)?)\s*$/u) ?? q.match(/\b(?:a|in|al|ai|zona)\s+([A-ZÀ-Ý][\p{L}']+)/u);
  return m ? m[1] : null;
}

/**
 * Proposte "Per te": dalle ricerche fatte su questo telefono e dalla mappa del gusto, adatte all'ora.
 * Mai più di 3; ogni proposta dice perché è lì (la ricerca o il gusto da cui nasce).
 */
export function proposte(input: { gusto: MappaGusto | null; recenti: string[]; citta: string; momento: Momento }): Proposta[] {
  const { gusto, recenti, citta, momento } = input;
  const out: Proposta[] = [];
  const add = (p: Proposta) => { if (!out.some((x) => x.q.toLowerCase() === p.q.toLowerCase())) out.push(p); };
  const scoperta = gusto ? gusto.scoperta ?? scopertaDedotta(gusto.su) : null;
  // Un tipo di posto una volta sola: "trattorie a Monti" dalla ricerca non torna uguale dal gusto.
  const usati = new Set<string>();

  // 1. Dall'ultima ricerca: lo stesso genere, ma le chicche (il differenziatore: non i più famosi).
  for (const r of recenti.slice(0, 3)) {
    const hit = DA_RICERCA.find((d) => d.re.test(r));
    if (!hit || /turistic|nascost|poco conosciut|chicc/i.test(r)) continue;
    const tipo = tipoDa(hit.tipo)!;
    const dove = zonaDi(r) ?? citta;
    // Cucine dal mondo: si tiene la parola cercata ("sushi", "ramen"), non "cucina etnica".
    const parola = hit.nome || (r.match(hit.re)?.[0] ?? "").toLowerCase();
    const cosa = hit.nome ? tipo.query : parola;
    usati.add(tipo.id);
    add({ emoji: tipo.emoji, titolo: `${cap(parola)} che pochi conoscono ${aZona(dove)}`, perche: `Hai cercato «${r.length > 34 ? `${r.slice(0, 32)}…` : r}»`, q: `${cosa} poco conosciuto fuori dai giri turistici ${aZona(dove)}`, sfondo: tipo.sfondo });
    break;
  }

  // 2. Dalla mappa del gusto: i tipi che ami, quelli giusti per quest'ora prima.
  if (gusto && gusto.su.length > 0) {
    const amati = gusto.su.map(tipoDa).filter((t): t is TipoPosto => t != null && !usati.has(t.id));
    const ordine = PER_MOMENTO[momento];
    const scelti = [...amati].sort((a, b) => rank(ordine, a.id) - rank(ordine, b.id)).slice(0, 2);
    scelti.forEach((tipo, i) => {
      usati.add(tipo.id);
      const zona = gusto.zone[i] ?? gusto.zone[0];
      const dove = zona ?? citta;
      const chicche = scoperta === "chicche" ? " fuori dai giri turistici" : "";
      add({ emoji: tipo.emoji, titolo: `${tipo.titolo} ${aZona(dove)}`, perche: zona ? `Ami questi posti · esci ${aZona(zona)}` : "Ami questi posti", q: `${tipo.query}${chicche} ${aZona(dove)}`, sfondo: tipo.sfondo });
    });
  }

  // 3. Poche proposte (niente ricerche né gusto, o solo una): idee giuste per l'ora, nella tua città.
  if (out.length < 2) {
    for (const id of IDEE[momento]) {
      if (out.length >= 2) break;
      if (usati.has(id.tipo)) continue;
      const tipo = tipoDa(id.tipo)!;
      add({ emoji: tipo.emoji, titolo: `${id.titolo} a ${citta}`, perche: id.perche, q: `${id.q} a ${citta}`, sfondo: tipo.sfondo });
    }
  }
  return out.slice(0, 3);
}

const rank = (ordine: string[], id: string) => { const i = ordine.indexOf(id); return i === -1 ? 99 : i; };

const IDEE: Record<Momento, { tipo: string; titolo: string; perche: string; q: string }[]> = {
  colazione: [{ tipo: "brunch", titolo: "Colazione fatta bene", perche: "Cornetti veri, caffè di specialità", q: "colazione con cornetti artigianali e caffè di specialità" }],
  pranzo: [
    { tipo: "mondo", titolo: "Pranzo veloce e buono", perche: "Pochi minuti, niente catene", q: "pranzo veloce buono non catena" },
    { tipo: "trattoria", titolo: "Trattoria per pranzo", perche: "Piatto del giorno, prezzi onesti", q: "trattoria di quartiere per pranzo" },
  ],
  pomeriggio: [
    { tipo: "enoteca", titolo: "Un calice stasera", perche: "Vini naturali, piatti da condividere", q: "enoteca vini naturali" },
    { tipo: "trattoria", titolo: "Cena di quartiere", perche: "Dove mangiano quelli del posto", q: "trattoria di quartiere non turistica" },
  ],
  aperitivo: [
    { tipo: "rooftop", titolo: "Aperitivo con vista", perche: "Il tramonto sopra i tetti", q: "aperitivo con vista" },
    { tipo: "enoteca", titolo: "Vino e taglieri", perche: "Bancone piccolo, l'oste consiglia", q: "enoteca vini naturali con taglieri" },
  ],
  cena: [
    { tipo: "trattoria", titolo: "Trattoria vera", perche: "Dove mangiano quelli del posto", q: "trattoria autentica non turistica" },
    { tipo: "bistrot", titolo: "Cena a due", perche: "Tavoli lontani, luci basse", q: "ristorante romantico per due tranquillo" },
  ],
  dopocena: [
    { tipo: "speakeasy", titolo: "Cocktail bar nascosto", perche: "Drink d'autore, luci basse", q: "cocktail bar d'autore nascosto" },
    { tipo: "enoteca", titolo: "Un ultimo bicchiere", perche: "Aperto fino a tardi", q: "wine bar aperto fino a tardi" },
  ],
};

export type Classifica = { id: string; emoji: string; titolo: string; sotto: string; q: string; momenti: Momento[] };

// Classifiche della città: ogni lista è una ricerca vera, ordinata dal verdetto Mapetite (le recensioni),
// non dal numero di recensioni. "Non turistico" dove serve: la classifica dei posti di tutti la fa già Google.
const CLASSIFICHE: Record<string, Classifica[]> = {
  Roma: [
    { id: "carbonara", emoji: "🍝", titolo: "Le carbonare da provare", sotto: "Le migliori di Roma secondo le recensioni, fuori dai giri turistici", q: "migliore carbonara di Roma non turistica", momenti: ["pranzo", "cena", "pomeriggio"] },
    { id: "cacio", emoji: "🧀", titolo: "Cacio e pepe, la classifica", sotto: "Cremosa, non stoppacciosa: le recensioni dicono dove", q: "migliore cacio e pepe di Roma non turistica", momenti: ["pranzo", "cena"] },
    { id: "taglio", emoji: "🍕", titolo: "Pizza al taglio", sotto: "Da mangiare in piedi, croccante sotto", q: "migliore pizza al taglio di Roma", momenti: ["pranzo", "pomeriggio"] },
    { id: "maritozzo", emoji: "🥐", titolo: "Maritozzi con la panna", sotto: "La colazione romana fatta bene", q: "migliore maritozzo con la panna a Roma", momenti: ["colazione"] },
    { id: "vista", emoji: "🌇", titolo: "Aperitivi con vista", sotto: "Terrazze e tetti, senza la calca", q: "aperitivo con vista a Roma non turistico", momenti: ["aperitivo", "pomeriggio"] },
    { id: "vini", emoji: "🍷", titolo: "Enoteche di vini naturali", sotto: "Dove l'oste ti consiglia davvero", q: "enoteca vini naturali a Roma", momenti: ["aperitivo", "dopocena", "pomeriggio"] },
    { id: "cocktail", emoji: "🍸", titolo: "Cocktail bar nascosti", sotto: "Porte senza insegna, drink d'autore", q: "cocktail bar nascosto d'autore a Roma", momenti: ["dopocena", "aperitivo"] },
    { id: "gelato", emoji: "🍨", titolo: "Gelato artigianale", sotto: "Colori naturali, niente montagne", q: "gelateria artigianale migliore a Roma", momenti: ["pomeriggio", "dopocena"] },
    { id: "suppli", emoji: "🍙", titolo: "Supplì e fritti", sotto: "Il cibo di strada romano", q: "migliori supplì di Roma", momenti: ["pranzo", "aperitivo"] },
  ],
  Milano: [
    { id: "risotto", emoji: "🍚", titolo: "Risotto alla milanese", sotto: "I migliori secondo le recensioni, fuori dai giri turistici", q: "migliore risotto alla milanese non turistico a Milano", momenti: ["pranzo", "cena", "pomeriggio"] },
    { id: "cotoletta", emoji: "🍖", titolo: "Cotoletta, la classifica", sotto: "Orecchia d'elefante o alta con l'osso", q: "migliore cotoletta alla milanese a Milano", momenti: ["pranzo", "cena"] },
    { id: "pizza", emoji: "🍕", titolo: "Pizza napoletana a Milano", sotto: "Cornicione alto, impasto leggero", q: "migliore pizza napoletana a Milano", momenti: ["cena", "pranzo"] },
    { id: "brunch", emoji: "🥐", titolo: "Brunch e caffè di specialità", sotto: "Luce, pancake, caffè filtro", q: "brunch e caffè di specialità a Milano", momenti: ["colazione", "pranzo"] },
    { id: "aperitivo", emoji: "🍹", titolo: "Aperitivi veri", sotto: "Lontano dai Navigli turistici", q: "aperitivo non turistico a Milano", momenti: ["aperitivo", "pomeriggio"] },
    { id: "vini", emoji: "🍷", titolo: "Enoteche di vini naturali", sotto: "Dove l'oste ti consiglia davvero", q: "enoteca vini naturali a Milano", momenti: ["aperitivo", "dopocena", "pomeriggio"] },
    { id: "cocktail", emoji: "🍸", titolo: "Cocktail bar nascosti", sotto: "Porte senza insegna, drink d'autore", q: "cocktail bar nascosto d'autore a Milano", momenti: ["dopocena", "aperitivo"] },
    { id: "gelato", emoji: "🍨", titolo: "Gelato artigianale", sotto: "Colori naturali, niente montagne", q: "gelateria artigianale migliore a Milano", momenti: ["pomeriggio", "dopocena"] },
  ],
};

/** Le classifiche da mostrare: prima quelle giuste per l'ora, poi le altre (a rotazione per settimana). */
export function classifiche(citta: string, momento: Momento, now: Date, n = 4): Classifica[] {
  const pool = CLASSIFICHE[citta] ?? CLASSIFICHE.Roma;
  const settimana = Math.floor(now.getTime() / (7 * 24 * 3600 * 1000));
  const ruotate = pool.map((c, i) => ({ c, k: (i + settimana) % pool.length }));
  ruotate.sort((a, b) => Number(b.c.momenti.includes(momento)) - Number(a.c.momenti.includes(momento)) || a.k - b.k);
  // Mai fuori orario: di mattina niente cocktail, di notte niente colazioni.
  const stona = (c: Classifica) => FUORI_ORA[momento].length > 0 && c.momenti.every((x) => FUORI_ORA[momento].includes(x));
  return ruotate.filter((x) => !stona(x.c)).slice(0, n).map((x) => x.c);
}

const FUORI_ORA: Record<Momento, Momento[]> = {
  colazione: ["pomeriggio", "aperitivo", "dopocena", "cena"],
  pranzo: ["dopocena"],
  pomeriggio: [],
  aperitivo: ["colazione"],
  cena: ["colazione"],
  dopocena: ["colazione", "pranzo"],
};

export const CITTA_CLASSIFICHE = Object.keys(CLASSIFICHE);
