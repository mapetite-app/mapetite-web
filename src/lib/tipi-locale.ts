// "I miei gusti" (Lorenzo, 5/11): il catalogo ampio dei tipi di locale, a gruppi come i filtri del vecchio MVP
// (docs/autonomia/riferimenti/vecchio-mvp-02-filtri-categorie.png). Serve a capire cosa interessa a ogni persona
// (e a raggrupparle), al primo accesso e nel profilo; la ricerca lo usa per mettere un po' più su i locali dei
// suoi tipi quando la frase non ne dice uno, e i verdetti per il "per te".
// File puro, senza import con alias: lo importa anche lo script Node del giro automatico.
//
// Ogni tipo: id stabile (non cambiarlo: è salvato in profiles.gusto.amati), emoji, etichetta di 1–2 parole,
// parola chiave per una ricerca, tipi Google Places che lo riconoscono e, se serve, parole nel nome del locale
// (un fatto di Google, come i tipi). Gli id vegetariano, vegano e celiaco sono gli stessi delle diete
// (mappa-gusto.ts, gusti.ts): qui vogliono dire "mi piacciono quei posti", la dieta resta una domanda a parte.

export type TipoLocale = {
  id: string;
  emoji: string;
  label: string;
  query: string;
  google: string[];
  nome?: RegExp;
  // Parole che, scritte nella frase, dicono già questo tipo ("pizza stasera"): la frase vince sui gusti.
  parole?: RegExp;
};

export type GruppoLocale = { id: string; titolo: string; emoji: string; tipi: TipoLocale[] };

export const GRUPPI_LOCALE: GruppoLocale[] = [
  {
    id: "italiana", titolo: "Cucina italiana", emoji: "🍝",
    tipi: [
      { id: "trattoria", emoji: "🍝", label: "Trattoria", query: "trattoria", google: [], nome: /\btrattori/i, parole: /\btrattori/i },
      { id: "osteria", emoji: "🍷", label: "Osteria", query: "osteria", google: [], nome: /\bosteri/i, parole: /\bosteri/i },
      { id: "ristorante", emoji: "🍽️", label: "Ristorante", query: "ristorante", google: ["italian_restaurant"] },
      { id: "pizzeria", emoji: "🍕", label: "Pizzeria", query: "pizzeria", google: ["pizza_restaurant"], nome: /\bpizz/i, parole: /\bpizz/i },
      { id: "pizza-taglio", emoji: "🍕", label: "Pizza al taglio", query: "pizza al taglio", google: [], nome: /al\s+taglio|pinsa|trapizz/i, parole: /al\s+taglio|pinsa|trapizz/i },
      { id: "romana", emoji: "🏛️", label: "Cucina romana", query: "cucina romana", google: [], parole: /\bromanesc|cucina\s+romana|carbonara|amatriciana|cacio\s+e\s+pepe/i },
      { id: "milanese", emoji: "🥘", label: "Cucina milanese", query: "cucina milanese", google: [], parole: /milanes|risotto|cotoletta|ossobuco/i },
      { id: "regionale", emoji: "🧀", label: "Regionale", query: "cucina regionale", google: [], parole: /regional|pugliese|siciliana|sarda|toscana|napoletana|emilian/i },
      { id: "agriturismo", emoji: "🚜", label: "Agriturismo", query: "agriturismo", google: ["farm"], nome: /agriturism/i, parole: /agriturism/i },
      { id: "pesce", emoji: "🐟", label: "Pesce", query: "ristorante di pesce", google: ["seafood_restaurant"], parole: /\bpesce|crudi|frutti\s+di\s+mare|sushi/i },
      { id: "griglieria", emoji: "🥩", label: "Carne e griglia", query: "griglieria", google: ["bar_and_grill"], nome: /griglier|braceri/i, parole: /griglier|braceri|\bcarne\b|grigliat/i },
      { id: "steakhouse", emoji: "🥩", label: "Steakhouse", query: "steakhouse", google: ["steak_house"], parole: /steak|bistecc|fiorentina/i },
      { id: "gourmet", emoji: "✨", label: "Gourmet", query: "ristorante gourmet", google: ["fine_dining_restaurant"], parole: /gourmet|stellat|degustazion|alta\s+cucina|fine\s+dining/i },
      { id: "bistrot", emoji: "🧑‍🍳", label: "Bistrot", query: "bistrot", google: ["bistro"], nome: /bistr/i, parole: /bistr/i },
    ],
  },
  {
    id: "mondo", titolo: "Dal mondo", emoji: "🌍",
    tipi: [
      { id: "sushi", emoji: "🍣", label: "Sushi", query: "sushi", google: ["sushi_restaurant", "japanese_restaurant"], parole: /sushi|giappones|japanese|izakaya/i },
      { id: "ramen", emoji: "🍜", label: "Ramen", query: "ramen", google: ["ramen_restaurant"], nome: /ramen/i, parole: /ramen/i },
      { id: "cinese", emoji: "🥟", label: "Cinese", query: "ristorante cinese", google: ["chinese_restaurant"], parole: /cines|ravioli\s+cinesi|dim\s*sum/i },
      { id: "thai", emoji: "🍛", label: "Thai", query: "ristorante thai", google: ["thai_restaurant"], parole: /\bthai|thailandes/i },
      { id: "vietnamita", emoji: "🍲", label: "Vietnamita", query: "ristorante vietnamita", google: ["vietnamese_restaurant"], parole: /vietnam|\bpho\b/i },
      { id: "coreano", emoji: "🥢", label: "Coreano", query: "ristorante coreano", google: ["korean_restaurant"], parole: /corean|korean/i },
      { id: "indiano", emoji: "🍛", label: "Indiano", query: "ristorante indiano", google: ["indian_restaurant"], parole: /indian|curry/i },
      { id: "mediorientale", emoji: "🧆", label: "Mediorientale", query: "cucina mediorientale", google: ["middle_eastern_restaurant", "lebanese_restaurant", "turkish_restaurant", "persian_restaurant"], parole: /mediorient|liban|turc|persian|falafel|hummus/i },
      { id: "greco", emoji: "🫒", label: "Greco", query: "ristorante greco", google: ["greek_restaurant"], parole: /\bgrec[oa]/i },
      { id: "spagnolo", emoji: "🥘", label: "Spagnolo e tapas", query: "tapas", google: ["spanish_restaurant", "tapas_restaurant"], parole: /spagnol|tapas|paella/i },
      { id: "messicano", emoji: "🌮", label: "Messicano", query: "ristorante messicano", google: ["mexican_restaurant"], parole: /messican|tacos|burrito/i },
      { id: "peruviano", emoji: "🐠", label: "Peruviano", query: "ristorante peruviano", google: ["peruvian_restaurant"], parole: /peruvian|ceviche|nikkei/i },
      { id: "burger", emoji: "🍔", label: "Burger", query: "hamburgeria", google: ["hamburger_restaurant", "american_restaurant"], nome: /burger/i, parole: /burger|hamburger|american/i },
      { id: "barbecue", emoji: "🍖", label: "Barbecue", query: "barbecue", google: ["barbecue_restaurant"], nome: /\bbbq\b|barbecue|smokehouse/i, parole: /barbecue|\bbbq\b|affumicat/i },
      { id: "africano", emoji: "🌍", label: "Africano", query: "ristorante etiope", google: ["african_restaurant", "ethiopian_restaurant"], parole: /african|etiop|eritre|senegal|marocchin|couscous/i },
    ],
  },
  {
    id: "diete", titolo: "Diete", emoji: "🥗",
    tipi: [
      { id: "vegetariano", emoji: "🥗", label: "Vegetariano", query: "ristorante vegetariano", google: ["vegetarian_restaurant"], parole: /vegetar/i },
      { id: "vegano", emoji: "🌱", label: "Vegano", query: "ristorante vegano", google: ["vegan_restaurant"], parole: /vegan/i },
      { id: "celiaco", emoji: "🌾", label: "Senza glutine", query: "senza glutine", google: [], nome: /gluten\s*free|senza\s+glutine/i, parole: /glutine|celiac|gluten/i },
      { id: "healthy", emoji: "🥙", label: "Healthy e poke", query: "poke healthy", google: ["juice_shop", "acai_shop"], nome: /pok[eé]|healthy|salad/i, parole: /pok[eé]|healthy|insalat|salad|bowl/i },
    ],
  },
  {
    id: "veloce", titolo: "Veloce", emoji: "🥪",
    tipi: [
      { id: "street-food", emoji: "🌯", label: "Street food", query: "street food", google: ["food_court"], parole: /street\s*food|cibo\s+di\s+strada/i },
      { id: "paninoteca", emoji: "🥪", label: "Paninoteca", query: "paninoteca", google: ["sandwich_shop", "deli"], nome: /panin|sandwich/i, parole: /panin|sandwich|tramezzin/i },
      { id: "piadineria", emoji: "🫓", label: "Piadineria", query: "piadineria", google: [], nome: /piadin/i, parole: /piadin/i },
      { id: "friggitoria", emoji: "🍤", label: "Fritti", query: "friggitoria", google: [], nome: /friggitori|suppl|arancin|fritt/i, parole: /friggitori|fritt|suppl|arancin/i },
      { id: "kebab", emoji: "🥙", label: "Kebab", query: "kebab", google: [], nome: /kebab|kebap|d[oö]ner/i, parole: /kebab|kebap|d[oö]ner/i },
      { id: "fast-food", emoji: "🍟", label: "Fast food", query: "fast food", google: ["fast_food_restaurant"], parole: /fast\s*food/i },
    ],
  },
  {
    id: "dolci", titolo: "Dolci & caffè", emoji: "🍰",
    tipi: [
      { id: "colazione", emoji: "☕", label: "Colazione al bar", query: "colazione bar", google: ["breakfast_restaurant", "cafe"], parole: /colazion|cornett|cappuccin/i },
      { id: "specialty", emoji: "🫘", label: "Caffè specialty", query: "caffè di specialità", google: ["coffee_shop"], parole: /specialty|specialit[aà]|caff[eè]\s+filtr|espresso\s+bar/i },
      { id: "brunch", emoji: "🥞", label: "Brunch", query: "brunch", google: ["brunch_restaurant"], nome: /brunch/i, parole: /brunch/i },
      { id: "pasticceria", emoji: "🍰", label: "Pasticceria", query: "pasticceria", google: ["pastry_shop", "cake_shop", "dessert_shop", "confectionery"], nome: /pasticc/i, parole: /pasticc|dolc|maritozz|cannol/i },
      { id: "gelateria", emoji: "🍦", label: "Gelateria", query: "gelateria", google: ["ice_cream_shop"], nome: /gelat/i, parole: /gelat/i },
      { id: "forno", emoji: "🥐", label: "Forno", query: "forno bakery", google: ["bakery"], nome: /\bforno|panific|bakery/i, parole: /\bforno|panific|bakery|panetteri/i },
      { id: "cioccolateria", emoji: "🍫", label: "Cioccolateria", query: "cioccolateria", google: ["chocolate_shop", "chocolate_factory"], nome: /cioccolat|chocolat/i, parole: /cioccolat|chocolat/i },
    ],
  },
  {
    id: "bere", titolo: "Bere", emoji: "🍸",
    tipi: [
      { id: "cocktail", emoji: "🍸", label: "Cocktail bar", query: "cocktail bar", google: ["cocktail_bar"], parole: /cocktail|mixolog/i },
      { id: "speakeasy", emoji: "🗝️", label: "Speakeasy", query: "speakeasy", google: [], nome: /speakeasy/i, parole: /speakeasy|nascost|segret/i },
      { id: "vini-naturali", emoji: "🍷", label: "Enoteca e vini", query: "enoteca vini naturali", google: ["wine_bar"], nome: /enotec|vineri|wine/i, parole: /enotec|vin[oi]\b|wine|calice|vineri/i },
      { id: "pub", emoji: "🍺", label: "Pub", query: "pub", google: ["pub", "irish_pub", "gastropub", "sports_bar"], nome: /\bpub\b/i, parole: /\bpub\b/i },
      { id: "birra-artigianale", emoji: "🍻", label: "Birra artigianale", query: "birra artigianale", google: ["brewery", "brewpub", "beer_garden"], nome: /birr|brew|beer/i, parole: /birr|beer|brew/i },
      { id: "rooftop", emoji: "🌇", label: "Rooftop", query: "rooftop", google: [], nome: /rooftop|terrazz/i, parole: /rooftop|terrazz|tetti|panoramic/i },
      { id: "aperitivo", emoji: "🍹", label: "Aperitivo", query: "aperitivo", google: [], parole: /aperitiv|spritz|apericena/i },
      { id: "lounge", emoji: "🎷", label: "Musica dal vivo", query: "locale musica dal vivo", google: ["lounge_bar", "jazz_club", "live_music_venue"], nome: /jazz|lounge/i, parole: /musica|jazz|live|lounge|concert/i },
    ],
  },
];

export const TIPI_LOCALE: TipoLocale[] = GRUPPI_LOCALE.flatMap((g) => g.tipi);
const PER_ID = new Map(TIPI_LOCALE.map((t) => [t.id, t]));
export const tipoLocale = (id: string): TipoLocale | null => PER_ID.get(id) ?? null;

/** Solo id del catalogo, senza doppioni, nell'ordine dato (al massimo tutti). */
export function amatiValidi(raw: unknown): string[] {
  return Array.isArray(raw) ? [...new Set(raw.filter((x): x is string => typeof x === "string" && PER_ID.has(x)))] : [];
}

/** Tabella catalogo → tipi Google Places (per chi la legge da fuori: ricerca, analisi). */
export const TIPI_GOOGLE: Record<string, string[]> = Object.fromEntries(TIPI_LOCALE.map((t) => [t.id, t.google]));

/** Il locale è di questo tipo secondo Google (tipi, categoria o nome)? Nessuna deduzione dalle recensioni. */
export function localeDiTipo(t: TipoLocale, p: { name: string; category?: string | null; types?: string[] | null }): boolean {
  const tipi = new Set([p.category ?? "", ...(p.types ?? [])]);
  if (t.google.some((g) => tipi.has(g))) return true;
  return !!t.nome && t.nome.test(p.name);
}

// Parole che dicono già che posto si cerca, oltre al catalogo ("bar", "caffè", "enoteca"): la frase vince.
const TIPO_GENERICO_SCRITTO = /\b(?:bar|caff[eè]|pub|locale\s+notturno|discotec|club|cucina\s+\w+|ristorante\s+(?:di|\w+an[oa]|\w+es[ea]|\w+ic[oa]))\b/i;

/** La frase dice già un tipo di posto o di cucina? Allora i gusti non cambiano l'ordine (la richiesta vince). */
export function fraseDiceTipo(query: string): boolean {
  return TIPI_LOCALE.some((t) => t.parole?.test(query)) || TIPO_GENERICO_SCRITTO.test(query);
}

/** Etichette leggibili, minuscole, per "per te" e per l'AI ("pizzeria", "sushi"). */
export const etichetteAmati = (ids: string[]): string[] => ids.map((id) => PER_ID.get(id)?.label.toLowerCase()).filter((x): x is string => !!x);

/**
 * Frase generica ("cena stasera", "dove mangio", "compleanno di mio papà"): i locali di un tipo che la persona
 * ama salgono un poco. Riordino stabile, mai esclusioni; un locale "di massa" (isMass) non sale per questo
 * (VISIONE: il gusto della persona, non il più popolare). Sale al massimo di `passo` posizioni: l'ordine di
 * Google e dei riordini precedenti resta la base.
 */
export function suPerGusti<T extends { name: string; category?: string | null; types?: string[] | null }>(
  places: T[],
  amati: string[],
  isMass: (p: T) => boolean,
  passo = 3,
): { places: T[]; saliti: string[]; usati: string[] } {
  const tipi = amati.map((id) => PER_ID.get(id)).filter((t): t is TipoLocale => !!t);
  if (tipi.length === 0 || places.length < 3) return { places, saliti: [], usati: [] };
  const tipoDi = (p: T) => (isMass(p) ? null : tipi.find((t) => localeDiTipo(t, p)) ?? null);
  const hit = places.map(tipoDi);
  const n = hit.filter(Boolean).length;
  // Tutti o nessuno dei tipi amati: l'ordine non cambia (non c'è niente da far emergere).
  if (n === 0 || n === places.length) return { places, saliti: [], usati: [] };
  // Punteggio = posizione, meno `passo` per chi combacia: ordinamento stabile (a parità vince l'ordine di prima).
  const ordine = places.map((p, i) => ({ p, i, s: i - (hit[i] ? passo + 0.5 : 0) })).sort((a, b) => a.s - b.s || a.i - b.i);
  const saliti = ordine.filter((x, k) => hit[x.i] && k < x.i).map((x) => x.p.name);
  if (saliti.length === 0) return { places, saliti: [], usati: [] };
  const usati = [...new Set(ordine.filter((x, k) => hit[x.i] && k < x.i).map((x) => hit[x.i]!.label.toLowerCase()))];
  return { places: ordine.map((x) => x.p), saliti, usati };
}
