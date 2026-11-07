import { scopertaPer, tipoDa, type MappaGusto, type TipoPosto } from "@/lib/mappa-gusto";

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

// "chiave" = il tipo di posto (trattoria, cocktail bar…): sulla home ogni tipo compare una volta sola tra
// idee sotto il campo, "Per te" e classifiche (audit design 7/11: il cocktail usciva tre volte). Vince la
// sezione più in alto: prima le idee, poi "Per te", poi le classifiche.
export type Proposta = { emoji: string; titolo: string; perche: string; q: string; sfondo: string; chiave: string; da?: string };

// Titoli della home per i tipi "famosi" del primo accesso: lì "con la fila" serve a riconoscerli, qui
// suonerebbe come un invito al posto più popolare (revisore 7/11, VISIONE.md).
const TITOLO_HOME: Record<string, string> = { pizza: "Pizza napoletana vera", storica: "Osteria di tradizione" };

// Idee sotto il campo per l'ora (quando non c'è ancora nessuna ricerca recente stanno da sole). Le prime tre
// che restano: dopo le prime tre ci sono le riserve, per quando un tipo passa a "Per te" o a una ricerca recente.
export const PILLOLE: Record<Momento, { label: string; chiave: string }[]> = {
  colazione: [{ label: "Colazione con cornetti veri", chiave: "pasticceria" }, { label: "Caffè di specialità", chiave: "caffe" }, { label: "Brunch nel weekend", chiave: "brunch" }, { label: "Forno di quartiere", chiave: "forno" }],
  pranzo: [{ label: "Pranzo veloce e buono", chiave: "veloce" }, { label: "Trattoria per pranzo", chiave: "trattoria" }, { label: "Pranzo di lavoro tranquillo", chiave: "lavoro" }, { label: "Cucina dal mondo", chiave: "mondo" }],
  pomeriggio: [{ label: "Cena romantica", chiave: "romantica" }, { label: "Aperitivo con vista", chiave: "rooftop" }, { label: "Vino naturale", chiave: "enoteca" }, { label: "Gelato artigianale", chiave: "gelato" }],
  aperitivo: [{ label: "Aperitivo con vista", chiave: "rooftop" }, { label: "Vino naturale", chiave: "enoteca" }, { label: "Cocktail d'autore", chiave: "speakeasy" }, { label: "Birra artigianale", chiave: "birra" }, { label: "Vermouth al bancone", chiave: "vermouth" }],
  cena: [{ label: "Cena romantica", chiave: "romantica" }, { label: "Trattoria non turistica", chiave: "trattoria" }, { label: "Pizza napoletana", chiave: "pizza" }, { label: "Cucina dal mondo", chiave: "mondo" }, { label: "Bistrot creativo", chiave: "bistrot" }],
  dopocena: [{ label: "Cocktail d'autore", chiave: "speakeasy" }, { label: "Wine bar fino a tardi", chiave: "enoteca" }, { label: "Gelato artigianale", chiave: "gelato" }, { label: "Fame a tarda notte", chiave: "tardi" }],
};

/** Tipo di posto di una ricerca scritta ("trattoria a Monti" → "trattoria"), o null. */
export function tipoRicerca(q: string): string | null {
  return DA_RICERCA.find((d) => d.re.test(q))?.tipo ?? null;
}

/** I tipi che "Per te" prende dalla mappa del gusto a quest'ora (gli stessi calcoli di proposte()). */
function tipiDalGusto(gusto: MappaGusto | null | undefined, momento: Momento): string[] {
  if (!gusto || gusto.su.length === 0) return [];
  const ordine = PER_MOMENTO[momento];
  return gusto.su.filter((id) => ordine.includes(id)).sort((a, b) => rank(ordine, a) - rank(ordine, b)).slice(0, 2);
}

/**
 * Idee sotto il campo, al massimo tre. Revisore 7/11: niente idea generica dello stesso tipo di una ricerca
 * recente (↻ "trattoria a Monti" accanto a "Trattoria per pranzo") né di un tipo che ami: quello va in "Per te"
 * con il tuo perché, che vale più dell'idea generica.
 */
export function pillole(momento: Momento, gusto?: MappaGusto | null, recenti: string[] = []): { label: string; chiave: string }[] {
  const via = new Set<string>([...tipiDalGusto(gusto, momento), ...recenti.slice(0, 3).map(tipoRicerca).filter((t): t is string => !!t)]);
  return PILLOLE[momento].filter((p) => !via.has(p.chiave)).slice(0, 3);
}

/** Tipi di posto già occupati dalle idee sotto il campo: "Per te" e le classifiche non li ripetono. */
export function chiaviPillole(momento: Momento, gusto?: MappaGusto | null, recenti: string[] = []): Set<string> {
  return new Set(pillole(momento, gusto, recenti).map((p) => p.chiave));
}

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
export function proposte(input: { gusto: MappaGusto | null; recenti: string[]; citta: string; momento: Momento; escludi?: Set<string> }): Proposta[] {
  const { gusto, recenti, citta, momento } = input;
  const out: Proposta[] = [];
  const add = (p: Proposta) => { if (!out.some((x) => x.q.toLowerCase() === p.q.toLowerCase())) out.push(p); };
  const scoperta = gusto ? scopertaPer(gusto) : null;
  // Un tipo di posto una volta sola: "trattorie a Monti" dalla ricerca non torna uguale dal gusto.
  // Parte dai tipi già mostrati più in alto (le idee sotto il campo).
  const usati = new Set<string>(input.escludi ?? []);

  // 1. Dall'ultima ricerca: lo stesso genere, ma le chicche (il differenziatore: non i più famosi).
  for (const r of recenti.slice(0, 3)) {
    const hit = DA_RICERCA.find((d) => d.re.test(r));
    // Revisore 7/11: niente cocktail bar alle 8 perché l'hai cercato ieri sera. La ricerca resta tra le pillole ↻.
    if (!hit || /turistic|nascost|poco conosciut|chicc/i.test(r) || usati.has(hit.tipo) || !PER_MOMENTO[momento].includes(hit.tipo)) continue;
    const tipo = tipoDa(hit.tipo)!;
    const dove = zonaDi(r) ?? citta;
    // Cucine dal mondo: si tiene la parola cercata ("sushi", "ramen"), non "cucina etnica".
    const parola = hit.nome || (r.match(hit.re)?.[0] ?? "").toLowerCase();
    const cosa = hit.nome ? tipo.query : parola;
    usati.add(tipo.id);
    add({ emoji: tipo.emoji, titolo: `${cap(parola)} che pochi conoscono ${aZona(dove)}`, perche: `Hai cercato «${r.length > 34 ? `${r.slice(0, 32)}…` : r}»`, q: `${cosa} poco conosciuto fuori dai giri turistici ${aZona(dove)}`, sfondo: tipo.sfondo, chiave: tipo.id, da: r });
    break;
  }

  // 2. Dalla mappa del gusto: i tipi che ami, quelli giusti per quest'ora prima.
  if (gusto && gusto.su.length > 0) {
    const ordine = PER_MOMENTO[momento];
    // Revisore 7/11: solo i tipi giusti per l'ora (prima finivano in fondo all'ordine ma passavano: rooftop all'una).
    const amati = gusto.su.map(tipoDa).filter((t): t is TipoPosto => t != null && !usati.has(t.id) && ordine.includes(t.id));
    const scelti = [...amati].sort((a, b) => rank(ordine, a.id) - rank(ordine, b.id)).slice(0, 2);
    scelti.forEach((tipo, i) => {
      usati.add(tipo.id);
      const zona = gusto.zone[i] ?? gusto.zone[0];
      const dove = zona ?? citta;
      const chicche = scoperta === "chicche" ? " fuori dai giri turistici" : "";
      add({ emoji: tipo.emoji, titolo: `${TITOLO_HOME[tipo.id] ?? tipo.titolo} ${aZona(dove)}`, perche: zona ? `Ami questi posti · esci ${aZona(zona)}` : "Ami questi posti", q: `${tipo.query}${chicche} ${aZona(dove)}`, sfondo: tipo.sfondo, chiave: tipo.id });
    });
  }

  // 3. Poche proposte (niente ricerche né gusto, o solo una): idee giuste per l'ora, nella tua città.
  if (out.length < 2) {
    for (const id of IDEE[momento]) {
      if (out.length >= 2) break;
      const chiave = id.chiave ?? id.tipo;
      if (usati.has(chiave)) continue;
      usati.add(chiave);
      const tipo = tipoDa(id.tipo)!;
      add({ emoji: id.emoji ?? tipo.emoji, titolo: id.titolo, // revisore 7/11: "Roma" andava a capo da sola; la città sta già nel titolo delle classifiche
      perche: id.perche, q: `${id.q} a ${citta}`, sfondo: tipo.sfondo, chiave });
    }
  }
  return out.slice(0, 3);
}

const rank = (ordine: string[], id: string) => { const i = ordine.indexOf(id); return i === -1 ? 99 : i; };

// Idee per l'ora, in ordine: quelle con un tipo già nelle idee sotto il campo si saltano, per questo
// ogni momento ne ha più di due. "chiave" quando il tipo di posto è più preciso di quello del gusto.
type Idea = { tipo: string; chiave?: string; emoji?: string; titolo: string; perche: string; q: string };
const IDEE: Record<Momento, Idea[]> = {
  colazione: [
    { tipo: "brunch", chiave: "pasticceria", titolo: "Colazione fatta bene", perche: "Cornetti veri, caffè di specialità", q: "colazione con cornetti artigianali e caffè di specialità" },
    { tipo: "brunch", chiave: "forno", emoji: "🥖", titolo: "Forno di quartiere", perche: "Pane, focacce e lievitati fatti lì", q: "forno artigianale di quartiere" },
    { tipo: "brunch", chiave: "salata", emoji: "🍳", titolo: "Colazione salata", perche: "Uova, pane buono, niente fretta", q: "colazione salata con uova e pane artigianale" },
    { tipo: "brunch", chiave: "specialty", emoji: "🫘", titolo: "Caffè d'autore", perche: "Torrefazione piccola, caffè filtro", q: "caffè di specialità con torrefazione propria" },
  ],
  pranzo: [
    { tipo: "mondo", chiave: "veloce", titolo: "Pranzo veloce e buono", perche: "Pochi minuti, niente catene", q: "pranzo veloce buono non catena" },
    { tipo: "trattoria", titolo: "Trattoria per pranzo", perche: "Piatto del giorno, prezzi onesti", q: "trattoria di quartiere per pranzo" },
    { tipo: "mondo", titolo: "Cucina dal mondo", perche: "Posti piccoli, cuochi di quei paesi", q: "cucina etnica autentica per pranzo" },
    { tipo: "brunch", chiave: "forno", emoji: "🥖", titolo: "Forno di quartiere", perche: "Pane, focacce e lievitati fatti lì", q: "forno artigianale di quartiere" },
  ],
  pomeriggio: [
    { tipo: "enoteca", titolo: "Un calice stasera", perche: "Vini naturali, piatti da condividere", q: "enoteca vini naturali" },
    { tipo: "trattoria", titolo: "Cena di quartiere", perche: "Dove mangiano quelli del posto", q: "trattoria di quartiere non turistica" },
    { tipo: "speakeasy", titolo: "Cocktail bar nascosto", perche: "Drink d'autore, luci basse", q: "cocktail bar d'autore nascosto" },
  ],
  aperitivo: [
    { tipo: "rooftop", titolo: "Aperitivo con vista", perche: "Il tramonto sopra i tetti", q: "aperitivo con vista" },
    { tipo: "enoteca", titolo: "Vino e taglieri", perche: "Bancone piccolo, l'oste consiglia", q: "enoteca vini naturali con taglieri" },
    { tipo: "trattoria", chiave: "fritti", emoji: "🧆", titolo: "Fritti e taglieri", perche: "Aperitivo di quartiere, prezzi onesti", q: "aperitivo con fritti e taglieri di quartiere non turistico" },
    { tipo: "mondo", chiave: "birra", emoji: "🍺", titolo: "Birra artigianale", perche: "Spine che cambiano spesso", q: "birreria artigianale con birre alla spina" },
  ],
  cena: [
    { tipo: "trattoria", titolo: "Trattoria vera", perche: "Dove mangiano quelli del posto", q: "trattoria autentica non turistica" },
    { tipo: "bistrot", chiave: "romantica", titolo: "Cena a due", perche: "Tavoli lontani, luci basse", q: "ristorante romantico per due tranquillo" },
    { tipo: "mondo", titolo: "Cucina dal mondo", perche: "Posti piccoli, cuochi di quei paesi", q: "cucina etnica autentica" },
    { tipo: "bistrot", titolo: "Bistrot creativo", perche: "Menù corto, chef giovane", q: "bistrot cucina creativa" },
  ],
  dopocena: [
    { tipo: "speakeasy", titolo: "Cocktail bar nascosto", perche: "Drink d'autore, luci basse", q: "cocktail bar d'autore nascosto" },
    { tipo: "enoteca", titolo: "Un ultimo bicchiere", perche: "Aperto fino a tardi", q: "wine bar aperto fino a tardi" },
    { tipo: "mondo", chiave: "birra", emoji: "🍺", titolo: "Birra artigianale", perche: "Spine che cambiano spesso", q: "birreria artigianale con birre alla spina" },
    { tipo: "brunch", chiave: "dolce", emoji: "🍰", titolo: "Un dolce prima di casa", perche: "Pasticcerie e dessert aperti la sera", q: "dessert bar o pasticceria aperta la sera" },
  ],
};

// "chiave": il tipo di posto, per non ripetere quello già nelle idee o in "Per te" (assente: un piatto, non un tipo).
export type Classifica = { id: string; emoji: string; titolo: string; sotto: string; q: string; momenti: Momento[]; chiave?: string };

// Classifiche della città: ogni lista è una ricerca vera, ordinata dal verdetto Mapetite (le recensioni),
// non dal numero di recensioni. "Non turistico" dove serve: la classifica dei posti di tutti la fa già Google.
const CLASSIFICHE: Record<string, Classifica[]> = {
  Roma: [
    { id: "carbonara", emoji: "🍝", titolo: "Le carbonare da provare", sotto: "Le migliori di Roma secondo le recensioni, fuori dai giri turistici", q: "migliore carbonara di Roma non turistica", momenti: ["pranzo", "cena", "pomeriggio"] },
    { id: "cacio", emoji: "🧀", titolo: "Cacio e pepe, la classifica", sotto: "Cremosa, non stoppacciosa: le recensioni dicono dove", q: "migliore cacio e pepe di Roma non turistica", momenti: ["pranzo", "cena"] },
    { id: "taglio", emoji: "🍕", titolo: "Pizza al taglio", sotto: "Da mangiare in piedi, croccante sotto", q: "migliore pizza al taglio di Roma", momenti: ["pranzo", "pomeriggio"], chiave: "pizza" },
    { id: "maritozzo", emoji: "🥐", titolo: "Maritozzi con la panna", sotto: "La colazione romana fatta bene", q: "migliore maritozzo con la panna a Roma", momenti: ["colazione"], chiave: "pasticceria" },
    { id: "vista", emoji: "🌇", titolo: "Aperitivi con vista", sotto: "Terrazze e tetti, senza la calca", q: "aperitivo con vista a Roma non turistico", momenti: ["aperitivo", "pomeriggio"], chiave: "rooftop" },
    { id: "vini", emoji: "🍷", titolo: "Enoteche di vini naturali", sotto: "Dove l'oste ti consiglia davvero", q: "enoteca vini naturali a Roma", momenti: ["aperitivo", "dopocena", "pomeriggio"], chiave: "enoteca" },
    { id: "cocktail", emoji: "🍸", titolo: "Cocktail bar nascosti", sotto: "Porte senza insegna, drink d'autore", q: "cocktail bar nascosto d'autore a Roma", momenti: ["dopocena", "aperitivo"], chiave: "speakeasy" },
    { id: "gelato", emoji: "🍨", titolo: "Gelato artigianale", sotto: "Colori naturali, niente montagne", q: "gelateria artigianale migliore a Roma", momenti: ["pomeriggio", "dopocena"], chiave: "gelato" },
    { id: "suppli", emoji: "🍙", titolo: "Supplì e fritti", sotto: "Il cibo di strada romano", q: "migliori supplì di Roma", momenti: ["pranzo", "aperitivo"], chiave: "fritti" },
    { id: "forno", emoji: "🥖", titolo: "Forni di quartiere", sotto: "Pizza bianca calda e lievitati fatti lì", q: "forno artigianale con pizza bianca a Roma", momenti: ["colazione"], chiave: "forno" },
    { id: "ciambelle", emoji: "🍩", titolo: "Ciambelle e bombe", sotto: "Fritte la mattina, zucchero sopra", q: "ciambelle fritte e bombe per colazione a Roma", momenti: ["colazione"], chiave: "fritte-dolci" },
    { id: "salata", emoji: "🍳", titolo: "Colazione salata", sotto: "Uova, pane buono, niente fretta", q: "colazione salata con uova a Roma", momenti: ["colazione"], chiave: "salata" },
    { id: "birra", emoji: "🍺", titolo: "Birre artigianali", sotto: "Spine che cambiano, pub piccoli", q: "birreria artigianale con birre alla spina a Roma", momenti: ["aperitivo", "dopocena"], chiave: "birra" },
    { id: "taglieri", emoji: "🧀", titolo: "Taglieri e norcinerie", sotto: "Salumi, formaggi e un calice", q: "norcineria o salumeria con taglieri per aperitivo a Roma", momenti: ["aperitivo"], chiave: "taglieri" },
    { id: "bancone", emoji: "☕", titolo: "Caffè al bancone", sotto: "Bar di quartiere, cornetto caldo", q: "bar storico di quartiere per colazione a Roma", momenti: ["colazione"], chiave: "bar" },
    // Revisore 7/11: all'aperitivo e dopo cena vino, cocktail e vista stanno già nelle idee sotto il campo.
    { id: "vermouth", emoji: "🥃", titolo: "Vermouth e bitter", sotto: "L'aperitivo all'italiana, al bancone", q: "bar per aperitivo con vermouth e bitter a Roma", momenti: ["aperitivo"], chiave: "vermouth" },
    { id: "jazz", emoji: "🎷", titolo: "Musica dal vivo", sotto: "Jazz e concerti piccoli, un drink in mano", q: "locale con musica jazz dal vivo a Roma", momenti: ["dopocena"], chiave: "musica" },
    { id: "tardi", emoji: "🌙", titolo: "Fame a tarda notte", sotto: "Cucine aperte dopo mezzanotte", q: "cucina aperta fino a tardi la notte a Roma", momenti: ["dopocena"], chiave: "tardi" },
    { id: "amari", emoji: "🥃", titolo: "Amari e distillati", sotto: "Bar piccoli per l'ultimo bicchiere", q: "bar con amari e distillati per il dopocena a Roma", momenti: ["dopocena"], chiave: "amari" },
  ],
  Milano: [
    { id: "risotto", emoji: "🍚", titolo: "Risotto alla milanese", sotto: "I migliori secondo le recensioni, fuori dai giri turistici", q: "migliore risotto alla milanese non turistico a Milano", momenti: ["pranzo", "cena", "pomeriggio"] },
    { id: "cotoletta", emoji: "🍖", titolo: "Cotoletta, la classifica", sotto: "Orecchia d'elefante o alta con l'osso", q: "migliore cotoletta alla milanese a Milano", momenti: ["pranzo", "cena"] },
    { id: "pizza", emoji: "🍕", titolo: "Pizza napoletana a Milano", sotto: "Cornicione alto, impasto leggero", q: "migliore pizza napoletana a Milano", momenti: ["cena", "pranzo"], chiave: "pizza" },
    { id: "brunch", emoji: "🥐", titolo: "Brunch e caffè di specialità", sotto: "Luce, pancake, caffè filtro", q: "brunch e caffè di specialità a Milano", momenti: ["colazione", "pranzo"], chiave: "brunch" },
    { id: "brioche", emoji: "🥐", titolo: "Brioche e cappuccino", sotto: "Pasticcerie storiche, non catene", q: "pasticceria storica per colazione a Milano", momenti: ["colazione"], chiave: "pasticceria" }, // come l'idea dei cornetti: a Milano brioche e cornetto sono la stessa cosa
    { id: "banco", emoji: "☕", titolo: "Caffè al banco", sotto: "Bar di quartiere, brioche calda", q: "bar di quartiere per colazione a Milano", momenti: ["colazione"], chiave: "bar" },
    { id: "forno", emoji: "🥖", titolo: "Focaccia e lievitati", sotto: "Forni artigianali, appena sfornato", q: "forno artigianale con focaccia a Milano", momenti: ["colazione"], chiave: "forno" },
    { id: "torte", emoji: "🍰", titolo: "Torte e caffè", sotto: "Bakery di quartiere, dolci fatti lì", q: "bakery di quartiere con torte fatte in casa per colazione a Milano", momenti: ["colazione"], chiave: "bakery" },
    { id: "salata", emoji: "🍳", titolo: "Colazione salata", sotto: "Uova, pane buono, niente fretta", q: "colazione salata con uova a Milano", momenti: ["colazione"], chiave: "salata" },
    { id: "mondeghili", emoji: "🧆", titolo: "Mondeghili e piattini", sotto: "Le polpette milanesi con il bicchiere", q: "aperitivo con mondeghili e piattini a Milano", momenti: ["aperitivo"], chiave: "fritti" },
    { id: "birra", emoji: "🍺", titolo: "Birre artigianali", sotto: "Spine che cambiano, pub piccoli", q: "birreria artigianale con birre alla spina a Milano", momenti: ["aperitivo", "dopocena"], chiave: "birra" },
    { id: "vermouth", emoji: "🥃", titolo: "Bitter e vermouth", sotto: "L'aperitivo milanese, quello vero", q: "bar storico per aperitivo con bitter e vermouth a Milano", momenti: ["aperitivo"], chiave: "vermouth" },
    { id: "jazz", emoji: "🎷", titolo: "Musica dal vivo", sotto: "Jazz e concerti piccoli, un drink in mano", q: "locale con musica jazz dal vivo a Milano", momenti: ["dopocena"], chiave: "musica" },
    { id: "tardi", emoji: "🌙", titolo: "Fame a tarda notte", sotto: "Cucine aperte dopo mezzanotte", q: "cucina aperta fino a tardi la notte a Milano", momenti: ["dopocena"], chiave: "tardi" },
    { id: "amari", emoji: "🥃", titolo: "Amari e distillati", sotto: "Bar piccoli per l'ultimo bicchiere", q: "bar con amari e distillati per il dopocena a Milano", momenti: ["dopocena"], chiave: "amari" },
    { id: "aperitivo", emoji: "🍹", titolo: "Aperitivi veri", sotto: "Lontano dai Navigli turistici", q: "aperitivo non turistico a Milano", momenti: ["aperitivo", "pomeriggio"] },
    { id: "vini", emoji: "🍷", titolo: "Enoteche di vini naturali", sotto: "Dove l'oste ti consiglia davvero", q: "enoteca vini naturali a Milano", momenti: ["aperitivo", "dopocena", "pomeriggio"], chiave: "enoteca" },
    { id: "cocktail", emoji: "🍸", titolo: "Cocktail bar nascosti", sotto: "Porte senza insegna, drink d'autore", q: "cocktail bar nascosto d'autore a Milano", momenti: ["dopocena", "aperitivo"], chiave: "speakeasy" },
    { id: "gelato", emoji: "🍨", titolo: "Gelato artigianale", sotto: "Colori naturali, niente montagne", q: "gelateria artigianale migliore a Milano", momenti: ["pomeriggio", "dopocena"], chiave: "gelato" },
  ],
};

/** Le classifiche da mostrare: prima quelle giuste per l'ora, poi le altre (a rotazione per settimana). */
export function classifiche(citta: string, momento: Momento, now: Date, n = 4, escludi: Set<string> = new Set()): Classifica[] {
  const pool = CLASSIFICHE[citta] ?? CLASSIFICHE.Roma;
  const settimana = Math.floor(now.getTime() / (7 * 24 * 3600 * 1000));
  const ruotate = pool.map((c, i) => ({ c, k: (i + settimana) % pool.length }));
  ruotate.sort((a, b) => Number(b.c.momenti.includes(momento)) - Number(a.c.momenti.includes(momento)) || a.k - b.k);
  // Mai fuori orario: di mattina niente cocktail, di notte niente colazioni.
  const stona = (c: Classifica) => FUORI_ORA[momento].length > 0 && c.momenti.every((x) => FUORI_ORA[momento].includes(x));
  // Un tipo di posto già mostrato più in alto (idee, "Per te") o in una classifica prima non si ripete.
  const visti = new Set(escludi);
  const doppione = (c: Classifica) => { if (!c.chiave) return false; if (visti.has(c.chiave)) return true; visti.add(c.chiave); return false; };
  // Revisore 7/11 (home 7,5): togliendo i doppioni restavano le classifiche fuori orario (supplì alle 8, risotto a
  // mezzanotte). Solo quelle giuste per l'ora, anche se sono poche: meglio due righe vere che quattro fuori posto.
  return ruotate.filter((x) => x.c.momenti.includes(momento) && !stona(x.c) && !doppione(x.c)).slice(0, n).map((x) => x.c);
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
