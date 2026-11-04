// Screenshot della mappa (area 4 del piano, 4/11): salvati con stati misti e risultati di una ricerca.
// Dati simulati, nessuna chiamata Google/Haiku. Serve il dev server con E2E_FAKE_USER.
//   PW_MODULE=$(npm root -g)/playwright node scripts/e2e/mappa-foto.mjs cartella
import { createRequire } from "module";
import { mkdirSync } from "fs";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_MODULE ?? "playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = process.argv[2] ?? "mappa-foto";
mkdirSync(OUT, { recursive: true });

const ROMA = [
  ["Osteria Bonelli", "restaurant", 41.8878, 12.5265, ["Da provare"]],
  ["Trattoria Pennestri", "restaurant", 41.8733, 12.4836, ["Già visitato", "Mi è piaciuto"]],
  ["Litro", "wine_bar", 41.8845, 12.4651, ["Da provare"]],
  ["Marigold", "cafe", 41.8711, 12.4774, ["Già visitato"]],
  ["Pastificio San Lorenzo", "restaurant", 41.8977, 12.5135, ["Da provare"]],
  ["Drink Kong", "cocktail_bar", 41.8954, 12.4923, ["Già visitato", "Non fa per me"]],
  ["Supplizio", "restaurant", 41.8981, 12.4692, ["Da provare"]],
  ["Gelateria del Teatro", "ice_cream_shop", 41.9013, 12.4706, ["Già visitato", "Mi è piaciuto"]],
  ["Il Sorpasso", "restaurant", 41.9101, 12.4602, ["Da provare"]],
  ["Hey Kids", "bar", 41.8892, 12.4718, ["Da provare"]],
  ["Santo Palato", "restaurant", 41.8829, 12.5098, ["Già visitato"]],
  ["Roscioli Caffè", "cafe", 41.8939, 12.4733, ["Da provare"]],
];
const MILANO = [
  ["Trippa", "restaurant", 45.4545, 9.2036, ["Da provare"]],
  ["Bar Basso", "cocktail_bar", 45.4769, 9.2183, ["Già visitato"]],
];
const rows = [...ROMA.map((r) => [...r, "Via di Prova 1, 00153 Roma RM, Italy"]), ...MILANO.map((r) => [...r, "Via di Prova 1, 20122 Milano MI, Italy"])].map(([name, category, lat, lng, tags, address], i) => ({
  tags, note: null, created_at: `2026-0${(i % 8) + 1}-1${i % 9}T10:00:00Z`,
  places: { id: `00000000-0000-4000-8000-0000000009${String(i).padStart(2, "0")}`, name, category, address, lat, lng, google_place_id: `GZ${i}`, rating: 4.5, price_level: 2 },
}));

const mk = (id, name, lat, lng, extra = {}) => ({
  id, name, address: "Via di Prova 1, Roma", lat, lng, category: "restaurant",
  rating: 4.5, userRatingCount: 412, priceLevel: 2, openNow: true, types: ["restaurant"],
  websiteUri: null, editorialSummary: null, phone: null, photoRef: null,
  selectedReviews: [{ text: "Ottimo." }], synthesis: null, tags: null, verdict: null, goFor: null, dontExpect: null, matchReason: null, firma: `firma-${id}`, ...extra,
});
const RIS = [
  mk("R1", "Da Cesare al Casaletto", 41.8722, 12.4475),
  mk("R2", "Osteria der Belli", 41.8889, 12.4705, { openNow: false }),
  mk("R3", "Trattoria Da Teo", 41.8875, 12.4738, { category: "restaurant" }),
  mk("R4", "Enoteca Ferrara", 41.8905, 12.4693, { category: "wine_bar" }),
  mk("R5", "Tavernaccia", 41.8812, 12.4689),
  mk("R6", "Checco er Carettiere", 41.8899, 12.4687),
  mk("R7", "Bar San Calisto", 41.8889, 12.4691, { category: "bar" }),
];
const SEARCH = { risultati: RIS, filtri_usati: { categoria: "restaurant", parole_chiave: ["trattoria"], vicino_a_me: false, zona: "Trastevere" }, sintesi_pendente: null };

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, geolocation: { latitude: 41.889, longitude: 12.474 }, permissions: ["geolocation"] });
await ctx.route("**/api/events", (r) => r.fulfill({ status: 204, body: "" }));
await ctx.route("**/rest/v1/saved_places**", (r) => r.request().url().includes("select=place_id") ? r.fulfill({ json: rows.map((x) => ({ place_id: x.places.id })) }) : r.fulfill({ json: rows }));
await ctx.route("**/rest/v1/place_synthesis**", (r) => r.fulfill({ json: [{ place_id: "GZ0", synthesis: "Osteria di quartiere.", tags: [], verdict: "Cucina romana senza fronzoli, prezzi di una volta.", go_for: [], dont_expect: [] }] }));
await ctx.route("**/rest/v1/profiles**", (r) => r.fulfill({ json: [] }));
await ctx.route("**/rest/v1/contenuti_locali**", (r) => r.fulfill({ json: [] }));
await ctx.route("**/api/places/photo**", (r) => r.fulfill({ status: 429, json: {} }));
await ctx.route("**/api/places/verdetto", (r) => r.fulfill({ json: { verdict: null } }));
await ctx.route("**/api/search", (r) => r.fulfill({ json: SEARCH }));
await ctx.route("**/api/search/synthesis", (r) => r.fulfill({ json: { dettagli: {}, esclusi: [] } }));
const p = await ctx.newPage();
const errors = [];
p.on("pageerror", (e) => errors.push(e.message));
const shot = (n) => p.screenshot({ path: `${OUT}/${n}.png`, caret: "initial" });

// 1. Salvati sulla mappa
await p.goto(`${BASE}/mappa`, { waitUntil: "networkidle" });
await p.locator("nav").first().getByRole("link", { name: "Salvati" }).evaluate((a) => a.click());
await p.getByTestId("salvati-lista-mappa").click({ timeout: 8000 });
await p.waitForTimeout(2500);
await shot("01-salvati-mappa");
// 1b. Zona Milano: le card sono solo di Milano
const mi = p.getByTestId("salvati-zona").filter({ hasText: "Milano" });
if (await mi.count()) { await mi.click(); await p.waitForTimeout(1500); await shot("01b-salvati-milano"); await p.getByTestId("salvati-zona").filter({ hasText: "Roma" }).click(); await p.waitForTimeout(1800); await shot("01c-salvati-roma-tutta"); }
// 1c. Zoom sul segnalino 👎 (Drink Kong)
await p.evaluate(() => { const m = document.querySelector("[data-stato=no]"); if (m) m.scrollIntoView(); });
// 2. Tocco su un segnalino dei salvati
const pin = p.locator("[data-testid=pin]").first();
if (await pin.count()) { await pin.click({ force: true }); await p.waitForTimeout(1200); await shot("02-salvati-tocco-pin"); }
await p.keyboard.press("Escape").catch(() => {});
// 3. Ricerca
await p.locator("nav").first().getByRole("link", { name: "Mappa" }).evaluate((a) => a.click());
await p.waitForTimeout(1200);
const campo = p.getByTestId("barra-ricerca").locator("input").first();
if (await campo.count()) { await campo.fill("trattoria a Trastevere"); await campo.press("Enter"); }
await p.waitForTimeout(3000);
await shot("03-risultati-mappa");
const rp = p.locator("[data-testid=pin]").nth(3);
if (await rp.count()) { await rp.click({ force: true }); await p.waitForTimeout(1200); await shot("04-risultati-tocco-pin"); }
await p.keyboard.press("Escape").catch(() => {});
await p.waitForTimeout(500);
const pill = p.getByTestId("pillola-risultati");
if (await pill.count()) { await pill.first().click(); await p.waitForTimeout(800); await shot("05-pillola-aperta"); }
console.log(errors.length ? `ERRORI: ${errors.join(" | ")}` : "nessun errore");
await browser.close();
