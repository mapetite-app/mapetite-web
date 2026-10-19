// "Sorprendimi" (piano 2.5): UN posto mai provato che probabilmente ti piace, con il perché.
// Una sola ricerca Google (la stessa /api/search della ricerca con i filtri, primo tempo senza AI),
// costruita dai tuoi gusti, dalla zona e dal momento della giornata. "Un altro" pesca dagli altri
// risultati della stessa ricerca: zero chiamate in più. Il perché è fatto solo di dati veri
// (i tuoi salvati, i gusti dell'onboarding, voto e recensioni Google, orari Google): niente testo inventato.
import { categoryLabel } from "@/lib/category-label";
import { CUISINES } from "@/lib/preferences";
import { isGem } from "@/lib/gem";
import { massPredicate, MASS_MIN_COUNT } from "@/lib/mainstream";
import { OPINION_DISLIKE, OPINION_LIKE } from "@/lib/tags";

export const STATE_DONE = "Già visitato";

export type Slot = "colazione" | "pranzo" | "pomeriggio" | "aperitivo" | "cena" | "notte";
export function slotOf(d: Date): Slot {
  const h = d.getHours();
  if (h >= 6 && h < 11) return "colazione";
  if (h >= 11 && h < 15) return "pranzo";
  if (h >= 15 && h < 18) return "pomeriggio";
  if (h >= 18 && h < 20) return "aperitivo";
  if (h >= 20 && h < 23) return "cena";
  return "notte";
}

// Famiglie di locali per capire cosa ha senso proporre adesso (una trattoria alle 8 di mattina no).
type Family = "colazione" | "dolce" | "bere" | "pasto";
const FAMILY_BY_LABEL: Record<string, Family> = {
  "Caffè": "colazione", "Caffetteria": "colazione", "Colazione": "colazione", "Brunch": "colazione", "Forno": "colazione",
  "Pasticceria": "dolce", "Gelateria": "dolce", "Dolci": "dolce", "Cioccolateria": "dolce", "Dolciumi": "dolce", "Sala da tè": "dolce",
  "Bar": "bere", "Cocktail bar": "bere", "Wine bar": "bere", "Lounge bar": "bere", "Pub": "bere", "Enoteca": "bere", "Birreria": "bere",
  "Discoteca": "bere",
};
function familyOf(label: string): Family {
  return FAMILY_BY_LABEL[label] ?? "pasto";
}
const SLOT_FAMILIES: Record<Slot, Family[]> = {
  colazione: ["colazione"],
  pranzo: ["pasto"],
  pomeriggio: ["dolce", "colazione"],
  aperitivo: ["bere", "pasto"],
  cena: ["pasto", "bere"],
  notte: ["bere"],
};

// Senza gusti: cosa cercare in questo momento. Testo per Google + come lo si dice nel perché.
const SLOT_QUERY: Record<Slot, { q: string; label: string }> = {
  colazione: { q: "colazione cornetti", label: "colazione" },
  pranzo: { q: "trattoria pranzo", label: "pranzo" },
  pomeriggio: { q: "gelateria artigianale", label: "una pausa dolce" },
  aperitivo: { q: "aperitivo", label: "l'aperitivo" },
  cena: { q: "ristorante cena", label: "cena" },
  notte: { q: "cocktail bar", label: "un drink" },
};

const CUISINE_QUERY: Record<string, string> = {
  romana_laziale: "trattoria romana", italiana: "trattoria", pizza: "pizzeria", pesce: "ristorante di pesce",
  giapponese: "ristorante giapponese", cinese: "ristorante cinese", indiana: "ristorante indiano",
  messicana: "ristorante messicano", mediorientale: "ristorante mediorientale", vegetariana: "ristorante vegetariano",
  street_food: "street food",
};

export type SavedForTaste = { googlePlaceId: string | null; category: string | null; tags: string[] };
export type Prefs = { cuisines: string[]; priceRange: string | null } | null;

export type SurprisePlan = {
  query: string;      // testo per Google
  reason: string;     // primo pezzo del perché (dato vero)
  source: "salvati" | "gusti" | "momento";
  maxPriceLevel?: number;
};

// Il tipo di posto che salvi e apprezzi di più, tra quelli adatti a quest'ora.
// Peso: "Mi è piaciuto" 3, "Già visitato" 2, gli altri salvati 1; "Non fa per me" non conta.
export function planSurprise(saved: SavedForTaste[], prefs: Prefs, now: Date): SurprisePlan {
  const slot = slotOf(now);
  const allowed = SLOT_FAMILIES[slot];
  const maxPriceLevel = prefs?.priceRange === "€" ? 2 : undefined;
  const score = new Map<string, { w: number; n: number; liked: number }>();
  for (const s of saved) {
    if (s.tags.includes(OPINION_DISLIKE)) continue;
    const label = categoryLabel(s.category);
    if (!label || label === "Negozio") continue;
    const liked = s.tags.includes(OPINION_LIKE);
    const w = liked ? 3 : s.tags.includes(STATE_DONE) ? 2 : 1;
    const cur = score.get(label) ?? { w: 0, n: 0, liked: 0 };
    score.set(label, { w: cur.w + w, n: cur.n + 1, liked: cur.liked + (liked ? 1 : 0) });
  }
  const best = [...score.entries()]
    .filter(([label, v]) => allowed.includes(familyOf(label)) && v.w >= 2)
    .sort((a, b) => b[1].w - a[1].w || b[1].n - a[1].n)[0];
  if (best) {
    const [label, v] = best;
    const kind = label.toLowerCase();
    // "Ristorante" da solo è troppo generico per dire qualcosa: si cerca e si spiega lo stesso.
    const reason = v.liked > 0
      ? `Ti ${v.liked === 1 ? "è piaciuto" : "sono piaciuti"} ${v.liked === 1 ? "un posto" : `${v.liked} posti`} così (${kind})`
      : `Come ${v.n} dei tuoi salvati (${kind})`;
    return { query: label, reason, source: "salvati", maxPriceLevel };
  }
  // Gusti dell'onboarding: solo se a quest'ora si mangia (pranzo, aperitivo, cena).
  const cuisine = prefs?.cuisines.find((c) => CUISINE_QUERY[c]);
  if (cuisine && allowed.includes("pasto")) {
    const label = CUISINES.find((c) => c.value === cuisine)?.label ?? cuisine;
    return { query: CUISINE_QUERY[cuisine], reason: `Dai tuoi gusti: ${label.toLowerCase()}`, source: "gusti", maxPriceLevel };
  }
  const m = SLOT_QUERY[slot];
  return { query: m.q, reason: `Adatto all'ora: ${m.label}`, source: "momento", maxPriceLevel };
}

// Risultato di /api/search (primo tempo): solo i campi che servono qui e alla scheda della mappa.
export type SurprisePlace = {
  id: string; name: string; category: string | null; address: string | null;
  lat: number | null; lng: number | null; rating: number | null; userRatingCount: number | null;
  priceLevel: number | null; openNow: boolean | null; websiteUri: string | null; phone: string | null;
  selectedReviews: { text: string }[] | null; editorialSummary?: string | null;
  photoRef?: string | null; photoAuthor?: string | null;
  orari?: [number, number | null][] | null; // orari compatti (src/lib/orari.ts)
  firma?: string; // firma del server per il catalogo (src/lib/catalog-sig.ts)
};

export type Candidate = { place: SurprisePlace; why: string; gem: boolean };

// Dai risultati della ricerca ai candidati: mai un tuo salvato, mai un locale di massa (molte più
// recensioni degli altri risultati, oppure oltre MASS_MIN_COUNT: un posto con migliaia di recensioni
// non è una sorpresa), sempre sopra il pavimento qualità (già applicato da Google + /api/search).
// Prima i 💎 poco conosciuti, poi gli aperti adesso; i chiusi (secondo Google) in fondo.
export function pickCandidates(results: SurprisePlace[], savedGoogleIds: Set<string>, reason: string): Candidate[] {
  const located = results.filter((p) => p.lat != null && p.lng != null);
  const isMass = massPredicate(located);
  const pool = located.filter((p) => !savedGoogleIds.has(p.id) && !isMass(p) && (p.userRatingCount ?? 0) < MASS_MIN_COUNT);
  const scored = pool.map((p, i) => {
    const gem = isGem(p.rating, p.userRatingCount);
    const s = (gem ? 2 : 0) + (p.openNow === true ? 1 : p.openNow === false ? -3 : 0);
    const why = [reason, gem ? "💎 Poco conosciuto" : null, p.openNow === true ? "Aperto ora" : null].filter(Boolean).join(" · ");
    return { c: { place: p, why, gem }, s, i };
  });
  // Ordine stabile: a parità resta quello di /api/search (voto, con le recensioni che contano fino a 150).
  return scored.sort((a, b) => b.s - a.s || a.i - b.i).map((x) => x.c);
}

// Freno alla quota Google: la stessa zona (~2 km) nello stesso momento della giornata, entro 30 minuti,
// riusa la ricerca già fatta. Nel telefono (localStorage), mai sui nostri server.
export const MEMORY_MS = 30 * 60 * 1000;
const KEY = "mapetite.sorpresa";
export type SurpriseMemory = {
  key: string;
  at: number;
  plan: SurprisePlan;
  results: SurprisePlace[];
  gruppi: { places: unknown[]; token: string }[];
  verdicts: Record<string, string>;
  currentId: string | null; // il locale mostrato (per ritrovarlo tornando indietro dalla scheda)
};

export function memoryKey(lat: number, lng: number, now: Date, who: string | null): string {
  return `${Math.round(lat * 50) / 50},${Math.round(lng * 50) / 50}|${slotOf(now)}|${who ?? "anonimo"}`;
}

export function loadMemory(key?: string): SurpriseMemory | null {
  try {
    const m = JSON.parse(localStorage.getItem(KEY) ?? "null") as SurpriseMemory | null;
    if (!m || typeof m.at !== "number" || Date.now() - m.at > MEMORY_MS || !Array.isArray(m.results)) return null;
    if (key && m.key !== key) return null;
    return m;
  } catch {
    return null;
  }
}

export function saveMemory(m: SurpriseMemory): void {
  try { localStorage.setItem(KEY, JSON.stringify(m)); } catch { /* storage non disponibile: si rifà la ricerca la prossima volta */ }
}

// Per "Apri scheda" nella mappa: il locale e il suo verdetto dalla memoria, senza nuove chiamate.
export function surpriseFromMemory(googleId: string): { place: SurprisePlace; verdict: string | null } | null {
  const m = loadMemory();
  const place = m?.results.find((p) => p.id === googleId);
  return place && m ? { place, verdict: m.verdicts[googleId] ?? null } : null;
}
