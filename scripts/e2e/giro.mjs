// Giro di controllo automatico a viewport mobile 390x844.
// Le API di ricerca sono SIMULATE (nessuna chiamata Google/Haiku, nessun costo):
// verifica l'interfaccia, non la qualità delle ricerche.
//   E2E_FAKE_USER=00000000-0000-0000-0000-000000000001 npm run dev   (in un altro terminale)
//   (senza E2E_FAKE_USER il blocco "salvati" viene saltato)
//   PW_MODULE=$(npm root -g)/playwright node scripts/e2e/giro.mjs [cartella-screenshot]
import { createRequire } from "module";
import { mkdirSync } from "fs";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_MODULE ?? "playwright");

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = process.argv[2] ?? "e2e-out";
mkdirSync(OUT, { recursive: true });

const mk = (id, name, lat, lng, extra = {}) => ({
  id, name, address: "Via di Prova 1, Roma", lat, lng, category: "bar",
  rating: 4.5, userRatingCount: 812, priceLevel: 2, openNow: true, types: ["bar"],
  websiteUri: "https://example.com", editorialSummary: null, phone: "+39 06 1234 5678", photoRef: `places/${id}/photos/AbC_${id}`,
  selectedReviews: [{ text: "Bella vista sulla città." }], synthesis: null, tags: null,
  verdict: null, goFor: null, dontExpect: null, matchReason: null, ...extra,
});
const PLACES = [
  mk("P1", "Terrazza Uno", 41.9, 12.49),
  mk("P2", "Pub Fuori Tema", 41.901, 12.492),
  mk("P3", "Rooftop Tre", 41.902, 12.494, { openNow: false, rating: 4.7, userRatingCount: 180 }),
];
const SEARCH_FAST = {
  risultati: PLACES,
  filtri_usati: { categoria: "bar", parole_chiave: ["rooftop"], vicino_a_me: false },
  sintesi_pendente: { places: [], token: "x" },
};
const SYNTH = {
  dettagli: {
    P1: { synthesis: "Terrazza con vista.", tags: ["vivace"], verdict: "Vista vera sui tetti di Roma.", goFor: ["tramonto"], dontExpect: [], matchReason: "Ha una vera terrazza." },
    P3: { synthesis: "Rooftop curato.", tags: [], verdict: "Cocktail curati sul tetto.", goFor: ["cocktail"], dontExpect: [], matchReason: "È su un rooftop." },
  },
  esclusi: ["P2"],
};

let failed = 0;
const ok = (cond, msg) => { console.log(`${cond ? "PASS" : "FAIL"}  ${msg}`); if (!cond) failed++; };

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, permissions: [] });
let searchMode = "ok";
let photoMode = "ok";
let photoCalls = 0;
await ctx.route("**/api/places/photo**", async (route) => {
  photoCalls++;
  if (photoMode === "off") return route.fulfill({ status: 429, json: { error: "Foto sospese per oggi." } });
  return route.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="#c96"/></svg>' });
});
let synthDelay = 900;
await ctx.route("**/api/search", async (route) => {
  if (searchMode === "error") return route.fulfill({ status: 500, json: { error: "Qualcosa è andato storto. Riprova." } });
  return route.fulfill({ json: SEARCH_FAST });
});
await ctx.route("**/api/search/synthesis", async (route) => {
  await new Promise((r) => setTimeout(r, synthDelay));
  return route.fulfill({ json: SYNTH });
});
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|mapbox|WebGL/i.test(m.text())) errors.push(m.text().slice(0, 150)); });
const shot = (n) => page.screenshot({ path: `${OUT}/${n}.png` });

// 1. Primo accesso
await page.goto(`${BASE}/mappa`, { waitUntil: "networkidle" });
ok(await page.getByText("Cosa cerchi?").isVisible(), "primo accesso: card 'Cosa cerchi?' visibile");
ok((await page.getByRole("button", { name: "Rooftop romantico per due a Roma", exact: true }).count()) === 1, "primo accesso: esempi cliccabili presenti");
const bh = (await page.getByTestId("benvenuto").boundingBox())?.height ?? 999;
ok(bh < 844 * 0.3, `primo accesso: la card lascia vedere la mappa (altezza ${Math.round(bh)}px < 30% schermo)`);
ok(await page.getByTestId("suggerimento-momento").isVisible(), "primo accesso: suggerimento legato all'ora del giorno");
await shot("01-benvenuto");

// 2. Ricerca da esempio: lista subito, verdetti dopo, escluso sparisce
await page.getByRole("button", { name: "Rooftop romantico per due a Roma", exact: true }).click();
await page.getByText("Terrazza Uno").first().waitFor({ timeout: 5000 });
ok(await page.getByText(/preparo i verdetti/).isVisible(), "lista: stato 'preparo i verdetti' mentre aspetta Haiku");
ok(await page.locator("ul").getByText("Pub Fuori Tema").count() === 1, "lista: prima dei verdetti ci sono tutti i locali");
await shot("02-lista-caricamento");
await page.getByText("Vista vera sui tetti di Roma.").first().waitFor({ timeout: 6000 });
ok(true, "lista: il verdetto compare dopo");
ok(await page.getByText("Pub Fuori Tema").count() === 0, "lista: il locale escluso sparisce");
ok(await page.getByText("Aperto ora").first().isVisible(), "card: 'Aperto ora' visibile");
ok((await page.getByTestId("titolo-risposta").textContent())?.includes("Rooftop romantico"), "lista: titolo con la richiesta dell'utente");
await shot("03-lista-verdetti");
ok(await page.getByText(/\d+ m|\d,\d km/).first().isVisible(), "card: distanza mostrata (m / km)");
ok((await page.locator("ul img").count()) >= 1 && (await page.locator("ul img").count()) <= 6, `foto: ${await page.locator("ul img").count()} foto nelle card (massimo 6)`);
ok(await page.locator("ul img").first().evaluate((i) => i.complete && i.naturalWidth > 0), "foto: la prima card ha la foto caricata");
await page.waitForTimeout(1200);
const pinBoxes = [];
for (const pin of await page.getByTestId("pin").all()) { const b = await pin.boundingBox(); if (b) pinBoxes.push(b); }
ok(pinBoxes.length >= 2, `mappa: ${pinBoxes.length} pin con nome sulla mappa dopo la ricerca`);
ok(pinBoxes.every((b) => b.y > 0 && b.y + b.height < 844 * 0.55 && b.x >= 0 && b.x + b.width <= 390), "mappa: la mappa si sposta sui risultati (pin sopra la lista, dentro lo schermo)");

// 3. Persistenza pannello AI
await page.locator("button").first().click(); // ✨
const input = page.locator("input[type=text]");
await input.waitFor({ timeout: 3000 });
ok((await input.inputValue()).startsWith("Rooftop romantico"), "pannello AI: il testo cercato è conservato");
ok(await page.getByText(/locali trovati/).isVisible(), "pannello AI: i risultati restano attivi");
await page.locator("button").first().click(); // chiude
await page.getByText("Terrazza Uno").first().waitFor({ timeout: 3000 });
ok(true, "pannello AI: chiudendo si torna alla lista");

// 4. Scheda locale: barra azioni nel viewport
await page.getByText("Terrazza Uno").first().click();
await page.getByText("Il verdetto Mapetite").waitFor({ timeout: 3000 });
const vh = 844;
for (const [label, sel] of [["Indicazioni", "a:has-text('Indicazioni')"], ["Salva", "button:text-is('Salva')"], ["Chiama", "a[href^='tel:']"], ["Sito", "a[aria-label^='Sito di']"]]) {
  const box = await page.locator(sel).first().boundingBox();
  ok(!!box && box.y + box.height <= vh && box.y >= 0, `scheda: pulsante ${label} nel viewport`);
  if (box) ok(box.height >= 40, `scheda: pulsante ${label} alto almeno 40px (${Math.round(box.height)})`);
}
ok(await page.locator("img[alt='Terrazza Uno']").first().isVisible(), "scheda: foto in cima alla scheda");
ok((await page.locator("a[href^='tel:']").first().getAttribute("href")) === "tel:+390612345678", "scheda: numero ripulito per tel:");
await shot("04-scheda");

// 4b. Funzioni beta spente di default
ok((await page.getByLabel(/Condividi/).count()) === 1, "condividi: pulsante presente nella scheda (acceso di default)");

// 5. Lista: B (carosello) è la predefinita dall'11/10, A resta con ?lista=a
await page.goto(`${BASE}/mappa`, { waitUntil: "networkidle" });
await page.getByRole("button", { name: "Rooftop romantico per due a Roma", exact: true }).click();
await page.getByText("Terrazza Uno").first().waitFor({ timeout: 5000 });
ok(await page.locator("ul.snap-x").count() === 1, "lista B predefinita: carosello presente");
await page.getByText("Vista vera sui tetti di Roma.").first().waitFor({ timeout: 6000 });
ok(await page.locator("ul.snap-x").getByText("Ha una vera terrazza.").isVisible(), "lista B: mostra perché il locale è adatto alla ricerca");
ok((await page.getByTestId("filtri-lista").count()) === 1, "lista B: filtri rapidi presenti");
ok(await page.locator("ul.snap-x li").first().evaluate((li) => {
  const name = [...li.querySelectorAll("span")].find((s) => s.textContent === "Terrazza Uno");
  if (!name) return false;
  const r = name.getBoundingClientRect();
  return name.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
}), "lista B: il nome del locale è leggibile sopra la foto");
await shot("05-lista-b");
// Carosello ↔ mappa: la card al centro evidenzia il suo pin e viceversa
const focusedName = () => page.locator("[data-testid=pin][data-focused=true]").innerText().catch(() => "");
ok((await focusedName()).includes("Terrazza Uno"), "carosello: il pin della prima card è evidenziato");
await page.locator("ul.snap-x").evaluate((ul) => ul.scrollTo({ left: ul.children[1].offsetLeft, behavior: "instant" }));
await page.waitForTimeout(700);
ok((await focusedName()).includes("Rooftop Tre"), "carosello: scorrendo, si evidenzia il pin della card al centro");
await page.locator("[data-testid=pin]", { hasText: "Terrazza Uno" }).click();
await page.waitForTimeout(900);
const centered = await page.locator("ul.snap-x").evaluate((ul) => {
  const mid = ul.getBoundingClientRect().left + ul.clientWidth / 2;
  return [...ul.children].map((li) => ({ id: li.dataset.id, d: Math.abs(li.getBoundingClientRect().left + li.clientWidth / 2 - mid) })).sort((a, b) => a.d - b.d)[0].id;
});
ok(centered === "P1", "pin toccato: il carosello porta al centro la sua card");
ok(!(await page.getByText("Il verdetto Mapetite").isVisible()), "pin toccato una volta: la scheda non si apre ancora");
await page.locator("[data-testid=pin]", { hasText: "Terrazza Uno" }).click();
await page.getByText("Il verdetto Mapetite").waitFor({ timeout: 3000 });
ok(true, "pin toccato due volte: si apre la scheda");
await shot("05b-carosello-pin");
await page.goto(`${BASE}/mappa?lista=a`, { waitUntil: "networkidle" });
await page.getByRole("button", { name: "Rooftop romantico per due a Roma", exact: true }).click();
await page.getByText("Terrazza Uno").first().waitFor({ timeout: 5000 });
ok(await page.locator("ul.snap-x").count() === 0, "?lista=a: torna la lista verticale");

// 5b. Beta: filtri lista, condividi, recenti
await page.goto(`${BASE}/mappa`, { waitUntil: "networkidle" });
await page.getByRole("button", { name: "Rooftop romantico per due a Roma", exact: true }).click();
await page.getByText("Rooftop Tre").first().waitFor({ timeout: 5000 });
await page.getByText("Vista vera sui tetti di Roma.").first().waitFor({ timeout: 6000 });
await page.getByRole("button", { name: "Aperto ora" }).first().click();
ok((await page.locator("ul").getByText("Rooftop Tre").count()) === 0 && (await page.locator("ul").getByText("Terrazza Uno").count()) > 0, "filtri rapidi: 'Aperto ora' nasconde i locali chiusi");
ok((await page.getByTestId("pin").filter({ hasText: "Rooftop Tre" }).count()) === 0, "filtri rapidi: anche il pin del locale chiuso sparisce dalla mappa");
await page.getByRole("button", { name: "Aperto ora" }).first().click();
// sposto la mappa a mano: compare "Cerca in quest'area"
await page.mouse.move(195, 300); await page.mouse.down(); await page.mouse.move(80, 200, { steps: 8 }); await page.mouse.up();
await page.getByRole("button", { name: "Cerca in quest'area" }).waitFor({ timeout: 3000 });
ok(true, "mappa spostata: compare 'Cerca in quest'area'");
await page.getByRole("button", { name: "Cerca in quest'area" }).click();
await page.getByText("Terrazza Uno").first().waitFor({ timeout: 5000 });
ok((await page.getByRole("button", { name: "Cerca in quest'area" }).count()) === 0, "'Cerca in quest'area' rifà la ricerca e scompare");
await shot("09-beta-filtri");
await page.getByText("Terrazza Uno").first().click();
await page.getByText("Il verdetto Mapetite").waitFor({ timeout: 3000 });
ok((await page.getByLabel(/Condividi Terrazza Uno/).count()) === 1, "beta condividi: pulsante presente nella scheda");
await page.goto(`${BASE}/mappa`, { waitUntil: "networkidle" });
ok((await page.getByTestId("recenti").filter({ hasText: /Rooftop romantico/ }).count()) >= 1, "beta recenti: la ricerca fatta compare tra le recenti");
await shot("10-beta-recenti");

// 5c. Spegnimento con ?beta=off
await page.goto(`${BASE}/mappa?beta=off`, { waitUntil: "networkidle" });
await page.getByRole("button", { name: "Rooftop romantico per due a Roma", exact: true }).click();
await page.getByText("Terrazza Uno").first().waitFor({ timeout: 5000 });
ok((await page.getByRole("button", { name: "Voto 4,5+" }).count()) === 0, "?beta=off: i filtri rapidi spariscono");

// 5e. Beta "gemme" (spenta di default): badge sui locali amati ma poco recensiti
await page.goto(`${BASE}/mappa`, { waitUntil: "networkidle" });
await page.getByRole("button", { name: "Rooftop romantico per due a Roma", exact: true }).click();
await page.getByText("Rooftop Tre").first().waitFor({ timeout: 5000 });
ok((await page.getByTestId("gemma").count()) === 0, "gemme: spente di default");
await page.goto(`${BASE}/mappa?beta=gemme`, { waitUntil: "networkidle" });
await page.getByRole("button", { name: "Rooftop romantico per due a Roma", exact: true }).click();
await page.getByText("Rooftop Tre").first().waitFor({ timeout: 5000 });
ok((await page.locator("li", { hasText: "Rooftop Tre" }).getByTestId("gemma").count()) === 1 && (await page.locator("li", { hasText: "Terrazza Uno" }).getByTestId("gemma").count()) === 0, "?beta=gemme: badge solo sul locale con 4,7 e 180 recensioni (non su quello con 812)");
await page.locator("ul.snap-x").evaluate((ul) => ul.scrollTo({ left: ul.scrollWidth, behavior: "instant" }));
await page.waitForTimeout(500);
await shot("09b-beta-gemme");
await page.goto(`${BASE}/mappa`, { waitUntil: "networkidle" });
await page.getByRole("button", { name: "Rooftop romantico per due a Roma", exact: true }).click();
await page.getByText("Rooftop Tre").first().waitFor({ timeout: 5000 });
ok((await page.getByTestId("gemma").count()) >= 1, "gemme: restano accese su questo telefono");
await page.goto(`${BASE}/mappa?beta=off`, { waitUntil: "networkidle" });
await page.goto(`${BASE}/mappa`, { waitUntil: "networkidle" });
await page.getByRole("button", { name: "Rooftop romantico per due a Roma", exact: true }).click();
await page.getByText("Rooftop Tre").first().waitFor({ timeout: 5000 });
ok((await page.getByTestId("gemma").count()) === 0, "?beta=off: spegne anche le gemme");

// 5d. Foto non disponibili (quota finita): resta l'emoji, nessun errore
photoMode = "off";
await page.goto(`${BASE}/mappa`, { waitUntil: "networkidle" });
await page.getByRole("button", { name: "Rooftop romantico per due a Roma", exact: true }).click();
await page.getByText("Terrazza Uno").first().waitFor({ timeout: 5000 });
await page.waitForTimeout(800);
ok((await page.locator("ul img").count()) === 0 && (await page.locator("ul").getByText("🍺").count()) >= 1, "foto: con quota finita le card mostrano l'emoji");
photoMode = "ok";

// 6. Errore di rete/API
searchMode = "error";
await page.goto(`${BASE}/mappa`, { waitUntil: "networkidle" });
await page.getByRole("button", { name: "Colazione buona qui vicino", exact: true }).click();
await page.getByText(/Qualcosa è andato storto/).first().waitFor({ timeout: 4000 });
ok(true, "errore API: messaggio umano mostrato nella card");
await shot("06-errore");
searchMode = "ok";

// 7. Posizione: negata
await page.goto(`${BASE}/mappa`, { waitUntil: "networkidle" });
await page.getByRole("button", { name: "Usa la mia posizione" }).click();
await page.getByText(/Non ho il permesso/).waitFor({ timeout: 4000 });
ok(true, "posizione negata: messaggio con alternativa");
await shot("07-posizione-negata");
// concessa
const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 }, permissions: ["geolocation"], geolocation: { latitude: 45.4642, longitude: 9.19 } });
const p2 = await ctx2.newPage();
await p2.goto(`${BASE}/mappa`, { waitUntil: "networkidle" });
await p2.getByRole("button", { name: "Usa la mia posizione" }).click();
await p2.waitForTimeout(1500);
ok(!(await p2.getByText("Cosa cerchi?").isVisible()), "posizione concessa: la card si chiude");
await ctx2.close();

// 7b. Feedback dei tester: email precompilata con pagina e telefono
await page.goto(`${BASE}/mappa?lista=b`, { waitUntil: "networkidle" });
const fb = page.getByRole("link", { name: "Feedback" });
ok(await fb.isVisible(), "feedback: voce 'Feedback' nella barra in basso");
await fb.evaluate((a) => a.addEventListener("click", (e) => e.preventDefault()));
await fb.click();
const fbHref = decodeURIComponent((await fb.getAttribute("href")) ?? "");
ok(fbHref.startsWith("mailto:founder.mapetite@gmail.com") && fbHref.includes("Pagina: /mappa?lista=b"), "feedback: email precompilata con la pagina in cui si trova il tester");

// 8. Pagine pubbliche: si aprono e il pulsante principale non è coperto
for (const r of ["login", "signup", "profilo", "importa", "onboarding"]) {
  const resp = await page.goto(`${BASE}/${r}`, { waitUntil: "networkidle" });
  ok(resp?.status() === 200, `/${r} risponde 200`);
}
await page.goto(`${BASE}/onboarding`, { waitUntil: "networkidle" });
const covered = await page.evaluate(() => {
  const b = [...document.querySelectorAll("button")].find((x) => /Continua/.test(x.textContent ?? ""));
  if (!b) return "assente";
  const r = b.getBoundingClientRect();
  const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
  return b.contains(top) ? "ok" : "coperto";
});
ok(covered === "ok", `onboarding: pulsante Continua raggiungibile (${covered})`);
await shot("08-onboarding");
await page.goto(`${BASE}/profilo`, { waitUntil: "networkidle" });
ok(await page.getByRole("link", { name: "Accedi" }).isVisible(), "profilo da disconnessi: invito ad accedere");

// 9. Salvati (voce 8): città dall'indirizzo, ricerca nel testo, nota sulle card.
// Supabase simulato; serve il dev server avviato con E2E_FAKE_USER.
const fakeUser = await page.goto(`${BASE}/mappa`).then(() => page.getByRole("button", { name: "I miei salvati" }).click())
  .then(() => page.getByText("Accesso richiesto").isVisible({ timeout: 1500 })).then((v) => !v);
if (!fakeUser) console.log("SKIP  salvati: dev server senza E2E_FAKE_USER");
else {
  const rows = [
    { tags: ["romantico"], note: "Tavolo sulla terrazza", places: { id: "u1", name: "Terrazza Uno", category: "bar", address: "Via Po, 2/a, 00198 Roma RM, Italy", lat: 41.9, lng: 12.49, google_place_id: "G1" } },
    { tags: ["amici"], note: null, places: { id: "u2", name: "Osteria Due", category: "restaurant", address: "Via dei Vascellari 29, Roma", lat: 41.89, lng: 12.47, google_place_id: "G2" } },
    { tags: null, note: "Brunch domenica", places: { id: "u3", name: "Caffè Milano", category: "cafe", address: "Corso Monforte, 26, 20122 Milano MI, Italy", lat: 45.46, lng: 9.2, google_place_id: "G3" } },
  ];
  const sctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await sctx.route("**/rest/v1/saved_places**", (r) => r.request().url().includes("select=place_id") ? r.fulfill({ json: rows.map((x) => ({ place_id: x.places.id })) }) : r.fulfill({ json: rows }));
  await sctx.route("**/rest/v1/place_synthesis**", (r) => r.fulfill({ json: [] }));
  await sctx.route("**/api/places/photo**", (r) => r.fulfill({ status: 429, json: {} }));
  const p = await sctx.newPage();
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto(`${BASE}/mappa`, { waitUntil: "networkidle" });
  await p.getByRole("button", { name: "I miei salvati" }).click();
  await p.getByTestId("salvati-filtri").waitFor({ timeout: 5000 });
  ok(await p.getByRole("button", { name: "📍 Roma · 2" }).isVisible(), "città: chip Roma · 2");
  ok(await p.getByRole("button", { name: "📍 Milano · 1" }).isVisible(), "città: chip Milano · 1");
  ok((await p.locator("ul.snap-x li").count()) === 3, "tutti i salvati in lista (3)");
  await p.screenshot({ path: `${OUT}/11-salvati.png` });
  await p.getByRole("button", { name: "📍 Milano · 1" }).click();
  ok((await p.locator("ul.snap-x li").count()) === 1 && await p.locator("ul.snap-x").getByText("Caffè Milano").isVisible(), "filtro Milano: solo Caffè Milano");
  await p.waitForTimeout(1500);
  const pin = await p.getByTestId("pin").first().boundingBox();
  ok(!!pin && pin.y > 200 && pin.y < 844 * 0.6 && pin.x > 0 && pin.x < 390, "filtro Milano: la mappa si sposta su Milano (pin visibile)");
  await p.screenshot({ path: `${OUT}/13-salvati-milano.png` });
  await p.getByRole("button", { name: "📍 Milano · 1" }).click();
  await p.getByLabel("Cerca tra i salvati").fill("terrazza");
  ok((await p.locator("ul.snap-x li").count()) === 1 && await p.locator("ul.snap-x").getByText("Terrazza Uno").isVisible(), "ricerca 'terrazza': solo Terrazza Uno");
  ok(await p.locator("ul.snap-x").getByText("“Tavolo sulla terrazza”").isVisible(), "card salvato: mostra la nota");
  await p.screenshot({ path: `${OUT}/12-salvati-ricerca.png` });
  await p.getByLabel("Cerca tra i salvati").fill("sushi");
  ok(await p.getByText("Nessun salvato con questi filtri").isVisible(), "nessun risultato: messaggio chiaro");
  await p.getByRole("button", { name: "Tutti", exact: true }).click();
  await sctx.close();
}

ok(errors.length === 0, `nessun errore JavaScript in console${errors.length ? ": " + errors.slice(0, 3).join(" | ") : ""}`);
await browser.close();
console.log(failed === 0 ? "\nTUTTO OK" : `\n${failed} CONTROLLI FALLITI`);
process.exit(failed === 0 ? 0 : 1);
