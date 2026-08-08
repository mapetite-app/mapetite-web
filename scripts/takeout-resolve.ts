/**
 * scripts/takeout-resolve.ts — DIAGNOSTICO ONE-OFF, non codice di produzione.
 *
 * Risolve TUTTI i luoghi del Takeout via Google Places Text Search e salva su
 * tmp-takeout/resolved.json. NESSUNA scrittura su Supabase, NESSUNA modifica a
 * src/. L'import nel DB è un passo successivo.
 *
 * Riusa parser CSV / load env / textSearch da takeout-probe.ts (non riscritti).
 * RESUME: se resolved.json esiste, salta i titoli già risolti. Salva ogni 25.
 *
 * Run: npx tsx scripts/takeout-resolve.ts
 */
import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  parseCsv,
  loadEnvValue,
  textSearch,
  USD_PER_REQUEST,
  type GooglePlace,
} from "./takeout-probe";

const SAVE_DIR = "tmp-takeout/Takeout/Save";
const ENV_FILE = ".env.local";
const OUT_FILE = "tmp-takeout/resolved.json";
const SAVE_EVERY = 25;
const PAUSE_MS = 100;

// FieldMask ricco: si paga una volta, si filtra dopo sui dati già pagati.
const RESOLVE_FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.primaryType",
  "places.types",
  "places.rating",
  "places.userRatingCount",
  "places.addressComponents",
].join(",");

type ResolvedEntry = {
  titolo: string;           // titolo originale dal Takeout
  origine: string[];        // da quali liste/file proviene (es. ["Da visitare"])
  numRisultati: number;     // quanti risultati ha reso Google
  risultati: GooglePlace[]; // primi 3 risultati completi, nessun filtro
};
type ResolvedMap = Record<string, ResolvedEntry>;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const apiKey = loadEnvValue(ENV_FILE, "GOOGLE_PLACES_API_KEY");
  if (!apiKey) {
    console.error(`[resolve] GOOGLE_PLACES_API_KEY non trovata in ${ENV_FILE}`);
    process.exit(1);
  }

  // 1. Titoli non vuoti + insieme dei file di origine per titolo (info da conservare).
  const files = readdirSync(SAVE_DIR).filter((f) => f.toLowerCase().endsWith(".csv"));
  const originByTitle = new Map<string, Set<string>>();
  for (const f of files) {
    const origin = f.replace(/\.csv$/i, "");
    const rows = parseCsv(readFileSync(join(SAVE_DIR, f), "utf8"));
    for (const row of rows.slice(1)) {
      const t = (row[0] ?? "").trim();
      if (!t) continue;
      if (!originByTitle.has(t)) originByTitle.set(t, new Set());
      originByTitle.get(t)!.add(origin);
    }
  }
  const unique = [...originByTitle.keys()].sort((a, b) => a.localeCompare(b, "it"));
  const total = unique.length;

  // 2. RESUME: carica quanto già risolto.
  const resolved: ResolvedMap = existsSync(OUT_FILE)
    ? (JSON.parse(readFileSync(OUT_FILE, "utf8")) as ResolvedMap)
    : {};

  const save = () => writeFileSync(OUT_FILE, JSON.stringify(resolved, null, 2));

  console.log(
    `[resolve] titoli_unici=${total} già_risolti=${Object.keys(resolved).length} da_fare=${
      total - Object.keys(resolved).length
    }\n`,
  );

  // Ctrl-C: salva il lavoro parziale prima di uscire, così non si ripaga.
  process.on("SIGINT", () => {
    save();
    console.log(`\n[resolve] interrotto — salvati ${Object.keys(resolved).length} titoli in ${OUT_FILE}`);
    process.exit(130);
  });

  let callsMade = 0; // chiamate a pagamento fatte in QUESTA esecuzione
  let processedThisRun = 0;

  for (const title of unique) {
    if (resolved[title]) continue; // già risolto in un run precedente → skip
    try {
      const places = await textSearch(title, apiKey, RESOLVE_FIELD_MASK);
      resolved[title] = {
        titolo: title,
        origine: [...originByTitle.get(title)!].sort(),
        numRisultati: places.length,
        risultati: places.slice(0, 3),
      };
      callsMade++;
      processedThisRun++;

      if (processedThisRun % SAVE_EVERY === 0) {
        save();
        console.log(
          `risolti ${Object.keys(resolved).length}/${total}, costo stimato $${(
            callsMade * USD_PER_REQUEST
          ).toFixed(2)}`,
        );
      }
      await sleep(PAUSE_MS);
    } catch (err) {
      // Non salvo un'entry per l'errore: resta non risolto e verrà ritentato
      // al prossimo run (errori spesso transitori). Non conta come risolto.
      console.error(`[resolve] ERRORE "${title}": ${(err as Error).message} — ritento al prossimo run`);
      await sleep(PAUSE_MS);
    }
  }

  save(); // flush finale

  // 3. Riepilogo.
  const entries = Object.values(resolved);
  const zero = entries.filter((e) => e.numRisultati === 0).length;
  const one = entries.filter((e) => e.numRisultati === 1).length;
  const many = entries.filter((e) => e.numRisultati >= 2).length;

  const typeDist = new Map<string, number>();
  for (const e of entries) {
    const key =
      e.numRisultati === 0
        ? "(0 risultati)"
        : e.risultati[0]?.primaryType ?? "(senza primaryType)";
    typeDist.set(key, (typeDist.get(key) ?? 0) + 1);
  }
  const distSorted = [...typeDist.entries()].sort((a, b) => b[1] - a[1]);

  console.log(`\n─── Riepilogo ───`);
  console.log(`titoli risolti (dataset): ${entries.length}/${total}`);
  console.log(`  0 risultati:  ${zero}`);
  console.log(`  1 risultato:  ${one}`);
  console.log(`  2+ risultati: ${many}`);
  console.log(`\nDistribuzione primaryType (TOP result):`);
  for (const [type, count] of distSorted) {
    console.log(`  ${String(count).padStart(4)}  ${type}`);
  }
  console.log(
    `\ncosto questa esecuzione: ${callsMade} req × $${USD_PER_REQUEST} = $${(
      callsMade * USD_PER_REQUEST
    ).toFixed(2)}`,
  );
  console.log(
    `costo totale dataset:    ${entries.length} req × $${USD_PER_REQUEST} = $${(
      entries.length * USD_PER_REQUEST
    ).toFixed(2)}`,
  );
}

main().catch((err) => {
  console.error("[resolve] errore fatale:", err);
  process.exit(1);
});
