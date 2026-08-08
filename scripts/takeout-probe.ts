/**
 * scripts/takeout-probe.ts — DIAGNOSTICO ONE-OFF, non codice di produzione.
 *
 * Valuta la fattibilità dell'import da Google Takeout: campiona 20 nomi dai CSV
 * e interroga Google Places Text Search (solo nome, senza locationBias) per
 * vedere quanti sono risolvibili/ambigui. NON scrive su Supabase, NON tocca src/,
 * NON scrive alcun file (solo stdout).
 *
 * Run: npx tsx scripts/takeout-probe.ts
 */
import { readFileSync, readdirSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const SAVE_DIR = "tmp-takeout/Takeout/Save";
const ENV_FILE = ".env.local";
const SAMPLE_SIZE = 20;
const SEED = 42; // fisso → campione riproducibile

// Places API (New) Text Search, tier "Pro" (displayName + formattedAddress +
// rating/userRatingCount attivano questo SKU). ~$32/1000 richieste. Esiste una
// soglia gratuita mensile: questa è una stima lorda, aggiustala se serve.
// https://developers.google.com/maps/documentation/places/web-service/usage-and-billing
export const USD_PER_REQUEST = 0.032;

// ── Parser CSV minimale ma corretto: gestisce campi quotati, "" di escape e
//    newline dentro le quote. Ritorna righe come array di campi.
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field); field = "";
    } else if (c === "\n") {
      row.push(field); rows.push(row); row = []; field = "";
    } else if (c !== "\r") {
      field += c;
    }
  }
  if (field !== "" || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

// ── PRNG deterministico (mulberry32) + shuffle di Fisher-Yates seedato.
function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function sampleSeeded<T>(items: T[], n: number, seed: number): T[] {
  const rng = mulberry32(seed);
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, Math.min(n, a.length));
}

// ── Legge una chiave da .env.local senza dipendere da dotenv.
export function loadEnvValue(file: string, key: string): string | undefined {
  const content = readFileSync(file, "utf8");
  for (const line of content.split("\n")) {
    const m = line.match(/^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m && m[1] === key) {
      let v = m[2].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      return v;
    }
  }
  return undefined;
}

// Normalizza per il confronto nome-identico: trim + lowercase + rimozione accenti.
const norm = (s: string): string =>
  s.normalize("NFD").replace(/\p{Diacritic}/gu, "").trim().toLowerCase();

// Proxy "match sbagliato": la grande maggioranza dei luoghi è italiana, quindi
// un TOP result fuori dall'Italia è sospetto. Cerca "Italia"/"Italy" nell'indirizzo.
const isInItaly = (address: string | undefined): boolean =>
  /\b(italia|italy)\b/i.test(address ?? "");

export type GooglePlace = {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  primaryType?: string;
  types?: string[];
  rating?: number;
  userRatingCount?: number;
  addressComponents?: { longText?: string; shortText?: string; types?: string[] }[];
};

export async function textSearch(
  name: string,
  apiKey: string,
  fieldMask: string,
): Promise<GooglePlace[]> {
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": fieldMask,
    },
    body: JSON.stringify({ textQuery: name }), // niente locationBias: luoghi sparsi nel mondo
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const data = (await res.json()) as { places?: GooglePlace[] };
  return data.places ?? [];
}

async function main() {
  const apiKey = loadEnvValue(ENV_FILE, "GOOGLE_PLACES_API_KEY");
  if (!apiKey) {
    console.error(`[probe] GOOGLE_PLACES_API_KEY non trovata in ${ENV_FILE}`);
    process.exit(1);
  }

  // 1. Titoli non vuoti da tutti i CSV, deduplicati (trim esatto) e ordinati
  //    (ordine stabile → il seed dà sempre lo stesso campione).
  const files = readdirSync(SAVE_DIR).filter((f) => f.toLowerCase().endsWith(".csv"));
  const titles = new Set<string>();
  for (const f of files) {
    const rows = parseCsv(readFileSync(join(SAVE_DIR, f), "utf8"));
    for (const row of rows.slice(1)) {
      const t = (row[0] ?? "").trim();
      if (t) titles.add(t);
    }
  }
  const unique = [...titles].sort((a, b) => a.localeCompare(b, "it"));
  const sample = sampleSeeded(unique, SAMPLE_SIZE, SEED);

  console.log(
    `[probe] file=${files.length} titoli_unici=${unique.length} campione=${sample.length} seed=${SEED}\n`,
  );

  let zero = 0, one = 0, many = 0, errors = 0, identical = 0, nonItaly = 0;

  for (const name of sample) {
    try {
      const places = await textSearch(
        name,
        apiKey,
        "places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount",
      );
      const n = places.length;
      if (n === 0) zero++;
      else if (n === 1) one++;
      else many++;

      const top = places[0];
      if (top && norm(top.displayName?.text ?? "") === norm(name)) identical++;
      if (top && !isInItaly(top.formattedAddress)) nonItaly++;

      const topStr = top
        ? `${top.displayName?.text ?? "?"} (${top.formattedAddress ?? "—"})`
        : "—";
      const rating =
        top?.rating != null
          ? `${top.rating}${top.userRatingCount != null ? ` (${top.userRatingCount})` : ""}`
          : "—";
      console.log(`${name} | risultati=${n} | TOP: ${topStr} | rating=${rating}`);
    } catch (err) {
      errors++;
      console.log(`${name} | risultati=ERR | ${(err as Error).message}`);
    }
  }

  const requests = sample.length;
  console.log(`\n─── Riepilogo ───`);
  console.log(`0 risultati (irrisolvibili):         ${zero}`);
  console.log(`1 risultato  (match probabile):      ${one}`);
  console.log(`2+ risultati (ambigui, serve conf.): ${many}`);
  console.log(`errori API:                          ${errors}`);
  console.log(`nome Google IDENTICO al Takeout:     ${identical}  (normalizzato: case+accenti)`);
  console.log(`TOP fuori dall'Italia (match sosp.): ${nonItaly}  (proxy: no "Italia"/"Italy" nell'indirizzo)`);
  console.log(
    `costo stimato: ${requests} req × $${USD_PER_REQUEST} = $${(requests * USD_PER_REQUEST).toFixed(3)}`,
  );
}

// Auto-run SOLO se eseguito direttamente (`npx tsx scripts/takeout-probe.ts`),
// NON quando il modulo viene importato da takeout-resolve.ts.
const runDirectly = (() => {
  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
})();
if (runDirectly) {
  main().catch((err) => {
    console.error("[probe] errore fatale:", err);
    process.exit(1);
  });
}
