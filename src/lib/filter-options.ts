// Scelte del pannello Filtri oltre al tipo di locale: cucina, occasione, caratteristiche, orario.
// Usate dal telefono (pannello, testo della ricerca, salvati) e dal server (filtri sui dati Google).
//
// Due modi di far contare una scelta, entrambi a costo zero:
// - "query": parole aggiunte al testo della ricerca Google ("ristorante cucina romana terrazza");
// - "attr": campo booleano di Google (outdoorSeating, allowsDogs…). Stanno nella stessa fascia
//   "Enterprise + Atmosphere" già pagata per reviews ed editorialSummary: nessun costo in più.
//   Si esclude un locale SOLO se Google dice esplicitamente false: dato assente = il locale resta.

export type GoogleAttribute =
  | "outdoorSeating"
  | "allowsDogs"
  | "servesVegetarianFood"
  | "reservable"
  | "goodForGroups"
  | "goodForChildren"
  | "liveMusic"
  | "servesCocktails"
  | "takeout";

export const GOOGLE_ATTRIBUTES: GoogleAttribute[] = [
  "outdoorSeating", "allowsDogs", "servesVegetarianFood", "reservable", "goodForGroups",
  "goodForChildren", "liveMusic", "servesCocktails", "takeout",
];

type Option = { id: string; label: string; emoji: string; query?: string; attr?: GoogleAttribute[] };

// Cucina: entra nel testo della query. "types" = tipi Google che la riconoscono anche nei salvati
// (le cucine regionali italiane non hanno un tipo: nei salvati non si possono filtrare).
export const CUISINES: (Option & { types?: string[] })[] = [
  { id: "romana", label: "Romana", emoji: "🍝", query: "cucina romana" },
  { id: "napoletana", label: "Napoletana", emoji: "🍕", query: "cucina napoletana" },
  { id: "giapponese", label: "Giapponese", emoji: "🍣", query: "cucina giapponese", types: ["japanese_restaurant", "sushi_restaurant", "ramen_restaurant"] },
  { id: "pugliese", label: "Pugliese", emoji: "🫒", query: "cucina pugliese" },
  { id: "siciliana", label: "Siciliana", emoji: "🍋", query: "cucina siciliana" },
  { id: "cinese", label: "Cinese", emoji: "🥟", query: "cucina cinese", types: ["chinese_restaurant"] },
  { id: "toscana", label: "Toscana", emoji: "🍷", query: "cucina toscana" },
  { id: "milanese", label: "Milanese", emoji: "🍚", query: "cucina milanese" },
  { id: "indiana", label: "Indiana", emoji: "🍛", query: "cucina indiana", types: ["indian_restaurant"] },
  { id: "messicana", label: "Messicana", emoji: "🌮", query: "cucina messicana", types: ["mexican_restaurant"] },
  { id: "mediorientale", label: "Mediorientale", emoji: "🧆", query: "cucina mediorientale", types: ["middle_eastern_restaurant", "lebanese_restaurant", "turkish_restaurant"] },
  { id: "greca", label: "Greca", emoji: "🥙", query: "cucina greca", types: ["greek_restaurant"] },
  { id: "americana", label: "Americana e burger", emoji: "🍔", query: "hamburger americano", types: ["american_restaurant", "hamburger_restaurant"] },
  { id: "peruviana", label: "Peruviana", emoji: "🐟", query: "cucina peruviana", types: ["peruvian_restaurant"] },
  { id: "thai", label: "Thailandese", emoji: "🍜", query: "cucina thailandese", types: ["thai_restaurant"] },
  { id: "coreana", label: "Coreana", emoji: "🥢", query: "cucina coreana", types: ["korean_restaurant"] },
  { id: "fusion", label: "Fusion", emoji: "✨", query: "cucina fusion" },
];

// Occasione: una sola scelta. Il testo aiuta Google a trovare il posto giusto; per famiglia e
// gruppo c'è anche il campo Google. "tag" = etichetta dei salvati che la rappresenta.
export const OCCASIONS: (Option & { tag?: string })[] = [
  { id: "romantico", label: "Appuntamento romantico", emoji: "💕", query: "romantico", tag: "Romantico" },
  { id: "amici", label: "Con amici", emoji: "🥂", query: "informale per amici", tag: "Con amici" },
  { id: "lavoro", label: "Di lavoro", emoji: "💼", query: "tranquillo per pranzo di lavoro" },
  { id: "famiglia", label: "In famiglia con bambini", emoji: "👨‍👩‍👧", query: "adatto ai bambini", attr: ["goodForChildren"] },
  { id: "solo", label: "Da solo", emoji: "🧍", query: "con bancone" },
  { id: "gruppo", label: "Gruppo numeroso", emoji: "👥", query: "per gruppi numerosi", attr: ["goodForGroups"] },
];

// Caratteristiche: più scelte insieme. Terrazza, vista e senza glutine non hanno un campo Google:
// solo testo. Per cani, prenotazione, gruppi e asporto basta il campo (le parole confondono Google).
export const FEATURES: Option[] = [
  { id: "aperto", label: "All'aperto / dehors", emoji: "🌿", query: "tavoli all'aperto", attr: ["outdoorSeating"] },
  { id: "terrazza", label: "Terrazza / rooftop", emoji: "🌇", query: "terrazza" },
  { id: "vista", label: "Con vista", emoji: "🏞️", query: "con vista" },
  { id: "vegetariano", label: "Vegetariano", emoji: "🥦", query: "opzioni vegetariane", attr: ["servesVegetarianFood"] },
  { id: "vegano", label: "Vegano", emoji: "🌱", query: "vegano", attr: ["servesVegetarianFood"] },
  { id: "senza-glutine", label: "Senza glutine", emoji: "🌾", query: "senza glutine" },
  { id: "cani", label: "Cani ammessi", emoji: "🐕", attr: ["allowsDogs"] },
  { id: "prenotabile", label: "Prenotabile", emoji: "📅", attr: ["reservable"] },
  { id: "gruppi", label: "Adatto ai gruppi", emoji: "👥", attr: ["goodForGroups"] },
  { id: "musica", label: "Musica dal vivo", emoji: "🎶", query: "musica dal vivo", attr: ["liveMusic"] },
  { id: "cocktail", label: "Cocktail", emoji: "🍸", query: "cocktail", attr: ["servesCocktails"] },
  { id: "asporto", label: "Da asporto", emoji: "🥡", attr: ["takeout"] },
];

// "Aperto a un'ora scelta": orari presi da Google (currentOpeningHours/regularOpeningHours, fascia
// Enterprise, sotto quella già pagata). Il giorno si calcola al momento della ricerca.
export const OPEN_AT: { id: string; label: string; summary: string; dayOffset: number; hour: number; minute: number }[] = [
  { id: "stasera", label: "Stasera alle 21", summary: "aperti stasera alle 21", dayOffset: 0, hour: 21, minute: 0 },
  { id: "domani-pranzo", label: "Domani a pranzo", summary: "aperti domani a pranzo", dayOffset: 1, hour: 13, minute: 0 },
  { id: "domani-cena", label: "Domani a cena", summary: "aperti domani a cena", dayOffset: 1, hour: 21, minute: 0 },
];

// Momento della settimana (giorno 0 = domenica, come Google) per una scelta "Aperto a…".
export type WeekTime = { day: number; hour: number; minute: number };
export function openAtSlot(id: string, now: Date = new Date()): WeekTime | null {
  const o = OPEN_AT.find((x) => x.id === id);
  if (!o) return null;
  return { day: (now.getDay() + o.dayOffset) % 7, hour: o.hour, minute: o.minute };
}

const byId = <T extends { id: string }>(list: T[], ids: string[]): T[] =>
  ids.map((id) => list.find((x) => x.id === id)).filter((x): x is T => x != null);

// Parole da aggiungere alla query Google, senza ripetizioni ("vegetariano" e "vegano" insieme).
export function filterQueryWords(cuisines: string[], occasion: string | null, features: string[]): string {
  const words = [
    ...byId(CUISINES, cuisines).map((c) => c.query),
    ...(occasion ? byId(OCCASIONS, [occasion]).map((o) => o.query) : []),
    ...byId(FEATURES, features).map((f) => f.query),
  ].filter((w): w is string => !!w);
  return [...new Set(words)].join(" ");
}

// Campi Google richiesti dalle scelte (solo id validi: il corpo della richiesta arriva dal telefono).
export function requiredAttributes(occasion: string | null, features: string[]): GoogleAttribute[] {
  const attrs = [
    ...(occasion ? byId(OCCASIONS, [occasion]).flatMap((o) => o.attr ?? []) : []),
    ...byId(FEATURES, features).flatMap((f) => f.attr ?? []),
  ];
  return [...new Set(attrs)];
}

// Il locale è aperto in quel momento? null = non si sa (orari assenti): nel dubbio il locale resta.
type Period = { open?: { day?: number; hour?: number; minute?: number }; close?: { day?: number; hour?: number; minute?: number } };
const WEEK = 7 * 24 * 60;
export function isOpenAt(periods: Period[] | null | undefined, t: WeekTime): boolean | null {
  if (!periods || periods.length === 0) return null;
  const target = t.day * 1440 + t.hour * 60 + t.minute;
  for (const p of periods) {
    if (!p.open || p.open.day == null) continue;
    // Senza chiusura: aperto sempre (Google lo usa per i locali h24).
    if (!p.close || p.close.day == null) return true;
    const o = p.open.day * 1440 + (p.open.hour ?? 0) * 60 + (p.open.minute ?? 0);
    let c = p.close.day * 1440 + (p.close.hour ?? 0) * 60 + (p.close.minute ?? 0);
    if (c <= o) c += WEEK; // chiude dopo la mezzanotte della domenica
    if ((target >= o && target < c) || (target + WEEK >= o && target + WEEK < c)) return true;
  }
  return false;
}
