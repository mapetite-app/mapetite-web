// Serata completa a tappe (piano 1.2): "organizzami sabato sera: aperitivo, cena, dopocena a
// Trastevere" → un percorso con un locale per tappa, distanze e minuti a piedi.
// Tutto senza AI: la frase si riconosce con le parole, l'intento di ogni tappa si costruisce qui
// (nessuna chiamata Haiku per capire la frase). Ogni tappa è UNA ricerca Google, massimo 3 tappe.
// Le distanze sono stime in linea d'aria × fattore: nessuna API di percorsi a pagamento.
// Nessun import con alias: il giro automatico lo importa da Node.

export type TappaKind = "colazione" | "pranzo" | "aperitivo" | "cena" | "dolce" | "gelato" | "dopocena";

type TappaDef = {
  kind: TappaKind;
  label: string;
  emoji: string;
  re: RegExp;
  tipo: string;              // tipo di locale in parole (per "Ho capito")
  query: string;             // testo per Google (senza zona)
  includedType: string | null; // preferenza di tipo Google (non è un filtro stretto)
  order: number;             // ordine nella giornata
};

const TAPPE: TappaDef[] = [
  { kind: "colazione", label: "Colazione", emoji: "☕", re: /\bcolazion[ei]\b|\bcornett[oi]\b|\bcappuccin[oi]\b/, tipo: "bar per la colazione", query: "colazione bar caffetteria", includedType: "cafe", order: 0 },
  { kind: "pranzo", label: "Pranzo", emoji: "🍝", re: /\bpranz[oi]\b/, tipo: "ristorante", query: "ristorante per pranzo", includedType: "restaurant", order: 1 },
  { kind: "aperitivo", label: "Aperitivo", emoji: "🍹", re: /\baperitiv[oi]\b|\bapericena\b|\bspritz\b/, tipo: "bar per l'aperitivo", query: "aperitivo bar", includedType: "bar", order: 2 },
  { kind: "cena", label: "Cena", emoji: "🍽️", re: /\bcen[ae]\b|\bristorante\b|\btrattoria\b|\bosteria\b|\bpizzeria\b|\bpizza\b/, tipo: "ristorante", query: "ristorante per cena", includedType: "restaurant", order: 3 },
  { kind: "dolce", label: "Dolce", emoji: "🍰", re: /\bdolce\b|\bdessert\b|\bpasticceri[ae]\b/, tipo: "pasticceria", query: "pasticceria dolci dessert", includedType: null, order: 4 },
  { kind: "gelato", label: "Gelato", emoji: "🍦", re: /\bgelat[oi]\b|\bgelateri[ae]\b/, tipo: "gelateria", query: "gelateria artigianale", includedType: "ice_cream_shop", order: 4 },
  { kind: "dopocena", label: "Dopocena", emoji: "🍸", re: /\bdopo ?cena\b|\bcocktail\b|\bdrink\b|\bbicchier[ei]\b|\bamaro\b|\bnightcap\b|\bcocktail bar\b/, tipo: "cocktail bar", query: "cocktail bar", includedType: "bar", order: 5 },
];

export const MAX_TAPPE = 3;

// Parole che dicono "organizza un percorso", non un singolo posto.
const TRIGGER = /\bserat[ae]\b|\borganizza(mi|re|ci)?\b|\ba tappe\b|\bin tappe\b|\bgiro (di|dei|per)\b|\bpercorso\b|\bprogramma(mi)?\b|\bitinerario\b/;
// Un solo tipo di posto con "dopo": "cocktail bar dopo cena" resta una ricerca (non due tappe).
// Atmosfera che vale per tutte le tappe (le caratteristiche fisiche no: una terrazza in gelateria non ha senso).
const MODS: [RegExp, string][] = [
  [/\bromantic[aoie]\b|\bper (la mia ragazza|il mio ragazzo)\b|\bappuntamento\b|\bdi coppia\b/, "romantico"],
  [/\bnon turistic[aoie]\b|\bpoco turistic[aoie]\b|\blontan[oa] dai turisti\b/, "non turistico"],
  [/\bautentic[aoie]\b|\bdi quartiere\b/, "autentico"],
  [/\beconomic[aoie]\b|\bspendendo poco\b|\blow cost\b/, "economico"],
  [/\btranquill[aoie]\b|\bsilenzios[aoie]\b/, "tranquillo"],
  [/\bcon amici\b|\btra amici\b|\bin compagnia\b/, "tra amici"],
];

// Parole che seguono "a"/"in" ma non sono una zona.
const NOT_ZONE = new Set([
  "tappe", "piedi", "cena", "pranzo", "colazione", "aperitivo", "dopocena", "sera", "serata", "casa", "mezzanotte",
  "base", "partire", "seguire", "prendere", "bere", "mangiare", "fare", "me", "noi", "due", "tre", "quattro", "cinque",
  "sabato", "domenica", "lunedì", "lunedi", "martedì", "martedi", "mercoledì", "mercoledi", "giovedì", "giovedi", "venerdì", "venerdi",
  "piedi", "zona", "buon", "basso", "poco", "prezzo", "tarda", "notte", "un", "una", "uno", "il", "la", "lo", "le", "gli", "i",
]);

export type TappaPlan = { kind: TappaKind; label: string; emoji: string; tipo: string; includedType: string | null; query: string; queryGoogle: string; requisiti: string[] };
export type SerataPlan = { tappe: TappaPlan[]; zona: string | null; tagliate: string[] };

function norm(text: string): string {
  return text.toLowerCase().replace(/[’`]/g, "'").replace(/[!?.,;:()]+/g, " ").replace(/\s+/g, " ").trim();
}

// La zona scritta: "a Trastevere", "in centro", "zona Navigli", "dalle parti di Campo de' Fiori".
export function zonaOf(raw: string): string | null {
  const re = /(?:^|\s)(?:a|ad|in|zona|in zona|dalle parti di|verso|intorno a|vicino a)\s+((?:[A-Za-zÀ-ÿ][\wÀ-ÿ']*)(?:\s+(?:de'|di|del|della|dei|delle|dello)\s+[\wÀ-ÿ']+|\s+[A-ZÀ-Ý][\wÀ-ÿ']*)*)/g;
  const clean = raw.replace(/[’`]/g, "'").replace(/[!?.,;:()]+/g, " ").replace(/\s+/g, " ");
  for (const m of clean.matchAll(re)) {
    // Parole finali "di/del…" senza nome dopo: si tolgono.
    const z = m[1].replace(/(\s+(de'|di|del|della|dei|delle|dello))+$/i, "").trim();
    const first = z.split(" ")[0].toLowerCase();
    if (NOT_ZONE.has(first) || z.length < 3) continue;
    if (TAPPE.some((t) => t.re.test(first))) continue;
    if (/^\d/.test(z)) continue;
    // "a me" / "vicino a me": non è una zona (si usa la posizione).
    return z.split(" ").map((w) => (/^(de'|di|del|della|dei|delle|dello)$/i.test(w) ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1))).join(" ");
  }
  return null;
}

// null = non è una serata a tappe: si cerca come sempre.
export function serataOf(raw: string): SerataPlan | null {
  const t = norm(raw);
  if (!t) return null;
  const found = TAPPE.filter((d) => d.re.test(t));
  // "cena" e "pizza" sono la stessa tappa; "dolce" e "gelato" pure (si tiene il gelato se nominato).
  const kinds = new Set(found.map((d) => d.kind));
  if (kinds.has("gelato")) kinds.delete("dolce");
  const trigger = TRIGGER.test(t);
  // Un solo tipo di posto ("ristorante per una serata romantica") è una ricerca normale.
  // Due tappe diverse nominate ("aperitivo e cena"): serata, salvo "cocktail bar dopo cena",
  // che descrive un posto solo. Nessuna tappa nominata: serata solo se chiesta come percorso
  // ("organizzami la serata a Monti") → aperitivo, cena, dopocena.
  if (kinds.size === 1) return null;
  const soloDescrizione = !trigger && kinds.size === 2 && kinds.has("dopocena") && kinds.has("cena") && /\bdopo ?cena\b/.test(t) && !/\b(cena|ristorante|trattoria|osteria|pizzeria|pizza)\b/.test(t.replace(/\bdopo ?cena\b/g, ""));
  if (soloDescrizione) return null;
  const organizza = /\borganizza(mi|re|ci)?\b|\bprogramma(mi)?\b|\bpianifica(mi)?\b/.test(t);
  const percorso = /\ba tappe\b|\bin tappe\b|\bitinerario\b|\bpercorso\b/.test(t) || (organizza && /\bserat[ae]\b|\bsera\b|\bstasera\b/.test(t));
  if (kinds.size === 0 && !percorso) return null;
  let defs = kinds.size === 0
    ? TAPPE.filter((d) => d.kind === "aperitivo" || d.kind === "cena" || d.kind === "dopocena")
    : TAPPE.filter((d) => kinds.has(d.kind));
  defs = [...defs].sort((a, b) => a.order - b.order);
  const tagliate = defs.slice(MAX_TAPPE).map((d) => d.label);
  defs = defs.slice(0, MAX_TAPPE);
  const zona = zonaOf(raw);
  const requisiti = MODS.filter(([re]) => re.test(t)).map(([, w]) => w);
  // "Pizza e gelato": la cena è in pizzeria.
  if (/\bpizz/.test(t)) defs = defs.map((d) => (d.kind === "cena" ? { ...d, tipo: "pizzeria", query: "pizzeria", includedType: "pizza_restaurant" } : d));
  const tappe = defs.map((d): TappaPlan => {
    const words = [d.query, ...requisiti].join(" ");
    return {
      kind: d.kind, label: d.label, emoji: d.emoji, tipo: d.tipo, includedType: d.includedType, requisiti,
      // La frase della tappa (quella che il server legge per "tipo fuori tema" e "non turistico").
      query: `${d.label.toLowerCase()}${requisiti.length ? ` ${requisiti.join(" ")}` : ""}${zona ? ` a ${zona}` : ""}`,
      queryGoogle: zona ? `${words} ${zona}` : words,
    };
  });
  return { tappe, zona, tagliate };
}

// L'intento della tappa nel formato di /api/search (SearchIntent): così il server non chiede
// all'AI di capire la frase (nessuna chiamata Haiku per l'intento).
export function intentOfTappa(t: TappaPlan, zona: string | null) {
  return { zona, vicino_a_me: false, tipo: t.tipo, includedType: t.includedType, requisiti: t.requisiti, queryGoogle: t.queryGoogle };
}

// ── Distanze a piedi (stima) ──
export const WALK_FACTOR = 1.3;      // le strade non sono in linea d'aria
export const WALK_M_PER_MIN = 80;    // ~4,8 km/h
export const WALK_OK_M = 1200;       // tappa successiva "comoda a piedi" (in linea d'aria)

type LatLng = { lat: number; lng: number };

export function airMeters(a: LatLng, b: LatLng): number {
  const R = 6_371_000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

export function walkOf(a: LatLng, b: LatLng): { meters: number; minutes: number } {
  const meters = Math.round((airMeters(a, b) * WALK_FACTOR) / 10) * 10;
  return { meters, minutes: Math.max(1, Math.round(meters / WALK_M_PER_MIN)) };
}

export function walkLabel(w: { meters: number; minutes: number }): string {
  const dist = w.meters < 1000 ? `${w.meters} m` : `${(w.meters / 1000).toLocaleString("it-IT", { maximumFractionDigits: 1 })} km`;
  if (w.minutes > 30) return `circa ${dist}: meglio un taxi o i mezzi`;
  return `circa ${dist} · ${w.minutes} min a piedi`;
}

// Ordine dei candidati di una tappa. NON per popolarità (VISIONE.md): si tiene l'ordine di
// Google (pertinenza, già con i turistici in fondo). Dalla seconda tappa in poi prima quelli
// comodi a piedi dalla tappa precedente, sempre nell'ordine di Google; poi gli altri dal più vicino.
// I posti già scelti per altre tappe non si ripetono.
export function orderCandidates<T extends LatLng & { id: string }>(places: T[], prev: LatLng | null, used: Set<string>): T[] {
  const pool = places.filter((p) => !used.has(p.id));
  if (!prev) return pool;
  const near = pool.filter((p) => airMeters(prev, p) <= WALK_OK_M);
  const far = pool.filter((p) => airMeters(prev, p) > WALK_OK_M).sort((a, b) => airMeters(prev, a) - airMeters(prev, b));
  return [...near, ...far];
}

// "Apri il percorso in Google Maps": link gratuito con le tappe come waypoint (a piedi).
export function googleMapsRoute(stops: (LatLng & { id: string; name: string })[]): string | null {
  if (stops.length < 2) return stops.length === 1 ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(stops[0].name)}&query_place_id=${stops[0].id}` : null;
  const ll = (s: LatLng) => `${s.lat},${s.lng}`;
  const first = stops[0];
  const last = stops[stops.length - 1];
  const mid = stops.slice(1, -1);
  const q = new URLSearchParams({ api: "1", origin: ll(first), origin_place_id: first.id, destination: ll(last), destination_place_id: last.id, travelmode: "walking" });
  if (mid.length) {
    q.set("waypoints", mid.map(ll).join("|"));
    q.set("waypoint_place_ids", mid.map((s) => s.id).join("|"));
  }
  return `https://www.google.com/maps/dir/?${q.toString()}`;
}
