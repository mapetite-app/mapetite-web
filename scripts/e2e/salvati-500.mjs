// Lista dei salvati con molti posti (Lorenzo 5/11: "immagina che io abbia 500 salvati"): città che filtra la lista,
// ricerca mentre scrivi, filtri rapidi e prova di fluidità con 500 salvati finti. Dati simulati, nessuna chiamata
// Google/Haiku. Serve il dev server con E2E_FAKE_USER.
//   BASE_URL=http://localhost:3200 PW_MODULE=$(npm root -g)/playwright node scripts/e2e/salvati-500.mjs cartella
import { createRequire } from "module";
import { mkdirSync } from "fs";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_MODULE ?? "playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = process.argv[2] ?? "salvati-500";
mkdirSync(OUT, { recursive: true });

let failed = 0;
const ok = (cond, msg) => { console.log(`${cond ? "PASS" : "FAIL"}  ${msg}`); if (!cond) failed++; };

// 14 salvati veri-ish (12 a Roma, 2 a Milano), come scripts/e2e/mappa-foto.mjs.
const ROMA = [
  ["Osteria Bonelli", "restaurant", 41.8878, 12.5265, ["Da provare"]],
  ["Trattoria Pennestri", "restaurant", 41.8733, 12.4836, ["Già visitato", "Mi è piaciuto"]],
  ["Litro", "wine_bar", 41.8845, 12.4651, ["Da provare", "amici"]],
  ["Marigold", "cafe", 41.8711, 12.4774, ["Già visitato"]],
  ["Pastificio San Lorenzo", "restaurant", 41.8977, 12.5135, ["Da provare"]],
  ["Drink Kong", "cocktail_bar", 41.8954, 12.4923, ["Già visitato", "Non fa per me"]],
  ["Supplizio", "restaurant", 41.8981, 12.4692, ["Da provare"]],
  ["Gelateria del Teatro", "ice_cream_shop", 41.9013, 12.4706, ["Già visitato", "Mi è piaciuto"]],
  ["Sushi Ko", "japanese_restaurant", 41.9101, 12.4602, ["Da provare", "romantico"]],
  ["Hey Kids", "bar", 41.8892, 12.4718, ["Da provare"]],
  ["Santo Palato", "restaurant", 41.8829, 12.5098, ["Già visitato"]],
  ["Roscioli Caffè", "cafe", 41.8939, 12.4733, ["Da provare"]],
];
const MILANO = [
  ["Iyo Omakase", "japanese_restaurant", 45.4545, 9.2036, ["Da provare"]],
  ["Bar Basso", "cocktail_bar", 45.4769, 9.2183, ["Già visitato"]],
];
const riga = ([name, category, lat, lng, tags, address], i, note = null) => ({
  tags, note, created_at: `2026-0${(i % 8) + 1}-1${i % 9}T10:00:00Z`,
  places: { id: `00000000-0000-4000-8000-${String(900000000000 + i)}`, name, category, address, lat, lng, google_place_id: `GZ${i}`, rating: 4.5, price_level: 2 },
});
const pochi = [...ROMA.map((r) => [...r, "Via di Prova 1, 00153 Roma RM, Italy"]), ...MILANO.map((r) => [...r, "Via di Prova 1, 20122 Milano MI, Italy"])].map((r, i) => riga(r, i));

// 500 salvati: 400 a Roma, 100 a Milano, tipi misti.
const TIPI = [["restaurant", "Osteria"], ["restaurant", "Trattoria"], ["japanese_restaurant", "Sushi"], ["pizza_restaurant", "Pizzeria"], ["wine_bar", "Enoteca"], ["cafe", "Caffè"], ["bar", "Bar"], ["cocktail_bar", "Cocktail"], ["ice_cream_shop", "Gelateria"], ["bakery", "Forno"], ["seafood_restaurant", "Pesce"], ["ramen_restaurant", "Ramen"]];
const tanti = Array.from({ length: 500 }, (_, i) => {
  const [cat, nome] = TIPI[i % TIPI.length];
  const roma = i < 400;
  const lat = roma ? 41.86 + ((i * 37) % 100) / 1500 : 45.44 + ((i * 37) % 100) / 1500;
  const lng = roma ? 12.45 + ((i * 53) % 100) / 1200 : 9.16 + ((i * 53) % 100) / 1200;
  const tags = [i % 3 === 0 ? "Già visitato" : "Da provare", ...(i % 17 === 0 ? ["romantico"] : []), ...(i % 23 === 0 ? ["amici"] : [])];
  return riga([`${nome} ${["del Corso", "di Monti", "al Pigneto", "Testaccio", "Isola", "Navigli", "Brera", "Prati"][i % 8]} ${i + 1}`, cat, lat, lng, tags, roma ? `Via di Prova ${i}, 00153 Roma RM, Italy` : `Via di Prova ${i}, 20122 Milano MI, Italy`], i, i % 29 === 0 ? "Da provare con Giulia" : null);
});

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
async function apri(rows) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await ctx.route("**/api/events", (r) => r.fulfill({ status: 204, body: "" }));
  await ctx.route("**/rest/v1/saved_places**", (r) => r.request().url().includes("select=place_id") ? r.fulfill({ json: rows.map((x) => ({ place_id: x.places.id })) }) : r.fulfill({ json: rows }));
  await ctx.route("**/rest/v1/place_synthesis**", (r) => r.fulfill({ json: [{ place_id: "GZ0", synthesis: "Osteria di quartiere.", tags: [], verdict: "Cucina romana senza fronzoli, prezzi di una volta.", go_for: [], dont_expect: [] }] }));
  await ctx.route("**/rest/v1/profiles**", (r) => r.fulfill({ json: [] }));
  await ctx.route("**/rest/v1/contenuti_locali**", (r) => r.fulfill({ json: [] }));
  await ctx.route("**/rest/v1/foto_locali**", (r) => r.fulfill({ json: [] }));
  await ctx.route("**/api/places/photo**", (r) => r.fulfill({ status: 429, json: {} }));
  await ctx.route("**/api/places/verdetto", (r) => r.fulfill({ json: { verdict: null } }));
  const p = await ctx.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto(`${BASE}/mappa`, { waitUntil: "networkidle" });
  await p.locator("nav").first().getByRole("link", { name: "Salvati" }).evaluate((a) => a.click());
  const L = p.getByTestId("salvati-lista");
  await L.getByTestId("salvato-riga").first().waitFor({ timeout: 10000 });
  return { ctx, p, L, errors };
}
const shot = (p, n) => p.screenshot({ path: `${OUT}/${n}.png`, caret: "initial" });

// 1. Due città: le pillole in alto filtrano la lista; la scelta resta passando dalla mappa.
{ const { ctx, p, L, errors } = await apri(pochi);
  const righe = L.getByTestId("salvato-riga");
  const citta = L.getByTestId("salvati-citta-pillola");
  ok((await citta.allTextContents()).join("|") === "Tutte 14|Roma 12|Milano 2", `due città: in alto 'Tutte 14 · Roma 12 · Milano 2' (${(await citta.allTextContents()).join("|")})`);
  await shot(p, "01-lista-due-citta");
  await citta.filter({ hasText: "Milano" }).click();
  ok((await righe.count()) === 2 && (await righe.allTextContents()).every((t) => t.includes("Milano")), `Milano: la lista ha solo i 2 posti di Milano (${await righe.count()})`);
  await shot(p, "02-citta-milano");
  // Sulla mappa la pillola Milano è accesa; tocco su Roma e ritorno: la lista è di Roma.
  await L.getByTestId("salvati-lista-mappa").click();
  await p.getByTestId("salvati-zona").first().waitFor({ timeout: 5000 });
  ok((await p.getByTestId("salvati-zona").filter({ hasText: "Milano" }).getAttribute("aria-pressed")) === "true", "Milano resta scelta sulla mappa");
  await p.getByTestId("salvati-zona").filter({ hasText: "Roma" }).click();
  await p.getByTestId("salvati-vedi-lista").click();
  await L.waitFor({ timeout: 5000 });
  ok((await righe.count()) === 12 && (await citta.filter({ hasText: "Roma" }).getAttribute("aria-pressed")) === "true", `Roma scelta sulla mappa vale anche nella lista (${await righe.count()} righe)`);
  // Ricerca per tipo con sinonimo: "sushi" trova i giapponesi; in Roma solo Sushi Ko, "Tutte" anche Iyo.
  await citta.filter({ hasText: "Tutte" }).click();
  await L.getByLabel("Cerca nei tuoi posti").fill("sushi");
  await p.waitForTimeout(300);
  ok((await righe.count()) === 2 && (await righe.allTextContents()).some((t) => t.includes("Iyo Omakase")), `'sushi' trova anche il giapponese senza 'sushi' nel nome (${(await righe.allTextContents()).map((t) => t.slice(0, 14)).join(" | ")})`);
  ok(((await L.getByTestId("salvati-risultato").textContent()) ?? "").startsWith("2 di 14"), `conteggio '2 di 14' (${await L.getByTestId("salvati-risultato").textContent()})`);
  await shot(p, "03-ricerca-sushi");
  await L.getByLabel("Cerca nei tuoi posti").fill("vino");
  await p.waitForTimeout(300);
  ok((await righe.count()) === 1 && (await righe.first().textContent()).includes("Litro"), "'vino' trova l'enoteca (wine bar)");
  await L.getByTestId("salvati-azzera").click();
  await p.waitForTimeout(300);
  ok((await righe.count()) === 14 && (await L.getByLabel("Cerca nei tuoi posti").inputValue()) === "", "'Azzera' toglie la ricerca");
  ok(errors.length === 0, `nessun errore nella pagina (${errors.join(" | ")})`);
  await ctx.close(); }

// 2. 500 salvati: righe disegnate a pezzi, scrivere resta fluido.
{ const { ctx, p, L, errors } = await apri(tanti);
  const righe = L.getByTestId("salvato-riga");
  ok((await L.getByTestId("salvati-citta-pillola").allTextContents()).join("|") === "Tutte 500|Roma 400|Milano 100", "500 salvati: 'Tutte 500 · Roma 400 · Milano 100'");
  const n0 = await righe.count();
  ok(n0 <= 60, `500 salvati: all'apertura si disegnano ${n0} righe, non 500`);
  await shot(p, "04-500-salvati");
  // Scorrendo arrivano le altre.
  await L.evaluate((el) => { el.scrollTop = el.scrollHeight; });
  await p.waitForTimeout(400);
  ok((await righe.count()) > n0, `scorrendo arrivano altre righe (${await righe.count()})`);
  await L.evaluate((el) => { el.scrollTop = 0; });
  // Tipi presenti, i più frequenti, con emoji e conteggio.
  const tipi = await L.getByTestId("salvati-tipo-pillola").allTextContents();
  ok(tipi.length >= 5 && tipi.length <= 12, `fila dei tipi: ${tipi.length} tipi (${tipi.slice(0, 4).join(" | ")})`);
  // Fluidità: ogni lettera, dal tasto al campo aggiornato e disegnato.
  await p.evaluate(() => {
    window.__lunghi = [];
    new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lunghi.push(e.duration); }).observe({ type: "longtask", buffered: false });
  });
  const campo = L.getByLabel("Cerca nei tuoi posti");
  await campo.click();
  const tempi = [];
  for (const ch of "trattoria monti") {
    const t = await p.evaluate(async (c) => {
      const el = document.querySelector("input[aria-label='Cerca nei tuoi posti']");
      const t0 = performance.now();
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
      setter.call(el, el.value + c);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      return performance.now() - t0;
    }, ch);
    tempi.push(Math.round(t));
  }
  await p.waitForTimeout(600);
  const lunghi = await p.evaluate(() => window.__lunghi);
  const peggiore = Math.max(...tempi);
  const medio = Math.round(tempi.reduce((a, b) => a + b, 0) / tempi.length);
  // Server di sviluppo (React non ottimizzato, 3-5 volte più lento della produzione) e macchina condivisa: soglia
  // larga sulla lettera peggiore. Misurato il 5/11 con la stessa prova: prima 300-580 ms (500 righe ridisegnate a ogni
  // lettera, più la mappa), dopo 70-125 ms.
  ok(peggiore < 250, `500 salvati: ogni lettera a schermo in media in ${medio} ms, la peggiore in ${peggiore} ms (${tempi.join(",")})`);
  console.log(`INFO  compiti lunghi (>50 ms) durante la scrittura: ${lunghi.length} (${lunghi.map((d) => Math.round(d)).join(",")})`);
  ok((await righe.count()) > 0 && (await righe.allTextContents()).every((t) => /Trattoria/.test(t) && /Monti/.test(t)), `'trattoria monti' trova solo trattorie di Monti (${await righe.count()})`);
  await shot(p, "05-500-ricerca");
  await L.getByTestId("salvati-azzera").click();
  await L.getByTestId("salvati-citta-pillola").filter({ hasText: "Milano" }).click();
  await L.getByTestId("salvati-comandi").evaluate((el) => el.scrollTo(el.scrollWidth, 0));
  await L.getByTestId("salvati-tipo-pillola").filter({ hasText: "Wine bar" }).click();
  const res = (await L.getByTestId("salvati-risultato").textContent()) ?? "";
  ok(/^\d+ di 100 posti a Milano$/.test(res) && (await righe.allTextContents()).every((t) => t.includes("Wine bar") && t.includes("Milano")), `Milano + Wine bar: '${res}'`);
  await shot(p, "06-500-milano-enoteca");
  ok(errors.length === 0, `nessun errore nella pagina (${errors.join(" | ")})`);
  await ctx.close(); }

await browser.close();
console.log(failed === 0 ? "TUTTO OK" : `${failed} controlli falliti`);
process.exit(failed === 0 ? 0 : 1);
