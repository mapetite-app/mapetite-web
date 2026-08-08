/**
 * scripts/takeout-score.ts — DIAGNOSTICO ONE-OFF, non codice di produzione.
 *
 * Legge tmp-takeout/resolved.json e assegna a ogni luogo un punteggio di
 * affidabilità del match Takeout↔Google, classificandolo ALTA/MEDIA/BASSA.
 * NESSUNA chiamata API, NESSUNA scrittura su DB. Salva tmp-takeout/scored.json.
 *
 * Run: npx tsx scripts/takeout-score.ts
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import type { GooglePlace } from "./takeout-probe"; // solo tipo → elided a runtime

const IN_FILE = "tmp-takeout/resolved.json";
const OUT_FILE = "tmp-takeout/scored.json";

// Soglie di similarità nome (0..1). Motivate sotto.
const SIM_HIGH = 0.85; // "molto simile"
const SIM_LOW = 0.5;   // sotto → "poco simile"
// Un paese è "anomalo" se compare pochissimo nell'intero dataset dell'utente:
// singleton/coppie sono probabili mismatch (Google ha risolto in un paese dove
// l'utente non salva nulla). Cluster di viaggio (BR, ES, TR, GR, US) NON lo sono.
const RARE_COUNTRY_MAX_COUNT = 2;

type ResolvedEntry = {
  titolo: string;
  origine: string[];
  numRisultati: number;
  risultati: GooglePlace[];
};
type ResolvedMap = Record<string, ResolvedEntry>;

type Tier = "ALTA" | "MEDIA" | "BASSA";
type Scored = {
  titolo: string;
  origine: string[];
  numRisultati: number;
  tier: Tier;
  score: number;        // similarità nome 0..1, 2 decimali
  fnb: boolean;         // food & beverage secondo primaryType
  country: string | null;
  rareCountry: boolean;
  googleId: string | null;
  googleName: string | null;
  googleAddress: string | null;
  primaryType: string | null;
};

// ── Normalizzazione: lowercase, accenti rimossi, punteggiatura → spazio,
//    whitespace collassato. \p{L}\p{N} tiene lettere/numeri di ogni alfabeto.
const normalize = (s: string): string =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

// ── Levenshtein classico (DP a due righe).
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  let cur = new Array<number>(b.length + 1);
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, cur] = [cur, prev];
  }
  return prev[b.length];
}

// ── Descrittori generici (categoria + articoli/preposizioni): non portano
//    identità, vanno scartati prima del contenimento sui token.
const STOPWORDS = new Set([
  "ristorante", "ristorantino", "trattoria", "osteria", "hosteria", "locanda",
  "pizzeria", "pizza", "bar", "ristobar", "enoteca", "birreria", "paninoteca",
  "gelateria", "pasticceria", "caffe", "caffetteria", "cafe", "bistrot", "bistro",
  "cucina", "vino", "vini", "grill", "griglia", "restaurant", "agriturismo",
  "hotel", "albergo", "resort", "spiaggia", "beach", "club", "cantina", "cantine",
  "via", "viale", "piazza", "corso", "del", "della", "dei", "degli", "con",
]);

const MIN_CONTAIN_CHARS = 6;    // sottostringa: lunghezza minima del nome più corto
const MIN_SOLO_TOKEN_CHARS = 5; // token containment con set piccolo di 1 solo token

// ── Containment: alto quando un nome è "dentro" l'altro pur con lunghezze molto
//    diverse. Due percorsi, entrambi con guard contro i falsi positivi dei nomi
//    corti; ritorna 0 se nessuno scatta (così NON promuove i mismatch veri).
function containment(a: string, b: string): number {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return 0;

  // (1) Sottostringa despaced: gestisce concatenazioni/punteggiatura che spezza
  //     i token ("ilSanlorenzo" → "Il San Lorenzo", "Apoteca" dentro un titolo lungo).
  const da = na.replace(/ /g, "");
  const db = nb.replace(/ /g, "");
  const shorter = da.length <= db.length ? da : db;
  const longer = da.length <= db.length ? db : da;
  if (shorter.length >= MIN_CONTAIN_CHARS && longer.includes(shorter)) return 0.95;

  // (2) Token significativi: droppa i descrittori generici ("Pizzeria Modus" →
  //     {modus}) e richiede che il set piccolo sia INTERAMENTE nel grande.
  const sig = (s: string) =>
    new Set([...s.split(" ")].filter((t) => t.length >= 3 && !STOPWORDS.has(t)));
  const sa = sig(na);
  const sb = sig(nb);
  if (sa.size === 0 || sb.size === 0) return 0;
  const small = sa.size <= sb.size ? sa : sb;
  const big = sa.size <= sb.size ? sb : sa;
  let contained = 0;
  for (const t of small) if (big.has(t)) contained++;
  if (contained !== small.size) return 0; // contenimento COMPLETO richiesto
  // Guard: un singolo token corto è un falso positivo facile → scarta.
  if (small.size === 1 && [...small][0].length < MIN_SOLO_TOKEN_CHARS) return 0;
  return 0.9;
}

// ── Similarità = MAX(Levenshtein normalizzata, Dice sui token, Containment).
//    Motivazione: nessuna singola metrica è robusta da sola per nomi di locali.
//    - Levenshtein normalizzata cattura typo/accenti/differenze minori di
//      carattere ("Trattoria della Stampa" vs "Trattoria Della Stampa").
//    - Dice sui token cattura parole aggiunte/riordinate, dove Levenshtein
//      crolla ("Gran Folies" vs "Beach Club Gran Folies" condividono i token).
//    - Containment recupera i nomi "dentro" un titolo verboso ("Apoteca" dentro
//      'Ristorante "Apoteca..." - Flaminio, Roma'), dove Lev e Dice crollano per
//      la differenza di lunghezza. Guardato per non promuovere i mismatch veri.
//    Prendere il massimo evita i falsi-bassi tipici di ciascuna delle tre.
function similarity(a: string, b: string): number {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na && !nb) return 1;
  if (!na || !nb) return 0;
  const levSim = 1 - levenshtein(na, nb) / Math.max(na.length, nb.length);
  const ta = new Set(na.split(" "));
  const tb = new Set(nb.split(" "));
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  const dice = (2 * inter) / (ta.size + tb.size);
  return Math.max(levSim, dice, containment(a, b));
}

// ── Food & beverage dal primaryType: suffisso _restaurant OR set esplicito.
const FNB_EXPLICIT = new Set([
  "restaurant",
  "bar", "wine_bar", "cocktail_bar", "lounge_bar", "pub", "gastropub", "bar_and_grill",
  "cafe", "coffee_shop", "coffee_roastery", "tea_house", "cafeteria",
  "bakery", "pastry_shop", "cake_shop", "confectionery", "ice_cream_shop",
  "dessert_shop", "chocolate_shop", "candy_store", "deli", "sandwich_shop", "salad_shop",
  "meal_takeaway", "meal_delivery", "food_delivery", "food_court",
  "bistro", "winery", "brewery",
]);
const isFnb = (primaryType: string | null): boolean =>
  primaryType != null && (primaryType.endsWith("_restaurant") || FNB_EXPLICIT.has(primaryType));

// ── Paese ISO dal componente addressComponents con types:["country"].
function countryOf(top: GooglePlace | undefined): string | null {
  const cc = (top?.addressComponents ?? []).find((c) => (c.types ?? []).includes("country"));
  return cc?.shortText ?? null;
}

function main() {
  if (!existsSync(IN_FILE)) {
    console.error(`[score] ${IN_FILE} non trovato. Esegui prima takeout-resolve.ts`);
    process.exit(1);
  }
  const resolved = JSON.parse(readFileSync(IN_FILE, "utf8")) as ResolvedMap;
  const entries = Object.values(resolved);

  // Passo 1: distribuzione paesi (sul TOP result) per la regola "paese raro".
  const countryTotals = new Map<string, number>();
  for (const e of entries) {
    if (e.numRisultati === 0) continue;
    const c = countryOf(e.risultati[0]);
    if (c) countryTotals.set(c, (countryTotals.get(c) ?? 0) + 1);
  }

  // Passo 2: score + tier per ogni entry.
  const scored: Record<string, Scored> = {};
  for (const e of entries) {
    const top = e.numRisultati > 0 ? e.risultati[0] : undefined;
    const country = countryOf(top);
    const rareCountry =
      country != null && (countryTotals.get(country) ?? 0) <= RARE_COUNTRY_MAX_COUNT;
    const googleName = top?.displayName?.text ?? null;
    const score = top && googleName ? Math.round(similarity(e.titolo, googleName) * 100) / 100 : 0;
    const primaryType = top?.primaryType ?? null;

    let tier: Tier;
    if (e.numRisultati === 0) {
      tier = "BASSA"; // nessun match da valutare
    } else if (rareCountry) {
      tier = "BASSA"; // paese anomalo → conferma umana (regola esplicita)
    } else if (score >= SIM_HIGH && e.numRisultati === 1) {
      tier = "ALTA";
    } else if (score < SIM_LOW) {
      tier = "BASSA";
    } else {
      tier = "MEDIA"; // nome simile ma più risultati, o differenze minori
    }

    scored[e.titolo] = {
      titolo: e.titolo,
      origine: e.origine,
      numRisultati: e.numRisultati,
      tier,
      score,
      fnb: isFnb(primaryType),
      country,
      rareCountry,
      googleId: top?.id ?? null,
      googleName,
      googleAddress: top?.formattedAddress ?? null,
      primaryType,
    };
  }

  writeFileSync(OUT_FILE, JSON.stringify(scored, null, 2));

  // ── Output.
  const all = Object.values(scored);
  const byTier = (t: Tier) => all.filter((s) => s.tier === t);
  const alta = byTier("ALTA");
  const media = byTier("MEDIA");
  const bassa = byTier("BASSA");
  const fnbCount = (arr: Scored[]) => arr.filter((s) => s.fnb).length;

  console.log(`[score] totale=${all.length}  (salvato in ${OUT_FILE})\n`);
  console.log(`ALTA  ${String(alta.length).padStart(3)}  di cui food&bev ${fnbCount(alta)}`);
  console.log(`MEDIA ${String(media.length).padStart(3)}  di cui food&bev ${fnbCount(media)}`);
  console.log(`BASSA ${String(bassa.length).padStart(3)}  di cui food&bev ${fnbCount(bassa)}`);

  const reason = (s: Scored): string =>
    s.numRisultati === 0 ? "0 risultati"
      : s.rareCountry ? `paese raro: ${s.country}`
      : `score basso: ${s.score}`;

  console.log(`\n─── BASSA (elenco completo, ${bassa.length}) — richiede conferma umana ───`);
  for (const s of [...bassa].sort((a, b) => a.score - b.score)) {
    console.log(
      `${s.titolo} -> ${s.googleName ?? "—"} | ${s.googleAddress ?? "—"} | score=${s.score} [${reason(s)}]`,
    );
  }

  console.log(`\n─── MEDIA (10 esempi, ordinati per score desc) ───`);
  for (const s of [...media].sort((a, b) => b.score - a.score).slice(0, 10)) {
    console.log(
      `${s.titolo} -> ${s.googleName ?? "—"} | ${s.googleAddress ?? "—"} | score=${s.score} | risultati=${s.numRisultati}`,
    );
  }
}

main();
