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
  mk("P1", "Terrazza Uno", 41.9, 12.49, { photoAuthor: "Maria R." }),
  mk("P2", "Pub Fuori Tema", 41.901, 12.492),
  mk("P3", "Rooftop Tre", 41.902, 12.494, { openNow: false, rating: 4.7, userRatingCount: 180, category: "cocktail_bar" }),
];
const SEARCH_FAST = {
  risultati: PLACES,
  filtri_usati: { categoria: "bar", parole_chiave: ["rooftop"], vicino_a_me: false, zona: "Roma" },
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
// Con E2E_FAKE_USER la mappa legge i salvati: nel giro principale risultano vuoti (niente rete verso Supabase).
await ctx.route("**/rest/v1/saved_places**", (route) => route.fulfill({ json: [] }));
await ctx.route("**/rest/v1/place_synthesis**", (route) => route.fulfill({ json: [] }));
let synthDelay = 900;
await ctx.route("**/api/search", async (route) => {
  if (searchMode === "error") return route.fulfill({ status: 500, json: { error: "Qualcosa è andato storto. Riprova." } });
  if (searchMode === "empty") return route.fulfill({ json: { ...SEARCH_FAST, risultati: [], sintesi_pendente: null } });
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
await page.getByRole("button", { name: "Ricerca con l'AI" }).click(); // ✨
const input = page.locator("input[type=text]");
await input.waitFor({ timeout: 3000 });
ok((await input.inputValue()).startsWith("Rooftop romantico"), "pannello AI: il testo cercato è conservato");
ok(await page.getByText(/locali trovati/).isVisible(), "pannello AI: i risultati restano attivi");
await page.getByRole("button", { name: "Ricerca con l'AI" }).click(); // chiude
await page.getByText("Terrazza Uno").first().waitFor({ timeout: 3000 });
ok(true, "pannello AI: chiudendo si torna alla lista");

// 4. Scheda locale: barra azioni nel viewport
await page.getByText("Terrazza Uno").first().click();
await page.getByText("Il verdetto Mapetite").waitFor({ timeout: 3000 });
const vh = 844;
for (const [label, sel] of [["Indicazioni", "a[aria-label^='Indicazioni']"], ["Salva", "button:text-is('Salva')"], ["Chiama", "a[href^='tel:']"], ["Sito", "a[aria-label^='Sito di']"]]) {
  const box = await page.locator(sel).first().boundingBox();
  ok(!!box && box.y + box.height <= vh && box.y >= 0 && box.x >= 0 && box.x + box.width <= 390, `scheda: pulsante ${label} nel viewport (anche in larghezza)`);
  if (box) ok(box.height >= 40, `scheda: pulsante ${label} alto almeno 40px (${Math.round(box.height)})`);
}
ok(await page.locator("img[alt='Terrazza Uno']").first().isVisible(), "scheda: foto in cima alla scheda");
ok(await page.getByText("Foto: Maria R.").isVisible(), "scheda: autore della foto indicato (condizioni Google)");
ok((await page.locator("a[href^='tel:']").first().getAttribute("href")) === "tel:+390612345678", "scheda: numero ripulito per tel:");
ok((await page.getByTestId("citta-distanza").textContent())?.match(/^Roma · \d+ m$/) != null, "scheda: riga 'Roma · distanza' (come Places)");
ok(await page.getByText("Bar", { exact: true }).first().isVisible(), "scheda: tipo di locale in italiano");
await shot("04-scheda");

// 4a. Scheda: trascinando verso il basso si chiude
await page.getByTestId("scheda-trascinabile").evaluate((el) => {
  const t = (y) => new Touch({ identifier: 1, target: el, clientX: 200, clientY: y });
  el.dispatchEvent(new TouchEvent("touchstart", { touches: [t(300)], bubbles: true }));
  el.dispatchEvent(new TouchEvent("touchmove", { touches: [t(380)], bubbles: true }));
  el.dispatchEvent(new TouchEvent("touchmove", { touches: [t(480)], bubbles: true }));
  el.dispatchEvent(new TouchEvent("touchend", { touches: [], bubbles: true }));
});
await page.waitForTimeout(400);
ok(!(await page.getByText("Il verdetto Mapetite").isVisible()), "scheda: trascinata verso il basso si chiude");
await page.getByText("Terrazza Uno").first().click();
await page.getByText("Il verdetto Mapetite").waitFor({ timeout: 3000 });

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
ok((await page.getByRole("button", { name: "Salva Terrazza Uno" }).count()) === 1, "lista B: segnalibro Salva sulla card");
ok((await page.getByTestId("ho-capito").textContent()) === "Ho capito: Bar · rooftop · a Roma", "lista B: sotto il titolo cosa ha capito l'AI (tipo e requisiti)");
{ const t = await page.locator("ul.snap-x").innerText(); ok(/cocktail bar/i.test(t) && !/cocktail_bar/.test(t), "lista B: categoria in italiano leggibile (Cocktail bar, non cocktail_bar)"); }
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
ok((await page.locator("[data-testid=pin][data-focused=true] img").count()) === 1, "pin a fuoco: mostra la miniatura della foto");
await page.locator("ul.snap-x").evaluate((ul) => ul.scrollTo({ left: ul.children[1].offsetLeft, behavior: "instant" }));
await page.waitForTimeout(700);
ok((await focusedName()).includes("Rooftop Tre"), "carosello: scorrendo, si evidenzia il pin della card al centro");
await page.locator("[data-testid=pin]", { hasText: "Terrazza Uno" }).click();
// lo scorrimento è animato: si aspetta che finisca (fino a 3 s)
const centerOf = () => page.locator("ul.snap-x").evaluate((ul) => {
  const mid = ul.getBoundingClientRect().left + ul.clientWidth / 2;
  return [...ul.children].map((li) => ({ id: li.dataset.id, d: Math.abs(li.getBoundingClientRect().left + li.clientWidth / 2 - mid) })).sort((a, b) => a.d - b.d)[0].id;
});
let centered = await centerOf();
for (let i = 0; i < 15 && centered !== "P1"; i++) { await page.waitForTimeout(200); centered = await centerOf(); }
ok(centered === "P1", "pin toccato: il carosello porta al centro la sua card");
ok(!(await page.getByText("Il verdetto Mapetite").isVisible()), "pin toccato una volta: la scheda non si apre ancora");
await page.locator("[data-testid=pin][data-focused=true]", { hasText: "Terrazza Uno" }).waitFor({ timeout: 3000 });
await page.locator("[data-testid=pin]", { hasText: "Terrazza Uno" }).click();
await page.getByText("Il verdetto Mapetite").waitFor({ timeout: 3000 });
ok(true, "pin toccato due volte: si apre la scheda");
await shot("05b-carosello-pin");
// Più vicini + Affina
await page.getByRole("button", { name: "Chiudi" }).last().click().catch(() => {});
await page.goto(`${BASE}/mappa`, { waitUntil: "networkidle" });
await page.getByRole("button", { name: "Rooftop romantico per due a Roma", exact: true }).click();
await page.getByText("Vista vera sui tetti di Roma.").first().waitFor({ timeout: 6000 });
const firstCard = () => page.locator("ul.snap-x li").first().getAttribute("data-id");
ok((await firstCard()) === "P1", "ordine iniziale: prima Terrazza Uno (la più adatta)");
await page.getByRole("button", { name: "Più vicini" }).click();
ok((await firstCard()) === "P3", "'Più vicini': prima Rooftop Tre (200 m)");
await page.waitForTimeout(300);
ok((await page.locator("[data-testid=pin][data-focused=true]").innerText()).includes("Rooftop Tre"), "'Più vicini': il pin evidenziato segue la prima card");
await page.evaluate(() => { window.__shared = null; navigator.share = async (d) => { window.__shared = d; }; });
await page.getByRole("button", { name: "Condividi questa ricerca" }).click();
const sharedUrl = await page.evaluate(() => window.__shared?.url ?? "");
ok(/\/mappa\?q=Rooftop romantico per due a Roma&at=-?\d+\.\d+,-?\d+\.\d+$/.test(decodeURIComponent(sharedUrl)), "condividi ricerca: link che riapre la stessa ricerca nello stesso punto");
await page.getByRole("button", { name: "Affina" }).click();
const refine = page.locator("input[type=text]");
await refine.waitFor({ timeout: 3000 });
ok((await refine.inputValue()).startsWith("Rooftop romantico"), "'Affina': riapre la ricerca con la frase da correggere");
await page.getByRole("button", { name: "+ economico" }).click();
await page.getByTestId("titolo-risposta").filter({ hasText: "economico" }).waitFor({ timeout: 5000 });
ok(true, "'Affina' + '+ economico': rifà la ricerca con la frase allungata");
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
await shot("09c-cerca-in-area");
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
await page.getByRole("button", { name: "Ricerca con l'AI" }).click();
ok((await page.getByTestId("aggiunte-rapide").getByText(/^↻ /).count()) >= 1, "pannello ✨: mostra anche le ricerche recenti");
await page.getByRole("button", { name: "Ricerca con l'AI" }).click();

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

// 5f. Ricerca scritta direttamente nella card iniziale
await page.goto(`${BASE}/mappa`, { waitUntil: "networkidle" });
await page.getByLabel("Scrivi cosa cerchi").fill("aperitivo sul tetto a Monti");
await page.getByLabel("Scrivi cosa cerchi").press("Enter");
await page.getByText("Terrazza Uno").first().waitFor({ timeout: 5000 });
ok((await page.getByTestId("titolo-risposta").textContent())?.includes("aperitivo sul tetto"), "card iniziale: si scrive e si cerca senza aprire altri pannelli");

// 5h. Home (/) come Places: esempi e campo portano alla mappa con la ricerca già avviata
await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
await shot("00-home");
await page.getByLabel("Cosa cerchi?").fill("pizza napoletana a Testaccio");
await page.getByLabel("Cosa cerchi?").press("Enter");
await page.getByText("Terrazza Uno").first().waitFor({ timeout: 8000 });
ok(page.url().includes("/mappa") && !page.url().includes("q=") && (await page.getByTestId("titolo-risposta").textContent())?.includes("pizza napoletana"), "home: il campo apre la mappa e la ricerca parte da sola");
await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
await page.getByRole("link", { name: /Rooftop romantico/ }).click();
await page.getByText("Terrazza Uno").first().waitFor({ timeout: 8000 });
ok(true, "home: un esempio apre la mappa con i risultati");

// 5d. Foto non disponibili (quota finita): resta l'emoji, nessun errore
photoMode = "off";
await page.goto(`${BASE}/mappa`, { waitUntil: "networkidle" });
await page.getByRole("button", { name: "Rooftop romantico per due a Roma", exact: true }).click();
await page.getByText("Terrazza Uno").first().waitFor({ timeout: 5000 });
// le immagini falliscono una alla volta: si aspetta fino a 3 s che restino solo le emoji
let noPhotos = false;
for (let i = 0; i < 15 && !noPhotos; i++) { await page.waitForTimeout(200); noPhotos = (await page.locator("ul img").count()) === 0; }
ok(noPhotos && (await page.locator("ul").getByText("🍺").count()) >= 1, "foto: con quota finita le card mostrano l'emoji");
photoMode = "ok";

// 6. Errore di rete/API
searchMode = "error";
await page.goto(`${BASE}/mappa`, { waitUntil: "networkidle" });
await page.getByRole("button", { name: "Colazione buona qui vicino", exact: true }).click();
await page.getByText(/Qualcosa è andato storto/).first().waitFor({ timeout: 4000 });
ok(true, "errore API: messaggio umano mostrato nella card");
await shot("06-errore");
searchMode = "ok";

// 6b. Nessun risultato: pulsanti per riprovare
searchMode = "empty";
await page.goto(`${BASE}/mappa`, { waitUntil: "networkidle" });
await page.getByRole("button", { name: "Rooftop romantico per due a Roma", exact: true }).click();
await page.getByText("Non ho trovato nulla").waitFor({ timeout: 4000 });
ok(await page.getByRole("button", { name: "Correggi la ricerca" }).isVisible(), "nessun risultato: pulsante 'Correggi la ricerca'");
await shot("06b-nessun-risultato");
await page.getByRole("button", { name: "Vedi esempi" }).click();
ok(await page.getByText("Cosa cerchi?").isVisible(), "nessun risultato: 'Vedi esempi' riporta alla card iniziale");
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
ok(await p2.getByTestId("tu-sei-qui").isVisible(), "posizione concessa: punto blu 'tu sei qui' sulla mappa");
await p2.getByRole("button", { name: "La mia posizione" }).click();
ok(true, "pulsante 'La mia posizione' sempre disponibile in alto a destra");
await p2.screenshot({ path: `${OUT}/07b-posizione.png` });
await ctx2.close();
// posizione concessa vicino ai risultati: il pulsante percorso mostra i minuti a piedi (come Places)
const ctx3 = await browser.newContext({ viewport: { width: 390, height: 844 }, permissions: ["geolocation"], geolocation: { latitude: 41.8995, longitude: 12.4895 } });
await ctx3.route("**/api/places/photo**", (route) => route.fulfill({ status: 429, json: {} }));
await ctx3.route("**/api/search", (route) => route.fulfill({ json: SEARCH_FAST }));
await ctx3.route("**/api/search/synthesis", (route) => route.fulfill({ json: SYNTH }));
const p3 = await ctx3.newPage();
await p3.goto(`${BASE}/mappa`, { waitUntil: "networkidle" });
await p3.getByRole("button", { name: "Usa la mia posizione" }).click();
await p3.waitForTimeout(1200);
await p3.locator("button:has(svg.lucide-sparkles)").first().click();
await p3.locator("input[type=text]").fill("rooftop");
await p3.getByRole("button", { name: "Cerca", exact: true }).click();
await p3.getByText("Terrazza Uno").first().waitFor({ timeout: 5000 });
await p3.getByText("Terrazza Uno").first().click();
await p3.getByText("Il verdetto Mapetite").waitFor({ timeout: 4000 });
const walkLabel = (await p3.locator("a[aria-label^='Indicazioni']").first().getAttribute("aria-label")) ?? "";
ok(/Indicazioni: \d+ min a piedi/.test(walkLabel), `scheda: minuti a piedi sul pulsante percorso (${walkLabel})`);
await p3.screenshot({ path: `${OUT}/04b-scheda-a-piedi.png` });
await ctx3.close();

// 7-bis. Condividi la ricerca: il link porta richiesta e punto della mappa
await page.goto(`${BASE}/mappa`, { waitUntil: "networkidle" });
await page.evaluate(() => { navigator.share = async (d) => { window.__shared = d; }; });
await page.getByRole("button", { name: "Rooftop romantico per due a Roma", exact: true }).click();
await page.getByLabel("Condividi questa ricerca").click();
const shared = await page.evaluate(() => window.__shared ?? null);
ok(!!shared && /\/mappa\?q=Rooftop/.test(shared.url) && /&at=-?\d+\.\d+,-?\d+\.\d+/.test(shared.url), `condividi ricerca: link con richiesta e punto (${shared?.url ?? "nessuno"})`);
if (shared) {
  let body = null;
  await page.route("**/api/search", async (route) => { body = route.request().postDataJSON(); return route.fulfill({ json: SEARCH_FAST }); });
  await page.goto(shared.url, { waitUntil: "networkidle" });
  await page.getByTestId("titolo-risposta").waitFor({ timeout: 6000 });
  ok(/Rooftop romantico/i.test(await page.getByTestId("titolo-risposta").innerText()), "link ricerca: apre la stessa ricerca con il titolo");
  const at = new URL(shared.url).searchParams.get("at").split(",").map(Number);
  ok(body && Math.abs(body.lat - at[0]) < 1e-6 && Math.abs(body.lng - at[1]) < 1e-6, "link ricerca: cerca nel punto di chi ha condiviso");
  ok(!new URL(page.url()).searchParams.has("q"), "link ricerca: dopo l'apertura 'q' sparisce dall'indirizzo (ricaricare non ripete)");
  await shot("14-link-ricerca");
  await page.unroute("**/api/search");
}

// 7-ter. Variante B della scheda (?scheda=b, stile Places; ricordata sul telefono, ?scheda=a torna all'attuale)
await page.goto(`${BASE}/mappa?scheda=b`, { waitUntil: "networkidle" });
await page.getByRole("button", { name: "Rooftop romantico per due a Roma", exact: true }).click();
await page.getByText("Terrazza Uno").first().click();
await page.locator("h2", { hasText: "Terrazza Uno" }).waitFor({ timeout: 4000 });
await page.getByText("Vista vera sui tetti di Roma.").last().waitFor({ timeout: 6000 });
ok((await page.getByText("Il verdetto Mapetite").count()) === 0, "scheda B: layout Places al posto della card teal");
ok(await page.getByText("Bar · €€ · ★ 4,5 (812)").isVisible(), "scheda B: riga categoria · prezzo · voto");
ok(await page.getByText("Aperto ora").last().isVisible(), "scheda B: pill 'Aperto ora'");
for (const [label, sel] of [["Indicazioni", "a[aria-label^='Indicazioni']"], ["Salva", "button:text-is('Salva')"], ["Chiama", "a[href^='tel:']"], ["Sito", "a[aria-label^='Sito di']"]]) {
  const box = await page.locator(sel).first().boundingBox();
  ok(!!box && box.y + box.height <= 844 && box.y >= 0 && box.x >= 0 && box.x + box.width <= 390 && box.height >= 40, `scheda B: pulsante ${label} nel viewport e alto almeno 40px`);
}
ok((await page.getByLabel(/^Condividi Terrazza/).count()) === 1, "scheda B: un solo pulsante Condividi (sulla foto)");
await shot("15-scheda-b");
await page.goto(`${BASE}/mappa`, { waitUntil: "networkidle" });
ok(await page.evaluate(() => document.documentElement.dataset.scheda === "b"), "scheda B: la scelta resta senza parametro");
await page.goto(`${BASE}/mappa?scheda=a`, { waitUntil: "networkidle" });
await page.getByRole("button", { name: "Rooftop romantico per due a Roma", exact: true }).click();
await page.getByText("Terrazza Uno").first().click();
await page.getByText("Il verdetto Mapetite").waitFor({ timeout: 4000 });
ok(true, "?scheda=a: torna la scheda attuale");

// 7-quater. Primo accesso variante B (?home=b): si scrive subito, senza aprire un altro pannello
await page.goto(`${BASE}/mappa?home=b`, { waitUntil: "networkidle" });
ok(await page.getByLabel("Cosa cerchi?").isVisible(), "home B: campo di ricerca visibile subito");
ok((await page.getByRole("button", { name: "Rooftop romantico per due a Roma", exact: true }).count()) === 1, "home B: esempi a schede cliccabili");
ok((await page.getByRole("button", { name: "Usa la mia posizione" }).count()) === 1, "home B: pulsante 'Vicino a me'");
{ const hb = (await page.getByTestId("benvenuto").boundingBox())?.height ?? 999; ok(hb < 844 * 0.35, `home B: la mappa resta visibile (altezza ${Math.round(hb)}px)`); }
await shot("16-home-b");
await page.getByLabel("Cosa cerchi?").fill("rooftop con vista");
await page.getByLabel("Cosa cerchi?").press("Enter");
await page.getByTestId("titolo-risposta").waitFor({ timeout: 5000 });
ok(/rooftop con vista/i.test(await page.getByTestId("titolo-risposta").innerText()), "home B: Invio avvia la ricerca scritta");
await page.goto(`${BASE}/mappa?home=a`, { waitUntil: "networkidle" });
ok(await page.getByLabel("Scrivi cosa cerchi").isVisible(), "?home=a: torna il primo accesso attuale");

// 7-quinquies. Pin con foto (?pin=b): stesse foto delle card, nessuna foto in più
await page.goto(`${BASE}/mappa?pin=b`, { waitUntil: "networkidle" });
await page.getByRole("button", { name: "Rooftop romantico per due a Roma", exact: true }).click();
await page.getByText("Vista vera sui tetti di Roma.").first().waitFor({ timeout: 6000 });
await page.waitForTimeout(500);
const pinSrcs = await page.locator("[data-testid=pin] img").evaluateAll((els) => els.map((e) => e.getAttribute("src")));
const cardSrcs = await page.locator("ul.snap-x img").evaluateAll((els) => els.map((e) => e.getAttribute("src")));
ok(pinSrcs.length >= 1, `pin con foto: ${pinSrcs.length} pin mostrano la foto`);
ok(pinSrcs.every((src) => cardSrcs.includes(src)), "pin con foto: usano le stesse foto delle card (nessun costo in più)");
await shot("20-pin-foto");
await page.goto(`${BASE}/mappa?pin=a`, { waitUntil: "networkidle" });

// 7-septies. Haiku non risponde: la lista Google resta, sparisce "preparo i verdetti"
await page.route("**/api/search/synthesis", (r) => r.fulfill({ status: 500, json: { error: "x" } }));
await page.goto(`${BASE}/mappa`, { waitUntil: "networkidle" });
await page.getByRole("button", { name: "Rooftop romantico per due a Roma", exact: true }).click();
await page.getByText("Terrazza Uno").first().waitFor({ timeout: 5000 });
await page.waitForTimeout(800);
ok(!(await page.getByText(/preparo i verdetti/).isVisible()) && (await page.locator("ul.snap-x li").count()) === 3, "senza Haiku: restano i 3 locali Google e il caricamento si chiude");
await page.unroute("**/api/search/synthesis");

// 7-sexies. Un solo interruttore per tutte le varianti
await page.goto(`${BASE}/mappa?stile=places`, { waitUntil: "networkidle" });
ok(await page.evaluate(() => { const d = document.documentElement.dataset; return d.titoli === "serif" && d.scheda === "b" && d.home === "b" && d.pin === "b"; }), "?stile=places accende tutte le varianti");
await page.goto(`${BASE}/mappa?stile=attuale`, { waitUntil: "networkidle" });
ok(await page.evaluate(() => { const d = document.documentElement.dataset; return !d.titoli && !d.scheda && !d.home && !d.pin; }), "?stile=attuale le spegne tutte");

// 7a. Variante titoli serif (?titoli=serif, ricordata sul telefono; ?titoli=sans torna a Poppins)
const titleFont = async () => page.evaluate(() => { const h = document.querySelector("[data-testid=benvenuto] .font-title"); return h ? getComputedStyle(h).fontFamily : ""; });
await page.goto(`${BASE}/mappa`, { waitUntil: "networkidle" });
{ const f = await titleFont(); ok(/Poppins/i.test(f), `titoli: Poppins di default (${f.slice(0, 40)})`); }
await page.goto(`${BASE}/mappa?titoli=serif`, { waitUntil: "networkidle" });
ok(/Newsreader/i.test(await titleFont()), "titoli: ?titoli=serif accende il serif");
await page.goto(`${BASE}/mappa`, { waitUntil: "networkidle" });
ok(/Newsreader/i.test(await titleFont()), "titoli: la scelta resta anche senza parametro");
await page.goto(`${BASE}/mappa?titoli=sans`, { waitUntil: "networkidle" });
ok(/Poppins/i.test(await titleFont()), "titoli: ?titoli=sans torna a Poppins");

// 7c. Accesso, registrazione e importa: stile dell'app, niente zoom su iPhone, testi in italiano
await page.goto(`${BASE}/login?error=Email%20o%20password%20non%20corrette.`, { waitUntil: "networkidle" });
ok(await page.getByRole("alert").getByText("Email o password non corrette.").isVisible(), "login: messaggio d'errore in evidenza");
ok(await page.locator("#email").evaluate((el) => parseFloat(getComputedStyle(el).fontSize) >= 16), "login: campi da almeno 16px (niente zoom su iPhone)");
ok(await page.getByRole("link", { name: "Intanto prova a cercare senza account" }).isVisible(), "login: si può provare l'app senza account");
await shot("18-login");
await page.goto(`${BASE}/signup`, { waitUntil: "networkidle" });
ok(await page.getByText("Almeno 6 caratteri.").isVisible(), "registrazione: regola della password spiegata prima dell'errore");
await page.goto(`${BASE}/importa`, { waitUntil: "networkidle" });
ok(await page.getByText("Scegli uno screenshot").isVisible(), "importa: pulsante per scegliere lo screenshot in italiano");
await shot("19-importa");

// 7b. Feedback dei tester: email precompilata con pagina e telefono
await page.goto(`${BASE}/mappa?lista=b`, { waitUntil: "networkidle" });
const fb = page.getByRole("link", { name: "Feedback" });
ok(await fb.isVisible(), "feedback: voce 'Feedback' nella barra in basso");
await fb.evaluate((a) => a.addEventListener("click", (e) => e.preventDefault()));
await fb.click();
const fbHref = decodeURIComponent((await fb.getAttribute("href")) ?? "");
ok(fbHref.startsWith("mailto:founder.mapetite@gmail.com") && fbHref.includes("Pagina: /mappa?lista=b"), "feedback: email precompilata con la pagina in cui si trova il tester");

// 7c. iPhone: invito ad aggiungere alla Home (solo a chi ha già cercato)
const ctxIos = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1" });
const pi = await ctxIos.newPage();
await pi.goto(`${BASE}/mappa`, { waitUntil: "networkidle" });
ok((await pi.getByTestId("installa").count()) === 0, "iPhone, primo accesso: nessun invito a installare");
await pi.evaluate(() => localStorage.setItem("mapetite.recenti", JSON.stringify(["rooftop a Roma"])));
await pi.reload({ waitUntil: "networkidle" });
await pi.getByText("📲 Aggiungi Mapetite alla Home").click();
ok(await pi.getByText("Aggiungi alla schermata Home").isVisible(), "iPhone, chi torna: invito con le istruzioni per la Home");
await pi.screenshot({ path: `${OUT}/07c-installa-iphone.png` });
await pi.getByRole("button", { name: "Non mostrare più" }).click();
await pi.reload({ waitUntil: "networkidle" });
ok((await pi.getByTestId("installa").count()) === 0, "iPhone: chiuso l'invito non ricompare");
await ctxIos.close();

// 8. Pagine pubbliche: si aprono e il pulsante principale non è coperto
for (const r of ["login", "signup", "profilo", "importa", "onboarding"]) {
  const resp = await page.goto(`${BASE}/${r}`, { waitUntil: "networkidle" });
  ok(resp?.status() === 200, `/${r} risponde 200`);
}
const r404 = await page.goto(`${BASE}/pagina-che-non-esiste`, { waitUntil: "networkidle" });
ok(r404?.status() === 404 && await page.getByText("Questa pagina non esiste").isVisible(), "404 in italiano con invito ad aprire la mappa");
await page.goto(`${BASE}/importa`, { waitUntil: "networkidle" });
await page.getByLabel("Scegli uno screenshot").setInputFiles({ name: "post.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64") });
ok(await page.getByText("Cambia screenshot").isVisible() && await page.getByText("post.png").isVisible(), "importa: area grande per scegliere lo screenshot, in italiano");
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

// 8b. Salvati vuoti (con l'utente finto il giro principale ha zero salvati): invito a cercare
if (await page.goto(`${BASE}/mappa`, { waitUntil: "networkidle" }).then(() => page.getByRole("button", { name: "I miei salvati" }).click()).then(() => page.getByText("Accesso richiesto").isVisible())) {
  console.log("SKIP  salvati vuoti: dev server senza E2E_FAKE_USER");
} else {
  await page.getByText("Nessun posto salvato").waitFor({ timeout: 4000 });
  await page.getByRole("button", { name: "Cerca un locale" }).click();
  ok(await page.getByText("Cosa cerchi?").isVisible(), "salvati vuoti: 'Cerca un locale' riporta alla ricerca");
}

// 9. Salvati (voce 8): città dall'indirizzo, ricerca nel testo, nota sulle card.
// Supabase simulato; serve il dev server avviato con E2E_FAKE_USER.
const fakeUser = await page.goto(`${BASE}/mappa`).then(() => page.getByRole("button", { name: "I miei salvati" }).click())
  .then(() => page.getByText("Accesso richiesto").isVisible({ timeout: 1500 })).then((v) => !v);
if (!fakeUser) console.log("SKIP  salvati: dev server senza E2E_FAKE_USER");
else {
  const rows = [
    { tags: ["romantico"], note: "Tavolo sulla terrazza", places: { id: "00000000-0000-4000-8000-000000000001", name: "Terrazza Uno", category: "bar", address: "Via Po, 2/a, 00198 Roma RM, Italy", lat: 41.9, lng: 12.49, google_place_id: "G1", rating: 4.6, price_level: 2 } },
    { tags: ["amici"], note: null, places: { id: "00000000-0000-4000-8000-000000000002", name: "Osteria Due", category: "restaurant", address: "Via dei Vascellari 29, Roma", lat: 41.89, lng: 12.47, google_place_id: "G2" } },
    { tags: null, note: "Brunch domenica", places: { id: "00000000-0000-4000-8000-000000000003", name: "Caffè Milano", category: "cafe", address: "Corso Monforte, 26, 20122 Milano MI, Italy", lat: 45.46, lng: 9.2, google_place_id: "G3" } },
  ];
  const sctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await sctx.route("**/rest/v1/saved_places**", (r) => r.request().url().includes("select=place_id") ? r.fulfill({ json: rows.map((x) => ({ place_id: x.places.id })) }) : r.fulfill({ json: rows }));
  await sctx.route("**/rest/v1/place_synthesis**", (r) => r.fulfill({ json: [] }));
  await sctx.route("**/api/places/photo**", (r) => r.fulfill({ status: 429, json: {} }));
  await sctx.route("**/api/search", (r) => r.fulfill({ json: SEARCH_FAST }));
  await sctx.route("**/api/search/synthesis", (r) => r.fulfill({ json: SYNTH }));
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
  ok((await p.getByTestId("intestazione-lista").textContent()) === "I tuoi salvati · Milano", "salvati: intestazione 'I tuoi salvati · Milano'");
  ok((await p.getByTestId("filtri-lista").count()) === 0, "salvati: niente filtri rapidi (mancano orari e voti)");
  await p.waitForTimeout(1500);
  const pin = await p.getByTestId("pin").first().boundingBox();
  ok(!!pin && pin.y > 200 && pin.y < 844 * 0.6 && pin.x > 0 && pin.x < 390, "filtro Milano: la mappa si sposta su Milano (pin visibile)");
  await p.screenshot({ path: `${OUT}/13-salvati-milano.png` });
  await p.getByRole("button", { name: "📍 Milano · 1" }).click();
  await p.getByLabel("Cerca tra i salvati").fill("terrazza");
  ok((await p.locator("ul.snap-x li").count()) === 1 && await p.locator("ul.snap-x").getByText("Terrazza Uno").isVisible(), "ricerca 'terrazza': solo Terrazza Uno");
  ok(await p.locator("ul.snap-x").getByText("“Tavolo sulla terrazza”").isVisible(), "card salvato: mostra la nota");
  ok(await p.locator("ul.snap-x li").first().getByText(/★ 4,6 · €€/).isVisible(), "card salvato: voto e prezzo salvati");
  await p.screenshot({ path: `${OUT}/12-salvati-ricerca.png` });
  await p.getByLabel("Cerca tra i salvati").fill("sushi");
  ok(await p.getByText("Nessun salvato con questi filtri").isVisible(), "nessun risultato: messaggio chiaro");
  await p.getByRole("button", { name: "Tutti", exact: true }).click();
  ok((await p.getByLabel("Cerca tra i salvati").inputValue()) === "" && (await p.locator("ul.snap-x li").count()) === 3, "salvati: 'Tutti' azzera anche il testo cercato");
  await p.getByRole("button", { name: "Tutti", exact: true }).click();
  // Stato del salvato: "Ci sono stato" con un tocco nella scheda (tag esistente, nessuna migrazione)
  let patched = null;
  await p.route("**/rest/v1/saved_places**", (r) => {
    if (r.request().method() === "PATCH") { patched = r.request().postDataJSON(); return r.fulfill({ status: 204, body: "" }); }
    return r.fallback();
  });
  await p.getByLabel("Cerca tra i salvati").fill("");
  await p.locator("ul.snap-x li").first().locator("button").last().click();
  await p.getByTestId("stato-salvato").waitFor({ timeout: 3000 });
  await p.getByRole("button", { name: "✓ Ci sono stato" }).click();
  await p.waitForTimeout(500);
  ok(JSON.stringify(patched?.tags ?? []).includes("Già visitato") && (await p.getByRole("button", { name: "✓ Ci sono stato" }).getAttribute("aria-pressed")) === "true", "scheda salvato: 'Ci sono stato' con un tocco");
  await p.screenshot({ path: `${OUT}/13b-stato-salvato.png` });
  await p.keyboard.press("Escape");
  await p.unroute("**/rest/v1/saved_places**");

  // Segnalibro sulla card: con l'account apre "Salva locale" senza passare dalla scheda
  await p.goto(`${BASE}/mappa`, { waitUntil: "networkidle" });
  await p.getByRole("button", { name: "Rooftop romantico per due a Roma", exact: true }).click();
  await p.getByRole("button", { name: "Salva Rooftop Tre" }).click();
  await p.getByText("Salva locale").waitFor({ timeout: 3000 });
  ok(true, "segnalibro sulla card: apre 'Salva locale' (tag e nota)");
  await p.screenshot({ path: `${OUT}/14-salva-da-card.png` });
  await sctx.close();

  // 9b. Salvare un locale da una ricerca (voce 9): Supabase e /api/places/add simulati, nessuna scrittura vera.
  const vctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const writes = [];
  let addMode = "error";
  await vctx.route("**/api/search", (r) => r.fulfill({ json: SEARCH_FAST }));
  await vctx.route("**/api/search/synthesis", (r) => r.fulfill({ json: SYNTH }));
  await vctx.route("**/api/places/photo**", (r) => r.fulfill({ status: 429, json: {} }));
  await vctx.route("**/api/places/add", (r) => addMode === "error"
    ? r.fulfill({ status: 500, json: { error: "x" } })
    : r.fulfill({ json: { place: { id: "11111111-2222-3333-4444-555555555555" } } }));
  await vctx.route("**/rest/v1/saved_places**", (r) => {
    const m = r.request().method();
    if (m === "GET") return r.fulfill({ json: [] });
    writes.push({ m, url: r.request().url(), body: r.request().postDataJSON?.() ?? null });
    return r.fulfill({ status: m === "POST" ? 201 : 204, body: "" });
  });
  await vctx.route("**/rest/v1/reviews**", (r) => r.fulfill({ json: [] }));
  await vctx.route("**/rest/v1/place_synthesis**", (r) => r.fulfill({ json: [] }));
  const v = await vctx.newPage();
  v.on("pageerror", (e) => errors.push(e.message));
  v.on("dialog", (d) => d.accept());
  await v.goto(`${BASE}/mappa`, { waitUntil: "networkidle" });
  await v.getByRole("button", { name: "Rooftop romantico per due a Roma", exact: true }).click();
  await v.getByText("Terrazza Uno").first().click();
  await v.getByText("Il verdetto Mapetite").waitFor({ timeout: 4000 });
  await v.locator("button:text-is('Salva')").first().click();
  const modal = v.locator("div.w-80");
  await modal.getByText("Salva locale").waitFor({ timeout: 3000 });
  ok(true, "salva: si apre la finestra con tag e nota");
  await modal.getByRole("button", { name: "Romantico" }).click();
  await modal.locator("textarea").fill("Tavolo vicino alla ringhiera");
  await modal.getByRole("button", { name: "Salva", exact: true }).click();
  await modal.getByText("Errore durante il salvataggio. Riprova.").waitFor({ timeout: 3000 });
  ok(true, "salva: se il server non risponde, messaggio d'errore e la finestra resta aperta");
  addMode = "ok";
  await modal.getByRole("button", { name: "Salva", exact: true }).click();
  await v.locator("button:text-is('Salvato')").waitFor({ timeout: 4000 });
  const ins = writes.find((w) => w.m === "POST");
  ok(!!ins && ins.body?.place_id === "11111111-2222-3333-4444-555555555555" && JSON.stringify(ins.body?.tags) === '["Romantico"]' && ins.body?.note === "Tavolo vicino alla ringhiera",
    "salva: scrive in saved_places l'UUID Supabase con tag e nota");
  ok(await v.getByText("Le tue note").isVisible() && await v.getByText("Tavolo vicino alla ringhiera").isVisible(), "salva: tag e nota compaiono subito nella scheda");
  ok(await v.locator("a[aria-label^='Indicazioni'] span").first().evaluate((el) => el.scrollWidth <= el.clientWidth), "salvato: la scritta 'Percorso' non viene tagliata");
  { const box = await v.locator("a[aria-label^='Sito di']").boundingBox(); ok(!!box && box.x + box.width <= 390, "salvato: il pulsante Sito resta nello schermo"); }
  await v.screenshot({ path: `${OUT}/17-salvato.png` });
  await v.locator("button:text-is('Salvato')").click();
  await v.locator("button:text-is('Salva')").first().waitFor({ timeout: 4000 });
  const del = writes.find((w) => w.m === "DELETE");
  ok(!!del && del.url.includes("place_id=eq.11111111-2222-3333-4444-555555555555"), "rimuovi: dopo la conferma cancella il salvato giusto e il pulsante torna 'Salva'");
  await vctx.close();
}

ok(errors.length === 0, `nessun errore JavaScript in console${errors.length ? ": " + errors.slice(0, 3).join(" | ") : ""}`);
await browser.close();
console.log(failed === 0 ? "\nTUTTO OK" : `\n${failed} CONTROLLI FALLITI`);
process.exit(failed === 0 ? 0 : 1);
