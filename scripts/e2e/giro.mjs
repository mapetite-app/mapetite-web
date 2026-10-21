// Giro di controllo automatico a viewport mobile 390x844.
// Le API di ricerca sono SIMULATE (nessuna chiamata Google/Haiku, nessun costo):
// verifica l'interfaccia, non la qualità delle ricerche.
//   E2E_FAKE_USER=00000000-0000-0000-0000-000000000001 npm run dev   (in un altro terminale)
//   (senza E2E_FAKE_USER il blocco "salvati" viene saltato)
//   PW_MODULE=$(npm root -g)/playwright node scripts/e2e/giro.mjs [cartella-screenshot]
import { createRequire } from "module";
import { mkdirSync, readFileSync } from "fs";
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
  verdict: null, goFor: null, dontExpect: null, matchReason: null,
  // Firma del server sui dati Google (src/lib/catalog-sig.ts): qui finta, il telefono la deve solo inoltrare.
  firma: `firma-${id}`, ...extra,
});
const PLACES = [
  mk("P1", "Terrazza Uno", 41.9, 12.49, { photoAuthor: "Maria R." }),
  mk("P2", "Pub Fuori Tema", 41.901, 12.492),
  mk("P3", "Rooftop Tre", 41.902, 12.494, { openNow: false, rating: 4.7, userRatingCount: 180, category: "cocktail_bar" }),
];
// Molti locali vicinissimi + uno lontano (la mappa si allarga): i primi 5 non devono finire in un cerchio.
const FOLLA = [
  ...Array.from({ length: 10 }, (_, i) => mk(`F${i + 1}`, `Folla ${i + 1}`, 41.89 + (i % 5) * 0.0003, 12.47 + Math.floor(i / 5) * 0.0003)),
  mk("F11", "Folla Lontano", 41.95, 12.55),
];
const SEARCH_FAST = {
  risultati: PLACES,
  filtri_usati: { categoria: "bar", parole_chiave: ["rooftop"], vicino_a_me: false, zona: "Roma" },
  sintesi_pendente: { places: [], token: "x" },
};
const SYNTH = {
  dettagli: {
    P1: { synthesis: "Terrazza con vista.", tags: ["vivace"], verdict: "Vista vera sui tetti di Roma.", goFor: ["tramonto"], dontExpect: [], matchReason: "Ha una vera terrazza.", requisiti: ["rooftop", "romantico"] },
    P3: { synthesis: "Rooftop curato.", tags: [], verdict: "Cocktail curati sul tetto.", goFor: ["cocktail"], dontExpect: [], matchReason: "È su un rooftop." },
  },
  esclusi: ["P2"],
};

let failed = 0;
const ok = (cond, msg) => { console.log(`${cond ? "PASS" : "FAIL"}  ${msg}`); if (!cond) failed++; };
// Pannello "Ti suggeriamo" (Lorenzo 16/10): sulla mappa i suggerimenti stanno dietro il pulsante "Idee".
async function idee(pg) {
  const pan = pg.getByTestId("idee-pannello");
  if (await pan.isVisible().catch(() => false)) return;
  await pg.getByTestId("apri-idee").click();
  await pan.waitFor({ timeout: 5000 });
}
// Sulla mappa non c'è più "Esplora / I miei salvati" (doppione della barra in basso, 18/10): si passa dalla barra.
const vaiSalvati = (pg) => pg.locator("nav").first().getByRole("link", { name: "Salvati" }).evaluate((a) => a.click());
const vaiEsplora = (pg) => pg.locator("nav").first().getByRole("link", { name: "Mappa" }).evaluate((a) => a.click());
// Frase d'esempio "Rooftop romantico…": visibile subito (card vecchie) o aprendo "Idee".
// Con la mappa su Milano (ultima vista salvata da un test sui salvati di Milano) l'esempio è "… a Milano" (18/10).
async function esempio(pg) {
  const b = pg.getByRole("button", { name: /^Rooftop romantico per due a (Roma|Milano)$/ });
  const idea = pg.getByTestId("apri-idee");
  for (let i = 0; i < 50; i++) {
    if (await b.isVisible().catch(() => false)) return b;
    if (await idea.isVisible().catch(() => false)) { await idee(pg); return b; }
    await pg.waitForTimeout(200);
  }
  return b;
}
// Card del carosello (lista nuova, 19/10): una card di lato al primo tocco si centra, al secondo apre la scheda.
async function apriCard(pg, nome) {
  await pg.locator("ul.snap-x").getByText(nome).first().click();
  if (await pg.getByTestId("barra-azioni").first().waitFor({ timeout: 1200 }).then(() => true, () => false)) return;
  await pg.locator("ul.snap-x").getByText(nome).first().click();
}
// Intestazione dei risultati in una riga (Lorenzo 16/10): "Ho capito", 🧭, Affina e Condividi stanno dietro "⋯".
async function apriOpzioni(pg) {
  const pan = pg.getByTestId("opzioni-pannello");
  if (await pan.isVisible().catch(() => false)) return;
  await pg.getByTestId("opzioni-ricerca").click();
  await pan.waitFor({ timeout: 3000 });
}
// Chiavi dei segnali che /api/events conserva (le altre le scarta in silenzio): lette dal codice
// del server, così un segnale con una chiave sbagliata non sembra arrivato quando non lo è.
const SERVER_PROP_KEYS = [...(readFileSync(new URL("../../src/app/api/events/route.ts", import.meta.url), "utf8").match(/const PROP_KEYS = \[([\s\S]*?)\]/)?.[1] ?? "").matchAll(/"([a-z_]+)"/g)].map((m) => m[1]);
const droppedKeys = (evs) => evs.flatMap((e) => Object.keys(e.props ?? {}).filter((k) => !SERVER_PROP_KEYS.includes(k)).map((k) => `${e.type}.${k}`));

// 0. Ritorno dopo l'accesso: il parametro `next` accetta solo percorsi interni (niente open redirect).
//    Node 22.18+ legge il .ts direttamente (tipi rimossi), senza server né rete.
{
  let np = null;
  try { np = await import(new URL("../../src/lib/next-path.ts", import.meta.url).href); } catch (e) { ok(false, `next: modulo src/lib/next-path.ts importabile (${e.message})`); }
  if (np) {
    const { safeNext, withNext, afterLoginPath } = np;
    for (const p of ["/locali/abc", "/locali/44444444-0000-4000-8000-000000000004?salva=1", "/stasera", "/importa", "/importa/condividi/immagine?nome=Da+Enzo&citta=Roma"]) ok(safeNext(p) === p, `next: "${p}" accettato`);
    for (const p of ["//evil.com", "https://evil.com", "http:/evil.com", "/\\evil.com", "/\\/evil.com", "javascript:alert(1)", "/..//evil.com", "/.//evil.com", "/\tevil", " //evil.com", "/login?next=/x", "/signup", "/api/search", "locali/abc", "", "/" + "a".repeat(600)]) ok(safeNext(p) === null, `next: ${JSON.stringify(p.length > 40 ? p.slice(0, 20) + "…" : p)} rifiutato`);
    ok(safeNext(undefined) === null && safeNext(["/x"]) === null, "next: valori non testuali rifiutati");
    // Link dell'email di conferma: /login?code=… passa alla route che apre la sessione; link scaduto in italiano
    const conf = await fetch(`${BASE}/login?code=abc123&next=%2Fstasera`, { redirect: "manual" });
    ok(conf.status === 307 && (conf.headers.get("location") ?? "").endsWith("/auth/conferma?code=abc123&next=%2Fstasera"), `conferma email: il link apre la sessione (${conf.status} ${conf.headers.get("location")})`);
    const scad = await (await fetch(`${BASE}/login?error=access_denied&error_code=otp_expired`)).text();
    ok(scad.includes("Il link non è più valido") && !scad.includes(">access_denied<"), "conferma email: link scaduto spiegato in italiano");
    ok(safeNext("/password-dimenticata") === null && safeNext("/reimposta-password?x=1") === null, "next: dopo l'accesso non si torna alle pagine della password");
    ok(withNext("/login", "/locali/abc") === "/login?next=%2Flocali%2Fabc" && withNext("/login?error=x", "/stasera") === "/login?error=x&next=%2Fstasera" && withNext("/login", "//evil.com") === "/login", "next: withNext aggiunge solo percorsi validi");
    ok(afterLoginPath("/locali/abc?salva=1", true) === "/locali/abc?salva=1", "dopo l'accesso: chi ha già fatto l'onboarding torna a next");
    ok(afterLoginPath(null, true) === "/mappa" && afterLoginPath("https://evil.com", true) === "/mappa", "dopo l'accesso: senza next (o con next non valido) si va alla mappa come prima");
    ok(afterLoginPath("/stasera", false) === "/onboarding?next=%2Fstasera" && afterLoginPath(null, false) === "/onboarding", "dopo l'accesso: chi è nuovo passa dall'onboarding portandosi dietro next");
  }
}

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, permissions: [] });
let searchMode = "ok";
let photoMode = "ok";
let photoCalls = 0;
// Segnali di comportamento (/api/events): si registrano qui per controllarli, senza scrivere nulla.
const events = [];
await ctx.route("**/api/events", (route) => { events.push(route.request().postDataJSON()); return route.fulfill({ status: 204, body: "" }); });
await ctx.route("**/api/places/photo**", async (route) => {
  photoCalls++;
  if (photoMode === "off") return route.fulfill({ status: 429, json: { error: "Foto sospese per oggi." } });
  return route.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="#c96"/></svg>' });
});
// Con E2E_FAKE_USER la mappa legge i salvati: nel giro principale risultano vuoti (niente rete verso Supabase).
await ctx.route("**/rest/v1/saved_places**", (route) => route.fulfill({ json: [] }));
await ctx.route("**/rest/v1/place_synthesis**", (route) => route.fulfill({ json: [] }));
await ctx.route("**/rest/v1/profiles**", (route) => route.fulfill({ json: [] }));
let synthDelay = 900;
let searchDelay = 0;
await ctx.route("**/api/search", async (route) => {
  if (searchDelay) await new Promise((r) => setTimeout(r, searchDelay));
  if (searchMode === "error") return route.fulfill({ status: 500, json: { error: "Qualcosa è andato storto. Riprova." } });
  if (searchMode === "empty") return route.fulfill({ json: { ...SEARCH_FAST, risultati: [], sintesi_pendente: null } });
  if (searchMode === "folla") return route.fulfill({ json: { ...SEARCH_FAST, risultati: FOLLA, sintesi_pendente: null } });
  if (searchMode === "senza-zona") return route.fulfill({ json: { ...SEARCH_FAST, filtri_usati: { ...SEARCH_FAST.filtri_usati, zona: null } } });
  return route.fulfill({ json: SEARCH_FAST });
});
await ctx.route("**/api/search/synthesis", async (route) => {
  await new Promise((r) => setTimeout(r, synthDelay));
  return route.fulfill({ json: SYNTH });
});
const page = await ctx.newPage();
// L'intro del primo accesso sulla home ha i suoi controlli (5h0, contesto pulito): qui risulta già vista.
await page.addInitScript(() => { try { localStorage.setItem("mapetite.intro", "visto"); } catch { /* ignorato */ } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message + (process.env.E2E_DEBUG ? " STACK " + (e.stack ?? "").slice(0, 600) + " @ " + page.url() : "")));
page.on("console", async (m) => { if (process.env.E2E_DEBUG && m.type() === "error") console.log("CONSOLE-ERR", m.text().slice(0, 200), JSON.stringify(m.location()), await Promise.all(m.args().map((a) => a.evaluate((v) => (v && v.stack) ? String(v.stack).slice(0, 400) : String(v)).catch(() => "?")))); if (m.type() === "error" && !/Failed to load resource|mapbox|WebGL/i.test(m.text())) errors.push(m.text().slice(0, process.env.E2E_DEBUG ? 3000 : 150) + (process.env.E2E_DEBUG ? " @ " + page.url() : "")); });
// caret "initial": nascondere il cursore aggiunge uno stile ai campi e, durante il caricamento, React lo segnala come differenza.
const shot = (n) => page.screenshot({ path: `${OUT}/${n}.png`, caret: "initial" });

// 1. Primo accesso
await page.goto(`${BASE}/mappa`, { waitUntil: "networkidle" });
ok(await page.evaluate(() => document.documentElement.dataset.scheda === "b"), "scheda stile Places (B) predefinita per chi arriva la prima volta (scelta di Lorenzo, 12/10)");
// Il giro principale controlla anche la vecchia scheda (?scheda=a); la B ha i suoi controlli più avanti.
await page.goto(`${BASE}/mappa?scheda=a`, { waitUntil: "networkidle" });
ok((await page.getByTestId("benvenuto").count()) === 0 && await page.getByTestId("apri-idee").isVisible() && !(await page.getByTestId("idee-pannello").isVisible()), "mappa libera: niente card in basso né righe di suggerimenti, un solo pulsante 'Idee' (Lorenzo 16/10)");
ok(await page.getByRole("button", { name: "Filtri", exact: true }).getByText("Filtri").isVisible(), "barra in alto: pulsante 'Filtri' con la scritta");
ok((await page.getByLabel("Cosa cerchi?").getAttribute("placeholder"))?.includes("Chiedi all'AI"), "barra in alto: si capisce che è la ricerca con l'AI");
{ const pr = await page.getByTestId("pannello-ricerca").boundingBox(); ok(!!pr && pr.y + pr.height < 130, `mappa libera: sopra la mappa solo barra + una riga (fino a ${Math.round((pr?.y ?? 0) + (pr?.height ?? 0))} px)`); }
{ const ib = await page.getByTestId("apri-idee").boundingBox(); ok(!!ib && ib.y < 160 && ib.x + ib.width <= 390, `'Idee' nella riga di 'Esplora / I miei salvati' (y ${Math.round(ib?.y ?? 0)})`); }
ok((await page.getByRole("button", { name: "I miei salvati" }).count()) === 0 && (await page.getByRole("button", { name: "Esplora", exact: true }).count()) === 0, "mappa: niente 'Esplora / I miei salvati' (stanno già nella barra in basso)");
await shot("01-benvenuto");
await idee(page);
{ const pan = page.getByTestId("idee-pannello");
  ok(await pan.getByText("Ti suggeriamo").isVisible() && await pan.getByText("Adesso", { exact: true }).isVisible() && await pan.getByText("Per te").isVisible() && await pan.getByText("Prova a chiedere").isVisible(), "Idee: pannello 'Ti suggeriamo' con i gruppi Adesso · Per te · Prova a chiedere");
  ok(await pan.getByTestId("mappa-sorprendimi").isVisible() && await pan.getByTestId("mappa-assistente").isVisible(), "Idee: Sorprendimi e 'Parla con l'assistente' a due tocchi");
  ok((await page.getByTestId("apri-idee").getAttribute("aria-expanded")) === "true", "Idee: il pulsante dice che il pannello è aperto"); }
ok((await page.getByRole("button", { name: "Rooftop romantico per due a Roma", exact: true }).count()) === 1, "primo accesso: esempi cliccabili presenti");
ok(await page.getByTestId("suggerimento-momento").isVisible(), "primo accesso: suggerimento legato all'ora del giorno");
await shot("01b-idee");
await page.getByTestId("idee-fuori").click({ position: { x: 385, y: 400 } });
ok(!(await page.getByTestId("idee-pannello").isVisible()), "Idee: un tocco sulla mappa chiude il pannello");
await page.getByLabel("Cosa cerchi?").click();
ok(await page.getByTestId("idee-pannello").isVisible(), "Idee: toccando la barra vuota si aprono i suggerimenti");
await page.getByLabel("Cosa cerchi?").fill("trat");
ok(!(await page.getByTestId("idee-pannello").isVisible()), "Idee: mentre scrivi il pannello lascia spazio");
await page.getByLabel("Cosa cerchi?").fill("");
await page.getByTestId("apri-idee").click();
ok(!(await page.getByTestId("idee-pannello").isVisible()), "Idee: secondo tocco su 'Idee' chiude il pannello");

// 2. Ricerca da esempio: lista subito, verdetti dopo, escluso sparisce
// Verdetti finti più lenti solo qui (3 s invece di 0,9): i due controlli "prima dei verdetti"
// a volte arrivavano dopo, in sviluppo con la prima compilazione della pagina (instabile 1 volta su 6).
synthDelay = 3000;
await (await esempio(page)).click();
await page.getByText("Terrazza Uno").first().waitFor({ timeout: 5000 });
ok(await page.getByTestId("verdetti-in-arrivo").isVisible() && /^\d+ posti$/.test((await page.getByTestId("conteggio-risultati").textContent()) ?? ""), "lista: puntino 'verdetti in arrivo' nella pillola mentre aspetta Haiku (la pillola resta 'N posti')");
ok(await page.locator("ul").getByText("Pub Fuori Tema").count() === 1, "lista: prima dei verdetti ci sono tutti i locali");
const firstCardH = () => page.locator("li", { hasText: "Terrazza Uno" }).first().evaluate((el) => el.getBoundingClientRect().height);
const hBefore = await page.getByTestId("segnaposto-verdetto").count() > 0 ? await firstCardH() : null;
synthDelay = 900;
await shot("02-lista-caricamento");
await page.getByText("Vista vera sui tetti di Roma.").first().waitFor({ timeout: 6000 });
ok(true, "lista: il verdetto compare dopo");
{ const hAfter = await firstCardH(); ok(hBefore != null && Math.abs(hAfter - hBefore) <= 24, `lista: la card non salta quando arriva il verdetto (${Math.round(hBefore ?? 0)} → ${Math.round(hAfter)} px)`); }
ok(await page.getByText("Pub Fuori Tema").count() === 0, "lista: il locale escluso sparisce");
ok(await page.getByText("Aperto ora").first().isVisible(), "card: 'Aperto ora' visibile");
ok((await page.locator("li", { hasText: "Rooftop Tre" }).getByTestId("chiuso-ora").count()) === 1 && (await page.locator("li", { hasText: "Terrazza Uno" }).getByTestId("chiuso-ora").count()) === 0, "card: 'Chiuso ora' sul locale chiuso (e solo lì)");
ok((await page.getByTestId("titolo-risposta").textContent())?.includes("Rooftop romantico"), "lista: titolo con la richiesta dell'utente");
{ const href = decodeURIComponent((await page.getByTestId("ricerca-feedback").getAttribute("href")) ?? "");
  ok(href.startsWith("mailto:founder.mapetite@gmail.com") && href.includes('Ho cercato: "Rooftop romantico per due a Roma"') && href.includes("1. Terrazza Uno") && !href.includes("Pub Fuori Tema"), "fine carosello: 'Questi risultati non vanno?' apre un'email con la ricerca e i locali mostrati"); }
await shot("03-lista-verdetti");
// Foto: una sola misura per tutte le viste, e una ricerca ripetuta (Google dà riferimenti foto
// nuovi ogni volta) non le richiede di nuovo per i locali già visti.
{
  const seenPhotos = [];
  const onReq = (r) => { if (r.url().includes("/api/places/photo")) seenPhotos.push(r.url()); };
  page.on("request", onReq);
  const remembered = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem("mapetite.foto") ?? "{}")));
  ok(remembered.includes("P1"), `foto: il telefono ricorda la foto vista per il locale (${remembered.join(",")})`);
  await page.route("**/api/search", (r) => r.fulfill({ json: { ...SEARCH_FAST, risultati: SEARCH_FAST.risultati.map((x) => ({ ...x, photoRef: x.photoRef ? `${x.photoRef}_nuovo` : x.photoRef })) } }));
  await page.getByLabel("Cosa cerchi?").fill("Rooftop romantico per due a Roma");
  await page.keyboard.press("Enter");
  await page.getByText("Vista vera sui tetti di Roma.").first().waitFor({ timeout: 6000 });
  await page.waitForTimeout(600);
  // 0 richieste è giusto anche quello: le immagini già sullo schermo restano (il telefono non le richiede).
  const fotoVisibile = await page.locator('img[src*="/api/places/photo"]').first().isVisible().catch(() => false);
  ok(fotoVisibile && seenPhotos.every((u) => !u.includes("_nuovo") && u.includes("w=720")), `foto: ricerca ripetuta senza richieste nuove a Google per gli stessi locali (${seenPhotos.length} dalla cache, ${seenPhotos.filter((u) => u.includes("_nuovo")).length} nuove)`);
  await page.unroute("**/api/search");
  page.off("request", onReq);
}
await apriOpzioni(page);
ok(await page.getByTestId("ho-capito").evaluate((el) => el.scrollWidth <= el.clientWidth && el.scrollHeight <= el.clientHeight + 1), "lista: 'Ho capito' si legge per intero (non tagliato)");
ok(await page.getByText(/\d+ m|\d,\d km/).first().isVisible(), "card: distanza mostrata (m / km)");
ok((await page.locator("ul img").count()) >= 1 && (await page.locator("ul img").count()) <= 6, `foto: ${await page.locator("ul img").count()} foto nelle card (massimo 6)`);
ok(await page.locator("ul img").first().evaluate((i) => i.complete && i.naturalWidth > 0), "foto: la prima card ha la foto caricata");
await page.waitForTimeout(1200);
// Tutte le posizioni in un colpo: leggendo i pin uno alla volta, un pin ridisegnato nel frattempo faceva
// aspettare 30 s e cadere il giro al primo avvio del server (visto più volte il 18/10).
const pinBoxes = await page.getByTestId("pin").evaluateAll((els) => els.map((e) => e.getBoundingClientRect()).filter((r) => r.width > 0 && r.height > 0).map((r) => ({ x: r.x, y: r.y, width: r.width, height: r.height })));
ok(pinBoxes.length >= 2, `mappa: ${pinBoxes.length} pin con nome sulla mappa dopo la ricerca`);
ok((await page.locator("[data-testid=pin][data-closed=true]").count()) === 1 && (await page.locator("[data-testid=pin][data-closed=true]").innerText()).includes("Rooftop Tre"), "mappa: il pin del locale chiuso è più chiaro (solo quello)");
ok(pinBoxes.every((b) => b.y > 0 && b.y + b.height < 844 * 0.55 && b.x >= 0 && b.x + b.width <= 390), "mappa: la mappa si sposta sui risultati (pin sopra la lista, dentro lo schermo)");

// 3. La ricerca resta scritta nella barra in alto
ok((await page.getByLabel("Cosa cerchi?").inputValue()).startsWith("Rooftop romantico"), "barra: il testo cercato resta nella barra con i risultati");

// 4. Scheda locale: barra azioni nel viewport
await page.getByText("Terrazza Uno").first().click();
await page.getByTestId("verdetto-scheda").waitFor({ timeout: 3000 });
const vh = 844;
for (const [label, sel] of [["Indicazioni", "a[aria-label^='Indicazioni']"], ["Salva", "button:text-is('Salva')"], ["Chiama", "a[href^='tel:']"], ["Sito", "a[aria-label^='Sito di']"]]) {
  const box = await page.locator(sel).first().boundingBox();
  ok(!!box && box.y + box.height <= vh && box.y >= 0 && box.x >= 0 && box.x + box.width <= 390, `scheda: pulsante ${label} nel viewport (anche in larghezza)`);
  if (box) ok(box.height >= 40, `scheda: pulsante ${label} alto almeno 40px (${Math.round(box.height)})`);
}
ok(await page.locator("img[alt='Terrazza Uno']").first().isVisible(), "scheda: foto in cima alla scheda");
ok(await page.getByText("Foto: Maria R.").isVisible(), "scheda: autore della foto indicato (condizioni Google)");
ok(((await page.getByRole("link", { name: /su Google Maps/ }).first().getAttribute("href")) ?? "").includes("query_place_id=P1"), "scheda: link a orari e foto su Google Maps con il Place ID");
ok((await page.locator("a[href^='tel:']").first().getAttribute("href")) === "tel:+390612345678", "scheda: numero ripulito per tel:");
await page.evaluate(() => { window.__copied = null; Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async (t) => { window.__copied = t; } } }); });
await page.getByTestId("copia-indirizzo").click();
ok((await page.getByTestId("copia-indirizzo").textContent())?.includes("✓ Copiato") && (await page.evaluate(() => window.__copied)) === "Via di Prova 1, Roma", "scheda: tocco sull'indirizzo lo copia");
ok((await page.getByTestId("citta-distanza").textContent())?.match(/^Roma · \d+ m$/) != null, "scheda: riga 'Roma · distanza' (come Places)");
ok(await page.getByText("Bar", { exact: true }).first().isVisible(), "scheda: tipo di locale in italiano");
ok((await page.getByTestId("scheda-nav").textContent())?.includes("1 di 2"), "scheda: '‹ 1 di 2 ›' per passare agli altri risultati");
await page.getByRole("button", { name: "Locale successivo" }).click();
await page.waitForTimeout(400);
ok((await page.getByTestId("scheda-nav").textContent())?.includes("2 di 2") && await page.getByRole("heading", { name: "Rooftop Tre" }).or(page.getByText("Rooftop Tre").last()).first().isVisible(), "scheda: '›' apre il locale successivo senza tornare alla lista");
await shot("04c-scheda-successivo");
await page.getByRole("button", { name: "Locale precedente" }).click();
await page.waitForTimeout(300);
await shot("04-scheda");
{ const ev = events.find((e) => e.type === "apri_scheda");
  ok(!!ev && ev.googlePlaceId === "P1" && ev.placeId === null && typeof ev.anonId === "string" && !("query" in ev), "segnali: aprire la scheda registra 'apri_scheda' (Place ID, nessun testo)"); }
{ const r1 = await page.request.post(`${BASE}/api/events`, { data: { type: "apri_scheda", googlePlaceId: "P1" } });
  const r2 = await page.request.post(`${BASE}/api/events`, { data: { type: "ricerca" } });
  const r3 = await page.request.post(`${BASE}/api/events`, { data: { type: "qualsiasi" } });
  ok(r1.status() === 204 && r2.status() === 400 && r3.status() === 400, `segnali: /api/events accetta solo i tipi previsti (${r1.status()}/${r2.status()}/${r3.status()}), anche senza la tabella`); }

// 4a. Scheda: trascinando verso il basso si chiude
await page.getByTestId("scheda-trascinabile").evaluate((el) => {
  const t = (y) => new Touch({ identifier: 1, target: el, clientX: 200, clientY: y });
  el.dispatchEvent(new TouchEvent("touchstart", { touches: [t(300)], bubbles: true }));
  el.dispatchEvent(new TouchEvent("touchmove", { touches: [t(380)], bubbles: true }));
  el.dispatchEvent(new TouchEvent("touchmove", { touches: [t(480)], bubbles: true }));
  el.dispatchEvent(new TouchEvent("touchend", { touches: [], bubbles: true }));
});
await page.waitForTimeout(400);
ok(!(await page.getByTestId("verdetto-scheda").isVisible()), "scheda: trascinata verso il basso si chiude");
await page.getByText("Terrazza Uno").first().click();
await page.getByTestId("verdetto-scheda").waitFor({ timeout: 3000 });

// 4b. Funzioni beta spente di default
ok((await page.getByLabel(/Condividi/).count()) === 1, "condividi: pulsante presente nella scheda (acceso di default)");

// 5. Lista: B (carosello) è la predefinita dall'11/10, A resta con ?lista=a
await page.goto(`${BASE}/mappa`, { waitUntil: "networkidle" });
await (await esempio(page)).click();
await page.getByText("Terrazza Uno").first().waitFor({ timeout: 5000 });
ok(await page.locator("ul.snap-x").count() === 1, "lista B predefinita: carosello presente");
await page.getByText("Vista vera sui tetti di Roma.").first().waitFor({ timeout: 6000 });
// Card in 1 secondo (Lorenzo 16/10): nome, UNA riga di fatti, il verdetto, al massimo un segnale.
// Il perché e i tag escono dalla card e restano nella scheda (controllato in 7-ter).
// Lista nuova (Lorenzo 18/10, variante B "Carosello scuro"): sulla card tornano fino a 2 punti forti, solo dai goFor veri.
ok((await page.locator("ul.snap-x").getByText("Ha una vera terrazza.").count()) === 0, "card: il perché non è sulla card (sta nella scheda)");
ok((await page.locator("ul.snap-x li[data-id=P1]").getByTestId("punti-forti").textContent()) === "tramonto" && (await page.locator("ul.snap-x li[data-id=P3]").getByTestId("punti-forti").textContent()) === "cocktail", "card nuova: punti forti presi dai goFor veri del locale");
ok((await page.locator("ul.snap-x li[data-id=P1]").getByTestId("posizione-card").innerText()) === `1 di ${await page.locator("ul.snap-x li[data-id]:not([data-id=''])").count()}`, "card nuova: '1 di N' in fondo alla card");
{ const m = await page.locator("ul.snap-x li[data-id]:not([data-id=''])").evaluateAll((lis) => lis.map((li) => {
    const card = li.querySelector("[data-testid=card-risultato]");
    return { id: li.dataset.id, h: Math.round(card.getBoundingClientRect().height), segnali: card.querySelectorAll("[data-testid=gemma], [data-testid=etichetta-salvato]").length,
      verdetto: card.querySelectorAll("[data-testid=etichetta-verdetto], [data-testid=riga-google], [data-testid=segnaposto-verdetto]").length, fatti: card.querySelectorAll("[data-testid=riga-fatti]").length,
      righeFatti: (() => { const r = card.querySelector("[data-testid=riga-fatti]"); return r ? Math.round(r.getBoundingClientRect().height / parseFloat(getComputedStyle(r).lineHeight)) : 0; })() };
  }));
  ok(m.length >= 2 && m.every((c) => c.h >= 230 && c.h <= 280), `card nuova: a foto piena, alta e tutte uguali (${m.map((c) => c.h + "px").join(", ")})`);
  ok(m.every((c) => c.verdetto === 1), `card: il verdetto (o la riga Google) c'è su ogni card (${m.map((c) => c.id + ":" + c.verdetto).join(", ")})`);
  ok(m.every((c) => c.segnali <= 1 && c.fatti === 1 && c.righeFatti === 1), `card: UNA riga di fatti e al massimo un segnale (${m.map((c) => c.id + ":" + c.segnali).join(", ")})`); }
{ const pill = await page.getByTestId("opzioni-ricerca").evaluate((el) => { const r = el.getBoundingClientRect(); const bar = document.querySelector("[data-testid=barra-ricerca]").getBoundingClientRect(); return { top: Math.round(r.top), left: Math.round(r.left), h: Math.round(r.height), sottoBarra: r.top >= bar.bottom - 1 && r.top < bar.bottom + 30, testo: el.querySelector("[data-testid=conteggio-risultati]").textContent.trim() }; });
  ok(pill.sottoBarra && pill.left <= 20 && pill.h >= 44 && pill.h <= 48 && /^\d+ posti$/.test(pill.testo), `lista nuova: pillola '${pill.testo}' sotto la barra, a sinistra (${pill.left},${pill.top}, alta ${pill.h}px)`);
  const sopra = await page.locator("[data-testid=lista-risultati] .rounded-card").evaluateAll((els) => els.filter((e) => !e.closest("ul")).length);
  ok(sopra === 0 && (await page.getByTestId("ho-capito").count()) === 0 && (await page.getByRole("button", { name: "Affina" }).count()) === 0, `lista nuova: nessuna intestazione sopra le card; "Ho capito" e Affina dietro la pillola`); }
ok((await page.locator("ul.snap-x li[data-id=P1]").getByTestId("etichetta-verdetto").textContent()) === "Il verdetto Mapetite", "card: il verdetto ha la sua etichetta 'Il verdetto Mapetite'");
// Mockup A (21/10): "✨ 3 posti · bar · rooftop" (la zona no: è già nella barra) e "✓ rooftop · ✓ romantico" sulla card confermata.
{ const cap = await page.getByTestId("capito-pillola").innerText().catch(() => "");
  const pw = await page.getByTestId("opzioni-ricerca").evaluate((el) => el.getBoundingClientRect().right <= window.innerWidth - 8);
  ok(/bar\s*·\s*rooftop/.test(cap) && !/roma/i.test(cap) && pw, `pillola: accanto al numero cosa ha capito l'AI, dentro lo schermo ('${cap.replace(/\s+/g, " ").trim()}')`); }
{ const r1 = await page.locator("ul.snap-x li[data-id=P1]").getByTestId("requisiti-card").innerText().catch(() => "");
  const r3 = await page.locator("ul.snap-x li[data-id=P3]").getByTestId("requisiti-card").count();
  ok(/✓ rooftop · ✓ romantico/.test(r1) && r3 === 0, `card: '✓ rooftop · ✓ romantico' solo dove le recensioni li confermano ('${r1.replace(/\n/g, " ")}', altri: ${r3})`); }
ok((await page.getByTestId("filtri-lista").count()) === 0, "semplificare: i filtri rapidi non stanno sempre sopra le card (sono dietro la pillola)");
await apriOpzioni(page);
ok((await page.getByTestId("filtri-lista").count()) === 1 && await page.getByTestId("filtri-lista").getByRole("button", { name: "Aperto ora" }).isVisible(), "lista B: filtri rapidi presenti toccando la pillola");
ok(await page.getByRole("button", { name: "Affina" }).isVisible() && await page.getByRole("button", { name: "Condividi questa ricerca" }).isVisible(), "pillola: apre Affina e Condividi");
await shot("05-pillola-aperta");
// Tocco fuori simulato (un tocco vero sulla mappa chiuderebbe anche la ricerca).
await page.evaluate(() => document.querySelector("[data-testid=pin]")?.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })));
await page.waitForTimeout(200);
ok((await page.getByTestId("opzioni-pannello").count()) === 0, "pillola: le opzioni si chiudono toccando fuori");
ok((await page.getByRole("button", { name: "Salva Terrazza Uno" }).count()) === 1, "lista B: segnalibro Salva sulla card");
await apriOpzioni(page);
ok((await page.getByTestId("ho-capito").textContent()) === "Ho capito: Bar · rooftop · a Roma", "lista B: sotto il titolo cosa ha capito l'AI (tipo e requisiti)");
// Chiave B (22/10): quanti posti hanno ogni requisito confermato dalle recensioni, solo dai dati dell'AI.
ok(/^✓ Dalle recensioni: rooftop in 1 posto su \d+ · romantico in 1$/.test((await page.getByTestId("conferme-recensioni").textContent()) ?? ""), `pillola: 'Dalle recensioni: rooftop in 1 posto su N' (${await page.getByTestId("conferme-recensioni").textContent().catch(() => "assente")})`);
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
ok(!(await page.getByTestId("verdetto-scheda").isVisible()), "pin toccato una volta: la scheda non si apre ancora");
await page.locator("[data-testid=pin][data-focused=true]", { hasText: "Terrazza Uno" }).waitFor({ timeout: 3000 });
await page.locator("[data-testid=pin]", { hasText: "Terrazza Uno" }).click();
await page.getByTestId("verdetto-scheda").waitFor({ timeout: 3000 });
ok(true, "pin toccato due volte: si apre la scheda");
await shot("05b-carosello-pin");
// Card di lato (come Places): il primo tocco la porta al centro, il secondo apre la scheda.
await page.getByRole("button", { name: "Chiudi" }).last().click().catch(() => {});
await page.locator("ul.snap-x li[data-id=P3]").waitFor({ timeout: 3000 }).catch(() => {});
if (await page.locator("ul.snap-x li[data-id=P3]").count() === 1) {
  await page.locator("ul.snap-x li[data-id=P3] [data-testid=card-risultato]").click({ position: { x: 20, y: 120 } });
  let c = await centerOf();
  for (let i = 0; i < 15 && c !== "P3"; i++) { await page.waitForTimeout(200); c = await centerOf(); }
  ok(c === "P3" && !(await page.getByTestId("verdetto-scheda").isVisible()), "card di lato: il primo tocco la porta al centro (la scheda non si apre)");
  await page.locator("ul.snap-x li[data-id=P3] [data-testid=card-risultato]").click();
  ok(await page.getByTestId("verdetto-scheda").waitFor({ timeout: 3000 }).then(() => true, () => false), "card al centro: il tocco apre la scheda");
} else ok(false, "card di lato: dopo la scheda il carosello non è tornato");
// Più vicini + Affina
await page.getByRole("button", { name: "Chiudi" }).last().click().catch(() => {});
await page.goto(`${BASE}/mappa`, { waitUntil: "networkidle" });
await (await esempio(page)).click();
await page.getByText("Vista vera sui tetti di Roma.").first().waitFor({ timeout: 6000 });
const firstCard = () => page.locator("ul.snap-x li").first().getAttribute("data-id");
ok((await firstCard()) === "P1", "ordine iniziale: prima Terrazza Uno (la più adatta)");
await apriOpzioni(page);
await page.getByRole("button", { name: "Più vicini" }).click();
ok((await firstCard()) === "P3", "'Più vicini': prima Rooftop Tre (200 m)");
await page.waitForTimeout(300);
ok((await page.locator("[data-testid=pin][data-focused=true]").innerText()).includes("Rooftop Tre"), "'Più vicini': il pin evidenziato segue la prima card");
await page.evaluate(() => { window.__shared = null; navigator.share = async (d) => { window.__shared = d; }; });
await apriOpzioni(page);
await page.getByRole("button", { name: "Condividi questa ricerca" }).click();
const sharedUrl = await page.evaluate(() => window.__shared?.url ?? "");
ok(/\/mappa\?q=Rooftop romantico per due a Roma&at=-?\d+\.\d+,-?\d+\.\d+$/.test(decodeURIComponent(sharedUrl)), "condividi ricerca: link che riapre la stessa ricerca nello stesso punto");
await page.getByRole("button", { name: "Affina" }).click();
const refine = page.getByLabel("Cosa cerchi?");
ok((await refine.inputValue()).startsWith("Rooftop romantico") && await refine.evaluate((el) => el === document.activeElement), "'Affina': cursore nella barra con la frase da correggere");
ok((await page.locator("input[type=text]").count()) === 0, "'Affina': nessun secondo campo sotto la barra");
await page.getByRole("button", { name: "+ economico" }).click();
await page.getByTestId("titolo-risposta").filter({ hasText: "economico" }).waitFor({ timeout: 5000 });
ok(true, "'Affina' + '+ economico': rifà la ricerca con la frase allungata");
await page.goto(`${BASE}/mappa?lista=a`, { waitUntil: "networkidle" });
await (await esempio(page)).click();
await page.getByText("Terrazza Uno").first().waitFor({ timeout: 5000 });
ok(await page.locator("ul.snap-x").count() === 0, "?lista=a: torna la lista verticale");

// "Cerca in quest'area" non compare se la frase nomina già una zona (la posizione della mappa non conterebbe)
await page.goto(`${BASE}/mappa`, { waitUntil: "networkidle" });
await (await esempio(page)).click();
await page.getByText("Rooftop Tre").first().waitFor({ timeout: 5000 });
await page.mouse.move(195, 300); await page.mouse.down(); await page.mouse.move(80, 200, { steps: 8 }); await page.mouse.up();
await page.waitForTimeout(1200);
ok((await page.getByRole("button", { name: "Cerca in quest'area" }).count()) === 0, "ricerca con una zona ('a Roma'): niente 'Cerca in quest'area' (darebbe la stessa lista)");

// 5b. Beta: filtri lista, condividi, recenti
searchMode = "senza-zona";
await page.goto(`${BASE}/mappa`, { waitUntil: "networkidle" });
await (await esempio(page)).click();
await page.getByText("Rooftop Tre").first().waitFor({ timeout: 5000 });
await page.getByText("Vista vera sui tetti di Roma.").first().waitFor({ timeout: 6000 });
await apriOpzioni(page);
await page.getByTestId("filtri-lista").getByRole("button", { name: "Aperto ora" }).click();
ok((await page.locator("ul").getByText("Rooftop Tre").count()) === 0 && (await page.locator("ul").getByText("Terrazza Uno").count()) > 0, "filtri rapidi: 'Aperto ora' nasconde i locali chiusi");
ok((await page.getByTestId("pin").filter({ hasText: "Rooftop Tre" }).count()) === 0, "filtri rapidi: anche il pin del locale chiuso sparisce dalla mappa");
await page.getByTestId("filtri-lista").getByRole("button", { name: "Aperto ora" }).click();
await page.getByTestId("opzioni-ricerca").click(); // chiude le opzioni (coprono la mappa sotto la barra)
// sposto la mappa a mano: compare "Cerca in quest'area"
await page.mouse.move(195, 300); await page.mouse.down(); await page.mouse.move(80, 200, { steps: 8 }); await page.mouse.up();
await page.getByRole("button", { name: "Cerca in quest'area" }).waitFor({ timeout: 3000 });
ok(true, "mappa spostata: compare 'Cerca in quest'area'");
await shot("09c-cerca-in-area");
await page.getByRole("button", { name: "Cerca in quest'area" }).click();
await page.getByText("Terrazza Uno").first().waitFor({ timeout: 5000 });
ok((await page.getByRole("button", { name: "Cerca in quest'area" }).count()) === 0, "'Cerca in quest'area' rifà la ricerca e scompare");
searchMode = "ok";
await shot("09-beta-filtri");
await page.getByText("Terrazza Uno").first().click();
await page.getByTestId("verdetto-scheda").waitFor({ timeout: 3000 });
ok((await page.getByLabel(/Condividi Terrazza Uno/).count()) === 1, "beta condividi: pulsante presente nella scheda");
// Tasto "indietro" del telefono con la scheda aperta: chiude la scheda, resta sulla mappa con i risultati
await page.goBack();
await page.getByTestId("verdetto-scheda").waitFor({ state: "detached", timeout: 3000 }).catch(() => {});
ok(new URL(page.url()).pathname === "/mappa" && (await page.getByTestId("verdetto-scheda").count()) === 0 && (await page.locator("ul").getByText("Terrazza Uno").count()) > 0, `indietro del telefono: chiude la scheda e torna ai risultati, senza uscire dalla mappa (${page.url()})`);
// Chiusa dall'interfaccia, la voce aggiunta alla cronologia sparisce: un altro "indietro" non riapre niente.
// E la mappa torna com'era prima di aprire il locale (non resta zoomata su un solo pin).
await page.waitForTimeout(800);
const pinGap = () => page.evaluate(() => {
  const xs = [...document.querySelectorAll("[data-testid=pin]")].map((el) => el.getBoundingClientRect()).filter((r) => r.width > 0);
  if (xs.length < 2) return null;
  return Math.round(Math.hypot(xs[0].x - xs[1].x, xs[0].y - xs[1].y));
});
const gapBefore = await pinGap();
await page.locator("ul").getByText("Terrazza Uno").first().click();
await page.getByTestId("verdetto-scheda").waitFor({ timeout: 3000 });
await page.waitForTimeout(1500);
const gapOpen = await pinGap();
await page.keyboard.press("Escape");
await page.waitForTimeout(1500);
{ const gapAfter = await pinGap(); ok(gapBefore != null && gapOpen > gapBefore * 1.5 && Math.abs(gapAfter - gapBefore) <= Math.max(6, gapBefore * 0.1), `scheda chiusa: la mappa torna com'era prima di aprirla (distanza tra due pin ${gapBefore} → ${gapOpen} → ${gapAfter} px)`); }
ok((await page.getByTestId("verdetto-scheda").count()) === 0 && (await page.evaluate(() => !window.history.state?.scheda)), "scheda chiusa dall'interfaccia: tolta anche dalla cronologia");
// ✕ mentre la ricerca è in corso: i risultati non devono ricomparire quando la risposta arriva
await page.goto(`${BASE}/mappa`, { waitUntil: "networkidle" });
searchDelay = 1500;
await (await esempio(page)).click();
await page.getByTestId("ricerca-in-corso").waitFor({ timeout: 3000 }).catch(() => {});
// Click diretto sul pulsante: in sviluppo l'azione di Playwright resta in attesa mentre la ricerca è in corso.
await page.getByRole("button", { name: "Cancella la ricerca" }).first().evaluate((el) => el.click());
await page.waitForTimeout(2500);
searchDelay = 0;
ok((await page.getByLabel("Cosa cerchi?").inputValue()) === "" && (await page.locator("ul").getByText("Terrazza Uno").count()) === 0 && (await page.getByTestId("ricerca-in-corso").count()) === 0, "✕ durante la ricerca: i risultati non ricompaiono quando arriva la risposta");
await page.goto(`${BASE}/mappa`, { waitUntil: "networkidle" });
ok((await page.getByTestId("recenti").filter({ hasText: /Rooftop romantico/ }).count()) >= 1, "beta recenti: la ricerca fatta compare tra le recenti");
await shot("10-beta-recenti");
await page.goto(`${BASE}/mappa?beta=-barra`, { waitUntil: "networkidle" });
await page.getByRole("button", { name: "Ricerca con l'AI" }).click();
ok((await page.getByTestId("aggiunte-rapide").getByText(/^↻ /).count()) >= 1, "pannello ✨: mostra anche le ricerche recenti");
await page.getByRole("button", { name: "Ricerca con l'AI" }).click();

// 5c. Spegnimento con ?beta=off
await page.goto(`${BASE}/mappa?beta=off`, { waitUntil: "networkidle" });
await (await esempio(page)).click();
await page.getByText("Terrazza Uno").first().waitFor({ timeout: 5000 });
ok((await page.getByRole("button", { name: "Voto 4,5+" }).count()) === 0, "?beta=off: i filtri rapidi spariscono");

// 5e. "Gemme" (accese di default dal 14/10, ?beta=-gemme per spegnerle): badge sui locali amati ma poco recensiti
await page.goto(`${BASE}/mappa`, { waitUntil: "networkidle" });
await (await esempio(page)).click();
await page.getByText("Rooftop Tre").first().waitFor({ timeout: 5000 });
ok((await page.locator("li", { hasText: "Rooftop Tre" }).getByTestId("gemma").count()) === 1, "gemme: accese di default");
await page.goto(`${BASE}/mappa?beta=-gemme`, { waitUntil: "networkidle" });
await (await esempio(page)).click();
await page.getByText("Rooftop Tre").first().waitFor({ timeout: 5000 });
ok((await page.getByTestId("gemma").count()) === 0, "gemme: si spengono con ?beta=-gemme");
await page.goto(`${BASE}/mappa?beta=gemme`, { waitUntil: "networkidle" });
await (await esempio(page)).click();
await page.getByText("Rooftop Tre").first().waitFor({ timeout: 5000 });
ok((await page.locator("li", { hasText: "Rooftop Tre" }).getByTestId("gemma").count()) === 1 && (await page.locator("li", { hasText: "Terrazza Uno" }).getByTestId("gemma").count()) === 0, "?beta=gemme: badge solo sul locale con 4,7 e 180 recensioni (non su quello con 812)");
await page.locator("ul.snap-x").evaluate((ul) => ul.scrollTo({ left: ul.scrollWidth, behavior: "instant" }));
await page.waitForTimeout(500);
await shot("09b-beta-gemme");
await page.goto(`${BASE}/mappa`, { waitUntil: "networkidle" });
await (await esempio(page)).click();
await page.getByText("Rooftop Tre").first().waitFor({ timeout: 5000 });
ok((await page.getByTestId("gemma").count()) >= 1, "gemme: restano accese su questo telefono");
// Le gemme sono accese per tutti dal 14/10: ?beta=off le spegne nella visita in cui compare.
await page.goto(`${BASE}/mappa?beta=off`, { waitUntil: "networkidle" });
await (await esempio(page)).click();
await page.getByText("Rooftop Tre").first().waitFor({ timeout: 5000 });
ok((await page.getByTestId("gemma").count()) === 0, "?beta=off: spegne anche le gemme");

// 5e2. Beta "articolo" (spenta di default): la risposta da leggere come un articolo (Places)
await page.goto(`${BASE}/mappa`, { waitUntil: "networkidle" });
await (await esempio(page)).click();
await page.getByText("Terrazza Uno").first().waitFor({ timeout: 5000 });
ok((await page.getByTestId("apri-articolo").count()) === 0, "articolo: spento di default");
await page.goto(`${BASE}/mappa?beta=articolo`, { waitUntil: "networkidle" });
await (await esempio(page)).click();
await page.getByText("Terrazza Uno").first().waitFor({ timeout: 5000 });
await page.getByTestId("apri-articolo").click();
await page.getByTestId("articolo").waitFor({ timeout: 3000 });
await page.getByTestId("articolo").getByText("Vista vera sui tetti di Roma.").waitFor({ timeout: 6000 });
ok((await page.getByTestId("articolo-locale").count()) === 2, "articolo: un paragrafo per ogni locale (l'escluso non c'è)");
ok((await page.getByTestId("articolo-intro").textContent())?.startsWith("Ho scelto 2 posti per te"), "articolo: frase di apertura con cosa ha capito");
ok(await page.getByTestId("articolo").getByText("Ha una vera terrazza.").isVisible(), "articolo: verdetto e motivo scritti come un consiglio");
ok(decodeURIComponent((await page.getByTestId("articolo-feedback").getAttribute("href")) ?? "").includes("2. Rooftop Tre"), "articolo: in fondo 'Questi risultati non vanno?' con i locali mostrati");
ok(await page.getByTestId("articolo").locator("img[alt='Terrazza Uno']").isVisible(), "articolo: foto grande del locale");
await page.evaluate(() => { window.__shared = null; navigator.share = async (d) => { window.__shared = d; }; });
await page.getByTestId("articolo-condividi").click();
ok(decodeURIComponent((await page.evaluate(() => window.__shared?.url)) ?? "").includes("/mappa?q=Rooftop romantico per due a Roma&at="), "articolo: 'Condividi' manda il link che rifà la ricerca");
const ask = await page.getByLabel("Fai un'altra domanda").boundingBox();
ok(!!ask && ask.y + ask.height <= 844 - 56 && ask.y > 600, "articolo: 'Fai un'altra domanda' fisso in basso, sopra la barra");
await shot("21-articolo");
await page.getByTestId("articolo").getByRole("button", { name: "Apri Terrazza Uno" }).click();
await page.getByTestId("verdetto-scheda").waitFor({ timeout: 3000 });
ok(true, "articolo: tocco sulla foto apre la scheda");
await page.getByRole("button", { name: "Chiudi" }).first().click();
await page.waitForTimeout(300);
ok(await page.getByTestId("articolo").isVisible(), "articolo: chiusa la scheda si torna all'articolo");
await page.getByTestId("articolo").getByRole("button", { name: "Apri Terrazza Uno" }).click();
await page.getByTestId("verdetto-scheda").waitFor({ timeout: 3000 });
await page.keyboard.press("Escape");
await page.waitForTimeout(300);
ok((await page.getByTestId("verdetto-scheda").count()) === 0 && await page.getByTestId("articolo").isVisible(), "Esc (da computer): chiude la scheda e lascia l'articolo");
await page.keyboard.press("Escape");
await page.waitForTimeout(300);
ok((await page.getByTestId("articolo").count()) === 0, "Esc: poi chiude l'articolo");
await page.getByTestId("apri-articolo").click();
await page.getByTestId("articolo").waitFor({ timeout: 3000 });
await page.goBack();
await page.waitForTimeout(300);
ok((await page.getByTestId("articolo").count()) === 0 && page.url().includes("/mappa"), "articolo: il tasto indietro torna alla mappa (non esce dalla pagina)");
await page.getByTestId("apri-articolo").click();
await page.getByLabel("Fai un'altra domanda").fill("cocktail bar elegante a Monti");
await page.getByLabel("Fai un'altra domanda").press("Enter");
await page.waitForTimeout(800);
ok((await page.getByTestId("titolo-risposta").textContent())?.includes("cocktail bar elegante"), "articolo: 'Fai un'altra domanda' avvia una nuova ricerca");
await page.getByTestId("apri-articolo").click();
await page.getByLabel("Fai un'altra domanda").fill("più economico");
await page.getByLabel("Fai un'altra domanda").press("Enter");
await page.waitForTimeout(800);
ok((await page.getByTestId("titolo-risposta").textContent()) === "cocktail bar elegante a Monti più economico", "articolo: una domanda breve ('più economico') continua la ricerca precedente");
await page.goto(`${BASE}/mappa?beta=off`, { waitUntil: "networkidle" });
await page.goto(`${BASE}/mappa?stile=places`, { waitUntil: "networkidle" });
await (await esempio(page)).first().click();
await page.getByText("Terrazza Uno").first().waitFor({ timeout: 5000 });
ok((await page.getByTestId("apri-articolo").count()) === 1, "?stile=places: accende anche l'articolo");
await page.goto(`${BASE}/mappa?stile=attuale`, { waitUntil: "networkidle" });
await (await esempio(page)).first().click();
await page.getByText("Terrazza Uno").first().waitFor({ timeout: 5000 });
ok((await page.getByTestId("apri-articolo").count()) === 0, "?stile=attuale: spegne l'articolo");

// 5e3. Barra "Chiedi all'AI" + "Filtri" in cima alla mappa: accesa per tutti (scelta di Lorenzo 11/10)
await page.goto(`${BASE}/mappa?beta=-barra`, { waitUntil: "networkidle" });
ok((await page.getByTestId("barra-ricerca").count()) === 0 && (await page.getByRole("button", { name: "Ricerca con l'AI" }).count()) === 1, "?beta=-barra: torna l'icona ✨ di prima");
await page.goto(`${BASE}/mappa`, { waitUntil: "networkidle" });
const bar = await page.getByTestId("barra-ricerca").boundingBox();
const loc = await page.getByRole("button", { name: "La mia posizione", exact: true }).boundingBox();
ok(!!bar && !!loc && bar.y < 80 && (bar.x + bar.width <= loc.x || bar.y + bar.height <= loc.y), "barra: in cima, non copre il pulsante posizione");
// 17/10: la barra prende tutta la larghezza (la frase non si taglia), la posizione scende sulla seconda riga.
{
  const fb = await page.getByRole("button", { name: "Filtri", exact: true }).boundingBox();
  ok(!!fb && !!bar && !!loc && fb.x + fb.width >= 390 - 16 - 1 && loc.y >= bar.y + bar.height, `barra: campo + Filtri fino al bordo destro, posizione sotto (${Math.round((fb?.x ?? 0) + (fb?.width ?? 0))}px)`);
}
ok((await page.getByLabel("Scrivi cosa cerchi").count()) === 0, "barra: nella card iniziale niente secondo campo");
await shot("22-barra");
await page.getByRole("button", { name: "Filtri", exact: true }).click();
await page.getByText(/Applica filtri/).first().waitFor({ timeout: 3000 }).then(() => ok(true, "barra: 'Filtri' apre i filtri"), () => ok(false, "barra: 'Filtri' apre i filtri"));
await shot("24-filtri");
ok((await page.getByText("Reset").count()) === 0 && await page.getByRole("button", { name: "Azzera" }).isVisible(), "filtri: tutto in italiano ('Azzera')");
{ const b = await page.getByRole("button", { name: "Pizzerie" }).boundingBox(); ok(!!b && b.height >= 40, `filtri: scelte comode col dito (${Math.round(b?.height ?? 0)}px)`); }
let filterBody = null;
await page.route("**/api/search", async (r) => { filterBody = r.request().postDataJSON(); return r.fallback(); });
await page.getByRole("button", { name: "Pizzerie" }).click();
await page.getByRole("button", { name: "2 km" }).click();
await page.getByRole("button", { name: "★ 4,5+" }).click();
await page.getByRole("button", { name: "Applica filtri (3)" }).click();
await page.getByTestId("intestazione-lista").waitFor({ timeout: 5000 });
ok(filterBody?.searchIntent === "structured" && filterBody?.radius === 2000 && filterBody?.minRating === 4.5 && JSON.stringify(filterBody?.categories) === '["pizza"]', "filtri: la ricerca parte con tipo, 2 km e voto 4,5+");
ok((await page.getByTestId("intestazione-lista").textContent()) === "Filtri: Pizzerie · entro 2 km · ★ 4,5+", "filtri: i risultati dicono quali filtri sono attivi");
await page.waitForTimeout(1200);
{ const pins = await page.getByTestId("pin").count(); ok(pins >= 2, `filtri: la mappa si sposta sui risultati (${pins} pin separati, non un gruppo unico)`); }
await shot("24b-filtri-risultati");
filterBody = null;
await page.mouse.move(195, 300); await page.mouse.down(); await page.mouse.move(80, 200, { steps: 8 }); await page.mouse.up();
await page.getByRole("button", { name: "Cerca in quest'area" }).click({ timeout: 3000 }).then(async () => {
  await page.waitForTimeout(800);
  ok(filterBody?.searchIntent === "structured" && filterBody?.minRating === 4.5, "filtri: 'Cerca in quest'area' rifà la ricerca con gli stessi filtri");
}, () => ok(false, "filtri: 'Cerca in quest'area' compare anche dopo i filtri"));
ok(filterBody?.phase === "fast" && await page.getByText("Vista vera sui tetti di Roma.").first().waitFor({ timeout: 6000 }).then(() => true, () => false), "filtri: lista subito e verdetti dopo (come la ricerca AI)");
// "Dove?": zona scritta a mano o suggerita; la distanza (misurata dalla mappa) sparisce.
await page.getByRole("button", { name: "Filtri", exact: true }).click();
ok(await page.getByTestId("filtro-zona").isVisible() && await page.getByTestId("zone-suggerite").getByRole("button", { name: "Tutta Roma" }).isVisible(), "filtri: campo 'Dove?' con le zone di Roma suggerite");
await page.getByTestId("filtro-zona").fill("Pigneto");
ok((await page.getByRole("button", { name: "2 km" }).count()) === 0, "filtri: con una zona scritta la distanza dalla mappa non si chiede");
await shot("24c-filtri-dove");
filterBody = null;
await page.getByRole("button", { name: /^Applica filtri/ }).click();
await page.getByTestId("intestazione-lista").waitFor({ timeout: 5000 });
ok(filterBody?.zona === "Pigneto" && filterBody?.radius == null, `filtri: la ricerca parte con la zona e senza distanza (${JSON.stringify({ zona: filterBody?.zona, radius: filterBody?.radius })})`);
ok((await page.getByTestId("intestazione-lista").textContent())?.includes("a Pigneto"), "filtri: l'intestazione dice la zona");
// Cucina, occasione, caratteristiche, aperto a un'ora scelta (piano 2.2).
await page.getByRole("button", { name: "Filtri", exact: true }).click();
await page.getByRole("button", { name: "Azzera" }).click();
{
  const cucina = page.getByTestId("filtri-cucina");
  ok((await cucina.locator("button[aria-pressed]").count()) === 6 && await page.getByTestId("cucina-tutte").isVisible(), "filtri: cucina mostra le prime 6 e 'Mostra tutte'");
  await page.getByTestId("cucina-tutte").click();
  ok((await cucina.getByRole("button", { name: "Peruviana" }).count()) === 1, "filtri: 'Mostra tutte' apre tutte le cucine");
  await page.getByTestId("cucina-tutte").click();
  ok((await page.getByTestId("filtri-caratteristiche").getByRole("button", { name: "Cani ammessi" }).count()) === 0, "filtri: caratteristiche, le altre dietro 'Mostra tutte'");
}
await page.getByRole("button", { name: "Romana" }).click();
await page.getByRole("button", { name: "Appuntamento romantico" }).click();
await shot("24d-filtri-cucina-occasione");
await page.getByRole("button", { name: "Terrazza / rooftop" }).click();
await page.getByTestId("caratteristiche-tutte").click();
await page.getByRole("button", { name: "Cani ammessi" }).click();
await page.getByRole("button", { name: "Stasera alle 21" }).click();
ok((await page.getByRole("button", { name: "Applica filtri (5)" }).count()) === 1, "filtri: il conteggio include cucina, occasione, caratteristiche e orario (5)");
await shot("24d2-filtri-caratteristiche-orario");
filterBody = null;
await page.getByRole("button", { name: /^Applica filtri/ }).click();
await page.getByTestId("intestazione-lista").waitFor({ timeout: 5000 });
ok(JSON.stringify(filterBody?.cuisines) === '["romana"]' && filterBody?.occasion === "romantico" && JSON.stringify(filterBody?.features) === '["terrazza","cani"]' && filterBody?.openAt?.hour === 21 && filterBody?.openAt?.day === new Date().getDay() && filterBody?.openAtId === "stasera",
  `filtri: le nuove scelte arrivano al server (${JSON.stringify({ c: filterBody?.cuisines, o: filterBody?.occasion, f: filterBody?.features, a: filterBody?.openAt })})`);
ok(/cucina romana/.test(filterBody?.query ?? "") && /romantico/.test(filterBody?.query ?? "") && /terrazza/.test(filterBody?.query ?? "") && !/cani/i.test(filterBody?.query ?? ""), `filtri: cucina, occasione e terrazza nel testo per Google, i cani solo come campo (${filterBody?.query})`);
ok((await page.getByTestId("intestazione-lista").textContent()) === "Filtri: cucina romana · appuntamento romantico · terrazza / rooftop, cani ammessi · aperti stasera alle 21", `filtri: il riepilogo mostra le nuove scelte (${await page.getByTestId("intestazione-lista").textContent()})`);
// A 360 px il pannello resta usabile: niente scorrimento di lato, scelte comode, pulsante raggiungibile.
await page.setViewportSize({ width: 360, height: 740 });
await page.getByRole("button", { name: "Filtri", exact: true }).click();
if (/Mostra tutte/.test(await page.getByTestId("caratteristiche-tutte").textContent() ?? "")) await page.getByTestId("caratteristiche-tutte").click();
{
  const sw = await page.evaluate(() => document.documentElement.scrollWidth);
  const romana = await page.getByRole("button", { name: "Romana" }).boundingBox();
  const lungo = await page.getByRole("button", { name: "All'aperto / dehors" }).boundingBox();
  const applica = await page.getByRole("button", { name: /^Applica filtri/ }).boundingBox();
  ok(sw <= 360 && !!romana && romana.height >= 40 && !!lungo && lungo.x + lungo.width <= 360 && !!applica && applica.y + applica.height <= 740, `filtri a 360 px: niente scorrimento di lato, chip ≥ 40 px, 'Applica' visibile (larghezza ${sw})`);
}
await shot("24e-filtri-360");
await page.setViewportSize({ width: 390, height: 844 });
await page.getByRole("button", { name: "Azzera" }).click();
await page.getByRole("button", { name: /^Applica filtri/ }).click().catch(() => {});
await page.keyboard.press("Escape").catch(() => {});
await page.unroute("**/api/search");
await page.goto(`${BASE}/mappa`, { waitUntil: "networkidle" });
await page.getByLabel("Cosa cerchi?").fill("aperitivo sul tetto a Monti");
await page.getByLabel("Cosa cerchi?").press("Enter");
await page.getByText("Terrazza Uno").first().waitFor({ timeout: 5000 });
ok((await page.getByTestId("titolo-risposta").textContent())?.includes("aperitivo sul tetto"), "barra: si scrive e si cerca dalla barra");
ok((await page.getByTestId("benvenuto").count()) === 0, "barra: dopo la ricerca la card iniziale sparisce");
await apriOpzioni(page);
await page.getByRole("button", { name: "Affina" }).click();
ok(await page.getByLabel("Cosa cerchi?").evaluate((el) => el === document.activeElement), "barra: 'Affina' porta il cursore nella barra");
await shot("22b-barra-risultati");
await page.getByRole("button", { name: "Cancella la ricerca" }).click();
await page.waitForTimeout(300);
ok((await page.getByTestId("titolo-risposta").count()) === 0 && (await page.getByLabel("Cosa cerchi?").inputValue()) === "", "barra: ✕ cancella la ricerca e i risultati");
await page.goto(`${BASE}/mappa?beta=off`, { waitUntil: "networkidle" });

// 5e3b. 🎤 nella barra (?beta=voce): riconoscimento vocale simulato
await page.goto(`${BASE}/mappa`, { waitUntil: "networkidle" });
ok((await page.getByTestId("microfono").count()) === 0, "microfono: spento di default");
await page.addInitScript(() => {
  // Chromium ha anche SpeechRecognition nativo (senza prefisso): si simulano entrambi.
  const Fake = class {
    start() { setTimeout(() => { this.onresult?.({ results: [[{ transcript: "pizza a Testaccio" }]] }); this.onend?.(); }, 100); }
    stop() { this.onend?.(); }
  };
  window.SpeechRecognition = Fake;
  window.webkitSpeechRecognition = Fake;
});
await page.goto(`${BASE}/mappa?beta=voce`, { waitUntil: "networkidle" });
await page.getByTestId("microfono").click();
await page.getByTestId("titolo-risposta").waitFor({ timeout: 5000 }).then(async () => {
  ok((await page.getByTestId("titolo-risposta").textContent())?.includes("pizza a Testaccio"), "microfono: la ricerca dettata parte da sola");
}, () => ok(false, "microfono: la ricerca dettata parte da sola"));
await page.goto(`${BASE}/mappa?beta=off`, { waitUntil: "networkidle" });

// 5e4. Senza rete: avviso in alto e messaggio chiaro se si cerca dalla barra
await page.goto(`${BASE}/mappa`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500); // la mappa finisce di scaricare caratteri e riquadri prima di togliere la rete
await ctx.setOffline(true);
await page.waitForTimeout(300);
ok(await page.getByTestId("offline").isVisible(), "senza rete: avviso 'Sei senza connessione'");
await page.unroute("**/api/search").catch(() => {});
await page.route("**/api/search", (r) => r.abort("internetdisconnected"));
await page.getByLabel("Cosa cerchi?").fill("aperitivo a Monti");
await page.getByLabel("Cosa cerchi?").press("Enter");
await page.getByTestId("errore-barra").waitFor({ timeout: 4000 }).then(() => ok(true, "senza rete: la ricerca dalla barra spiega l'errore"), () => ok(false, "senza rete: la ricerca dalla barra spiega l'errore"));
await shot("25-senza-rete");
await page.unroute("**/api/search");
await ctx.setOffline(false);
await page.waitForTimeout(300);
ok((await page.getByTestId("offline").count()) === 0, "rete tornata: l'avviso sparisce");

// 5f. Ricerca scritta direttamente nella card iniziale (senza la barra in alto)
await page.goto(`${BASE}/mappa?beta=-barra`, { waitUntil: "networkidle" });
await page.getByLabel("Scrivi cosa cerchi").fill("aperitivo sul tetto a Monti");
await page.getByLabel("Scrivi cosa cerchi").press("Enter");
await page.getByText("Terrazza Uno").first().waitFor({ timeout: 5000 });
ok((await page.getByTestId("titolo-risposta").textContent())?.includes("aperitivo sul tetto"), "card iniziale: si scrive e si cerca senza aprire altri pannelli");

// 5h0. Primo accesso alla home: intro in 3 schermate (stile Albo), una sola volta per telefono
{
  const ictx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await ictx.route("**/api/events", (route) => route.fulfill({ status: 204, body: "" }));
  const ip = await ictx.newPage();
  ip.on("pageerror", (e) => errors.push(e.message));
  const intro = ip.getByTestId("intro");
  await ip.goto(`${BASE}/`, { waitUntil: "networkidle" });
  ok(await intro.isVisible() && (await intro.getAttribute("data-step")) === "1", "intro: chi apre la home la prima volta vede la schermata 1");
  ok(await ip.getByRole("heading", { name: "Non perdere più i posti che scopri" }).isVisible() && await ip.getByTestId("intro-salta").isVisible(), "intro 1: raccogli (Instagram, TikTok, Google Maps) e 'Salta'");
  await ip.screenshot({ path: `${OUT}/00-intro-1.png`, caret: "initial" });
  await ip.getByTestId("intro-avanti").click();
  ok((await intro.getAttribute("data-step")) === "2" && await ip.getByRole("heading", { name: "Ritrovali quando devi scegliere" }).isVisible(), "intro: 'Avanti' porta alla schermata 2 (ritrova)");
  await ip.screenshot({ path: `${OUT}/00-intro-2.png`, caret: "initial" });
  await ip.getByRole("button", { name: "Indietro" }).click();
  ok((await intro.getAttribute("data-step")) === "1", "intro: la freccia torna indietro");
  await ip.getByTestId("intro-avanti").click();
  await ip.getByTestId("intro-avanti").click();
  ok((await intro.getAttribute("data-step")) === "3" && await ip.getByRole("heading", { name: "Posti giusti per te, non quelli di tutti" }).isVisible(), "intro: schermata 3 (posti giusti per te, verdetto)");
  ok(await ip.getByTestId("intro-registrati").isVisible() && await ip.getByTestId("intro-prova").isVisible() && !(await ip.getByTestId("intro-salta").isVisible()), "intro 3 senza account: 'Crea il tuo account' e 'Prova senza account'");
  ok((await ip.getByTestId("intro-registrati").getAttribute("href")) === "/signup", "intro: 'Crea il tuo account' porta alla registrazione");
  ok((await intro.getByTestId("intro-avanti").count()) === 0, "intro: al massimo 3 schermate");
  await ip.screenshot({ path: `${OUT}/00-intro-3.png`, caret: "initial" });
  await ip.getByTestId("intro-prova").click();
  ok((await intro.count()) === 0 && await ip.getByLabel("Cosa cerchi?").isVisible() && (await ip.getByTestId("home-suggerimenti").locator("[data-esempio]").count()) === 3, "intro: finisce sulla barra di ricerca con le idee per l'ora");
  await ip.reload({ waitUntil: "networkidle" });
  ok((await intro.count()) === 0, "intro: mostrata una volta sola (ricaricando non torna)");
  await ip.getByRole("button", { name: "Come funziona" }).click();
  ok(await intro.isVisible() && (await intro.getAttribute("data-step")) === "1", "home: 'Come funziona' riapre l'intro dalla prima schermata");
  await ip.getByTestId("intro-salta").click();
  ok((await intro.count()) === 0 && await ip.getByLabel("Cosa cerchi?").isVisible(), "intro: 'Salta' chiude e mostra la ricerca");
  await ip.goto(`${BASE}/?intro=1`, { waitUntil: "networkidle" });
  ok(await intro.isVisible(), "intro: /?intro=1 la riapre anche se già vista");
  await ip.getByTestId("intro-salta").click();
  ok(!ip.url().includes("intro="), "intro: chiusa, ?intro=1 sparisce dall'indirizzo");
  await ictx.close();

  // Nessun lampo: prima che React parta (script dell'app bloccati) decide il CSS, guidato dallo script del layout.
  for (const seen of [false, true]) {
    const nctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    if (seen) await nctx.addInitScript(() => { try { localStorage.setItem("mapetite.intro", "visto"); } catch { /* ignorato */ } });
    await nctx.route(/\/_next\/static\/chunks\/.*\.js(\?|$)/, (route) => route.abort()); // il CSS resta
    const np = await nctx.newPage();
    await np.goto(`${BASE}/`, { waitUntil: "load" });
    const vis = await np.getByTestId("intro").isVisible();
    ok(seen ? !vis : vis, seen ? "intro: chi l'ha già vista non la vede nemmeno per un attimo" : "intro: al primo accesso è visibile dal primo disegno (niente lampo della home)");
    await nctx.close();
  }
  // Senza JavaScript: niente intro, la home funziona lo stesso.
  const jctx = await browser.newContext({ viewport: { width: 390, height: 844 }, javaScriptEnabled: false });
  const jp = await jctx.newPage();
  await jp.goto(`${BASE}/`, { waitUntil: "load" });
  ok(!(await jp.getByTestId("intro").isVisible()) && await jp.getByLabel("Cosa cerchi?").isVisible(), "intro: senza JavaScript non compare e la ricerca resta usabile");
  await jctx.close();
}

// 5h. Home (/) come Places: esempi e campo portano alla mappa con la ricerca già avviata
await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
await shot("00-home");
ok((await page.getByLabel("Cosa cerchi?").getAttribute("placeholder")) === "Cosa cerchi?" && (await page.getByLabel("Cosa cerchi?").getAttribute("aria-label"))?.includes("Chiedi all'AI"), "home: campo 'Cosa cerchi?' (mockup A), l'AI detta allo screen reader");
// Home nuova (Lorenzo 21/10): saluto con l'ora, "Per te" con il perché, classifiche della città.
ok(/^(Lunedì|Martedì|Mercoledì|Giovedì|Venerdì|Sabato|Domenica) /i.test((await page.getByTestId("home-momento").textContent()) ?? "") && /^Dove /.test((await page.getByRole("heading", { level: 1 }).textContent()) ?? ""), `home: giorno e momento sopra la domanda (${await page.getByTestId("home-momento").textContent()})`);
{ const prop = page.getByTestId("home-proposta"); const n = await prop.count();
  ok(n >= 1 && n <= 3 && (await prop.first().getAttribute("href"))?.startsWith("/mappa?q=") && /✦/.test(await prop.first().innerText()), `home: 'Per te' con 1-3 proposte che aprono una ricerca e dicono perché (${n})`); }
ok((await page.getByTestId("home-classifica").count()) >= 3 && /Le classifiche di (Roma|Milano)/.test(await page.getByTestId("home-classifiche").innerText()), "home: 3-4 classifiche della città, numerate, mai fuori orario");
ok((await page.getByTestId("home-invito-gusto").getAttribute("href"))?.includes("onboarding"), "home: invito alla mappa del gusto per chi non l'ha fatta");
ok((await page.getByTestId("home-assistente").count()) === 0 && (await page.getByText("Apri la mappa").count()) === 0 && (await page.getByTestId("home-sorprendimi").count()) === 1, "home semplice: niente doppioni della barra in basso (Assistente, Apri la mappa); Sorprendimi nel carosello");
ok((await page.getByTestId("home-suggerimenti").locator("[data-esempio]").count()) === 3 && (await page.getByLabel("Cosa cerchi?").count()) === 1, "home: una sola barra, con tre idee per l'ora sotto");
// 17/10: marchio vero (SVG) al posto dell'emoji e schermata d'avvio per l'iPhone.
ok(await page.getByRole("img", { name: "Mapetite" }).first().isVisible(), "home: il marchio Mapetite (non più l'emoji)");
{
  const avvii = await page.locator('link[rel="apple-touch-startup-image"]').evaluateAll((ls) => ls.map((l) => l.getAttribute("href")));
  const r = avvii[4] ? await page.request.get(`${BASE}${avvii[4]}`) : null;
  ok(avvii.length >= 10 && r?.status() === 200 && r.headers()["content-type"] === "image/png", `iPhone: ${avvii.length} schermate d'avvio, l'immagine si apre`);
}
{ const f = await page.getByTestId("home-filtri").boundingBox(); const bar = await page.getByLabel("Cosa cerchi?").boundingBox(); ok(!!f && !!bar && Math.abs((f.y + f.height / 2) - (bar.y + bar.height / 2)) < 12, "home: 'Filtri' dentro la barra, non un secondo blocco"); }
ok((await page.getByTestId("home-recenti").getByRole("link").count()) >= 1, "home: le ultime ricerche fatte su questo telefono, a un tocco");
await page.getByTestId("home-filtri").click();
await page.getByText(/Applica filtri/).first().waitFor({ timeout: 5000 }).then(() => ok(true, "home: 'Filtri' apre la mappa con i filtri aperti"), () => ok(false, "home: 'Filtri' apre la mappa con i filtri aperti"));
ok(!page.url().includes("filtri=1"), "home → filtri: il parametro sparisce dall'indirizzo (ricaricare non riapre i filtri)");
await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
await page.getByLabel("Cosa cerchi?").fill("pizza napoletana a Testaccio");
searchDelay = 1500;
await page.getByLabel("Cosa cerchi?").press("Enter");
await page.getByTestId("ricerca-in-corso").waitFor({ timeout: 4000 });
ok((await page.getByTestId("ricerca-in-corso").textContent())?.includes("pizza napoletana"), "home → mappa: mentre cerca si vedono la richiesta e le card fantasma");
await shot("00b-ricerca-in-corso");
searchDelay = 0;
await page.getByText("Terrazza Uno").first().waitFor({ timeout: 8000 });
ok(page.url().includes("/mappa") && !page.url().includes("q=") && (await page.getByTestId("titolo-risposta").textContent())?.includes("pizza napoletana"), "home: il campo apre la mappa e la ricerca parte da sola");
await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
await page.getByTestId("home-suggerimenti").locator("[data-esempio]").first().click();
await page.getByText("Terrazza Uno").first().waitFor({ timeout: 8000 });
ok(true, "home: un esempio apre la mappa con i risultati");

// 5d. Foto non disponibili (quota finita): resta l'emoji, nessun errore
photoMode = "off";
await page.goto(`${BASE}/mappa`, { waitUntil: "networkidle" });
await (await esempio(page)).click();
await page.getByText("Terrazza Uno").first().waitFor({ timeout: 5000 });
// le immagini falliscono una alla volta: si aspetta fino a 3 s che restino solo le emoji
let noPhotos = false;
for (let i = 0; i < 15 && !noPhotos; i++) { await page.waitForTimeout(200); noPhotos = (await page.locator("ul img").count()) === 0; }
ok(noPhotos && (await page.locator("ul").getByText("🍺").count()) >= 1, "foto: con quota finita le card mostrano l'emoji");
ok((await page.locator("ul li[data-id=P3]").getByText("🍸").count()) >= 1 && (await page.locator("ul li[data-id=P3]").getByText("🍺").count()) === 0, "emoji: un cocktail bar ha 🍸, non il boccale di birra");
photoMode = "ok";

// 5c. Mappa affollata: i primi 5 risultati sempre come pin con nome, gli altri raggruppati o senza nome
searchMode = "folla";
await page.goto(`${BASE}/mappa`, { waitUntil: "networkidle" });
await (await esempio(page)).click();
await page.getByText("Folla 1").first().waitFor({ timeout: 5000 });
await page.waitForTimeout(1500);
{
  const labels = (await page.getByTestId("pin").allInnerTexts()).map((t) => t.replace(/[^\p{L}\p{N} ]/gu, "").trim());
  const top = ["Folla 1", "Folla 2", "Folla 3", "Folla 4", "Folla 5"];
  const pinIds = await page.getByTestId("pin").evaluateAll((els) => els.map((e) => e.getAttribute("data-place")));
  ok(["F1", "F2", "F3", "F4", "F5"].every((id) => pinIds.includes(id)), "mappa affollata: i primi 5 risultati hanno il loro pin (mai dentro un cerchio)");
  ok(labels.includes("Folla 1") && labels.filter((l) => top.includes(l)).length < 5, `mappa affollata: pin uno sopra l'altro, resta solo il nome del primo (${labels.filter(Boolean).join(", ")})`);
  ok(!labels.some((l) => /Folla (6|7|8|9|10)\b/.test(l)), "mappa affollata: gli altri locali senza nome (niente etichette sovrapposte)");
  ok((await page.locator("[data-testid=pin][data-focused=true]").innerText()).includes("Folla 1"), "mappa affollata: il pin della prima card è visibile ed evidenziato");
  await shot("05c-mappa-affollata");
}
searchMode = "ok";

// 5d. Il differenziatore si vede: i locali molto famosi messi da parte sono detti sotto il titolo
await page.route("**/api/search", (r) => r.fulfill({ json: { ...SEARCH_FAST, da_parte: { turistici: ["Tonnarello", "Nannarella", "Da Enzo"], fuori_tema: [] } } }));
await page.goto(`${BASE}/mappa`, { waitUntil: "networkidle" });
await (await esempio(page)).click();
await apriOpzioni(page);
await page.getByTestId("messi-da-parte").waitFor({ timeout: 5000 }).then(async () => {
  ok((await page.getByTestId("messi-da-parte").textContent()) === "🧭 Ho messo da parte 3 locali molto famosi (Tonnarello, Nannarella…)", "risultati: dice quali locali molto famosi ha messo da parte (non 'turistici': non lo sappiamo)");
  await shot("05d-messi-da-parte");
}, () => ok(false, "risultati: dice quali locali molto famosi ha messo da parte (non 'turistici': non lo sappiamo)"));
await page.unroute("**/api/search");
// 17/10: fuori dal quartiere chiesto ("enoteca a Monti"): in fondo e detto.
await page.route("**/api/search", (r) => r.fulfill({ json: { ...SEARCH_FAST, da_parte: { turistici: [], fuori_tema: [], fuori_zona: ["Solovino", "OrganiCool"] } } }));
await page.goto(`${BASE}/mappa`, { waitUntil: "networkidle" });
await (await esempio(page)).click();
await apriOpzioni(page);
await page.getByTestId("messi-da-parte").waitFor({ timeout: 5000 }).then(async () => {
  ok((await page.getByTestId("messi-da-parte").textContent()) === "🧭 Ho messo in fondo 2 fuori zona (Solovino, OrganiCool)", "risultati: dice quali locali fuori dal quartiere ha messo in fondo");
}, () => ok(false, "risultati: dice quali locali fuori dal quartiere ha messo in fondo"));
await page.unroute("**/api/search");

// 5g. Verdetti a gruppi (14/10): quelli delle prime card compaiono senza aspettare gli altri
{
  await page.route("**/api/search", (r) => r.fulfill({ json: { ...SEARCH_FAST, sintesi_pendente: { places: [{ id: "P1" }, { id: "P2" }, { id: "P3" }], token: "t", gruppi: [{ places: [{ id: "P1" }], token: "a" }, { places: [{ id: "P2" }, { id: "P3" }], token: "b" }] } } }));
  await page.route("**/api/search/synthesis", async (r) => {
    const b = r.request().postDataJSON();
    if (b.token === "a") return r.fulfill({ json: { dettagli: { P1: SYNTH.dettagli.P1 }, esclusi: [], livelli: { P1: "medio" } } });
    await new Promise((res) => setTimeout(res, 2500));
    return r.fulfill({ json: { dettagli: { P3: SYNTH.dettagli.P3 }, esclusi: ["P2"], livelli: { P3: "medio" } } });
  });
  await page.goto(`${BASE}/mappa`, { waitUntil: "networkidle" });
  await (await esempio(page)).click();
  await page.getByText("Vista vera sui tetti di Roma.").first().waitFor({ timeout: 4000 }).catch(() => {});
  ok(await page.getByText("Vista vera sui tetti di Roma.").first().isVisible() && (await page.getByText("Cocktail curati sul tetto.").count()) === 0 && (await page.locator("ul").getByText("Pub Fuori Tema").count()) === 1, "verdetti a gruppi: il primo arriva senza aspettare gli altri (escluso ancora in lista)");
  await page.getByText("Cocktail curati sul tetto.").first().waitFor({ timeout: 6000 }).catch(() => {});
  ok(await page.getByText("Cocktail curati sul tetto.").first().isVisible() && (await page.locator("ul").getByText("Pub Fuori Tema").count()) === 0, "verdetti a gruppi: poi arrivano gli altri e l'escluso sparisce");
  await page.unroute("**/api/search/synthesis");
  await page.unroute("**/api/search");
}

// 5f. Ordine per quanto il locale è adatto (giudizio di Haiku): "alto" in cima, "basso" in fondo, mai esclusi
{
  await page.route("**/api/search/synthesis", (r) => r.fulfill({ json: { ...SYNTH, esclusi: [], livelli: { P1: "basso", P2: "medio", P3: "alto" } } }));
  await page.goto(`${BASE}/mappa`, { waitUntil: "networkidle" });
  await (await esempio(page)).click();
  await page.getByText("Vista vera sui tetti di Roma.").first().waitFor({ timeout: 6000 });
  await page.waitForTimeout(300);
  const ordine = (await page.locator("ul.snap-x li[data-id]").evaluateAll((els) => els.map((e) => e.getAttribute("data-id")))).filter(Boolean);
  ok(ordine.join(",") === "P3,P2,P1", `ordine: il locale più adatto in cima e il meno adatto in fondo, nessuno escluso (${ordine.join(",")})`);
  const z = async (id) => Number(await page.locator(`[data-testid=pin][data-place=${id}]`).first().evaluate((el) => getComputedStyle(el.closest(".mapboxgl-marker") ?? el).zIndex).catch(() => "0"));
  const [z2, z1] = [await z("P2"), await z("P1")];
  ok(z2 > z1, `mappa: il pin del 2° risultato sta sopra quello del 3° (il suo nome non finisce coperto) (${z2} > ${z1})`);
  await page.unroute("**/api/search/synthesis");
}

// 5e. Ricerca in un'altra città con la mappa su Roma e la posizione mai chiesta: niente "479 km" sulle card
{
  const MILANO = PLACES.map((p, i) => ({ ...p, address: "Via di Prova 1, Milano", lat: 45.46 + i * 0.001, lng: 9.19 }));
  await page.route("**/api/search", (r) => r.fulfill({ json: { ...SEARCH_FAST, risultati: MILANO, filtri_usati: { ...SEARCH_FAST.filtri_usati, zona: "Milano" } } }));
  await page.goto(`${BASE}/mappa`, { waitUntil: "networkidle" });
  await (await esempio(page)).click();
  await page.getByText("Terrazza Uno").first().waitFor({ timeout: 5000 });
  ok((await page.locator("ul").getByText(/\d{3},\d km/).count()) === 0, "altra città: le card non mostrano la distanza dal centro di Roma (es. '479 km')");
  await page.unroute("**/api/search");
}

// 6. Errore di rete/API
searchMode = "error";
await page.goto(`${BASE}/mappa`, { waitUntil: "networkidle" });
await idee(page);
await page.getByRole("button", { name: "Colazione buona qui vicino", exact: true }).click();
await page.getByText(/Qualcosa è andato storto/).first().waitFor({ timeout: 4000 });
ok(true, "errore API: messaggio umano mostrato nella card");
await shot("06-errore");
searchMode = "ok";

// 6b. Nessun risultato: pulsanti per riprovare
searchMode = "empty";
await page.goto(`${BASE}/mappa`, { waitUntil: "networkidle" });
await (await esempio(page)).click();
await page.getByText("Non ho trovato nulla").waitFor({ timeout: 4000 });
ok(await page.getByRole("button", { name: "Correggi la ricerca" }).isVisible(), "nessun risultato: pulsante 'Correggi la ricerca'");
await shot("06b-nessun-risultato");
await page.getByRole("button", { name: "Vedi esempi" }).click();
ok(await page.getByTestId("idee-pannello").isVisible(), "nessun risultato: 'Vedi esempi' apre le idee con le frasi d'esempio");
searchMode = "ok";

// 7. Posizione: negata
await page.goto(`${BASE}/mappa`, { waitUntil: "networkidle" });
await page.getByRole("button", { name: "La mia posizione", exact: true }).click();
await page.getByText(/Non ho il permesso/).waitFor({ timeout: 4000 });
ok(true, "posizione negata: messaggio con alternativa");
await shot("07-posizione-negata");
// concessa
const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 }, permissions: ["geolocation"], geolocation: { latitude: 45.4642, longitude: 9.19 } });
const p2 = await ctx2.newPage();
await p2.goto(`${BASE}/mappa`, { waitUntil: "networkidle" });
await p2.getByRole("button", { name: "La mia posizione", exact: true }).click();
await p2.waitForTimeout(1500);
ok((await p2.getByTestId("benvenuto").count()) === 0, "posizione concessa: la card si chiude");
ok(await p2.getByTestId("tu-sei-qui").isVisible(), "posizione concessa: punto blu 'tu sei qui' sulla mappa");
await p2.getByRole("button", { name: "La mia posizione" }).click();
ok(true, "pulsante 'La mia posizione' sempre disponibile in alto a destra");
await p2.screenshot({ path: `${OUT}/07b-posizione.png`, caret: "initial" });
await ctx2.close();
// posizione concessa vicino ai risultati: il pulsante percorso mostra i minuti a piedi (come Places)
const ctx3 = await browser.newContext({ viewport: { width: 390, height: 844 }, permissions: ["geolocation"], geolocation: { latitude: 41.8995, longitude: 12.4895 } });
await ctx3.route("**/api/places/photo**", (route) => route.fulfill({ status: 429, json: {} }));
await ctx3.route("**/api/search", (route) => route.fulfill({ json: SEARCH_FAST }));
await ctx3.route("**/api/search/synthesis", (route) => route.fulfill({ json: SYNTH }));
const p3 = await ctx3.newPage();
await p3.goto(`${BASE}/mappa`, { waitUntil: "networkidle" });
await p3.getByRole("button", { name: "La mia posizione", exact: true }).click();
await p3.waitForTimeout(1200);
await p3.getByLabel("Cosa cerchi?").fill("rooftop");
await p3.getByLabel("Cosa cerchi?").press("Enter");
await p3.getByText("Terrazza Uno").first().waitFor({ timeout: 5000 });
await p3.getByText("Terrazza Uno").first().click();
await p3.locator("a[aria-label^='Indicazioni']").first().waitFor({ timeout: 4000 });
const walkLabel = (await p3.locator("a[aria-label^='Indicazioni']").first().getAttribute("aria-label")) ?? "";
ok(/Indicazioni: \d+ min a piedi/.test(walkLabel), `scheda: minuti a piedi sul pulsante percorso (${walkLabel})`);
ok((await p3.getByText("Foto: Maria R.").count()) === 0, "scheda: foto non caricata (quota finita) → niente didascalia 'Foto: …' sopra l'emoji");
await p3.screenshot({ path: `${OUT}/04b-scheda-a-piedi.png`, caret: "initial" });
await ctx3.close();

// 7-bis. Condividi la ricerca: il link porta richiesta e punto della mappa
await page.goto(`${BASE}/mappa`, { waitUntil: "networkidle" });
await page.evaluate(() => { navigator.share = async (d) => { window.__shared = d; }; });
await (await esempio(page)).click();
await apriOpzioni(page);
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
  // Link aperto a freddo: i risultati arrivano prima che la mappa sia pronta; la mappa deve
  // comunque spostarsi sui risultati (qui il punto è Milano, i risultati sono a Roma).
  await page.goto(`${BASE}/mappa?q=rooftop%20a%20Roma&at=45.46,9.19`, { waitUntil: "networkidle" });
  let inView = false;
  for (let t = 0; t < 10 && !inView; t++) {
    await page.waitForTimeout(500);
    const boxes = await page.getByTestId("pin").evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y }; }));
    inView = boxes.some((b) => b.x > 0 && b.x < 390 && b.y > 100 && b.y < 844 * 0.6);
  }
  ok(inView, "link ricerca aperto a freddo: la mappa si sposta sui risultati");
  await page.unroute("**/api/search");
}

// 7-ter. Variante B della scheda (?scheda=b, stile Places; ricordata sul telefono, ?scheda=a torna all'attuale)
await page.goto(`${BASE}/mappa?scheda=b`, { waitUntil: "networkidle" });
await (await esempio(page)).click();
await page.getByText("Terrazza Uno").first().click();
await page.locator("h2", { hasText: "Terrazza Uno" }).waitFor({ timeout: 4000 });
await page.getByText("Vista vera sui tetti di Roma.").last().waitFor({ timeout: 6000 });
ok(await page.getByTestId("verdetto-scheda").isVisible(), "scheda B: c'è il riquadro 'Il verdetto Mapetite' come prima (Lorenzo 12/10)");
ok((await page.getByText("Ha una vera terrazza.").count()) >= 1 && (await page.getByText("tramonto", { exact: true }).count()) >= 1, "scheda B: il perché e i tag usciti dalla card sono nella scheda (nessuna informazione persa)");
{ const parts = ((await page.getByTestId("scheda-fatti").textContent()) ?? "").split("·").map((t) => t.trim());
  ok(parts.length === 5 && parts[0] === "Bar" && parts[1] === "★ 4,5" && parts[2] === "€€" && /^[\d,]+ (m|km)$/.test(parts[3]) && parts[4] === "Aperto ora", `scheda B: UNA riga di fatti tipo · voto · prezzo · distanza · aperto (${parts.join(" · ")})`); }
ok(await page.getByText("Aperto ora").last().isVisible(), "scheda B: pill 'Aperto ora'");
// Barra azioni stile Places (piano 6.2): Prenota / Percorso / Salva; Chiama e Sito nella riga dei contatti.
for (const [label, sel] of [["Prenota", "[data-testid=barra-azioni] [data-testid=prenota-scheda]"], ["Indicazioni", "a[aria-label^='Indicazioni']"], ["Salva", "button:text-is('Salva')"]]) {
  const box = await page.locator(sel).first().boundingBox();
  ok(!!box && box.y + box.height <= 844 && box.y >= 0 && box.x >= 0 && box.x + box.width <= 390 && box.height >= 40, `scheda B: pulsante ${label} nel viewport e alto almeno 40px`);
}
await page.getByTestId("scheda-tab-info").click();
ok(await page.getByTestId("scheda-info").locator("a[href^='tel:']").isVisible() && await page.getByTestId("scheda-info").locator("a[aria-label^='Sito di']").isVisible(), "scheda B: Chiama e Sito nella sezione Info");
ok(await page.getByText("4,5 su Google · 812 recensioni").isVisible() && (await page.getByTestId("citta-distanza").textContent())?.match(/Roma · \d+ m/) != null, "scheda B, Info: voto con numero di recensioni e 'Roma · distanza'");
await page.getByTestId("scheda-tab-panoramica").click();
ok((await page.getByLabel(/^Condividi Terrazza/).count()) === 1, "scheda B: un solo pulsante Condividi (nella riga delle azioni)");
await shot("15-scheda-b");

// 7-ter-bis. "A confronto" nella scheda (Lorenzo 17/10): Mapetite, Google, Tripadvisor, Michelin, TheFork.
// Niente scraping, nessun numero inventato: Tripadvisor ha numeri solo con la chiave dell'API ufficiale.
{
  let cf = null, tam = null;
  try {
    cf = await import(new URL("../../src/lib/confronto.ts", import.meta.url).href);
    tam = await import(new URL("../../src/lib/tripadvisor.ts", import.meta.url).href);
  } catch (e) { ok(false, `confronto: moduli importabili (${e.message})`); }
  if (cf && tam) {
    ok(cf.isRistorante("restaurant") && cf.isRistorante("italian_restaurant") && cf.isRistorante("pizza_restaurant") && cf.isRistorante("Trattoria") && !cf.isRistorante("bar") && !cf.isRistorante("cocktail_bar") && !cf.isRistorante("cafe") && !cf.isRistorante("fast_food_restaurant") && !cf.isRistorante(null), "confronto: Michelin e TheFork solo per i ristoranti (non bar, caffè, fast food)");
    ok(cf.tripadvisorSearchUrl("Da Enzo al 29", "Roma") === "https://www.tripadvisor.it/Search?q=Da%20Enzo%20al%2029%20Roma" && cf.michelinSearchUrl("Da Enzo al 29") === "https://guide.michelin.com/it/it/search?q=Da%20Enzo%20al%2029" && cf.tripadvisorSearchUrl("Roma Sparita", "Roma") === "https://www.tripadvisor.it/Search?q=Roma%20Sparita", "confronto: link alle ricerche ufficiali (nome + città)");
    ok(cf.mediaVoti([]) === null && cf.mediaVoti([5, 4, 4]).n === 3 && Math.abs(cf.mediaVoti([5, 4, 4]).media - 13 / 3) < 1e-9 && cf.mediaVoti([0, 9]) === null, "confronto: media dei voti Mapetite solo da voti 1–5 veri");
    // Abbinamento: nome simile E meno di 150 m, servono entrambi.
    ok(tam.nomiSimili("Da Enzo al 29", "Trattoria Da Enzo") && tam.nomiSimili("Roscioli Salumeria con Cucina", "Salumeria Roscioli") && tam.nomiSimili("Armando al Pantheon", "ARMANDO AL PANTHEON"), "tripadvisor: nomi dello stesso locale riconosciuti");
    ok(!tam.nomiSimili("Da Enzo al 29", "Da Mario") && !tam.nomiSimili("Bar Roma", "Bar Milano") && !tam.nomiSimili("Enzo", "Enzone") && !tam.nomiSimili("Trattoria", "Trattoria Da Mario"), "tripadvisor: nomi diversi (o solo parole generiche) non si abbinano");
    const qui = { nome: "Da Enzo al 29", lat: 41.8883, lng: 12.4773 };
    ok(tam.stessoLocale(qui, { nome: "Trattoria Da Enzo", lat: 41.8887, lng: 12.4773 }) && !tam.stessoLocale(qui, { nome: "Trattoria Da Enzo", lat: 41.8903, lng: 12.4773 }) && !tam.stessoLocale(qui, { nome: "Da Mario", lat: 41.8883, lng: 12.4773 }) && !tam.stessoLocale(qui, { nome: "Da Enzo", lat: null, lng: null }), "tripadvisor: stesso locale solo con nome simile e distanza < 150 m (44 m sì, 222 m no)");
    // Chiamate all'API simulate: senza chiave nessuna; con chiave ricerca + dettagli, poi la cache.
    const chiamate = [];
    const RISPOSTE = {
      search: { data: [{ location_id: "111", name: "Trattoria Da Enzo" }, { location_id: "222", name: "Da Mario" }] },
      d111: { location_id: "111", name: "Trattoria Da Enzo", latitude: "41.8886", longitude: "12.4774", rating: "4.5", num_reviews: "4396", web_url: "https://www.tripadvisor.it/Restaurant_Review-g187791-d111-Reviews-Da_Enzo.html", rating_image_url: "https://www.tripadvisor.it/img/cdsi/img2/ratings/traveler/4.5-MCID-5.svg" },
    };
    let lontano = false;
    const fakeFetch = async (url) => {
      chiamate.push(url);
      const u = new URL(url);
      if (u.pathname.endsWith("/location/search")) return { ok: true, status: 200, json: async () => RISPOSTE.search };
      if (u.pathname.includes("/location/111/details")) return { ok: true, status: 200, json: async () => ({ ...RISPOSTE.d111, ...(lontano ? { latitude: "41.8950" } : {}) }) };
      return { ok: false, status: 404, json: async () => ({}) };
    };
    const st = tam.nuovoStato();
    const senza = await tam.cercaTripadvisor(qui, { key: undefined, fetch: fakeFetch, stato: st });
    ok(senza.stato === "senza-chiave" && chiamate.length === 0, "tripadvisor: senza TRIPADVISOR_API_KEY nessuna chiamata esterna");
    const t0 = Date.parse("2026-10-17T10:00:00Z");
    const con = await tam.cercaTripadvisor(qui, { key: "chiave-finta", fetch: fakeFetch, stato: st, now: () => t0 });
    ok(con.stato === "trovato" && con.dato.rating === 4.5 && con.dato.numReviews === 4396 && con.dato.webUrl.startsWith("https://www.tripadvisor.it/Restaurant_Review") && con.dato.ratingImageUrl?.endsWith("4.5-MCID-5.svg"), "tripadvisor (chiave simulata): voto, recensioni, pagina e bolle dall'API ufficiale");
    ok(chiamate.length === 2 && chiamate[0].startsWith("https://api.content.tripadvisor.com/api/v1/location/search?") && chiamate[0].includes("latLong=41.8883%2C12.4773") && chiamate[1].includes("/location/111/details") && !chiamate.some((c) => c.includes("/222/")), `tripadvisor: una ricerca per nome e posizione + i dettagli del solo candidato simile (${chiamate.length} chiamate)`);
    await tam.cercaTripadvisor(qui, { key: "chiave-finta", fetch: fakeFetch, stato: st, now: () => t0 + 3600_000 });
    ok(chiamate.length === 2, "tripadvisor: entro 24 ore la stessa scheda non richiama l'API (cache in memoria)");
    await tam.cercaTripadvisor(qui, { key: "chiave-finta", fetch: fakeFetch, stato: st, now: () => t0 + 25 * 3600_000 });
    ok(chiamate.length === 4, "tripadvisor: dopo 24 ore la cache scade");
    lontano = true;
    const st2 = tam.nuovoStato();
    const far = await tam.cercaTripadvisor(qui, { key: "chiave-finta", fetch: fakeFetch, stato: st2, now: () => t0 });
    ok(far.stato === "nessuno", "tripadvisor: stesso nome ma a più di 150 m → nessun voto (meglio niente che un dato sbagliato)");
    const st3 = tam.nuovoStato(); st3.giorno = "2026-10-17"; st3.chiamate = tam.TA_TETTO_GIORNO - 1;
    const prima = chiamate.length;
    const lim = await tam.cercaTripadvisor({ ...qui, nome: "Altro Posto" }, { key: "chiave-finta", fetch: fakeFetch, stato: st3, now: () => t0 });
    ok(lim.stato === "limite" && chiamate.length === prima, `tripadvisor: oltre il tetto di ${tam.TA_TETTO_GIORNO} chiamate al giorno nessuna chiamata`);
    const st4 = tam.nuovoStato();
    for (let i = 0; i < tam.TA_CACHE_MAX + 20; i++) st4.cache.set(`k${i}`, { esito: { stato: "nessuno" }, scade: t0 + 1e9 });
    await tam.cercaTripadvisor(qui, { key: "chiave-finta", fetch: fakeFetch, stato: st4, now: () => t0 });
    ok(st4.cache.size <= tam.TA_CACHE_MAX, `tripadvisor: la cache in memoria non supera ${tam.TA_CACHE_MAX} voci`);
    ok(tam.datoDaDettagli({ web_url: "https://evil.example/x", rating: "5" }) === null && tam.datoDaDettagli({ web_url: "https://www.tripadvisor.it/x", rating: "9", num_reviews: "abc" })?.rating === null, "tripadvisor: link non Tripadvisor scartato, voti fuori scala mai mostrati");
  }

  // Route del server: senza chiave risponde subito, senza chiamare Tripadvisor.
  { const r = await fetch(`${BASE}/api/places/tripadvisor?nome=Terrazza%20Uno&lat=41.9&lng=12.49`);
    const j = await r.json().catch(() => null);
    if (j?.stato === "senza-chiave" || j?.stato == null) ok(r.status === 200 && j?.stato === "senza-chiave", `route /api/places/tripadvisor: senza chiave risponde "senza-chiave" (${r.status} ${JSON.stringify(j)})`);
    else console.log(`SKIP  route tripadvisor senza chiave: il dev server ha TRIPADVISOR_API_KEY (${j.stato})`);
    const bad = await fetch(`${BASE}/api/places/tripadvisor?nome=&lat=x`);
    ok(bad.status === 400, "route /api/places/tripadvisor: richiesta senza nome o posizione rifiutata (400)"); }

  // Scheda di un bar (Terrazza Uno, ★ 4,5 · 812): Google con i numeri, Tripadvisor solo come ricerca.
  const box = page.getByTestId("confronto");
  // Semplificare (20/10): il confronto sta in cima alle Recensioni, non più nella Panoramica.
  ok((await page.getByTestId("pannello-panoramica").getByTestId("confronto").count()) === 0, "scheda semplificata: 'A confronto' non è più nella Panoramica");
  ok(await page.getByTestId("segnali-scheda").evaluate((el) => getComputedStyle(el).display === "none"), "scheda semplificata: senza segnali il blocco sotto il nome sparisce (nessuno spazio vuoto)");
  ok((await page.getByTestId("orari-oggi").count()) === 0, "scheda: senza orari Google niente riga 'Oggi' (mai orari inventati)");
  await page.getByTestId("scheda-tab-recensioni").click();
  ok(await box.isVisible() && (await box.textContent()).includes("A confronto"), "confronto: riquadro 'A confronto' visibile in cima alle Recensioni");
  const g = page.getByTestId("confronto-google");
  const gt = (await g.textContent()) ?? "";
  ok(gt.includes("4,5") && gt.includes("812 recensioni") && (await g.getAttribute("href"))?.startsWith("https://www.google.com/maps/search/?api=1&query=Terrazza%20Uno") && await g.getAttribute("target") === "_blank", `confronto: Google ★ 4,5 · 812 recensioni, tocco → Google Maps in nuova scheda (${gt})`);
  const tl = page.getByTestId("confronto-link-tripadvisor");
  ok(await tl.isVisible() && await tl.getAttribute("href") === "https://www.tripadvisor.it/Search?q=Terrazza%20Uno%20Roma" && await tl.getAttribute("target") === "_blank" && (await tl.textContent()).includes("Tripadvisor") && ((await page.getByTestId("confronto-cerca").textContent()) ?? "").startsWith("Cercalo su"), "confronto: 'Cercalo su Tripadvisor' (una riga sola) apre la ricerca ufficiale in nuova scheda");
  ok((await page.getByTestId("confronto-tripadvisor").count()) === 0 && !/\d/.test((await tl.textContent()) ?? ""), "confronto: senza chiave nessun numero Tripadvisor");
  ok((await page.getByTestId("confronto-link-michelin").count()) === 0 && (await page.getByTestId("confronto-link-thefork").count()) === 0, "confronto: per un bar niente Michelin né TheFork");
  ok((await page.getByTestId("confronto-mapetite").count()) === 0, "confronto: senza voti della community niente riga Mapetite (era un doppione del verdetto)");
  ok(await page.evaluate(() => { const p = document.querySelector("[data-testid=pannello-recensioni]"); const c = document.querySelector("[data-testid=confronto]"); return !!p && !!c && p.contains(c) && [...p.children].indexOf(c.closest("[data-testid=pannello-recensioni] > *")) === 0; }), "confronto: è la prima cosa delle Recensioni");
  ok(await page.evaluate(() => { const r = [...document.querySelectorAll("[data-testid=confronto-cerca] > *")].map((e) => { const b = e.getBoundingClientRect(); return (b.top + b.bottom) / 2; }); return r.length > 0 && r.every((t) => Math.abs(t - r[0]) < 4); }), "confronto: 'Cercalo su' e le guide in una riga sola");
  await ctx.route("https://www.tripadvisor.it/**", (r) => r.fulfill({ contentType: "text/html", body: "<html><body>Tripadvisor</body></html>" }));
  const [pop] = await Promise.all([ctx.waitForEvent("page", { timeout: 3000 }).catch(() => null), tl.click()]);
  await pop?.close().catch(() => {});
  await page.waitForTimeout(300);
  const ce = events.filter((e) => e.props?.nome === "confronto_fonte");
  ok(ce.some((e) => e.props?.contesto === "tripadvisor" && e.props?.stato === "ricerca"), "confronto: tocco registrato come 'confronto_fonte' (contesto tripadvisor)");
  ok(ce.every((e) => Object.keys(e.props).every((k) => ["nome", "contesto", "stato"].includes(k))) && droppedKeys(ce).length === 0, "confronto: il segnale non porta dati personali (solo nome, contesto, stato)");

  // Ristorante con voti della community e Tripadvisor con la chiave (risposta del server simulata).
  const REST = [
    mk("R1", "Osteria Bella", 41.888, 12.53, { category: "restaurant", address: "Via del Pigneto 41, 00176 Roma RM, Italy", rating: 4.6, userRatingCount: 1234 }),
    // Chiusa adesso, con orari Google: riapre tra 3 ore, ogni giorno per un'ora (scheda: "Chiuso ora · apre …", Info: "Oggi …").
    mk("R2", "Trattoria Senza Voto", 41.889, 12.531, { category: "restaurant", rating: null, userRatingCount: null, openNow: false,
      orari: (() => { const t = new Date(Date.now() + 3 * 3600e3); const m = t.getHours() * 60 + t.getMinutes(); return [0, 1, 2, 3, 4, 5, 6].map((g) => [g * 1440 + m, g * 1440 + Math.min(m + 60, 1439)]); })() }),
  ];
  const comm = { placeId: null, recensioni: [5, 4].map((v, i) => ({ id: `c${i}`, rating: v, comment: null, created_at: "2026-10-10T20:00:00Z", autore: null, amico: false })), mia: { rating: 4, comment: null }, reel: [], reelPronti: false, viewer: true, foto: [], mieFoto: [], fotoPronte: false };
  const taChiesti = [];
  await page.route("**/api/search", (r) => r.fulfill({ json: { ...SEARCH_FAST, risultati: REST, sintesi_pendente: null } }));
  await page.route("**/api/places/community**", (r) => r.fulfill({ json: new URL(r.request().url()).searchParams.get("id") === "R1" ? comm : { ...comm, recensioni: [], mia: null } }));
  // Osteria Bella è verificata, con "c'è posto" e buoni pasto confermati da 3 persone.
  await page.route("**/api/ristoratore/serate**", (r) => r.fulfill({ json: new URL(r.request().url()).searchParams.get("id") === "R1" ? { verificato: true, giorni: [0, 1, 2, 3, 4, 5, 6], at: new Date().toISOString() } : new URL(r.request().url()).searchParams.get("id") === "R2" ? { verificato: true, giorni: [], at: null, apertoDal: (() => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 3); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; })() } : { verificato: false, giorni: [], at: null } }));
  await page.route("**/rest/v1/rpc/buoni_pasto_conteggio**", (r) => r.fulfill({ json: r.request().postDataJSON()?.p_place === "R1" ? [{ si: 3, no: 0 }] : [{ si: 0, no: 0 }] }));
  await page.route("**/api/places/tripadvisor**", (r) => {
    const u = new URL(r.request().url()); taChiesti.push(u.searchParams.get("nome"));
    if (u.searchParams.get("nome") !== "Osteria Bella") return r.fulfill({ json: { stato: "nessuno" } });
    return r.fulfill({ json: { stato: "trovato", dato: { rating: 4, numReviews: 1532, webUrl: "https://www.tripadvisor.it/Restaurant_Review-g187791-d1-Reviews-Osteria_Bella.html", ratingImageUrl: "https://www.tripadvisor.it/img/cdsi/img2/ratings/traveler/4.0-MCID-5.svg", nome: "Osteria Bella" } } });
  });
  await ctx.route("https://www.tripadvisor.it/img/**", (r) => r.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="90" height="16"><g fill="#00aa6c"><circle cx="8" cy="8" r="7"/><circle cx="26" cy="8" r="7"/><circle cx="44" cy="8" r="7"/><circle cx="62" cy="8" r="7"/></g><circle cx="80" cy="8" r="6" fill="none" stroke="#00aa6c" stroke-width="2"/></svg>' }));
  await page.goto(`${BASE}/mappa?scheda=b`, { waitUntil: "networkidle" });
  await (await esempio(page)).click();
  await page.getByText("Osteria Bella").first().click();
  await page.locator("h2", { hasText: "Osteria Bella" }).waitFor({ timeout: 5000 });
  { await page.getByTestId("buoni-pasto").waitFor({ timeout: 5000 }).catch(() => {});
    await page.getByTestId("posto-stasera").waitFor({ timeout: 5000 }).catch(() => {});
    const v = page.locator("h2", { hasText: "Osteria Bella" }).getByTestId("verificato-scheda");
    ok(await v.isVisible() && (await v.getAttribute("aria-label")) === "Verificato dal titolare", "scheda: locale verificato → spunta accanto al nome (non più una pillola in più)");
    ok((await page.getByTestId("segnali-scheda").getByText("Verificato", { exact: true }).count()) === 0, "scheda: nessuna pillola 'Verificato' sotto il nome");
    const h = await page.getByTestId("segnali-scheda").evaluate((el) => el.getBoundingClientRect().height);
    ok(await page.getByTestId("posto-stasera").isVisible() && await page.getByTestId("buoni-pasto").isVisible() && h <= 62, `scheda: 'c'è posto' e buoni pasto in un solo blocco di al massimo 2 righe (${Math.round(h)} px)`);
    await shot("15c-scheda-segnali"); }
  await page.getByTestId("scheda-tab-recensioni").click();
  await page.getByTestId("confronto-tripadvisor").waitFor({ timeout: 5000 }).catch(() => {});
  const mp = page.getByTestId("confronto-mapetite");
  ok(((await mp.textContent()) ?? "").includes("★ 4,3") && ((await mp.textContent()) ?? "").includes("3 recensioni"), `confronto: voto medio Mapetite con il numero (${await mp.textContent()})`);
  const tr = page.getByTestId("confronto-tripadvisor");
  ok(await tr.isVisible() && ((await tr.textContent()) ?? "").includes("1.532 recensioni") && await tr.getAttribute("href") === "https://www.tripadvisor.it/Restaurant_Review-g187791-d1-Reviews-Osteria_Bella.html" && await tr.getAttribute("target") === "_blank" && await tr.locator("img").getAttribute("alt") === "4,0 su 5" && ((await tr.textContent()) ?? "").includes("Tripadvisor"), "confronto (chiave simulata): riga Tripadvisor con bolle ufficiali, recensioni, attribuzione e link alla pagina");
  ok((await page.getByTestId("confronto-link-tripadvisor").count()) === 0, "confronto: con i dati Tripadvisor non c'è anche il link di ricerca");
  const mi = page.getByTestId("confronto-link-michelin"), tf = page.getByTestId("confronto-link-thefork");
  ok(await mi.getAttribute("href") === "https://guide.michelin.com/it/it/search?q=Osteria%20Bella" && await mi.getAttribute("target") === "_blank" && (await mi.getAttribute("aria-label")).startsWith("Cercalo su Michelin"), "confronto: ristorante → Michelin nella riga 'Cercalo su' (nuova scheda)");
  ok(await tf.getAttribute("href") === "https://www.thefork.it/search?queryText=Osteria%20Bella%20Roma" && await tf.getAttribute("target") === "_blank", "confronto: ristorante → 'Cercalo su TheFork' (nuova scheda)");
  ok(((await page.getByTestId("confronto-google").textContent()) ?? "").includes("1.234 recensioni"), "confronto: numero recensioni Google con il separatore delle migliaia");
  await page.getByTestId("confronto").scrollIntoViewIfNeeded();
  await page.evaluate(() => {
    const el = document.querySelector("[data-testid=confronto]");
    let sc = el?.parentElement;
    while (sc && !/(auto|scroll)/.test(getComputedStyle(sc).overflowY)) sc = sc.parentElement;
    if (el && sc) sc.scrollTop += el.getBoundingClientRect().top - sc.getBoundingClientRect().top - 60;
  });
  await page.waitForTimeout(300);
  await shot("15b-confronto-scheda");
  await mp.click();
  ok(await page.getByTestId("scheda-tab-recensioni").getAttribute("aria-selected") === "true", "confronto: tocco su Mapetite → resta nelle Recensioni (scende alla community)");
  ok(events.some((e) => e.props?.nome === "confronto_fonte" && e.props?.contesto === "mapetite" && e.props?.stato === "voti"), "confronto: tocco su Mapetite registrato");
  // Locale senza dati Google nella scheda (come i salvati): la riga Google è solo il link.
  await page.getByLabel("Chiudi", { exact: true }).first().click();
  // Card di lato: il primo tocco la centra, il secondo apre la scheda.
  await page.getByText("Trattoria Senza Voto").first().click();
  if (!(await page.locator("h2", { hasText: "Trattoria Senza Voto" }).waitFor({ timeout: 1200 }).then(() => true, () => false))) await page.getByText("Trattoria Senza Voto").first().click();
  await page.locator("h2", { hasText: "Trattoria Senza Voto" }).waitFor({ timeout: 5000 });
  await page.waitForTimeout(400);
  await page.getByTestId("scheda-tab-recensioni").click();
  const g2 = ((await page.getByTestId("confronto-google").textContent()) ?? "");
  ok(g2.includes("Apri su Google Maps") && !/\d/.test(g2), `confronto: senza voto Google la riga è solo il link (${g2})`);
  ok((await page.getByTestId("confronto-mapetite").count()) === 0 && await page.getByTestId("confronto-link-tripadvisor").isVisible(), "confronto: senza voti né verdetto niente riga Mapetite; Tripadvisor non abbinato → link di ricerca");
  ok(taChiesti.length >= 2, "confronto: la scheda chiede Tripadvisor al nostro server, mai direttamente al sito");
  { const r = ((await page.getByTestId("riapre").textContent().catch(() => "")) ?? "");
    ok(r.startsWith("Chiuso ora") && /apre (alle|domani alle) \d{2}:\d{2}$/.test(r), `scheda: locale chiuso con orari → 'Chiuso ora · apre alle …' su una riga sua (${r})`);
    ok(!((await page.getByTestId("scheda-fatti").textContent()) ?? "").includes("Chiuso"), "scheda: 'Chiuso ora' non è ripetuto nella riga dei fatti");
    await page.getByTestId("aperto-da-poco").waitFor({ timeout: 5000 }).catch(() => {});
    ok(((await page.getByTestId("aperto-da-poco").textContent().catch(() => "")) ?? "").includes("Aperto da 3 mesi"), "scheda: locale verificato aperto da 3 mesi → '🆕 Aperto da 3 mesi' tra i segnali");
    ok((await page.getByTestId("posto-stasera").count()) === 0 && await page.locator("h2", { hasText: "Trattoria Senza Voto" }).getByTestId("verificato-scheda").isVisible(), "scheda: verificato senza serate → spunta, nessuna pillola 'c'è posto'");
    await page.getByTestId("scheda-tab-info").click();
    const o = ((await page.getByTestId("orari-oggi").textContent().catch(() => "")) ?? "");
    ok(/^Oggi (\d{2}:\d{2}–\d{2}:\d{2}|Chiuso)$/.test(o.trim()), `scheda, Info: orari di oggi da Google (${o})`); }
  await page.unroute("**/api/search"); await page.unroute("**/api/places/community**"); await page.unroute("**/api/places/tripadvisor**");
  await page.unroute("**/api/ristoratore/serate**"); await page.unroute("**/rest/v1/rpc/buoni_pasto_conteggio**");
}
await page.goto(`${BASE}/mappa`, { waitUntil: "networkidle" });
ok(await page.evaluate(() => document.documentElement.dataset.scheda === "b"), "scheda B: la scelta resta senza parametro");
await page.goto(`${BASE}/mappa?scheda=a`, { waitUntil: "networkidle" });
await (await esempio(page)).click();
await page.getByText("Terrazza Uno").first().click();
await page.getByTestId("verdetto-scheda").waitFor({ timeout: 4000 });
ok(true, "?scheda=a: torna la scheda attuale");

// 7-quater. Primo accesso variante B (?home=b): si scrive subito, senza aprire un altro pannello
await page.goto(`${BASE}/mappa?home=b`, { waitUntil: "networkidle" });
ok(await page.getByLabel("Cosa cerchi?").isVisible(), "home B: campo di ricerca visibile subito");
ok((await (await esempio(page)).count()) === 1, "home B: esempi a schede cliccabili");
ok((await page.getByRole("button", { name: "Usa la mia posizione" }).count()) === 1, "home B: pulsante 'Vicino a me'");
{ const hb = (await page.getByTestId("benvenuto").boundingBox())?.height ?? 999; ok(hb < 844 * 0.35, `home B: la mappa resta visibile (altezza ${Math.round(hb)}px)`); }
await shot("16-home-b");
await page.getByLabel("Cosa cerchi?").fill("rooftop con vista");
await page.getByLabel("Cosa cerchi?").press("Enter");
await page.getByTestId("titolo-risposta").waitFor({ timeout: 5000 });
ok(/rooftop con vista/i.test(await page.getByTestId("titolo-risposta").innerText()), "home B: Invio avvia la ricerca scritta");
await page.goto(`${BASE}/mappa?home=a`, { waitUntil: "networkidle" });
ok(await page.getByTestId("apri-idee").isVisible(), "?home=a: torna il primo accesso attuale (barra con 'Idee')");
await page.goto(`${BASE}/mappa?beta=-suggerimenti`, { waitUntil: "networkidle" });
ok(await page.getByTestId("benvenuto").getByText("Chiedi all'AI, per esempio:").isVisible() && (await page.getByTestId("apri-idee").count()) === 0, "?beta=-suggerimenti: torna la card in basso di prima");

// 7-quinquies. Pin con foto (?pin=b): stesse foto delle card, nessuna foto in più
await page.goto(`${BASE}/mappa?pin=b`, { waitUntil: "networkidle" });
await (await esempio(page)).click();
await page.getByText("Vista vera sui tetti di Roma.").first().waitFor({ timeout: 12000 });
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
await (await esempio(page)).click();
await page.getByText("Terrazza Uno").first().waitFor({ timeout: 5000 });
await page.waitForTimeout(2000); // c'è un secondo tentativo dopo 0,7 s
ok((await page.getByTestId("verdetti-in-arrivo").count()) === 0 && (await page.locator("ul.snap-x li[data-id]:not([data-id=\"\"])").count()) === 3, "senza Haiku: restano i 3 locali Google e il caricamento si chiude");
ok((await page.locator("ul.snap-x li").first().getByTestId("riga-google").textContent()) === "“Bella vista sulla città.”", "senza verdetto: la card mostra una recensione di Google invece di restare vuota");
ok((await page.getByTestId("punti-forti").count()) === 0, "senza Haiku: nessuna chip di punti forti (mai riempite con testo generico)");
await shot("21-senza-verdetto");
await page.unroute("**/api/search/synthesis");
// Un gruppo di verdetti perso una volta (502 visto dal vivo il 19/10) si richiede: il verdetto arriva lo stesso.
{ let chiamate = 0;
  await page.route("**/api/search/synthesis", (r) => { chiamate++; return chiamate === 1 ? r.fulfill({ status: 502, body: "Bad Gateway" }) : r.fallback(); });
  await page.goto(`${BASE}/mappa`, { waitUntil: "networkidle" });
  await (await esempio(page)).click();
  const arrivato = await page.getByText("Vista vera sui tetti di Roma.").first().waitFor({ timeout: 8000 }).then(() => true, () => false);
  ok(arrivato && chiamate === 2, `verdetti: dopo un errore del server si riprova una volta e il verdetto arriva (${chiamate} chiamate)`);
  await page.unroute("**/api/search/synthesis"); }

// Lista nuova: ?lista=b-vecchia torna alla lista di prima (e se lo ricorda), ?lista=b la riaccende.
await page.goto(`${BASE}/mappa?lista=b-vecchia`, { waitUntil: "networkidle" });
await (await esempio(page)).click();
await page.getByText("Vista vera sui tetti di Roma.").first().waitFor({ timeout: 6000 });
ok((await page.getByTestId("posizione-card").count()) === 0 && (await page.getByTestId("titolo-risposta").isVisible()), "?lista=b-vecchia: torna la lista di prima con l'intestazione");
await page.goto(`${BASE}/mappa`, { waitUntil: "networkidle" });
await (await esempio(page)).click();
await page.getByText("Vista vera sui tetti di Roma.").first().waitFor({ timeout: 6000 });
ok((await page.getByTestId("posizione-card").count()) === 0, "?lista=b-vecchia: la scelta resta anche riaprendo la mappa");
await page.goto(`${BASE}/mappa?lista=b`, { waitUntil: "networkidle" });
await (await esempio(page)).click();
await page.getByText("Vista vera sui tetti di Roma.").first().waitFor({ timeout: 6000 });
ok((await page.getByTestId("posizione-card").count()) >= 1, "?lista=b: torna la lista nuova");
{ const pins = await page.getByTestId("pin-foto").evaluateAll((els) => els.map((e) => ({ tondo: getComputedStyle(e).borderRadius.startsWith("9999") || parseFloat(getComputedStyle(e).borderRadius) >= e.getBoundingClientRect().width / 2 - 1, w: Math.round(e.getBoundingClientRect().width), fuoco: !!e.closest("[data-focused=true]") })));
  ok(pins.length >= 1 && pins.every((p) => p.tondo) && pins.filter((p) => p.fuoco).every((p) => p.w > Math.max(...pins.filter((q) => !q.fuoco).map((q) => q.w), 0)), `lista nuova: pin con la foto, tondi, quello a fuoco più grande (${pins.map((p) => p.w + (p.fuoco ? "*" : "")).join(", ")})`); }

// 7-sexies. Un solo interruttore per tutte le varianti
await page.goto(`${BASE}/mappa?stile=places`, { waitUntil: "networkidle" });
ok(await page.evaluate(() => { const d = document.documentElement.dataset; return d.titoli === "serif" && d.scheda === "b" && d.home === "b" && d.pin === "b"; }), "?stile=places accende tutte le varianti");
await page.goto(`${BASE}/mappa?stile=attuale`, { waitUntil: "networkidle" });
ok(await page.evaluate(() => { const d = document.documentElement.dataset; return !d.titoli && !d.scheda && !d.home && !d.pin; }), "?stile=attuale le spegne tutte");

// 7a. Variante titoli serif (?titoli=serif, ricordata sul telefono; ?titoli=sans torna a Poppins)
const titleFont = async () => page.evaluate(() => { const h = document.querySelector("[data-testid=benvenuto] .font-title"); return h ? getComputedStyle(h).fontFamily : ""; });
await page.goto(`${BASE}/mappa?beta=-suggerimenti`, { waitUntil: "networkidle" });
{ const f = await titleFont(); ok(/Poppins/i.test(f), `titoli: Poppins di default (${f.slice(0, 40)})`); }
await page.goto(`${BASE}/mappa?titoli=serif&beta=-suggerimenti`, { waitUntil: "networkidle" });
ok(/Newsreader/i.test(await titleFont()), "titoli: ?titoli=serif accende il serif");
await page.goto(`${BASE}/mappa?beta=-suggerimenti`, { waitUntil: "networkidle" });
ok(/Newsreader/i.test(await titleFont()), "titoli: la scelta resta anche senza parametro");
await page.goto(`${BASE}/mappa?titoli=sans&beta=-suggerimenti`, { waitUntil: "networkidle" });
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
// Feedback 16/10 ("il dono della sintesi"): un solo pulsante Incolla in cima, poi 4 tessere che aprono il proprio pannello.
ok(await page.getByTestId("importa-incolla").isVisible() && (await page.getByRole("button", { name: /Incolla/ }).count()) === 1, "importa: un solo pulsante Incolla, in cima");
{ const tiles = await page.getByTestId("importa-tessere").getByRole("button").allTextContents();
  ok(tiles.length === 4 && ["Da Google Maps", "Da file di Google", "Da screenshot", "A mano"].every((t, i) => tiles[i]?.includes(t)), `importa: 4 tessere Da Google Maps · Da file di Google · Da screenshot · A mano (${tiles.length})`); }
{ const inc = await page.getByTestId("importa-incolla").boundingBox(); const tl = await page.getByTestId("importa-tessere").boundingBox();
  ok(inc && tl && inc.y < tl.y && inc.height >= 56 && tl.y + tl.height <= 844 * 1.05, `importa: Incolla grande sopra le tessere, tutto nel primo schermo (${Math.round(inc?.height ?? 0)}px, tessere fino a ${Math.round((tl?.y ?? 0) + (tl?.height ?? 0))})`); }
ok(!(await page.getByText("Scegli uno screenshot").isVisible()) && !(await page.getByTestId("importa-mano").isVisible()) && !(await page.getByTestId("importa-file").isVisible()) && !(await page.getByTestId("importa-maps-guida").isVisible()), "importa: i pannelli restano chiusi finché non si tocca una tessera");
await page.getByTestId("importa-tessera-shot").click();
ok(await page.getByText("Scegli uno screenshot").isVisible() && (await page.getByTestId("importa-tessera-shot").getAttribute("aria-expanded")) === "true", "importa: la tessera 'Da screenshot' apre il pannello con il pulsante in italiano");
await page.getByTestId("importa-tessera-mano").click();
ok(await page.getByTestId("importa-mano").isVisible() && !(await page.getByText("Scegli uno screenshot").isVisible()), "importa: un pannello alla volta ('A mano' chiude lo screenshot)");
await shot("19-importa");

// 7b. Feedback dei tester: email precompilata con pagina e telefono.
// Dal piano 6.4 sta nel profilo (sezione "Account"), anche da non collegati; non più nella barra.
await page.goto(`${BASE}/profilo?da=feedback`, { waitUntil: "networkidle" });
ok((await page.locator("nav").first().getByRole("link", { name: "Feedback" }).count()) === 0, "feedback: non è più una voce della barra in basso");
const fb = page.getByTestId("profilo-account").getByRole("link", { name: /Dai un feedback/ });
ok(await fb.isVisible(), "feedback: 'Dai un feedback' nel profilo (anche da non collegati)");
await fb.evaluate((a) => a.addEventListener("click", (e) => e.preventDefault()));
await fb.click();
const fbHref = decodeURIComponent((await fb.getAttribute("href")) ?? "");
ok(fbHref.startsWith("mailto:founder.mapetite@gmail.com") && fbHref.includes("Pagina: /profilo?da=feedback"), "feedback: email precompilata con la pagina in cui si trova il tester");
ok((await page.getByTestId("profilo-account").getByRole("button", { name: "Esci" }).count()) === 0, "profilo da non collegati: niente 'Esci'");
await page.goto(`${BASE}/mappa?lista=b`, { waitUntil: "networkidle" });

// 7b'. Barra in basso (voce 11a): "Salvati" al posto di "Importa", apre la mappa sui salvati
{
  const nav = page.locator("nav").first();
  const sv = nav.getByRole("link", { name: "Salvati" });
  ok(await sv.isVisible() && (await sv.getAttribute("href")) === "/mappa?vista=salvati", "barra in basso: voce 'Salvati' che apre la mappa sui salvati");
  ok((await nav.getByRole("link", { name: "Importa" }).count()) === 0, "barra in basso: 'Importa' non c'è più (si trova nel profilo)");
  ok((await nav.getByRole("link", { name: "Mappa" }).getAttribute("aria-current")) === "page" && (await sv.getAttribute("aria-current")) === null, "barra in basso: su /mappa è accesa 'Mappa', non 'Salvati'");
}

// 7c. iPhone: invito ad aggiungere alla Home (solo a chi ha già cercato)
const ctxIos = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1" });
const pi = await ctxIos.newPage();
await pi.goto(`${BASE}/mappa`, { waitUntil: "networkidle" });
ok((await pi.getByTestId("installa").count()) === 0, "iPhone, primo accesso: nessun invito a installare");
await pi.evaluate(() => localStorage.setItem("mapetite.recenti", JSON.stringify(["rooftop a Roma"])));
await pi.reload({ waitUntil: "networkidle" });
await pi.getByText("📲 Aggiungi Mapetite alla Home").click();
ok(await pi.getByText("Aggiungi alla schermata Home").isVisible(), "iPhone, chi torna: invito con le istruzioni per la Home");
await pi.screenshot({ path: `${OUT}/07c-installa-iphone.png`, caret: "initial" });
await pi.getByRole("button", { name: "Non mostrare più" }).click();
await pi.reload({ waitUntil: "networkidle" });
ok((await pi.getByTestId("installa").count()) === 0, "iPhone: chiuso l'invito non ricompare");
await ctxIos.close();

// 8. Pagine pubbliche: si aprono e il pulsante principale non è coperto
for (const r of ["login", "signup", "profilo", "importa", "onboarding"]) {
  const resp = await page.goto(`${BASE}/${r}`, { waitUntil: "networkidle" });
  ok(resp?.status() === 200, `/${r} risponde 200`);
}
await page.goto(`${BASE}/miei-locali`, { waitUntil: "networkidle" });
ok(new URL(page.url()).pathname === "/mappa" && new URL(page.url()).searchParams.get("vista") === "salvati", "pagina vecchia /miei-locali: porta a 'I miei salvati'");
// Suggerimento col meteo (piano 2.3): pioggia alle 19:30 → un posto al coperto; caldo → all'aperto.
for (const [meteo, atteso] of [[{ temperature_2m: 12, precipitation: 2, weather_code: 61 }, "al coperto"], [{ temperature_2m: 24, precipitation: 0, weather_code: 1 }, "all'aperto, stasera 24°"]]) {
  const wctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await wctx.addInitScript(() => { try { localStorage.setItem("mapetite.intro", "visto"); } catch { /* ignorato */ } });
  await wctx.route("**/api.open-meteo.com/**", (r) => r.fulfill({ json: { current: meteo } }));
  const wp = await wctx.newPage();
  await wp.clock.setFixedTime(new Date("2026-10-15T19:30:00"));
  await wp.goto(`${BASE}/mappa`, { waitUntil: "networkidle" });
  const txt = await wp.getByTestId("suggerimento-momento").textContent({ timeout: 5000 }).catch(() => "");
  ok(txt.includes(atteso), `suggerimento col meteo: "${txt}" contiene "${atteso}"`);
  await wctx.close();
}
// Per i ristoratori (piano 8.3b): pagina pubblica con i tre piani, il modulo di richiesta e l'esempio del pannello.
{ const r = await page.goto(`${BASE}/per-i-ristoratori`, { waitUntil: "networkidle" });
  ok(r?.status() === 200 && (await page.getByTestId("piano").count()) === 3 && (await page.getByTestId("rivendica").getAttribute("href")) === "/per-i-ristoratori/rivendica" && (await page.getByTestId("pannello-demo").getAttribute("href")) === "/ristoratore/demo", "per i ristoratori: tre piani, 'Rivendica il tuo locale' porta al modulo e c'è il pannello d'esempio");
  // Feedback 16/10: pagina breve, piani confrontabili riga per riga, un solo invito all'azione.
  { const righe = await page.getByTestId("piani").locator("tbody tr").count();
    const cta = await page.getByRole("link", { name: "Rivendica il tuo locale" }).evaluateAll((els) => [...new Set(els.map((e) => e.getAttribute("href")))]);
    const h = await page.evaluate(() => document.documentElement.scrollHeight); const w = await page.evaluate(() => document.documentElement.scrollWidth);
    ok(righe >= 8 && cta.length === 1 && cta[0] === "/per-i-ristoratori/rivendica" && h < 2300 && w <= 390, `per i ristoratori: tabella dei piani (${righe} righe), un solo invito all'azione, pagina corta (${h}px) e senza scorrimento di lato (${w}px)`); } }
const r404 = await page.goto(`${BASE}/pagina-che-non-esiste`, { waitUntil: "networkidle" });
ok(r404?.status() === 404 && await page.getByText("Questa pagina non esiste").isVisible(), "404 in italiano con invito ad aprire la mappa");
await page.goto(`${BASE}/importa`, { waitUntil: "networkidle" });
await page.getByTestId("importa-tessera-shot").click();
await page.getByLabel("Scegli uno screenshot").setInputFiles({ name: "post.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64") });
ok(await page.getByText("Cambia screenshot").isVisible() && await page.getByText("post.png").isVisible(), "importa: area grande per scegliere lo screenshot, in italiano");
// Screenshot grande (come un PNG di iPhone): parte rimpicciolito in JPEG, sotto il limite delle richieste
{
  let captionBody = null;
  await page.route("**/api/import-caption", (r) => { captionBody = r.request().postDataJSON(); return r.fulfill({ json: { name: null, city: null } }); });
  await page.evaluate(async () => {
    const c = document.createElement("canvas"); c.width = 3000; c.height = 2000;
    const g = c.getContext("2d");
    for (let i = 0; i < 2000; i += 4) { g.fillStyle = `hsl(${(i * 7) % 360},80%,${30 + (i % 40)}%)`; g.fillRect(0, i, 3000, 4); }
    const blob = await new Promise((res) => c.toBlob(res, "image/png"));
    const dt = new DataTransfer(); dt.items.add(new File([blob], "grande.png", { type: "image/png" }));
    const input = document.querySelector("input[type=file]"); input.files = dt.files; input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page.getByRole("button", { name: "Leggi locale" }).click();
  for (let i = 0; i < 20 && !captionBody; i++) await page.waitForTimeout(200);
  ok(captionBody?.image?.startsWith("data:image/jpeg") && captionBody.image.length < 1_500_000, `importa: screenshot grande rimpicciolito prima dell'invio (${captionBody?.image?.slice(0, 15)}, ${Math.round((captionBody?.image?.length ?? 0) / 1000)} kB)`);
  await page.unroute("**/api/import-caption");
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
await page.getByTestId("onboarding-salta").click();
await page.waitForURL(/\/mappa/, { timeout: 5000 }).then(() => ok(true, "onboarding: 'Salta' porta subito alla mappa"), () => ok(false, "onboarding: 'Salta' porta subito alla mappa"));
await shot("08-onboarding");
await page.goto(`${BASE}/profilo`, { waitUntil: "networkidle" });
ok(await page.getByRole("link", { name: "Accedi" }).isVisible(), "profilo da disconnessi: invito ad accedere");

// 8-bis. Ritorno dopo l'accesso: login, registrazione e onboarding portano con sé `next`.
{
  const hiddenNext = () => page.locator('form input[type=hidden][name=next]').evaluateAll((els) => els.map((e) => e.value));
  await page.goto(`${BASE}/login?next=${encodeURIComponent("/locali/abc?salva=1")}`, { waitUntil: "networkidle" });
  ok(JSON.stringify(await hiddenNext()) === '["/locali/abc?salva=1"]', "login con next: campo nascosto con il percorso di ritorno");
  ok(await page.getByTestId("auth-ritorno").textContent() === "Poi torni al locale che stavi guardando, pronto da salvare.", "login con next: spiega che dopo si torna al locale");
  ok(await page.getByRole("link", { name: "Registrati" }).getAttribute("href") === "/signup?next=%2Flocali%2Fabc%3Fsalva%3D1", "login con next: 'Registrati' conserva next");
  ok(await page.getByRole("link", { name: "Entra" }).first().getAttribute("href") === "/login?next=%2Flocali%2Fabc%3Fsalva%3D1", "login con next: 'Entra' nella barra conserva next");
  await page.goto(`${BASE}/signup?next=%2Fstasera`, { waitUntil: "networkidle" });
  ok(JSON.stringify(await hiddenNext()) === '["/stasera"]' && await page.getByRole("link", { name: "Accedi" }).last().getAttribute("href") === "/login?next=%2Fstasera", "registrazione con next: campo nascosto e 'Accedi' conserva next");
  for (const bad of ["//evil.com", "https://evil.com", "/\\evil.com", "javascript:alert(1)"]) {
    await page.goto(`${BASE}/login?next=${encodeURIComponent(bad)}`, { waitUntil: "networkidle" });
    ok((await hiddenNext()).length === 0 && (await page.getByTestId("auth-ritorno").count()) === 0 && await page.getByRole("link", { name: "Registrati" }).getAttribute("href") === "/signup", `login con next pericoloso ${JSON.stringify(bad)}: ignorato`);
  }
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  ok((await hiddenNext()).length === 0, "login senza next: nessun campo nascosto (comportamento di prima)");
  // Onboarding: "Salta" va a next; senza next (o con next non valido) alla mappa.
  await page.goto(`${BASE}/onboarding?next=%2Flocali%2Fabc%3Fsalva%3D1`, { waitUntil: "networkidle" });
  const saltaNext = () => page.locator("form", { has: page.getByTestId("onboarding-salta") }).locator("input[name=next]").evaluateAll((els) => els.map((e) => e.value));
  ok(JSON.stringify(await saltaNext()) === '["/locali/abc?salva=1"]', "onboarding con next: 'Salta' riporta alla pagina di partenza");
  await page.goto(`${BASE}/onboarding?next=%2F%2Fevil.com`, { waitUntil: "networkidle" });
  ok((await saltaNext()).length === 0, "onboarding con next pericoloso: 'Salta' resta sulla mappa");
  // Senza accesso l'onboarding chiede prima la registrazione (le risposte si perdevano), portando next.
  {
    const octx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await octx.addCookies([{ name: "e2e_anonimo", value: "1", url: BASE }]);
    const op = await octx.newPage();
    await op.goto(`${BASE}/onboarding?next=%2Fstasera`, { waitUntil: "networkidle" });
    ok(new URL(op.url()).pathname === "/signup" && new URL(op.url()).searchParams.get("next") === "/stasera", `onboarding senza accesso: prima la registrazione, con next (${op.url().replace(BASE, "")})`);
    await octx.close();
  }
  // "Entra" nella barra: dalle pagine diverse dalla mappa porta con sé la pagina corrente.
  await page.goto(`${BASE}/importa`, { waitUntil: "networkidle" });
  ok(await page.getByRole("link", { name: "Entra" }).first().getAttribute("href") === "/login?next=%2Fimporta", "barra: 'Entra' da Importa riporta a Importa");
  await page.goto(`${BASE}/mappa`, { waitUntil: "networkidle" });
  ok(await page.getByRole("link", { name: "Entra" }).first().getAttribute("href") === "/login", "barra: 'Entra' dalla mappa resta /login");
  await page.goto(`${BASE}/profilo`, { waitUntil: "networkidle" });
  ok(await page.getByRole("link", { name: "Accedi" }).getAttribute("href") === "/login?next=%2Fprofilo" && await page.getByRole("link", { name: "Crea un account" }).getAttribute("href") === "/signup?next=%2Fprofilo", "profilo da disconnessi: Accedi/Crea un account riportano al profilo");
  // Il form di login invia next all'azione del server (l'accesso vero con Supabase non si simula qui).
  // Contesto a parte: la richiesta viene fermata qui (nessun tentativo verso Supabase).
  const actx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  let sentNext = null;
  await actx.route("**/login**", (r) => {
    if (r.request().method() !== "POST") return r.continue();
    sentNext = r.request().postData() ?? "";
    return r.fulfill({ status: 204, body: "" });
  });
  const ap = await actx.newPage();
  await ap.goto(`${BASE}/login?next=%2Fstasera`, { waitUntil: "networkidle" });
  await ap.getByLabel("Email").fill("prova@example.com");
  await ap.getByLabel("Password").fill("password-di-prova");
  await ap.locator("form").getByRole("button", { name: "Accedi" }).click();
  for (let i = 0; i < 20 && sentNext === null; i++) await ap.waitForTimeout(100);
  ok(!!sentNext && /name="(_?\d+_)?next"\s*\r?\n\r?\n\/stasera\r?\n/.test(sentNext), "login con next: il modulo invia next all'azione del server");
  await actx.close();
}

// 8a. "Cancella" le ricerche recenti
await page.goto(`${BASE}/mappa`, { waitUntil: "networkidle" });
await idee(page);
await page.getByTestId("cancella-recenti").click();
await page.waitForTimeout(200);
ok((await page.getByTestId("recenti").count()) === 0 && (await page.getByTestId("cancella-recenti").count()) === 0, "ricerche recenti: 'Cancella' le toglie subito");

// 8b. Salvati vuoti (con l'utente finto il giro principale ha zero salvati): invito a cercare
if (await page.goto(`${BASE}/mappa`, { waitUntil: "networkidle" }).then(() => vaiSalvati(page)).then(() => page.getByTestId("salvati-senza-account").isVisible())) {
  console.log("SKIP  salvati vuoti: dev server senza E2E_FAKE_USER");
} else {
  await page.getByText("La tua mappa è ancora vuota").waitFor({ timeout: 4000 });
  ok((await page.getByTestId("raccogli-vuoto").getByRole("link").evaluateAll((as) => as.map((a) => a.getAttribute("href")))).join(" ") === "/importa /importa#da-screenshot /importa#a-mano", "salvati vuoti: i modi per salvare (Google Maps, screenshot, a mano) a un tocco");
  await page.screenshot({ path: `${OUT}/08b-salvati-vuoti.png`, caret: "initial" });
  await page.getByRole("button", { name: "Cerca un locale" }).click();
  ok(await page.getByTestId("idee-pannello").isVisible(), "salvati vuoti: 'Cerca un locale' riporta alla ricerca con le idee aperte");
  await page.goto(`${BASE}/importa#da-screenshot`, { waitUntil: "networkidle" });
  ok(await page.getByText("Scegli uno screenshot").waitFor({ timeout: 3000 }).then(() => true, () => false), "importa#da-screenshot: si apre già il pannello dello screenshot");
  await page.goto(`${BASE}/importa#a-mano`, { waitUntil: "networkidle" });
  ok(await page.getByTestId("importa-mano").waitFor({ timeout: 3000 }).then(() => true, () => false) && !(await page.getByText("Scegli uno screenshot").isVisible()), "importa#a-mano: si apre già il pannello 'A mano'");
}

// 9. Salvati (voce 8): città dall'indirizzo, ricerca nel testo, nota sulle card.
// Supabase simulato; serve il dev server avviato con E2E_FAKE_USER.
const fakeUser = await page.goto(`${BASE}/mappa`).then(() => vaiSalvati(page))
  .then(() => page.getByTestId("salvati-senza-account").isVisible({ timeout: 1500 })).then((v) => !v);
if (!fakeUser) console.log("SKIP  salvati: dev server senza E2E_FAKE_USER");
else {
  const rows = [
    { tags: ["romantico"], note: "Tavolo sulla terrazza", places: { id: "00000000-0000-4000-8000-000000000001", name: "Terrazza Uno", category: "bar", address: "Via Po, 2/a, 00198 Roma RM, Italy", lat: 41.9, lng: 12.49, google_place_id: "G1", rating: 4.6, price_level: 2 } },
    { tags: ["amici", "Da provare"], note: null, places: { id: "00000000-0000-4000-8000-000000000002", name: "Osteria Due", category: "restaurant", address: "Via dei Vascellari 29, Roma", lat: 41.89, lng: 12.47, google_place_id: "G2" } },
    { tags: null, note: "Brunch domenica", places: { id: "00000000-0000-4000-8000-000000000003", name: "Caffè Milano", category: "cafe", address: "Corso Monforte, 26, 20122 Milano MI, Italy", lat: 45.46, lng: 9.2, google_place_id: "G3" } },
  ];
  const sctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await sctx.route("**/rest/v1/saved_places**", (r) => r.request().url().includes("select=place_id") ? r.fulfill({ json: rows.map((x) => ({ place_id: x.places.id })) }) : r.fulfill({ json: rows }));
  // Verdetto già in cache per Terrazza Uno (G1): deve comparire sulla card dei salvati.
  await sctx.route("**/rest/v1/place_synthesis**", (r) => r.fulfill({ json: [{ place_id: "G1", synthesis: "Terrazza tranquilla.", tags: [], verdict: "Aperitivo lento sui tetti, lontano dalla folla.", go_for: ["tramonto"], dont_expect: [] }] }));
  await sctx.route("**/rest/v1/profiles**", (r) => r.fulfill({ json: [{ cuisines: ["romana_laziale"], occasions: ["cena_romantica"], atmospheres: ["intima"], price_range: "€€" }] }));
  // Salvato senza verdetto (Osteria Due, G2): aprendo la scheda il verdetto si chiede al server.
  const verdettoChiesti = [];
  await sctx.route("**/api/places/verdetto", async (r) => { verdettoChiesti.push(r.request().postDataJSON()?.googlePlaceId); await new Promise((ok) => setTimeout(ok, 1200)); return r.fulfill({ json: { verdict: "Cacio e pepe da manuale, sala piccola e rumorosa.", synthesis: "Osteria di quartiere.", tags: [], goFor: ["cacio e pepe"], dontExpect: [], userRatingCount: 640, openNow: true, websiteUri: null, phone: null, photoRef: null, selectedReviews: [] } }); });
  await sctx.route("**/api/places/photo**", (r) => r.fulfill({ status: 429, json: {} }));
  await sctx.route("**/api/search", (r) => r.fulfill({ json: SEARCH_FAST }));
  await sctx.route("**/api/search/synthesis", (r) => r.fulfill({ json: SYNTH }));
  const p = await sctx.newPage();
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto(`${BASE}/mappa`, { waitUntil: "networkidle" });
  ok((await p.getByTestId("suggerimento-per-te").getAttribute("aria-label")) === "✨ Per te: Cena romantica, cucina romana, atmosfera intima", "card iniziale: suggerimento 'Per te' dai gusti dell'onboarding");
  await vaiSalvati(p);
  await p.getByTestId("salvati-filtri").waitFor({ timeout: 5000 });
  // Lorenzo 16/10 ("il dono della sintesi"): in alto UNA riga (cerca + Stasera), il resto dietro "Filtri".
  { const box = await p.getByTestId("salvati-filtri").boundingBox();
    ok(!!box && box.height < 70 && (await p.getByTestId("salvati-filtri").getByRole("button").count()) === 0 && await p.getByLabel("Cerca tra i salvati").isVisible(), `salvati: una sola riga di controlli in alto (alta ${Math.round(box?.height ?? 0)} px, niente chip sempre in vista)`);
    ok((await p.getByRole("button", { name: "Filtri", exact: true }).count()) === 1 && (await p.getByTestId("salvati-filtri-attivi").count()) === 0, "salvati: un solo pulsante 'Filtri', senza numero se nessun filtro è acceso"); }
  ok((await p.getByTestId("vai-stasera").getAttribute("href")) === "/stasera" && await p.getByTestId("vai-stasera").isVisible(), "salvati: 'Stasera dove andiamo?' porta alla scelta tra i salvati");
  await p.getByTestId("salvati-apri-filtri").click(); await p.getByTestId("salvati-foglio").waitFor({ timeout: 3000 });
  { const fs = p.getByTestId("salvati-foglio");
    ok(await fs.getByRole("button", { name: "📍 Roma · 2" }).isVisible(), "città: chip Roma · 2 (nel foglio Filtri)");
    ok(await fs.getByRole("button", { name: "📌 Voglio andarci · 1" }).isVisible() && await fs.getByRole("button", { name: "✓ Ci sono stato · 0" }).isVisible(), "salvati: nel foglio Filtri lo stato '📌 Voglio andarci · 1' / '✓ Ci sono stato · 0' (con quanti sono)");
    ok(await fs.getByRole("button", { name: "romantico · 1" }).isVisible() && await fs.getByText("Raccolte", { exact: true }).isVisible() && await fs.getByText("Ordine", { exact: true }).isVisible(), "salvati: nel foglio Filtri anche raccolte e ordine");
    await p.screenshot({ path: `${OUT}/11e-salvati-foglio-filtri.png`, caret: "initial" });
    await fs.getByRole("button", { name: "📌 Voglio andarci · 1" }).click();
    ok((await fs.getByTestId("salvati-mostra").textContent()) === "Mostra 1 posto", "foglio Filtri: il pulsante dice quanti posti mostrerà");
    await p.getByTestId("salvati-mostra").click(); await p.getByTestId("salvati-foglio").waitFor({ state: "detached", timeout: 3000 });
    ok((await p.getByTestId("salvati-filtri-attivi").textContent()) === "1" && (await p.locator("ul.snap-x li").count()) === 1 && await p.getByTestId("salvati-attivi").getByRole("button", { name: "Togli 📌 Voglio andarci" }).isVisible(), "salvati: 'Filtri' mostra 1 filtro acceso e il filtro resta in vista");
    ok((await p.locator("ul.snap-x li").first().getByTestId("stato-card").textContent()) === "📌 Voglio andarci", "card salvato: lo stato in alto ('📌 Voglio andarci')");
    await p.getByTestId("salvati-attivi").getByRole("button", { name: "Togli 📌 Voglio andarci" }).click();
    ok((await p.locator("ul.snap-x li").count()) === 3 && (await p.getByTestId("salvati-filtri-attivi").count()) === 0, "salvati: un tocco sul filtro acceso lo toglie"); }
  await p.getByTestId("salvati-apri-filtri").click(); await p.getByTestId("salvati-foglio").waitFor({ timeout: 3000 });
  await p.getByTestId("salvati-tipo").click();
  await p.getByRole("button", { name: "Ristoranti" }).click();
  await p.getByRole("button", { name: /Applica filtri/ }).click();
  await p.waitForTimeout(500);
  ok((await p.locator("ul.snap-x li").count()) >= 1, "salvati + filtri: dopo 'Applica filtri' la lista resta aperta");
  ok((await p.locator("ul.snap-x li").count()) === 1 && await p.locator("ul.snap-x").getByText("Osteria Due").isVisible(), "salvati + filtri: 'Ristoranti' tiene solo i ristoranti salvati");
  await p.locator("ul.snap-x").getByText("Osteria Due").click();
  ok(await p.getByTestId("verdetto-in-arrivo").waitFor({ timeout: 3000 }).then(() => true, () => false), "salvato senza verdetto: mentre arriva, la scheda dice 'Lo sto scrivendo dalle recensioni…'");
  await p.getByText("Cacio e pepe da manuale, sala piccola e rumorosa.").first().waitFor({ timeout: 8000 }).catch(() => {});
  ok(await p.getByText("Cacio e pepe da manuale, sala piccola e rumorosa.").first().isVisible() && verdettoChiesti.length === 1 && verdettoChiesti[0] === "G2", `salvato senza verdetto: aprendo la scheda arriva il verdetto Mapetite (chiesto ${verdettoChiesti.length} volta, per ${verdettoChiesti[0]})`);
  await p.screenshot({ path: `${OUT}/11f-salvato-verdetto-nuovo.png`, caret: "initial" });
  await p.keyboard.press("Escape");
  await p.waitForTimeout(300);
  await p.getByTestId("salvati-apri-filtri").click(); await p.getByTestId("salvati-foglio").waitFor({ timeout: 3000 });
  await p.getByTestId("salvati-tipo").click();
  await p.getByRole("button", { name: "Ristoranti" }).click();
  await p.getByRole("button", { name: "Caffè e Bar" }).click();
  await p.getByRole("button", { name: /Applica filtri/ }).click();
  await p.waitForTimeout(500);
  ok((await p.locator("ul.snap-x").getByText("Caffè Milano").count()) === 1 && (await p.locator("ul.snap-x").getByText("Osteria Due").count()) === 0, "salvati + filtri: 'Caffè e Bar' trova il caffè salvato (tipi Google, non testo)");
  await p.getByTestId("salvati-apri-filtri").click(); await p.getByTestId("salvati-foglio").waitFor({ timeout: 3000 });
  await p.getByTestId("salvati-tipo").click();
  await p.getByRole("button", { name: "Azzera" }).click();
  await p.getByRole("button", { name: /Applica filtri/ }).click();
  await vaiSalvati(p);
  await p.getByTestId("salvati-filtri").waitFor({ timeout: 5000 });
  await p.getByTestId("salvati-apri-filtri").click(); await p.getByTestId("salvati-foglio").waitFor({ timeout: 3000 });
  ok(await p.getByTestId("salvati-foglio").getByRole("button", { name: "📍 Milano · 1" }).isVisible(), "città: chip Milano · 1");
  await p.getByTestId("salvati-mostra").click(); await p.getByTestId("salvati-foglio").waitFor({ state: "detached", timeout: 3000 });
  ok((await p.locator("ul.snap-x li").count()) === 3, "tutti i salvati in lista (3)");
  // Semplificare 5 (17/10): intestazione dei salvati corta, Condividi come icona e niente "3 posti" ripetuto.
  { const sh = p.getByTestId("condividi-lista"); const bb = await sh.boundingBox();
    ok((await sh.getAttribute("aria-label")) === "Condividi questa lista" && !((await sh.textContent()) ?? "").includes("Condividi") && !!bb && bb.width <= 40, `salvati: 'Condividi' è un'icona (${Math.round(bb?.width ?? 0)}px)`);
    ok(((await p.getByTestId("conteggio-risultati").boundingBox())?.width ?? 0) <= 1 && ((await p.getByLabel("Cerca tra i salvati").getAttribute("placeholder").catch(() => "")) ?? "").includes("3"), "salvati: il numero sta solo in 'Cerca in N salvati'"); }
  await p.evaluate(() => { window.__sharedList = null; navigator.share = async (d) => { window.__sharedList = d; }; });
  await p.getByTestId("condividi-lista").click();
  { const t = await p.evaluate(() => window.__sharedList?.text ?? "");
    ok(t.startsWith("I miei posti su Mapetite") && t.includes("• Terrazza Uno") && !t.includes("Tavolo sulla terrazza") && t.includes("query_place_id=G1") && (t.match(/• /g) ?? []).length === 3, "salvati: 'Condividi' manda la lista con i link Google Maps, senza le note private"); }
  { const card = p.locator("ul.snap-x li").filter({ hasText: "Terrazza Uno" });
    ok(await card.getByText("Aperitivo lento sui tetti, lontano dalla folla.").isVisible(), "salvati: la card mostra il verdetto Mapetite già in cache");
    ok((await card.textContent()).includes("€€ · Roma"), "salvati: la card dice la città (salvati di più città)");
    await card.scrollIntoViewIfNeeded();
    await p.waitForTimeout(600);
    await p.screenshot({ path: `${OUT}/11b-salvati-verdetto.png`, caret: "initial" });
    // Dopo una ricerca, tornando ai salvati il verdetto c'è ancora (la ricerca non lo cancella).
    await vaiEsplora(p);
    await (await esempio(p)).click();
    await p.getByTestId("titolo-risposta").waitFor({ timeout: 5000 });
    await vaiSalvati(p);
    await p.getByTestId("salvati-filtri").waitFor({ timeout: 5000 });
    const again = p.locator("ul.snap-x li").filter({ hasText: "Terrazza Uno" });
    ok(await again.getByText("Aperitivo lento sui tetti, lontano dalla folla.").isVisible({ timeout: 3000 }).catch(() => false), "salvati: il verdetto resta anche dopo una ricerca"); }
  await p.screenshot({ path: `${OUT}/11-salvati.png`, caret: "initial" });
  await p.getByTestId("salvati-apri-filtri").click(); await p.getByTestId("salvati-foglio").waitFor({ timeout: 3000 });
  await p.getByRole("button", { name: "📍 Milano · 1" }).click();
  await p.getByTestId("salvati-mostra").click(); await p.getByTestId("salvati-foglio").waitFor({ state: "detached", timeout: 3000 });
  ok((await p.locator("ul.snap-x li").count()) === 1 && await p.locator("ul.snap-x").getByText("Caffè Milano").isVisible(), "filtro Milano: solo Caffè Milano");
  ok((await p.getByTestId("intestazione-lista").textContent()) === "I tuoi salvati · Milano", "salvati: intestazione 'I tuoi salvati · Milano'");
  ok(!(await p.locator("ul.snap-x li").first().textContent()).includes("· Milano"), "filtro Milano: la città non si ripete sulla card (è già nel titolo)");
  ok((await p.getByRole("button", { name: "Aperto ora" }).count()) === 0 && (await p.getByRole("button", { name: "Voto 4,5+" }).count()) === 0, "salvati: niente filtri rapidi (mancano orari e voti)");
  // L'animazione della mappa può durare un po' (di più se la macchina è carica): si aspetta fino a 8 s.
  let pin = null;
  for (let t = 0; t < 16; t++) {
    await p.waitForTimeout(500);
    // Con un solo salvato mostrato c'è un solo pin (il nome compare solo da vicino).
    pin = await p.getByTestId("pin").first().boundingBox({ timeout: 1000 }).catch(() => null);
    if (pin && pin.y > 200 && pin.y < 844 * 0.6 && pin.x > 0 && pin.x < 390) break;
  }
  ok(!!pin && pin.y > 200 && pin.y < 844 * 0.6 && pin.x > 0 && pin.x < 390, `filtro Milano: la mappa si sposta su Milano (pin visibile${pin ? "" : ", nessun pin"}${pin && !(pin.y > 200 && pin.y < 844 * 0.6 && pin.x > 0 && pin.x < 390) ? ` ma a ${Math.round(pin.x)},${Math.round(pin.y)}` : ""})`);
  await p.screenshot({ path: `${OUT}/13-salvati-milano.png`, caret: "initial" });
  await p.getByTestId("salvati-attivi").getByRole("button", { name: "Togli Milano" }).click();
  await p.getByLabel("Cerca tra i salvati").fill("terrazza");
  ok((await p.locator("ul.snap-x li").count()) === 1 && await p.locator("ul.snap-x").getByText("Terrazza Uno").isVisible(), "ricerca 'terrazza': solo Terrazza Uno");
  ok(await p.locator("ul.snap-x").getByText("“Tavolo sulla terrazza”").isVisible(), "card salvato: mostra la nota");
  ok(await p.locator("ul.snap-x li").first().getByText(/★ 4,6 · €€/).isVisible(), "card salvato: voto e prezzo salvati");
  await p.screenshot({ path: `${OUT}/12-salvati-ricerca.png`, caret: "initial" });
  // Ricerca nei salvati come frase (4.5): parole di contorno ignorate, stato e città capiti.
  await p.getByLabel("Cerca tra i salvati").fill("quell'osteria che volevo provare a Roma");
  ok((await p.locator("ul.snap-x li").count()) === 1 && await p.locator("ul.snap-x").getByText("Osteria Due").isVisible(), "salvati come frase: 'quell'osteria che volevo provare a Roma' → Osteria Due");
  await p.getByLabel("Cerca tra i salvati").fill("il caffè di Milano per il brunch");
  ok((await p.locator("ul.snap-x li").count()) === 1 && await p.locator("ul.snap-x").getByText("Caffè Milano").isVisible(), "salvati come frase: 'il caffè di Milano per il brunch' → Caffè Milano (dalla nota)");
  await p.screenshot({ path: `${OUT}/12b-salvati-frase.png`, caret: "initial" });
  await p.getByLabel("Cerca tra i salvati").fill("sushi");
  ok(await p.getByText("Nessun salvato con questi filtri").isVisible(), "nessun risultato: messaggio chiaro");
  await p.getByTestId("salvati-apri-filtri").click(); await p.getByTestId("salvati-foglio").waitFor({ timeout: 3000 });
  ok((await p.getByRole("button", { name: "Più vicini" }).count()) === 0, "salvati: senza la tua posizione niente 'Più vicini'");
  await p.getByRole("button", { name: "Azzera filtri" }).click();
  await p.getByTestId("salvati-mostra").click(); await p.getByTestId("salvati-foglio").waitFor({ state: "detached", timeout: 3000 });
  ok((await p.getByLabel("Cerca tra i salvati").inputValue()) === "" && (await p.locator("ul.snap-x li").count()) === 3, "salvati: 'Azzera filtri' azzera anche il testo cercato");
  await sctx.grantPermissions(["geolocation"]);
  await sctx.setGeolocation({ latitude: 45.4642, longitude: 9.19 });
  await p.getByRole("button", { name: "La mia posizione", exact: true }).click();
  await p.waitForTimeout(500);
  await p.getByTestId("salvati-apri-filtri").click(); await p.getByTestId("salvati-foglio").waitFor({ timeout: 3000 });
  await p.getByTestId("salvati-foglio").getByRole("button", { name: "Più vicini" }).click({ timeout: 4000 });
  await p.getByTestId("salvati-mostra").click(); await p.getByTestId("salvati-foglio").waitFor({ state: "detached", timeout: 3000 });
  ok((await p.locator("ul.snap-x li").first().textContent())?.includes("Caffè Milano") && (await p.getByTestId("salvati-filtri-attivi").textContent()) === "1", "salvati: 'Più vicini' (nel foglio Filtri) mette prima il salvato più vicino a te (Milano)");
  await p.getByTestId("salvati-apri-filtri").click(); await p.getByTestId("salvati-foglio").waitFor({ timeout: 3000 });
  await p.getByRole("button", { name: "Azzera filtri" }).click();
  await p.getByTestId("salvati-mostra").click(); await p.getByTestId("salvati-foglio").waitFor({ state: "detached", timeout: 3000 });
  // Stato del salvato: "Ci sono stato" con un tocco nella scheda (tag esistente, nessuna migrazione)
  let patched = null;
  await p.route("**/rest/v1/saved_places**", (r) => {
    // Solo le scritture dei tag: dopo "Ci sono stato" la classifica (4.3) può scrivere a parte rank_score.
    if (r.request().method() === "PATCH") { const b = r.request().postDataJSON(); if (b?.tags) patched = b; return r.fulfill({ status: 204, body: "" }); }
    return r.fallback();
  });
  // Buoni pasto (PROPOSTE.md 19/10): la riga in scheda solo con almeno 2 risposte concordi; risposta nel diario.
  let buoniScritti = [];
  await p.route("**/rest/v1/rpc/buoni_pasto_conteggio**", (r) => r.fulfill({ json: [{ si: 3, no: 1 }] }));
  await p.route("**/api/places/visite**", (r) => r.fulfill({ json: { persone: 6, piaciuto: 5 } }));
  await p.route("**/rest/v1/buoni_pasto**", (r) => {
    if (r.request().method() === "POST") { buoniScritti.push(r.request().postDataJSON()); return r.fulfill({ status: 201, body: "" }); }
    if (r.request().method() === "DELETE") { buoniScritti.push("tolta"); return r.fulfill({ status: 204, body: "" }); }
    return r.fulfill({ json: [] });
  });
  await p.getByLabel("Cerca tra i salvati").fill("");
  await p.locator("ul.snap-x li").first().locator("button").last().click();
  await p.getByTestId("stato-salvato").waitFor({ timeout: 3000 });
  ok(await p.getByTestId("buoni-pasto").waitFor({ timeout: 4000 }).then(async () => (await p.getByTestId("buoni-pasto").textContent())?.includes("Buoni pasto: sì · 3 persone"), () => false), "buoni pasto: riga in scheda quando almeno 2 persone concordano");
  { const t = await p.getByTestId("visite-mapetite").waitFor({ timeout: 6000 }).then(async () => (await p.getByTestId("visite-mapetite").textContent()) ?? "", () => "(assente)");
    ok(t.includes("👍 5 su 6 · chi c'è stato"), `scheda: chi ci è stato su Mapetite e com'era (${t})`); }
  await p.getByTestId("stato-salvato").getByRole("button", { name: "✓ Ci sono stato" }).click();
  // Diario (4.4): dopo "Ci sono stato" si apre il foglio "Com'è andata?", saltabile
  await p.getByTestId("diario-foglio").waitFor({ timeout: 5000 }).catch(() => {});
  ok(await p.getByTestId("diario-foglio").isVisible(), "diario: 'Ci sono stato' nella scheda apre il foglio 'Com'è andata?'");
  { const sb = p.getByTestId("diario-buoni");
    const vis = await sb.isVisible().catch(() => false);
    if (vis) { await sb.getByRole("button", { name: "Buoni pasto: Sì" }).click(); await p.waitForTimeout(400); }
    await p.getByTestId("diario-foglio").screenshot({ path: `${OUT}/51b-diario-buoni.png` }).catch(() => {});
    ok(vis && buoniScritti.some((b) => (Array.isArray(b) ? b[0] : b)?.accetta === true) && (await sb.getByRole("button", { name: "Buoni pasto: Sì" }).getAttribute("aria-pressed")) === "true", `buoni pasto: nel 'Com'è andata?' un tocco su Sì lo salva (${JSON.stringify(buoniScritti)})`); }
  await p.getByTestId("diario-salta").click().catch(() => {});
  await p.waitForTimeout(500);
  ok(JSON.stringify(patched?.tags ?? []).includes("Già visitato") && (await p.getByTestId("stato-salvato").getByRole("button", { name: "✓ Ci sono stato" }).getAttribute("aria-pressed")) === "true", "scheda salvato: 'Ci sono stato' con un tocco");
  // "Com'era?" compare dopo "Ci sono stato": 👍 / 👎 si escludono, gli altri tag restano
  await p.getByTestId("com-era").waitFor({ timeout: 3000 }).then(async () => {
    await p.getByTestId("com-era").getByRole("button", { name: "👍 Mi è piaciuto" }).click();
    await p.waitForTimeout(400);
    const t1 = patched?.tags ?? [];
    { const rg = p.getByTestId("recensione-google");
      const href = (await rg.count()) ? (await rg.getAttribute("href")) ?? "" : "";
      ok(href.startsWith("https://search.google.com/local/writereview?placeid=") && (await rg.getAttribute("target")) === "_blank", `dopo 👍: 'Aiuta il locale: lascia due righe su Google' con il link ufficiale (${href || "assente"})`); }
    await p.getByTestId("com-era").getByRole("button", { name: "👎 Non fa per me" }).click();
    await p.waitForTimeout(400);
    const t2 = patched?.tags ?? [];
    ok(t1.includes("Mi è piaciuto") && t1.includes("Già visitato") && t2.includes("Non fa per me") && !t2.includes("Mi è piaciuto") && t2.includes("Già visitato"), `com'era: 👍/👎 si escludono e lo stato resta (${JSON.stringify(t2)})`);
    // Ripensamento: "Voglio andarci" dopo un 👎 toglie anche il 👎 (altrimenti resterebbe nascosto e fuori da Stasera)
    await p.getByTestId("stato-salvato").getByRole("button", { name: "📌 Voglio andarci" }).click();
    await p.waitForTimeout(400);
    const t3 = patched?.tags ?? [];
    ok(t3.includes("Da provare") && !t3.includes("Già visitato") && !t3.includes("Non fa per me"), `com'era: tornando a 'Voglio andarci' il 👎 va via (${JSON.stringify(t3)})`);
    await p.getByTestId("stato-salvato").getByRole("button", { name: "✓ Ci sono stato" }).click();
    await p.getByTestId("diario-salta").click({ timeout: 5000 }).catch(() => {});
    await p.waitForTimeout(400);
  }, () => ok(false, "com'era: compare dopo 'Ci sono stato'"));
  await p.screenshot({ path: `${OUT}/13b-stato-salvato.png`, caret: "initial" });
  await p.keyboard.press("Escape");
  await p.unroute("**/rest/v1/saved_places**");
  // Esc può tornare indietro nella cronologia: si aspetta che finisca, altrimenti il goto sotto
  // veniva interrotto (ERR_ABORTED / timeout, visto anche sul codice di partenza il 15/10).
  await p.waitForLoadState("networkidle").catch(() => {});
  await p.waitForTimeout(500);

  // Scorciatoia dell'app: /mappa?vista=salvati apre subito i salvati
  await p.goto(`${BASE}/mappa?vista=salvati`, { waitUntil: "networkidle" });  await p.getByTestId("salvati-filtri").waitFor({ timeout: 5000 }).then(() => ok(true, "scorciatoia 'I miei salvati': apre subito i salvati"), () => ok(false, "scorciatoia 'I miei salvati': apre subito i salvati"));
  await p.waitForTimeout(300);
  ok(p.url().includes("vista=salvati") && (await p.locator("nav").first().getByRole("link", { name: "Salvati" }).getAttribute("aria-current")) === "page", "salvati aperti: 'Salvati' resta acceso nella barra in basso");
  await p.goto(`${BASE}/mappa?vista=salvati&stato=voglio`, { waitUntil: "networkidle" });
  await p.getByTestId("salvati-filtri").waitFor({ timeout: 5000 });
  ok(await p.getByTestId("salvati-attivi").getByRole("button", { name: "Togli 📌 Voglio andarci" }).isVisible() && (await p.locator("ul.snap-x li").count()) === 1 && !p.url().includes("stato="), "profilo → 'Voglio andarci': mappa sui soli salvati da provare");
  await p.getByTestId("salvati-apri-filtri").click(); await p.getByTestId("salvati-foglio").waitFor({ timeout: 3000 });
  ok((await p.getByTestId("salvati-foglio").getByRole("button", { name: /^📌 Voglio andarci/ }).getAttribute("aria-pressed")) === "true", "profilo → 'Voglio andarci': acceso anche nel foglio Filtri");
  await p.getByTestId("salvati-mostra").click(); await p.getByTestId("salvati-foglio").waitFor({ state: "detached", timeout: 3000 });
  await vaiEsplora(p);
  await p.waitForURL((u) => !u.search.includes("vista="), { timeout: 5000 }).catch(() => {});
  await p.waitForTimeout(300);
  ok(!p.url().includes("vista=") && (await p.locator("nav").first().getByRole("link", { name: "Mappa" }).getAttribute("aria-current")) === "page", "Esplora: torna accesa 'Mappa' nella barra in basso");
  await p.locator("nav").first().getByRole("link", { name: "Salvati" }).click();
  await p.getByTestId("salvati-filtri").waitFor({ timeout: 5000 }).then(() => ok(true, "già sulla mappa: 'Salvati' in basso apre i salvati"), () => ok(false, "già sulla mappa: 'Salvati' in basso apre i salvati"));
  // In sviluppo il pallino "N" di Next copre "Esplora": si tocca il link direttamente.
  await p.locator("nav").first().getByRole("link", { name: "Mappa" }).evaluate((a) => a.click());
  await p.getByTestId("salvati-filtri").waitFor({ state: "detached", timeout: 5000 }).then(() => ok(true, "'Esplora' in basso torna a Esplora"), () => ok(false, "'Esplora' in basso torna a Esplora"));
  { const m = await (await p.request.get(`${BASE}/manifest.webmanifest`)).json(); ok((m.shortcuts ?? []).length === 4, "app installata: 4 scorciatoie (Cerca, Salvati, Stasera, Filtri)"); ok((m.shortcuts ?? []).some((x) => x.url === "/stasera" && x.short_name === "Stasera"), "app installata: scorciatoia 'Stasera' → /stasera"); }

  // Voce 11c (?beta=pin-salvati, spenta di default): i salvati restano sulla mappa anche in Esplora
  // Lorenzo (14/10): i salvati NON compaiono sulla mappa generale, solo in "I miei salvati".
  await p.goto(`${BASE}/mappa`, { waitUntil: "networkidle" });
  await p.waitForTimeout(800);
  ok((await p.getByTestId("pin-salvato").count()) === 0, "pin dei salvati: spenti di default (i salvati solo in 'I miei salvati')");
  await p.goto(`${BASE}/mappa?beta=pin-salvati`, { waitUntil: "networkidle" });
  await p.getByTestId("pin-salvato").first().waitFor({ timeout: 5000 }).then(async () => {
    ok((await p.getByTestId("pin-salvato").count()) === rows.length, `pin dei salvati: ${await p.getByTestId("pin-salvato").count()} segnalibri sulla mappa in Esplora`);
    await p.screenshot({ path: `${OUT}/11c-pin-salvati.png`, caret: "initial" });
  }, () => ok(false, "pin dei salvati: segnalibri sulla mappa in Esplora"));
  await p.goto(`${BASE}/mappa?beta=off`, { waitUntil: "networkidle" });

  // "📌 A 100 m c'è X, che volevi provare" (14/10): toccando "La mia posizione" vicino a un "Voglio andarci"
  {
    await sctx.grantPermissions(["geolocation"]);
    await sctx.setGeolocation({ latitude: 41.8906, longitude: 12.4705 });
    await p.goto(`${BASE}/mappa`, { waitUntil: "networkidle" });
    // 18/10: con il permesso già dato l'avviso compare da solo all'apertura, senza toccare niente.
    { const t0 = await p.getByTestId("vicino-salvato").waitFor({ timeout: 5000 }).then(() => p.getByTestId("vicino-salvato").textContent(), () => "");
      ok((t0 ?? "").includes("Osteria Due"), `vicino a un salvato: all'apertura della mappa l'avviso compare da solo (${(t0 ?? "").slice(0, 60)})`); }
    await p.waitForTimeout(800);
    await p.getByRole("button", { name: "La mia posizione", exact: true }).click();
    const near = p.getByTestId("vicino-salvato");
    await near.waitFor({ timeout: 5000 }).catch(() => {});
    const t = (await near.textContent().catch(() => "")) ?? "";
    ok(t.includes("Osteria Due") && t.includes("che volevi provare") && !t.includes("Terrazza Uno"), `vicino a un salvato: avviso con il "Voglio andarci" a due passi (${t.slice(0, 70)})`);
    await p.screenshot({ path: `${OUT}/11d-vicino-salvato.png`, caret: "initial" });
    await near.getByRole("button", { name: "Apri" }).click().catch(() => {});
    await p.waitForTimeout(1200);
    ok(await p.getByRole("heading", { name: "Osteria Due" }).first().isVisible().catch(() => false), "vicino a un salvato: 'Apri' apre la sua scheda");
    await sctx.clearPermissions();
  }

  // Quota Google finita (18/10): il messaggio offre subito i propri salvati.
  {
    await p.route("**/api/search", (r) => r.fulfill({ status: 503, json: { error: "Le ricerche nuove sono finite per ora: ripartono alle 9:00. Intanto puoi cercare tra i tuoi salvati." } }));
    await p.goto(`${BASE}/mappa`, { waitUntil: "networkidle" });
    await p.waitForTimeout(800);
    await p.getByLabel("Cosa cerchi?").fill("aperitivo a Monti");
    await p.getByLabel("Cosa cerchi?").press("Enter");
    const btn = p.getByTestId("errore-salvati");
    ok(await btn.waitFor({ timeout: 5000 }).then(() => true, () => false) && /Cerca nei tuoi \d+ salvati/.test((await btn.textContent()) ?? ""), `quota finita: accanto al messaggio 'Cerca nei tuoi salvati' (${await btn.textContent().catch(() => "")})`);
    ok(!(await p.getByText("Premi Invio per cercare nuovi posti con l'AI.").isVisible().catch(() => false)), "quota finita: niente 'Premi Invio per cercare nuovi posti'");
    await p.screenshot({ path: `${OUT}/25b-quota-finita.png`, caret: "initial" });
    await btn.click().catch(() => {});
    ok(await p.getByTestId("salvati-filtri").waitFor({ timeout: 5000 }).then(() => true, () => false), "quota finita: un tocco apre i salvati");
    await p.unroute("**/api/search");
  }

  // "Fatti suggerire": con 3 salvati di cui 2 bar a Roma compare "✨ Dai tuoi salvati: Bar a Roma, fuori dai soliti giri"
  {
    const rows3 = [rows[0], { ...rows[1], places: { ...rows[1].places, category: "bar" } }, rows[2]];
    const p3s = await sctx.newPage();
    await p3s.route("**/rest/v1/saved_places**", (r) => r.request().url().includes("select=place_id") ? r.fulfill({ json: rows3.map((x) => ({ place_id: x.places.id })) }) : r.fulfill({ json: rows3 }));
    await p3s.goto(`${BASE}/mappa`, { waitUntil: "networkidle" });
    await p3s.getByTestId("suggerimento-salvati").waitFor({ state: "attached", timeout: 5000 }).then(async () => {
      ok((await p3s.getByTestId("suggerimento-salvati").getAttribute("aria-label")) === "✨ Dai tuoi salvati: Bar a Roma, fuori dai soliti giri", "fatti suggerire: proposta dal tipo e dalla città dei tuoi salvati");
    }, () => ok(false, "fatti suggerire: proposta dal tipo e dalla città dei tuoi salvati"));
    await p3s.close();
    ok((await p.getByTestId("suggerimento-salvati").count()) === 0, "fatti suggerire: niente proposta se i salvati sono tutti di tipo diverso");
  }

  // Voce 11d: scrivendo nella barra compaiono prima i propri salvati che c'entrano
  await p.goto(`${BASE}/mappa`, { waitUntil: "networkidle" });
  await p.getByLabel("Cosa cerchi?").fill("una terrazza per stasera");
  await p.getByTestId("nei-salvati").waitFor({ timeout: 4000 }).then(async () => {
    ok(await p.getByTestId("nei-salvati").getByText("Terrazza Uno").isVisible() && (await p.getByTestId("nei-salvati").locator("button").count()) === 1, "barra: scrivendo 'terrazza' compare 'Nei tuoi salvati: Terrazza Uno'");
    await p.screenshot({ path: `${OUT}/11d-nei-salvati.png`, caret: "initial" });
    await p.getByTestId("nei-salvati").getByText("Terrazza Uno").click();
    await p.getByTestId("stato-salvato").waitFor({ timeout: 4000 }).then(() => ok(true, "'Nei tuoi salvati': un tocco apre la sua scheda"), () => ok(false, "'Nei tuoi salvati': un tocco apre la sua scheda"));
  }, () => ok(false, "barra: scrivendo 'terrazza' compare 'Nei tuoi salvati: Terrazza Uno'"));
  await p.keyboard.press("Escape");

  // "Per te" dai salvati: un risultato dello stesso tipo e prezzo di un salvato lo dice sulla card
  await p.route("**/api/search/synthesis", (r) => r.fulfill({ json: { dettagli: {}, esclusi: [] } }));
  await p.goto(`${BASE}/mappa`, { waitUntil: "networkidle" });
  await (await esempio(p)).click();
  await p.locator("ul.snap-x li[data-id=P2]").waitFor({ timeout: 5000 });
  ok((await p.locator("ul.snap-x li[data-id=P2]").getByTestId("simile-a").textContent()) === "✨ Come Terrazza Uno, che hai salvato", "per te: 'Come Terrazza Uno, che hai salvato' su un bar simile");
  ok((await p.locator("ul.snap-x li[data-id=P3]").getByTestId("simile-a").count()) === 0, "per te: niente indicazione se il tipo è diverso (cocktail bar)");
  await p.screenshot({ path: `${OUT}/28-per-te-simile.png`, caret: "initial" });
  await p.unroute("**/api/search/synthesis");

  // Dal profilo: /mappa?salvato=UUID apre la scheda di quel salvato
  await p.goto(`${BASE}/mappa?salvato=00000000-0000-4000-8000-000000000001`, { waitUntil: "networkidle" });
  await p.getByTestId("stato-salvato").waitFor({ timeout: 5000 }).then(async () => {
    ok(await p.getByText("Terrazza Uno").last().isVisible() && !p.url().includes("salvato="), "profilo → mappa: il salvato toccato si apre nella sua scheda");
  }, () => ok(false, "profilo → mappa: il salvato toccato si apre nella sua scheda"));
  await p.keyboard.press("Escape");

  // Profilo come "la mia guida" (voce 11e). Il profilo legge Supabase dal server: in sviluppo con
  // E2E_FAKE_USER prende i dati finti dal cookie "e2e_profilo".
  {
    const pr = (id, name, category, address) => ({ id: `00000000-0000-4000-8000-0000000001${id}`, name, category, address });
    const profilo = {
      email: "giulia@example.com",
      saved: [
        { created_at: "2026-10-10", tags: ["Romantico", "Da provare"], note: "Tavolo in terrazza al tramonto", places: pr("01", "Terrazza Uno", "bar", "Via Po, 2/a, 00198 Roma RM, Italy") },
        { created_at: "2026-10-09", tags: ["Con amici", "Già visitato"], note: null, places: pr("02", "Osteria Due", "restaurant", "Via dei Vascellari 29, Roma") },
        { created_at: "2026-10-08", tags: ["Romantico", "Speciale", "Da provare"], note: null, places: pr("03", "Enoteca Tre", "wine_bar", "Via del Governo Vecchio 12, 00186 Roma RM, Italy") },
        { created_at: "2026-10-07", tags: ["Con amici", "Economico"], note: "Pizza al taglio", places: pr("04", "Forno Quattro", "bakery", "Via Ostiense 50, Roma") },
        { created_at: "2026-09-20", tags: ["Da provare"], note: "Brunch domenica", places: pr("05", "Caffè Milano", "cafe", "Corso Monforte, 26, 20122 Milano MI, Italy") },
        { created_at: "2026-09-15", tags: ["Con amici", "Già visitato"], note: null, places: pr("06", "Birreria Sei", "bar", "Via Tortona 15, 20144 Milano MI, Italy") },
      ],
      reviews: [{ id: "r1", rating: 5, comment: "Vista bellissima, cocktail ottimi.", created_at: "2026-10-01", places: { name: "Terrazza Uno" } }],
    };
    await sctx.addCookies([{ name: "e2e_profilo", value: encodeURIComponent(JSON.stringify(profilo)), url: BASE }]);
    await p.goto(`${BASE}/profilo`, { waitUntil: "networkidle" });
    const guida = p.getByTestId("guida-contatori");
    if (!(await guida.isVisible())) ok(false, "profilo: numeri della guida in cima (Salvati · Voglio andarci · Ci sono stato)");
    else {
      const num = async (id) => (await p.getByTestId(`guida-${id}`).textContent())?.replace(/\D.*$/s, "");
      ok(await num("salvati") === "6" && await num("voglio") === "3" && await num("fatto") === "2" && (await guida.getByRole("link").count()) === 3, "profilo: tre numeri della guida giusti (6 salvati, 3 voglio andarci, 2 ci sono stato)");
      // Le mie cose (semplificazione 16/10): una griglia di tessere con il numero, ognuna porta alla sua pagina o sezione.
      const cose = p.getByTestId("profilo-mie-cose");
      // Semplificare 5 (17/10): la carta del gusto è una tessera, le liste di gruppo stanno solo in Amici.
      ok(await cose.isVisible() && (await cose.locator("a").count()) === 6 && (await cose.getByTestId("profilo-carta-gusto").getAttribute("href")) === "/profilo/gusto" && (await cose.getByTestId("profilo-gruppi").count()) === 0, `profilo: griglia 'Le mie cose' con 6 tessere, carta del gusto compresa, senza liste di gruppo (${await cose.locator("a").count()})`);
      ok((await cose.getByTestId("tessera-raccolte").getAttribute("href")) === "#raccolte" && (await cose.getByTestId("tessera-raccolte").textContent()).includes("4") && (await cose.getByTestId("profilo-diario").getAttribute("href")) === "/profilo/diario" && (await cose.getByTestId("profilo-prenotazioni").getAttribute("href")) === "/prenotazioni" && (await cose.getByTestId("profilo-importa").getAttribute("href")) === "/importa", "profilo: tessere Raccolte (4) · Diario · Prenotazioni · Importa con i loro ingressi");
      { const sz = await cose.locator("a").evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; })); ok(sz.every(([w, h]) => w >= 100 && h >= 88), `profilo: tessere grandi abbastanza per il pollice (${JSON.stringify(sz)})`); }
      await cose.getByTestId("tessera-raccolte").click();
      await p.waitForFunction(() => { const r = document.getElementById("raccolte")?.getBoundingClientRect(); return !!r && r.top < 120 && r.top > -20; }, null, { timeout: 3000 }).then(() => ok(true, "profilo: tessera 'Raccolte' porta alle raccolte"), () => ok(false, "profilo: tessera 'Raccolte' porta alle raccolte"));
      // Le cose secondarie stanno chiuse in "Altro": l'ingranaggio in alto ci porta.
      ok((await p.getByTestId("profilo-impostazioni").getAttribute("href")) === "#altro" && !(await p.getByTestId("invita-amico").isVisible()) && !(await p.getByTestId("cosa-so-di-te").isVisible()) && await p.getByTestId("profilo-premium").isVisible() && await p.getByTestId("profilo-ristoratori").isVisible(), "profilo: 'Altro' in fondo, chiuso (invito, profilo pubblico, gusti, ricerche) con Premium e ristoratori in elenco");
      await p.locator("#gusti > summary").click();
      ok(await p.getByTestId("cosa-so-di-te").isVisible(), "profilo: una riga di 'Altro' si apre al tocco (Cosa so di te)");
      ok(await p.getByTestId("guida-voglio").getAttribute("href") === "/mappa?vista=salvati&stato=voglio" && await p.getByTestId("guida-fatto").getAttribute("href") === "/mappa?vista=salvati&stato=fatto" && await p.getByTestId("guida-salvati").getAttribute("href") === "/mappa?vista=salvati", "profilo: ogni numero apre la mappa sui salvati filtrati");
      const raccolte = await p.getByTestId("raccolta").allTextContents();
      ok(raccolte.length === 4 && raccolte[0].includes("Con amici") && raccolte[0].includes("3 locali") && raccolte[1].includes("Romantico") && !raccolte.some((t) => /Da provare|Già visitato/.test(t)), `profilo: raccolte = tag dell'utente con il numero, senza i due stati (${raccolte.join(" | ")})`);
      ok(await p.getByTestId("raccolta").filter({ hasText: "Con amici" }).getAttribute("href") === "/raccolte/Con%20amici", "profilo: tocco su una cartella = pagina della raccolta (4.1)");
      ok(await p.getByTestId("profilo-importa").getAttribute("href") === "/importa", "profilo: '+ Importa locali' porta a /importa");
      // Semplificare 5 (17/10): niente doppioni dei Salvati nel profilo ("Stasera" e l'elenco stanno nella scheda Salvati).
      ok((await p.getByTestId("profilo-stasera").count()) === 0 && (await p.getByTestId("profilo-salvati").count()) === 0 && (await p.getByTestId("profilo-salvato-recente").count()) === 0, "profilo: niente card 'Stasera' né 'Ultimi salvati' (doppioni della scheda Salvati)");
      ok(await p.getByText("Vista bellissima, cocktail ottimi.").isVisible(), "profilo: le recensioni restano");
      ok(!(await p.content()).includes(", Italy<") , "profilo: indirizzi senza ', Italy' in fondo");
      await p.screenshot({ path: `${OUT}/27-profilo-guida.png`, caret: "initial" });
      if (process.env.PROFILO_SHOT) await p.screenshot({ path: process.env.PROFILO_SHOT, caret: "initial" });
      // "Ci sei stato?" (?beta=ci-sei-stato, spento di default): un "Voglio andarci" salvato da più di una settimana
      await p.goto(`${BASE}/profilo?beta=-ci-sei-stato`, { waitUntil: "networkidle" });
      ok((await p.getByTestId("ci-sei-stato").count()) === 0, "ci sei stato: si spegne con ?beta=-ci-sei-stato (acceso di default)");
      let visitPatch = null;
      await p.route("**/rest/v1/saved_places**", (r) => { if (r.request().method() === "PATCH") { visitPatch = { url: r.request().url(), body: r.request().postDataJSON() }; return r.fulfill({ status: 204, body: "" }); } return r.fallback(); });
      await p.goto(`${BASE}/profilo?beta=ci-sei-stato`, { waitUntil: "networkidle" });
      const box = p.getByTestId("ci-sei-stato");
      await box.waitFor({ timeout: 4000 }).catch(() => {});
      ok(await box.getByText("Caffè Milano").isVisible() && !(await box.textContent()).includes("Enoteca Tre"), "ci sei stato: propone il 'Voglio andarci' salvato da più di una settimana (non quelli recenti)");
      await p.screenshot({ path: `${OUT}/29-ci-sei-stato.png`, caret: "initial" });
      await box.getByRole("button", { name: "✓ Sì, ci sono stato" }).click();
      await box.getByText("✓ Segnato: sei stato da Caffè Milano.").waitFor({ timeout: 3000 }).catch(() => {});
      ok(JSON.stringify(visitPatch?.body?.tags) === '["Già visitato"]' && visitPatch.url.includes("place_id=eq.00000000-0000-4000-8000-000000000105"), "ci sei stato: 'Sì' lo segna '✓ Ci sono stato' (al posto di 'Voglio andarci')");
      await p.unroute("**/rest/v1/saved_places**");
      // Copertine delle raccolte (?beta=copertine, spenta di default): emoji e nomi dei locali al posto dell'iniziale
      await p.goto(`${BASE}/profilo?beta=-copertine`, { waitUntil: "networkidle" });
      ok((await p.getByTestId("raccolta-copertina").count()) === 0, "copertine: si spengono con ?beta=-copertine (resta l'iniziale; accese di default)");
      await p.goto(`${BASE}/profilo?beta=copertine`, { waitUntil: "networkidle" });
      const amici = p.getByTestId("raccolta").filter({ hasText: "Con amici" });
      await amici.getByTestId("raccolta-copertina").waitFor({ timeout: 4000 }).catch(() => {});
      const emojiAmici = (await amici.getByTestId("raccolta-copertina").locator("span").allTextContents()).length;
      const anteprima = (await amici.getByTestId("raccolta-anteprima").textContent().catch(() => "")) ?? "";
      ok(emojiAmici === 3 && anteprima.startsWith("3 locali · ") && anteprima.includes("Birreria Sei"), `copertine: 'Con amici' mostra 3 emoji e i nomi dei locali (${anteprima})`);
      const sovrapposte = await p.getByTestId("raccolta").evaluateAll((els) => els.some((el) => { const c = el.querySelector("[data-testid=raccolta-copertina]"); const m = el.parentElement?.querySelector("[data-testid=raccolta-menu]"); if (!c || !m) return false; const a = c.getBoundingClientRect(), b = m.getBoundingClientRect(); return a.right > b.left && a.left < b.right && a.bottom > b.top && a.top < b.bottom; }));
      ok(!sovrapposte, "copertine: le emoji non finiscono sotto il pulsante ⋯");
      await p.screenshot({ path: `${OUT}/27b-profilo-copertine.png`, caret: "initial" });
      // Home: striscia "I tuoi posti" (mockup A): emoji degli ultimi salvati, totale, da provare, "Stasera?".
      await p.evaluate(() => { try { localStorage.setItem("mapetite.intro", "visto"); } catch { /* niente */ } });
      await p.goto(`${BASE}/`, { waitUntil: "networkidle" });
      const hs = p.getByTestId("home-salvati");
      await hs.waitFor({ timeout: 4000 }).catch(() => {});
      ok(await hs.isVisible() && (await hs.getByTestId("home-salvati-tutti").textContent())?.includes("I tuoi posti · 6") && (await hs.getByTestId("home-salvati-tutti").textContent())?.includes("3 da provare") && await hs.getByTestId("home-salvati-stasera").getAttribute("href") === "/stasera" && await hs.getByTestId("home-salvati-tutti").getAttribute("href") === "/mappa?vista=salvati", "home: 'I tuoi posti · 6', '3 da provare' e 'Stasera?'");
      await p.screenshot({ path: `${OUT}/00c-home-salvati.png`, caret: "initial" });
      await p.evaluate(() => { try { const k = "mapetite.beta"; localStorage.setItem(k, (localStorage.getItem(k) ?? "").split(",").filter((f) => f !== "copertine" && f !== "home-salvati").join(",")); } catch { /* niente */ } });
      await p.goto(`${BASE}/profilo`, { waitUntil: "networkidle" });
      // Dal profilo, "Salvati" nella barra in basso apre la mappa sui salvati ed è accesa
      await p.locator("nav").first().getByRole("link", { name: "Salvati" }).click();
      await p.getByTestId("salvati-filtri").waitFor({ timeout: 5000 }).then(() => ok(true, "barra in basso: 'Salvati' apre la mappa sui propri salvati"), () => ok(false, "barra in basso: 'Salvati' apre la mappa sui propri salvati"));
    }
    // Gestione delle raccolte dal profilo: rinomina, unisci, elimina, nuova. Le scritture partono
    // dal browser (Supabase con la sessione dell'utente): si catturano i PATCH su saved_places.
    {
      await p.goto(`${BASE}/profilo`, { waitUntil: "networkidle" });
      let patches = [];
      let patchFail = false;
      // Tag "freschi" dal database (letti prima di ogni scrittura): per simulare "Ci sei stato?" fatto dopo il caricamento.
      let freshTags = {};
      await p.route("**/rest/v1/saved_places**", (r) => {
        if (r.request().method() === "GET") {
          const pid = new URL(r.request().url()).searchParams.get("place_id")?.replace(/^eq\./, "");
          if (pid && freshTags[pid]) return r.fulfill({ json: { tags: freshTags[pid] } });
          return r.fallback();
        }
        if (r.request().method() !== "PATCH") return r.fallback();
        const u = new URL(r.request().url()).searchParams;
        patches.push({ id: u.get("place_id")?.replace(/^eq\./, ""), tags: r.request().postDataJSON()?.tags, user: u.get("user_id") });
        return patchFail ? r.fulfill({ status: 500, json: { message: "errore" } }) : r.fulfill({ status: 204, body: "" });
      });
      const sheet = p.getByTestId("raccolte-sheet");
      const tile = (name) => p.getByTestId("raccolta").filter({ hasText: name });
      const menu = async (name) => { await p.locator("li", { has: tile(name) }).getByTestId("raccolta-menu").click(); await sheet.waitFor({ timeout: 3000 }); };
      const id = (n) => `00000000-0000-4000-8000-0000000001${n}`;
      const has = (pt, n, tags) => pt.some((x) => x.id === id(n) && JSON.stringify(x.tags) === JSON.stringify(tags));
      const waitClosed = () => sheet.waitFor({ state: "detached", timeout: 5000 }).then(() => true, () => false);
      const errText = () => p.getByTestId("raccolte-errore").textContent({ timeout: 4000 }).catch(() => "");

      // Rinomina "Romantico" → "  cena   romantica " (normalizzato come "+ Nuovo tag")
      await menu("Romantico");
      ok(await sheet.getByRole("button", { name: /Rinomina/ }).isVisible() && await sheet.getByRole("button", { name: /Unisci con/ }).isVisible() && await sheet.getByRole("button", { name: /Elimina raccolta/ }).isVisible(), "raccolte: il ⋯ apre Rinomina / Unisci con… / Elimina raccolta");
      await p.screenshot({ path: `${OUT}/29-raccolte-gestione.png`, caret: "initial" });
      await sheet.getByRole("button", { name: /Rinomina/ }).click();
      await sheet.getByLabel("Nuovo nome").fill("da provare");
      await sheet.getByRole("button", { name: "Salva" }).click();
      ok(/stato del locale/.test((await errText()) ?? "") && patches.length === 0, "raccolte: non si può rinominare con il nome di uno stato (Da provare)");
      // Nel frattempo Terrazza Uno (01) è stata segnata "Ci sono stato" (es. da "Ci sei stato?"): la visita non si perde
      freshTags = { [id("01")]: ["Romantico", "Già visitato"] };
      await sheet.getByLabel("Nuovo nome").fill("  cena   romantica ");
      await sheet.getByRole("button", { name: "Salva" }).click();
      await waitClosed();
      freshTags = {};
      ok(patches.length === 2 && has(patches, "01", ["Cena romantica", "Già visitato"]) && has(patches, "03", ["Cena romantica", "Speciale", "Da provare"]) && patches.every((x) => x.user === "eq.00000000-0000-0000-0000-000000000001"), `raccolte: rinomina = un PATCH per salvato col nuovo nome, stati intatti anche se cambiati dopo il caricamento (${JSON.stringify(patches)})`);
      ok(await tile("Cena romantica").isVisible() && (await tile("Romantico").count()) === 0 && (await tile("Cena romantica").textContent()).includes("2 locali"), "raccolte: la raccolta rinominata compare subito col nuovo nome");

      // Unisci "Economico" con "Con amici"
      patches = [];
      await menu("Economico");
      await sheet.getByRole("button", { name: /Unisci con/ }).click();
      ok(!(await sheet.getByTestId("unisci-in").allTextContents()).some((t) => /Economico|Da provare|Già visitato/.test(t)), "raccolte: 'Unisci con…' propone solo le altre raccolte (niente stati)");
      await sheet.getByTestId("unisci-in").filter({ hasText: "Con amici" }).click();
      await waitClosed();
      ok(patches.length === 1 && has(patches, "04", ["Con amici"]) && (await tile("Economico").count()) === 0 && (await tile("Con amici").textContent()).includes("3 locali"), `raccolte: unisci Economico → Con amici (${JSON.stringify(patches)})`);

      // Elimina "Speciale": prima Annulla (nessuna scrittura), poi un errore di rete, poi conferma
      patches = [];
      await menu("Speciale");
      await sheet.getByRole("button", { name: /Elimina raccolta/ }).click();
      ok(await sheet.getByText("I locali restano tra i tuoi salvati", { exact: false }).isVisible(), "raccolte: elimina chiede conferma e spiega che i locali restano salvati");
      await sheet.getByRole("button", { name: "Annulla" }).click();
      ok(patches.length === 0 && await sheet.getByRole("button", { name: /Rinomina/ }).isVisible(), "raccolte: 'Annulla' non scrive niente");
      patchFail = true;
      await sheet.getByRole("button", { name: /Elimina raccolta/ }).click();
      await sheet.getByTestId("conferma-elimina").click();
      ok(/Non sono riuscito ad aggiornare 1 locale/.test((await errText()) ?? "") && await tile("Speciale").isVisible(), "raccolte: se il salvataggio fallisce, errore in italiano e raccolta intatta");
      patchFail = false;
      patches = [];
      await sheet.getByTestId("conferma-elimina").click();
      await waitClosed();
      ok(patches.length === 1 && has(patches, "03", ["Cena romantica", "Da provare"]) && (await tile("Speciale").count()) === 0, `raccolte: elimina toglie solo il tag, il locale resta salvato (${JSON.stringify(patches)})`);

      // Nuova raccolta con 2 locali scelti dalla lista (cercando "milano")
      patches = [];
      await p.getByTestId("nuova-raccolta").click();
      await sheet.getByLabel("Nome della raccolta").fill("weekend a Milano");
      ok((await sheet.getByText("📍 Roma · 4").count()) === 1 && (await sheet.getByText("📍 Milano · 2").count()) === 1, "nuova raccolta: salvati raggruppati per città");
      await sheet.getByLabel("Cerca tra i salvati").fill("milano");
      ok((await sheet.getByRole("checkbox").count()) === 2, "nuova raccolta: la ricerca filtra i salvati");
      await sheet.getByText("Caffè Milano").click();
      await sheet.getByText("Birreria Sei").click();
      ok((await sheet.getByTestId("crea-raccolta").textContent()) === "Crea raccolta · 2 locali", "nuova raccolta: il pulsante conta i locali scelti");
      await p.screenshot({ path: `${OUT}/30-nuova-raccolta.png`, caret: "initial" });
      await sheet.getByTestId("crea-raccolta").click();
      await waitClosed();
      ok(patches.length === 2 && has(patches, "05", ["Da provare", "Weekend a Milano"]) && has(patches, "06", ["Con amici", "Già visitato", "Weekend a Milano"]), `nuova raccolta: tag aggiunto ai 2 locali scelti (${JSON.stringify(patches)})`);
      ok(await tile("Weekend a Milano").isVisible() && (await tile("Weekend a Milano").getAttribute("href")) === "/raccolte/Weekend%20a%20Milano", "nuova raccolta: compare tra le raccolte e apre la sua pagina");
      await p.unroute("**/rest/v1/saved_places**");

      // "Le tue ricerche": le recenti salvate su questo telefono
      const ric = p.getByTestId("profilo-ricerche");
      await p.locator("#ricerche > summary").click();
      // (le ricerche fatte prima in questo giro restano sul "telefono": si parte da vuoto)
      await p.evaluate(() => { localStorage.removeItem("mapetite.recenti"); window.dispatchEvent(new Event("mapetite-recenti")); });
      ok(await ric.getByTestId("ricerche-vuote").isVisible(), "le tue ricerche: senza ricerche un invito spiega cosa compare qui");
      await p.evaluate(() => { localStorage.setItem("mapetite.recenti", JSON.stringify(["trattoria autentica non turistica", "cocktail bar con terrazza"])); window.dispatchEvent(new Event("mapetite-recenti")); });
      await ric.getByTestId("ricerca-recente").first().waitFor({ timeout: 3000 }).catch(() => {});
      const ricHrefs = await ric.getByTestId("ricerca-recente").evaluateAll((els) => els.map((e) => e.getAttribute("href")));
      ok(ricHrefs.length === 2 && ricHrefs[0] === "/mappa?q=trattoria%20autentica%20non%20turistica" && await ric.getByText("Cerca di nuovo").first().isVisible(), `le tue ricerche: elenco con 'Cerca di nuovo' che rifà la ricerca (${ricHrefs.join(" | ")})`);
      await p.locator("[data-testid=raccolte]").evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 16));
      await p.screenshot({ path: `${OUT}/31-raccolte-e-ricerche.png`, caret: "initial" });
      await ric.getByRole("button", { name: "Cancella le ricerche recenti" }).click();
      ok(await ric.getByTestId("ricerche-vuote").isVisible() && (await p.evaluate(() => localStorage.getItem("mapetite.recenti"))) === null, "le tue ricerche: 'Cancella' le toglie da questo telefono");
    }
    await sctx.clearCookies({ name: "e2e_profilo" });
  }

  // "Elimina il mio account" (in fondo al profilo): conferma in due passi. La route è SIMULATA
  // (page.route): nessuna cancellazione vera. Contesto a parte: l'eliminazione svuota il localStorage.
  {
    const ectx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    await ectx.route("**/api/places/photo**", (r) => r.fulfill({ status: 429, json: {} }));
    await ectx.addCookies([{ name: "e2e_profilo", value: encodeURIComponent(JSON.stringify({ email: "tester@example.com", saved: [], reviews: [] })), url: BASE }]);
    const ep = await ectx.newPage();
    ep.on("pageerror", (e) => errors.push(e.message));
    const delCalls = [];
    const evs = [];
    await ep.route("**/api/events", (r) => { try { evs.push(r.request().postDataJSON()); } catch { /* corpo non JSON */ } return r.fulfill({ json: { ok: true } }); });
    let delStatus = 500;
    await ep.route("**/api/account/elimina", (r) => { delCalls.push(r.request().method()); return r.fulfill({ status: delStatus, json: delStatus === 200 ? { ok: true } : { error: "Non sono riuscito a eliminare l'account. Riprova tra poco." } }); });
    await ep.goto(`${BASE}/profilo`, { waitUntil: "networkidle" });
    const btn = ep.getByTestId("elimina-account");
    const accBox = await ep.getByTestId("profilo-account").boundingBox();
    const btnBox = await btn.boundingBox();
    ok(await btn.isVisible() && (await btn.textContent()) === "Elimina il mio account" && !!accBox && !!btnBox && btnBox.y > accBox.y + accBox.height, "elimina account: 'Elimina il mio account' in fondo al profilo, sotto Feedback ed Esci");
    ok(btnBox && btnBox.height >= 44, `elimina account: pulsante alto almeno 44px (${Math.round(btnBox?.height ?? 0)})`);
    await btn.click();
    const foglio = ep.getByTestId("elimina-account-foglio");
    ok(await foglio.isVisible() && await foglio.getByRole("dialog", { name: "Eliminare il tuo account?" }).isVisible() && (await foglio.textContent()).includes("Non si può tornare indietro") && (await foglio.textContent()).includes("Le foto che hai caricato"), "elimina account: primo tocco = foglio che spiega cosa si cancella");
    ok(delCalls.length === 0 && (await foglio.locator("input").count()) === 0, "elimina account: il primo tocco non cancella niente e non chiede di digitare parole");
    await ep.waitForTimeout(300);
    await ep.screenshot({ path: `${OUT}/27c-elimina-account.png`, caret: "initial" });
    await foglio.getByTestId("elimina-account-annulla").click();
    ok(!(await foglio.isVisible()) && delCalls.length === 0, "elimina account: 'No, tienilo' chiude senza cancellare");
    // Errore dal server: messaggio chiaro, si resta nel profilo.
    await btn.click();
    await ep.getByTestId("elimina-account-conferma").click();
    await foglio.getByRole("alert").waitFor({ timeout: 4000 }).catch(() => {});
    ok(delCalls.length === 1 && delCalls[0] === "POST" && (await foglio.getByRole("alert").textContent())?.includes("Riprova") && ep.url().endsWith("/profilo"), "elimina account: se il server non riesce, lo dice e si resta nel profilo");
    // Riuscita: dati del telefono tolti, home con "Account eliminato".
    delStatus = 200;
    await ep.evaluate(() => { localStorage.setItem("mapetite.recenti", JSON.stringify(["prova"])); localStorage.setItem("mapetite.intro", "visto"); });
    await ep.getByTestId("elimina-account-conferma").click();
    await ep.waitForURL((u) => u.pathname === "/" && u.searchParams.get("account") === "eliminato", { timeout: 8000 }).catch(() => {});
    ok(delCalls.length === 2 && new URL(ep.url()).searchParams.get("account") === "eliminato" && await ep.getByTestId("account-eliminato").getByText("Account eliminato").isVisible(), "elimina account: secondo tocco = chiamata (simulata) e ritorno alla home con 'Account eliminato'");
    ok((await ep.evaluate(() => localStorage.getItem("mapetite.recenti"))) === null && (await ep.evaluate(() => localStorage.getItem("mapetite.intro"))) === "visto", "elimina account: tolte le ricerche dal telefono, l'intro già vista resta");
    ok(evs.some((e) => e?.type === "funzione" && e?.props?.nome === "elimina_account") && !JSON.stringify(evs.filter((e) => e?.props?.nome === "elimina_account")).includes("@"), "elimina account: segnale d'uso 'elimina_account' senza dati personali");
    await ep.screenshot({ path: `${OUT}/27d-account-eliminato.png`, caret: "initial" });
    await ectx.close();
  }

  // "Stasera dove andiamo?" (/stasera): tre proposte dai propri salvati. Supabase simulato dal browser.
  {
    const sp = (n, name, category, address, lat, lng, tags, note = null, gid = null) => ({ tags, note, places: { id: `00000000-0000-4000-8000-0000000002${n}`, name, category, address, lat, lng, google_place_id: gid ?? `GS${n}`, rating: 4.9, price_level: 2 } });
    const stRows = [
      sp("01", "Terrazza Uno", "bar", "Via Po, 2/a, 00198 Roma RM, Italy", 41.915, 12.497, ["Romantico", "Da provare"], "Tavolo in terrazza al tramonto", "G1"),
      sp("02", "Osteria Due", "restaurant", "Via dei Vascellari 29, Roma", 41.888, 12.477, ["Con amici", "Festa", "Già visitato"]),
      sp("03", "Enoteca Tre", "wine_bar", "Via del Governo Vecchio 12, 00186 Roma RM, Italy", 41.898, 12.47, ["Romantico", "Da provare"]),
      sp("04", "Forno Quattro", "bakery", "Via Ostiense 50, Roma", 41.87, 12.48, ["Con amici"]),
      sp("05", "Caffè Milano", "cafe", "Corso Monforte, 26, 20122 Milano MI, Italy", 45.468, 9.2, ["Da provare"], "Brunch domenica"),
      sp("06", "Birreria Sei", "bar", "Via Tortona 15, 20144 Milano MI, Italy", 45.45, 9.16, ["Con amici", "Già visitato"]),
      sp("07", "Pizzeria Sette", "pizza_restaurant", "Via Natale del Grande 15, 00153 Roma RM, Italy", 41.887, 12.469, ["Con amici", "Da provare"]),
      sp("08", "Sushi Otto", "sushi_restaurant", "Via Merulana 100, 00185 Roma RM, Italy", 41.894, 12.503, []),
    ];
    let stData = stRows;
    const stCtx = (opts = {}) => browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, ...opts }).then(async (c) => {
      await c.route("**/rest/v1/saved_places**", (r) => r.request().url().includes("select=place_id") ? r.fulfill({ json: stData.map((x) => ({ place_id: x.places.id })) }) : r.fulfill({ json: stData }));
      await c.route("**/rest/v1/place_synthesis**", (r) => r.fulfill({ json: [{ place_id: "G1", verdict: "Vista vera sui tetti, cocktail fatti con cura." }] }));
      await c.route("**/rest/v1/profiles**", (r) => r.fulfill({ json: [] }));
      await c.route("**/api/places/photo**", (r) => r.fulfill({ status: 429, json: {} }));
      await c.route("**/api/events", (r) => r.fulfill({ status: 204, body: "" }));
      return c;
    });
    const stc = await stCtx();
    const sq = await stc.newPage();
    sq.on("pageerror", (e) => errors.push(e.message));
    await sq.goto(`${BASE}/stasera`, { waitUntil: "networkidle" });
    await sq.getByTestId("stasera-proponi").waitFor({ timeout: 6000 }).catch(() => {});
    ok(await sq.getByRole("heading", { name: "Stasera dove andiamo?" }).isVisible(), "stasera: la domanda grande 'Stasera dove andiamo?'");
    const occ = await sq.getByTestId("stasera-occasione").getByRole("button").allTextContents();
    ok(occ[0] === "Qualsiasi" && occ[1] === "Con amici" && occ.includes("Romantico") && occ.includes("Festa") && !occ.some((t) => /Da provare|Già visitato/.test(t)), `stasera: occasioni = le raccolte dell'utente + Qualsiasi (${occ.join(" | ")})`);
    ok((await sq.getByTestId("stasera-novita").getByRole("button", { name: "📌 Mai provati" }).getAttribute("aria-pressed")) === "true" && (await sq.getByTestId("stasera-distanza").getByRole("button", { name: "Ovunque" }).getAttribute("aria-pressed")) === "true", "stasera: di partenza 'Mai provati' e 'Ovunque'");
    ok((await sq.getByTestId("stasera-conteggio").textContent())?.startsWith("6 salvati"), `stasera: conteggio dei salvati che rispettano le scelte (${await sq.getByTestId("stasera-conteggio").textContent()})`);
    await sq.screenshot({ path: `${OUT}/40-stasera-scelte.png`, caret: "initial" });
    // Città dei salvati come scelta rapida (più di una città): Roma = 5 mai provati
    const dove = await sq.getByTestId("stasera-distanza").getByRole("button").allTextContents();
    ok(dove.join("|") === "📍 Vicino a me|Roma|Milano|Ovunque", `stasera: 'Dove?' con le città dei salvati (${dove.join(" | ")})`);
    await sq.getByTestId("stasera-distanza").getByRole("button", { name: "Roma" }).click();
    ok((await sq.getByTestId("stasera-conteggio").textContent())?.startsWith("5 salvati"), "stasera: 'Roma' tiene solo i salvati di Roma");
    await sq.getByTestId("stasera-distanza").getByRole("button", { name: "Ovunque" }).click();
    // Romantico: 2 posti
    await sq.getByTestId("stasera-occasione").getByRole("button", { name: "Romantico" }).click();
    ok((await sq.getByTestId("stasera-proponi").textContent()) === "Proponimi i 2 posti", "stasera: con 'Romantico' restano 2 posti");
    // Festa + Mai provati: nessuno → si allarga con un tocco
    await sq.getByTestId("stasera-occasione").getByRole("button", { name: "Festa" }).click();
    ok(await sq.getByTestId("stasera-nessuno").isVisible() && (await sq.getByTestId("stasera-proponi").count()) === 0, "stasera: nessun salvato con queste scelte → avviso, niente pulsante");
    await sq.getByTestId("stasera-allarga").filter({ hasText: "Anche già visitati" }).click();
    ok((await sq.getByTestId("stasera-conteggio").textContent())?.startsWith("1 salvato") && (await sq.getByTestId("stasera-novita").getByRole("button", { name: "Anche già visitati" }).getAttribute("aria-pressed")) === "true", "stasera: 'Anche già visitati' allarga con un tocco (1 salvato)");
    await sq.getByTestId("stasera-occasione").getByRole("button", { name: "Qualsiasi" }).click();
    await sq.getByTestId("stasera-novita").getByRole("button", { name: "📌 Mai provati" }).click();
    // Proposte: 3, tutte "Voglio andarci" (ce ne sono 4 su 6)
    await sq.getByTestId("stasera-proponi").click();
    await sq.getByTestId("stasera-proposta").first().waitFor({ timeout: 3000 }).catch(() => {});
    const first = await sq.getByTestId("stasera-proposta").evaluateAll((els) => els.map((e) => ({ id: e.getAttribute("data-id"), t: e.textContent })));
    ok(first.length === 3 && first.every((x) => x.t.includes("📌 Voglio andarci")), `stasera: 3 proposte, prima i 'Voglio andarci' (${first.map((x) => x.t.slice(0, 18)).join(" | ")})`);
    ok(await sq.getByRole("heading", { name: "Ecco 3 idee per stasera" }).isVisible(), "stasera: titolo 'Ecco 3 idee per stasera'");
    const terr = sq.getByTestId("stasera-proposta").filter({ hasText: "Terrazza Uno" });
    if (await terr.count()) {
      ok(await terr.getByTestId("stasera-verdetto").getByText("Vista vera sui tetti, cocktail fatti con cura.").isVisible() && await terr.getByTestId("stasera-nota").getByText("“Tavolo in terrazza al tramonto”").isVisible() && await terr.getByText("Romantico").isVisible(), "stasera: card con nota tra virgolette, raccolte e verdetto in cache");
    }
    ok((await sq.getByTestId("stasera-verdetto").count()) <= 1, "stasera: verdetto solo dove c'è in cache (mai inventato)");
    const card0 = sq.getByTestId("stasera-proposta").first();
    ok(/^https:\/\/www\.google\.com\/maps\/dir\/\?api=1&destination=-?\d/.test((await card0.getByTestId("stasera-percorso").getAttribute("href")) ?? "") && (await card0.getByTestId("stasera-mappa").getAttribute("href")) === `/mappa?salvato=${first[0].id}`, "stasera: 'Percorso' apre Google Maps, il nome apre il salvato sulla mappa");
    ok((await card0.locator("a").count()) === 2, `stasera: un solo pulsante sotto la proposta (Percorso), il nome è il link alla mappa (${await card0.locator("a").count()} link)`);
    await sq.screenshot({ path: `${OUT}/41-stasera-proposte.png`, caret: "initial" });
    // Altri 3: niente ripetizioni finché ce ne sono; poi si ricomincia il giro
    await sq.getByTestId("stasera-altri").click();
    const second = await sq.getByTestId("stasera-proposta").evaluateAll((els) => els.map((e) => e.getAttribute("data-id")));
    ok(second.length === 3 && second.every((id) => !first.some((x) => x.id === id)), "stasera: 'Altri 3' propone posti diversi");
    ok((await sq.getByTestId("stasera-altri").count()) === 1, "stasera: 'Altri 3' resta disponibile");
    await sq.getByTestId("stasera-altri").click();
    ok(await sq.getByTestId("stasera-ricomincio").isVisible() && (await sq.getByTestId("stasera-proposta").count()) === 3, "stasera: visti tutti, 'Altri 3' ricomincia il giro");
    // Apri nella mappa: si apre la scheda del salvato
    const target = sq.getByTestId("stasera-proposta").first();
    const targetName = (await target.locator("h2").textContent()) ?? "";
    await target.getByTestId("stasera-mappa").click();
    await sq.getByTestId("stato-salvato").waitFor({ timeout: 8000 }).then(async () => {
      ok(await sq.getByText(targetName).last().isVisible(), `stasera → mappa: si apre la scheda di '${targetName}'`);
    }, () => ok(false, "stasera → mappa: si apre la scheda del salvato"));
    // Posizione negata (simulata: il permesso rifiutato dal telefono): si spiega e si resta su Ovunque
    await sq.addInitScript(() => { navigator.geolocation.getCurrentPosition = (_ok, err) => setTimeout(() => err({ code: 1, PERMISSION_DENIED: 1, message: "negata" }), 50); });
    await sq.goto(`${BASE}/stasera`, { waitUntil: "networkidle" });
    await sq.getByTestId("stasera-proponi").waitFor({ timeout: 6000 }).catch(() => {});
    await sq.getByTestId("stasera-distanza").getByRole("button", { name: "📍 Vicino a me" }).click();
    await sq.getByTestId("stasera-posizione-negata").waitFor({ timeout: 4000 }).then(async () => {
      ok((await sq.getByTestId("stasera-distanza").getByRole("button", { name: "Ovunque" }).getAttribute("aria-pressed")) === "true", "stasera: posizione negata → spiegazione e si cerca ovunque");
    }, () => ok(false, "stasera: posizione negata → spiegazione e si cerca ovunque"));
    await stc.close();

    // Posizione già permessa (Roma): "Vicino a me" si accende da solo, niente salvati di Milano, distanza sulla card
    const stg = await stCtx({ permissions: ["geolocation"], geolocation: { latitude: 41.9, longitude: 12.49 } });
    const sg = await stg.newPage();
    sg.on("pageerror", (e) => errors.push(e.message));
    await sg.goto(`${BASE}/stasera`, { waitUntil: "networkidle" });
    await sg.waitForFunction(() => document.querySelector("[data-testid=stasera-distanza] button[aria-pressed=true]")?.textContent?.includes("Vicino a me"), null, { timeout: 5000 }).catch(() => {});
    ok((await sg.getByTestId("stasera-distanza").getByRole("button", { name: "📍 Vicino a me" }).getAttribute("aria-pressed")) === "true", "stasera: posizione già permessa → 'Vicino a me' acceso");
    ok((await sg.getByTestId("stasera-conteggio").textContent())?.startsWith("5 salvati"), `stasera: vicino a me esclude i salvati di Milano (${await sg.getByTestId("stasera-conteggio").textContent()})`);
    await sg.getByTestId("stasera-proponi").click();
    const near = await sg.getByTestId("stasera-proposta").allTextContents();
    ok(near.length === 3 && !near.some((t) => t.includes("Caffè Milano")) && near.every((t) => / · a \d/.test(t)) && (await sg.getByTestId("stasera-riepilogo").textContent())?.includes("vicino a te"), "stasera: proposte vicine con la distanza sulla card");
    await stg.close();

    // Nessun salvato: invito a cercare o importare
    stData = [];
    const ste = await stCtx();
    const se = await ste.newPage();
    await se.goto(`${BASE}/stasera`, { waitUntil: "networkidle" });
    await se.getByTestId("stasera-vuoto").waitFor({ timeout: 5000 }).catch(() => {});
    ok(await se.getByTestId("stasera-vuoto").isVisible() && await se.getByRole("link", { name: "Cerca un locale" }).getAttribute("href") === "/mappa" && await se.getByRole("link", { name: "Importa i tuoi posti" }).getAttribute("href") === "/importa", "stasera: senza salvati invita a cercare o importare");
    // Senza accesso: invito ad accedere
    await ste.addCookies([{ name: "e2e_anonimo", value: "1", url: BASE }]);
    await se.goto(`${BASE}/stasera`, { waitUntil: "networkidle" });
    ok(await se.getByTestId("stasera-accedi").isVisible() && await se.getByRole("link", { name: "Accedi" }).first().getAttribute("href") === "/login?next=%2Fstasera" && await se.getByRole("link", { name: "Crea un account" }).getAttribute("href") === "/signup?next=%2Fstasera", "stasera: senza accesso invita ad accedere (e poi si torna a Stasera)");
    await ste.close();
    stData = stRows;
  }

  // "🎲 Scegli tu" (?beta=sorprendimi, spento di default): apre un salvato a caso, prima i "Voglio andarci"
  await p.goto(`${BASE}/mappa?beta=-sorprendimi`, { waitUntil: "networkidle" });
  await vaiSalvati(p);
  await p.waitForTimeout(800);
  await p.getByTestId("salvati-apri-filtri").click(); await p.getByTestId("salvati-foglio").waitFor({ timeout: 3000 });
  ok((await p.getByTestId("scegli-tu").count()) === 0, "scegli tu: si spegne con ?beta=-sorprendimi (acceso di default)");
  await p.goto(`${BASE}/mappa?beta=sorprendimi`, { waitUntil: "networkidle" });
  await vaiSalvati(p);
  await p.getByTestId("salvati-apri-filtri").click(); await p.getByTestId("salvati-foglio").waitFor({ timeout: 3000 });
  await p.getByTestId("scegli-tu").click();
  await p.getByTestId("stato-salvato").waitFor({ timeout: 3000 });
  ok(await p.getByText("Osteria Due").last().isVisible() && (await p.getByTestId("stato-salvato").getByRole("button", { name: "📌 Voglio andarci" }).getAttribute("aria-pressed")) === "true", "scegli tu: apre il salvato 'Voglio andarci'");
  await p.screenshot({ path: `${OUT}/26-scegli-tu.png`, caret: "initial" });
  await p.keyboard.press("Escape");
  await p.goto(`${BASE}/mappa?beta=off`, { waitUntil: "networkidle" });

  // Segnalibro sulla card (voce 11f): salva in un tocco come "Voglio andarci", poi "Aggiungi nota"
  let quickInsert = null;
  await p.route("**/api/places/add", (r) => r.fulfill({ json: { place: { id: "33333333-0000-4000-8000-000000000003" } } }));
  await p.route("**/rest/v1/saved_places**", (r) => { if (r.request().method() === "POST") { quickInsert = r.request().postDataJSON(); return r.fulfill({ status: 201, body: "" }); } return r.fallback(); });
  await p.goto(`${BASE}/mappa`, { waitUntil: "networkidle" });
  await (await esempio(p)).click();
  await p.getByRole("button", { name: "Salva Rooftop Tre" }).click();
  await p.getByTestId("salvato-avviso").waitFor({ timeout: 3000 }).then(() => ok(true, "segnalibro: salva in un tocco e dice 'Salvato'"), () => ok(false, "segnalibro: salva in un tocco e dice 'Salvato'"));
  ok(JSON.stringify(quickInsert?.tags) === '["Da provare"]' && quickInsert?.place_id === "33333333-0000-4000-8000-000000000003", "segnalibro: salvato come '📌 Voglio andarci' con l'UUID giusto");
  ok((await p.getByRole("button", { name: "Rooftop Tre è tra i salvati" }).getAttribute("aria-pressed")) === "true", "segnalibro: diventa pieno subito");
  ok((await p.locator("ul.snap-x li[data-id=P3]").getByTestId("etichetta-salvato").textContent()) === "📌 Voglio andarci", "card: un locale già salvato lo dice ('📌 Voglio andarci')");
  await p.screenshot({ path: `${OUT}/14a-salvato-un-tocco.png`, caret: "initial" });
  await p.getByTestId("salvato-avviso").getByRole("button", { name: "Aggiungi nota" }).click();
  await p.getByText("Modifica locale").waitFor({ timeout: 3000 });
  ok(true, "'Aggiungi nota': apre tag e nota del locale appena salvato");
  await p.unroute("**/api/places/add");
  await p.unroute("**/rest/v1/saved_places**");
  { const m = p.locator("div.w-80"); await m.getByRole("button", { name: "📌 Voglio andarci" }).click(); await m.getByRole("button", { name: "✓ Ci sono stato" }).click();
    ok((await m.getByRole("button", { name: "📌 Voglio andarci" }).getAttribute("aria-pressed")) === "false" && (await m.getByRole("button", { name: "✓ Ci sono stato" }).getAttribute("aria-pressed")) === "true", "salva: 'Voglio andarci' e 'Ci sono stato' con le parole della scheda, uno esclude l'altro"); }
  await p.screenshot({ path: `${OUT}/14-salva-da-card.png`, caret: "initial" });
  // Salva senza accesso: si va al login con il nome del locale, e dopo l'accesso si salva da solo.
  await p.route("**/api/places/add", (r) => r.fulfill({ json: { place: { id: "33333333-0000-4000-8000-000000000003" } } }));
  await p.route("**/rest/v1/saved_places**", (r) => { if (r.request().method() === "POST") { quickInsert = r.request().postDataJSON(); return r.fulfill({ status: 201, body: "" }); } return r.fallback(); });
  await sctx.addCookies([{ name: "e2e_anonimo", value: "1", url: BASE }]);
  await p.goto(`${BASE}/mappa`, { waitUntil: "networkidle" });
  await (await esempio(p)).click();
  await p.getByRole("button", { name: "Salva Terrazza Uno" }).click();
  await p.waitForURL(/\/login\?message=/, { timeout: 5000 });
  ok(await p.getByText("Accedi o registrati per salvare “Terrazza Uno”: lo aggiungo ai tuoi salvati appena entri.").isVisible(), "salva senza accesso: il login dice quale locale verrà salvato");
  await p.screenshot({ path: `${OUT}/14c-salva-senza-accesso.png`, caret: "initial" });
  await p.getByRole("link", { name: "Registrati" }).click();
  await p.getByTestId("salva-dopo-accesso").waitFor({ timeout: 4000 }).then(() => ok(true, "salva senza accesso: anche 'Registrati' ricorda quale locale verrà salvato"), () => ok(false, "salva senza accesso: anche 'Registrati' ricorda quale locale verrà salvato"));
  await sctx.clearCookies({ name: "e2e_anonimo" });
  quickInsert = null;
  await p.goto(`${BASE}/mappa`, { waitUntil: "networkidle" });
  await p.getByTestId("salvato-avviso").waitFor({ timeout: 5000 }).then(() => ok(true, "dopo l'accesso: il locale toccato prima si salva da solo ('Salvato')"), () => ok(false, "dopo l'accesso: il locale toccato prima si salva da solo ('Salvato')"));
  ok(quickInsert?.place_id === "33333333-0000-4000-8000-000000000003" && JSON.stringify(quickInsert?.tags) === '["Da provare"]', "dopo l'accesso: salvato come '📌 Voglio andarci'");
  ok((await p.getByTestId("salvato-avviso").textContent()).includes("Terrazza Uno"), "dopo l'accesso: l'avviso dice il nome del locale");
  quickInsert = null;
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForTimeout(800);
  ok(quickInsert === null, "dopo l'accesso: si salva una volta sola (ricaricare non lo rifà)");
  await sctx.close();

  // 9b. Salvare un locale da una ricerca (voce 9): Supabase e /api/places/add simulati, nessuna scrittura vera.
  const vctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const writes = [];
  let addMode = "error";
  const vAdds = [];
  await vctx.route("**/api/search", (r) => r.fulfill({ json: SEARCH_FAST }));
  await vctx.route("**/api/search/synthesis", (r) => r.fulfill({ json: SYNTH }));
  await vctx.route("**/api/places/photo**", (r) => r.fulfill({ status: 429, json: {} }));
  await vctx.route("**/api/places/add", (r) => (vAdds.push(r.request().postDataJSON()), addMode === "error")
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
  await (await esempio(v)).click();
  await v.getByText("Terrazza Uno").first().click();
  await v.getByTestId("barra-azioni").waitFor({ timeout: 4000 });
  // Semplificare (Lorenzo 17/10): locale non salvato, nessun "Voglio andarci" doppione accanto a "Salva" della barra.
  ok((await v.getByTestId("stato-rapido").count()) === 0 && (await v.getByTestId("stato-salvato").count()) === 0, "scheda non salvata: niente scelte di stato doppie (si salva dalla barra)");
  await v.locator("button:text-is('Salva')").first().click();
  const modal = v.locator("div.w-80");
  ok((await modal.getByRole("button", { name: "✓ Ci sono stato" }).getAttribute("aria-pressed")) === "false", "salva dal pulsante: nessuno stato rimasto dalla scelta annullata");
  await modal.getByText("Salva locale").waitFor({ timeout: 3000 });
  ok(true, "salva: si apre la finestra con tag e nota");
  await modal.getByRole("button", { name: "Romantico" }).click();
  await modal.getByTestId("nuovo-tag").click();
  await modal.getByLabel("Nuovo tag").fill("da rifare");
  await modal.locator("textarea").fill("Tavolo vicino alla ringhiera");
  await modal.getByRole("button", { name: "Salva", exact: true }).click();
  await modal.getByText("Errore durante il salvataggio. Riprova.").waitFor({ timeout: 3000 });
  ok(true, "salva: se il server non risponde, messaggio d'errore e la finestra resta aperta");
  addMode = "ok";
  await modal.getByRole("button", { name: "Salva", exact: true }).click();
  await v.locator("button:text-is('Salvato')").waitFor({ timeout: 4000 });
  ok(vAdds.length > 0 && vAdds.every((b) => b?.googlePlaceId === "P1" && b?.firma === "firma-P1"), "salva: /api/places/add riceve la firma del server sui dati Google del risultato");
  const ins = writes.find((w) => w.m === "POST");
  ok(!!ins && ins.body?.place_id === "11111111-2222-3333-4444-555555555555" && JSON.stringify(ins.body?.tags) === '["Romantico","Da rifare"]' && ins.body?.note === "Tavolo vicino alla ringhiera",
    "salva: scrive in saved_places l'UUID Supabase con tag (anche quello nuovo scritto a mano) e nota");
  ok(await v.getByText("Le tue note").isVisible() && await v.getByText("Tavolo vicino alla ringhiera").isVisible(), "salva: tag e nota compaiono subito nella scheda");
  ok(await v.locator("a[aria-label^='Indicazioni']").first().evaluate((a) => [a, ...a.querySelectorAll("span")].every((el) => el.scrollWidth <= el.clientWidth + 1)), "salvato: la scritta 'Percorso' non viene tagliata");
  await v.getByTestId("scheda-tab-info").click().catch(() => {});
  { const box = await v.locator("a[aria-label^='Sito di']").boundingBox(); ok(!!box && box.x + box.width <= 390, "salvato: il pulsante Sito resta nello schermo"); }
  await v.screenshot({ path: `${OUT}/17-salvato.png`, caret: "initial" });
  await v.locator("button:text-is('Salvato')").click();
  await v.locator("button:text-is('Salva')").first().waitFor({ timeout: 4000 });
  const del = writes.find((w) => w.m === "DELETE");
  ok(!!del && del.url.includes("place_id=eq.11111111-2222-3333-4444-555555555555"), "rimuovi: dopo la conferma cancella il salvato giusto e il pulsante torna 'Salva'");

  // 9c. Nuovo "Salva" stile Places (?beta=salva): foglio dal basso, Voglio andarci / Ci sono stato
  writes.length = 0;
  await v.goto(`${BASE}/mappa?beta=salva`, { waitUntil: "networkidle" });
  await (await esempio(v)).click();
  // Dalla scheda "Salva" apre il foglio (il segnalibro sulla card ora salva in un tocco).
  await apriCard(v, "Rooftop Tre");
  await v.locator("button:text-is('Salva')").first().click();
  const sheet = v.getByTestId("salva-foglio");
  await sheet.waitFor({ timeout: 3000 });
  ok((await sheet.getByRole("button", { name: "📌 Voglio andarci" }).getAttribute("aria-pressed")) === "true", "salva B: 'Voglio andarci' già scelto");
  const sb = await sheet.getByRole("button", { name: "Fatto" }).boundingBox();
  { const ab = await sheet.getByRole("button", { name: "Annulla" }).boundingBox(); ok(!!sb && !!ab && ab.y + ab.height <= 844 - 56, "salva B: 'Fatto' e 'Annulla' visibili sopra la barra in basso"); }
  ok(await sheet.locator("textarea").evaluate((el) => parseFloat(getComputedStyle(el).fontSize) >= 16), "salva B: la nota non fa zoomare l'iPhone (testo ≥ 16px)");
  await v.screenshot({ path: `${OUT}/23-salva-foglio.png`, caret: "initial" });
  await sheet.getByRole("button", { name: "✓ Ci sono stato" }).click();
  ok((await sheet.getByRole("button", { name: "📌 Voglio andarci" }).getAttribute("aria-pressed")) === "false", "salva B: gli stati si escludono a vicenda");
  // Scrivere a mano uno stato ("da provare") toglie l'altro, come i pulsanti
  await sheet.getByTestId("nuovo-tag").click();
  await sheet.getByLabel("Nuovo tag").fill("voglio andarci"); // l'etichetta mostrata porta allo stato "Da provare"
  await sheet.getByLabel("Nuovo tag").press("Enter");
  ok((await sheet.getByRole("button", { name: "📌 Voglio andarci" }).getAttribute("aria-pressed")) === "true" && (await sheet.getByRole("button", { name: "✓ Ci sono stato" }).getAttribute("aria-pressed")) === "false", "salva B: scrivere 'voglio andarci' sceglie lo stato (non crea un tag doppione) ed esclude l'altro");
  await sheet.getByRole("button", { name: "✓ Ci sono stato" }).click();
  await sheet.getByRole("button", { name: "Con amici" }).click();
  await sheet.getByTestId("nuovo-tag").click();
  await sheet.getByLabel("Nuovo tag").fill("  brunch  ");
  await sheet.getByLabel("Nuovo tag").press("Enter");
  ok((await sheet.getByRole("button", { name: "Brunch" }).getAttribute("aria-pressed")) === "true", "salva B: '+ Nuovo tag' aggiunge un tag scritto da te (già scelto)");
  await sheet.locator("textarea").fill("Prenotare");
  // Tag scritto senza Invio e "Fatto" toccato senza che il campo perda il fuoco (come su iPhone).
  await sheet.getByTestId("nuovo-tag").click();
  await sheet.getByLabel("Nuovo tag").fill("terrazza");
  await sheet.getByRole("button", { name: "Fatto" }).evaluate((b) => b.click());
  await sheet.waitFor({ state: "detached", timeout: 4000 });
  const ins2 = writes.find((w) => w.m === "POST");
  ok(!!ins2 && JSON.stringify(ins2.body?.tags) === '["Già visitato","Con amici","Brunch","Terrazza"]' && ins2.body?.note === "Prenotare", "salva B: scrive 'Già visitato' + tag scelti + tag nuovi (anche senza Invio) + nota");
  await v.goto(`${BASE}/mappa?beta=off`, { waitUntil: "networkidle" });
  await vctx.close();
}

// 10. Salva da Google Maps: Condividi (Android) e "Incolla link" (iPhone). API simulata, niente Google.
{
  const man = await (await fetch(`${BASE}/manifest.webmanifest`)).json().catch(() => ({}));
  ok(man.share_target?.action === "/importa/condividi/ricevi" && man.share_target?.method === "POST" && man.share_target?.enctype === "multipart/form-data" && man.share_target?.params?.text === "text" && man.share_target?.params?.url === "url", "manifest: Mapetite compare nel Condividi di Android (share_target POST, link)");
  { const f = man.share_target?.params?.files?.[0]; ok(f?.name === "immagini" && JSON.stringify(f?.accept) === '["image/*"]', "manifest: il Condividi accetta anche immagini (screenshot da Instagram/TikTok)"); }

  const lctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, permissions: ["clipboard-read", "clipboard-write"] });
  const lp = await lctx.newPage();
  lp.on("pageerror", (e) => errors.push(e.message));
  const lwrites = [];
  const apiCalls = [];
  await lctx.route("**/rest/v1/saved_places**", async (route) => {
    const req = route.request();
    if (req.method() !== "GET") lwrites.push({ m: req.method(), url: req.url(), body: req.postDataJSON?.() ?? null });
    return route.fulfill({ status: req.method() === "POST" ? 201 : 200, json: [] });
  });
  await lctx.route("**/api/places/from-link", async (route) => {
    const body = route.request().postDataJSON() ?? {};
    apiCalls.push(body);
    const links = (body.text ?? "").match(/https:\/\/maps\.app\.goo\.gl\/\S+/g) ?? [];
    if (links.length === 0) return route.fulfill({ status: 400, json: { error: "Non vedo un link di Google Maps. In Google Maps apri il locale, tocca Condividi e poi Copia link." } });
    return route.fulfill({ json: { risultati: links.map((link, i) => link.includes("ERR")
      ? { link, error: "Non riesco a leggere il link: apri il locale in Google Maps e condividi di nuovo." }
      : { link, place: { id: `00000000-0000-0000-0000-00000000010${i}`, name: link.includes("BBB") ? "Trattoria Due" : "Bar Rossi" } }) } });
  });

  await lp.goto(`${BASE}/importa`, { waitUntil: "networkidle" });
  const card = lp.getByTestId("importa-google");
  await lp.getByTestId("importa-tessera-maps").click();
  const guida = lp.getByTestId("importa-maps-guida");
  ok(await guida.getByText("Da Google Maps").isVisible(), "importa: la tessera 'Da Google Maps' apre la sua guida");
  ok((await guida.locator("ol li").count()) === 3 && await guida.getByText("Tocca Condividi → Copia link").isVisible(), "importa: tre passi numerati in italiano");
  const cardTop = (await card.boundingBox())?.y ?? 9999;
  const shotTop = (await lp.getByTestId("importa-tessera-shot").boundingBox())?.y ?? 0;
  ok(cardTop < shotTop, "importa: 'Incolla un link' viene prima dello screenshot");

  if (!fakeUser) {
    ok(await card.getByRole("link", { name: "Accedi" }).isVisible(), "importa da disconnessi: invito ad accedere per salvare da Google Maps");
    await lp.goto(`${BASE}/importa/condividi?title=Bar%20Rossi&text=${encodeURIComponent("https://maps.app.goo.gl/AAA111")}`, { waitUntil: "networkidle" });
    ok(await lp.getByTestId("condividi-accedi").isVisible(), "condividi da disconnessi: invito ad accedere");
    ok((await lp.evaluate(() => localStorage.getItem("mapetite-link-google-in-attesa")))?.includes("maps.app.goo.gl/AAA111"), "condividi da disconnessi: il link resta in attesa");
    console.log("SKIP  salva da Google Maps con accesso: dev server senza E2E_FAKE_USER");
  } else {
    ok(await card.getByRole("button", { name: "📋 Incolla un link" }).isVisible(), "importa: pulsante grande '📋 Incolla un link'");
    await lp.screenshot({ path: `${OUT}/30-importa-google.png`, caret: "initial" });
    // Più link negli appunti, uno per riga.
    await lp.evaluate(() => navigator.clipboard.writeText("https://maps.app.goo.gl/AAA111\nhttps://maps.app.goo.gl/BBB222"));
    await card.getByRole("button", { name: "📋 Incolla un link" }).click();
    await card.getByTestId("link-salvato").nth(1).waitFor({ timeout: 5000 });
    ok(await card.getByText("Salvato in Mapetite:").first().isVisible() && await card.getByText("Trattoria Due").isVisible(), "incolla: più link salvati in una volta ('Salvato in Mapetite')");
    const posts = lwrites.filter((w) => w.m === "POST");
    ok(posts.length === 2 && posts.every((w) => JSON.stringify(w.body?.tags) === '["Da provare"]'), "incolla: salvati con stato 'Da provare' (📌 Voglio andarci)");
    ok((await card.getByRole("link", { name: "Apri sulla mappa" }).first().getAttribute("href")) === "/mappa?salvato=00000000-0000-0000-0000-000000000100", "incolla: 'Apri sulla mappa' apre il salvato");
    await card.getByRole("button", { name: "Aggiungi nota" }).first().click();
    await card.getByLabel("Nota").fill("Consigliato da Giulia");
    await card.getByRole("button", { name: "Salva nota" }).click();
    await card.getByText("Nota salvata.").waitFor({ timeout: 4000 });
    ok(lwrites.some((w) => w.m === "PATCH" && w.body?.note === "Consigliato da Giulia" && w.url.includes("place_id=eq.00000000-0000-0000-0000-000000000100")), "incolla: 'Aggiungi nota' scrive la nota sul salvato giusto");
    await lp.screenshot({ path: `${OUT}/31-importa-google-salvati.png`, caret: "initial" });

    // Appunti non leggibili (permesso negato): compare il campo per incollare a mano.
    const nctx = await browser.newContext({ viewport: { width: 390, height: 844 }, permissions: [] });
    await nctx.route("**/rest/v1/saved_places**", (route) => route.fulfill({ status: 201, json: [] }));
    await nctx.route("**/api/places/from-link", (route) => route.fulfill({ json: { risultati: [
      { link: "https://maps.app.goo.gl/AAA111", place: { id: "00000000-0000-0000-0000-000000000100", name: "Bar Rossi" } },
      { link: "https://maps.app.goo.gl/ERR999", error: "Non riesco a leggere il link: apri il locale in Google Maps e condividi di nuovo." },
    ] } }));
    const np = await nctx.newPage();
    np.on("pageerror", (e) => errors.push(e.message));
    await np.goto(`${BASE}/importa`, { waitUntil: "networkidle" });
    await np.getByRole("button", { name: "📋 Incolla un link" }).click();
    ok(await np.getByLabel("Link da incollare").waitFor({ timeout: 3000 }).then(() => true, () => false), "incolla senza permesso: compare il campo per incollare a mano");
    await np.getByLabel("Link da incollare").fill("https://maps.app.goo.gl/AAA111\nhttps://maps.app.goo.gl/ERR999");
    await np.getByRole("button", { name: "Salva", exact: true }).click();
    await np.getByTestId("link-errore").waitFor({ timeout: 4000 });
    ok(await np.getByTestId("link-salvato").isVisible() && await np.getByText(/Non riesco a leggere il link/).isVisible(), "incolla a mano: un link salvato e uno con errore in italiano");
    await nctx.close();

    // Condividi da Google Maps (Android): la pagina salva subito.
    const before = apiCalls.length;
    await lp.goto(`${BASE}/importa/condividi?title=Bar%20Rossi&text=${encodeURIComponent("Bar Rossi\nVia Roma 1\nhttps://maps.app.goo.gl/AAA111")}`, { waitUntil: "networkidle" });
    await lp.getByTestId("link-salvato").waitFor({ timeout: 5000 });
    ok(await lp.getByText("Salvato in Mapetite:").isVisible() && await lp.getByText("Bar Rossi", { exact: true }).isVisible(), "condividi: 'Salvato in Mapetite: Bar Rossi'");
    ok(apiCalls.length === before + 1 && apiCalls.at(-1)?.title === "Bar Rossi", "condividi: una sola chiamata, con il nome condiviso");
    ok(await lp.getByRole("button", { name: "Aggiungi nota" }).isVisible() && await lp.getByRole("link", { name: "Apri sulla mappa" }).isVisible(), "condividi: pulsanti 'Apri sulla mappa' e 'Aggiungi nota'");
    await lp.screenshot({ path: `${OUT}/32-condividi-salvato.png`, caret: "initial" });
    // Ricaricare la pagina (o riaprirla dalle app recenti) non rifà la chiamata a Google
    const beforeReload = apiCalls.length;
    await lp.reload({ waitUntil: "networkidle" });
    await lp.getByTestId("link-salvato").waitFor({ timeout: 5000 }).catch(() => {});
    ok(apiCalls.length === beforeReload && await lp.getByText("Bar Rossi", { exact: true }).isVisible(), "condividi: ricaricando si vede lo stesso esito, senza un'altra chiamata a Google");
    await lp.goto(`${BASE}/importa/condividi?text=${encodeURIComponent("guarda che bel posto")}`, { waitUntil: "networkidle" });
    await lp.getByRole("button", { name: "Riprova" }).waitFor({ timeout: 5000 });
    ok(await lp.getByText(/Non vedo un link di Google Maps/).isVisible(), "condividi senza link: errore in italiano con 'Riprova'");
    await lp.goto(`${BASE}/importa/condividi`, { waitUntil: "networkidle" });
    ok(await lp.getByText("Non è arrivato nessun link.", { exact: false }).isVisible(), "condividi vuoto: spiega cosa fare");

    // Condividi via POST (share_target): il link di Google Maps va alla pagina di sempre.
    const lr = await lctx.request.post(`${BASE}/importa/condividi/ricevi`, { multipart: { title: "Bar Rossi", text: "https://maps.app.goo.gl/AAA111", url: "" }, maxRedirects: 0 });
    const linkLoc = lr.headers()["location"] ?? "";
    ok(lr.status() === 303 && linkLoc.includes("/importa/condividi?") && decodeURIComponent(linkLoc.replace(/\+/g, " ")).includes("text=https://maps.app.goo.gl/AAA111") && !linkLoc.includes("url="), `condividi POST con link: va a /importa/condividi con il link (${lr.status()})`);
    await lp.goto(new URL(linkLoc, BASE).href, { waitUntil: "networkidle" });
    await lp.getByTestId("link-salvato").waitFor({ timeout: 5000 });
    ok(await lp.getByText("Bar Rossi", { exact: true }).isVisible() && apiCalls.at(-1)?.title === "Bar Rossi", "condividi POST con link: il locale di Google Maps si salva come prima");

    // Condividi uno screenshot (Instagram/TikTok). Lettura finta dal cookie e2e_lettura: niente Haiku.
    const PNG = Buffer.from("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489", "hex");
    const img = (name) => ({ name, mimeType: "image/png", buffer: PNG });
    const setLettura = (v) => lctx.addCookies([{ name: "e2e_lettura", value: encodeURIComponent(JSON.stringify(v)), url: BASE }]);
    const shareImages = async (fields) => {
      const fd = new FormData();
      for (const [k, v] of fields) { if (typeof v === "string") fd.append(k, v); else fd.append(k, new Blob([v.buffer], { type: v.mimeType }), v.name); }
      const r = await lctx.request.post(`${BASE}/importa/condividi/ricevi`, { multipart: fd, maxRedirects: 0 });
      return { status: r.status(), loc: r.headers()["location"] ?? "" };
    };
    const SEARCH = [
      { id: "GBR1", name: "Bar Rossi", address: "Via Po, 2/a, 00198 Roma RM, Italy", lat: 41.91, lng: 12.5, category: "bar", rating: 4.6, priceLevel: 2 },
      { id: "GBR2", name: "Bar Rossi Bis", address: "Via Tuscolana 10, 00182 Roma RM, Italy", lat: 41.88, lng: 12.52, category: "bar", rating: 4.4, priceLevel: 1 },
    ];
    const searchCalls = [];
    const addCalls = [];
    await lctx.route("**/api/places/search", (route) => { searchCalls.push(route.request().postDataJSON()); return route.fulfill({ json: { results: SEARCH } }); });
    await lctx.route("**/api/places/add", (route) => { const b = route.request().postDataJSON(); addCalls.push(b); return route.fulfill({ json: { place: { id: b.googlePlaceId === "GBR2" ? "00000000-0000-0000-0000-000000000202" : "00000000-0000-0000-0000-000000000201", name: b.name } } }); });
    // Verdetto subito (proposta 14): Bar Rossi ce l'ha, Bar Rossi Bis no (tetto del giorno raggiunto).
    const verdCalls = [];
    await lctx.route("**/api/places/verdetto", (route) => { const b = route.request().postDataJSON(); verdCalls.push(b); return b.googlePlaceId === "GBR1" ? route.fulfill({ json: { verdict: "Caffè da banco serio, cornetti sfornati la mattina.", photoRef: null } }) : route.fulfill({ status: 429, json: { error: "limite" } }); });

    const reelWrites = [];
    await lctx.route("**/rest/v1/contenuti_locali**", (route) => { const req = route.request(); reelWrites.push({ m: req.method(), url: req.url() }); return route.fulfill({ status: req.method() === "POST" ? 201 : 200, json: [] }); });
    // Salva dal reel (sprint 25/10): un post con 3 locali; il primo combacia con Google e si salva da solo.
    // Carosello (proposta 13): due slide, una lettura ciascuna; Caffè Verdi in tutte e due resta uno solo.
    await setLettura([{ luoghi: [{ nome: "Bar Rossi", citta: "Roma", categoria: "bar" }, { nome: "Caffè Verdi", citta: "Roma", categoria: "caffè" }] }, { luoghi: [{ nome: "caffè verdi", citta: "Roma", categoria: "caffè" }, { nome: "Osteria Blu", citta: "Roma", categoria: "osteria" }] }]);
    const s1 = await shareImages([["immagini", img("story1.png")], ["immagini", img("story2.png")], ["text", "Guarda questo post"]]);
    ok(s1.status === 303 && s1.loc.includes("/importa/condividi/immagine?") && s1.loc.includes("lette=2") && s1.loc.includes("nome=Bar+Rossi") && s1.loc.includes("citta=Roma") && s1.loc.includes("altri="), `condividi screenshot: letto nome, città e gli altri locali del post, poi pagina dell'esito (${s1.status} ${s1.loc.slice(0, 90)})`);
    const w0 = lwrites.length;
    await lp.goto(new URL(s1.loc, BASE).href, { waitUntil: "networkidle" });
    await lp.getByTestId("reel-salvato").waitFor({ timeout: 5000 });
    const ins = lwrites.slice(w0).find((w) => w.m === "POST");
    ok(await lp.getByTestId("reel-salvato").getByText("Bar Rossi, Roma").isVisible() && await lp.getByText("✓ Salvato in 📌 Voglio andarci").isVisible(), "salva dal reel: il locale che combacia si salva da solo ('✓ Salvato in 📌 Voglio andarci')");
    ok(addCalls.at(-1)?.googlePlaceId === "GBR1" && JSON.stringify(ins?.body?.tags) === '["Da provare"]' && ins?.body?.place_id === "00000000-0000-0000-0000-000000000201", "salva dal reel: salvato in 'Da provare' senza toccare niente");
    ok((await lp.getByTestId("screenshot-piu").textContent())?.trim() === "Ho letto 2 immagini: 3 posti.", `carosello: legge tutte le slide e unisce i locali senza doppioni (${await lp.getByTestId("screenshot-piu").textContent()})`);
    ok(searchCalls.length === 1 && searchCalls[0]?.query === "Bar Rossi Roma", "salva dal reel: una sola ricerca Google, con nome e città del primo locale");
    ok(await lp.getByTestId("reel-altri").getByText("Nel reel ci sono anche").isVisible() && await lp.getByTestId("reel-altro").count() === 2, "salva dal reel: 'Nel reel ci sono anche' con gli altri 2 locali, senza cercarli");
    ok(await lp.getByRole("link", { name: "Apri sulla mappa" }).getAttribute("href") === "/mappa?salvato=00000000-0000-0000-0000-000000000201", "salva dal reel: 'Apri sulla mappa' sul salvato");
    await lp.getByTestId("reel-verdetto").waitFor({ timeout: 4000 }).catch(() => {});
    ok(await lp.getByTestId("reel-verdetto").getByText("Caffè da banco serio, cornetti sfornati la mattina.").isVisible() && verdCalls.length === 1 && verdCalls[0]?.googlePlaceId === "GBR1", "salva dal reel: nel '✓ Salvato' compare subito il verdetto Mapetite (una chiamata)");
    // "Quando ci vai?" (proposta 17): un tocco scrive il giorno nel salvato, un altro lo toglie.
    { const wq = lwrites.length;
      await lp.getByTestId("quando-stasera").click();
      await lp.getByTestId("quando-detto").waitFor({ timeout: 3000 }).catch(() => {});
      const oggi = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(new Date());
      const pq = lwrites.slice(wq).find((w) => w.m === "PATCH");
      ok(pq?.body?.piano_al === oggi && pq.url.includes("place_id=eq.00000000-0000-0000-0000-000000000201") && await lp.getByTestId("quando-stasera").getAttribute("aria-pressed") === "true", `quando ci vai: 'Stasera' segna oggi nel salvato (${JSON.stringify(pq?.body)})`);
      await lp.getByTestId("quando-weekend").click();
      await lp.waitForTimeout(300);
      const pw = lwrites.slice(wq).filter((w) => w.m === "PATCH").at(-1);
      const dow = new Date(`${oggi}T12:00:00Z`).getUTCDay();
      const sab = new Date(`${oggi}T12:00:00Z`); sab.setUTCDate(sab.getUTCDate() + (dow === 0 ? -1 : 6 - dow));
      ok(pw?.body?.piano_al === sab.toISOString().slice(0, 10), `quando ci vai: 'Nel weekend' segna il sabato (${pw?.body?.piano_al})`);
      await lp.getByTestId("quando-weekend").click();
      await lp.waitForTimeout(300);
      ok(lwrites.slice(wq).filter((w) => w.m === "PATCH").at(-1)?.body?.piano_al === null && !(await lp.getByTestId("quando-detto").isVisible()), "quando ci vai: toccato di nuovo, il giorno si toglie");
      await lp.getByTestId("reel-salvato").screenshot({ path: `${OUT}/33b-reel-salvato-quando.png` }); }
    await lp.screenshot({ path: `${OUT}/33-condividi-screenshot.png`, caret: "initial" });

    // "Non è questo": si toglie dai salvati e si sceglie tra gli altri risultati già arrivati.
    const w1 = lwrites.length;
    await lp.getByTestId("reel-non-e-questo").click();
    await lp.getByTestId("reel-scegli").waitFor({ timeout: 4000 });
    ok(lwrites.slice(w1).some((w) => w.m === "DELETE" && w.url.includes("place_id=eq.00000000-0000-0000-0000-000000000201")), "salva dal reel: 'Non è questo' toglie il locale dai salvati");
    ok(await lp.getByTestId("reel-tolto").isVisible(), "salva dal reel: dopo 'Non è questo' dice 'Tolto dai salvati'");
    ok(await lp.getByTestId("reel-scegli").getByText("Bar Rossi Bis").isVisible() && await lp.getByTestId("reel-cerca-mano").isVisible(), "salva dal reel: 'Non è questo' propone gli altri risultati e la ricerca a mano");
    await lp.getByTestId("reel-scegli").getByText("Bar Rossi Bis").click();
    await lp.getByTestId("reel-salvato").waitFor({ timeout: 4000 });
    ok(addCalls.at(-1)?.googlePlaceId === "GBR2" && searchCalls.length === 1, "salva dal reel: scelto l'altro, salvato senza un'altra ricerca Google");
    await lp.getByTestId("reel-verdetto-dopo").waitFor({ timeout: 4000 }).catch(() => {});
    ok(await lp.getByTestId("reel-verdetto-dopo").isVisible() && (await lp.getByTestId("reel-verdetto").count()) === 0, "salva dal reel: senza verdetto (tetto del giorno) niente di inventato, solo 'lo trovi nella scheda'");
    await lp.screenshot({ path: `${OUT}/34-condividi-screenshot-salvato.png`, caret: "initial" });

    ok(reelWrites.length === 0, "salva dal reel: senza link del reel nessun video collegato o tolto");
    // Riaperta: si vede quello che si è scelto, senza rifare ricerca né salvataggio.
    const w2 = lwrites.length;
    const a2 = addCalls.length;
    await lp.goto(new URL(s1.loc, BASE).href, { waitUntil: "networkidle" });
    await lp.getByTestId("reel-salvato").waitFor({ timeout: 4000 }).catch(() => {});
    ok(searchCalls.length === 1 && addCalls.length === a2 && await lp.getByTestId("reel-salvato").getByText("Bar Rossi Bis").isVisible() && !lwrites.slice(w2).some((w) => w.m === "POST"), "salva dal reel: riaperta, mostra il locale scelto senza rifare ricerca né salvataggio");
    // Link costruito a mano (?nome=…, senza il Condividi di questo telefono): mai salvataggio da solo.
    {
      const xctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
      const xp = await xctx.newPage();
      const xw = [];
      await xctx.route("**/api/places/search", (route) => route.fulfill({ json: { results: SEARCH } }));
      await xctx.route("**/rest/v1/saved_places**", (route) => { xw.push(route.request().method()); return route.fulfill({ status: 201, json: [] }); });
      await xp.goto(`${BASE}/importa/condividi/immagine?nome=Bar+Rossi&citta=Roma`, { waitUntil: "networkidle" });
      await xp.getByTestId("reel-trovato").waitFor({ timeout: 5000 }).catch(() => {});
      ok(await xp.getByTestId("reel-trovato").isVisible() && !xw.includes("POST"), "salva dal reel: un link costruito a mano chiede 'È questo?' e non salva da solo");
      await xctx.close();
    }
    // Un altro locale del reel: un tocco = una ricerca; se non combacia chiede conferma.
    await lp.getByTestId("reel-altro").first().click();
    await lp.getByTestId("reel-altri").getByTestId("reel-trovato").waitFor({ timeout: 4000 });
    ok(searchCalls.length === 2 && searchCalls[1]?.query === "Caffè Verdi Roma" && await lp.getByTestId("reel-altri").getByText("Nel reel: «Caffè Verdi, Roma»").isVisible(), "salva dal reel: '+ Salva' su un altro locale fa UNA ricerca e, se il nome non combacia, chiede 'È questo?'");
    { const v0 = verdCalls.length;
      await lp.getByTestId("reel-altri").getByTestId("reel-conferma").click();
      await lp.getByTestId("reel-altri").getByTestId("reel-salvato").waitFor({ timeout: 4000 }).catch(() => {});
      ok(await lp.getByTestId("reel-altri").getByTestId("reel-salvato").isVisible() && verdCalls.length === v0 && (await lp.getByTestId("reel-altri").getByTestId("reel-verdetto").count()) === 0 && (await lp.getByTestId("reel-altri").getByRole("link", { name: "Apri sulla mappa" }).count()) === 0, "salva dal reel: un altro locale salvato diventa una riga compatta, senza verdetto in più (nessuna chiamata)"); }

    // Immagine senza locale e file che non è un'immagine: errori in italiano.
    await setLettura({ nome: null, citta: null, categoria: null });
    const s2 = await shareImages([["immagini", img("tramonto.png")]]);
    ok(s2.loc.includes("errore=illeggibile") && !s2.loc.includes("piu="), `condividi screenshot illeggibile: esito con errore (${s2.loc})`);
    await lp.goto(new URL(s2.loc, BASE).href, { waitUntil: "networkidle" });
    ok(await lp.getByText("Non riesco a leggere un locale in questa immagine.").isVisible() && await lp.getByTestId("screenshot-manuale").isVisible(), "condividi screenshot illeggibile: messaggio in italiano e import manuale");
    await lp.screenshot({ path: `${OUT}/35-condividi-screenshot-errore.png`, caret: "initial" });
    const s3 = await shareImages([["immagini", { name: "nota.png", mimeType: "image/png", buffer: Buffer.from("non sono un'immagine") }]]);
    ok(s3.loc.includes("errore=formato"), "condividi: un file che non è un'immagine dà errore di formato (niente Haiku)");
    await lctx.clearCookies({ name: "e2e_lettura" });
  }

  // Screenshot condiviso senza accesso: si va al login con un messaggio chiaro (prima di qualsiasi lettura).
  await lctx.addCookies([{ name: "e2e_anonimo", value: "1", url: BASE }]);
  {
    const fd = new FormData();
    fd.append("immagini", new Blob([Buffer.from("89504e470d0a1a0a", "hex")], { type: "image/png" }), "story.png");
    const r = await lctx.request.post(`${BASE}/importa/condividi/ricevi`, { multipart: fd, maxRedirects: 0 });
    const loc = r.headers()["location"] ?? "";
    ok(r.status() === 303 && loc.includes("/login?message="), `condividi screenshot da disconnessi: rimanda al login (${r.status()} ${loc.slice(0, 40)})`);
    await lp.goto(new URL(loc, BASE).href, { waitUntil: "networkidle" });
    ok(await lp.getByText("Accedi a Mapetite, poi condividi di nuovo lo screenshot", { exact: false }).isVisible(), "condividi screenshot da disconnessi: messaggio in italiano sul login");
    await lp.screenshot({ path: `${OUT}/36-condividi-screenshot-login.png`, caret: "initial" });
  }
  await lctx.clearCookies({ name: "e2e_anonimo" });
  await lp.goto(`${BASE}/importa`, { waitUntil: "networkidle" });
  await lp.getByTestId("importa-tessera-shot").click();
  ok(await lp.getByTestId("importa-condividi-android").getByText("Su Android puoi anche condividere uno screenshot direttamente a Mapetite da Instagram o TikTok.").isVisible(), "importa: riga sul Condividi dello screenshot da Android");
  await lctx.close();
}

// 10b. Aggiungi a mano (nome e città) e link di Instagram/TikTok. Ricerca e salvataggio simulati: niente Google.
if (!fakeUser) {
  console.log("SKIP  aggiungi a mano: dev server senza E2E_FAKE_USER");
} else {
  const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, permissions: ["clipboard-read", "clipboard-write"] });
  const mp = await mctx.newPage();
  mp.on("pageerror", (e) => errors.push(e.message));
  const MANO = [
    { id: "GM1", name: "Pizzeria da Michele", address: "Via Flaminia 1, 00196 Roma RM, Italy", lat: 41.92, lng: 12.47, category: "pizza_restaurant", rating: 4.5, priceLevel: 1 },
    { id: "GM2", name: "Trattoria Già Salvata", address: "Via Appia 3, 00179 Roma RM, Italy", lat: 41.86, lng: 12.52, category: "restaurant", rating: 4.6, priceLevel: 2 },
  ];
  const mSearch = [];
  const mAdd = [];
  const mWrites = [];
  const mFromLink = [];
  const FRATELLI = [{ id: "GOF", name: "Osteria dei Fratelli", address: "Via Tortona 5, 20144 Milano MI, Italy", lat: 45.45, lng: 9.16, category: "restaurant", rating: 4.6, priceLevel: 2 }];
  await mctx.route("**/api/places/search", (r) => { const b = r.request().postDataJSON(); mSearch.push(b); return r.fulfill({ json: { results: /Osteria dei Fratelli/.test(b?.query ?? "") ? FRATELLI : MANO } }); });
  const mReels = [];
  await mctx.route("**/rest/v1/contenuti_locali**", (r) => { const req = r.request(); mReels.push({ m: req.method(), body: req.postDataJSON?.() ?? null }); return r.fulfill({ status: req.method() === "POST" ? 201 : 200, json: [] }); });
  await mctx.route("**/api/places/add", (r) => { const b = r.request().postDataJSON(); mAdd.push(b); return r.fulfill({ json: { place: { id: "00000000-0000-0000-0000-000000000301", name: b.name } } }); });
  await mctx.route("**/api/places/from-link", (r) => { mFromLink.push(r.request().postDataJSON()); return r.fulfill({ status: 400, json: { error: "Non vedo un link di Google Maps." } }); });
  await mctx.route("**/rest/v1/saved_places**", (r) => {
    const req = r.request();
    if (req.method() === "GET") {
      // "Già nei tuoi salvati": GM2 è già tra i salvati dell'utente.
      return r.fulfill({ json: req.url().includes("google_place_id") ? [{ place_id: "00000000-0000-0000-0000-000000000302", places: { google_place_id: "GM2" } }] : [] });
    }
    mWrites.push({ m: req.method(), url: req.url(), body: req.postDataJSON?.() ?? null });
    return r.fulfill({ status: 201, json: [] });
  });

  await mp.goto(`${BASE}/importa`, { waitUntil: "networkidle" });
  const yOf = async (id) => (await mp.getByTestId(id).boundingBox())?.y ?? -1;
  const [yG, yT] = [await yOf("importa-google"), await yOf("importa-tessere")];
  ok(yG >= 0 && yG < yT && (await yOf("importa-mano")) === -1, `importa: prima 'Incolla un link', poi le tessere; 'A mano' chiuso (${yG}, ${yT})`);
  await mp.getByTestId("importa-tessera-mano").click();
  ok((await yOf("importa-mano")) > yT, "importa: la tessera 'A mano' apre il campo sotto le tessere");
  const DOCS_SHOTS = "docs/autonomia/screenshots/2026-10-13-notte";
  mkdirSync(DOCS_SHOTS, { recursive: true });
  await mp.screenshot({ path: `${DOCS_SHOTS}/importa.png`, caret: "initial" });
  const mano = mp.getByTestId("importa-mano");
  const field = mano.getByLabel("Nome del locale e città");
  ok(await field.isVisible() && (await field.getAttribute("placeholder")) === "es. Da Michele Roma", "a mano: un solo campo 'Nome del locale e città' (es. Da Michele Roma)");
  ok(mSearch.length === 0, "a mano: nessuna ricerca Google prima di toccare Cerca");
  await field.fill("Pizzeria da Michele Roma");
  await mano.getByRole("button", { name: "Cerca" }).click();
  await mano.getByTestId("mano-risultato").nth(1).waitFor({ timeout: 5000 });
  ok(mSearch.length === 1 && mSearch[0]?.query === "Pizzeria da Michele Roma", "a mano: una sola ricerca con il testo scritto");
  ok(await mano.getByTestId("mano-risultato").first().getByText("🍕").isVisible() && await mano.getByText("Via Flaminia 1, 00196 Roma RM", { exact: true }).isVisible(), "a mano: risultato con emoji della categoria, nome e indirizzo (senza ', Italy')");
  const gia = mano.getByTestId("mano-gia-salvato");
  ok(await gia.count() === 1 && await gia.getByText("Già nei tuoi salvati").isVisible() && (await gia.getAttribute("href")) === "/mappa?salvato=00000000-0000-0000-0000-000000000302", "a mano: 'Già nei tuoi salvati' sul locale già salvato, apre il salvato");
  await mano.scrollIntoViewIfNeeded();
  await mp.screenshot({ path: `${OUT}/37-importa-a-mano.png`, caret: "initial" });
  await mano.getByRole("button", { name: "Cerca" }).click();
  await mp.waitForTimeout(300);
  ok(mSearch.length === 1, "a mano: la stessa frase non viene cercata due volte");
  await mano.getByRole("button", { name: "Salva", exact: true }).click();
  await mano.getByTestId("link-salvato").waitFor({ timeout: 5000 });
  const mIns = mWrites.find((w) => w.m === "POST");
  ok(mAdd.at(-1)?.googlePlaceId === "GM1" && JSON.stringify(mIns?.body?.tags) === '["Da provare"]' && mIns?.body?.place_id === "00000000-0000-0000-0000-000000000301", "a mano: Salva mette il locale in '📌 Voglio andarci' (Da provare)");
  ok(await mano.getByText("Salvato in Mapetite:").isVisible() && await mano.getByText("Lo trovi tra i salvati in 📌 Voglio andarci.").isVisible(), "a mano: conferma 'Salvato in Mapetite'");
  await mano.getByRole("button", { name: "Aggiungi nota" }).click();
  await mano.getByLabel("Nota").fill("Me l'ha detto Marco");
  await mano.getByRole("button", { name: "Salva nota" }).click();
  await mano.getByText("Nota salvata.").waitFor({ timeout: 4000 });
  ok(mWrites.some((w) => w.m === "PATCH" && w.body?.note === "Me l'ha detto Marco" && w.url.includes("place_id=eq.00000000-0000-0000-0000-000000000301")), "a mano: nota facoltativa sul salvato");
  await mp.screenshot({ path: `${OUT}/38-importa-a-mano-salvato.png`, caret: "initial" });

  // Salva dal reel (sprint 25/10). Lettura AI simulata: la didascalia o il video danno i locali.
  const capBodies = [];
  // Il verdetto subito (proposta 14) non deve mai chiamare Google vero dal giro.
  await mctx.route("**/api/places/verdetto", (r) => r.fulfill({ json: { verdict: "Cucina milanese di casa, porzioni generose.", photoRef: null } }));
  const OF = { nome: "Osteria dei Fratelli", citta: "Milano", categoria: "ristorante" };
  await mctx.route("**/api/import-caption", (r) => {
    const b = r.request().postDataJSON();
    capBodies.push(b);
    if (b?.link?.includes("/video/999")) return r.fulfill({ status: 422, json: { error: "Non riesco a leggere questo video." } });
    if (b?.caption) return r.fulfill({ json: { nome: "Pizzeria Bella", citta: "Roma", categoria: "pizzeria", luoghi: [{ nome: "Pizzeria Bella", citta: "Roma", categoria: "pizzeria" }] } });
    return r.fulfill({ json: { ...OF, luoghi: [OF] } });
  });

  // Instagram incollato con un nome nel testo: l'AI legge il testo, una ricerca, "È questo?" se il nome non combacia.
  await mp.goto(`${BASE}/importa`, { waitUntil: "networkidle" });
  const gcard = mp.getByTestId("importa-google");
  await gcard.getByRole("button", { name: "Oppure incollalo in un riquadro" }).click();
  await gcard.getByLabel("Link da incollare").fill("Pizzeria Bella a Roma 🍕 https://www.instagram.com/reel/ABC123/?igsh=xyz");
  const sI = mSearch.length;
  const wI = mWrites.length;
  await gcard.getByRole("button", { name: "Salva", exact: true }).click();
  await gcard.getByTestId("reel-trovato").waitFor({ timeout: 5000 }).catch(() => {});
  ok(capBodies.at(-1)?.caption === "Pizzeria Bella a Roma" && mSearch.length === sI + 1 && mSearch.at(-1)?.query === "Pizzeria Bella Roma", "instagram: il nome scritto col link va all'AI e parte UNA ricerca Google");
  ok(await gcard.getByTestId("reel-trovato").getByText("È questo?").isVisible() && !mWrites.slice(wI).some((w) => w.m === "POST") && mFromLink.length === 0, "instagram: il nome trovato non combacia → 'È questo?', niente salvataggio da solo né errore Google Maps");
  await gcard.getByTestId("reel-trovato").scrollIntoViewIfNeeded();
  await mp.screenshot({ path: `${DOCS_SHOTS}/instagram.png`, caret: "initial" });
  await gcard.getByTestId("reel-conferma").click();
  await gcard.getByTestId("reel-salvato").waitFor({ timeout: 4000 });
  ok(mAdd.at(-1)?.googlePlaceId === "GM1" && mReels.some((x) => x.m === "POST" && x.body?.url === "https://www.instagram.com/reel/ABC123" && x.body?.fonte === "Instagram"), "instagram: 'Sì, salva' salva il locale e collega il reel (link pulito)");

  // Instagram senza testo: un solo passo, screenshot o nome; nessuna lettura AI prima del tocco.
  await mp.goto(`${BASE}/importa/condividi?text=${encodeURIComponent("https://www.instagram.com/p/XYZ/")}`, { waitUntil: "networkidle" });
  const c0 = capBodies.length;
  const chiedi = mp.getByTestId("reel-chiedi");
  ok(await chiedi.isVisible() && await chiedi.getByText("Instagram non lascia leggere i reel alle altre app.", { exact: false }).isVisible() && await mp.getByTestId("reel-screenshot").isVisible() && capBodies.length === c0, "condividi instagram: 'Carica lo screenshot' o il nome, senza chiamate");
  await mp.screenshot({ path: `${OUT}/39-reel-instagram.png`, caret: "initial" });
  await mp.getByLabel("Screenshot del reel").setInputFiles({ name: "reel.png", mimeType: "image/png", buffer: Buffer.from("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489", "hex") });
  await mp.getByTestId("reel-salvato").waitFor({ timeout: 6000 }).catch(() => {});
  ok(capBodies.length === c0 + 1 && typeof capBodies.at(-1)?.image === "string" && await mp.getByTestId("reel-salvato").getByText("Osteria dei Fratelli, Milano").isVisible(), "condividi instagram: dallo screenshot legge il locale, lo trova e lo salva da solo");

  // TikTok incollato: si legge il video da solo e si salva se combacia (nessun tocco in più).
  await mp.evaluate(() => sessionStorage.clear());
  await mp.goto(`${BASE}/importa`, { waitUntil: "networkidle" });
  await gcard.getByRole("button", { name: "Oppure incollalo in un riquadro" }).click();
  await gcard.getByLabel("Link da incollare").fill("https://vm.tiktok.com/ZMabc123/");
  const sT = mSearch.length;
  await gcard.getByRole("button", { name: "Salva", exact: true }).click();
  await gcard.getByTestId("reel-salvato").waitFor({ timeout: 6000 }).catch(() => {});
  ok(capBodies.at(-1)?.link === "https://vm.tiktok.com/ZMabc123/" && mSearch.length === sT + 1 && mSearch.at(-1)?.query === "Osteria dei Fratelli Milano" && await gcard.getByText("✓ Salvato in 📌 Voglio andarci").isVisible(), "tiktok: incollato il link, legge il video, trova e salva il locale da solo");
  ok(await gcard.getByTestId("reel-collegato").isVisible() && mReels.some((x) => x.m === "POST" && x.body?.fonte === "TikTok"), "tiktok: il video resta collegato al locale ('Il reel resta collegato')");
  await gcard.getByTestId("reel-salvato").scrollIntoViewIfNeeded();
  await mp.screenshot({ path: `${OUT}/39-importa-da-tiktok.png`, caret: "initial" });
  await mp.goto(`${BASE}/importa`, { waitUntil: "networkidle" });
  await gcard.getByRole("button", { name: "Oppure incollalo in un riquadro" }).click();
  await gcard.getByLabel("Link da incollare").fill("https://www.youtube.com/shorts/abcDEF");
  await gcard.getByRole("button", { name: "Salva", exact: true }).click();
  await gcard.getByTestId("reel-salvato").waitFor({ timeout: 6000 }).catch(() => {});
  ok(capBodies.at(-1)?.link === "https://www.youtube.com/shorts/abcDEF" && mFromLink.length === 0, "youtube shorts: si legge dal video, nessuna chiamata a Google Maps per link");

  // Link costruito a mano verso /importa/condividi (nessun Condividi vero): legge, ma chiede "È questo?".
  await mp.evaluate(() => sessionStorage.clear());
  const wX = mWrites.length;
  await mp.goto(`${BASE}/importa/condividi?text=${encodeURIComponent("Guarda questo video su TikTok https://www.tiktok.com/@mario/video/123")}`, { waitUntil: "networkidle" });
  await mp.getByTestId("reel-trovato").waitFor({ timeout: 6000 }).catch(() => {});
  ok(await mp.getByTestId("reel-trovato").isVisible() && !mWrites.slice(wX).some((w) => w.m === "POST"), "condividi: un link costruito a mano non salva da solo nei salvati di chi lo apre ('È questo?')");
  // Condividi (Android) vero, dal POST del ricevi: la frase dell'app non diventa una ricerca, il video si legge una volta sola.
  await mp.evaluate(() => sessionStorage.clear());
  const c1 = capBodies.length;
  { const r = await mctx.request.post(`${BASE}/importa/condividi/ricevi`, { multipart: { text: "Guarda questo video su TikTok https://www.tiktok.com/@mario/video/123" }, maxRedirects: 0 });
    await mp.goto(new URL(r.headers()["location"] ?? "/importa/condividi", BASE).href, { waitUntil: "networkidle" }); }
  await mp.getByTestId("reel-salvato").waitFor({ timeout: 6000 }).catch(() => {});
  ok(await mp.getByRole("heading", { name: "Salva dal reel" }).isVisible() && capBodies.length === c1 + 1 && capBodies.at(-1)?.link === "https://www.tiktok.com/@mario/video/123" && await mp.getByTestId("reel-salvato").isVisible() && mFromLink.length === 0, "condividi tiktok: 'Salva dal reel', legge il video e salva in un gesto");
  await mp.reload({ waitUntil: "networkidle" });
  await mp.getByTestId("reel-salvato").waitFor({ timeout: 6000 }).catch(() => {});
  ok(capBodies.length === c1 + 1, "condividi tiktok: ricaricando non rilegge il video (niente AI ripetuta)");
  await mp.goto(`${BASE}/importa/condividi?text=${encodeURIComponent("https://www.tiktok.com/@mario/video/999")}`, { waitUntil: "networkidle" });
  await mp.getByTestId("reel-chiedi").waitFor({ timeout: 5000 }).catch(() => {});
  ok(await mp.getByTestId("reel-chiedi").getByText("Non riesco a leggere questo video.", { exact: false }).isVisible() && await mp.getByTestId("reel-screenshot").isVisible(), "condividi tiktok illeggibile (privato): passa allo screenshot invece di fermarsi");
  await mctx.unroute("**/api/import-caption");

  // Da disconnessi: invito ad accedere, nessuna ricerca.
  await mctx.addCookies([{ name: "e2e_anonimo", value: "1", url: BASE }]);
  await mp.goto(`${BASE}/importa`, { waitUntil: "networkidle" });
  ok(await mp.getByTestId("importa-google").getByRole("link", { name: "Accedi" }).isVisible() && (await mp.getByTestId("importa-incolla").count()) === 0, "importa da disconnessi: al posto di Incolla l'invito ad accedere");
  await mp.getByTestId("importa-tessera-mano").click();
  ok(await mano.getByTestId("mano-accedi").isVisible() && await mano.getByRole("link", { name: "Accedi" }).isVisible() && !(await mano.getByLabel("Nome del locale e città").isVisible()), "a mano da disconnessi: invito ad accedere, niente campo");
  await mp.getByTestId("importa-tessera-shot").click();
  ok(await mp.getByTestId("screenshot-accedi").isVisible() && await mp.getByRole("button", { name: "Leggi locale" }).isDisabled(), "screenshot da disconnessi: 'Leggi locale' spento e invito ad accedere (niente AI e Google senza poter salvare)");
  { const r = await mctx.request.post(`${BASE}/api/places/search`, { data: { query: "x".repeat(201) } }); ok(r.status() === 400, `ricerca locali: testo oltre 200 caratteri rifiutato senza chiamare Google (${r.status()})`); }
  await mp.goto(`${BASE}/importa/condividi?text=${encodeURIComponent("https://www.instagram.com/reel/ABC/")}`, { waitUntil: "networkidle" });
  ok(await mp.getByTestId("reel-accedi").isVisible() && !(await mp.evaluate(() => localStorage.getItem("mapetite-link-google-in-attesa"))), "condividi instagram da disconnessi: invito ad accedere, nessuna lettura");
  await mctx.clearCookies({ name: "e2e_anonimo" });
  await mctx.close();
}

// 12c. "Per te" nella card dei risultati (chiave B, mockup A): solo se l'AI lo dà dai gusti; con il "Per te" niente chip.
{
  const pctx = await browser.newContext({ viewport: { width: 360, height: 800 }, deviceScaleFactor: 2 });
  const pp = await pctx.newPage();
  pp.on("pageerror", (e) => errors.push(e.message));
  await pctx.route("**/api/events", (r) => r.fulfill({ status: 204, body: "" }));
  await pctx.route("**/api/places/photo**", (r) => r.fulfill({ status: 429, json: {} }));
  await pctx.route("**/api/search", (r) => r.fulfill({ json: { ...SEARCH_FAST, risultati: [mk("P1", "Terrazza del Gianicolo e Giardino", 41.9, 12.49), mk("P3", "Rooftop Tre", 41.902, 12.494)], sintesi_pendente: { places: [{ id: "P1" }, { id: "P3" }], token: "t" } } }));
  await pctx.route("**/api/search/synthesis", (r) => r.fulfill({ json: { dettagli: {
    P1: { synthesis: "x", tags: [], verdict: "Tramonto sulle cupole, tavoli lontani tra loro.", goFor: ["vista cupole"], dontExpect: [], matchReason: "Ha una vera terrazza.", perTe: "il tipo di posto tranquillo che ami" },
    P3: { synthesis: "x", tags: [], verdict: "Cocktail curati sul tetto.", goFor: ["cocktail"], dontExpect: [], matchReason: "È su un rooftop.", perTe: null },
  }, esclusi: [] } }));
  await pp.goto(`${BASE}/mappa?q=${encodeURIComponent("rooftop romantico a Roma")}`, { waitUntil: "networkidle" });
  const c1 = pp.getByTestId("card-risultato").first();
  await c1.getByTestId("per-te-card").waitFor({ timeout: 10000 }).catch(() => {});
  ok(await c1.getByTestId("per-te-card").getByText("Per te: il tipo di posto tranquillo che ami").isVisible() && (await c1.getByTestId("punti-forti").count()) === 0, "per te: riga 'Per te' nella card al posto delle chip");
  ok((await pp.getByTestId("card-risultato").nth(1).getByTestId("per-te-card").count()) === 0 && (await pp.getByTestId("card-risultato").nth(1).getByTestId("punti-forti").count()) === 1, "per te: senza 'Per te' dall'AI restano le chip, niente frase inventata");
  const card = await c1.boundingBox();
  const fatti = await c1.getByTestId("riga-fatti").boundingBox();
  ok(card && fatti && fatti.y > card.y + 8, `per te: a 360px il contenuto sta dentro la card (fatti a ${Math.round((fatti?.y ?? 0) - (card?.y ?? 0))}px dal bordo)`);
  await pp.screenshot({ path: `${OUT}/40-per-te-card.png`, caret: "initial" });
  await pctx.close();
}

// 13. Condividi un locale: link Mapetite (/locali/<UUID>) e pagina pubblica per chi lo riceve.
{
  // Dalla scheda di un risultato di ricerca (id = Google Place ID): /api/places/add simulato restituisce l'UUID.
  const SHARE_UUID = "44444444-0000-4000-8000-000000000004";
  const cctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const addCalls = [];
  let addOk = true;
  const cEvents = [];
  await cctx.route("**/api/events", (r) => { cEvents.push(r.request().postDataJSON()); return r.fulfill({ status: 204, body: "" }); });
  await cctx.route("**/api/search", (r) => r.fulfill({ json: SEARCH_FAST }));
  await cctx.route("**/api/search/synthesis", (r) => r.fulfill({ json: SYNTH }));
  await cctx.route("**/api/places/photo**", (r) => r.fulfill({ status: 429, json: {} }));
  await cctx.route("**/api/places/add", (r) => { addCalls.push(r.request().postDataJSON()); return addOk ? r.fulfill({ json: { place: { id: SHARE_UUID } } }) : r.fulfill({ status: 401, json: { error: "Devi accedere per aggiungere un locale." } }); });
  await cctx.route("**/rest/v1/**", (r) => r.request().method() === "GET" ? r.fulfill({ json: [] }) : r.fulfill({ status: 201, body: "" }));
  const c = await cctx.newPage();
  c.on("pageerror", (e) => errors.push(e.message));
  await c.goto(`${BASE}/mappa`, { waitUntil: "networkidle" });
  await (await esempio(c)).click();
  await c.getByText("Vista vera sui tetti di Roma.").first().waitFor({ timeout: 6000 });
  await c.getByText("Terrazza Uno").first().click();
  await c.getByTestId("verdetto-scheda").waitFor({ timeout: 4000 });
  await c.evaluate(() => { window.__sharedPlace = null; navigator.share = async (d) => { window.__sharedPlace = d; }; });
  await c.getByLabel("Condividi Terrazza Uno").click();
  await c.waitForFunction(() => window.__sharedPlace != null, null, { timeout: 4000 }).catch(() => {});
  const sp = await c.evaluate(() => window.__sharedPlace);
  ok(!!sp && sp.url === `${new URL(BASE).origin}/locali/${SHARE_UUID}?foto=places/P1/photos/AbC_P1`, `condividi locale: link Mapetite /locali/<UUID> con la foto (${sp?.url ?? "nessuno"})`);
  ok(sp?.text === "Terrazza Uno — Vista vera sui tetti di Roma. · su Mapetite", `condividi locale: testo "nome — verdetto · su Mapetite" (${sp?.text ?? ""})`);
  ok(addCalls.length === 1 && addCalls[0]?.googlePlaceId === "P1" && addCalls[0]?.name === "Terrazza Uno" && addCalls[0]?.firma === "firma-P1", "condividi locale (con la firma del server): il risultato di ricerca diventa una riga in places con /api/places/add (Place ID Google)");
  ok(cEvents.some((e) => e?.type === "condividi"), "condividi locale: segnale 'condividi' registrato");
  await c.evaluate(() => { window.__sharedPlace = null; });
  await c.getByLabel("Condividi Terrazza Uno").click();
  await c.waitForFunction(() => window.__sharedPlace != null, null, { timeout: 4000 }).catch(() => {});
  ok(addCalls.length === 1, "condividi locale: il secondo tocco riusa il link già creato (nessuna nuova richiesta)");
  // Senza accesso (/api/places/add rifiuta): si torna al link di Google Maps.
  addOk = false;
  await c.goto(`${BASE}/mappa`, { waitUntil: "networkidle" });
  await (await esempio(c)).click();
  await c.getByText("Vista vera sui tetti di Roma.").first().waitFor({ timeout: 6000 });
  await c.getByText("Terrazza Uno").first().click();
  await c.getByTestId("verdetto-scheda").waitFor({ timeout: 4000 });
  await c.evaluate(() => { window.__sharedPlace = null; navigator.share = async (d) => { window.__sharedPlace = d; }; });
  await c.getByLabel("Condividi Terrazza Uno").click();
  await c.waitForFunction(() => window.__sharedPlace != null, null, { timeout: 4000 }).catch(() => {});
  const sp2 = await c.evaluate(() => window.__sharedPlace);
  ok(!!sp2 && sp2.url.startsWith("https://www.google.com/maps/search/") && !sp2.text.includes("su Mapetite"), `condividi locale: se il link Mapetite non si crea, resta Google Maps (${sp2?.url?.slice(0, 40) ?? "nessuno"})`);
  await cctx.close();
}
if (!fakeUser) console.log("SKIP  pagina pubblica del locale: dev server senza E2E_FAKE_USER");
else {
  // Pagina pubblica: il server la legge da Supabase; nel test i dati finti arrivano dal cookie "e2e_locale".
  const LOC_ID = "44444444-0000-4000-8000-000000000004";
  const locale = {
    place: { id: LOC_ID, name: "Trattoria del Vicolo", address: "Via del Moro 12, 00153 Roma RM, Italy", lat: 41.889, lng: 12.469, category: "restaurant", rating: 4.6, price_level: 2, google_place_id: "GVICOLO" },
    synthesis: { verdict: "Cucina romana di quartiere, lontana dai giri turistici.", synthesis: "Carbonara e cacio e pepe come una volta, sala piccola e vivace, servizio di famiglia.", go_for: ["cena tra amici", "cucina romana"], dont_expect: ["serata silenziosa"] },
  };
  const pctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await pctx.addCookies([{ name: "e2e_locale", value: encodeURIComponent(JSON.stringify(locale)), url: BASE }]);
  const pubPhotos = [];
  await pctx.route("**/api/places/photo**", (r) => { pubPhotos.push(r.request().url()); return r.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#b9774a"/><stop offset="1" stop-color="#5b3a24"/></linearGradient></defs><rect width="400" height="300" fill="url(#g)"/></svg>' }); });
  let pubInsert = null;
  await pctx.route("**/rest/v1/saved_places**", (r) => {
    if (r.request().method() === "POST") { pubInsert = r.request().postDataJSON(); return r.fulfill({ status: 201, body: "" }); }
    return r.fulfill({ json: [] });
  });
  const pp = await pctx.newPage();
  pp.on("pageerror", (e) => errors.push(e.message));
  const pres = await pp.goto(`${BASE}/locali/${LOC_ID}?foto=places/GVICOLO/photos/AbC_1`, { waitUntil: "networkidle" });
  ok(pres?.status() === 200 && (await pp.getByRole("heading", { level: 1 }).textContent()) === "Trattoria del Vicolo", "pagina pubblica: si apre con il nome del locale");
  ok((await pp.title()) === "Trattoria del Vicolo · Roma · Mapetite", `pagina pubblica: titolo per l'anteprima (${await pp.title()})`);
  const ogDesc = await pp.locator('meta[property="og:description"]').getAttribute("content").catch(() => null);
  const ogImg = await pp.locator('meta[property="og:image"]').first().getAttribute("content").catch(() => null);
  ok(ogDesc === "Il verdetto Mapetite: Cucina romana di quartiere, lontana dai giri turistici." && !!ogImg && ogImg.includes(`/locali/${LOC_ID}/opengraph-image`), "pagina pubblica: anteprima WhatsApp con verdetto e immagine");
  if (ogImg) { const img = await pp.request.get(ogImg.replace(/^https?:\/\/[^/]+/, BASE)); ok(img.status() === 200 && (img.headers()["content-type"] ?? "").startsWith("image/png"), `pagina pubblica: immagine di anteprima generata (${img.status()})`); }
  ok((await pp.getByTestId("locale-tipo").textContent()) === "Ristorante · €€ · ★ 4,6", "pagina pubblica: riga 'tipo · prezzo · voto'");
  const vbox = pp.getByTestId("verdetto-pubblico");
  ok(await vbox.getByText("Il verdetto Mapetite").isVisible() && await vbox.getByText("Cucina romana di quartiere, lontana dai giri turistici.").isVisible() && await vbox.getByText("cena tra amici").isVisible() && await vbox.getByText("serata silenziosa").isVisible(), "pagina pubblica: riquadro 'Il verdetto Mapetite' con sintesi e chip");
  ok((await pp.getByRole("link", { name: "Percorso" }).getAttribute("href")) === "https://www.google.com/maps/dir/?api=1&destination=41.889,12.469", "pagina pubblica: 'Percorso' porta alle indicazioni");
  ok(((await pp.getByRole("link", { name: "Apri su Google Maps" }).getAttribute("href")) ?? "").includes("query_place_id=GVICOLO"), "pagina pubblica: 'Apri su Google Maps' con il Place ID");
  ok(pubPhotos.some((u) => decodeURIComponent(u).includes("ref=places/GVICOLO/photos/AbC_1")) && await pp.locator("main img").first().evaluate((i) => i.complete && i.naturalWidth > 0), "pagina pubblica: foto del locale dal proxy in cache");
  ok(!(await pp.content()).includes(", Italy<"), "pagina pubblica: indirizzo senza ', Italy' in fondo");
  await pp.waitForTimeout(300);
  mkdirSync("docs/autonomia/screenshots/2026-10-13-notte", { recursive: true });
  await pp.screenshot({ path: "docs/autonomia/screenshots/2026-10-13-notte/locale-pubblico.png", caret: "initial" });
  await pp.screenshot({ path: `${OUT}/50-locale-pubblico.png`, caret: "initial", fullPage: true });
  // Salva in Mapetite (collegato): saved_places con "Da provare" e l'UUID del locale.
  await pp.getByRole("button", { name: "📌 Salva in Mapetite" }).click();
  await pp.getByTestId("salvato-pubblico").waitFor({ timeout: 4000 }).catch(() => {});
  ok(await pp.getByTestId("salvato-pubblico").isVisible() && pubInsert?.place_id === LOC_ID && JSON.stringify(pubInsert?.tags) === '["Da provare"]' && pubInsert?.user_id === "00000000-0000-0000-0000-000000000001", "pagina pubblica: 'Salva in Mapetite' salva come '📌 Voglio andarci' e lo conferma");
  ok((await pp.getByRole("link", { name: "Aprilo sulla tua mappa" }).getAttribute("href")) === `/mappa?salvato=${LOC_ID}`, "pagina pubblica: dopo il salvataggio porta al locale sulla mappa");
  ok((await pp.locator('main a[href="/"]').filter({ hasText: "Mapetite" }).count()) > 0 && (await pp.getByTestId("invito-mapetite").count()) === 0, "pagina pubblica: il marchio porta alla home; da collegati nessun riquadro d'invito (solo 'Salva')");
  // Foto di un altro locale nel link: ignorata (resta l'emoji).
  const before = pubPhotos.length;
  await pp.goto(`${BASE}/locali/${LOC_ID}?foto=places/ALTRO/photos/XyZ`, { waitUntil: "networkidle" });
  ok(pubPhotos.length === before && (await pp.locator("main img").count()) === 0, "pagina pubblica: una foto che non è di questo locale viene ignorata");
  // Senza verdetto in cache: niente riquadro (mai testo inventato).
  await pctx.addCookies([{ name: "e2e_locale", value: encodeURIComponent(JSON.stringify({ ...locale, synthesis: null })), url: BASE }]);
  await pp.goto(`${BASE}/locali/${LOC_ID}`, { waitUntil: "networkidle" });
  ok((await pp.getByTestId("verdetto-pubblico").count()) === 0 && await pp.getByRole("heading", { name: "Trattoria del Vicolo" }).isVisible(), "pagina pubblica: senza verdetto in cache il riquadro non compare");
  // Da disconnessi: "Salva in Mapetite" porta a Crea un account.
  await pctx.addCookies([{ name: "e2e_anonimo", value: "1", url: BASE }]);
  await pp.goto(`${BASE}/locali/${LOC_ID}`, { waitUntil: "networkidle" });
  ok(await pp.getByTestId("invito-accedi").isVisible(), "pagina pubblica da disconnessi: spiega di creare un account e poi tornare qui");
  ok(((await pp.getByTestId("community-pubblica").textContent()) ?? "").includes("Accedi per dire com'era"), "pagina pubblica da disconnessi: 'Accedi per dire com'era' con lo spazio (era 'Accediper')");
  const back = encodeURIComponent(`/locali/${LOC_ID}?salva=1`);
  ok(await pp.getByTestId("invito-accedi").getByRole("link", { name: "Hai già un account? Accedi" }).getAttribute("href") === `/login?next=${back}`, "pagina pubblica da disconnessi: 'Accedi' riporta al locale (next)");
  ok(await pp.getByRole("link", { name: "Entra" }).first().getAttribute("href") === `/login?next=${encodeURIComponent(`/locali/${LOC_ID}`)}`, "pagina pubblica da disconnessi: 'Entra' nella barra riporta al locale");
  await pp.getByRole("link", { name: "📌 Salva in Mapetite" }).click();
  await pp.waitForURL((u) => u.pathname === "/signup" && u.searchParams.get("next") === `/locali/${LOC_ID}?salva=1`, { timeout: 5000 }).then(() => ok(true, "pagina pubblica da disconnessi: 'Salva in Mapetite' porta a Crea un account con il ritorno al locale"), () => ok(false, `pagina pubblica da disconnessi: 'Salva in Mapetite' porta a Crea un account con il ritorno al locale (${pp.url()})`));
  ok(JSON.stringify(await pp.locator("form input[type=hidden][name=next]").evaluateAll((els) => els.map((e) => e.value))) === JSON.stringify([`/locali/${LOC_ID}?salva=1`]) && await pp.getByTestId("auth-ritorno").isVisible(), "registrazione dal locale: next nel modulo e frase 'poi torni al locale'");
  // Con la foto nel link condiviso il ritorno la conserva.
  await pp.goto(`${BASE}/locali/${LOC_ID}?foto=places/GVICOLO/photos/AbC_1`, { waitUntil: "networkidle" });
  ok(await pp.getByRole("link", { name: "📌 Salva in Mapetite" }).getAttribute("href") === `/signup?next=${encodeURIComponent(`/locali/${LOC_ID}?salva=1&foto=${encodeURIComponent("places/GVICOLO/photos/AbC_1")}`)}`, "pagina pubblica da disconnessi: il ritorno conserva la foto del locale");
  // Di ritorno dopo l'accesso (?salva=1): pulsante in evidenza, ma si salva SOLO al tocco.
  await pctx.clearCookies({ name: "e2e_anonimo" });
  pubInsert = null;
  await pp.goto(`${BASE}/locali/${LOC_ID}?salva=1`, { waitUntil: "networkidle" });
  await pp.waitForTimeout(400);
  ok(await pp.getByTestId("salva-evidenziato").isVisible() && await pp.getByRole("button", { name: "📌 Salva in Mapetite" }).isVisible() && pubInsert === null, "ritorno al locale (?salva=1): 'Salva' in evidenza, nessun salvataggio senza tocco");
  await pp.screenshot({ path: `${OUT}/51-locale-ritorno-salva.png`, caret: "initial" });
  await pp.getByRole("button", { name: "📌 Salva in Mapetite" }).click();
  await pp.getByTestId("salvato-pubblico").waitFor({ timeout: 4000 }).catch(() => {});
  ok(await pp.getByTestId("salvato-pubblico").isVisible() && pubInsert?.place_id === LOC_ID, "ritorno al locale: un tocco e il locale è salvato");
  await pp.goto(`${BASE}/locali/${LOC_ID}`, { waitUntil: "networkidle" });
  ok((await pp.getByTestId("salva-evidenziato").count()) === 0, "locale aperto normalmente: nessuna evidenza sul pulsante");
  // Id sconosciuto o non valido: 404 in italiano.
  const r404a = await pp.goto(`${BASE}/locali/non-esiste`, { waitUntil: "networkidle" });
  ok(r404a?.status() === 404 && await pp.getByText("Questa pagina non esiste").isVisible(), "pagina pubblica: id non valido → 404 in italiano");
  const r404b = await pp.goto(`${BASE}/locali/44444444-0000-4000-8000-000000000999`, { waitUntil: "networkidle" });
  ok(r404b?.status() === 404, "pagina pubblica: UUID sconosciuto → 404");
  await pctx.close();
}

// 14. Social (piano 5.1–5.4): profilo pubblico, mappa di una persona, Amici, "N amici ci sono stati".
//     Il server legge i dati finti dal cookie "e2e_social"; senza cookie la parte social è "in arrivo"
//     (come in produzione finché la migrazione 20261015_social non è applicata).
if (!fakeUser) console.log("SKIP  social: dev server senza E2E_FAKE_USER");
else {
  const ME = "00000000-0000-0000-0000-000000000001";
  const GIULIA = "00000000-0000-4000-8000-0000000005a1";
  const MARCO = "00000000-0000-4000-8000-0000000005a2";
  const LOC_SOC = "44444444-0000-4000-8000-000000000005";
  const prof = (id, handle, display_name, extra = {}) => ({ id, handle, display_name, bio: null, city: "Roma", visitati: 0, da_provare: 0, seguaci: 0, seguiti: 0, ...extra });
  const sv = (user_id, handle, display_name, place_id, name, category, tags, created_at, lat, lng) => ({ user_id, handle, display_name, place_id, name, category, tags, created_at, address: "Via del Moro 12, 00153 Roma RM, Italy", lat, lng });
  const giulia = prof(GIULIA, "giulia.rm", "Giulia", { bio: "Trattorie di quartiere e vini naturali", visitati: 1, da_provare: 2, seguaci: 3, seguiti: 2 });
  const marco = prof(MARCO, "marco", "Marco", { city: "Milano" });
  const oggi = new Date().toISOString();
  const social = {
    profili: [giulia, marco],
    salvati: [
      sv(GIULIA, "giulia.rm", "Giulia", LOC_SOC, "Trattoria del Vicolo", "restaurant", ["Già visitato", "Romantico"], oggi, 41.889, 12.469),
      sv(GIULIA, "giulia.rm", "Giulia", "44444444-0000-4000-8000-000000000006", "Bar Nero", "bar", ["Da provare", "Romantico"], "2026-10-10T18:00:00Z", 41.893, 12.473),
      sv(GIULIA, "giulia.rm", "Giulia", "44444444-0000-4000-8000-000000000007", "Forno Sud", "bakery", ["Economico"], "2026-10-09T09:00:00Z", 41.88, 12.48),
      sv(MARCO, "marco", "Marco", "44444444-0000-4000-8000-000000000008", "Osteria Milano", "restaurant", ["Da provare"], oggi, 45.48, 9.19),
    ],
    seguo: [GIULIA],
    mio: { handle: null, display_name: null, bio: null, city: null, is_public: false },
    // Verdetti Mapetite (18/10): sulle card del feed come la riga di descrizione di Places. Osteria Milano è di chi non segui.
    verdetti: { [LOC_SOC]: "Cucina romana vera, tavoli fuori nel vicolo.", "44444444-0000-4000-8000-000000000008": "Non deve comparire" },
  };
  const setSocial = (c, v) => c.addCookies([{ name: "e2e_social", value: encodeURIComponent(JSON.stringify(v)), url: BASE }]);
  const soctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const socEvents = [];
  await soctx.route("**/api/events", (r) => { socEvents.push(r.request().postDataJSON()); return r.fulfill({ status: 204, body: "" }); });
  await soctx.route("**/api/places/photo**", (r) => r.fulfill({ status: 429, json: {} }));
  await soctx.route("**/rest/v1/saved_places**", (r) => r.fulfill({ json: [] }));
  const sp = await soctx.newPage();
  sp.on("pageerror", (e) => errors.push(e.message));

  // In arrivo: senza dati social (migrazione non applicata) nessuna pagina si rompe.
  await soctx.addCookies([{ name: "e2e_profilo", value: encodeURIComponent(JSON.stringify({ email: "tester@example.com", saved: [], reviews: [] })), url: BASE }]);
  const rIn = await sp.goto(`${BASE}/u/giulia.rm`, { waitUntil: "networkidle" });
  ok(rIn?.status() === 200 && await sp.getByTestId("profilo-pubblico-in-arrivo").getByTestId("social-in-arrivo").isVisible(), "social in arrivo: /u/<nome> dice 'in arrivo' invece di rompersi");
  await sp.goto(`${BASE}/amici`, { waitUntil: "networkidle" });
  ok(await sp.getByTestId("social-in-arrivo").isVisible(), "social in arrivo: /amici dice 'in arrivo'");
  await sp.goto(`${BASE}/profilo#profilo-pubblico`, { waitUntil: "networkidle" });
  ok(await sp.getByTestId("profilo-social-in-arrivo").isVisible(), "social in arrivo: nel profilo il riquadro 'Profilo pubblico' è 'in arrivo'");
  ok(await sp.locator("nav").first().getByRole("link", { name: "Amici" }).getAttribute("href") === "/amici", "barra in basso: voce 'Amici'");

  // Profilo pubblico da chi non ha l'account (link condiviso).
  await setSocial(soctx, social);
  await soctx.addCookies([{ name: "e2e_anonimo", value: "1", url: BASE }]);
  await sp.goto(`${BASE}/u/giulia.rm`, { waitUntil: "networkidle" });
  ok((await sp.getByRole("heading", { level: 1 }).textContent()) === "Giulia" && await sp.getByText("@giulia.rm").isVisible() && await sp.getByTestId("profilo-bio").isVisible(), "profilo pubblico: nome, @nome e bio");
  ok((await sp.title()) === "Giulia (@giulia.rm) · Mapetite", `profilo pubblico: titolo per l'anteprima (${await sp.title()})`);
  { const n = async (id) => (await sp.getByTestId(`numero-${id}`).textContent())?.replace(/\s+/g, " ").trim();
    ok((await n("visitati")) === "1Visitati" && (await n("da-provare")) === "2Da provare" && (await n("seguaci")) === "3Seguaci" && (await n("seguiti")) === "2Seguiti", "profilo pubblico: numeri visitati / da provare / seguaci / seguiti"); }
  { const chips = await sp.getByTestId("profilo-raccolte").innerText(); ok(chips.includes("Romantico") && chips.includes("· 2") && chips.includes("Economico") && !chips.includes("Già visitato") && !chips.includes("Da provare"), "profilo pubblico: raccolte come tag (senza gli stati)"); }
  ok((await sp.getByRole("heading", { name: "Già provati", exact: true }).isVisible()) && (await sp.getByRole("heading", { name: "Da provare", exact: true }).isVisible()) && (await sp.getByTestId("posto-persona").count()) === 3, "profilo pubblico: 'Già provati' e 'Da provare' con i posti");
  ok((await sp.getByTestId("posto-persona-verdetto").allTextContents()).join("|") === "Cucina romana vera, tavoli fuori nel vicolo.", "profilo pubblico: il verdetto Mapetite sotto il posto che ce l'ha");
  ok(await sp.getByTestId("posto-persona").first().getAttribute("href") === `/locali/${LOC_SOC}`, "profilo pubblico: un posto apre la sua pagina pubblica");
  await sp.getByTestId("mappa-persona").waitFor({ timeout: 8000 }).catch(() => {});
  ok(await sp.getByTestId("mappa-persona").isVisible(), "profilo pubblico: mappa dei suoi posti");
  await sp.getByTestId("pin-persona").first().waitFor({ timeout: 8000 }).catch(() => {});
  ok((await sp.getByTestId("pin-persona").count()) === 3, `profilo pubblico: un pin per ogni posto (${await sp.getByTestId("pin-persona").count()})`);
  ok(await sp.getByTestId("segui").getAttribute("href") === `/signup?next=${encodeURIComponent("/u/giulia.rm")}`, "profilo pubblico senza account: 'Segui' porta a Crea un account e poi torna qui");
  ok(await sp.getByTestId("invito-crea-mappa").getByText("Crea la tua mappa su Mapetite").isVisible() && await sp.getByTestId("invito-crea-mappa").getByRole("link", { name: "Crea la tua mappa, è gratis" }).getAttribute("href") === `/signup?next=${encodeURIComponent("/u/giulia.rm")}`, "profilo pubblico senza account: invito 'Crea la tua mappa su Mapetite' in fondo");
  await sp.waitForTimeout(500);
  await sp.screenshot({ path: `${OUT}/60-profilo-pubblico.png`, caret: "initial" });
  await sp.screenshot({ path: `${OUT}/60b-profilo-pubblico-intero.png`, caret: "initial", fullPage: true });
  // Condividi: menu del telefono con il link al profilo, segnale "condividi".
  await sp.evaluate(() => { window.__shared = null; navigator.share = async (d) => { window.__shared = d; }; });
  await sp.getByTestId("condividi-profilo").click();
  await sp.waitForFunction(() => window.__shared != null, null, { timeout: 3000 }).catch(() => {});
  ok((await sp.evaluate(() => window.__shared?.url)) === `${new URL(BASE).origin}/u/giulia.rm`, "condividi profilo: menu del telefono con il link /u/<nome>");
  await sp.waitForTimeout(200);
  ok(socEvents.some((e) => e.type === "condividi" && e.props?.contesto === "profilo"), "condividi profilo: segnale 'condividi' (contesto: profilo)");
  // Mappa della persona a tutta pagina, con condivisione che ripiega sulla copia del link.
  await sp.getByTestId("apri-mappa-persona").click();
  await sp.waitForURL(/\/u\/giulia\.rm\/mappa$/, { timeout: 5000 });
  await sp.getByTestId("mappa-persona-pagina").waitFor({ timeout: 5000 });
  ok(await sp.getByTestId("mappa-persona-pagina").getByText("La mappa di Giulia").isVisible() && await sp.getByTestId("invito-crea-mappa").isVisible(), "mappa di una persona: si apre senza account, con l'invito in fondo");
  await sp.getByTestId("pin-persona").first().waitFor({ timeout: 8000 }).catch(() => {});
  await sp.waitForTimeout(500);
  await sp.screenshot({ path: `${OUT}/61-mappa-persona.png`, caret: "initial" });
  await sp.evaluate(() => { window.__copied = null; Object.defineProperty(navigator, "share", { configurable: true, value: undefined }); Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async (t) => { window.__copied = t; } } }); });
  await sp.getByTestId("condividi-mappa").click();
  await sp.getByTestId("condividi-mappa").getByText("✓ Link copiato").waitFor({ timeout: 3000 }).catch(() => {});
  ok((await sp.evaluate(() => window.__copied)) === `${new URL(BASE).origin}/u/giulia.rm/mappa` && await sp.getByTestId("condividi-mappa").getByText("✓ Link copiato").isVisible(), "condividi mappa: senza menu del telefono copia il link e lo dice");
  await sp.waitForTimeout(200);
  ok(socEvents.some((e) => e.type === "condividi" && e.props?.contesto === "mappa"), "condividi mappa: segnale 'condividi' (contesto: mappa)");
  { const lost = droppedKeys(socEvents.filter((e) => e.type === "condividi"));
    ok(lost.length === 0, `condividi (profilo, mappa, raccolta): chiavi conservate dal server (${lost.join(", ") || "nessuna scartata"})`); }
  // Profilo privato o inesistente: messaggio chiaro, niente errore.
  await sp.goto(`${BASE}/u/nessuno.qui`, { waitUntil: "networkidle" });
  ok(await sp.getByTestId("profilo-non-trovato").getByText("Profilo non disponibile").isVisible(), "profilo privato o inesistente: 'Profilo non disponibile'");
  await sp.goto(`${BASE}/amici`, { waitUntil: "networkidle" });
  ok(await sp.getByTestId("amici-accedi").isVisible(), "amici senza account: invito ad accedere");
  await soctx.clearCookies({ name: "e2e_anonimo" });

  // Con l'accesso: Segui / Segui già scrivono in follows.
  const follows = [];
  await soctx.route("**/rest/v1/follows**", (r) => { follows.push({ method: r.request().method(), url: decodeURIComponent(r.request().url()), body: r.request().postDataJSON?.() ?? null }); return r.fulfill({ status: r.request().method() === "POST" ? 201 : 204, body: "" }); });
  await sp.goto(`${BASE}/u/giulia.rm`, { waitUntil: "networkidle" });
  ok((await sp.getByTestId("segui").getAttribute("aria-pressed")) === "true" && (await sp.getByTestId("segui").textContent()) === "Segui già" && (await sp.getByTestId("invito-crea-mappa").count()) === 0, "profilo di chi segui: 'Segui già', nessun invito a registrarsi");
  await sp.getByTestId("segui").click();
  await sp.getByTestId("segui").getByText("Segui", { exact: true }).waitFor({ timeout: 4000 }).catch(() => {});
  ok(follows.some((f) => f.method === "DELETE" && f.url.includes(`follower_id=eq.${ME}`) && f.url.includes(`followed_id=eq.${GIULIA}`)) && (await sp.getByTestId("segui").getAttribute("aria-pressed")) === "false", "smetti di seguire: cancella solo il proprio follow");
  await sp.getByTestId("segui").click();
  await sp.getByTestId("segui").getByText("Segui già").waitFor({ timeout: 4000 }).catch(() => {});
  ok(follows.some((f) => f.method === "POST" && f.body?.follower_id === ME && f.body?.followed_id === GIULIA) && (await sp.getByTestId("segui").getAttribute("aria-pressed")) === "true", "segui: scrive il follow a proprio nome");

  // Amici: chi segui, attività raggruppata, ricerca persone.
  await sp.goto(`${BASE}/amici`, { waitUntil: "networkidle" });
  ok(await sp.getByTestId("seguiti").getByText("Giulia").isVisible(), "amici: riga di chi segui");
  { const att = sp.getByTestId("attivita");
    const first = (await att.first().innerText()).replace(/\s+/g, " ");
    ok((await att.count()) === 1 && first.includes("Giulia ha provato Trattoria del Vicolo e altri 2 posti") && first.includes("oggi"), `amici: attività raggruppata per persona (${first.slice(0, 70)})`);
    ok((await att.first().getByTestId("card-attivita").count()) === 3 && await att.first().getByTestId("card-attivita").first().getAttribute("href") === `/locali/${LOC_SOC}`, "amici: card dei locali che aprono la pagina del locale");
    ok(!(await sp.content()).includes("Osteria Milano"), "amici: niente attività di chi non segui");
    { const v = att.first().getByTestId("card-attivita").first().getByTestId("card-attivita-verdetto");
      ok((await v.textContent()) === "Cucina romana vera, tavoli fuori nel vicolo." && (await att.first().getByTestId("card-attivita-verdetto").count()) === 1 && !(await sp.content()).includes("Non deve comparire"), "amici: sulle card il verdetto Mapetite, solo dove c'è"); } }
  ok(await sp.getByTestId("amici-rendi-pubblico").isVisible() && (await sp.getByTestId("amici-rendi-pubblico").getAttribute("href")) === "/profilo#profilo-pubblico", "amici: invito a rendere pubblico il proprio profilo (oggi privato)");
  // Gerarchia (semplificazione 16/10): ricerca in alto, ingressi compatti, poi chi segui e l'attività.
  { const top = async (id) => (await sp.getByTestId(id).first().boundingBox())?.y ?? -1;
    const [cerca, ingressi, seguiti, attivita] = [await sp.getByLabel("Cerca persone per nome").boundingBox().then((b) => b?.y ?? -1), await top("amici-ingressi"), await top("seguiti"), await top("attivita")];
    ok(cerca > 0 && cerca < ingressi && ingressi < seguiti && seguiti < attivita && attivita < 844, `amici: ricerca → ingressi → chi segui → attività, l'attività già nel primo schermo (${[cerca, ingressi, seguiti, attivita].map(Math.round).join(" < ")})`);
    ok((await sp.getByTestId("amici-ingressi").getByTestId("amici-gruppi").getAttribute("href")) === "/gruppi", "amici: ingresso compatto 'Liste di gruppo'");
    ok((await sp.getByTestId("amici-ingressi").getByTestId("amici-invita").getAttribute("href")) === "/profilo#invita", "amici: 'Invita un amico' porta al proprio link d'invito"); }
  await sp.screenshot({ path: `${OUT}/62-amici.png`, caret: "initial" });
  let searchUrl = null;
  await soctx.route("**/rest/v1/profili_pubblici**", (r) => { searchUrl = decodeURIComponent(r.request().url()); return r.fulfill({ json: [{ id: MARCO, handle: "marco", display_name: "Marco", city: "Milano" }] }); });
  await sp.getByLabel("Cerca persone per nome").fill("@Mar");
  await sp.getByTestId("persona").first().waitFor({ timeout: 4000 }).catch(() => {});
  ok(await sp.getByTestId("persona").getByText("Marco", { exact: true }).isVisible() && !!searchUrl && searchUrl.includes("handle.ilike.mar%"), "amici: cerca persone per nome (solo profili pubblici)");
  follows.length = 0;
  await sp.getByTestId("persona").getByTestId("segui").click();
  await sp.getByTestId("persona").getByText("Segui già").waitFor({ timeout: 4000 }).catch(() => {});
  ok(follows.some((f) => f.method === "POST" && f.body?.followed_id === MARCO), "amici: 'Segui' dai risultati della ricerca");
  await sp.screenshot({ path: `${OUT}/63-amici-cerca.png`, caret: "initial" });

  // Impostazioni del profilo pubblico (in /profilo): spento di default, testo chiaro, nome ripulito.
  let profPatch = null;
  let profStatus = 204;
  await soctx.route("**/rest/v1/profiles**", (r) => {
    if (r.request().method() === "PATCH") { profPatch = r.request().postDataJSON(); return profStatus === 204 ? r.fulfill({ status: 204, body: "" }) : r.fulfill({ status: 409, json: { code: "23505", message: "duplicate key", details: null, hint: null } }); }
    return r.fulfill({ json: [] });
  });
  // Da Amici "Fatti trovare" porta qui: la riga "Profilo pubblico" di "Altro" si apre da sola.
  await sp.goto(`${BASE}/profilo#profilo-pubblico`, { waitUntil: "networkidle" });
  const ps = sp.getByTestId("profilo-social");
  ok(await ps.isVisible() && (await ps.getByTestId("profilo-stato").textContent())?.includes("Privato") && !(await ps.getByRole("switch").isChecked()), "profilo: 'Profilo pubblico' spento di default");
  ok((await ps.getByTestId("privacy-testo").textContent())?.includes("nessuno vede il tuo profilo"), "profilo: testo chiaro sulla privacy");
  await ps.locator("input[name=handle]").fill("@Lorenzo Mà!");
  ok((await ps.locator("input[name=handle]").inputValue()) === "lorenzoma", "profilo: il nome pubblico si ripulisce da solo (minuscole, niente spazi né accenti)");
  await ps.locator("input[name=display_name]").fill("Lorenzo");
  await ps.locator("input[name=city]").fill("Roma");
  await ps.locator("label", { hasText: "Rendi pubblico il mio profilo" }).click();
  ok((await ps.getByTestId("privacy-testo").textContent())?.includes("Le note private non si vedono mai"), "profilo: acceso, spiega cosa vedranno gli altri (mai le note)");
  profStatus = 409;
  await ps.getByRole("button", { name: "Salva" }).click();
  await ps.getByRole("alert").waitFor({ timeout: 4000 }).catch(() => {});
  ok((await ps.getByRole("alert").textContent())?.includes("è già preso"), "profilo: nome già preso spiegato in italiano");
  profStatus = 204;
  profPatch = null;
  await ps.getByRole("button", { name: "Salva" }).click();
  await ps.getByTestId("profilo-condividi").waitFor({ timeout: 4000 }).catch(() => {});
  ok(profPatch?.handle === "lorenzoma" && profPatch?.is_public === true && profPatch?.display_name === "Lorenzo" && profPatch?.city === "Roma" && !("note" in (profPatch ?? {})), "profilo: salva nome pubblico, nome, città e 'pubblico'");
  ok(await ps.getByTestId("profilo-condividi").isVisible() && (await ps.getByTestId("profilo-stato").textContent())?.includes("Pubblico") && await ps.getByTestId("vedi-profilo-pubblico").getAttribute("href") === "/u/lorenzoma", "profilo: dopo il salvataggio, condividi profilo e mappa");
  await ps.scrollIntoViewIfNeeded();
  await ps.screenshot({ path: `${OUT}/64-profilo-impostazioni.png`, caret: "initial" });
  await sp.evaluate(() => { window.__shared = null; navigator.share = async (d) => { window.__shared = d; }; });
  await ps.getByTestId("condividi-mia-mappa").click();
  await sp.waitForFunction(() => window.__shared != null, null, { timeout: 3000 }).catch(() => {});
  ok((await sp.evaluate(() => window.__shared?.url)) === `${new URL(BASE).origin}/u/lorenzoma/mappa`, "profilo: 'Condividi mappa' manda il link alla propria mappa");

  // Pagina pubblica del locale: "1 amico ci è stato".
  const locSoc = { place: { id: LOC_SOC, name: "Trattoria del Vicolo", address: "Via del Moro 12, 00153 Roma RM, Italy", lat: 41.889, lng: 12.469, category: "restaurant", rating: 4.6, price_level: 2, google_place_id: "GVICOLO2" }, synthesis: null };
  await soctx.addCookies([{ name: "e2e_locale", value: encodeURIComponent(JSON.stringify(locSoc)), url: BASE }]);
  await sp.goto(`${BASE}/locali/${LOC_SOC}`, { waitUntil: "networkidle" });
  ok((await sp.getByTestId("amici-qui").textContent())?.includes("1 amico ci è stato") && await sp.getByTestId("amici-qui").getByRole("link", { name: "Giulia" }).getAttribute("href") === "/u/giulia.rm", "pagina del locale: '1 amico ci è stato' con il link al profilo");
  await sp.screenshot({ path: `${OUT}/65-locale-amici.png`, caret: "initial" });
  await setSocial(soctx, { ...social, seguo: [] });
  await sp.goto(`${BASE}/locali/${LOC_SOC}`, { waitUntil: "networkidle" });
  ok((await sp.getByTestId("amici-qui").count()) === 0, "pagina del locale: senza amici che ci sono stati non compare nulla");

  // Telefono piccolo (360px): niente scorrimento orizzontale sulle pagine nuove.
  await setSocial(soctx, social);
  await sp.setViewportSize({ width: 360, height: 780 });
  for (const path of ["/u/giulia.rm", "/u/giulia.rm/mappa", "/amici", "/profilo"]) {
    await sp.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
    ok(await sp.evaluate(() => document.documentElement.scrollWidth - innerWidth) <= 0, `360px: ${path} senza scorrimento orizzontale`);
  }
  await sp.goto(`${BASE}/u/giulia.rm`, { waitUntil: "networkidle" });
  await sp.waitForTimeout(500);
  await sp.screenshot({ path: `${OUT}/66-profilo-pubblico-360.png`, caret: "initial" });
  await soctx.close();
}

// 14-bis. Scheda del locale stile Places (piano 6.2): barra azioni flottante (Prenota / Percorso / Salva
//         dove si prenota, Chiama / Percorso / Salva altrove), carosello senza foto Google in più,
//         "chi dei tuoi amici c'è stato" anche nella scheda della mappa.
{
  const ristorante = mk("S1", "Trattoria Scheda", 41.889, 12.469, { category: "restaurant", phone: "+39 347 123 4567" });
  const caffe = mk("S2", "Caffè Scheda", 41.8895, 12.4695, { category: "cafe" });
  const sSearch = { ...SEARCH_FAST, risultati: [ristorante, caffe], sintesi_pendente: { places: [], token: "x" } };
  const sSynth = { esclusi: [], dettagli: {
    S1: { synthesis: "Cucina romana, sala piccola.", tags: [], verdict: "Cucina romana di quartiere, lontana dai giri turistici.", goFor: ["cena tra amici"], dontExpect: [], matchReason: "Clienti del quartiere." },
    S2: { synthesis: "Caffè al banco.", tags: [], verdict: "Il bar di quartiere vero.", goFor: ["colazione"], dontExpect: [], matchReason: "È un bar di quartiere." },
  } };
  const sctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, permissions: ["geolocation"], geolocation: { latitude: 41.8885, longitude: 12.4685 } });
  if (fakeUser) await sctx.addCookies([{ name: "e2e_social", value: encodeURIComponent(JSON.stringify({ profili: [], seguo: ["u-giulia"], salvati: [{ user_id: "u-giulia", handle: "giulia.rm", display_name: "Giulia", place_id: "S1", tags: ["Già visitato"], created_at: "2026-10-10T10:00:00Z", name: "Trattoria Scheda", category: "restaurant", address: null, lat: 41.889, lng: 12.469 }] })), url: BASE }]);
  const sEvents = [];
  const sPhotos = [];
  let staticMaps = 0;
  await sctx.route("**/api/events", (r) => { sEvents.push(r.request().postDataJSON()); return r.fulfill({ status: 204, body: "" }); });
  await sctx.route("**/api/places/photo**", (r) => { sPhotos.push(r.request().url()); return r.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="#c96"/></svg>' }); });
  await sctx.route("https://api.mapbox.com/styles/v1/mapbox/light-v11/static/**", (r) => { staticMaps++; return r.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="600" height="400" fill="#e8e8e4"/><circle cx="300" cy="200" r="12" fill="#ff6b4a"/></svg>' }); });
  await sctx.route("**/rest/v1/**", (r) => r.request().method() === "GET" ? r.fulfill({ json: [] }) : r.fulfill({ status: 201, body: "" }));
  await sctx.route("**/api/search", (r) => r.fulfill({ json: sSearch }));
  await sctx.route("**/api/search/synthesis", (r) => r.fulfill({ json: sSynth }));
  const s = await sctx.newPage();
  s.on("pageerror", (e) => errors.push(e.message));
  await s.addInitScript(() => { try { localStorage.setItem("mapetite.intro", "visto"); } catch { /* ignorato */ } });
  // I link esterni (Google Maps, tel:) non si aprono davvero: conta solo il segnale registrato.
  await s.addInitScript(() => document.addEventListener("click", (e) => { const a = e.target instanceof Element ? e.target.closest("a[target=_blank], a[href^='tel:']") : null; if (a) e.preventDefault(); }, true));
  await s.goto(`${BASE}/mappa?scheda=b`, { waitUntil: "networkidle" });
  await s.getByRole("button", { name: "La mia posizione", exact: true }).click().catch(() => {});
  await s.waitForTimeout(800);
  await s.getByLabel(/cosa cerchi\?/).first().fill("trattoria autentica");
  await s.getByLabel(/cosa cerchi\?/).first().press("Enter");
  await s.getByText("Cucina romana di quartiere, lontana dai giri turistici.").first().waitFor({ timeout: 8000 });
  await s.waitForTimeout(600);
  const photosBefore = new Set(sPhotos);
  await s.locator("ul").getByText("Trattoria Scheda").first().click();
  await s.getByTestId("verdetto-scheda").waitFor({ timeout: 5000 });
  await s.waitForTimeout(800);
  const bar = s.getByTestId("barra-azioni");
  { const labels = await bar.locator("a, button").evaluateAll((els) => els.map((e) => e.textContent.trim()));
    ok(labels.length === 3 && labels[0] === "Prenota" && /^\d+ min$/.test(labels[1]) && labels[2] === "Salva", `scheda: barra Prenota / minuti a piedi / Salva per un ristorante (${labels.join(" / ")})`); }
  const barCheck = async (pg) => pg.getByTestId("barra-azioni").evaluate((el) => {
    const tiles = [...el.querySelectorAll("a, button")].map((t) => t.getBoundingClientRect());
    const nav = document.querySelector("nav.fixed")?.getBoundingClientRect().top ?? innerHeight;
    const ws = tiles.map((t) => t.width);
    return { dentro: tiles.every((t) => t.left >= 0 && t.right <= innerWidth && t.bottom <= nav + 1 && t.height >= 44), uguali: Math.max(...ws) - Math.min(...ws) <= 2, ws: ws.map(Math.round).join("/") };
  });
  { const r = await barCheck(s); ok(r.dentro && r.uguali, `scheda: tre riquadri uguali, dentro lo schermo e sopra la barra in basso (${r.ws})`); }
  ok(await s.getByTestId("amici-qui").isVisible().catch(() => false) || !fakeUser, "scheda della mappa: 'chi dei tuoi amici c'è stato'");
  if (fakeUser) ok((await s.getByTestId("amici-qui").textContent())?.includes("1 amico ci è stato") && (await s.getByTestId("amici-qui").getByRole("link", { name: "Giulia" }).getAttribute("href")) === "/u/giulia.rm", "scheda della mappa: '1 amico ci è stato' con il link al profilo");
  // Carosello: la foto è quella della card (nessuna richiesta foto nuova); la mappa "dove si trova" solo se ci si arriva.
  ok([...sPhotos].every((u) => photosBefore.has(u) || u.includes("S1")) && new Set(sPhotos.filter((u) => u.includes("S1"))).size <= 1, `scheda: nessuna foto Google in più oltre a quella della card (${new Set(sPhotos).size} indirizzi foto)`);
  ok(staticMaps === 0 && (await s.getByTestId("carosello-puntini").locator("button").count()) === 2, `carosello: foto + 'dove si trova', la mappa non si scarica finché non serve (${staticMaps})`);
  await s.screenshot({ path: `${OUT}/60-scheda-places-ristorante.png`, caret: "initial" });
  // Scheda pulita (Lorenzo 16/10): verdetto e azioni in vista senza scorrere, il resto in schede e nel menu "Altro".
  { const r = await s.evaluate(() => {
      const q = (id) => document.querySelector(`[data-testid=${id}]`)?.getBoundingClientRect();
      const v = q("verdetto-box"), a = q("azioni-scheda"), bar = q("barra-azioni");
      const tiles = [...document.querySelectorAll("[data-testid=azioni-scheda] button")].map((b) => b.getBoundingClientRect());
      const ws = tiles.map((t) => Math.round(t.width));
      return { verdetto: !!v && !!bar && v.top >= 0 && v.bottom <= bar.top + 1, azioni: !!a && a.bottom < (v?.top ?? 0) + 1, n: tiles.length, ws: ws.join("/"), dentro: tiles.every((t) => t.left >= 0 && t.right <= innerWidth && t.height >= 44 && t.width >= 44) };
    });
    ok(r.verdetto, "scheda pulita: il verdetto Mapetite è tutto in vista senza scorrere (sopra la barra)");
    ok(r.azioni && r.n === 2 && r.dentro, `scheda semplice: Condividi e Altro come icone accanto al nome, sopra il verdetto (${r.ws})`); }
  ok((await s.getByTestId("scheda-tabs").getByRole("tab").allTextContents()).join(" · ") === "Panoramica · Recensioni · Info" && (await s.getByTestId("scheda-tab-panoramica").getAttribute("aria-selected")) === "true", "scheda pulita: sezioni Panoramica · Recensioni · Info, aperta su Panoramica");
  ok(!(await s.getByText("Cosa dicono").isVisible()) && !(await s.getByTestId("copia-indirizzo").isVisible()), "scheda pulita: recensioni e indirizzo non affollano la prima schermata");
  await s.getByTestId("altro-apri").click();
  { const items = (await s.getByTestId("altro-menu").getByRole("menuitem").allTextContents()).map((t) => t.trim());
    ok(items.includes("Copia indirizzo") && items.includes("Apri su Google Maps") && items.some((t) => t.includes("Rivendicalo")), `menu Altro: copia indirizzo, Google Maps, rivendica (${items.join(" | ")})`); }
  { const box = await s.getByTestId("altro-menu").boundingBox(); ok(!!box && box.y >= 0 && box.x >= 0 && box.x + box.width <= 390, "menu Altro: tutto dentro lo schermo"); }
  await s.screenshot({ path: `${OUT}/60b-scheda-menu-altro.png`, caret: "initial" });
  await s.getByRole("button", { name: "Chiudi il menu" }).click({ position: { x: 10, y: 10 } });
  ok((await s.getByTestId("altro-menu").count()) === 0, "menu Altro: si chiude toccando fuori");
  await s.getByTestId("scheda-tab-recensioni").click();
  ok(await s.getByText("Cosa dicono").isVisible() && await s.getByTestId("community-scheda").isVisible(), "scheda: 'Recensioni' mostra Google e la community Mapetite");
  await s.getByTestId("scheda-tab-info").click();
  ok(await s.getByTestId("copia-indirizzo").isVisible() && await s.getByRole("link", { name: /Orari e foto su Google Maps/ }).isVisible(), "scheda: 'Info' mostra indirizzo (si copia) e Google Maps");
  await s.screenshot({ path: `${OUT}/60c-scheda-info.png`, caret: "initial" });
  await s.getByTestId("scheda-tab-panoramica").click();
  await s.getByLabel("Mostra dove si trova").click();
  await s.getByTestId("carosello-mappa").locator("img").waitFor({ timeout: 4000 }).catch(() => {});
  await s.waitForTimeout(600);
  ok(staticMaps === 1 && (await s.getByTestId("carosello-mappa").getAttribute("href"))?.startsWith("https://www.google.com/maps/dir/?api=1&destination=41.889,12.469"), `carosello: seconda pagina con la mappa e il percorso (${staticMaps} mappa)`);
  await s.screenshot({ path: `${OUT}/62-scheda-carosello-mappa.png`, caret: "initial" });
  // Segnali: percorso dalla barra, apertura di Prenota.
  sEvents.length = 0;
  await bar.locator("a[aria-label^='Indicazioni']").click();
  await bar.getByTestId("prenota-scheda").click();
  await s.getByTestId("foglio-prenota").waitFor({ timeout: 3000 });
  await s.waitForTimeout(300);
  ok(sEvents.some((e) => e.type === "percorso" && e.props?.fonte === "barra" && e.googlePlaceId === "S1"), "barra: segnale 'percorso' (da barra)");
  ok(sEvents.some((e) => e.type === "funzione" && e.props?.nome === "prenota" && e.props?.fonte === "barra"), "barra: apertura di Prenota registrata");
  await s.getByRole("dialog", { name: /Prenota da/ }).getByRole("button", { name: "Chiudi" }).click();
  // "Prenota come l'ultima volta" (PROPOSTE 10): persone e ora dell'ultima richiesta a questo locale, il giorno no.
  await s.evaluate(() => localStorage.setItem("mapetite.prenotazioni", JSON.stringify([{ id: "u1", placeId: "S1", placeName: "x", lat: null, lng: null, date: "2026-09-01", time: "20:30", people: 4, special: null, via: "whatsapp", createdAt: Date.now() - 86_400_000 }])));
  await bar.getByTestId("prenota-scheda").click();
  await s.getByTestId("foglio-prenota").waitFor({ timeout: 3000 });
  { const t = (await s.getByTestId("prenota-come-ultima").textContent().catch(() => "")) ?? "";
    ok(t.includes("Come l'ultima volta: 4 persone alle 20:30") && (await s.getByTestId("prenota-persone").first().textContent()) === "4" && (await s.getByRole("button", { name: "20:30" }).getAttribute("aria-pressed")) === "true" && (await s.getByTestId("prenota-passo").count()) === 1, `prenota: 'Come l'ultima volta' con 4 persone e le 20:30, il giorno da scegliere (${t})`); }
  await s.screenshot({ path: `${OUT}/62b-prenota-come-ultima.png`, caret: "initial" });
  await s.getByRole("dialog", { name: /Prenota da/ }).getByRole("button", { name: "Chiudi" }).click();
  await s.evaluate(() => localStorage.removeItem("mapetite.prenotazioni"));
  // "Sarà la mia 3ª volta da voi" (PROPOSTE 11): nei posti fissi (2 visite), spento finché non lo accendi.
  await s.route("**/rest/v1/saved_places**", (r) => (r.request().url().includes("google_place_id") ? r.fulfill({ json: [{ visite: 2, tags: ["Già visitato"], places: { google_place_id: "S1" } }] }) : r.fallback()));
  await bar.getByTestId("prenota-scheda").click();
  await s.getByTestId("foglio-prenota").waitFor({ timeout: 3000 });
  await s.getByTestId("foglio-prenota").getByRole("button", { name: "Domani" }).click();
  await s.getByTestId("foglio-prenota").getByRole("button", { name: "20:30" }).click();
  if (await s.getByTestId("prenota-avanti").isEnabled().catch(() => false) === false) await s.getByLabel("Una persona in più").click();
  await s.getByTestId("prenota-avanti").click();
  await s.getByTestId("prenota-volta").waitFor({ timeout: 3000 }).catch(() => {});
  { const prima = await s.getByTestId("prenota-messaggio").inputValue().catch(() => "");
    await s.getByTestId("prenota-volta").locator("input").check().catch(() => {});
    const dopo = await s.getByTestId("prenota-messaggio").inputValue().catch(() => "");
    ok((await s.getByTestId("prenota-volta").textContent().catch(() => "")).includes("3ª volta") && !prima.includes("volta da voi") && dopo.includes("Sarà la mia 3ª volta da voi."), `prenota: nei posti fissi 'Sarà la mia 3ª volta da voi' solo se lo accendi (${dopo})`); }
  await s.screenshot({ path: `${OUT}/62c-prenota-volta.png`, caret: "initial" });
  await s.getByRole("dialog", { name: /Prenota da/ }).getByRole("button", { name: "Chiudi" }).click();
  await s.unroute("**/rest/v1/saved_places**");
  // In fondo alla scheda la barra non copre l'ultimo contenuto.
  await s.getByTestId("scheda-trascinabile").evaluate((el) => el.scrollTo({ top: 99999 }));
  await s.waitForTimeout(300);
  { const r = await s.evaluate(() => {
      const barTop = document.querySelector("[data-testid=barra-azioni]").getBoundingClientRect().top;
      const sections = [...document.querySelectorAll("[data-testid=scheda-trascinabile] h3")].filter((h) => h.offsetParent != null);
      const last = sections[sections.length - 1]?.parentElement?.getBoundingClientRect();
      return { ok: !!last && last.bottom <= barTop + 1, last: Math.round(last?.bottom ?? 0), barTop: Math.round(barTop) };
    });
    ok(r.ok, `scheda: in fondo la barra non copre l'ultimo contenuto (${r.last} ≤ ${r.barTop})`); }
  await s.screenshot({ path: `${OUT}/61-scheda-places-fondo.png`, caret: "initial" });
  // Caffè: qui non si prenota → Chiama / Percorso / Salva.
  await s.getByRole("button", { name: "Locale successivo" }).click();
  await s.locator("h2", { hasText: "Caffè Scheda" }).waitFor({ timeout: 4000 });
  await s.waitForTimeout(500);
  { const labels = await bar.locator("a, button").evaluateAll((els) => els.map((e) => e.textContent.trim()));
    ok(labels[0] === "Chiama" && labels.length === 3 && (await bar.getByTestId("prenota-scheda").count()) === 0, `scheda: per un caffè Chiama / Percorso / Salva, niente Prenota (${labels.join(" / ")})`); }
  ok((await s.getByTestId("amici-qui").count()) === 0, "scheda: nessun riquadro amici dove nessuno dei tuoi è stato");
  sEvents.length = 0;
  await bar.locator("a[href^='tel:']").click();
  await s.waitForTimeout(300);
  ok(sEvents.some((e) => e.type === "chiama" && e.props?.fonte === "barra"), "barra: segnale 'chiama' (da barra)");
  await s.screenshot({ path: `${OUT}/63-scheda-places-caffe.png`, caret: "initial" });
  // 360 px: stessa barra, niente scorrimento orizzontale.
  await s.setViewportSize({ width: 360, height: 780 });
  await s.waitForTimeout(400);
  { const r = await barCheck(s); ok(r.dentro && r.uguali, `360px scheda: barra a tre riquadri dentro lo schermo (${r.ws})`); }
  ok(await s.getByTestId("scheda-trascinabile").evaluate((el) => el.scrollWidth <= el.clientWidth), "360px scheda: niente scorrimento orizzontale");
  await s.screenshot({ path: `${OUT}/64-scheda-places-360.png`, caret: "initial" });
  await sctx.close();
}

// QA telefono piccolo (Android 360x780, 13/10): niente scorrimento orizzontale, testi interi, niente vuoti sopra la barra.
{
  const qctx = await browser.newContext({ viewport: { width: 360, height: 780 }, deviceScaleFactor: 2 });
  await qctx.addInitScript(() => { try { localStorage.setItem("mapetite.intro", "visto"); } catch { /* ignorato */ } });
  const qRows = [
    { tags: ["Romantico", "Da provare"], note: null, places: { id: "00000000-0000-4000-8000-000000000301", name: "Terrazza Uno", category: "bar", address: "Via Po 2, 00198 Roma RM, Italy", lat: 41.915, lng: 12.497, google_place_id: "GQ1", rating: 4.6, price_level: 2 } },
    { tags: ["Economico"], note: null, places: { id: "00000000-0000-4000-8000-000000000302", name: "Forno Due", category: "bakery", address: "Via Ostiense 50, Roma", lat: 41.87, lng: 12.48, google_place_id: "GQ2", rating: 4.5, price_level: 1 } },
  ];
  await qctx.route("**/rest/v1/saved_places**", (r) => r.request().url().includes("select=place_id") ? r.fulfill({ json: qRows.map((x) => ({ place_id: x.places.id })) }) : r.fulfill({ json: qRows }));
  await qctx.route("**/rest/v1/place_synthesis**", (r) => r.fulfill({ json: [] }));
  await qctx.route("**/rest/v1/profiles**", (r) => r.fulfill({ json: [] }));
  await qctx.route("**/api/places/photo**", (r) => r.fulfill({ status: 429, json: {} }));
  await qctx.route("**/api/events", (r) => r.fulfill({ status: 204, body: "" }));
  const qp = await qctx.newPage();
  qp.on("pageerror", (e) => errors.push(e.message));
  const hscroll = () => qp.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  // Il testo d'esempio di un campo si legge per intero (non "Chiedi all'AI cosa c").
  const placeholderFits = (sel) => qp.locator(sel).evaluate((i) => { const s = getComputedStyle(i); const c = document.createElement("canvas").getContext("2d"); c.font = s.font; return c.measureText(i.placeholder).width <= i.clientWidth - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight) - 16; });
  for (const path of ["/", "/onboarding", "/login", "/signup", "/stasera", "/importa", "/importa/condividi", "/importa/condividi/immagine?errore=x", "/pagina-che-non-esiste"]) {
    await qp.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
    ok(await hscroll() <= 0, `360px: ${path} senza scorrimento orizzontale`);
  }
  await qp.goto(`${BASE}/`, { waitUntil: "networkidle" });
  ok(await placeholderFits("input[name=q]"), "360px home: il testo d'esempio del campo si legge per intero");
  { const hs = await qp.evaluate(() => [...document.querySelectorAll("a[href='/mappa'], a[href='/login'], button")].filter((e) => /^(accedi|Come funziona)$/.test(e.textContent.trim())).map((e) => e.getBoundingClientRect().height)); ok(hs.length === 1 && hs.every((h) => h >= 40), `360px home: 'Come funziona' alto almeno 40px e niente 'accedi' doppione di 'Entra' (${hs.map(Math.round).join(", ")})`); }
  await qp.goto(`${BASE}/importa#a-mano`, { waitUntil: "networkidle" });
  await qp.locator("#mano-campo").waitFor({ timeout: 3000 }).catch(() => {});
  if (await qp.locator("#mano-campo").isVisible()) ok(await placeholderFits("#mano-campo"), "360px importa: 'es. Da Michele Roma' si legge per intero");
  await qp.goto(`${BASE}/importa/condividi`, { waitUntil: "networkidle" });
  ok(await qp.getByTestId("condividi-vuoto").getByRole("link", { name: "Incolla il link in Importa" }).isVisible(), "condividi senza link: c'è un'azione per andare avanti");
  await qp.goto(`${BASE}/stasera`, { waitUntil: "networkidle" });
  { const gap = await qp.evaluate(async () => { scrollTo(0, document.documentElement.scrollHeight); await new Promise((r) => setTimeout(r, 200)); const nav = document.querySelector("nav.fixed"); const m = document.querySelector("main"); return nav && m ? Math.round(nav.getBoundingClientRect().top - m.getBoundingClientRect().bottom) : null; });
    ok(gap !== null && gap <= 0, `360px stasera: lo sfondo arriva fin sotto la barra, niente striscia bianca (${gap}px)`); }
  // Raccolte del profilo: nessuna parola spezzata su due righe ("Romantic/o").
  const pr = (id, name) => ({ id: `00000000-0000-4000-8000-0000000004${id}`, name, category: "bar", address: "Via Po 2, Roma" });
  const profiloQ = { email: "qa@example.com", reviews: [], saved: [
    { created_at: "2026-10-10", tags: ["Romantico"], note: null, places: pr("01", "Uno") },
    { created_at: "2026-10-09", tags: ["Economico", "Speciale"], note: null, places: pr("02", "Due") },
    { created_at: "2026-10-08", tags: ["Weekend a Napoli con gli amici"], note: null, places: pr("03", "Tre") },
  ] };
  await qctx.addCookies([{ name: "e2e_profilo", value: encodeURIComponent(JSON.stringify(profiloQ)), url: BASE }]);
  await qp.goto(`${BASE}/profilo`, { waitUntil: "networkidle" });
  if (await qp.getByTestId("raccolta-nome").first().isVisible()) {
    const spezzate = await qp.getByTestId("raccolta-nome").evaluateAll((els) => els.flatMap((el) => { const t = el.firstChild; if (!t) return []; const out = []; const re = /\S+/g; let m; while ((m = re.exec(t.textContent))) { const r = document.createRange(); r.setStart(t, m.index); r.setEnd(t, m.index + m[0].length); const tops = new Set([...r.getClientRects()].map((x) => Math.round(x.top))); if (tops.size > 1) out.push(m[0]); } return out; }));
    ok(spezzate.length === 0, `360px profilo: nomi delle raccolte senza parole spezzate${spezzate.length ? " (" + spezzate.join(", ") + ")" : ""}`);
    ok(await hscroll() <= 0, "360px: /profilo senza scorrimento orizzontale");
  } else ok(false, "360px profilo: raccolte visibili (serve E2E_FAKE_USER)");

  // QA mappa a 360px (13/10): nomi lunghi veri, verdetti lunghi, foto mancanti.
  {
    const LUNGO = "Una terrazza vera sopra i tetti di Trastevere, con cucina romana curata e una carta dei vini sorprendentemente ampia per un locale così raccolto.";
    const nomi = ["L'Uliveto Roof Garden - Ristorante panoramico", "Panfuwa | Brunch & Café - Milano Isola", "Osteria dell'Antiquario e Bottega dei Sapori Romani"];
    const lunghi = nomi.map((n, i) => mk(`L${i + 1}`, n, 41.889 + i * 0.002, 12.469, { category: "restaurant", photoRef: i === 1 ? null : `places/L${i + 1}/photos/x` }));
    await qp.route("**/api/search", (r) => r.fulfill({ json: { ...SEARCH_FAST, risultati: lunghi, sintesi_pendente: { places: [], token: "x" } } }));
    await qp.route("**/api/search/synthesis", (r) => r.fulfill({ json: { esclusi: [], dettagli: Object.fromEntries(lunghi.map((p) => [p.id, { synthesis: "Tavoli all'aperto, luci basse, servizio attento ma non invadente.", tags: [], verdict: LUNGO, goFor: ["cena a due con vista sulla città", "tramonto"], dontExpect: [], matchReason: "Ha una terrazza panoramica vera e le recensioni parlano spesso di serate romantiche a lume di candela." }])) } }));
    await qp.route("**/api/places/add", (r) => r.fulfill({ json: { place: { id: "33333333-0000-4000-8000-000000000360" } } }));
    await qp.route("**/rest/v1/saved_places**", (r) => r.request().method() === "POST" ? r.fulfill({ status: 201, body: "" }) : r.fulfill({ json: [] }));
    await qp.goto(`${BASE}/mappa?scheda=b`, { waitUntil: "networkidle" });
    await qp.getByLabel("Chiedi all'AI: cosa cerchi?").fill("Ristorante romantico con terrazza a Trastevere");
    await qp.getByLabel("Chiedi all'AI: cosa cerchi?").press("Enter");
    await qp.locator("ul.snap-x li[data-id=L1]").getByTestId("etichetta-verdetto").waitFor({ timeout: 8000 });
    { const h = () => qp.getByTestId("opzioni-ricerca").evaluate((el) => Math.round(el.getBoundingClientRect().height));
      const chiusa = await h();
      await qp.getByTestId("opzioni-ricerca").click();
      const aperta = await qp.getByTestId("opzioni-pannello").isVisible();
      const dentro = await qp.getByTestId("opzioni-pannello").evaluate((el) => el.closest(".rounded-card").getBoundingClientRect().right <= innerWidth);
      await qp.getByTestId("opzioni-ricerca").click();
      ok(chiusa <= 48 && aperta && dentro, `360px: pillola dei risultati compatta (${chiusa}px), un tocco apre le opzioni dentro lo schermo`); }
    await qp.waitForTimeout(300);
    { const m = await qp.locator("ul.snap-x li[data-id=L1]").evaluate((li) => {
        const card = li.getBoundingClientRect(); const nav = document.querySelector("nav.fixed")?.getBoundingClientRect().top ?? innerHeight;
        const v = li.querySelector("[data-testid=etichetta-verdetto]")?.nextElementSibling; const lh = v ? parseFloat(getComputedStyle(v).lineHeight) : 0;
        const fuori = [...li.querySelectorAll("span")].filter((s) => { const r = s.getBoundingClientRect(); return r.width > 0 && (r.right > card.right + 1 || r.bottom > card.bottom + 1); }).length;
        return { verdetto: v ? Math.round(v.getBoundingClientRect().height / lh) : 99, fuori, sopraNav: card.bottom <= nav + 1, alta: Math.round(card.height) };
      });
      ok(m.verdetto <= 2 && m.fuori === 0 && m.sopraNav, `360px card: nome e verdetto lungo dentro la card, verdetto su 2 righe al massimo (${m.verdetto} righe, alta ${m.alta}px)`); }
    await qp.screenshot({ path: `${OUT}/qa360-mappa-card.png`, caret: "initial" });
    // Salvato dalla card, poi aperta la scheda: l'avviso non copre la barra azioni.
    await qp.getByRole("button", { name: `Salva ${nomi[0]}` }).click();
    await qp.getByTestId("salvato-avviso").waitFor({ timeout: 3000 });
    await qp.locator("ul.snap-x li[data-id=L1] > button:not([aria-pressed])").click({ position: { x: 30, y: 60 } });
    await qp.getByTestId("scheda-nav").waitFor({ timeout: 3000 });
    await qp.waitForTimeout(300);
    { const r = await qp.evaluate(() => {
        const a = document.querySelector("a[aria-label^='Indicazioni']"); const bar = a?.parentElement?.getBoundingClientRect();
        const nav = document.querySelector("nav.fixed")?.getBoundingClientRect().top ?? innerHeight;
        const t = document.querySelector("[data-testid=salvato-avviso]")?.getBoundingClientRect();
        const btns = a ? [...a.parentElement.children].map((e) => e.getBoundingClientRect()) : [];
        return { dentro: !!bar && bar.bottom <= nav + 1 && bar.top >= 0 && btns.every((b) => b.left >= 0 && b.right <= innerWidth && b.height >= 40), toast: t ? t.bottom <= (bar?.top ?? 0) + 1 : null };
      });
      ok(r.dentro, "360px scheda: barra Prenota/Percorso/Salva dentro lo schermo, sopra la barra in basso");
      ok(r.toast === true, `360px scheda: l'avviso 'Salvato · Aggiungi nota' non copre la barra azioni (${r.toast})`); }
    await qp.screenshot({ path: `${OUT}/qa360-mappa-avviso-scheda.png`, caret: "initial" });
    // ‹ › con la scheda scorsa in basso: il locale successivo si apre dalla foto e dal nome.
    await qp.getByTestId("scheda-trascinabile").evaluate((el) => el.scrollTo({ top: 99999 }));
    await qp.getByRole("button", { name: "Locale successivo" }).click();
    await qp.waitForTimeout(400);
    ok(await qp.getByTestId("scheda-trascinabile").evaluate((el) => el.scrollTop === 0) && await qp.locator("h2", { hasText: nomi[1] }).isVisible(), "360px scheda: '›' apre il locale successivo dall'inizio (nome visibile)");
    await qp.keyboard.press("Escape");
    await qp.unroute("**/api/search"); await qp.unroute("**/api/search/synthesis"); await qp.unroute("**/api/places/add"); await qp.unroute("**/rest/v1/saved_places**");
  }
  await qctx.close();
}

// "Password dimenticata?": richiesta del link e nuova password (Supabase Auth simulato, nessuna email).
{
  const rctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  let recover = null;
  let newPassword = null;
  await rctx.route("**/auth/v1/recover**", (r) => { recover = { url: r.request().url(), body: r.request().postDataJSON() }; return r.fulfill({ json: {} }); });
  const user = { id: "00000000-0000-0000-0000-000000000009", aud: "authenticated", email: "giulia@example.com", app_metadata: {}, user_metadata: {}, created_at: "2026-10-01T00:00:00Z" };
  await rctx.route("**/auth/v1/user**", (r) => {
    if (r.request().method() === "PUT") { newPassword = r.request().postDataJSON()?.password ?? null; }
    return r.fulfill({ json: user });
  });
  const rp = await rctx.newPage();
  rp.on("pageerror", (e) => errors.push(e.message));
  await rp.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await rp.getByRole("link", { name: "Password dimenticata?" }).click();
  await rp.waitForURL(/\/password-dimenticata/);
  await rp.getByLabel("Email").fill("giulia@example.com");
  await rp.getByRole("button", { name: "Mandami il link" }).click();
  await rp.getByTestId("reset-inviato").waitFor({ timeout: 5000 });
  ok(recover?.body?.email === "giulia@example.com" && decodeURIComponent(recover.url).includes(`redirect_to=${BASE}/reimposta-password`), "password dimenticata: chiede il link a Supabase con il ritorno su /reimposta-password");
  ok(!recover?.body?.code_challenge, "password dimenticata: link che funziona anche aperto in un altro browser (niente PKCE)");
  await rp.screenshot({ path: `${OUT}/37-password-dimenticata.png`, caret: "initial" });
  await rp.goto(`${BASE}/reimposta-password`, { waitUntil: "networkidle" });
  await rp.getByTestId("reset-scaduto").waitFor({ timeout: 4000 });
  ok(await rp.getByRole("link", { name: "Mandami un nuovo link" }).isVisible(), "reimposta password senza link valido: lo dice e propone un nuovo link");
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const jwt = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const access = `${jwt({ alg: "HS256", typ: "JWT" })}.${jwt({ sub: user.id, exp, aud: "authenticated", email: user.email, role: "authenticated" })}.c2lnbmF0dXJh`;
  await rp.goto(`${BASE}/login`, { waitUntil: "networkidle" }); // stesso indirizzo con solo l'hash diverso non ricarica la pagina
  await rp.goto(`${BASE}/reimposta-password#access_token=${access}&refresh_token=rt&expires_in=3600&expires_at=${exp}&token_type=bearer&type=recovery`, { waitUntil: "networkidle" });
  await rp.getByLabel("Nuova password").waitFor({ timeout: 5000 });
  ok(!rp.url().includes("access_token"), "reimposta password: il token sparisce dall'indirizzo");
  await rp.getByLabel("Nuova password").fill("nuova123");
  await rp.getByLabel("Riscrivila").fill("nuova124");
  await rp.getByRole("button", { name: "Salva la nuova password" }).click();
  ok(await rp.getByText("Le due password non coincidono.").isVisible(), "reimposta password: avvisa se le due password sono diverse");
  await rp.getByLabel("Riscrivila").fill("nuova123");
  await rp.screenshot({ path: `${OUT}/38-nuova-password.png`, caret: "initial" });
  await rp.getByRole("button", { name: "Salva la nuova password" }).click();
  await rp.getByTestId("reset-fatto").waitFor({ timeout: 5000 });
  ok(newPassword === "nuova123", "reimposta password: salva la nuova password su Supabase");
  ok(await rp.getByRole("link", { name: "Vai alla mappa" }).isVisible(), "reimposta password: 'Vai alla mappa' dopo il salvataggio");
  await rctx.close();
}

// Tracciamento (PIANO-25-OTTOBRE.md 7): visite, pagine, funzioni, errori, 👍/👎 e pannello /admin/numeri.
// Tutto intercettato: nessuna scrittura nel database (e il server non scrive comunque con E2E_FAKE_USER).
{
  // Calcoli del pannello (funzioni pure, senza server).
  let nm = null;
  try { nm = await import(new URL("../../src/lib/numeri.ts", import.meta.url).href); } catch (e) { ok(false, `numeri: modulo src/lib/numeri.ts importabile (${e.message})`); }
  if (nm) {
    const now = Date.parse("2026-10-15T12:00:00Z");
    const at = (d, h = 10) => new Date(Date.UTC(2026, 9, d, h)).toISOString();
    const ev = (type, d, who, extra = {}) => ({ created_at: at(d, extra.h ?? 10), type, user_id: who.u ?? null, anon_id: who.a ?? null, session_id: extra.s ?? null, props: extra.p ?? {} });
    const A = { a: "anon-a" }, B = { u: "00000000-0000-0000-0000-00000000000b" }, Ba = { a: "anon-b", u: "00000000-0000-0000-0000-00000000000b" }, Bonly = { a: "anon-b" };
    const rows = [
      ev("sessione_inizio", 5, A, { s: "s1", p: { prima_volta: 1 } }),
      ev("sessione_inizio", 10, Bonly, { s: "s2", p: { prima_volta: 1 } }),
      ev("pagina", 10, Bonly, { s: "s2", p: { pagina: "mappa" } }),
      ev("ricerca", 10, Ba, { s: "s2", p: { modo: "ai", tipo: "bar", zona: "Trastevere", requisiti: ["rooftop"], risultati: 8 } }),
      ev("apri_scheda", 10, B, { s: "s2", h: 11, p: { fonte: "ricerca" } }),
      ev("salva", 10, B, { s: "s2", h: 11, p: { fonte: "segnalibro" } }),
      ev("sessione_inizio", 13, B, { s: "s3", p: { giorni: 3 } }),
      ev("funzione", 13, B, { s: "s3", p: { nome: "sorprendimi" } }),
      ev("errore", 14, A, { p: { messaggio: "x is undefined", pagina: "mappa" } }),
      ev("errore", 14, A, { p: { messaggio: "x is undefined", pagina: "mappa" } }),
      ev("utile", 14, B, { p: { voto: "si", contesto: "ricerca" } }),
      ev("ricerca", 15, {}, { p: { modo: "filtri", tipo: "pizzeria", risultati: 0 } }),
    ];
    const n = nm.computeNumeri(rows, 7, now);
    ok(n.attivi.totale === 2 && n.attivi.registrati === 1 && n.attivi.anonimi === 1, `numeri: persone attive in 7 giorni, l'anonimo che poi accede conta una volta (${JSON.stringify(n.attivi)})`);
    ok(n.nuovi === 1, `numeri: 'nuove' = prima volta nel periodo (${n.nuovi})`);
    const r3 = n.ritorni.find((r) => r.giorni === 3);
    ok(r3.base === 1 && r3.tornati === 1, `numeri: ritorno dopo 3 giorni (${JSON.stringify(r3)})`);
    ok(n.imbuto.map((s) => s.persone).join(",") === "1,1,1" && n.imbuto[0].volte === 2, `numeri: imbuto ricerca → scheda → salva (${n.imbuto.map((s) => `${s.volte}/${s.persone}`).join(" → ")})`);
    ok(n.ricerche.senzaRisultati === 1 && n.ricerche.ai === 1 && n.ricerche.filtri === 1, "numeri: ricerche con l'AI, con i filtri e senza risultati");
    ok(n.errori.length === 1 && n.errori[0].volte === 2 && n.errori[0].pagina === "mappa", "numeri: errori raggruppati per messaggio e pagina");
    ok(n.funzioni[0].volte > 0 && n.funzioni.some((f) => f.chiave === "sorprendimi" && f.volte === 1) && n.funzioni.some((f) => f.chiave === "voce" && f.volte === 0), "numeri: funzioni usate e mai usate");
    ok(n.utile.si === 1 && n.utile.no === 0 && n.sessioni.totale === 2 && !n.senzaTracciamento, `numeri: 👍/👎 e visite (${n.sessioni.totale})`);
    ok(nm.computeNumeri(rows.filter((r) => ["ricerca", "salva", "apri_scheda"].includes(r.type)), 30, now).senzaTracciamento, "numeri: avviso se la migrazione del tracciamento non è applicata");
    ok(nm.computeNumeri([], 1, now).attivi.totale === 0, "numeri: nessun evento, nessun errore");
    // Quota Google di oggi (18/10): giorno di Los Angeles, cioè dalle 9:00 italiane (alle 8:00 UTC qui sotto).
    { const g = nm.googleOggi([
        ev("ricerca", 15, A, { h: 8, p: { google: 2 } }),
        ev("ricerca", 15, A, { h: 11, p: { modo: "ai" } }),
        ev("funzione", 15, A, { h: 11, p: { nome: "import_link" } }),
        ev("ricerca", 15, A, { h: 6, p: { google: 1 } }),
        ev("funzione", 15, A, { h: 11, p: { nome: "filtri" } }),
      ], now);
      ok(g === 4 && nm.QUOTA_GOOGLE === 50, `numeri: chiamate Google di oggi = 2 + 1 + 1 link, senza quelle di prima delle 9:00 (${g})`); }
    // Eventi dedicati (assistente, prenotazioni, raccolte): tipi esistenti + da/via/cosa nel payload.
    const rows2 = [
      ev("pagina", 14, B, { p: { pagina: "assistente" } }),
      ev("funzione", 14, B, { p: { nome: "assistente_messaggio", contesto: "ricerca" } }),
      ev("funzione", 14, B, { p: { nome: "assistente_seguito", contesto: "economici" } }),
      ev("apri_scheda", 14, B, { p: { fonte: "assistente" } }),
      ev("salva", 14, B, { p: { fonte: "assistente", stato: "Da provare" } }),
      ev("funzione", 14, B, { p: { nome: "assistente_prenota" } }),
      ev("chiama", 14, B, { p: { fonte: "prenota", contesto: "whatsapp" } }),
      ev("sito", 14, A, { p: { fonte: "prenota" } }),
      ev("ci_sono_stato", 14, B, { p: { fonte: "prenota", stato: "bene" } }),
      ev("funzione", 14, B, { p: { nome: "raccolta_crea", risultati: 3 } }),
      ev("pagina", 14, B, { p: { pagina: "raccolta" } }),
      ev("condividi", 14, B, { p: { contesto: "raccolta" } }),
    ];
    const n2 = nm.computeNumeri(rows2, 7, now);
    const fv = (k) => n2.funzioni.find((x) => x.chiave === k)?.volte ?? -1;
    ok(fv("assistente_apri") === 1 && fv("assistente_messaggio") === 1 && fv("assistente_seguito") === 1 && fv("assistente_scheda") === 1 && fv("assistente_salva") === 1 && fv("assistente_prenota") === 1,
      "numeri: assistente distinto (aperto, messaggio, seguito, scheda, salva, prenota)");
    ok(fv("salva") === 1 && fv("apri_scheda") === 1 && n2.salvataggi.totale === 1, "numeri: il salvataggio dall'assistente conta anche tra i salvataggi");
    ok(fv("prenota_whatsapp") === 1 && fv("prenota_sito") === 1 && fv("prenota_com_e_andata") === 1 && fv("chiama") === 0 && fv("sito") === 0,
      "numeri: prenotazioni separate da 'chiama'/'sito' della scheda (WhatsApp, sito, com'è andata)");
    ok(fv("raccolta_crea") === 1 && fv("raccolta_apri") === 1 && fv("raccolta_condividi") === 1 && fv("condividi") === 1 && fv("raccolta_modifica") === 0,
      "numeri: raccolte (crea, apri, condividi; mai modificate = 0)");
    ok(nm.etichettaFunzione("assistente_salva") === "Assistente: salva" && nm.etichettaFunzione("prenota_whatsapp") === "Prenota: WhatsApp" && nm.etichettaFunzione("import_link") === "import link",
      "numeri: nomi leggibili delle funzioni nel pannello");
  }

  const tctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const tEvents = [];
  await tctx.route("**/api/events", (r) => { tEvents.push(r.request().postDataJSON()); return r.fulfill({ status: 204, body: "" }); });
  await tctx.route("**/api/places/photo**", (r) => r.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"/>' }));
  await tctx.route("**/rest/v1/**", (r) => r.fulfill({ json: [] }));
  await tctx.route("**/api/search", (r) => r.fulfill({ json: SEARCH_FAST }));
  await tctx.route("**/api/search/synthesis", (r) => r.fulfill({ json: SYNTH }));
  const tp = await tctx.newPage();
  await tp.addInitScript(() => { try { localStorage.setItem("mapetite.intro", "visto"); } catch { /* ignorato */ } });
  const tErrors = [];
  tp.on("pageerror", (e) => tErrors.push(e.message));
  await tp.goto(`${BASE}/mappa`, { waitUntil: "networkidle" });
  await tp.waitForTimeout(300);
  const ses = tEvents.filter((e) => e.type === "sessione_inizio");
  ok(ses.length === 1 && ses[0].props?.prima_volta === 1 && typeof ses[0].props?.installata === "number" && typeof ses[0].sessionId === "string", `tracciamento: all'apertura parte 'sessione_inizio' (prima volta, app installata sì/no) (${ses.length})`);
  ok(tEvents.some((e) => e.type === "pagina" && e.props?.pagina === "mappa"), "tracciamento: vista pagina 'mappa'");
  ok(tEvents.every((e) => typeof e.sessionId === "string" && e.sessionId === ses[0]?.sessionId && typeof e.anonId === "string"), "tracciamento: ogni segnale porta la stessa sessione e il visitatore anonimo");
  ok((await tctx.cookies()).some((c) => c.name === "mapetite_anon") && (await tctx.cookies()).some((c) => c.name === "mapetite_sessione"), "tracciamento: cookie di visitatore e sessione per le ricerche fatte dal server");

  // Cambio pagina dentro l'app: "Salvati" dalla barra in basso.
  await tp.getByRole("link", { name: "Salvati" }).first().click();
  await tp.waitForURL(/vista=salvati/);
  await tp.waitForTimeout(400);
  ok(tEvents.some((e) => e.type === "pagina" && e.props?.pagina === "salvati"), "tracciamento: cambio pagina senza ricaricare ('salvati')");

  // Ricerca: 👍/👎 in fondo ai risultati, senza la frase cercata nel segnale.
  await tp.goto(`${BASE}/mappa`, { waitUntil: "networkidle" });
  await (await esempio(tp)).click();
  await tp.getByText("Vista vera sui tetti di Roma.").first().waitFor({ timeout: 8000 });
  ok(await tp.getByTestId("utile").count() === 1, "utile: 'Ti è stato utile?' in fondo ai risultati");
  await tp.getByTestId("utile").getByRole("button", { name: "Sì, utile" }).evaluate((b) => b.click());
  await tp.getByTestId("utile-grazie").waitFor({ timeout: 3000 });
  await tp.waitForTimeout(200);
  const ut = tEvents.find((e) => e.type === "utile");
  ok(!!ut && ut.props?.voto === "si" && ut.props?.contesto === "ricerca" && typeof ut.props?.risultati === "number", "utile: 👍 registra il voto con il numero di risultati");
  ok(!JSON.stringify(tEvents).includes("Rooftop romantico"), "tracciamento: la frase cercata non finisce mai nei segnali");

  // Filtri: uso della funzione.
  await tp.getByRole("button", { name: "Filtri", exact: true }).click();
  await tp.getByRole("button", { name: /^Applica filtri/ }).click();
  await tp.waitForTimeout(300);
  ok(tEvents.some((e) => e.type === "funzione" && e.props?.nome === "filtri"), "tracciamento: 'Applica filtri' registra la funzione 'filtri'");

  // Errori del telefono: eccezione e promessa rifiutata, con la pagina; mai due volte lo stesso.
  // Script della pagina (non evaluate: i suoi errori risultano di un altro file e vengono scartati).
  await tp.addScriptTag({ content: 'setTimeout(function(){throw new Error("prova-errore-giro")},0);setTimeout(function(){throw new Error("prova-errore-giro")},5);Promise.reject(new Error("prova-promessa-giro"));' });
  await tp.waitForTimeout(500);
  const errs = tEvents.filter((e) => e.type === "errore");
  ok(errs.filter((e) => e.props?.messaggio === "prova-errore-giro").length === 1 && errs.every((e) => e.props?.pagina === "mappa"), `tracciamento: errore JavaScript registrato una volta, con la pagina (${errs.length})`);
  ok(errs.some((e) => e.props?.messaggio === "prova-promessa-giro" && e.props?.origine === "promessa"), "tracciamento: promessa rifiutata registrata");
  ok(tErrors.some((m) => /prova-errore-giro/.test(m)) && tErrors.filter((m) => !/prova-(errore|promessa)-giro/.test(m)).length === 0, `tracciamento: nessun altro errore (${tErrors.join(" | ").slice(0, 200)})`);

  // Stessa visita se si ricarica; nuova dopo 30 minuti di pausa, con i giorni dall'ultima.
  await tp.reload({ waitUntil: "load" });
  await tp.waitForTimeout(300);
  ok(tEvents.filter((e) => e.type === "sessione_inizio").length === 1, "tracciamento: ricaricando resta la stessa visita");
  // Giorni attesi: 0, ma 1 se "31 minuti fa" cade ancora nel giorno prima (giro lanciato dopo mezzanotte).
  const giorniAttesi = await tp.evaluate(() => { const s = JSON.parse(localStorage.getItem("mapetite.sessione")); s.last = Date.now() - 31 * 60_000; localStorage.setItem("mapetite.sessione", JSON.stringify(s)); return new Date(s.last).getDate() === new Date().getDate() ? 0 : 1; });
  await tp.reload({ waitUntil: "load" });
  // Il segnale parte dopo il caricamento: con il server carico 300 ms a volte non bastavano.
  for (let i = 0; i < 30 && tEvents.filter((e) => e.type === "sessione_inizio").length < 2; i++) await tp.waitForTimeout(100);
  const ses2 = tEvents.filter((e) => e.type === "sessione_inizio");
  ok(ses2.length === 2 && ses2[1].props?.giorni === giorniAttesi && ses2[1].sessionId !== ses2[0].sessionId, "tracciamento: dopo 30 minuti di pausa nuova visita, con i giorni dall'ultima");

  // Il server accetta i nuovi tipi e rifiuta quelli inventati.
  { const r1 = await tp.request.post(`${BASE}/api/events`, { data: { type: "pagina", sessionId: "s", props: { pagina: "mappa" } } });
    const r2 = await tp.request.post(`${BASE}/api/events`, { data: { type: "errore", props: { messaggio: "x".repeat(500), pagina: "mappa" } } });
    const r3 = await tp.request.post(`${BASE}/api/events`, { data: { type: "admin" } });
    ok(r1.status() === 204 && r2.status() === 204 && r3.status() === 400, `segnali: /api/events accetta pagina/errore, rifiuta tipi inventati (${r1.status()}/${r2.status()}/${r3.status()})`); }

  // Pannello di Lorenzo: senza accesso non esiste (404).
  { const r = await tp.request.get(`${BASE}/admin/numeri`);
    ok(r.status() === 404, `pannello: /admin/numeri senza accesso dà 404 (${r.status()})`); }
  const pagine = tEvents.filter((e) => e.type === "pagina").length;
  // Con eventi finti (solo in sviluppo con E2E_FAKE_USER, cookie e2e_eventi): stato vuoto e pannello pieno.
  const setFake = (rows) => tctx.addCookies([{ name: "e2e_eventi", value: encodeURIComponent(JSON.stringify(rows)), url: BASE }]);
  await setFake([]);
  await tp.goto(`${BASE}/admin/numeri`, { waitUntil: "networkidle" });
  ok(await tp.getByTestId("numeri-vuoto").isVisible(), "pannello: senza dati, stato vuoto chiaro");
  const iso = (minAgo) => new Date(Date.now() - minAgo * 60_000).toISOString();
  const U = "00000000-0000-0000-0000-00000000000b";
  await setFake([
    { created_at: iso(3 * 1440), type: "sessione_inizio", user_id: U, anon_id: null, session_id: "s0", props: { prima_volta: 1 } },
    { created_at: iso(30), type: "sessione_inizio", user_id: U, anon_id: null, session_id: "s1", props: { giorni: 3 } },
    { created_at: iso(29), type: "pagina", user_id: U, anon_id: null, session_id: "s1", props: { pagina: "mappa" } },
    { created_at: iso(28), type: "ricerca", user_id: U, anon_id: null, session_id: "s1", props: { modo: "ai", tipo: "bar", zona: "Trastevere", requisiti: ["rooftop"], risultati: 9 } },
    { created_at: iso(27), type: "apri_scheda", user_id: U, anon_id: null, session_id: "s1", props: { fonte: "ricerca" } },
    { created_at: iso(25), type: "salva", user_id: U, anon_id: null, session_id: "s1", props: {} },
    { created_at: iso(20), type: "funzione", user_id: null, anon_id: "anon-x", session_id: "s2", props: { nome: "filtri" } },
    { created_at: iso(19), type: "errore", user_id: null, anon_id: "anon-x", session_id: "s2", props: { messaggio: "Cannot read properties of undefined", pagina: "salvati" } },
    { created_at: iso(18), type: "utile", user_id: U, anon_id: null, session_id: "s1", props: { voto: "no", contesto: "ricerca" } },
    { created_at: iso(17), type: "funzione", user_id: U, anon_id: null, session_id: "s1", props: { nome: "assistente_messaggio", contesto: "ricerca" } },
    { created_at: iso(16), type: "salva", user_id: U, anon_id: null, session_id: "s1", props: { fonte: "assistente", stato: "Da provare" } },
    { created_at: iso(15), type: "chiama", user_id: U, anon_id: null, session_id: "s1", props: { fonte: "prenota", contesto: "whatsapp" } },
    { created_at: iso(14), type: "condividi", user_id: U, anon_id: null, session_id: "s1", props: { contesto: "raccolta" } },
  ]);
  await tp.goto(`${BASE}/admin/numeri?giorni=7`, { waitUntil: "networkidle" });
  ok((await tp.getByTestId("numeri-riepilogo").textContent())?.includes("Persone attive"), "pannello: riepilogo con le persone attive");
  ok(/Google oggi: 1 su 50/.test((await tp.getByTestId("numeri-google").textContent()) ?? ""), `pannello: quota Google di oggi (${await tp.getByTestId("numeri-google").textContent()})`);
  ok((await tp.getByTestId("numeri-imbuto").textContent())?.includes("Scheda aperta dai risultati"), "pannello: imbuto ricerca → scheda → azione");
  ok((await tp.getByTestId("numeri-errori").textContent())?.includes("Cannot read properties of undefined"), "pannello: errori con la pagina");
  ok((await tp.getByTestId("numeri-ritorni").textContent())?.includes("1 su 1"), "pannello: ritorni dopo 1/3/7 giorni");
  ok((await tp.getByTestId("numeri-tester").locator("li").count()) === 2, "pannello: elenco dei tester");
  { const fn = (await tp.getByTestId("numeri-funzioni").textContent()) ?? "";
    const ded = (await tp.getByTestId("numeri-dedicate").textContent()) ?? "";
    ok(fn.includes("Assistente: salva") && fn.includes("Prenota: WhatsApp") && fn.includes("Raccolta: condividi") && !fn.includes("assistente_"), `pannello: funzioni dedicate con nomi leggibili (${fn.slice(0, 120)}…)`);
    ok(ded.includes("Assistente") && ded.includes("Prenotazioni") && ded.includes("Raccolte") && ded.includes("Assistente: messaggio") && ded.includes("Raccolta: crea"), "pannello: sezione 'Assistente, prenotazioni e raccolte' (anche le funzioni mai usate)"); }
  { const w = await tp.evaluate(() => document.documentElement.scrollWidth); ok(w <= 390, `pannello: niente scorrimento orizzontale sul telefono (${w}px)`); }
  await tp.screenshot({ path: `${OUT}/60-pannello-numeri.png`, fullPage: true });
  ok(tEvents.filter((e) => e.type === "pagina").length === pagine, "pannello: le visite di Lorenzo al pannello non contano come pagine dei tester");
  await tctx.close();
}

// 14. Assistente (/assistente, piano 1.1) e prenotazione assistita (1.3). Ricerca e verdetti simulati:
//     nessuna chiamata Google/Haiku. I seguiti "più economici", "per 4"… non devono rifare la ricerca.
{
  let bk = null;
  try { bk = await import(new URL("../../src/lib/booking.ts", import.meta.url).href); } catch (e) { ok(false, `prenota: modulo src/lib/booking.ts importabile (${e.message})`); }
  // Orari Google nel foglio Prenota (19/10): "a quell'ora risulta chiuso" e "riapre domani alle 12:00".
  { let or = null;
    try { or = await import(new URL("../../src/lib/orari.ts", import.meta.url).href); } catch (e) { ok(false, `orari: modulo src/lib/orari.ts importabile (${e.message})`); }
    if (or) {
      // Aperto tutti i giorni 12:00–15:00 e 19:00–23:30, lunedì chiuso (giorno 1).
      const periods = [0, 2, 3, 4, 5, 6].flatMap((d) => [{ open: { day: d, hour: 12, minute: 0 }, close: { day: d, hour: 15, minute: 0 } }, { open: { day: d, hour: 19, minute: 0 }, close: { day: d, hour: 23, minute: 30 } }]);
      const o = or.compattaOrari(periods);
      const giovedi = (h, m) => new Date(2026, 9, 15, h, m); // giovedì 15/10
      ok(o.length === 12 && or.apertoIl(o, giovedi(20, 0)) === true && or.apertoIl(o, giovedi(16, 0)) === false && or.apertoIl(null, giovedi(20, 0)) === null, "orari: aperto alle 20, chiuso alle 16, senza orari non si sa");
      ok(or.prossimaApertura(o, giovedi(16, 0)) === "oggi alle 19:00" && or.prossimaApertura(o, giovedi(23, 45)) === "domani alle 12:00" && or.prossimaApertura(o, new Date(2026, 9, 18, 23, 50)) === "martedì alle 12:00", "orari: prossima apertura (oggi, domani, dopo il lunedì di chiusura)");
      ok(or.apertoIl(or.compattaOrari([{ open: { day: 5, hour: 18, minute: 0 }, close: { day: 6, hour: 2, minute: 0 } }]), new Date(2026, 9, 17, 1, 0)) === true, "orari: aperto dopo mezzanotte se chiude alle 2");
      ok(or.apertoIl(or.compattaOrari([{ open: { day: 0, hour: 0, minute: 0 } }]), giovedi(4, 0)) === true, "orari: h24 sempre aperto");
      { const d = or.prossimaAperturaData(o, giovedi(23, 45));
        ok(d && d.getDate() === 16 && d.getHours() === 12 && d.getMinutes() === 0, `orari: data della prossima apertura per il promemoria (${d?.toString().slice(0, 21)})`); }
      // Scheda, Info (20/10): "Oggi 12:00–15:00 · 19:00–23:30" come Places.
      ok(or.orariDelGiorno(o, giovedi(9, 0)) === "12:00–15:00 · 19:00–23:30" && or.orariDelGiorno(o, new Date(2026, 9, 19, 9, 0)) === "Chiuso" && or.orariDelGiorno(null, giovedi(9, 0)) === null && or.orariDelGiorno(or.compattaOrari([{ open: { day: 0, hour: 0, minute: 0 } }]), giovedi(9, 0)) === "Aperto 24 ore", "orari: orari del giorno (fasce, lunedì chiuso, senza orari niente, h24)");
      ok(or.orariDelGiorno(or.compattaOrari([{ open: { day: 5, hour: 18, minute: 0 }, close: { day: 6, hour: 2, minute: 0 } }]), new Date(2026, 9, 16, 9, 0)) === "18:00–02:00", "orari: chi chiude dopo mezzanotte resta nel giorno in cui apre");
      { const notte = or.compattaOrari([{ open: { day: 6, hour: 22, minute: 0 }, close: { day: 0, hour: 4, minute: 0 } }]);
        const dom1 = new Date(2026, 9, 18, 1, 0); // domenica all'1: la serata di sabato è ancora in corso
        ok(or.orariDelGiorno(notte, dom1) === "22:00–04:00" && or.apertoIl(notte, dom1) === true && or.prossimaChiusura(notte, dom1) === "alle 04:00", "orari: all'1 di notte il bar aperto 22–4 mostra la serata in corso (non 'Oggi Chiuso') e 'chiude alle 04:00'"); }
      ok(or.prossimaChiusura(o, giovedi(20, 0)) === "alle 23:30" && or.prossimaChiusura(o, giovedi(16, 0)) === null && or.prossimaChiusura(null, giovedi(20, 0)) === null, "orari: prossima chiusura solo se è aperto adesso");
    } }
  let as = null;
  try { as = await import(new URL("../../src/lib/assistant.ts", import.meta.url).href); } catch (e) { ok(false, `assistente: modulo src/lib/assistant.ts importabile (${e.message})`); }
  if (bk) {
    const now = new Date(2026, 9, 15, 18, 0); // giovedì 15/10, ore 18
    const r = bk.parseBooking("prenotami domani alle 21 per 2 con terrazza a Roma", now);
    ok(r.isBooking && r.date === "2026-10-16" && r.time === "21:00" && r.people === 2 && r.special === "in terrazza" && r.search === "ristorante con terrazza a roma", `prenota: frase capita senza AI (${JSON.stringify(r)})`);
    const s = bk.parseBooking("Prenota sabato alle 20:30 in 4 una trattoria a Testaccio", now);
    ok(s.date === "2026-10-17" && s.time === "20:30" && s.people === 4 && s.search === "trattoria a testaccio", `prenota: "sabato", "20:30", "in 4" (${JSON.stringify(s)})`);
    const t = bk.parseBooking("tavolo per 3 stasera alle 9 e mezza", now);
    ok(t.date === "2026-10-15" && t.time === "21:30" && t.people === 3 && t.search === null, `prenota: "stasera alle 9 e mezza" = 21:30, solo dettagli (${JSON.stringify(t)})`);
    const u = bk.parseBooking("prenota per una cena lunedì a Milano", now);
    ok(u.people === null && u.date === "2026-10-19" && u.search === "cena a milano", `prenota: "per una cena" non sono persone; "lunedì" con l'accento (${JSON.stringify(u)})`);
    ok(bk.parseBooking("per 4", now).people === 4 && bk.parseBooking("per 4", now).search === null, "prenota: 'per 4' aggiorna solo le persone");
    const msg = bk.bookingMessage(r, "Lorenzo", now);
    ok(msg === "Buonasera, vorrei prenotare un tavolo per 2 persone domani 16/10 alle 21:00, in terrazza se possibile. È disponibile? Grazie, Lorenzo", `prenota: messaggio già scritto (${msg})`);
    ok(bk.whatsappNumber("347 123 4567") === "393471234567" && bk.whatsappNumber("06 1234 5678") === null && bk.whatsappNumber("+39 333 1234567") === "393331234567", "prenota: WhatsApp solo per i cellulari (un fisso non lo propone)");
    const list = [
      { id: "a", date: "2026-10-15", time: "21:00", placeName: "Oggi", via: "whatsapp" },
      { id: "b", date: "2026-10-14", placeName: "Ieri", via: "telefono" },
      { id: "c", date: "2026-10-14", placeName: "Ieri risposto", via: "telefono", outcome: "bene" },
      { id: "d", date: "2026-10-01", placeName: "Vecchia", via: "sito" },
      { id: "e", date: "2026-10-16", time: "20:00", placeName: "Domani", via: "whatsapp" },
      { id: "f", date: "2026-10-16", placeName: "Domani nascosto", via: "whatsapp", dismissedEve: true },
    ];
    const rem = bk.bookingReminders(list, now);
    ok(rem.tomorrow.map((x) => x.id).join() === "e", "prenota: promemoria anche il giorno prima (nascondibile senza perdere quello del giorno stesso)");
    ok(rem.today.map((x) => x.id).join() === "a" && rem.howWasIt.map((x) => x.id).join() === "b", "prenota: promemoria il giorno stesso, 'Com'è andata?' dal giorno dopo (una volta)");
    // Due tavoli per lo stesso pasto (proposta CEO 19/10).
    const dop = [
      { id: "s1", placeId: "A", date: "2026-10-17", time: "20:30", placeName: "Uno", via: "whatsapp" },
      { id: "s2", placeId: "B", date: "2026-10-17", time: "21:30", placeName: "Due", via: "telefono" },
      { id: "s3", placeId: "C", date: "2026-10-17", time: "13:00", placeName: "Pranzo", via: "telefono" },
      { id: "s4", placeId: "A", date: "2026-10-18", time: "20:00", placeName: "Uno ripetuta", via: "whatsapp" },
      { id: "s5", placeId: "A", date: "2026-10-18", time: "20:30", placeName: "Uno di nuovo", via: "whatsapp" },
      { id: "s6", placeId: "D", date: "2026-10-19", time: "20:00", placeName: "Disdetta", via: "whatsapp", outcome: "non-andato", dismissed: true },
      { id: "s7", placeId: "E", date: "2026-10-19", time: "21:00", placeName: "Sola", via: "whatsapp" },
      { id: "s8", placeId: "F", date: "2026-10-14", time: "20:00", placeName: "Passata", via: "whatsapp" },
      { id: "s9", placeId: "G", date: "2026-10-14", time: "20:30", placeName: "Passata 2", via: "whatsapp" },
    ];
    const gr = bk.doubleBookings(dop, now).map((g) => g.map((x) => x.id).join("+"));
    { const rr = bk.bookingReminders([
        { id: "r1", date: "2026-10-16", time: "21:00", placeName: "Riaperto", via: "whatsapp", riapre: now.getTime() - 60_000 },
        { id: "r2", date: "2026-10-16", time: "21:00", placeName: "Non ancora riaperto", via: "whatsapp", riapre: now.getTime() + 3_600_000 },
        { id: "r3", date: "2026-10-16", time: "21:00", placeName: "Confermato", via: "whatsapp", riapre: now.getTime() - 60_000, confirmed: true },
        { id: "r4", date: "2026-10-14", time: "21:00", placeName: "Passato", via: "whatsapp", riapre: now.getTime() - 60_000 },
      ], now);
      ok(rr.risposta.map((x) => x.id).join() === "r1", `prenota: 'ti hanno risposto?' solo dopo la riapertura, se non confermata e ancora da fare (${rr.risposta.map((x) => x.id).join()})`); }
    ok(gr.join() === "s1+s2", `prenota: due tavoli la stessa sera trovati; pranzo, stesso locale, disdette e passate esclusi (${gr.join(" | ")})`);
    ok(bk.doubleBookings([{ id: "x1", placeId: "A", date: "2026-10-17", time: null, placeName: "X", via: "sito" }, { id: "x2", placeId: "B", date: "2026-10-17", time: "13:00", placeName: "Y", via: "sito" }], now).length === 1, "prenota: senza ora la prenotazione vale per pranzo e sera");
  }
  if (as) {
    ok(as.localRefineOf("più economici") === "economici" && as.localRefineOf("aperti ora") === "aperti" && as.localRefineOf("più vicini") === "vicini" && as.localRefineOf("meno conosciuti") === "meno-noti", "assistente: seguiti riconosciuti");
    ok(as.localRefineOf("solo con terrazza") === null && as.localRefineOf("più economici ma a Monti") === null && as.localRefineOf("e dopo un cocktail bar economico in centro storico") === null, "assistente: i seguiti con nuovi requisiti o zone sono ricerche nuove");
    const pl = [{ id: "x", lat: 0, lng: 0, priceLevel: 3, openNow: true, rating: 4.6, userRatingCount: 5000 }, { id: "y", lat: 0, lng: 0, priceLevel: 2, openNow: false, rating: 4.5, userRatingCount: 90 }];
    ok(as.applyLocalRefine("economici", pl).places.map((p) => p.id).join() === "y" && as.applyLocalRefine("meno-noti", pl).places[0].id === "y" && as.applyLocalRefine("aperti", pl).places.map((p) => p.id).join() === "x", "assistente: filtri sui risultati già avuti");
    ok(as.applyLocalRefine("vicini", pl, null) === null && as.applyLocalRefine("economici", [pl[0]]) === null, "assistente: senza dati (posizione, prezzi) si dice o si cerca di nuovo, niente di inventato");
  }

  const actx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, permissions: ["clipboard-read", "clipboard-write"] });
  await actx.addInitScript(() => { try { localStorage.setItem("mapetite.intro", "visto"); } catch { /* ignorato */ } });
  const aEvents = [];
  const searches = [];
  await actx.route("**/api/events", (route) => { aEvents.push(route.request().postDataJSON()); return route.fulfill({ status: 204, body: "" }); });
  await actx.route("**/api/places/photo**", (route) => route.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="#c96"/></svg>' }));
  await actx.route("**/rest/v1/**", (route) => route.fulfill({ json: [] }));
  // Salva dall'assistente: Rooftop Tre (P3) è già tra i salvati; il nuovo salvataggio è simulato.
  const aSaveInserts = [], aAdds = [];
  await actx.route("**/rest/v1/saved_places**", (route) => {
    if (route.request().method() === "POST") { aSaveInserts.push(route.request().postDataJSON()); return route.fulfill({ status: 201, body: "" }); }
    // Solo la lettura dell'assistente (Place ID dei salvati); la mappa riceve i salvati vuoti come prima.
    if (!decodeURIComponent(route.request().url()).includes("places(google_place_id)")) return route.fulfill({ json: [] });
    return route.fulfill({ json: [{ place_id: "33333333-0000-4000-8000-0000000000a3", places: { google_place_id: "P3" } }] });
  });
  await actx.route("**/api/places/add", (route) => { aAdds.push(route.request().postDataJSON()); return route.fulfill({ json: { place: { id: "33333333-0000-4000-8000-0000000000a1" } } }); });
  const aIntents = [];
  await actx.route("**/api/search/intent", (route) => { aIntents.push(route.request().postDataJSON()); return route.fulfill({ json: { intent: null } }); });
  await actx.route("https://wa.me/**", (route) => route.fulfill({ contentType: "text/html", body: "<p>WhatsApp</p>" }));
  await actx.route("https://example.com/**", (route) => route.fulfill({ contentType: "text/html", body: "<p>Sito</p>" }));
  const A_PLACES = [
    { ...PLACES[0], phone: "347 123 4567", priceLevel: 2 },
    PLACES[1],
    { ...PLACES[2], priceLevel: 3 },
  ];
  await actx.route("**/api/search", async (route) => {
    searches.push(route.request().postDataJSON());
    await new Promise((r) => setTimeout(r, 300));
    return route.fulfill({ json: { ...SEARCH_FAST, risultati: A_PLACES } });
  });
  await actx.route("**/api/search/synthesis", async (route) => { await new Promise((r) => setTimeout(r, 600)); return route.fulfill({ json: { ...SYNTH, livelli: { P3: "alto" } } }); });
  const ap = await actx.newPage();
  ap.on("pageerror", (e) => errors.push(e.message));
  ap.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/i.test(m.text())) errors.push(m.text().slice(0, process.env.E2E_DEBUG ? 3000 : 150) + (process.env.E2E_DEBUG ? " @ " + m.location().url : "")); });
  const ashot = (n) => ap.screenshot({ path: `${OUT}/${n}.png`, caret: "initial" });

  // Ingresso dalla mappa e dalla home
  await ap.goto(`${BASE}/mappa?scheda=b`, { waitUntil: "networkidle" });
  await idee(ap);
  ok(await ap.getByTestId("mappa-assistente").isVisible(), "mappa: 'Parla con l'assistente' nelle Idee (la barra resta la ricerca di oggi)");
  await ap.goto(`${BASE}/`, { waitUntil: "networkidle" });
  // Semplificare (Lorenzo 17/10): dalla home l'assistente si apre dalla barra in basso (niente tessera doppia).
  ok(await ap.getByTestId("barra-assistente").isVisible(), "home: 'Assistente' nella barra in basso");
  // In sviluppo il pulsante "N" di Next.js copre l'angolo in basso a sinistra: clic diretto sul link.
  await ap.getByTestId("barra-assistente").evaluate((el) => el.click());
  await ap.waitForURL(/\/assistente/);
  await ap.getByTestId("assistente-benvenuto").waitFor({ timeout: 8000 });
  ok(true, "assistente: si apre dalla home con il benvenuto e gli esempi");
  ok(await ap.getByTestId("assistente-campo").isVisible(), "assistente: campo per scrivere in basso");
  ok((await ap.getByTestId("assistente-esempi").getByRole("button").count()) === 4 && (await ap.getByTestId("assistente-idee").count()) === 0, "assistente: tre chip brevi + 'Altre idee' (niente card lunghe, Lorenzo 16/10)");
  await ap.getByTestId("assistente-altre-idee").click();
  ok((await ap.getByTestId("assistente-idee").getByRole("button").count()) === 5, "assistente: 'Altre idee' apre la lista completa delle frasi");
  await ap.getByTestId("assistente-altre-idee").click();
  { const f = await ap.getByTestId("assistente-campo").boundingBox(); ok(!!f && f.y + f.height <= 844 - 64, `assistente: il campo sta sopra la barra di navigazione (${Math.round((f?.y ?? 0) + (f?.height ?? 0))} px)`); }
  await ashot("50-assistente-benvenuto");

  // Prenotazione assistita: una sola ricerca, senza le parole di giorno/ora/persone
  await ap.getByTestId("assistente-campo").fill("prenotami domani alle 21 per 2 con terrazza a Roma");
  await ap.keyboard.press("Enter");
  await ap.getByTestId("assistente-attesa").waitFor({ timeout: 3000 }).then(() => ok(true, "assistente: 'Cerco i posti giusti…' mentre aspetta"), () => ok(false, "assistente: 'Cerco i posti giusti…' mentre aspetta"));
  await ap.getByTestId("assistente-card").getByText("Terrazza Uno").waitFor({ timeout: 8000 });
  ok(searches.length === 1 && searches[0].query === "ristorante con terrazza a roma" && searches[0].phase === "fast" && searches[0].searchIntent === "natural", `assistente: una ricerca, con la richiesta ripulita (${JSON.stringify(searches[0]?.query)})`);
  const firstReply = await ap.getByTestId("assistente-risposta").first().textContent();
  ok(firstReply.includes("2 persone") && firstReply.includes("alle 21:00") && firstReply.includes("domani"), `assistente: riepilogo della prenotazione nella risposta (${firstReply.slice(0, 90)}…)`);
  ok(firstReply.includes("la conferma arriva sempre dal locale"), "assistente: dice con onestà che i tavoli liberi non li vede");
  ok((await ap.getByTestId("assistente-card").getByText("Aperto ora").count()) === 0, "assistente: niente 'Aperto ora' se si prenota per un altro giorno (non direbbe niente)");
  ok((await ap.getByTestId("assistente-verdetto-attesa").count()) >= 1, "assistente: segnaposto del verdetto mentre arriva");
  await ap.getByTestId("assistente-card").getByText("Vista vera sui tetti di Roma.").waitFor({ timeout: 6000 });
  ok(true, "assistente: il verdetto compare sulla card");
  ok((await ap.getByTestId("assistente-card").getByText("Pub Fuori Tema").count()) === 0, "assistente: il locale escluso dai verdetti sparisce");
  ok((await ap.getByTestId("assistente-card").locator("li").first().textContent()).includes("Rooftop Tre"), "assistente: in cima il locale più adatto secondo i verdetti");
  ok((await ap.getByTestId("assistente-prenota").count()) === 2, "assistente: 'Prenota' su ogni card");
  await ashot("51-assistente-prenotazione");
  // Chat essenziale (Lorenzo 16/10, "il dono della sintesi"): risposta breve, card compatte in fila, azioni come chip.
  { const bubble = ap.getByTestId("assistente-risposta").first().locator("p").first();
    const t = (await bubble.textContent()) ?? "";
    ok(t.length <= 140 && (t.match(/[.?!](\s|$)/g) ?? []).length <= 2, `assistente: risposta in 1–2 frasi brevi (${t.length} caratteri)`);
    const lis = ap.getByTestId("assistente-card").first().locator("li");
    const [a, b] = [await lis.nth(0).boundingBox(), await lis.nth(1).boundingBox()];
    ok(!!a && !!b && Math.abs(a.y - b.y) < 2 && b.x > a.x && a.height <= 240, `assistente: card compatte in un carosello orizzontale (${Math.round(a?.height ?? 0)} px)`);
    const chips = ap.getByTestId("assistente-seguiti");
    ok(await chips.getByTestId("assistente-prenota-primo").isVisible() && await chips.getByRole("button", { name: "Più economici" }).isVisible(), "assistente: azioni come chip sotto la risposta ('Prenota il primo', 'Più economici'…)");
    const c = await ap.getByTestId("assistente-card").first().boundingBox(); const k = await chips.boundingBox();
    ok(!!c && !!k && k.y >= c.y + c.height, "assistente: le chip stanno sotto le card");
    ok((await ap.getByTestId("assistente-capito").first().textContent()).startsWith("Ho capito:") && (await ap.getByText("Sto scrivendo i verdetti…").count()) === 0, "assistente: 'Ho capito' in una riga piccola, nessun testo doppio sui verdetti");
    await chips.getByTestId("assistente-prenota-primo").click();
    await ap.getByRole("dialog", { name: "Prenota da Rooftop Tre" }).waitFor({ timeout: 3000 });
    ok(true, "assistente: 'Prenota il primo' apre il foglio del primo locale");
    await ap.getByRole("dialog", { name: "Prenota da Rooftop Tre" }).getByRole("button", { name: "Chiudi" }).click(); }
  ok(aEvents.some((e) => e.type === "pagina" && e.props?.pagina === "assistente"), "tracciamento: vista pagina 'assistente' (non più 'altro')");
  ok(aEvents.some((e) => e.type === "funzione" && e.props?.nome === "assistente_messaggio" && e.props?.contesto === "prenotazione") && !JSON.stringify(aEvents).includes("terrazza a Roma"),
    "assistente: messaggio registrato come 'prenotazione', senza il testo scritto");

  // Salva in un tocco dalla card (📌 Voglio andarci), stesso salvataggio della mappa
  { const cards = ap.getByTestId("assistente-card");
    ok((await cards.locator("li", { hasText: "Rooftop Tre" }).getByTestId("assistente-salvato").count()) === 1, "assistente: il locale già salvato mostra 'Salvato'");
    ok((await cards.locator("li", { hasText: "Terrazza Uno" }).getByTestId("assistente-salva").count()) === 1, "assistente: 'Salva' sulle card non salvate");
    await cards.getByRole("button", { name: "Salva Terrazza Uno tra i Voglio andarci" }).click();
    await cards.locator("li", { hasText: "Terrazza Uno" }).getByTestId("assistente-salvato").waitFor({ timeout: 5000 });
    ok(true, "assistente: dopo il tocco la card dice 'Salvato'");
    ok(aAdds.length === 1 && aAdds[0].googlePlaceId === "P1" && aAdds[0].name === "Terrazza Uno" && aAdds[0].firma === "firma-P1", "assistente (con la firma del server): il locale entra nel catalogo con /api/places/add (Place ID Google)");
    ok(aSaveInserts.length === 1 && aSaveInserts[0].place_id === "33333333-0000-4000-8000-0000000000a1" && JSON.stringify(aSaveInserts[0].tags) === '["Da provare"]', `assistente: salvato in saved_places come 'Da provare' con l'UUID (${JSON.stringify(aSaveInserts[0] ?? null)})`);
    await ap.getByTestId("assistente-salvato-avviso").waitFor({ timeout: 3000 });
    ok((await ap.getByTestId("assistente-salvato-avviso").textContent()).includes("Voglio andarci") && (await ap.getByTestId("assistente-salvato-avviso").getByRole("link", { name: "Sulla mappa" }).getAttribute("href")) === "/mappa?salvato=33333333-0000-4000-8000-0000000000a1",
      "assistente: avviso 'Salvato' con il collegamento alla mappa");
    await ap.waitForTimeout(150);
    ok(aEvents.some((e) => e.type === "salva" && e.props?.fonte === "assistente" && e.placeId === "33333333-0000-4000-8000-0000000000a1"), "assistente: salvataggio registrato (tipo 'salva', fonte assistente)");
    { const b = await cards.first().locator("li").first().boundingBox(); const s = await cards.first().locator("li").first().getByTestId(/assistente-(salva|salvato)/).boundingBox();
      ok(!!b && !!s && s.x >= b.x && s.x + s.width <= b.x + b.width + 1, "assistente: Salva e Prenota stanno dentro la card"); }
    await ashot("51b-assistente-salva");
    await ap.getByTestId("assistente-salvato-avviso").waitFor({ state: "hidden", timeout: 8000 });
  }

  // Foglio Prenota
  await ap.getByRole("button", { name: "Prenota da Terrazza Uno" }).click();
  await ap.getByTestId("foglio-prenota").waitFor({ timeout: 3000 });
  ok(aEvents.some((e) => e.type === "funzione" && e.props?.nome === "assistente_prenota"), "assistente: 'Prenota' dalla card registrato come prenotazione dall'assistente");
  await ap.getByLabel("Il tuo nome").fill("Giulia");
  const msg = await ap.getByTestId("prenota-messaggio").inputValue();
  ok(/vorrei prenotare un tavolo per 2 persone domani \d\d\/\d\d alle 21:00, in terrazza se possibile\. È disponibile\? Grazie, Giulia$/.test(msg), `prenota: messaggio già scritto con nome (${msg})`);
  ok((await ap.getByTestId("prenota-whatsapp").getAttribute("href")).startsWith("https://wa.me/393471234567?text=") && await ap.getByTestId("prenota-chiama").isVisible() && await ap.getByTestId("prenota-sito").isVisible(), "prenota: WhatsApp (cellulare), chiamata e sito del locale");
  ok((await ap.getByTestId("prenota-onesta").textContent()).includes("la conferma arriva dal locale"), "prenota: onestà sulla disponibilità");
  ok((await ap.getByTestId("prenota-riepilogo").textContent()).includes("2 persone") && (await ap.getByTestId("prenota-avanti").count()) === 0,
    "prenota in 2 passi: con i dati già detti in chat si parte dal passo 2 (riepilogo in una riga + messaggio)");
  await ap.getByTestId("prenota-messaggio").fill("Buonasera, un tavolo per 2 domani alle 21 in terrazza. Giulia");
  await ap.getByTestId("prenota-modifica").click();
  ok((await ap.getByTestId("prenota-messaggio").count()) === 0 && await ap.getByTestId("prenota-avanti").isVisible(), "prenota in 2 passi: 'Modifica' torna al passo 1 (quando e quanti), senza il messaggio");
  await ap.getByRole("button", { name: "Una persona in più" }).click();
  await ap.getByTestId("prenota-avanti").click();
  ok((await ap.getByTestId("prenota-messaggio").inputValue()).startsWith("Buonasera, un tavolo per 2 domani"), "prenota: il messaggio modificato a mano non viene riscritto");
  await ap.getByRole("button", { name: "Rigenera" }).click();
  ok((await ap.getByTestId("prenota-messaggio").inputValue()).includes("per 3 persone"), "prenota: persone modificabili, il messaggio si aggiorna");
  { const w = await ap.evaluate(() => document.scrollingElement.scrollWidth); ok(w <= 390, `prenota: niente scorrimento orizzontale (${w}px)`); }
  await ashot("52-prenota-foglio");
  const [popup] = await Promise.all([ap.waitForEvent("popup"), ap.getByTestId("prenota-whatsapp").click()]);
  ok(decodeURIComponent(popup.url()).includes("per 3 persone"), "prenota: WhatsApp si apre con il messaggio");
  await popup.close();
  await ap.getByTestId("prenota-fatto").waitFor({ timeout: 3000 });
  ok((await ap.getByTestId("prenota-fatto").textContent()).includes("La conferma arriva dal locale"), "prenota: 'Prenotazione richiesta' con la conferma che arriva dal locale");
  const saved = await ap.evaluate(() => JSON.parse(localStorage.getItem("mapetite.prenotazioni") ?? "[]"));
  ok(saved.length === 1 && saved[0].via === "whatsapp" && saved[0].people === 3 && saved[0].time === "21:00" && saved[0].placeName === "Terrazza Uno", "prenota: richiesta salvata nel telefono");
  ok(aEvents.some((e) => e.type === "chiama" && e.props?.fonte === "prenota" && e.props?.contesto === "whatsapp"), "prenota: segnale registrato (tipo esistente 'chiama', da prenota)");
  ok((await ap.getByTestId("prenota-vedi-prenotazioni").getAttribute("href")) === "/prenotazioni", "prenota: dopo l'invio, link 'Vedi le mie prenotazioni'");
  await ashot("53-prenota-richiesta");
  await ap.getByRole("button", { name: "Fatto" }).click();

  // Seguiti senza nuove ricerche
  await ap.getByTestId("assistente-seguiti").getByRole("button", { name: "Più economici" }).click();
  await ap.getByText("Senza una nuova ricerca: ho usato i posti di prima.").waitFor({ timeout: 3000 });
  const lastCards = ap.getByTestId("assistente-card").last();
  ok(searches.length === 1 && (await lastCards.getByText("Terrazza Uno").count()) === 1 && (await lastCards.getByText("Rooftop Tre").count()) === 0, "assistente: 'Più economici' filtra i posti di prima, nessuna chiamata Google");
  await ap.getByTestId("assistente-campo").fill("per 4");
  await ap.keyboard.press("Enter");
  await ap.getByText(/Perfetto: 4 persone/).waitFor({ timeout: 3000 });
  ok(searches.length === 1, "assistente: 'per 4' aggiorna la prenotazione senza cercare di nuovo");
  await ap.getByTestId("assistente-campo").fill("solo con terrazza");
  await ap.keyboard.press("Enter");
  await ap.waitForFunction(() => document.querySelectorAll("[data-testid=assistente-card]").length >= 3, null, { timeout: 8000 });
  ok(searches.length === 2 && searches[1].query === "ristorante con terrazza a roma solo con terrazza", `assistente: 'solo con terrazza' riformula la richiesta di prima (${JSON.stringify(searches[1]?.query)})`);
  { const seg = aEvents.filter((e) => e.type === "funzione" && e.props?.nome === "assistente_seguito").map((e) => e.props?.contesto);
    ok(seg.includes("economici") && seg.includes("ricerca"), `assistente: seguiti registrati (${seg.join(", ")})`);
    ok(aEvents.some((e) => e.type === "funzione" && e.props?.nome === "assistente_messaggio" && e.props?.contesto === "dettagli"), "assistente: 'per 4' registrato come dettaglio della prenotazione"); }
  // Segnali dell'assistente (esclusi quelli del foglio Prenota, di un'altra voce): ogni chiave arriva al server.
  { const mine = aEvents.filter((e) => !["chiama", "sito", "ci_sono_stato", "percorso"].includes(e.type));
    const lost = droppedKeys(mine);
    ok(SERVER_PROP_KEYS.includes("fonte") && SERVER_PROP_KEYS.includes("contesto") && mine.length > 5 && lost.length === 0, `assistente: tutte le chiavi dei segnali sono tra quelle che il server conserva (${lost.join(", ") || "nessuna scartata"})`); }
  ok(aIntents.length === 0, `assistente: inviando subito (senza pausa) nessuna richiesta all'AI in anticipo (${aIntents.length})`);

  // Card → scheda del locale, con Prenota e i dati già scelti
  await ap.getByTestId("assistente-card").last().getByText("Vista vera sui tetti di Roma.").waitFor({ timeout: 6000 });
  await ap.getByTestId("assistente-card").last().getByRole("button", { name: "Apri Terrazza Uno" }).click();
  await ap.getByTestId("assistente-scheda").waitFor({ timeout: 3000 });
  ok(await ap.getByTestId("assistente-scheda").getByTestId("verdetto-scheda").isVisible(), "assistente: tocco sulla card = scheda del locale con il verdetto");
  ok(aEvents.some((e) => e.type === "apri_scheda" && e.props?.fonte === "assistente"), "assistente: apertura della scheda registrata");
  await ap.getByTestId("prenota-scheda").click();
  await ap.getByTestId("foglio-prenota").waitFor({ timeout: 3000 });
  ok((await ap.getByTestId("prenota-persone").textContent()) === "4", "scheda → Prenota: persone già scelte nella conversazione");
  await ashot("54-scheda-prenota");
  await ap.getByRole("dialog", { name: "Prenota da Terrazza Uno" }).getByRole("button", { name: "Chiudi" }).click();
  await ap.getByTestId("assistente-scheda").click({ position: { x: 20, y: 20 } });

  // La conversazione resta nel telefono
  const bubbles = await ap.getByTestId("assistente-utente").count();
  await ap.reload({ waitUntil: "networkidle" });
  await ap.getByTestId("assistente-utente").first().waitFor({ timeout: 5000 });
  ok((await ap.getByTestId("assistente-utente").count()) === bubbles && searches.length === 2, `assistente: dopo aver ricaricato la conversazione c'è ancora (${bubbles} messaggi), senza ricerche nuove`);
  await ap.getByTestId("assistente-nuova").click();
  ok(await ap.getByTestId("assistente-benvenuto").isVisible(), "assistente: 'Nuova' ricomincia da capo");

  // Domande di chiarimento: solo ciò che manca per prenotare, una alla volta
  await ap.getByTestId("assistente-campo").fill("prenota stasera una trattoria a Trastevere");
  await ap.keyboard.press("Enter");
  await ap.getByTestId("assistente-domanda").waitFor({ timeout: 8000 });
  ok((await ap.getByTestId("assistente-risposta").last().textContent()).includes("Per quante persone?"), "assistente: chiede quante persone (manca)");
  await ap.getByTestId("assistente-domanda").getByRole("button", { name: "2 persone" }).click();
  await ap.getByText(/A che ora\?/).last().waitFor({ timeout: 3000 });
  ok(searches.length === 3, "assistente: la risposta alla domanda non rifà la ricerca");
  await ashot("55-assistente-domanda");

  // Promemoria in home: oggi e "Com'è andata?"
  await ap.evaluate(() => {
    const d = (n) => { const x = new Date(); x.setDate(x.getDate() + n); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`; };
    localStorage.setItem("mapetite.prenotazioni", JSON.stringify([
      { id: "t1", placeId: "P1", placeName: "Terrazza Uno", lat: 41.9, lng: 12.49, date: d(0), time: "21:00", people: 2, special: null, via: "whatsapp", createdAt: Date.now() },
      { id: "t2", placeId: "P3", placeName: "Rooftop Tre", lat: 41.902, lng: 12.494, date: d(-1), time: "20:30", people: 2, special: null, via: "telefono", createdAt: Date.now() },
    ]));
  });
  await ap.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await ap.getByTestId("promemoria-oggi").waitFor({ timeout: 5000 });
  ok((await ap.getByTestId("promemoria-oggi").textContent()).includes("Oggi alle 21:00") && (await ap.getByTestId("promemoria-oggi").textContent()).includes("Terrazza Uno"), "home: promemoria della prenotazione di oggi");
  ok((await ap.getByTestId("promemoria-com-e-andata").textContent()).includes("Rooftop Tre"), "home: 'Com'è andata?' il giorno dopo");
  await ashot("56-home-promemoria");
  await ap.getByRole("button", { name: "👍 Mi è piaciuto" }).click();
  ok((await ap.getByTestId("promemoria-com-e-andata").count()) === 0 && aEvents.some((e) => e.type === "ci_sono_stato" && e.props?.fonte === "prenota" && e.props?.stato === "bene"), "home: risposta a 'Com'è andata?' registrata, la domanda sparisce");
  await actx.addCookies([{ name: "e2e_profilo", value: encodeURIComponent(JSON.stringify({ email: "giulia@example.com", saved: [], reviews: [] })), url: BASE }]);
  await ap.goto(`${BASE}/profilo`, { waitUntil: "networkidle" });
  ok((await ap.getByTestId("promemoria-oggi").count()) === 1, "profilo: promemoria anche nel profilo");
  await actx.clearCookies({ name: "e2e_profilo" });
  // "Non vado più" (18/10, contro i tavoli vuoti): messaggio di disdetta già scritto e un tocco per mandarlo.
  await ap.evaluate(() => {
    const x = new Date(); const d = `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
    localStorage.setItem("mapetite.prenotazioni", JSON.stringify([{ id: "t3", placeId: "P1", placeName: "Terrazza Uno", lat: 41.9, lng: 12.49, date: d, time: "21:00", people: 2, special: null, via: "whatsapp", phone: "+39 333 123 4567", createdAt: Date.now() }]));
  });
  await ap.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await ap.getByTestId("promemoria-non-vado").click();
  { const t = (await ap.getByTestId("promemoria-disdetta-testo").textContent()) ?? "";
    const href = (await ap.getByTestId("disdetta-whatsapp").getAttribute("href")) ?? "";
    ok(/disdico la prenotazione per 2 persone di oggi \d\d\/\d\d alle 21:00/.test(t) && href.startsWith("https://wa.me/393331234567?text=") && decodeURIComponent(href).includes("disdico la prenotazione"), `promemoria: 'Non vado più' prepara la disdetta per WhatsApp (${t.slice(0, 80)})`);
    await ashot("56b-promemoria-disdetta");
    await ap.getByTestId("disdetta-whatsapp").evaluate((a) => { a.removeAttribute("target"); a.setAttribute("href", "#"); a.click(); });
    await ap.waitForTimeout(300);
    ok((await ap.getByTestId("promemoria-oggi").count()) === 0 && aEvents.some((e) => e.type === "funzione" && e.props?.nome === "prenotazione_disdetta" && e.props?.contesto === "whatsapp"), "promemoria: dopo la disdetta il promemoria sparisce e la disdetta si conta");
    { const ev = aEvents.find((e) => e.type === "funzione" && e.props?.nome === "prenotazione_disdetta");
      ok(ev?.googlePlaceId === "P1" && (typeof ev?.props?.ore === "number" || ev?.props?.stato === "in_ritardo"), `disdetta: segnale con il locale e le ore di anticipo (o "in ritardo" dopo l'ora del tavolo), per il pannello del ristoratore (${JSON.stringify({ g: ev?.googlePlaceId, ore: ev?.props?.ore, stato: ev?.props?.stato })})`); } }
  // Il giorno prima: "Domani alle 21:00", con "Non vado più" e senza Percorso.
  await ap.evaluate(() => {
    const x = new Date(); x.setDate(x.getDate() + 1); const d = `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
    localStorage.setItem("mapetite.prenotazioni", JSON.stringify([{ id: "t4", placeId: "P1", placeName: "Terrazza Uno", lat: 41.9, lng: 12.49, date: d, time: "21:00", people: 2, special: null, via: "telefono", phone: "06 1234 5678", createdAt: Date.now() }]));
  });
  await ap.goto(`${BASE}/`, { waitUntil: "networkidle" });
  { const dom = ap.getByTestId("promemoria-domani");
    const ok1 = await dom.waitFor({ timeout: 5000 }).then(() => true, () => false);
    ok(ok1 && ((await dom.textContent()) ?? "").includes("Domani alle 21:00") && (await dom.getByText("Percorso").count()) === 0, "promemoria: il giorno prima 'Domani alle 21:00', senza Percorso");
    await dom.getByTestId("promemoria-non-vado").click();
    ok(((await dom.getByTestId("disdetta-chiama").getAttribute("href")) ?? "") === "tel:0612345678" && ((await dom.getByTestId("promemoria-disdetta-testo").textContent()) ?? "").includes("di domani"), "promemoria: con un fisso la disdetta si fa chiamando, messaggio 'di domani'"); }
  // Due tavoli domani sera (proposta CEO 19/10): un solo promemoria "quale tieni?", poi la disdetta dell'altro.
  await ap.evaluate(() => {
    const x = new Date(); x.setDate(x.getDate() + 1); const d = `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
    localStorage.setItem("mapetite.prenotazioni", JSON.stringify([
      { id: "d1", placeId: "P1", placeName: "Terrazza Uno", lat: 41.9, lng: 12.49, date: d, time: "21:00", people: 2, special: null, via: "telefono", phone: "06 1234 5678", createdAt: Date.now() },
      { id: "d2", placeId: "P3", placeName: "Rooftop Tre", lat: 41.902, lng: 12.494, date: d, time: "20:30", people: 2, special: null, via: "whatsapp", phone: "+39 333 123 4567", createdAt: Date.now() },
    ]));
  });
  await ap.goto(`${BASE}/`, { waitUntil: "networkidle" });
  { const dop = ap.getByTestId("promemoria-doppio");
    const vis = await dop.waitFor({ timeout: 5000 }).then(() => true, () => false);
    ok(vis && ((await dop.textContent()) ?? "").includes("Hai 2 tavoli domani sera: quale tieni?") && (await ap.getByTestId("promemoria-domani").count()) === 0 && (await dop.getByTestId("tengo-questo").count()) === 2, "doppia prenotazione: un solo promemoria 'Hai 2 tavoli domani sera: quale tieni?' al posto di due");
    await ashot("56c-due-tavoli");
    await dop.getByTestId("tengo-questo").filter({ hasText: "Terrazza Uno" }).click();
    const testo = (await dop.getByTestId("promemoria-disdetta-testo").textContent()) ?? "";
    const href = (await dop.getByTestId("disdetta-whatsapp").getAttribute("href")) ?? "";
    ok(((await dop.textContent()) ?? "").includes("Tieni Terrazza Uno") && (await dop.getByTestId("promemoria-disdetta").count()) === 1 && testo.includes("alle 20:30") && href.startsWith("https://wa.me/393331234567"), "doppia prenotazione: scelto quello da tenere, la disdetta dell'altro (Rooftop Tre, 20:30) è già scritta");
    await ashot("56d-due-tavoli-scelto");
    await dop.getByTestId("disdetta-whatsapp").evaluate((a) => { a.removeAttribute("target"); a.setAttribute("href", "#"); a.click(); });
    await ap.waitForTimeout(300);
    ok((await ap.getByTestId("promemoria-doppio").count()) === 0 && ((await ap.getByTestId("promemoria-domani").textContent()) ?? "").includes("Terrazza Uno") && aEvents.some((e) => e.type === "funzione" && e.props?.nome === "doppia_prenotazione"), "doppia prenotazione: avvisato l'altro locale resta il promemoria del tavolo tenuto"); }

  // Richiesta mandata a locale chiuso: alla riapertura "ti hanno risposto?" (Sì, confermato / Non ancora).
  await ap.evaluate(() => {
    const x = new Date(); x.setDate(x.getDate() + 1); const d = `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
    localStorage.setItem("mapetite.prenotazioni", JSON.stringify([{ id: "r1", placeId: "P1", placeName: "Terrazza Uno", lat: 41.9, lng: 12.49, date: d, time: "21:00", people: 2, special: null, via: "whatsapp", phone: "+39 333 123 4567", createdAt: Date.now() - 3_600_000, riapre: Date.now() - 60_000, dismissedEve: true }]));
  });
  await ap.goto(`${BASE}/`, { waitUntil: "networkidle" });
  { const rsp = ap.getByTestId("promemoria-risposta");
    const vis = await rsp.waitFor({ timeout: 5000 }).then(() => true, () => false);
    ok(vis && ((await rsp.textContent()) ?? "").includes("Terrazza Uno: ti hanno risposto?"), "prenota a locale chiuso: alla riapertura 'Terrazza Uno: ti hanno risposto?'");
    await ashot("56e-ti-hanno-risposto");
    if (vis) await rsp.getByTestId("risposta-confermata").click();
    await ap.waitForTimeout(300);
    const saved = await ap.evaluate(() => JSON.parse(localStorage.getItem("mapetite.prenotazioni") ?? "[]"));
    ok((await ap.getByTestId("promemoria-risposta").count()) === 0 && saved[0]?.confirmed === true, "prenota a locale chiuso: 'Sì, confermato' segna la prenotazione confermata e il promemoria sparisce"); }
  // Scheda della mappa: stesso pulsante Prenota. Terrazza Uno con orari Google: solo 12–15 tutti i giorni.
  const soloPranzo = Array.from({ length: 7 }, (_, d) => [d * 1440 + 720, d * 1440 + 900]);
  const soloSera = Array.from({ length: 7 }, (_, d) => [d * 1440 + 1140, d * 1440 + 1410]);
  await ap.route("**/api/search", (r) => r.fulfill({ json: { ...SEARCH_FAST, risultati: SEARCH_FAST.risultati.map((x) => (x.id === "P1" ? { ...x, orari: soloPranzo } : x.id === "P3" ? { ...x, orari: soloSera } : x)) } }));
  // Foglio vuoto: senza prenotazioni precedenti ("Come l'ultima volta" riempirebbe persone e ora). Rimesse dopo.
  const prenPrima = await ap.evaluate(() => { const v = localStorage.getItem("mapetite.prenotazioni"); localStorage.removeItem("mapetite.prenotazioni"); return v; });
  await ap.goto(`${BASE}/mappa?scheda=b`, { waitUntil: "networkidle" });
  await (await esempio(ap)).click();
  const mapCard = ap.locator("li", { hasText: "Terrazza Uno" }).locator("button", { hasText: "Terrazza Uno" }).first();
  await mapCard.waitFor({ timeout: 8000 });
  await ap.waitForTimeout(1500); // verdetti e riordino del carosello
  await mapCard.click();
  // Card di lato (lista nuova): il primo tocco la centra, il secondo apre la scheda.
  if (!(await ap.getByTestId("prenota-scheda").waitFor({ timeout: 1500 }).then(() => true, () => false))) await mapCard.click();
  await ap.getByTestId("prenota-scheda").waitFor({ timeout: 4000 });
  await ap.getByTestId("prenota-scheda").click();
  await ap.getByTestId("foglio-prenota").waitFor({ timeout: 3000 });
  ok((await ap.getByTestId("prenota-manca").textContent()).includes("quante persone"), "mappa → scheda → Prenota: chiede i dati mancanti prima di scrivere al locale");
  ok(await ap.getByTestId("prenota-avanti").isDisabled() && (await ap.getByTestId("prenota-messaggio").count()) === 0, "prenota in 2 passi: senza dati si parte dal passo 1 e 'Avanti' resta spento");
  { const f = ap.getByTestId("foglio-prenota");
    await f.getByRole("button", { name: "Oggi", exact: true }).click();
    const sbarrato = await f.getByRole("button", { name: "21:00", exact: true }).evaluate((el) => el.className.includes("line-through"));
    await f.getByRole("button", { name: "21:00", exact: true }).click();
    const avviso = await ap.getByTestId("prenota-chiuso").isVisible().catch(() => false);
    await f.getByRole("button", { name: "13:00", exact: true }).click();
    const viaAvviso = (await ap.getByTestId("prenota-chiuso").count()) === 0;
    ok(sbarrato && avviso && viaAvviso, `prenota: con gli orari Google l'ora in cui il locale è chiuso è barrata e c'è l'avviso; alle 13 no (${sbarrato}, ${avviso}, ${viaAvviso})`);
    await f.getByRole("button", { name: "21:00", exact: true }).click();
    await f.screenshot({ path: `${OUT}/58b-prenota-chiuso.png` }).catch(() => {});
    // Proposta CEO 20/10: chiuso a quell'ora → i locali della stessa ricerca aperti a quell'ora.
    const alt = ap.getByTestId("prenota-alternative");
    const altVis = await alt.isVisible().catch(() => false);
    const altTesto = altVis ? (await alt.textContent()) ?? "" : "";
    ok(altVis && altTesto.includes("Rooftop Tre") && !altTesto.includes("Pub Fuori Tema"), `prenota: alle 21 Terrazza Uno è chiusa → propone Rooftop Tre, aperto a quell'ora (${altTesto.slice(0, 80)})`);
    if (altVis) {
      await alt.getByRole("button", { name: /Rooftop Tre/ }).click();
      const nuovo = ap.getByRole("dialog", { name: /Prenota da Rooftop Tre/ });
      const aperto = await nuovo.waitFor({ timeout: 4000 }).then(() => true, () => false);
      ok(aperto && (await nuovo.getByRole("button", { name: "21:00", exact: true }).getAttribute("aria-pressed")) === "true", "prenota: 'Prenota lì' apre il foglio Prenota di Rooftop Tre con le 21:00 già scelte");
      await nuovo.getByRole("button", { name: "Chiudi" }).click().catch(() => {});
    } }
  await ap.evaluate((v) => { if (v != null) localStorage.setItem("mapetite.prenotazioni", v); }, prenPrima);
  await ap.unroute("**/api/search");
  if (await ap.getByRole("dialog", { name: /Prenota da/ }).count()) await ap.getByRole("dialog", { name: /Prenota da/ }).getByRole("button", { name: "Chiudi" }).click();
  ok((await ap.getByTestId("foglio-prenota").count()) === 0 && await ap.getByTestId("prenota-scheda").isVisible(), "mappa: chiudere il foglio Prenota lascia la scheda aperta");
  await actx.close();

  // 360 px: si legge, niente scorrimento orizzontale
  const nctx = await browser.newContext({ viewport: { width: 360, height: 780 }, deviceScaleFactor: 2 });
  await nctx.addInitScript(() => { try { localStorage.setItem("mapetite.intro", "visto"); } catch { /* ignorato */ } });
  await nctx.route("**/api/events", (route) => route.fulfill({ status: 204, body: "" }));
  await nctx.route("**/api/places/photo**", (route) => route.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="#c96"/></svg>' }));
  await nctx.route("**/rest/v1/**", (route) => route.fulfill({ json: [] }));
  await nctx.route("**/api/search", (route) => route.fulfill({ json: { ...SEARCH_FAST, risultati: A_PLACES } }));
  await nctx.route("**/api/search/synthesis", (route) => route.fulfill({ json: SYNTH }));
  const np = await nctx.newPage();
  np.on("pageerror", (e) => errors.push(e.message));
  await np.goto(`${BASE}/assistente?q=${encodeURIComponent("Trattoria non turistica a Testaccio")}`, { waitUntil: "networkidle" });
  await np.getByTestId("assistente-card").getByText("Vista vera sui tetti di Roma.").waitFor({ timeout: 8000 });
  ok(!np.url().includes("q="), "assistente: /assistente?q=… parte da solo e la richiesta sparisce dall'indirizzo");
  { const w = await np.evaluate(() => document.scrollingElement.scrollWidth); ok(w <= 360, `assistente a 360 px: niente scorrimento orizzontale (${w}px)`); }
  await np.screenshot({ path: `${OUT}/57-assistente-360.png`, caret: "initial" });
  await np.getByTestId("assistente-prenota").first().click();
  await np.getByTestId("foglio-prenota").waitFor({ timeout: 3000 });
  { const w = await np.evaluate(() => document.scrollingElement.scrollWidth); ok(w <= 360, `prenota a 360 px: niente scorrimento orizzontale (${w}px)`); }
  await np.screenshot({ path: `${OUT}/58-prenota-360.png`, caret: "initial" });
  // Salva senza accesso: il locale si ricorda e si salva da solo dopo il login (come la mappa).
  await nctx.addCookies([{ name: "e2e_anonimo", value: "1", url: BASE }]);
  await np.goto(`${BASE}/assistente`, { waitUntil: "networkidle" });
  await np.getByTestId("assistente-card").first().waitFor({ timeout: 5000 });
  ok((await np.getByTestId("assistente-salvato").count()) === 0 && (await np.getByTestId("assistente-salva").count()) >= 2, "assistente senza accesso: 'Salva' su ogni card, nessun 'Salvato'");
  { const li = np.getByTestId("assistente-card").locator("li").first();
    const [b, s, p] = [await li.boundingBox(), await li.getByTestId("assistente-salva").boundingBox(), await li.getByTestId("assistente-prenota").boundingBox()];
    ok(!!b && !!s && !!p && s.x >= b.x && p.x + p.width <= b.x + b.width + 1 && s.x + s.width <= p.x, `assistente a 360 px: Salva e Prenota affiancati dentro la card (${Math.round(s?.width ?? 0)}+${Math.round(p?.width ?? 0)} px)`); }
  await np.getByTestId("assistente-salva").first().click();
  await np.waitForURL(/\/login\?message=/, { timeout: 8000 });
  { const pend = await np.evaluate(() => JSON.parse(localStorage.getItem("mapetite-salva-dopo-accesso") ?? "null"));
    ok(!!pend && ["P1", "P3"].includes(pend.place?.id) && JSON.stringify(pend.tags) === '["Da provare"]' && decodeURIComponent(np.url()).includes("per salvare"), `assistente senza accesso: Salva porta all'accesso e il locale si salva dopo (${pend?.place?.name})`); }
  await nctx.close();

  // Memoria dei gusti (piano 1.4): preferenze dichiarate capite a regole (nessuna AI), ricordate
  // solo dopo un "Sì", usate nelle ricerche come parole della richiesta (nessuna chiamata in più),
  // togliibili con un tocco; zona abituale dai salvati; "Cosa so di te" nel profilo.
  {
    let gm = null;
    try { gm = await import(new URL("../../src/lib/gusti.ts", import.meta.url).href); } catch (e) { ok(false, `gusti: modulo src/lib/gusti.ts importabile (${e.message})`); }
    if (gm) {
      const d = (s) => gm.gustiDichiarati(s);
      ok(d("Sono vegetariano").ids.join() === "vegetariano" && d("Sono vegetariano").soloPreferenza, "gusti: 'sono vegetariano' capito, solo preferenza (nessuna ricerca)");
      ok(d("ricordati che non mi piace il pesce").ids.join() === "no-pesce" && d("evito i posti rumorosi").ids.join() === "tranquillo" && d("sono allergico ai crostacei").ids.join() === "no-pesce", "gusti: 'non mi piace il pesce', 'evito i posti rumorosi', 'allergico ai crostacei'");
      ok(d("budget basso").ids.join() === "budget-basso" && d("max 30 euro a testa").ids.join() === "budget-30" && d("sono vegana e odio i posti turistici").ids.join() === "vegano,no-turistici", "gusti: budget, 'max 30 euro', vegana + niente turistici");
      ok(d("sono celiaco, cerco una pizzeria a Prati").ids.join() === "celiaco" && !d("sono celiaco, cerco una pizzeria a Prati").soloPreferenza, "gusti: preferenza dentro una ricerca → la ricerca parte e si propone di ricordarla");
      ok(["Trattoria non turistica a Testaccio", "Prenotami domani alle 21 per 2 con terrazza a Roma", "trattoria a Monti, niente pesce", "ristorante di pesce a Ostia", "Aperitivo con vista a Milano"].every((s) => d(s).ids.length === 0), "gusti: le richieste di stasera ('non turistica', 'niente pesce' dentro una ricerca) non diventano gusti da ricordare");
      ok(gm.gustiPerRicerca("trattoria a Monti", ["vegetariano", "no-pesce"]).query === "trattoria a Monti, con piatti vegetariani, senza pesce", "gusti: entrano nella richiesta come parole");
      ok(gm.gustiPerRicerca("ristorante di pesce a Ostia", ["vegetariano", "no-pesce"]).usati.length === 0 && gm.gustiPerRicerca("cocktail bar a Monti", ["vegetariano", "budget-20"]).query === "cocktail bar a Monti, economico", "gusti: la richiesta scritta vince; niente 'piatti vegetariani' per un cocktail bar");
      { const r = gm.inFondoPerGusti([{ name: "Mare", category: "seafood_restaurant" }, { name: "Verde", category: "restaurant" }], gm.gustiPerRicerca("trattoria", ["no-pesce"]).usati);
        ok(r.places.map((p) => p.name).join() === "Verde,Mare" && r.spostati === 1, "gusti: il posto di pesce va in fondo, non sparisce"); }
      ok(gm.aggiungiGusti(["vegetariano", "budget-20"], ["vegano", "budget-basso"]).join() === "vegano,budget-basso" && gm.gustiValidi(["vegano", "inventato", 3, "vegano"]).join() === "vegano", "gusti: vegano assorbe vegetariano, un budget sostituisce l'altro, solo gusti conosciuti");
      const monti = [{ lat: 41.8946, lng: 12.493 }, { lat: 41.895, lng: 12.492 }, { lat: 41.894, lng: 12.494 }, { lat: 41.889, lng: 12.47 }];
      ok(gm.zonaAbituale(monti)?.nome === "Monti" && gm.zonaAbituale(monti.slice(0, 2)) === null, "gusti: zona abituale dai salvati (almeno 3 nello stesso quartiere)");
      ok(gm.fraseConZona("trattoria a Monti") && gm.fraseConZona("pizza a Milano") && gm.fraseConZona("bar qui vicino") && !gm.fraseConZona("trattoria romana"), "gusti: si riconosce quando la frase dice già dove");
    }

    const U = "00000000-0000-0000-0000-000000000001";
    const gctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    await gctx.addInitScript(() => { try { localStorage.setItem("mapetite.intro", "visto"); } catch { /* ignorato */ } });
    const gEvents = [], gSearches = [], gSynth = [], gIntents = [], gPatches = [];
    await gctx.route("**/api/events", (route) => { gEvents.push(route.request().postDataJSON()); return route.fulfill({ status: 204, body: "" }); });
    await gctx.route("**/api/places/photo**", (route) => route.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="#c96"/></svg>' }));
    await gctx.route("**/rest/v1/**", (route) => route.fulfill(route.request().method() === "GET" ? { json: [] } : { status: 204, body: "" }));
    // Salvati: tre a Monti e uno a Trastevere → "Di solito vai a Monti".
    await gctx.route("**/rest/v1/saved_places**", (route) => {
      if (!decodeURIComponent(route.request().url()).includes("places(lat")) return route.fulfill({ json: [] });
      return route.fulfill({ json: [{ places: { lat: 41.8946, lng: 12.493 } }, { places: { lat: 41.895, lng: 12.492 } }, { places: { lat: 41.894, lng: 12.494 } }, { places: { lat: 41.889, lng: 12.47 } }] });
    });
    await gctx.route("**/rest/v1/profiles**", (route) => {
      if (route.request().method() === "PATCH") { gPatches.push(route.request().postDataJSON()); return route.fulfill({ status: 204, body: "" }); }
      return route.fulfill({ json: [] }); // colonna non ancora creata o profilo vuoto: si usa il telefono
    });
    await gctx.route("**/api/search/intent", (route) => { gIntents.push(route.request().postDataJSON()); return route.fulfill({ json: { intent: null } }); });
    const G_PLACES = [
      mk("G1", "Mare Blu", 41.8945, 12.4935, { category: "seafood_restaurant", userRatingCount: 300 }),
      mk("G2", "Trattoria Verde", 41.8949, 12.4931, { category: "restaurant", userRatingCount: 120 }),
      mk("G3", "Osteria del Vicolo", 41.8941, 12.4925, { category: "restaurant", userRatingCount: 90 }),
    ];
    await gctx.route("**/api/search", async (route) => {
      gSearches.push(route.request().postDataJSON());
      await new Promise((r) => setTimeout(r, 200));
      return route.fulfill({ json: { risultati: G_PLACES, filtri_usati: { categoria: "trattoria", parole_chiave: [], vicino_a_me: false, zona: null }, sintesi_pendente: { places: [], token: "g" } } });
    });
    await gctx.route("**/api/search/synthesis", async (route) => {
      gSynth.push(route.request().postDataJSON());
      return route.fulfill({ json: { dettagli: { G2: { synthesis: "Cucina di casa.", tags: [], verdict: "Verdure dell'orto e carbonara vegetariana.", goFor: [], dontExpect: [], matchReason: "Piatti vegetariani nelle recensioni." } }, esclusi: [] } });
    });
    const gp = await gctx.newPage();
    gp.on("pageerror", (e) => errors.push(e.message));
    gp.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/i.test(m.text())) errors.push(m.text().slice(0, process.env.E2E_DEBUG ? 3000 : 150) + (process.env.E2E_DEBUG ? " @ " + m.location().url : "")); });
    await gp.goto(`${BASE}/assistente`, { waitUntil: "networkidle" });
    // 1. Solo la preferenza: nessuna ricerca, domanda "Me lo ricordo?".
    await gp.getByTestId("assistente-campo").fill("sono vegetariano e non mi piace il pesce");
    await gp.waitForTimeout(900); // pausa nello scrivere: per una preferenza nessuna richiesta all'AI in anticipo
    await gp.getByTestId("assistente-campo").press("Enter");
    await gp.getByTestId("assistente-ricorda").waitFor({ timeout: 5000 });
    ok((await gp.getByTestId("assistente-ricorda").textContent()).includes("vegetariano · niente pesce"), "gusti: 'Me lo ricordo? vegetariano · niente pesce'");
    ok(gSearches.length === 0 && gIntents.length === 0, `gusti: per una preferenza nessuna ricerca Google e nessuna richiesta all'AI (${gSearches.length}, ${gIntents.length})`);
    ok(gPatches.length === 0 && (await gp.evaluate((u) => localStorage.getItem(`mapetite.gusti.${u}`), U)) === null, "gusti: niente salvato prima del Sì");
    await gp.screenshot({ path: `${OUT}/60-gusti-proposta.png`, caret: "initial" });
    await gp.getByTestId("assistente-ricorda-si").click();
    await gp.getByTestId("assistente-ricorda").getByText("Fatto, me lo ricordo").waitFor({ timeout: 3000 });
    await gp.waitForTimeout(300);
    ok(gPatches.length === 1 && JSON.stringify(gPatches[0]) === '{"gusti_ricordati":["vegetariano","no-pesce"]}', `gusti: dopo il Sì salvati nel profilo (${JSON.stringify(gPatches[0] ?? null)})`);
    ok((await gp.evaluate((u) => localStorage.getItem(`mapetite.gusti.${u}`), U)) === '["vegetariano","no-pesce"]', "gusti: copia nel telefono (funziona anche senza la migrazione)");
    ok((await gp.getByTestId("assistente-ricorda").getByRole("link", { name: "Cosa so di te" }).getAttribute("href")) === "/profilo#cosa-so-di-te", "gusti: rimanda a 'Cosa so di te' nel profilo");
    // 2. Ricerca senza zona: i gusti entrano nella richiesta (Google e verdetti), riga "Tengo conto di".
    await gp.getByTestId("assistente-campo").fill("trattoria romana");
    await gp.getByTestId("assistente-campo").press("Enter");
    await gp.getByTestId("assistente-card").getByText("Trattoria Verde").waitFor({ timeout: 8000 });
    await gp.getByTestId("assistente-card").getByText("Verdure dell'orto e carbonara vegetariana.").waitFor({ timeout: 6000 }).catch(() => {});
    ok(gSearches.length === 1 && gSearches[0].query === "trattoria romana, con piatti vegetariani, senza pesce", `gusti: una sola ricerca, con i gusti nella richiesta (${gSearches[0]?.query})`);
    ok(gSynth.length === 1 && gSynth[0].query === gSearches[0].query, "gusti: i verdetti ricevono la stessa richiesta (nessuna chiamata in più)");
    { const row = gp.getByTestId("assistente-gusti").last();
      const t = await row.textContent();
      ok(t.includes("Tengo conto di") && t.includes("vegetariano") && t.includes("niente pesce"), `gusti: riga 'Tengo conto di: vegetariano · niente pesce' (${t})`); }
    { const first = await gp.getByTestId("assistente-card").last().locator("li").first().textContent();
      const lastLi = await gp.getByTestId("assistente-card").last().locator("li").last().textContent();
      ok(!first.includes("Mare Blu") && lastLi.includes("Mare Blu"), "gusti: il ristorante di pesce va in fondo (non sparisce)"); }
    ok((await gp.getByTestId("assistente-nota").last().textContent()).includes("Ho messo in fondo un posto di pesce"), "gusti: si dice perché un posto è in fondo");
    await gp.getByTestId("assistente-zona").waitFor({ timeout: 3000 });
    ok((await gp.getByTestId("assistente-zona").textContent()).includes("Di solito vai a Monti: cerco lì?"), "gusti: 'Di solito vai a Monti: cerco lì?' (dai salvati) quando la frase non dice dove");
    await gp.screenshot({ path: `${OUT}/61-gusti-ricerca.png`, caret: "initial" });
    await gp.getByTestId("assistente-zona").scrollIntoViewIfNeeded();
    await gp.screenshot({ path: `${OUT}/61b-gusti-zona.png`, caret: "initial" });
    // 3. Un tocco toglie un gusto da questa conversazione: stessa ricerca senza.
    await gp.getByTestId("assistente-gusti").last().getByRole("button", { name: /vegetariano/ }).click();
    await gp.waitForFunction(() => document.querySelectorAll("[data-testid=assistente-card]").length === 2, null, { timeout: 8000 });
    ok(gSearches.length === 2 && gSearches[1].query === "trattoria romana, senza pesce", `gusti: tolto 'vegetariano' → stessa ricerca senza (${gSearches[1]?.query})`);
    await gp.getByTestId("assistente-nota").last().getByText("Senza “vegetariano”").waitFor({ timeout: 3000 }).then(() => ok(true, "gusti: si dice che vale solo per questa conversazione"), () => ok(false, "gusti: si dice che vale solo per questa conversazione"));
    // 4. "Cerca a Monti": ricerca nella zona abituale, il gusto tolto resta tolto.
    await gp.getByTestId("assistente-zona").getByRole("button", { name: "Cerca a Monti" }).click();
    await gp.waitForFunction(() => document.querySelectorAll("[data-testid=assistente-card]").length === 3, null, { timeout: 8000 });
    ok(gSearches.length === 3 && gSearches[2].query === "trattoria romana a Monti, senza pesce", `gusti: 'Cerca a Monti' rifà la ricerca lì (${gSearches[2]?.query})`);
    ok((await gp.getByTestId("assistente-zona").count()) === 0, "gusti: con la zona scritta non si ripropone");
    // 5. La richiesta scritta vince: "ristorante di pesce" non riceve "senza pesce".
    await gp.getByTestId("assistente-nuova").click();
    await gp.getByTestId("assistente-campo").fill("ristorante di pesce a Ostia");
    await gp.getByTestId("assistente-campo").press("Enter");
    await gp.waitForFunction(() => document.querySelectorAll("[data-testid=assistente-card]").length === 1, null, { timeout: 8000 });
    ok(gSearches[3]?.query === "ristorante di pesce a Ostia" && (await gp.getByTestId("assistente-gusti").count()) === 0, `gusti: la richiesta esplicita vince sui gusti ricordati (${gSearches[3]?.query})`);
    // 6. Preferenza già ricordata: nessuna nuova domanda.
    await gp.getByTestId("assistente-campo").fill("sono vegetariano");
    await gp.getByTestId("assistente-campo").press("Enter");
    await gp.getByText("Lo so già").waitFor({ timeout: 3000 }).then(() => ok(true, "gusti: preferenza già ricordata → 'Lo so già', nessuna domanda"), () => ok(false, "gusti: preferenza già ricordata → 'Lo so già', nessuna domanda"));
    ok(gSearches.length === 4, "gusti: nessuna ricerca per 'sono vegetariano'");
    { const mem = gEvents.filter((e) => e.type === "funzione" && e.props?.nome === "assistente_memoria").map((e) => e.props?.contesto);
      ok(["proposta", "si", "tolto", "zona"].every((k) => mem.includes(k)), `gusti: segnali registrati (${mem.join(", ")})`);
      const all = JSON.stringify(gEvents);
      ok(!all.includes("non mi piace") && !all.includes("trattoria romana") && !all.includes("Ostia"), "gusti: mai il testo scritto nei segnali");
      const lost = droppedKeys(gEvents.filter((e) => e.type === "funzione"));
      ok(lost.length === 0, `gusti: tutte le chiavi dei segnali sono tra quelle che il server conserva (${lost.join(", ") || "nessuna scartata"})`); }
    // 7. "Cosa so di te" nel profilo: vedere e cancellare.
    await gctx.addCookies([{ name: "e2e_profilo", value: encodeURIComponent(JSON.stringify({ email: "tester@example.com", saved: [], reviews: [] })), url: BASE }]);
    await gp.goto(`${BASE}/profilo#cosa-so-di-te`, { waitUntil: "networkidle" });
    await gp.getByTestId("gusto-ricordato").first().waitFor({ timeout: 5000 });
    ok((await gp.getByTestId("gusto-ricordato").allTextContents()).map((t) => t.trim()).join("|") === "vegetariano|niente pesce", "profilo: 'Cosa so di te' mostra i gusti ricordati");
    await gp.getByTestId("cosa-so-zona").waitFor({ timeout: 3000 }).then(() => ok(true, "profilo: zona abituale 'Salvi spesso a Monti'"), () => ok(false, "profilo: zona abituale 'Salvi spesso a Monti'"));
    { const w = await gp.evaluate(() => document.scrollingElement.scrollWidth); ok(w <= 390, `profilo: niente scorrimento orizzontale (${w}px)`); }
    await gp.getByTestId("cosa-so-di-te").scrollIntoViewIfNeeded();
    await gp.screenshot({ path: `${OUT}/62-cosa-so-di-te.png`, caret: "initial" });
    await gp.getByRole("button", { name: "Dimentica “vegetariano”" }).click();
    await gp.waitForFunction(() => document.querySelectorAll("[data-testid=gusto-ricordato]").length === 1, null, { timeout: 3000 });
    await gp.waitForTimeout(300);
    ok(JSON.stringify(gPatches[gPatches.length - 1]) === '{"gusti_ricordati":["no-pesce"]}', `profilo: 'Dimentica' cancella dal profilo (${JSON.stringify(gPatches[gPatches.length - 1])})`);
    await gctx.close();

    // 360 px e senza accesso: i gusti restano nel telefono.
    const g3 = await browser.newContext({ viewport: { width: 360, height: 780 }, deviceScaleFactor: 2 });
    await g3.addInitScript(() => { try { localStorage.setItem("mapetite.intro", "visto"); } catch { /* ignorato */ } });
    await g3.addCookies([{ name: "e2e_anonimo", value: "1", url: BASE }]);
    const g3Patches = [], g3Searches = [];
    await g3.route("**/api/events", (route) => route.fulfill({ status: 204, body: "" }));
    await g3.route("**/api/places/photo**", (route) => route.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"/>' }));
    await g3.route("**/rest/v1/**", (route) => { if (route.request().method() !== "GET") g3Patches.push(route.request().url()); return route.fulfill(route.request().method() === "GET" ? { json: [] } : { status: 204, body: "" }); });
    await g3.route("**/api/search/intent", (route) => route.fulfill({ json: { intent: null } }));
    await g3.route("**/api/search", (route) => { g3Searches.push(route.request().postDataJSON()); return route.fulfill({ json: { risultati: G_PLACES, filtri_usati: { categoria: "trattoria", parole_chiave: [], vicino_a_me: false, zona: "Monti" }, sintesi_pendente: null } }); });
    const g3p = await g3.newPage();
    g3p.on("pageerror", (e) => errors.push(e.message));
    await g3p.goto(`${BASE}/assistente`, { waitUntil: "networkidle" });
    await g3p.getByTestId("assistente-campo").fill("sono celiaco ed evito i posti rumorosi");
    await g3p.getByTestId("assistente-campo").press("Enter");
    await g3p.getByTestId("assistente-ricorda-si").click();
    await g3p.getByTestId("assistente-ricorda").getByText("Fatto, me lo ricordo").waitFor({ timeout: 3000 });
    ok((await g3p.evaluate(() => localStorage.getItem("mapetite.gusti.ospite"))) === '["celiaco","tranquillo"]' && g3Patches.length === 0, "gusti senza accesso: ricordati nel telefono, nessuna scrittura sul database");
    await g3p.getByTestId("assistente-campo").fill("trattoria a Monti");
    await g3p.getByTestId("assistente-campo").press("Enter");
    await g3p.getByTestId("assistente-gusti").waitFor({ timeout: 6000 });
    ok(g3Searches[0]?.query === "trattoria a Monti, senza glutine, tranquillo", `gusti senza accesso: usati nella ricerca (${g3Searches[0]?.query})`);
    { const w = await g3p.evaluate(() => document.scrollingElement.scrollWidth); ok(w <= 360, `gusti a 360 px: niente scorrimento orizzontale (${w}px)`); }
    await g3p.screenshot({ path: `${OUT}/63-gusti-360.png`, caret: "initial" });
    await g3.close();
  }

  // Serata completa a tappe (piano 1.2): una ricerca per tappa (massimo 3), intento costruito
  // senza AI, scelta vicina alla tappa precedente (non la più popolare), distanze a piedi stimate,
  // mini mappa con i pin numerati, percorso in Google Maps, Salva/Prenota e alternative per tappa.
  {
    let se = null;
    try { se = await import(new URL("../../src/lib/serata.ts", import.meta.url).href); } catch (e) { ok(false, `serata: modulo src/lib/serata.ts importabile (${e.message})`); }
    if (se) {
      const p = se.serataOf("organizzami sabato sera: aperitivo, cena, dopocena a Trastevere");
      ok(!!p && p.tappe.map((t) => t.kind).join() === "aperitivo,cena,dopocena" && p.zona === "Trastevere" && p.tappe[0].query === "aperitivo a Trastevere" && p.tappe[2].queryGoogle === "cocktail bar Trastevere", `serata: frase capita senza AI (${JSON.stringify(p?.tappe.map((t) => t.query))}, zona ${p?.zona})`);
      ok(["Aperitivo con vista a Milano", "Trattoria non turistica a Testaccio", "Prenotami domani alle 21 per 2 con terrazza a Roma", "cocktail bar dopo cena a Monti", "ristorante per una serata romantica a Trastevere", "organizzami una cena a Monti"].every((q) => se.serataOf(q) === null), "serata: le richieste di un posto solo restano ricerche normali");
      const d = se.serataOf("organizzami la serata a Monti");
      ok(d?.tappe.map((t) => t.kind).join() === "aperitivo,cena,dopocena" && d.zona === "Monti", "serata: 'organizzami la serata' senza tappe = aperitivo, cena, dopocena");
      const m = se.serataOf("colazione, pranzo, aperitivo e cena a Roma");
      ok(m?.tappe.length === 3 && m.tagliate.join() === "Cena", "serata: al massimo 3 tappe (3 ricerche Google), la quarta si dice");
      const pg = se.serataOf("pizza e gelato dalle parti di campo de' fiori");
      ok(pg?.tappe[0].includedType === "pizza_restaurant" && pg.tappe[1].kind === "gelato" && pg.zona === "Campo de' Fiori", `serata: 'pizza e gelato' (${pg?.zona})`);
      const w = se.walkOf({ lat: 41.889, lng: 12.469 }, { lat: 41.892, lng: 12.471 });
      ok(w.meters > 380 && w.meters < 520 && w.minutes === Math.round(w.meters / 80) && se.walkLabel(w).includes("min a piedi"), `serata: distanza a piedi stimata (linea d'aria × 1,3): ${se.walkLabel(w)}`);
      ok(se.walkLabel({ meters: 4200, minutes: 53 }).includes("taxi"), "serata: tappe lontane → 'meglio un taxi o i mezzi'");
      const prev = { lat: 41.889, lng: 12.469 };
      const cand = [{ id: "far", lat: 41.91, lng: 12.5 }, { id: "used", lat: 41.889, lng: 12.469 }, { id: "near2", lat: 41.8895, lng: 12.4695 }, { id: "near1", lat: 41.893, lng: 12.47 }];
      ok(se.orderCandidates(cand, prev, new Set(["used"])).map((x) => x.id).join() === "near2,near1,far", "serata: prima i posti comodi a piedi nell'ordine di Google, poi i lontani; nessun posto ripetuto");
      const url = se.googleMapsRoute([{ id: "A", name: "a", lat: 1, lng: 2 }, { id: "B", name: "b", lat: 3, lng: 4 }, { id: "C", name: "c", lat: 5, lng: 6 }]);
      ok(url.startsWith("https://www.google.com/maps/dir/?api=1") && url.includes("waypoint_place_ids=B") && url.includes("travelmode=walking") && url.includes("destination_place_id=C"), "serata: link Google Maps con le tappe come waypoint (gratuito)");
    }

    const sctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    await sctx.addInitScript(() => { try { localStorage.setItem("mapetite.intro", "visto"); } catch { /* ignorato */ } });
    const sEvents = [], sSearches = [], sIntents = [], sAdds = [];
    await sctx.route("**/api/events", (route) => { sEvents.push(route.request().postDataJSON()); return route.fulfill({ status: 204, body: "" }); });
    await sctx.route("**/api/places/photo**", (route) => route.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="#c96"/></svg>' }));
    await sctx.route("**/rest/v1/**", (route) => route.fulfill(route.request().method() === "POST" ? { status: 201, body: "" } : { json: [] }));
    await sctx.route("**/api/places/add", (route) => { sAdds.push(route.request().postDataJSON()); return route.fulfill({ json: { place: { id: "33333333-0000-4000-8000-0000000000b1" } } }); });
    await sctx.route("**/events.mapbox.com/**", (r) => r.fulfill({ status: 204, body: "" }));
    await sctx.route("**/api/search/intent", (route) => { sIntents.push(route.request().postDataJSON()); return route.fulfill({ json: { intent: null } }); });
    // Trastevere: l'aperitivo in piazza; per la cena Google mette prima un posto famoso lontano
    // (5.000 recensioni, a 2 km) e poi una trattoria a due passi: si sceglie la trattoria.
    const T = (id, name, lat, lng, extra = {}) => mk(id, name, lat, lng, { address: "Trastevere, Roma", ...extra });
    const STAGES = {
      aperitivo: [T("SA1", "Bar della Piazza", 41.8894, 12.4699, { category: "wine_bar" }), T("SA2", "Enoteca Vicolo", 41.8899, 12.4703), T("SA3", "Spritz Corner", 41.8885, 12.4712)],
      cena: [T("SC1", "Ristorante Famoso Lontano", 41.9045, 12.4825, { userRatingCount: 5000, category: "restaurant" }), T("SC2", "Trattoria Vicina", 41.8903, 12.4712, { userRatingCount: 140, category: "restaurant", phone: "347 765 4321" }), T("SC3", "Osteria del Cortile", 41.8889, 12.4721, { category: "restaurant" })],
      dopocena: [T("SA1", "Bar della Piazza", 41.8894, 12.4699), T("SD2", "Cocktail Segreto", 41.8909, 12.4718, { category: "cocktail_bar" }), T("SD3", "Bar Lontano", 41.8954, 12.4801, { category: "cocktail_bar" })],
    };
    await sctx.route("**/api/search", async (route) => {
      const b = route.request().postDataJSON();
      sSearches.push(b);
      await new Promise((r) => setTimeout(r, 250));
      const kind = Object.keys(STAGES).find((k) => b.query.startsWith(k));
      return route.fulfill({ json: { risultati: STAGES[kind] ?? [], filtri_usati: { categoria: "bar", parole_chiave: [], vicino_a_me: false, zona: "Trastevere" }, sintesi_pendente: { places: [], token: kind ?? "x" } } });
    });
    await sctx.route("**/api/search/synthesis", async (route) => {
      await new Promise((r) => setTimeout(r, 400));
      const v = (t) => ({ synthesis: t, tags: [], verdict: t, goFor: [], dontExpect: [], matchReason: t });
      return route.fulfill({ json: { dettagli: { SA1: v("Calici al tramonto in piazza."), SC2: v("Cucina romana di quartiere, senza fronzoli."), SC3: v("Cortile tranquillo."), SD2: v("Cocktail d'autore, porta senza insegna.") }, esclusi: ["SA3"] } });
    });
    const sp = await sctx.newPage();
    sp.on("pageerror", (e) => errors.push(e.message));
    sp.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|mapbox|WebGL/i.test(m.text())) errors.push(m.text().slice(0, process.env.E2E_DEBUG ? 3000 : 150) + (process.env.E2E_DEBUG ? " @ " + m.location().url : "")); });
    await sp.goto(`${BASE}/assistente`, { waitUntil: "networkidle" });
    await sp.getByTestId("assistente-campo").fill("organizzami sabato sera: aperitivo, cena, dopocena a Trastevere");
    await sp.waitForTimeout(900); // pausa nello scrivere: per una serata nessuna richiesta all'AI in anticipo
    await sp.getByTestId("assistente-campo").press("Enter");
    await sp.getByTestId("serata").waitFor({ timeout: 5000 });
    ok((await sp.getByTestId("serata-tappa").count()) === 3, "serata: tre tappe in ordine");
    await sp.waitForFunction(() => document.querySelectorAll("[data-testid=serata-scelto]").length === 3, null, { timeout: 8000 });
    ok(sSearches.length === 3 && sSearches.map((s) => s.query).join("|") === "aperitivo a Trastevere|cena a Trastevere|dopocena a Trastevere", `serata: una ricerca Google per tappa, 3 in tutto (${sSearches.map((s) => s.query).join(" | ")})`);
    ok(sSearches.every((s) => s.intent && s.intentQuery === s.query && s.phase === "fast" && s.intent.zona === "Trastevere" && s.intent.queryGoogle.includes("Trastevere")), "serata: ogni tappa arriva con l'intento già costruito (il server non chiede all'AI di capire la frase)");
    ok(sIntents.length === 0, `serata: nessuna richiesta all'AI per capire la frase (${sIntents.length})`);
    const tappe = sp.getByTestId("serata-tappa");
    const nomi = await Promise.all([0, 1, 2].map((i) => tappe.nth(i).getByTestId("serata-scelto").getByRole("button", { name: /^Apri / }).getAttribute("aria-label")));
    ok(nomi.join() === "Apri Bar della Piazza,Apri Trattoria Vicina,Apri Cocktail Segreto", `serata: scelta vicina alla tappa prima, non la più famosa, nessun posto ripetuto (${nomi.join(", ")})`);
    const dist = await sp.getByTestId("serata-distanza").allTextContents();
    ok(dist.length === 2 && dist.every((d) => /circa \d+ m · \d+ min a piedi/.test(d)), `serata: distanza e minuti a piedi tra le tappe (${dist.join(" / ")})`);
    ok((await sp.getByTestId("serata-stima").textContent()).includes("stime in linea d'aria"), "serata: le distanze sono dichiarate come stima");
    await tappe.nth(1).getByText("Cucina romana di quartiere, senza fronzoli.").waitFor({ timeout: 6000 });
    ok(true, "serata: il verdetto Mapetite compare sulla tappa scelta");
    ok((await tappe.nth(0).getByTestId("serata-alternativa").filter({ hasText: "Spritz Corner" }).count()) === 0, "serata: l'alternativa esclusa dai verdetti sparisce");
    ok((await tappe.nth(1).getByTestId("serata-alternativa").count()) === 2, "serata: due alternative per tappa");
    const gm = await sp.getByTestId("serata-google-maps").getAttribute("href");
    ok(gm.includes("origin_place_id=SA1") && gm.includes("waypoint_place_ids=SC2") && gm.includes("destination_place_id=SD2") && gm.includes("travelmode=walking"), "serata: 'Apri il percorso in Google Maps' con le tappe come waypoint");
    await sp.getByTestId("serata-pin").first().waitFor({ timeout: 8000 }).catch(() => {});
    ok((await sp.getByTestId("serata-pin").allTextContents()).join() === "1,2,3", "serata: mini mappa con i pin numerati 1, 2, 3");
    await sp.getByTestId("serata").scrollIntoViewIfNeeded();
    await sp.screenshot({ path: `${OUT}/59-serata.png`, caret: "initial" });
    await sp.getByTestId("serata-mappa").scrollIntoViewIfNeeded();
    await sp.screenshot({ path: `${OUT}/59b-serata-mappa.png`, caret: "initial" });
    // Alternativa scelta: cambia la tappa, il percorso e le distanze.
    const distPrima = dist[0];
    await tappe.nth(1).getByRole("button", { name: "Scegli Osteria del Cortile per cena" }).click();
    ok((await tappe.nth(1).getByTestId("serata-scelto").getByRole("button", { name: "Apri Osteria del Cortile" }).count()) === 1, "serata: 'Scegli' su un'alternativa la mette come tappa");
    ok((await sp.getByTestId("serata-google-maps").getAttribute("href")).includes("waypoint_place_ids=SC3") && (await sp.getByTestId("serata-distanza").first().textContent()) !== distPrima, "serata: percorso e distanze seguono la scelta");
    // Salva e Prenota sulla tappa (stessi pulsanti delle card dell'assistente).
    await tappe.nth(0).getByTestId("assistente-salva").click();
    await tappe.nth(0).getByTestId("assistente-salvato").waitFor({ timeout: 5000 });
    ok(sAdds.length === 1 && sAdds[0].googlePlaceId === "SA1" && sAdds[0].firma === "firma-SA1", "serata (con la firma del server): 'Salva' sulla tappa salva il locale (Place ID Google)");
    await sp.getByTestId("assistente-salvato-avviso").waitFor({ state: "hidden", timeout: 8000 }).catch(() => {});
    await tappe.nth(2).getByTestId("assistente-prenota").click();
    await sp.getByTestId("foglio-prenota").waitFor({ timeout: 3000 });
    ok(await sp.getByTestId("foglio-prenota").isVisible(), "serata: 'Prenota' sulla tappa apre il foglio della prenotazione");
    await sp.getByRole("dialog", { name: /Prenota da/ }).getByRole("button", { name: "Chiudi" }).click();
    await tappe.nth(1).getByTestId("serata-scelto").getByRole("button", { name: /^Apri / }).click();
    await sp.getByTestId("assistente-scheda").waitFor({ timeout: 3000 });
    ok(await sp.getByTestId("assistente-scheda").getByText("Osteria del Cortile").first().isVisible(), "serata: tocco sulla tappa = scheda del locale");
    await sp.getByTestId("assistente-scheda").click({ position: { x: 20, y: 20 } });
    { const ser = sEvents.filter((e) => e.type === "funzione" && e.props?.nome === "assistente_serata").map((e) => e.props?.contesto);
      ok(ser.includes("percorso") && ser.includes("alternativa") && sEvents.some((e) => e.props?.nome === "assistente_serata" && e.props?.risultati === 3), `serata: segnali registrati (${ser.join(", ")})`);
      ok(sEvents.some((e) => e.type === "funzione" && e.props?.nome === "assistente_messaggio" && e.props?.contesto === "serata") && !JSON.stringify(sEvents).includes("Trastevere"), "serata: messaggio registrato come 'serata', senza il testo scritto");
      const lost = droppedKeys(sEvents.filter((e) => e.type === "funzione"));
      ok(lost.length === 0, `serata: tutte le chiavi dei segnali sono tra quelle che il server conserva (${lost.join(", ") || "nessuna scartata"})`); }
    // Ricaricata la pagina la serata resta, senza ricerche nuove.
    await sp.reload({ waitUntil: "networkidle" });
    await sp.getByTestId("serata").waitFor({ timeout: 5000 });
    ok(sSearches.length === 3 && (await sp.getByTestId("serata-scelto").count()) === 3, "serata: dopo aver ricaricato c'è ancora, senza ricerche nuove");
    await sctx.close();

    // 360 px: si legge, niente scorrimento orizzontale.
    const s3 = await browser.newContext({ viewport: { width: 360, height: 780 }, deviceScaleFactor: 2 });
    await s3.addInitScript(() => { try { localStorage.setItem("mapetite.intro", "visto"); } catch { /* ignorato */ } });
    await s3.route("**/api/events", (route) => route.fulfill({ status: 204, body: "" }));
    await s3.route("**/api/places/photo**", (route) => route.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="#c96"/></svg>' }));
    await s3.route("**/rest/v1/**", (route) => route.fulfill({ json: [] }));
    await s3.route("**/events.mapbox.com/**", (r) => r.fulfill({ status: 204, body: "" }));
    await s3.route("**/api/search", (route) => { const b = route.request().postDataJSON(); const kind = Object.keys(STAGES).find((k) => b.query.startsWith(k)); return route.fulfill({ json: { risultati: STAGES[kind] ?? [], sintesi_pendente: null } }); });
    const s3p = await s3.newPage();
    s3p.on("pageerror", (e) => errors.push(e.message));
    await s3p.goto(`${BASE}/assistente?q=${encodeURIComponent("aperitivo e cena a Trastevere")}`, { waitUntil: "networkidle" });
    await s3p.waitForFunction(() => document.querySelectorAll("[data-testid=serata-scelto]").length === 2, null, { timeout: 8000 });
    { const w = await s3p.evaluate(() => document.scrollingElement.scrollWidth); ok(w <= 360, `serata a 360 px: niente scorrimento orizzontale (${w}px)`); }
    { const li = s3p.getByTestId("serata-alternativa").first(); const [b, s] = [await li.boundingBox(), await li.getByTestId("serata-scegli").boundingBox()];
      ok(!!b && !!s && s.x + s.width <= b.x + b.width + 1 && s.height >= 40, "serata a 360 px: 'Scegli' dentro la riga, grande abbastanza per il dito"); }
    await s3p.getByTestId("serata-tappa").first().scrollIntoViewIfNeeded();
    await s3p.screenshot({ path: `${OUT}/59c-serata-360.png`, caret: "initial" });
    await s3.close();
  }

  // Frase capita in anticipo (come la mappa, piano 2.4): tempo alla prima card prima/dopo.
  // Server simulato: Google 300 ms; l'AI che capisce la frase 1200 ms, sul server se la ricerca
  // arriva senza intento, oppure in anticipo mentre si scrive (/api/search/intent).
  const pctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await pctx.addInitScript(() => { try { localStorage.setItem("mapetite.intro", "visto"); } catch { /* ignorato */ } });
  await pctx.route("**/api/events", (route) => route.fulfill({ status: 204, body: "" }));
  await pctx.route("**/api/places/photo**", (route) => route.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"/>' }));
  await pctx.route("**/rest/v1/**", (route) => route.fulfill({ json: [] }));
  const pIntents = [], pSearches = [];
  await pctx.route("**/api/search/intent", async (route) => {
    pIntents.push(route.request().postDataJSON());
    await new Promise((r) => setTimeout(r, 1200));
    return route.fulfill({ json: { intent: { tipo: "trattoria", requisiti: ["non turistica"], zona: "Testaccio", vicino_a_me: false } } });
  });
  await pctx.route("**/api/search", async (route) => {
    const b = route.request().postDataJSON();
    pSearches.push(b);
    await new Promise((r) => setTimeout(r, 300 + (b.intent ? 0 : 1200)));
    return route.fulfill({ json: { ...SEARCH_FAST, risultati: A_PLACES } });
  });
  await pctx.route("**/api/search/synthesis", (route) => route.fulfill({ json: SYNTH }));
  const pp = await pctx.newPage();
  pp.on("pageerror", (e) => errors.push(e.message));
  const FRASE = "Trattoria non turistica a Testaccio";
  const firstCard = async () => {
    const t0 = Date.now();
    await pp.keyboard.press("Enter");
    await pp.getByTestId("assistente-card").getByText("Terrazza Uno").first().waitFor({ timeout: 8000 });
    return Date.now() - t0;
  };
  await pp.goto(`${BASE}/assistente`, { waitUntil: "networkidle" });
  // Prima: invio subito, la frase la capisce il server durante la ricerca.
  await pp.getByTestId("assistente-campo").fill(FRASE);
  const prima = await firstCard();
  ok(pSearches.length === 1 && !pSearches[0].intent && pIntents.length === 0, "anticipo: inviando subito la ricerca parte senza intento (come prima)");
  // Seguito sui posti di prima ("più economici"): nessuna richiesta all'AI mentre si scrive.
  await pp.getByTestId("assistente-campo").pressSequentially("più economici", { delay: 30 });
  await pp.waitForTimeout(1100);
  ok(pIntents.length === 0, `anticipo: un seguito sui posti di prima non chiede niente all'AI (${pIntents.length})`);
  await pp.getByTestId("assistente-campo").fill("");
  await pp.getByTestId("assistente-nuova").click();
  // Dopo: si scrive come una persona, una pausa, poi Invio.
  await pp.getByTestId("assistente-campo").pressSequentially(FRASE, { delay: 40 });
  await pp.waitForTimeout(2000);
  ok(pIntents.length === 1 && pIntents[0].query === FRASE, `anticipo: una sola richiesta all'AI per tutta la frase scritta (${pIntents.length})`);
  const dopo = await firstCard();
  const last = pSearches[pSearches.length - 1];
  ok(pSearches.length === 2 && !!last.intent && last.intentQuery === FRASE && last.query === FRASE, "anticipo: la ricerca manda l'intento già pronto");
  console.log(`      tempo alla prima card (server simulato): prima ${prima} ms, dopo ${dopo} ms`);
  ok(dopo < prima - 700, `anticipo: prima card più veloce (prima ${prima} ms → dopo ${dopo} ms)`);
  // Stessa frase di nuovo: memoria, nessuna nuova richiesta all'AI.
  await pp.getByTestId("assistente-nuova").click();
  await pp.getByTestId("assistente-campo").pressSequentially(FRASE, { delay: 10 });
  await pp.waitForTimeout(1000);
  ok(pIntents.length === 1, `anticipo: la stessa frase non si richiede due volte (${pIntents.length})`);
  await pctx.close();
}
// 15. Organizzare e ritrovare (piano 4.1–4.3): raccolte come cartelle, proposte dell'AI, classifica.
//     Funzioni pure importate direttamente; il resto con Supabase e /api/raccolte/proposte simulati.
{
  let cl = null, rai = null;
  try { cl = await import(new URL("../../src/lib/classifica.ts", import.meta.url).href); } catch (e) { ok(false, `classifica: modulo importabile (${e.message})`); }
  try { rai = await import(new URL("../../src/lib/raccolte-ai.ts", import.meta.url).href); } catch (e) { ok(false, `raccolte-ai: modulo importabile (${e.message})`); }
  if (cl) {
    // Ricerca binaria: per ogni posizione vera (0..n) bastano al massimo 3 domande con 7 locali e la posizione è esatta.
    let exact = true, maxAsked = 0;
    for (let truth = 0; truth <= 7; truth++) {
      let s = cl.startSearch(7), mid;
      while ((mid = cl.nextCompare(s)) != null) s = cl.answer(s, mid, truth <= mid);
      maxAsked = Math.max(maxAsked, s.asked);
      if (cl.finalPosition(s) !== truth) exact = false;
    }
    ok(exact && maxAsked <= 3, `classifica: con 7 posti in città bastano ${maxAsked} domande e la posizione è esatta`);
    { let s = cl.startSearch(1); const m = cl.nextCompare(s); s = cl.answer(s, m, true); ok(m === 0 && cl.nextCompare(s) == null && cl.finalPosition(s) === 0, "classifica: con 1 solo posto in città, 1 domanda"); }
    { let s = cl.startSearch(30), n = 0, m; while ((m = cl.nextCompare(s)) != null) { s = cl.answer(s, m, false); n++; } ok(n === 3, "classifica: mai più di 3 domande anche con 30 posti"); }
    const list = [{ score: 10 }, { score: 4 }];
    ok(cl.scoreAt(list, 0) === 11 && cl.scoreAt(list, 1) === 7 && cl.scoreAt(list, 2) === 3 && cl.scoreAt([], 0) === 0, "classifica: punteggio a metà tra i vicini (o ±1 agli estremi)");
    const tops = cl.topByCity([{ city: "Roma", score: 1 }, { city: "Roma", score: 5 }, { city: "Milano", score: 2 }, { city: null, score: 9 }]);
    ok(tops[0][0] === "Roma" && tops[0][1][0].score === 5 && tops.length === 2, "classifica: top per città, la città con più posti prima, i senza città esclusi");
    ok(cl.isMissingColumn({ code: "42703", message: 'column saved_places.rank_score does not exist' }) && !cl.isMissingColumn({ code: "500", message: "altro" }), "classifica: riconosce la colonna mancante (migrazione non applicata)");
  }
  if (rai) {
    const input = [
      { id: "aaaaaaaa-0000-4000-8000-000000000001", name: "Bar Tramonto", category: "Cocktail bar", city: "Roma", verdict: "Aperitivo lento sui tetti." },
      { id: "aaaaaaaa-0000-4000-8000-000000000002", name: "Forno Rosso", category: "Panetteria", city: "Roma", verdict: null },
      { id: "aaaaaaaa-0000-4000-8000-000000000003", name: "Bistrot Lione", category: "Ristorante", city: "Lione", verdict: null },
    ];
    const prompt = rai.buildPrompt(input, ["Weekend a Napoli"]);
    ok(!prompt.includes("aaaaaaaa-") && prompt.includes("- Weekend a Napoli") && prompt.includes("- Romantici") && prompt.includes("diversa da Roma"), "proposte AI: al modello niente UUID, solo raccolte ammesse (tue + standard), città di casa per 'in viaggio'");
    const parsed = rai.parseProposals('Ecco: {"proposte":[{"n":1,"raccolte":["aperitivo","Inventata"]},{"n":2,"raccolte":["Pranzo veloce","Con amici","Brunch"]},{"n":9,"raccolte":["Speciali"]},{"n":3,"raccolte":[]},{"n":1,"raccolte":["Romantici"]}]}', input, []);
    ok(parsed.length === 2 && parsed[0].collections.join() === "Aperitivo" && parsed[1].collections.length === 2 && parsed.every((p) => input.some((i) => i.id === p.id)), `proposte AI: scartati nomi inventati, locali inesistenti, doppioni; max 2 raccolte (${JSON.stringify(parsed)})`);
    ok(rai.parseProposals("non è JSON", input, []).length === 0 && rai.parseProposals('{"proposte":"x"}', input, []).length === 0, "proposte AI: risposta rotta = nessuna proposta, nessun errore");
    const costo = rai.estimateCostUsd(1800, 600);
    ok(costo < 0.006, `proposte AI: costo stimato per un gruppo da 30 sotto 0,6 cent ($${costo.toFixed(4)})`);
  }

  if (!fakeUser) console.log("SKIP  raccolte/classifica: dev server senza E2E_FAKE_USER");
  else {
    const ME = "00000000-0000-0000-0000-000000000001";
    const pid = (n) => `00000000-0000-4000-8000-0000000007${n}`;
    const pl = (n, name, category, address, lat, lng, extra = {}) => ({ id: pid(n), name, category, address, lat, lng, ...extra });
    const ROMA = "Via Po, 2/a, 00198 Roma RM, Italy";
    const MILANO = "Corso Monforte, 26, 20122 Milano MI, Italy";
    const profilo = {
      email: "giulia@example.com",
      saved: [
        { created_at: "2026-10-12", tags: ["Con amici", "Già visitato"], note: "Il tavolo in fondo", rank_score: 2, places: pl("01", "Osteria Due", "restaurant", ROMA, 41.9, 12.49, { verdict: "Cucina romana di quartiere, senza turisti." }) },
        { created_at: "2026-10-11", tags: ["Con amici", "Da provare"], note: null, places: pl("02", "Birreria Sei", "bar", ROMA, 41.902, 12.494) },
        { created_at: "2026-10-10", tags: ["Già visitato"], note: null, rank_score: 1, places: pl("03", "Trattoria Tre", "restaurant", ROMA, 41.895, 12.48) },
        { created_at: "2026-10-09", tags: ["Già visitato"], note: null, places: pl("04", "Enoteca Quattro", "wine_bar", ROMA, 41.893, 12.47) },
        { created_at: "2026-10-08", tags: ["Da provare"], note: null, places: pl("05", "Forno Cinque", "bakery", ROMA, 41.88, 12.48) },
        { created_at: "2026-10-07", tags: [], note: null, places: pl("06", "Caffè Sei", "cafe", MILANO, 45.46, 9.2) },
        { created_at: "2026-10-06", tags: null, note: null, places: pl("07", "Bar Sette", "cocktail_bar", MILANO, 45.47, 9.19) },
      ],
      reviews: [],
    };
    // Ordine dei nomi in un elenco (le righe iniziano con numero ed emoji): "OTE" = Osteria, Trattoria, Enoteca…
    const order = (texts) => texts.map((t) => ["Osteria", "Trattoria", "Enoteca", "Vineria", "Bar Tre"].find((n) => t.includes(n))?.charAt(0) ?? "?").join("");
    const setProfilo = (c, v) => c.addCookies([{ name: "e2e_profilo", value: encodeURIComponent(JSON.stringify(v)), url: BASE }]);
    const rc = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    await rc.route("**/api/events", (r) => r.fulfill({ status: 204, body: "" }));
    await rc.route("**/api/places/photo**", (r) => r.fulfill({ status: 429, json: {} }));
    await rc.route("**/rest/v1/place_synthesis**", (r) => r.fulfill({ json: [] }));
    await rc.route("**/rest/v1/profiles**", (r) => r.fulfill({ json: [] }));
    let patches = [];
    let patchFail = false;
    await rc.route("**/rest/v1/saved_places**", (r) => {
      const req = r.request();
      const u = new URL(req.url());
      if (req.method() === "PATCH") {
        patches.push({ id: u.searchParams.get("place_id")?.replace(/^eq\./, ""), user: u.searchParams.get("user_id"), body: req.postDataJSON() });
        return patchFail ? r.fulfill({ status: 500, json: { message: "errore" } }) : r.fulfill({ status: 204, body: "" });
      }
      const pidQ = u.searchParams.get("place_id")?.replace(/^eq\./, "");
      if (pidQ) { const row = profilo.saved.find((x) => x.places.id === pidQ); return r.fulfill({ json: { tags: row?.tags ?? [] } }); }
      return r.fulfill({ json: [] });
    });
    await setProfilo(rc, profilo);
    const p = await rc.newPage();
    p.on("pageerror", (e) => errors.push(e.message));

    // 4.1 Cartelle nel profilo
    await p.goto(`${BASE}/profilo`, { waitUntil: "networkidle" });
    const folders = p.getByTestId("raccolta");
    ok((await folders.count()) === 1 && (await folders.first().getAttribute("href")) === "/raccolte/Con%20amici", "cartelle: una per raccolta, apre /raccolte/<nome>");
    ok((await folders.first().getByTestId("raccolta-copertina").locator("span").count()) === 2 && (await folders.first().textContent()).includes("2 locali"), "cartelle: copertina con le emoji dei locali e il numero");
    { const bg = await folders.first().locator("[aria-hidden]").first().evaluate((el) => getComputedStyle(el).backgroundColor); ok(bg !== "rgba(0, 0, 0, 0)" && bg !== "rgb(255, 255, 255)", `cartelle: copertina colorata (${bg})`); }
    await p.locator("[data-testid=raccolte]").evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 16));
    await p.screenshot({ path: `${OUT}/40-raccolte-cartelle.png`, caret: "initial" });

    // 4.2 Proposte dell'AI per i salvati senza raccolta (route simulata: nessuna chiamata Haiku)
    const box = p.getByTestId("proposte-raccolte");
    ok(await box.isVisible() && (await box.textContent()).includes("5 salvati senza raccolta"), "proposte AI: '5 salvati senza raccolta' nel profilo");
    let proposteReq = null;
    let proposteMode = "ok";
    await p.route("**/api/raccolte/proposte", async (r) => {
      proposteReq = r.request().postDataJSON();
      if (proposteMode === "limite") return r.fulfill({ status: 429, json: { error: "Hai chiesto tante proposte in poco tempo: riprova tra qualche minuto." } });
      return r.fulfill({ json: {
        proposte: [
          { id: pid("05"), name: "Forno Cinque", raccolte: ["Pranzo veloce"] },
          { id: pid("06"), name: "Caffè Sei", raccolte: ["Brunch", "Da provare in viaggio"] },
          { id: pid("07"), name: "Bar Sette", raccolte: ["Aperitivo"] },
        ],
        esaminati: [pid("03"), pid("04"), pid("05"), pid("06"), pid("07")],
        restanti: 0,
      } });
    });
    proposteMode = "limite";
    await box.getByTestId("proponi-raccolte").click();
    await box.getByRole("alert").waitFor({ timeout: 4000 }).catch(() => {});
    ok(/tante proposte/.test((await box.getByRole("alert").textContent().catch(() => "")) ?? ""), "proposte AI: oltre il tetto, messaggio in italiano e nessuna scrittura");
    proposteMode = "ok";
    await box.getByTestId("proponi-raccolte").click();
    await box.getByTestId("proposta").first().waitFor({ timeout: 4000 }).catch(() => {});
    ok((await box.getByTestId("proposta").count()) === 3 && patches.length === 0 && Array.isArray(proposteReq?.escludi), "proposte AI: 3 proposte, niente scritto prima del tocco");
    await p.screenshot({ path: `${OUT}/41-proposte-raccolte.png`, caret: "initial" });
    await box.getByTestId("proposta").filter({ hasText: "Forno Cinque" }).getByTestId("accetta-proposta").click();
    await box.getByText("✓ Fatto").first().waitFor({ timeout: 4000 }).catch(() => {});
    ok(patches.length === 1 && patches[0].id === pid("05") && JSON.stringify(patches[0].body?.tags) === '["Da provare","Pranzo veloce"]' && patches[0].user === `eq.${ME}`, `proposte AI: 'Accetta' aggiunge la raccolta e tiene lo stato (${JSON.stringify(patches)})`);
    patches = [];
    await box.getByTestId("accetta-tutte").click();
    await p.waitForFunction(() => document.querySelectorAll("[data-testid=proposta]").length > 0 && [...document.querySelectorAll("[data-testid=proposta]")].every((li) => li.textContent.includes("✓ Fatto")), null, { timeout: 5000 }).catch(() => {});
    ok(patches.length === 2 && patches.some((x) => x.id === pid("06") && JSON.stringify(x.body?.tags) === '["Brunch","Da provare in viaggio"]') && patches.some((x) => x.id === pid("07") && JSON.stringify(x.body?.tags) === '["Aperitivo"]'), `proposte AI: 'Accetta tutte' scrive le altre due (${JSON.stringify(patches)})`);
    ok((await p.getByTestId("raccolta").count()) === 5, "proposte AI: le nuove raccolte compaiono subito tra le cartelle");
    patches = [];

    // 4.3 Classifica nel profilo: Roma con 2 in classifica (Osteria Due > Trattoria Tre), Enoteca da mettere
    const cls = p.getByTestId("profilo-classifica");
    ok(await cls.isVisible() && order(await cls.getByTestId("classifica-voce").allTextContents()) === "OT", "classifica: nel profilo la top di Roma in ordine");
    await cls.getByTestId("classifica-ordina").click();
    await cls.getByTestId("classifica-confronto").waitFor({ timeout: 4000 }).catch(() => {});
    const rivale1 = await cls.getByTestId("classifica-rivale").textContent().catch(() => "");
    ok(rivale1 === "Trattoria Tre", `classifica: 'Ti è piaciuto più o meno di…' parte dal centro della classifica (${rivale1})`);
    await p.screenshot({ path: `${OUT}/42-classifica-confronto.png`, caret: "initial" });
    await cls.getByTestId("classifica-di-piu").click();
    const rivale2 = await cls.getByTestId("classifica-rivale").textContent().catch(() => "");
    ok(rivale2 === "Osteria Due", `classifica: seconda domanda con il primo in classifica (${rivale2})`);
    await cls.getByTestId("classifica-di-meno").click();
    await cls.getByRole("status").waitFor({ timeout: 4000 }).catch(() => {});
    ok(patches.length === 1 && patches[0].id === pid("04") && patches[0].body?.rank_score === 1.5, `classifica: tra Osteria Due (2) e Trattoria Tre (1) → 1.5 (${JSON.stringify(patches)})`);
    ok(order(await cls.getByTestId("classifica-voce").allTextContents()) === "OET", "classifica: la top si aggiorna subito");
    await cls.evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 16));
    await p.screenshot({ path: `${OUT}/43-classifica-profilo.png`, caret: "initial" });
    patches = [];
    // Senza la colonna rank_score (migrazione non applicata) la classifica non compare
    await setProfilo(rc, { ...profilo, classifica: false });
    await p.goto(`${BASE}/profilo`, { waitUntil: "networkidle" });
    ok((await p.getByTestId("profilo-classifica").count()) === 0 && await p.getByTestId("raccolte").isVisible(), "classifica: senza migrazione il profilo resta com'era (sezione nascosta)");
    await setProfilo(rc, profilo);

    // 4.1 Pagina della raccolta
    await p.goto(`${BASE}/raccolte/Con%20amici`, { waitUntil: "networkidle" });
    ok((await p.getByTestId("raccolta-titolo").textContent()) === "Con amici" && (await p.getByTestId("raccolta-locale").count()) === 2, "pagina raccolta: titolo e i 2 locali");
    ok(await p.getByTestId("raccolta-verdetto").getByText("Cucina romana di quartiere, senza turisti.").isVisible() && await p.getByText("“Il tavolo in fondo”").isVisible(), "pagina raccolta: verdetto in cache e la tua nota");
    ok((await p.getByTestId("raccolta-locale").first().getAttribute("href")) === `/mappa?salvato=${pid("01")}` && (await p.getByTestId("raccolta-sulla-mappa").getAttribute("href")) === "/mappa?vista=salvati&tag=Con+amici", "pagina raccolta: un locale apre la sua scheda; la mini-mappa apre la mappa filtrata");
    ok((await p.getByTestId("raccolta-sulla-mappa").count()) === 1, "pagina raccolta: un solo ingresso alla mappa (la mini-mappa, niente pulsante doppio)");
    ok(await p.getByTestId("raccolta-privata").isVisible() && (await p.getByTestId("condividi-raccolta").count()) === 0, "pagina raccolta: profilo non pubblico → spiega come condividerla");
    await p.getByTestId("mappa-persona").waitFor({ timeout: 8000 }).catch(() => {});
    ok(await p.getByTestId("mappa-persona").isVisible(), "pagina raccolta: mini mappa");
    { const w = await p.evaluate(() => document.documentElement.scrollWidth); ok(w <= 390, `pagina raccolta: niente scorrimento orizzontale a 390px (${w})`); }
    await p.screenshot({ path: `${OUT}/44-pagina-raccolta.png`, caret: "initial" });
    // Rinomina dalla pagina: un PATCH per locale, poi l'indirizzo segue il nuovo nome
    await p.getByTestId("raccolta-pagina-menu").click();
    const rs = p.getByTestId("raccolta-pagina-sheet");
    await rs.getByRole("button", { name: /Rinomina/ }).click();
    await rs.getByLabel("Nuovo nome").fill("amici del giovedì");
    await rs.getByRole("button", { name: "Salva" }).click();
    await p.waitForURL(/\/raccolte\/Amici/, { timeout: 6000 }).catch(() => {});
    ok(patches.length === 2 && patches.every((x) => x.body?.tags?.includes("Amici del giovedì") && !x.body.tags.includes("Con amici")) && decodeURIComponent(p.url()).endsWith("/raccolte/Amici del giovedì"), `pagina raccolta: rinomina scrive su tutti e porta alla nuova pagina (${JSON.stringify(patches)})`);
    patches = [];
    await p.goto(`${BASE}/raccolte/Non%20esiste`, { waitUntil: "networkidle" });
    ok(await p.getByTestId("raccolta-vuota").isVisible(), "pagina raccolta: nome sconosciuto → 'Raccolta vuota' con il ritorno al profilo");
    // 360px: titolo e azioni senza uscire dallo schermo
    await p.setViewportSize({ width: 360, height: 780 });
    await p.goto(`${BASE}/raccolte/Con%20amici`, { waitUntil: "networkidle" });
    { const w = await p.evaluate(() => document.documentElement.scrollWidth); ok(w <= 360, `pagina raccolta: niente scorrimento orizzontale a 360px (${w})`); }
    await p.screenshot({ path: `${OUT}/44b-pagina-raccolta-360.png`, caret: "initial" });
    await p.goto(`${BASE}/profilo`, { waitUntil: "networkidle" });
    { const w = await p.evaluate(() => document.documentElement.scrollWidth); ok(w <= 360, `profilo: niente scorrimento orizzontale a 360px con cartelle e classifica (${w})`); }
    await p.setViewportSize({ width: 390, height: 844 });

    // 4.3 Nella scheda: dopo "Ci sono stato", "più o meno di…"
    const mapRows = profilo.saved.map((x) => ({ tags: x.tags, note: x.note, places: { ...x.places, google_place_id: null } }));
    const ranked = [
      { place_id: pid("01"), rank_score: 2, tags: ["Con amici", "Già visitato"], places: { name: "Osteria Due", category: "restaurant", address: ROMA } },
      { place_id: pid("03"), rank_score: 1, tags: ["Già visitato"], places: { name: "Trattoria Tre", category: "restaurant", address: ROMA } },
    ];
    let rankMode = "ok";
    await p.route("**/rest/v1/saved_places**", (r) => {
      const req = r.request();
      const url = decodeURIComponent(req.url());
      if (req.method() === "PATCH") { patches.push({ id: new URL(req.url()).searchParams.get("place_id")?.replace(/^eq\./, ""), body: req.postDataJSON() }); return r.fulfill({ status: 204, body: "" }); }
      if (url.includes("rank_score")) return rankMode === "manca" ? r.fulfill({ status: 400, json: { code: "42703", message: "column saved_places.rank_score does not exist" } }) : r.fulfill({ json: ranked });
      if (url.includes("select=place_id")) return r.fulfill({ json: mapRows.map((x) => ({ place_id: x.places.id })) });
      return r.fulfill({ json: mapRows });
    });
    await p.goto(`${BASE}/mappa?salvato=${pid("04")}`, { waitUntil: "networkidle" });
    await p.getByTestId("com-era").waitFor({ timeout: 6000 }).catch(() => {});
    const conf = p.getByTestId("classifica-confronto");
    await conf.waitFor({ timeout: 5000 }).catch(() => {});
    ok(await conf.isVisible() && (await conf.textContent()).includes("La tua classifica · Roma"), "scheda: dopo 'Ci sono stato' chiede 'più o meno di…' tra i provati di Roma");
    await conf.evaluate((el) => el.scrollIntoView({ block: "center" })).catch(() => {});
    await p.screenshot({ path: `${OUT}/45-scheda-classifica.png`, caret: "initial" });
    await conf.getByTestId("classifica-di-piu").click();
    await conf.getByTestId("classifica-di-piu").click().catch(() => {});
    await p.getByTestId("classifica-posizione").waitFor({ timeout: 5000 }).catch(() => {});
    ok(patches.some((x) => x.id === pid("04") && x.body?.rank_score === 3) && (await p.getByTestId("classifica-posizione").textContent().catch(() => "")).includes("Il tuo preferito a Roma"), `scheda: 'Di più' due volte = primo a Roma (${JSON.stringify(patches)})`);
    patches = [];
    rankMode = "manca";
    await p.goto(`${BASE}/mappa?salvato=${pid("04")}`, { waitUntil: "networkidle" });
    await p.getByTestId("com-era").waitFor({ timeout: 6000 }).catch(() => {});
    await p.waitForTimeout(800);
    ok(await p.getByTestId("com-era").isVisible() && (await p.getByTestId("classifica-confronto").count()) === 0 && (await p.getByTestId("classifica-posizione").count()) === 0 && patches.length === 0, "scheda: senza la colonna rank_score niente classifica e nessuna scrittura");
    await p.unroute("**/rest/v1/saved_places**");
    await rc.close();

    // Raccolta condivisa e top pubblica (profilo pubblico di Giulia, visitatore senza account)
    const GIU = "00000000-0000-4000-8000-0000000007a1";
    const sv = (place_id, name, category, tags, lat, lng, rank_score) => ({ user_id: GIU, handle: "giulia.rm", display_name: "Giulia", place_id, tags, created_at: "2026-10-10T10:00:00Z", name, category, address: ROMA, lat, lng, rank_score });
    const socialG = {
      profili: [{ id: GIU, handle: "giulia.rm", display_name: "Giulia", bio: null, city: "Roma", visitati: 3, da_provare: 1, seguaci: 0, seguiti: 0 }],
      salvati: [
        sv("44444444-0000-4000-8000-0000000007b1", "Vineria Uno", "wine_bar", ["Già visitato", "Romantico"], 41.89, 12.47, 1),
        sv("44444444-0000-4000-8000-0000000007b2", "Trattoria Due", "restaurant", ["Già visitato", "Romantico"], 41.891, 12.471, 5),
        sv("44444444-0000-4000-8000-0000000007b3", "Bar Tre", "bar", ["Già visitato"], 41.892, 12.472, 3),
        sv("44444444-0000-4000-8000-0000000007b4", "Forno Quattro", "bakery", ["Da provare"], 41.893, 12.473, null),
      ],
      seguo: [],
      mio: { handle: null, display_name: null, bio: null, city: null, is_public: false },
      verdetti: { "44444444-0000-4000-8000-0000000007b2": "Carbonara seria, conto onesto." },
    };
    const gc = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    await gc.route("**/api/events", (r) => r.fulfill({ status: 204, body: "" }));
    await gc.route("**/rest/v1/**", (r) => r.fulfill({ json: [] }));
    await gc.addCookies([
      { name: "e2e_social", value: encodeURIComponent(JSON.stringify(socialG)), url: BASE },
      { name: "e2e_anonimo", value: "1", url: BASE },
    ]);
    const g = await gc.newPage();
    g.on("pageerror", (e) => errors.push(e.message));
    await g.goto(`${BASE}/u/giulia.rm`, { waitUntil: "networkidle" });
    ok((await g.getByTestId("raccolta-pubblica-link").first().getAttribute("href")) === "/u/giulia.rm/raccolte/Romantico", "profilo pubblico: le raccolte si aprono (link in sola lettura)");
    const orderG = (texts) => texts.map((t) => ["Trattoria Due", "Bar Tre", "Vineria Uno"].findIndex((n) => t.includes(n))).join();
    ok(orderG(await g.getByTestId("top-voce").allTextContents()) === "0,1,2" && (await g.getByTestId("profilo-top").textContent()).includes("Top Roma"), "profilo pubblico: 'I preferiti di Giulia' con la top di Roma in ordine");
    await g.getByTestId("profilo-top").evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 16));
    await g.screenshot({ path: `${OUT}/46-top-pubblica.png`, caret: "initial" });
    await g.goto(`${BASE}/u/giulia.rm/raccolte/Romantico`, { waitUntil: "networkidle" });
    ok(await g.getByTestId("raccolta-pubblica").isVisible() && (await g.getByTestId("posto-persona").count()) === 2 && (await g.title()).startsWith("Romantico · Giulia"), "raccolta condivisa: si apre senza account con i suoi 2 posti");
    ok((await g.getByTestId("posto-persona-verdetto").allTextContents()).join("|") === "Carbonara seria, conto onesto.", "raccolta condivisa: il verdetto Mapetite sotto il posto che ce l'ha");
    ok(await g.getByTestId("condividi-raccolta-pubblica").isVisible() && !(await g.content()).includes("Il tavolo"), "raccolta condivisa: pulsante Condividi, nessuna nota privata");
    await g.screenshot({ path: `${OUT}/47-raccolta-condivisa.png`, caret: "initial" });
    await g.goto(`${BASE}/u/giulia.rm/raccolte/Segreta`, { waitUntil: "networkidle" });
    ok(await g.getByTestId("raccolta-pubblica-non-trovata").isVisible(), "raccolta condivisa: nome inesistente → 'non disponibile'");
    await gc.addCookies([{ name: "e2e_social", value: encodeURIComponent(JSON.stringify({ ...socialG, classifica: false })), url: BASE }]);
    await g.goto(`${BASE}/u/giulia.rm`, { waitUntil: "networkidle" });
    ok((await g.getByTestId("profilo-top").count()) === 0, "profilo pubblico: senza la vista classifica_pubblica la top non compare");
    await gc.close();
  }
}

// Lato ristoratori (PIANO-25-OTTOBRE.md 8.1 e 8.2): rivendica dal locale, badge "Verificato",
// pannello del ristoratore (vietato a chi non è admin/titolare) ed esempio dimostrativo.
// Supabase simulato: il browser scrive in claims (intercettato), il server legge dai cookie e2e_*.
if (!fakeUser) console.log("SKIP  ristoratori: dev server senza E2E_FAKE_USER");
else {
  // Calcoli del pannello (funzioni pure, senza server).
  let rs = null;
  try { rs = await import(new URL("../../src/lib/ristoratore.ts", import.meta.url).href); } catch (e) { ok(false, `ristoratore: modulo src/lib/ristoratore.ts importabile (${e.message})`); }
  if (rs) {
    const now = Date.parse("2026-10-15T12:00:00Z");
    const at = (d, h = 10, m = 0) => new Date(Date.UTC(2026, 9, d, h, m)).toISOString();
    const L = { id: "aaaaaaaa-0000-4000-8000-000000000001", name: "Trattoria Uno", address: "Via del Pigneto 10, 00176 Roma RM, Italy", category: "restaurant", lat: 41.888, lng: 12.53, google_place_id: "GUNO" };
    const peer = (i) => ({ ...L, id: `aaaaaaaa-0000-4000-8000-00000000010${i}`, name: `Simile ${i}`, google_place_id: `GS${i}` });
    // Domanda latente (18/10): chi ha salvato il locale e non ci è stato, con le occasioni; voti e stati non sono occasioni.
    { const sv = (u, tags, place = L.id) => ({ place_id: place, user_id: u, created_at: at(10), tags });
      const a = rs.inAttesa([sv("u1", ["Da provare", "Romantico"]), sv("u2", ["Romantico", "👍 Mi è piaciuto"]), sv("u3", ["Già visitato", "Romantico"]), sv("u4", ["Da provare"]), sv("u5", ["Romantico"], "altro")], L.id);
      ok(a.persone === 3 && a.occasioni.length === 1 && a.occasioni[0].chiave === "Romantico" && a.occasioni[0].persone === 2, `ristoratore: 'Ti vogliono provare' conta chi ha salvato e non è andato, con le occasioni (${JSON.stringify(a)})`); }
    // Visite vere (POSIZIONAMENTO proposta 4, 18/10): chi ha segnato "Ci sono stato" nel periodo (data della visita), con il voto.
    { const v = (u, tags, visited, place = L.id) => ({ place_id: place, user_id: u, created_at: at(1), tags, visited_at: visited });
      const today = Math.floor(Date.UTC(2026, 9, 15) / 86_400_000);
      const r = rs.visiteVere([v("u1", ["Già visitato", "Mi è piaciuto"], at(14)), v("u2", ["Già visitato", "Non fa per me"], at(12)), v("u3", ["Già visitato"], at(13)), v("u4", ["Già visitato", "Mi è piaciuto"], at(2)), v("u5", ["Da provare", "Mi è piaciuto"], at(14)), v("u6", ["Già visitato", "Mi è piaciuto"], at(14), "altro")], L.id, today - 6, today);
      ok(r.persone === 3 && r.piaciuto === 1 && r.nonPiaciuto === 1, `ristoratore: visite vere del periodo con il voto, non quelle vecchie o di altri locali (${JSON.stringify(r)})`); }
    // Clienti che tornano (PROPOSTE 8, 20/10): persone con 2+ visite su questo locale, una volta sola.
    { const t = rs.tornati([{ place_id: L.id, user_id: "u1", visite: 3 }, { place_id: L.id, user_id: "u2", visite: 1 }, { place_id: L.id, user_id: "u3", visite: 2 }, { place_id: L.id, user_id: "u4" }, { place_id: "altro", user_id: "u5", visite: 4 }], L.id);
      ok(t === 2, `ristoratore: 'tornati' conta chi ha 2+ visite, non altri locali (${t})`); }
    const e = (type, d, a, extra = {}) => ({ created_at: at(d, extra.h ?? 19, extra.m ?? 0), type, user_id: extra.u ?? null, anon_id: a, session_id: extra.s ?? null, place_id: extra.pid ?? null, google_place_id: extra.gid ?? null, lat: extra.lat ?? null, lng: extra.lng ?? null, props: extra.p ?? {} });
    const eventi = [
      // Ricerca → scheda dai risultati nella stessa visita (solo Place ID Google, come dalla mappa).
      e("ricerca", 14, "a1", { s: "s1", m: 0, p: { modo: "ai", tipo: "trattoria", requisiti: ["non turistico"], caratteristiche: ["Tavoli all'aperto"], zona: "Pigneto" } }),
      e("apri_scheda", 14, "a1", { s: "s1", m: 2, gid: "GUNO", lat: 41.89, lng: 12.53, p: { fonte: "ricerca" } }),
      e("salva", 14, "a1", { s: "s1", m: 3, pid: L.id }),
      e("apri_scheda", 13, "a2", { s: "s2", gid: "GUNO", p: { fonte: "mappa" } }),
      e("apri_scheda", 12, "a3", { s: "s3", gid: "GUNO", p: { fonte: "mappa" } }),
      e("apri_scheda", 12, "a3", { s: "s3", gid: "GUNO", m: 5, p: { fonte: "mappa" } }),
      e("percorso", 12, "a3", { s: "s3", pid: L.id }),
      // Ricerca in zona di un'altra persona (zona = città) e una lontana (Milano): solo la prima conta.
      e("ricerca", 11, "a4", { s: "s4", h: 11, p: { modo: "ai", tipo: "bar", requisiti: ["terrazza"], zona: "Roma" } }),
      e("ricerca", 11, "a5", { s: "s5", p: { modo: "ai", tipo: "bar", requisiti: ["terrazza"], zona: "Milano" } }),
      // Locale simile visto da 2 persone; uno fuori periodo (40 giorni fa) non conta.
      e("apri_scheda", 14, "a6", { gid: "GS1" }), e("apri_scheda", 14, "a7", { gid: "GS2" }),
      // Disdette da Mapetite ("Non vado più"): due del locale (una senza ore), una di un altro locale, una vecchia.
      e("funzione", 13, "a8", { gid: "GUNO", p: { nome: "prenotazione_disdetta", contesto: "whatsapp", ore: 5 } }),
      e("funzione", 12, "a9", { pid: L.id, p: { nome: "prenotazione_disdetta", contesto: "telefono" } }),
      e("funzione", 12, "a10", { gid: "GS1", p: { nome: "prenotazione_disdetta", contesto: "whatsapp", ore: 20 } }),
      e("funzione", 40, "a11", { gid: "GUNO", p: { nome: "prenotazione_disdetta", contesto: "whatsapp", ore: 1 } }),
      e("funzione", 12, "a12", { gid: "GUNO", p: { nome: "filtri" } }),
      e("funzione", 12, "a13", { gid: "GUNO", p: { nome: "prenotazione_disdetta", contesto: "whatsapp", stato: "in_ritardo" } }),
    ];
    const salvati = [{ place_id: L.id, user_id: "00000000-0000-0000-0000-0000000000c1", created_at: at(13), tags: ["Già visitato"] }];
    const p = rs.computeRistoratore({ locale: L, citta: "Roma", simili: [L, peer(1), peer(2)], eventi, salvati }, 7, now);
    const az = Object.fromEntries(p.azioni.map((a) => [a.tipo, a.persone]));
    ok(az.apri_scheda === 3 && az.salva === 2 && az.ci_sono_stato === 1 && az.percorso === 1, `ristoratore: persone per azione, con Place ID Google e salvataggi veri (${JSON.stringify(az)})`);
    ok(p.daRicerca.ricerche === 1 && p.daRicerca.tipi[0]?.chiave === "trattoria" && p.daRicerca.richieste.some((r) => r.chiave === "tavoli all'aperto") && p.daRicerca.zone[0]?.chiave === "Pigneto", `ristoratore: 'come ti trovano' dalla ricerca della stessa visita (${JSON.stringify(p.daRicerca.richieste)})`);
    ok(p.zona.ricerche === 2 && !p.zona.richieste.some((r) => r.persone > 1) && p.zona.fasce.find((f) => f.chiave === "pranzo")?.persone === 1, `ristoratore: ricerche in zona (città o quartiere nell'indirizzo), non quelle di Milano (${p.zona.ricerche})`);
    ok(p.confronto.simili === 2 && p.confronto.mediaViste === null, "ristoratore: con meno di 3 locali simili niente media (non rivelerebbe il singolo)");
    ok(p.disdette.n === 2 && p.disdette.orePrimaMedia === 5, `ristoratore: tavoli liberati per tempo del locale e del periodo, ore medie solo dove ci sono (${JSON.stringify(p.disdette)})`);
    ok(rs.mostraPersone(0) === "0" && rs.mostraPersone(2) === "meno di 3" && rs.mostraPersone(3) === "3" && p.pochiDati === false, "ristoratore: sotto 3 persone 'meno di 3'");
    ok(p.perGiorno.length === 7 && p.perGiorno.at(-2).viste === 1, "ristoratore: andamento giorno per giorno");
  }

  // Serate tranquille (POSIZIONAMENTO proposta 1, 18/10): la riga della scheda, solo per locali verificati e informazioni recenti.
  { let se = null;
    // "Aperto da poco" (PROPOSTE.md, proposta 7): parola del titolare, solo il primo anno.
    { let ad = null;
      try { ad = await import(new URL("../../src/lib/aperto-dal.ts", import.meta.url).href); } catch (e) { ok(false, `aperto da poco: modulo src/lib/aperto-dal.ts importabile (${e.message})`); }
      if (ad) {
        const oggi = new Date(2026, 9, 20);
        ok(ad.fraseApertura("2026-07", oggi) === "Aperto da 3 mesi" && ad.fraseApertura("2026-09-01", oggi) === "Aperto da 1 mese" && ad.fraseApertura("2026-10", oggi) === "Appena aperto", "aperto da poco: 'Aperto da 3 mesi', '1 mese', 'Appena aperto'");
        ok(ad.fraseApertura("2025-10", oggi) === null && ad.fraseApertura("2026-11", oggi) === null && ad.fraseApertura("2026-13", oggi) === null && ad.fraseApertura(null, oggi) === null && ad.fraseApertura("ciao", oggi) === null, "aperto da poco: niente oltre 12 mesi, nel futuro, mese sbagliato o dato assente");
        ok(ad.fraseApertura("2025-11", oggi) === "Aperto da 11 mesi" && ad.pulisciApertoDal("2026-07-01") === "2026-07", "aperto da poco: 11 mesi ancora sì; data del database letta come mese");
      } }
    try { se = await import(new URL("../../src/lib/serate.ts", import.meta.url).href); } catch (e) { ok(false, `serate: modulo src/lib/serate.ts importabile (${e.message})`); }
    if (se) {
      const dom = Date.parse("2026-10-18T18:00:00Z"); // domenica sera a Roma
      const fresco = "2026-10-10T10:00:00Z";
      const f = (giorni, extra = {}) => se.frasePosto({ verificato: true, giorni, at: fresco, ...extra }, dom);
      ok(se.oggiARoma(dom) === 0 && se.oggiARoma(Date.parse("2026-10-18T22:30:00Z")) === 1, "serate: il giorno è quello di Roma (domenica 23:30 UTC = lunedì)");
      ok(f([2, 3]) === "Martedì e mercoledì c'è posto" && f([3, 1]) === "Lunedì e mercoledì c'è posto" && f([6, 1]) === "Lunedì e sabato c'è posto", `serate: giorni dal più vicino (${f([2, 3])} / ${f([6, 1])})`);
      ok(f([0]) === "Stasera c'è posto" && f([0, 2]) === "Stasera c'è posto (anche martedì)" && f([0, 1, 2, 3, 4, 5, 6]) === "C'è posto tutte le sere", `serate: stasera e tutte le sere (${f([0, 2])})`);
      ok(f([2], { verificato: false }) === null && f([]) === null && f([2], { at: "2026-08-01T10:00:00Z" }) === null && f([2], { at: null }) === null, "serate: niente riga senza verifica, senza giorni o con un'informazione di oltre 60 giorni");
      ok(JSON.stringify(se.pulisciGiorni([0, 9, 2, 2, "3", 1.5, 6])) === "[2,6,0]", "serate: giorni puliti e in ordine di settimana");
    } }

  const LOC = "44444444-0000-4000-8000-0000000000a1";
  const locR = {
    place: { id: LOC, name: "Osteria Pigneto", address: "Via del Pigneto 10, 00176 Roma RM, Italy", lat: 41.888, lng: 12.53, category: "restaurant", rating: 4.5, price_level: 2, google_place_id: "GOSTERIA" },
    synthesis: null,
  };
  const rctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const setCookie = (name, v) => rctx.addCookies([{ name, value: encodeURIComponent(JSON.stringify(v)), url: BASE }]);
  await setCookie("e2e_locale", locR);
  await rctx.route("**/api/events", (r) => r.fulfill({ status: 204, body: "" }));
  let claim = null, claimMode = "ok", claimCalls = 0;
  await rctx.route("**/rest/v1/claims**", (r) => {
    claimCalls++;
    if (r.request().method() !== "POST") return r.fulfill({ json: [] });
    claim = r.request().postDataJSON();
    if (claimMode === "manca") return r.fulfill({ status: 404, json: { code: "PGRST205", message: "Could not find the table 'public.claims' in the schema cache", details: null, hint: null } });
    return r.fulfill({ status: 201, body: "" });
  });
  const rp = await rctx.newPage();
  rp.on("pageerror", (err) => errors.push(err.message));

  // Pagina del locale: invito discreto, niente badge finché non è verificato.
  await rp.goto(`${BASE}/locali/${LOC}`, { waitUntil: "networkidle" });
  ok((await rp.getByTestId("rivendica-locale").getAttribute("href")) === `/per-i-ristoratori/rivendica?locale=${LOC}` && (await rp.getByTestId("locale-verificato").count()) === 0, "locale: 'Sei il titolare? Rivendica questo locale' porta al modulo, senza badge");
  await setCookie("e2e_locale", { ...locR, place: { ...locR.place, verified_at: "2026-10-14T10:00:00Z" } });
  await rp.goto(`${BASE}/locali/${LOC}`, { waitUntil: "networkidle" });
  ok(await rp.getByTestId("locale-verificato").isVisible() && (await rp.getByTestId("rivendica-locale").count()) === 0, "locale verificato: badge 'Verificato dal titolare' e niente invito a rivendicare");
  ok((await rp.getByTestId("posto-stasera").count()) === 0, "locale verificato senza serate tranquille: nessuna riga 'c'è posto'");
  { const oggi = new Date().toLocaleDateString("en-US", { timeZone: "Europe/Rome", weekday: "short" });
    const g = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[oggi];
    await setCookie("e2e_serate", { id: LOC, gid: "GOSTERIA", verificato: true, giorni: [g], at: new Date().toISOString() });
    await rp.reload({ waitUntil: "networkidle" });
    await rp.getByTestId("posto-stasera").waitFor({ timeout: 5000 }).catch(() => {});
    const t = (await rp.getByTestId("posto-stasera").textContent().catch(() => "")) ?? "";
    ok(t.includes("Stasera c'è posto") && t.includes("dice il locale") && (await rp.getByTestId("posto-locale").getByText("Verificato").count()) === 0, `locale verificato con serate tranquille: 'Stasera c'è posto · dice il locale', senza un secondo badge (${t})`);
    await rp.screenshot({ path: `${OUT}/70b-locale-serate.png`, caret: "initial" });
    await rctx.clearCookies({ name: "e2e_serate" }); }
  await rp.screenshot({ path: `${OUT}/70-locale-verificato.png`, caret: "initial" });
  await setCookie("e2e_locale", locR);

  // Modulo: con l'accesso la richiesta va in claims con UUID e Place ID del locale.
  const fill = async () => {
    await rp.getByLabel("Nome e cognome").fill("Maria Rossi");
    await rp.getByLabel("Ruolo").selectOption("Titolare");
    await rp.getByLabel("Telefono").fill("+39 333 1234567");
    await rp.getByLabel("Email").fill("maria@example.com");
    await rp.getByLabel(/Messaggio/).fill("Chiamatemi dopo le 15");
  };
  await rp.goto(`${BASE}/per-i-ristoratori/rivendica?locale=${LOC}`, { waitUntil: "networkidle" });
  ok((await rp.getByTestId("rivendica-scheda").textContent())?.includes("Osteria Pigneto") && (await rp.getByLabel("Nome del locale").count()) === 0, "rivendica: mostra il locale, senza chiedere di nuovo nome e città");
  await fill();
  { const w = await rp.evaluate(() => document.documentElement.scrollWidth); ok(w <= 390, `rivendica: niente scorrimento orizzontale sul telefono (${w}px)`); }
  await rp.screenshot({ path: `${OUT}/71-rivendica-modulo.png`, caret: "initial", fullPage: true });
  await rp.getByRole("button", { name: "Invia la richiesta" }).click();
  await rp.getByTestId("rivendica-inviata").waitFor({ timeout: 5000 }).catch(() => {});
  ok(await rp.getByTestId("rivendica-inviata").isVisible() && claim?.place_id === LOC && claim?.google_place_id === "GOSTERIA" && claim?.user_id === "00000000-0000-0000-0000-000000000001" && claim?.nome === "Maria Rossi" && claim?.ruolo === "Titolare" && claim?.messaggio === "Chiamatemi dopo le 15" && !("stato" in claim), `rivendica: richiesta salvata in claims e conferma (${JSON.stringify(claim)?.slice(0, 120)})`);
  await rp.screenshot({ path: `${OUT}/72-rivendica-inviata.png`, caret: "initial" });

  // Senza tabella (migrazione non applicata): email precompilata a Mapetite con gli stessi dati.
  claimMode = "manca"; claim = null;
  await rp.goto(`${BASE}/per-i-ristoratori/rivendica?locale=${LOC}`, { waitUntil: "networkidle" });
  await fill();
  await rp.getByRole("button", { name: "Invia la richiesta" }).click();
  await rp.getByTestId("rivendica-ripiego").waitFor({ timeout: 5000 }).catch(() => {});
  { const href = decodeURIComponent((await rp.getByTestId("rivendica-email").getAttribute("href").catch(() => "")) ?? "");
    ok(claim !== null && href.startsWith("mailto:founder.mapetite@gmail.com") && href.includes("Osteria Pigneto") && href.includes("Maria Rossi") && href.includes("+39 333 1234567") && href.includes(LOC), "rivendica senza tabella claims: prepara l'email con i dati del modulo"); }
  await rp.screenshot({ path: `${OUT}/73-rivendica-ripiego-email.png`, caret: "initial" });

  // Senza accesso: nessuna scrittura, email e invito ad accedere. Senza locale: nome e città a mano.
  await rctx.addCookies([{ name: "e2e_anonimo", value: "1", url: BASE }]);
  claimCalls = 0;
  await rp.goto(`${BASE}/per-i-ristoratori/rivendica`, { waitUntil: "networkidle" });
  ok(await rp.getByTestId("rivendica-accedi").isVisible() && (await rp.getByLabel("Nome del locale").count()) === 1, "rivendica senza accesso e senza locale: chiede nome e città e invita ad accedere");
  await rp.getByLabel("Nome del locale").fill("Bar Sport");
  await rp.getByLabel("Città").fill("Milano");
  await fill();
  await rp.getByRole("button", { name: "Invia la richiesta" }).click();
  await rp.getByTestId("rivendica-ripiego").waitFor({ timeout: 5000 }).catch(() => {});
  ok(await rp.getByTestId("rivendica-ripiego").isVisible() && claimCalls === 0 && decodeURIComponent((await rp.getByTestId("rivendica-email").getAttribute("href")) ?? "").includes("Città: Milano"), "rivendica senza accesso: nessuna scrittura, email precompilata");
  await rctx.clearCookies({ name: "e2e_anonimo" });

  // Pannello del ristoratore: senza essere admin o titolare non esiste.
  { const a = await rp.request.get(`${BASE}/ristoratore/${LOC}`); const b = await rp.request.get(`${BASE}/ristoratore/non-un-id`);
    ok(a.status() === 404 && b.status() === 404, `pannello ristoratore: vietato a chi non è admin o titolare (404: ${a.status()}/${b.status()})`); }
  // Con dati finti (cookie e2e_ristoratore, solo in sviluppo): pochi dati → messaggio onesto e soglia.
  const iso = (minAgo) => new Date(Date.now() - minAgo * 60_000).toISOString();
  const Lr = { id: LOC, name: "Osteria Pigneto", address: locR.place.address, category: "restaurant", lat: 41.888, lng: 12.53, google_place_id: "GOSTERIA" };
  await setCookie("e2e_ristoratore", {
    locale: Lr, simili: [Lr], verificato: true, salvati: [],
    eventi: [
      { created_at: iso(60), type: "ricerca", user_id: null, anon_id: "x1", session_id: "s1", place_id: null, google_place_id: null, props: { modo: "ai", tipo: "trattoria", requisiti: ["non turistico"], zona: "Pigneto" } },
      { created_at: iso(59), type: "apri_scheda", user_id: null, anon_id: "x1", session_id: "s1", place_id: null, google_place_id: "GOSTERIA", props: { fonte: "ricerca" } },
      { created_at: iso(30), type: "apri_scheda", user_id: null, anon_id: "x2", session_id: "s2", place_id: LOC, google_place_id: null, props: { fonte: "mappa" } },
    ],
  });
  { const r = await rp.goto(`${BASE}/ristoratore/${LOC}`, { waitUntil: "networkidle" });
    ok(r?.status() === 200 && await rp.getByTestId("pannello-pochi-dati").isVisible() && (await rp.getByTestId("pannello-azioni").textContent())?.includes("meno di 3") && (await rp.getByTestId("pannello-demo-etichetta").count()) === 0 && await rp.getByTestId("pannello-andamento-nascosto").isVisible(), "pannello ristoratore: dati veri, pochi → 'dati ancora pochi', 'meno di 3' e niente curva giornaliera");
    ok((await rp.getByTestId("pannello-richieste-locale").textContent())?.includes("non turistico") && await rp.getByTestId("pannello-verificato").isVisible(), "pannello ristoratore: 'come ti trovano' con le richieste della ricerca");
    const w = await rp.evaluate(() => document.documentElement.scrollWidth); ok(w <= 390, `pannello ristoratore: niente scorrimento orizzontale (${w}px)`); }
  await rp.screenshot({ path: `${OUT}/74-pannello-ristoratore.png`, caret: "initial", fullPage: true });
  // Serate tranquille sul pannello vero: si salvano (cookie e2e_serate al posto di places) e la scheda le rilegge per Place ID.
  { await setCookie("e2e_serate", { id: LOC, gid: "GOSTERIA", verificato: true, giorni: [] });
    await rp.goto(`${BASE}/ristoratore/${LOC}?vista=promozione`, { waitUntil: "networkidle" });
    const st = rp.getByTestId("serate-tranquille");
    await st.getByRole("button", { name: "venerdì" }).click();
    await rp.getByTestId("serate-salva").click();
    await st.getByText("Salvato").waitFor({ timeout: 5000 }).catch(() => {});
    const j = await (await rp.request.get(`${BASE}/api/ristoratore/serate?id=GOSTERIA`)).json();
    const vietato = await rp.request.post(`${BASE}/api/ristoratore/serate`, { data: { id: "44444444-0000-4000-8000-0000000000ff", giorni: [1] } });
    // "Aperto da poco" nello stesso pannello: il mese si salva e la scheda lo rilegge; le serate restano.
    { const ap = rp.getByTestId("aperto-dal");
      const due = (() => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 2); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; })();
      await ap.getByTestId("aperto-dal-mese").fill(due);
      await ap.getByTestId("aperto-dal-salva").click();
      await ap.getByText("Salvato").waitFor({ timeout: 5000 }).catch(() => {});
      const j2 = await (await rp.request.get(`${BASE}/api/ristoratore/serate?id=GOSTERIA`)).json();
      const futuro = await rp.request.post(`${BASE}/api/ristoratore/serate`, { data: { id: LOC, apertoDal: "2999-01" } });
      ok(j2.apertoDal === due && JSON.stringify(j2.giorni) === "[5]" && futuro.status() === 400 && ((await ap.getByTestId("aperto-dal-anteprima").textContent()) ?? "").includes("🆕"), `pannello ristoratore: 'Aperto da' salvato e riletto dalla scheda, senza toccare le serate; mese futuro rifiutato (${JSON.stringify(j2)} / ${futuro.status()})`);
      await rp.screenshot({ path: `${OUT}/71-pannello-aperto-dal.png`, caret: "initial" }); }
    ok(await st.getByText("Salvato").isVisible() && JSON.stringify(j.giorni) === "[5]" && j.verificato === true && !!j.at && vietato.status() === 403, `pannello ristoratore: serate tranquille salvate e rilette dalla scheda; un altro locale è vietato (${JSON.stringify(j)} / ${vietato.status()})`);
    await rctx.clearCookies({ name: "e2e_serate" }); }

  // Esempio dimostrativo: etichetta in cima, numeri pieni, periodo 7/30 giorni.
  { const r = await rp.goto(`${BASE}/ristoratore/demo`, { waitUntil: "networkidle" });
    const lab = rp.getByTestId("pannello-demo-etichetta");
    const box = await lab.boundingBox();
    ok(r?.status() === 200 && (await lab.textContent())?.includes("Esempio dimostrativo") && !!box && box.y < 200, "pannello demo: etichetta 'Esempio dimostrativo' in cima");
    { const t = ((await rp.getByTestId("pannello-in-attesa").innerText()) ?? "").replace(/\s+/g, " ");
      ok(t.includes("31 ti vogliono provare") && t.includes("Con amici · 9") && t.includes("Romantico · 7") && t.includes("Cena di lavoro · 3"), `pannello demo: 'ti vogliono provare' con le occasioni (${t.slice(0, 120)})`);
      ok(((await rp.getByTestId("pannello-visite-vere").innerText()) ?? "").replace(/\s+/g, " ").includes("👍 10 su 11"), "pannello demo: visite vere con il 'Com'è andata?' (👍 10 su 11)");
      { const d = ((await rp.getByTestId("pannello-disdette").innerText().catch(() => "")) ?? "").replace(/\s+/g, " ");
        ok(/🔁 \d+ tavol[oi] liberat[oi] per tempo/.test(d) && /in media \d+ ore prima/.test(d), `pannello demo: tavoli liberati per tempo da Mapetite (${d.slice(0, 120)})`); }
      { const t = ((await rp.getByTestId("pannello-insight").innerText().catch(() => "")) ?? "").replace(/\s+/g, " ");
        ok(/\d+ persone di Mapetite sono tornate da te 2 o più volte: sono i tuoi clienti fissi/.test(t), `pannello demo: clienti che tornano in 'Cosa ti dicono i numeri' (${t.slice(-110)})`); } }
    // Prima schermata (feedback 16/10): 4 numeri chiave e "Cosa ti dicono i numeri" visibili senza scorrere.
    const nums = rp.getByTestId("numero-chiave");
    const ins = await rp.getByTestId("pannello-insight").boundingBox();
    const lastNum = await nums.nth(3).boundingBox();
    ok((await nums.count()) === 4 && !!lastNum && lastNum.y + lastNum.height <= 844 && !!ins && ins.y < 844 && /Chi ti cerca vuole soprattutto “/.test((await rp.getByTestId("pannello-insight").textContent()) ?? ""),
      `pannello demo: prima schermata con 4 numeri chiave e 'Cosa ti dicono i numeri' (insight da y ${Math.round(ins?.y ?? 0)})`);
    const hPan = await rp.evaluate(() => document.documentElement.scrollHeight);
    ok(hPan < 2400, `pannello demo: panoramica corta, il dettaglio sta nelle schede (${hPan}px, prima ~5000)`);
    ok((await rp.getByRole("tab").count()) === 4 && (await rp.getByRole("tab", { name: "Panoramica" }).getAttribute("aria-selected")) === "true", "pannello demo: quattro schede, aperta la Panoramica");
    ok((await rp.getByTestId("pannello-pochi-dati").count()) === 0 && await rp.getByTestId("pannello-confronto").isVisible() && await rp.getByTestId("pannello-andamento").isVisible() && !(await rp.getByTestId("pannello-fasce").isVisible()), "pannello demo: in Panoramica confronto e andamento, le fasce orarie nella scheda Zona");
    await rp.getByRole("tab", { name: "Zona" }).click();
    ok(await rp.getByTestId("pannello-fasce").isVisible() && !(await rp.getByTestId("pannello-confronto").isVisible()) && new URL(rp.url()).searchParams.get("vista") === "zona", "pannello demo: la scheda Zona mostra le fasce orarie e resta nell'indirizzo");
    // Elenchi: primi 3, il resto dietro "Vedi tutto" (niente dati persi).
    { const rz = rp.getByTestId("pannello-richieste-zona");
      const vis = await rz.locator("li:visible").count(); const tot = await rz.locator("li").count();
      await rz.getByText(/^Vedi tutto/).click();
      ok(vis === 3 && tot > 3 && (await rz.locator("li:visible").count()) === tot, `pannello demo: richieste di zona, 3 visibili e 'Vedi tutto' apre le altre (${vis}/${tot})`); }
    await rp.getByRole("tab", { name: "Clienti" }).click();
    ok(await rp.getByTestId("pannello-richieste-locale").isVisible() && (await rp.getByTestId("pannello-tutte-azioni").locator("li").count()) === 6, "pannello demo: scheda Clienti con 'come ti trovano' e tutte e sei le azioni");
    await rp.getByRole("tab", { name: "Panoramica" }).click();
    await rp.locator("[data-vai=promozione]").click();
    ok((await rp.getByRole("tab", { name: "Promozione" }).getAttribute("aria-selected")) === "true" && await rp.getByTestId("pannello-evidenza").isVisible(), "pannello demo: dalla Panoramica la scorciatoia porta alla scheda Promozione");
    { const st = rp.getByTestId("serate-tranquille");
      const premuti = await st.locator("button[aria-pressed=true]").evaluateAll((b) => b.map((x) => x.getAttribute("aria-label")));
      const salva = rp.getByTestId("serate-salva");
      const primaDis = await salva.isDisabled();
      await st.getByRole("button", { name: "giovedì" }).click();
      const ant = (await rp.getByTestId("serate-anteprima").textContent()) ?? "";
      await salva.click();
      ok(premuti.join() === "martedì,mercoledì" && primaDis && /c'è posto/.test(ant) && /giovedì/i.test(ant) && await st.getByText("Fatto (esempio: non si salva)").isVisible(), `pannello demo: serate tranquille, giorni da toccare, anteprima della riga e salvataggio finto (${premuti.join()} → ${ant.slice(0, 80)})`);
      await rp.getByTestId("pannello-serate").screenshot({ path: `${OUT}/76b-pannello-serate.png` }); }
    await rp.getByRole("tab", { name: "Panoramica" }).click();
    const w = await rp.evaluate(() => document.documentElement.scrollWidth); ok(w <= 390, `pannello demo: niente scorrimento orizzontale (${w}px)`); }
  await rp.screenshot({ path: `${OUT}/75-pannello-demo.png`, caret: "initial" });
  await rp.screenshot({ path: `${OUT}/76-pannello-demo-intero.png`, caret: "initial", fullPage: true });
  // Il cambio di periodo non perde la scheda aperta.
  await rp.goto(`${BASE}/ristoratore/demo?vista=zona`, { waitUntil: "networkidle" });
  ok((await rp.getByRole("tab", { name: "Zona" }).getAttribute("aria-selected")) === "true" && (await rp.getByRole("link", { name: "Ultimi 7 giorni" }).getAttribute("href"))?.includes("vista=zona"), "pannello demo: ?vista=zona apre la scheda Zona e il periodo la conserva");
  await rp.goto(`${BASE}/ristoratore/demo`, { waitUntil: "networkidle" });
  await rp.getByRole("link", { name: "Ultimi 7 giorni" }).click();
  await rp.waitForURL((u) => u.searchParams.get("giorni") === "7", { timeout: 8000 }).catch(() => {});
  ok((await rp.getByRole("link", { name: "Ultimi 7 giorni" }).getAttribute("aria-current")) === "page", "pannello demo: si passa agli ultimi 7 giorni");

  // Su computer.
  await rp.setViewportSize({ width: 1280, height: 800 });
  await rp.goto(`${BASE}/ristoratore/demo`, { waitUntil: "networkidle" });
  await rp.screenshot({ path: `${OUT}/77-pannello-demo-computer.png`, caret: "initial", fullPage: true });
  await rp.goto(`${BASE}/ristoratore/${LOC}`, { waitUntil: "networkidle" });
  await rp.screenshot({ path: `${OUT}/78-pannello-ristoratore-computer.png`, caret: "initial", fullPage: true });
  await rp.goto(`${BASE}/per-i-ristoratori/rivendica?locale=${LOC}`, { waitUntil: "networkidle" });
  await rp.screenshot({ path: `${OUT}/79-rivendica-computer.png`, caret: "initial", fullPage: true });
  await rctx.close();
}

// Le mie prenotazioni (piano 1.5b): pagina letta dal telefono (localStorage), stati, calendario, esito e ingressi.
//   Nessuna chiamata Google/Haiku: le prenotazioni si scrivono direttamente nel localStorage.
{
  let bk = null;
  try { bk = await import(new URL("../../src/lib/booking.ts", import.meta.url).href); } catch (e) { ok(false, `prenotazioni: modulo src/lib/booking.ts importabile (${e.message})`); }
  if (bk) {
    const now = new Date(2026, 9, 15, 18, 0); // giovedì 15/10, ore 18
    const L = [
      { id: "a", placeId: "G1", placeName: "Da Enzo, Trastevere; al 29", date: "2026-10-17", time: "21:00", people: 2, special: "in terrazza", via: "whatsapp", lat: 41.88, lng: 12.47, createdAt: 1 },
      { id: "b", placeId: "G2", placeName: "Ieri", date: "2026-10-14", time: "20:00", people: 2, special: null, via: "telefono", lat: null, lng: null, createdAt: 1 },
      { id: "c", placeId: "G3", placeName: "Oggi", date: "2026-10-15", time: "13:00", people: 4, special: null, via: "sito", lat: null, lng: null, createdAt: 1, confirmed: true },
      { id: "d", placeId: "G4", placeName: "Vecchia", date: "2026-10-01", time: null, people: 3, special: null, via: "copiato", lat: null, lng: null, createdAt: 1, outcome: "bene" },
    ];
    const s = bk.splitBookings(L, now);
    ok(s.upcoming.map((b) => b.id).join() === "c,a" && s.past.map((b) => b.id).join() === "b,d", `prenotazioni: in arrivo dalla più vicina (oggi compreso), passate dalla più recente (${s.upcoming.map((b) => b.id)} | ${s.past.map((b) => b.id)})`);
    ok(L.map((b) => bk.bookingStatus(b, now)).join() === "inviata,da-dire,confermata,fatta" && bk.bookingStatus({ ...L[1], outcome: "non-andato" }, now) === "non-andata", "prenotazioni: stati richiesta inviata → confermata → fatta / com'è andata");
    const ics = bk.bookingIcs(L[0], now);
    const unfolded = ics.replace(/\r\n /g, "");
    ok(ics.startsWith("BEGIN:VCALENDAR\r\n") && unfolded.includes("DTSTART:20261017T210000\r\n") && unfolded.includes("DTEND:20261017T230000\r\n") && unfolded.includes("SUMMARY:Tavolo da Da Enzo\\, Trastevere\\; al 29\r\n") && unfolded.includes("2 persone\\nRichiesta: in terrazza"), "prenotazioni: file .ics con giorno, ora, titolo e dettagli (virgole e punti e virgola protetti)");
    ok(ics.split("\r\n").every((l) => Buffer.byteLength(l) <= 75), "prenotazioni: .ics con righe di al massimo 75 byte");
    ok(bk.bookingIcs(L[3], now).includes("DTSTART;VALUE=DATE:20261001") && bk.bookingIcs({ ...L[0], date: null }, now) === null, "prenotazioni: senza ora evento di tutto il giorno, senza giorno nessun file");
  }

  const pctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, acceptDownloads: true });
  await pctx.addInitScript(() => { try { localStorage.setItem("mapetite.intro", "visto"); } catch { /* ignorato */ } });
  const pEvents = [];
  await pctx.route("**/api/events", (route) => { pEvents.push(route.request().postDataJSON()); return route.fulfill({ status: 204, body: "" }); });
  await pctx.route("**/api/places/photo**", (route) => route.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="#c96"/></svg>' }));
  await pctx.route("**/rest/v1/**", (route) => route.fulfill({ json: [] }));
  const pp = await pctx.newPage();
  pp.on("pageerror", (e) => errors.push(e.message));
  pp.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/i.test(m.text())) errors.push(m.text().slice(0, process.env.E2E_DEBUG ? 3000 : 150) + (process.env.E2E_DEBUG ? " @ " + m.location().url : "")); });
  const pshot = (n, full = false) => pp.screenshot({ path: `${OUT}/${n}.png`, caret: "initial", fullPage: full });
  const width = () => pp.evaluate(() => document.scrollingElement.scrollWidth);

  // Vuota: invito all'assistente
  await pp.goto(`${BASE}/prenotazioni`, { waitUntil: "networkidle" });
  await pp.getByTestId("prenotazioni-vuoto").waitFor({ timeout: 5000 }).catch(() => {});
  ok(await pp.getByTestId("prenotazioni-vuoto").isVisible() && (await pp.getByTestId("prenotazioni-vuoto").textContent()).includes("Prenotami sabato alle 21 per 2"), "prenotazioni: pagina vuota con l'esempio da chiedere all'assistente");
  ok((await pp.getByTestId("prenotazioni-vuoto-assistente").getAttribute("href")) === "/assistente", "prenotazioni: dalla pagina vuota si va all'assistente");
  { const w = await width(); ok(w <= 390, `prenotazioni vuota: niente scorrimento orizzontale (${w}px)`); }
  await pp.waitForTimeout(300);
  ok(pEvents.some((e) => e.type === "funzione" && e.props?.nome === "prenotazioni_apri" && e.props?.risultati === 0), "prenotazioni: apertura della pagina registrata");
  ok(pEvents.some((e) => e.type === "pagina" && e.props?.pagina === "prenotazioni"), "prenotazioni: vista di pagina con il suo nome");
  await pshot("80-prenotazioni-vuota");

  // Con prenotazioni: due in arrivo (oggi confermata, fra due giorni inviata), due passate.
  const UUID = "44444444-0000-4000-8000-000000000004";
  await pp.evaluate((uuid) => {
    const d = (n) => { const x = new Date(); x.setDate(x.getDate() + n); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`; };
    localStorage.setItem("mapetite.prenotazioni", JSON.stringify([
      { id: "u1", placeId: "P1", placeName: "Terrazza Uno", lat: 41.9, lng: 12.49, date: d(2), time: "21:00", people: 2, special: "in terrazza", via: "whatsapp", createdAt: Date.now() },
      { id: "u2", placeId: uuid, placeName: "Osteria Pigneto", lat: 41.888, lng: 12.53, date: d(0), time: "13:00", people: 4, special: null, via: "telefono", createdAt: Date.now(), confirmed: true },
      { id: "p1", placeId: "P3", placeName: "Rooftop Tre", lat: 41.902, lng: 12.494, date: d(-1), time: "20:30", people: 2, special: null, via: "telefono", createdAt: Date.now() },
      { id: "p2", placeId: "P2", placeName: "Pub Fuori Tema", lat: null, lng: null, date: d(-6), time: "21:00", people: 3, special: null, via: "sito", createdAt: Date.now(), outcome: "bene" },
    ]));
  }, UUID);
  await pp.reload({ waitUntil: "networkidle" });
  await pp.getByTestId("prenotazione-in-arrivo").first().waitFor({ timeout: 5000 });
  const up = pp.getByTestId("prenotazione-in-arrivo");
  const past = pp.getByTestId("prenotazione-passata");
  ok((await up.count()) === 2 && (await up.nth(0).textContent()).includes("Osteria Pigneto") && (await up.nth(1).textContent()).includes("Terrazza Uno"), "prenotazioni: 'In arrivo' in ordine di data (oggi prima)");
  ok((await past.count()) === 2 && (await past.nth(0).textContent()).includes("Rooftop Tre") && (await past.nth(1).textContent()).includes("Pub Fuori Tema"), "prenotazioni: 'Passate' dalla più recente");
  const u1 = up.nth(1);
  const t1 = await u1.textContent();
  ok(t1.includes("alle 21:00") && t1.includes("2 persone") && t1.includes("in terrazza") && t1.includes("Inviata su WhatsApp") && /\d\d\/\d\d/.test(t1), `prenotazioni: giorno, ora, persone, richiesta e come è stata inviata (${t1.slice(0, 90)}…)`);
  ok((await u1.getAttribute("data-stato")) === "inviata" && (await up.nth(0).getAttribute("data-stato")) === "confermata" && (await up.nth(0).textContent()).includes("Oggi"), "prenotazioni: stato 'Richiesta inviata' e 'Confermata'");
  ok((await up.nth(0).getByRole("link", { name: "Osteria Pigneto" }).getAttribute("href")) === `/locali/${UUID}` && (await u1.getByRole("link", { name: "Terrazza Uno" }).count()) === 0, "prenotazioni: il nome apre la scheda solo con l'id Mapetite (l'id Google non ha pagina)");
  ok((await u1.getByTestId("prenotazione-percorso").getAttribute("href")).includes("destination=41.9,12.49"), "prenotazioni: Percorso verso il locale");
  ok((await past.nth(1).getByTestId("prenotazione-esito").textContent()).includes("Ti è piaciuto") && (await past.nth(0).getByTestId("prenotazione-com-e-andata").count()) === 1, "prenotazioni: passate con esito o con 'Com'è andata?'");
  { const w = await width(); ok(w <= 390, `prenotazioni: niente scorrimento orizzontale (${w}px)`); }
  await pshot("81-prenotazioni");
  await pshot("82-prenotazioni-intera", true);

  // Il locale ha confermato
  await u1.getByTestId("prenotazione-conferma").click();
  await pp.waitForTimeout(200);
  const stored = await pp.evaluate(() => JSON.parse(localStorage.getItem("mapetite.prenotazioni") ?? "[]"));
  ok((await u1.getAttribute("data-stato")) === "confermata" && stored.find((b) => b.id === "u1")?.confirmed === true, "prenotazioni: 'Il locale ha confermato' → Confermata, salvato nel telefono");
  ok(pEvents.some((e) => e.type === "funzione" && e.props?.nome === "prenotazione_confermata" && e.googlePlaceId === "P1"), "prenotazioni: conferma registrata con il locale");

  // Aggiungi al calendario: file .ics generato nel browser
  const [dl] = await Promise.all([pp.waitForEvent("download", { timeout: 5000 }), u1.getByTestId("prenotazione-calendario").click()]);
  const { readFileSync } = await import("fs");
  const icsFile = readFileSync(await dl.path(), "utf8").replace(/\r\n /g, "");
  ok(dl.suggestedFilename() === "prenotazione-terrazza-uno.ics" && icsFile.includes("BEGIN:VEVENT") && icsFile.includes("SUMMARY:Tavolo da Terrazza Uno") && icsFile.includes("T210000") && icsFile.includes("Confermata dal locale"), `prenotazioni: 'Calendario' scarica il file .ics (${dl.suggestedFilename()})`);
  ok(pEvents.some((e) => e.type === "funzione" && e.props?.nome === "prenotazione_calendario"), "prenotazioni: calendario registrato");

  // Com'è andata?
  await past.nth(0).getByRole("button", { name: "👍 Mi è piaciuto" }).click();
  await pp.waitForTimeout(200);
  ok((await past.nth(0).getAttribute("data-stato")) === "fatta" && (await past.nth(0).getByTestId("prenotazione-esito").textContent()).includes("Ti è piaciuto"), "prenotazioni: 'Com'è andata?' → Fatta con l'esito");
  ok(pEvents.some((e) => e.type === "funzione" && e.props?.nome === "prenotazione_esito" && e.props?.stato === "bene") && pEvents.some((e) => e.type === "ci_sono_stato" && e.props?.fonte === "prenotazioni" && e.googlePlaceId === "P3"), "prenotazioni: esito registrato (anche come 'ci sono stato')");

  // Togli, con conferma
  await past.nth(1).getByRole("button", { name: /Togli la prenotazione/ }).click();
  ok(await pp.getByTestId("prenotazione-togli-conferma").isVisible(), "prenotazioni: 'Togli' chiede conferma");
  await pp.getByRole("button", { name: "Sì, togli" }).click();
  await pp.waitForTimeout(200);
  ok((await past.count()) === 1 && (await pp.evaluate(() => JSON.parse(localStorage.getItem("mapetite.prenotazioni")).length)) === 3, "prenotazioni: tolta dall'elenco e dal telefono");
  await pshot("83-prenotazioni-dopo-azioni");

  // 360 px
  await pp.setViewportSize({ width: 360, height: 780 });
  await pp.reload({ waitUntil: "networkidle" });
  await pp.getByTestId("prenotazione-in-arrivo").first().waitFor({ timeout: 5000 });
  { const w = await width(); ok(w <= 360, `prenotazioni a 360 px: niente scorrimento orizzontale (${w}px)`); }
  { const b = await up.nth(0).getByRole("button", { name: /Togli la prenotazione/ }).boundingBox(); const c = await up.nth(0).boundingBox(); ok(!!b && !!c && b.x + b.width <= c.x + c.width - 8, `prenotazioni a 360 px: i pulsanti stanno dentro la card (${Math.round((b?.x ?? 0) + (b?.width ?? 0))}/${Math.round((c?.x ?? 0) + (c?.width ?? 0))})`); }
  await pshot("84-prenotazioni-360");
  await pp.setViewportSize({ width: 390, height: 844 });

  // Ingressi: profilo (con il numero in arrivo) e promemoria in home
  await pctx.addCookies([{ name: "e2e_profilo", value: encodeURIComponent(JSON.stringify({ email: "giulia@example.com", saved: [], reviews: [] })), url: BASE }]);
  await pp.goto(`${BASE}/profilo`, { waitUntil: "networkidle" });
  await pp.getByTestId("profilo-prenotazioni").waitFor({ timeout: 5000 }).catch(() => {});
  ok((await pp.getByTestId("profilo-prenotazioni-conteggio").textContent()) === "2 in arrivo", "profilo: 'Le mie prenotazioni (2 in arrivo)'");
  await pp.getByTestId("profilo-prenotazioni").click();
  await pp.waitForURL(/\/prenotazioni$/, { timeout: 8000 }).then(() => ok(true, "profilo → Le mie prenotazioni"), () => ok(false, "profilo → Le mie prenotazioni"));
  await pctx.clearCookies({ name: "e2e_profilo" });
  await pp.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await pp.getByTestId("promemoria-oggi").waitFor({ timeout: 5000 }).catch(() => {});
  ok((await pp.getByTestId("promemoria-tutte").getAttribute("href")) === "/prenotazioni", "home: dal promemoria di oggi si arriva a 'Le mie prenotazioni'");
  await pctx.close();
}

// 15. Barra in basso ridisegnata (piano 6.4): Esplora, Assistente, Salvati, Amici, Profilo.
//     Da non collegati l'ultima voce è "Entra". Il cookie "e2e_collegato" (solo sviluppo) dà la barra da collegato.
{
  const VOCI = ["Assistente", "Salvati", "Mappa", "Amici", "Profilo"];
  const profiloFinto = encodeURIComponent(JSON.stringify({ email: "tester@example.com", saved: [], reviews: [] }));
  for (const [w, h] of [[390, 844], [360, 740]]) {
    const bctx = await browser.newContext({ viewport: { width: w, height: h } });
    await bctx.route("**/api/events", (r) => r.fulfill({ status: 204, body: "" }));
    // Telemetria di Mapbox: senza rete fallisce e, se si lascia la mappa mentre è in corso, Mapbox lancia
    // "this.errorCb is not a function" (difetto della libreria). Qui si risponde subito.
    await bctx.route("**/events.mapbox.com/**", (r) => r.fulfill({ status: 204, body: "" }));
    await bctx.addCookies([{ name: "e2e_collegato", value: "1", url: BASE }, { name: "e2e_profilo", value: profiloFinto, url: BASE }]);
    const bp = await bctx.newPage();
    bp.on("pageerror", (e) => errors.push(e.message));
    await bp.addInitScript(() => { try { localStorage.setItem("mapetite.intro", "visto"); } catch {} });
    await bp.goto(`${BASE}/assistente`, { waitUntil: "networkidle" });
    const nav = bp.getByTestId("barra");
    const nomi = (await nav.getByRole("link").allTextContents()).map((t) => t.trim());
    ok(JSON.stringify(nomi) === JSON.stringify(VOCI), `barra ${w}px: 5 voci nell'ordine Assistente, Salvati, Mappa, Amici, Profilo (${nomi.join(", ")})`);
    // Misure: altezza comoda, voci larghe uguali, etichette dentro la propria voce, niente scorrimento orizzontale.
    const m = await bp.evaluate(() => {
      const n = document.querySelector("[data-testid=barra]");
      const links = [...n.querySelectorAll("a")];
      const r = n.getBoundingClientRect();
      return {
        alta: Math.round(r.height), fondo: Math.round(innerHeight - r.bottom),
        larghe: links.map((a) => Math.round(a.getBoundingClientRect().width)),
        etichette: links.every((a) => { const s = a.querySelector("span:last-child").getBoundingClientRect(); const b = a.getBoundingClientRect(); return s.left >= b.left - 0.5 && s.right <= b.right + 0.5 && s.height > 0; }),
        caratteri: Math.min(...links.map((a) => parseFloat(getComputedStyle(a.querySelector("span:last-child")).fontSize))),
        sborda: document.documentElement.scrollWidth > innerWidth,
      };
    });
    ok(m.alta >= 64 && m.fondo === 0 && new Set(m.larghe).size === 1 && m.etichette && m.caratteri >= 11 && !m.sborda, `barra ${w}px: alta ${m.alta}px in fondo, voci larghe uguali (${m.larghe[0]}px), etichette intere da ${m.caratteri}px, niente sbordo`);
    ok(await nav.getByRole("link", { name: "Assistente" }).locator("svg").count() === 1, `barra ${w}px: l'Assistente ha la sua scintilla`);
    { const g = await bp.evaluate(() => { const l = document.querySelector("[data-testid=barra-esplora]"); const c = l.querySelector("span").getBoundingClientRect(); const n = document.querySelector("[data-testid=barra]").getBoundingClientRect(); const lr = l.getBoundingClientRect(); return { d: Math.round(c.width), tondo: getComputedStyle(l.querySelector("span")).borderRadius, centro: Math.abs((c.left + c.right) / 2 - (n.left + n.right) / 2), sporge: c.top < n.top, dentro: c.left >= lr.left - 0.5 && c.right <= lr.right + 0.5 }; });
      ok(g.d >= 44 && g.centro < 2 && !g.sporge && g.dentro, `barra ${w}px: la Mappa è al centro, tonda e più grande (${g.d}px), dentro la barra senza coprire le pagine`); }
    // Ogni voce porta alla pagina giusta ed è l'unica accesa.
    const attese = [
      ["Mappa", "/mappa", (u) => u.pathname === "/mappa" && !u.searchParams.get("vista")],
      ["Assistente", "/assistente", (u) => u.pathname === "/assistente"],
      ["Salvati", "/mappa?vista=salvati", (u) => u.pathname === "/mappa" && u.searchParams.get("vista") === "salvati"],
      ["Amici", "/amici", (u) => u.pathname === "/amici"],
      ["Profilo", "/profilo", (u) => u.pathname === "/profilo"],
    ];
    for (const [voce, href, giusta] of attese) {
      const link = nav.getByRole("link", { name: voce, exact: true });
      ok((await link.getAttribute("href")) === href, `barra ${w}px: '${voce}' porta a ${href}`);
      // In sviluppo il pallino "N" di Next può coprire la prima voce: si tocca il link direttamente.
      await link.evaluate((a) => a.click());
      await bp.waitForURL((u) => giusta(u), { timeout: 10000 }).catch(() => {});
      await bp.waitForLoadState("networkidle").catch(() => {});
      // La mappa sincronizza ?vista= con la vista appena pronta: si lascia il tempo di disegnarsi.
      await bp.waitForTimeout(voce === "Mappa" || voce === "Salvati" ? 2000 : 600);
      const u = new URL(bp.url());
      const accese = (await nav.locator("a[aria-current=page]").allTextContents()).map((t) => t.trim());
      ok(giusta(u) && accese.length === 1 && accese[0] === voce, `barra ${w}px: tocco su '${voce}' → ${u.pathname}${u.search}, accesa solo '${voce}' (${accese.join(",")})`);
      // Il contenuto della pagina non finisce sotto la barra (pagine a scorrimento: spazio in fondo uguale alla barra).
      if (voce === "Amici" || voce === "Profilo") {
        const sotto = await bp.evaluate(async () => {
          scrollTo(0, document.documentElement.scrollHeight);
          await new Promise((r) => setTimeout(r, 150));
          const navTop = document.querySelector("[data-testid=barra]").getBoundingClientRect().top;
          const els = [...document.querySelectorAll("body > div a, body > div button, body > div p, body > div h1, body > div h2")].filter((e) => e.offsetParent && !e.closest("nav"));
          return Math.max(...els.map((e) => e.getBoundingClientRect().bottom)) - navTop;
        });
        ok(sotto <= 1, `barra ${w}px: su ${voce} l'ultimo contenuto resta sopra la barra (${Math.round(sotto)}px)`);
        // Lorenzo 16/10: scorrendo, la barra resta attaccata al fondo dello schermo.
        { const y = await bp.evaluate(async () => { scrollTo(0, 300); await new Promise((r) => setTimeout(r, 150)); const r = document.querySelector("[data-testid=barra]").getBoundingClientRect(); return Math.round(innerHeight - r.bottom); });
          ok(y === 0, `barra ${w}px: su ${voce}, scorrendo, la barra resta in fondo (${y}px dal fondo)`); }
      }
      if (w === 390) await bp.screenshot({ path: `${OUT}/90-barra-${voce.toLowerCase()}.png`, caret: "initial" });
    }
    if (w === 390) {
      // Profilo da collegato: in fondo feedback ed Esci (prima erano nella barra).
      await bp.goto(`${BASE}/profilo`, { waitUntil: "networkidle" });
      const acc = bp.getByTestId("profilo-account");
      ok(await acc.getByRole("link", { name: /Dai un feedback/ }).isVisible() && await acc.getByRole("button", { name: "Esci" }).isVisible(), "profilo da collegato: in fondo 'Dai un feedback' ed 'Esci'");
      // Pagine che nascono dai salvati, profili delle persone e home: accese le voci giuste.
      for (const [path, voce] of [["/raccolte/Prova", "Salvati"], ["/u/nessuno", "Amici"], ["/", "Mappa"]]) {
        await bp.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
        const accese = (await nav.locator("a[aria-current=page]").allTextContents()).map((t) => t.trim());
        ok(accese.length === 1 && accese[0] === voce, `barra: su ${path} è accesa '${voce}' (${accese.join(",")})`);
      }
    }
    await bctx.close();
  }
  // Da non collegati: "Entra" al posto di Profilo, con ritorno alla pagina; Amici e Profilo mostrano un invito, non un errore.
  const gctx = await browser.newContext({ viewport: { width: 360, height: 740 } });
  await gctx.route("**/api/events", (r) => r.fulfill({ status: 204, body: "" }));
  await gctx.route("**/events.mapbox.com/**", (r) => r.fulfill({ status: 204, body: "" }));
  await gctx.addCookies([{ name: "e2e_anonimo", value: "1", url: BASE }]);
  const gp = await gctx.newPage();
  gp.on("pageerror", (e) => errors.push(e.message));
  await gp.addInitScript(() => { try { localStorage.setItem("mapetite.intro", "visto"); } catch {} });
  await gp.goto(`${BASE}/amici`, { waitUntil: "networkidle" });
  const gnav = gp.getByTestId("barra");
  const accesa = async () => (await gnav.locator("a[aria-current=page]").allTextContents()).map((t) => t.trim()).join(",");
  const gnomi = (await gnav.getByRole("link").allTextContents()).map((t) => t.trim());
  ok(JSON.stringify(gnomi) === JSON.stringify(["Assistente", "Salvati", "Mappa", "Amici", "Entra"]), `barra da non collegati: ultima voce 'Entra' (${gnomi.join(", ")})`);
  ok(await gnav.getByRole("link", { name: "Entra" }).getAttribute("href") === "/login?next=%2Famici", "barra da non collegati: 'Entra' da Amici riporta ad Amici");
  ok(await gp.getByTestId("amici-accedi").isVisible() && (await accesa()) === "Amici", "Amici da non collegati: invito ad accedere, voce accesa");
  await gnav.getByRole("link", { name: "Entra" }).click();
  await gp.waitForURL(/\/login/, { timeout: 8000 }).catch(() => {});
  await gp.waitForTimeout(300);
  ok(new URL(gp.url()).pathname === "/login" && (await accesa()) === "Entra", `barra da non collegati: 'Entra' apre l'accesso ed è accesa (${await accesa()})`);
  await gp.goto(`${BASE}/profilo`, { waitUntil: "networkidle" });
  ok(await gp.getByRole("link", { name: "Accedi" }).isVisible() && (await accesa()) === "Entra", "Profilo da non collegati: invito ad accedere, accesa 'Entra'");
  await gp.screenshot({ path: `${OUT}/91-barra-ospite-profilo.png`, caret: "initial" });
  await gctx.close();
}

// 16. Diario dei posti provati (piano 4.4): pagina per mese, foglio "Com'è andata?", senza migrazione.
{
  let dl = null;
  try { dl = await import(new URL("../../src/lib/diario.ts", import.meta.url).href); } catch (e) { ok(false, `diario: modulo importabile (${e.message})`); }
  if (dl) {
    const g = dl.groupByMonth([{ date: "2026-10-02", savedAt: "a" }, { date: "2026-09-30", savedAt: "b" }, { date: null, savedAt: "c" }, { date: "2026-10-12", savedAt: "d" }]);
    ok(g.map((x) => x.label).join("|") === "Ottobre 2026|Settembre 2026|Senza data" && g[0].items.map((i) => i.date).join() === "2026-10-12,2026-10-02", `diario: per mese dal più recente, senza data in fondo (${g.map((x) => x.label).join("|")})`);
    ok(JSON.stringify(dl.withVoto(["Con amici", "Già visitato", "Mi è piaciuto"], "giu")) === '["Con amici","Già visitato","Non fa per me"]' && JSON.stringify(dl.withVoto(["Già visitato", "Non fa per me"], null)) === '["Già visitato"]', "diario: il voto è il 'Com'era?' (👍/👎 si escludono, gli altri tag restano)");
    ok(dl.cleanDate("2026-02-30") === null && dl.cleanDate("2026-10-12T00:00:00") === "2026-10-12" && dl.cleanDate(42) === null, "diario: solo date vere");
    const now = new Date(2026, 9, 15, 0, 30);
    ok(dl.dayKey(now) === "2026-10-15" && dl.dateLabel("2026-10-14", now) === "ieri" && dl.whenLabel("2026-10-03", now) === "il 3 ottobre" && dl.dateLabel("2025-12-31", now) === "31 dicembre 2025", "diario: date in italiano, 'oggi' è il giorno del telefono anche dopo mezzanotte");
    ok(dl.isMissingVisitedAt({ code: "42703", message: "column saved_places.visited_at does not exist" }) && dl.isMissingVisitedAt({ code: "PGRST204", message: "Could not find the 'visited_at' column" }) && !dl.isMissingVisitedAt({ code: "PGRST116", message: "x" }), "diario: riconosce la colonna mancante (migrazione non applicata)");
  }

  if (!fakeUser) console.log("SKIP  diario: dev server senza E2E_FAKE_USER");
  else {
    const pid = (n) => `00000000-0000-4000-8000-0000000008${n}`;
    const ROMA = "Via del Pigneto, 10, 00176 Roma RM, Italy";
    const MILANO = "Alzaia Naviglio Grande, 4, 20144 Milano MI, Italy";
    const pl = (n, name, category, address, lat, lng) => ({ id: pid(n), name, category, address, lat, lng });
    const twoWeeksAgo = new Date(Date.now() - 15 * 86_400_000).toISOString();
    const profilo = {
      email: "giulia@example.com",
      saved: [
        { created_at: "2026-10-12T20:00:00Z", visited_at: "2026-10-12", visite: 3, tags: ["Con amici", "Già visitato", "Mi è piaciuto"], note: "Carbonara da rifare, chiedere il tavolo fuori", places: pl("01", "Osteria Due", "restaurant", ROMA, 41.89, 12.53) },
        { created_at: "2026-10-03T20:00:00Z", visited_at: "2026-10-03", visite: 2, tags: ["Già visitato"], note: null, places: pl("02", "Bar Sette", "cocktail_bar", MILANO, 45.45, 9.17) },
        { created_at: "2026-09-20T20:00:00Z", visited_at: "2026-09-20", tags: ["Già visitato", "Non fa per me"], note: null, places: pl("03", "Trattoria Tre", "restaurant", ROMA, 41.9, 12.5) },
        { created_at: "2026-09-10T20:00:00Z", visited_at: null, tags: ["Già visitato"], note: null, places: pl("04", "Enoteca Quattro", "wine_bar", ROMA, 41.893, 12.47) },
        { created_at: "2026-08-01T20:00:00Z", visited_at: "2026-08-01", tags: ["Già visitato"], note: "Lunghissima nota senza spazi per vedere se esce dallo schermo:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", places: pl("05", "Antica Trattoria del Ponte Vecchio sul Naviglio Grande", "italian_restaurant", MILANO, 45.451, 9.171) },
        { created_at: twoWeeksAgo, tags: ["Da provare"], note: "Me l'ha detto Marco", places: pl("06", "Forno Sei", "bakery", ROMA, 41.88, 12.48) },
      ],
      reviews: [],
    };
    const setProfilo = (c, v) => c.addCookies([{ name: "e2e_profilo", value: encodeURIComponent(JSON.stringify(v)), url: BASE }]);
    const dctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    const dEvents = [];
    await dctx.route("**/api/events", (r) => { dEvents.push(r.request().postDataJSON()); return r.fulfill({ status: 204, body: "" }); });
    await dctx.route("**/api/places/photo**", (r) => r.fulfill({ status: 429, json: {} }));
    await dctx.route("**/rest/v1/place_synthesis**", (r) => r.fulfill({ json: [] }));
    await dctx.route("**/rest/v1/profiles**", (r) => r.fulfill({ json: [] }));
    await dctx.route("**/rest/v1/reviews**", (r) => r.fulfill({ json: [] }));
    let dPatches = [];
    let visitedMissing = false;
    // Salvati per la mappa (scheda): la lista con i luoghi, gli id, la data della visita.
    const mapRows = profilo.saved.map((x) => ({ tags: x.tags, note: x.note, places: { ...x.places, google_place_id: null } }));
    await dctx.route("**/rest/v1/saved_places**", (r) => {
      const req = r.request();
      const u = new URL(req.url());
      const url = decodeURIComponent(req.url());
      if (req.method() === "PATCH") {
        const body = req.postDataJSON();
        if (visitedMissing && body && "visited_at" in body) return r.fulfill({ status: 400, json: { code: "PGRST204", message: "Could not find the 'visited_at' column of 'saved_places' in the schema cache" } });
        dPatches.push({ id: u.searchParams.get("place_id")?.replace(/^eq\./, ""), user: u.searchParams.get("user_id"), body });
        return r.fulfill({ status: 204, body: "" });
      }
      if (url.includes("visited_at")) return visitedMissing ? r.fulfill({ status: 400, json: { code: "42703", message: "column saved_places.visited_at does not exist" } }) : r.fulfill({ json: { visited_at: null } });
      if (url.includes("rank_score")) return r.fulfill({ json: [] });
      if (url.includes("select=place_id")) return r.fulfill({ json: mapRows.map((x) => ({ place_id: x.places.id })) });
      if (u.searchParams.get("place_id")) { const row = profilo.saved.find((x) => x.places.id === u.searchParams.get("place_id").replace(/^eq\./, "")); return r.fulfill({ json: { tags: row?.tags ?? [] } }); }
      return r.fulfill({ json: mapRows });
    });
    await setProfilo(dctx, profilo);
    const d = await dctx.newPage();
    d.on("pageerror", (e) => errors.push(e.message));
    await d.addInitScript(() => { try { localStorage.setItem("mapetite.intro", "visto"); } catch {} });

    // Ingresso dal profilo
    await d.goto(`${BASE}/profilo?beta=-ci-sei-stato`, { waitUntil: "networkidle" });
    const card = d.getByTestId("profilo-diario");
    // "I tuoi posti fissi" (PROPOSTE 8): 2+ visite, dal più frequentato, con "Proponi"
    { const pf = d.getByTestId("posti-fissi");
      const nomiPf = (await pf.getByTestId("posto-fisso").allTextContents().catch(() => [])).join("|");
      ok(await pf.isVisible().catch(() => false) && /Osteria Due.*3 volte\|.*Bar Sette.*2 volte$/.test(nomiPf) && (await pf.getByTestId("posto-fisso").first().getAttribute("href")) === `/mappa?salvato=${pid("01")}`, `posti fissi: nel profilo Osteria (3 volte) e Bar (2 volte), toccabili (${nomiPf})`);
      ok((await pf.getByTestId("posti-fissi-condividi").count()) === 0, "posti fissi: senza profilo pubblico niente 'Proponi' (il link non porterebbe ai posti)");
      await pf.scrollIntoViewIfNeeded().catch(() => {});
      await d.screenshot({ path: `${OUT}/49b-posti-fissi.png`, caret: "initial" }); }
    ok(await card.isVisible() && (await card.getAttribute("href")) === "/profilo/diario" && (await card.textContent()).includes("5 provati"), "diario: nel profilo la tessera 'Diario' con il numero dei posti provati");
    await card.click();
    await d.waitForURL(/\/profilo\/diario/, { timeout: 8000 }).catch(() => {});
    await d.getByTestId("diario-mese").first().waitFor({ timeout: 8000 }).catch(() => {});

    // Pagina: mesi dal più recente, voto, nota, link alla scheda
    const mesi = (await d.getByTestId("diario-mese").locator("h2 > span:first-child").allTextContents()).join("|");
    ok(mesi === "Ottobre 2026|Settembre 2026|Agosto 2026|Senza data", `diario: posti raggruppati per mese, dal più recente (${mesi})`);
    const nomi = (await d.getByTestId("diario-locale").allTextContents()).map((t) => t.split(" ")[0]).join(",");
    ok(nomi === "Osteria,Bar,Trattoria,Antica,Enoteca", `diario: in ordine di data, i senza data in fondo (${nomi})`);
    ok((await d.getByTestId("diario-riepilogo").textContent()).includes("5 posti provati · 1 ti è piaciuto"), "diario: riepilogo in cima (posti provati e quanti sono piaciuti)");
    const prima = d.getByTestId("diario-voce").first();
    ok((await prima.getByTestId("diario-voto-badge").textContent()).includes("Mi è piaciuto") && (await prima.getByTestId("diario-nota-testo").textContent()).includes("Carbonara da rifare") && (await prima.textContent()).includes("12") && (await prima.textContent()).includes("Roma"), "diario: ogni voce con giorno, emoji, città, voto e nota privata");
    ok((await prima.getByTestId("diario-locale").getAttribute("href")) === `/mappa?salvato=${pid("01")}`, "diario: il nome apre la scheda del locale");
    ok(!(await d.locator("body").innerText()).includes("Forno Sei"), `diario: i 'Voglio andarci' non ci sono`);
    ok(await d.getByRole("button", { name: "+ Aggiungi la data" }).isVisible(), "diario: chi non ha la data ha '+ Aggiungi la data'");
    { const w = await d.evaluate(() => document.documentElement.scrollWidth); ok(w <= 390, `diario: niente scorrimento orizzontale a 390px (${w})`); }
    await d.screenshot({ path: `${OUT}/50-diario.png`, caret: "initial" });

    // Modifica: data, voto e nota in un PATCH solo; la voce cambia mese subito
    await d.getByTestId("diario-voce").filter({ hasText: "Bar Sette" }).getByTestId("diario-modifica").click();
    const f = d.getByTestId("diario-foglio");
    await f.waitFor({ timeout: 4000 }).catch(() => {});
    ok(await f.isVisible() && (await f.getByRole("button", { name: /3 ottobre/ }).getAttribute("aria-pressed")) === "true", "diario: 'Modifica' apre il foglio con la data della visita già scelta");
    await f.getByTestId("diario-data").fill("2026-09-28");
    await f.getByRole("button", { name: "👍 Mi è piaciuto" }).click();
    await f.getByTestId("diario-nota").fill("Negroni ottimo, bancone");
    await d.screenshot({ path: `${OUT}/51-diario-foglio.png`, caret: "initial" });
    await f.getByTestId("diario-salva").click();
    await f.waitFor({ state: "detached", timeout: 4000 }).catch(() => {});
    const pb = dPatches.find((x) => x.id === pid("02"))?.body;
    ok(dPatches.length === 1 && pb?.visited_at === "2026-09-28" && JSON.stringify(pb?.tags) === '["Già visitato","Mi è piaciuto"]' && pb?.note === "Negroni ottimo, bancone" && dPatches[0].user === "eq.00000000-0000-0000-0000-000000000001", `diario: salva data, voto e nota del locale giusto (${JSON.stringify(dPatches)})`);
    const settembre = d.getByTestId("diario-mese").filter({ hasText: "Settembre 2026" });
    ok((await settembre.getByTestId("diario-locale").allTextContents()).join(",") === "Bar Sette,Trattoria Tre" && (await d.getByTestId("diario-riepilogo").textContent()).includes("2 ti sono piaciuti"), "diario: la voce passa subito a settembre, col voto nuovo");
    ok(dEvents.some((e) => e.type === "funzione" && e.props?.nome === "diario" && e.props?.fonte === "diario" && e.props?.voto === "su"), "diario: modifica registrata (funzione 'diario', solo chiavi ammesse)");
    dPatches = [];
    // Annulla non scrive niente
    await d.getByTestId("diario-voce").filter({ hasText: "Enoteca Quattro" }).getByTestId("diario-modifica").click();
    await d.getByTestId("diario-salta").click();
    ok(dPatches.length === 0 && (await d.getByTestId("diario-foglio").count()) === 0, "diario: 'Annulla' chiude senza scrivere");

    // 360px
    await d.setViewportSize({ width: 360, height: 780 });
    await d.reload({ waitUntil: "networkidle" });
    { const w = await d.evaluate(() => document.documentElement.scrollWidth); ok(w <= 360, `diario: niente scorrimento orizzontale a 360px (${w})`); }
    await d.screenshot({ path: `${OUT}/52-diario-360.png`, caret: "initial" });
    await d.getByTestId("diario-voce").first().getByTestId("diario-modifica").click();
    { const w = await d.evaluate(() => document.documentElement.scrollWidth); const box = await d.getByTestId("diario-foglio").boundingBox(); ok(w <= 360 && box && box.x >= 0 && box.x + box.width <= 360, `diario: il foglio sta nello schermo a 360px (${w})`); }
    await d.screenshot({ path: `${OUT}/52b-diario-foglio-360.png`, caret: "initial" });
    await d.keyboard.press("Escape");
    await d.setViewportSize({ width: 390, height: 844 });

    // Diario vuoto
    await setProfilo(dctx, { ...profilo, saved: profilo.saved.filter((x) => !x.tags.includes("Già visitato")) });
    await d.goto(`${BASE}/profilo/diario`, { waitUntil: "networkidle" });
    ok(await d.getByTestId("diario-vuoto").isVisible() && await d.getByRole("link", { name: "Apri i tuoi salvati" }).isVisible(), "diario vuoto: spiega come si riempie e porta ai salvati");
    await d.screenshot({ path: `${OUT}/53-diario-vuoto.png`, caret: "initial" });

    // Senza migrazione (colonna visited_at assente): niente date, voto e nota si salvano lo stesso
    await setProfilo(dctx, { ...profilo, diario: false });
    await d.goto(`${BASE}/profilo/diario`, { waitUntil: "networkidle" });
    ok((await d.getByTestId("diario-mese").count()) === 1 && (await d.getByTestId("diario-mese").textContent()).includes("I tuoi posti provati") && (await d.getByTestId("diario-voce").count()) === 5 && !(await d.locator("body").innerText()).includes("Ottobre 2026"), "diario senza migrazione: un elenco solo, nessuna data inventata");
    dPatches = [];
    await d.getByTestId("diario-voce").first().getByTestId("diario-modifica").click();
    ok((await d.getByTestId("diario-quando").count()) === 0, "diario senza migrazione: il foglio non chiede la data");
    await d.getByTestId("diario-nota").fill("Solo nota");
    await d.getByTestId("diario-salva").click();
    await d.getByTestId("diario-foglio").waitFor({ state: "detached", timeout: 4000 }).catch(() => {});
    ok(dPatches.length === 1 && dPatches[0].body?.note === "Solo nota" && !("visited_at" in (dPatches[0].body ?? {})), `diario senza migrazione: la nota si salva, senza data (${JSON.stringify(dPatches)})`);
    await setProfilo(dctx, profilo);

    // "Ci sei stato?" nel profilo: dopo "Sì" il foglio, la nota esistente resta se non la tocchi
    dPatches = [];
    await d.goto(`${BASE}/profilo?beta=ci-sei-stato`, { waitUntil: "networkidle" });
    const box = d.getByTestId("ci-sei-stato");
    await box.waitFor({ timeout: 5000 }).catch(() => {});
    await box.getByRole("button", { name: "✓ Sì, ci sono stato" }).click();
    await d.getByTestId("diario-foglio").waitFor({ timeout: 4000 }).catch(() => {});
    ok(await d.getByTestId("diario-foglio").isVisible() && (await d.getByTestId("diario-foglio").getByRole("button", { name: "Oggi" }).getAttribute("aria-pressed")) === "true" && (await d.getByTestId("diario-nota").inputValue()) === "Me l'ha detto Marco", "ci sei stato → diario: foglio con oggi già scelto e la nota che avevi");
    await d.getByTestId("diario-foglio").getByRole("button", { name: "Ieri" }).click();
    await d.getByTestId("diario-foglio").getByRole("button", { name: "👎 Non fa per me" }).click();
    await d.getByTestId("diario-salva").click();
    await d.getByTestId("diario-foglio").waitFor({ state: "detached", timeout: 4000 }).catch(() => {});
    const ieri = (() => { const t = new Date(); const y = new Date(t.getFullYear(), t.getMonth(), t.getDate() - 1); return `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, "0")}-${String(y.getDate()).padStart(2, "0")}`; })();
    const last = dPatches[dPatches.length - 1]?.body;
    ok(dPatches.length === 2 && JSON.stringify(dPatches[0].body?.tags) === '["Già visitato"]' && last?.visited_at === ieri && JSON.stringify(last?.tags) === '["Già visitato","Non fa per me"]' && !("note" in last), `ci sei stato → diario: data di ieri e 👎, la nota non viene toccata (${JSON.stringify(dPatches)})`);

    // Nella scheda della mappa: "Ci sono stato" → foglio → data di oggi e 👍 (passando dalla mappa)
    dPatches = [];
    await d.goto(`${BASE}/mappa?salvato=${pid("06")}`, { waitUntil: "networkidle" });
    await d.getByTestId("stato-salvato").waitFor({ timeout: 8000 }).catch(() => {});
    await d.getByTestId("stato-salvato").getByRole("button", { name: "✓ Ci sono stato" }).click();
    const fs = d.getByTestId("diario-foglio");
    await fs.waitFor({ timeout: 5000 }).catch(() => {});
    ok(await fs.isVisible() && (await fs.getByRole("button", { name: "Oggi" }).getAttribute("aria-pressed")) === "true" && await fs.getByTestId("diario-scrivi-nota").isVisible(), "scheda → diario: dopo 'Ci sono stato' il foglio con oggi già scelto (la nota dal foglio 'Modifica' della scheda)");
    await d.screenshot({ path: `${OUT}/54-scheda-diario-foglio.png`, caret: "initial" });
    await fs.getByRole("button", { name: "👍 Mi è piaciuto" }).click();
    await fs.getByTestId("diario-salva").click();
    await fs.waitFor({ state: "detached", timeout: 4000 }).catch(() => {});
    await d.waitForTimeout(600);
    const oggi = (() => { const t = new Date(); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`; })();
    const dateP = dPatches.find((x) => x.body && "visited_at" in x.body);
    const likeP = dPatches.filter((x) => x.body?.tags).pop();
    ok(dateP?.body.visited_at === oggi && dateP.id === pid("06") && likeP?.body.tags.includes("Mi è piaciuto") && likeP.body.tags.includes("Già visitato"), `scheda → diario: data di oggi e 👍 salvati (${JSON.stringify(dPatches)})`);
    ok((await d.getByTestId("diario-scheda-data").textContent()).includes("Ci sei stato oggi") && (await d.getByTestId("com-era").getByRole("button", { name: "👍 Mi è piaciuto" }).getAttribute("aria-pressed")) === "true", "scheda → diario: la scheda mostra 'Ci sei stato oggi' e il 👍");
    ok((await d.getByTestId("diario-scheda-link").getAttribute("href")) === "/profilo/diario", "scheda → diario: link 'Il tuo diario'");
    await d.getByTestId("diario-scheda").evaluate((el) => el.scrollIntoView({ block: "center" })).catch(() => {});
    await d.screenshot({ path: `${OUT}/55-scheda-diario.png`, caret: "initial" });
    ok(dEvents.some((e) => e.type === "funzione" && e.props?.nome === "diario" && e.props?.fonte === "scheda"), "scheda → diario: registrato (fonte 'scheda')");
    // Salta: chiude senza scrivere la data
    dPatches = [];
    await d.goto(`${BASE}/mappa?salvato=${pid("06")}`, { waitUntil: "networkidle" });
    await d.getByTestId("stato-salvato").waitFor({ timeout: 8000 }).catch(() => {});
    await d.getByTestId("stato-salvato").getByRole("button", { name: "✓ Ci sono stato" }).click();
    await d.getByTestId("diario-salta").click({ timeout: 5000 }).catch(() => {});
    await d.waitForTimeout(500);
    ok((await d.getByTestId("diario-foglio").count()) === 0 && !dPatches.some((x) => x.body && "visited_at" in x.body), "scheda → diario: 'Salta' chiude e non scrive la data");
    // "↻ Ci sono tornato" (PROPOSTE.md 8): seconda visita con la data di oggi, titolo "2ª volta", poi "· 2 volte"
    dPatches = [];
    await d.getByTestId("diario-scheda-tornato").click({ timeout: 5000 }).catch(() => {});
    await d.getByTestId("diario-foglio").waitFor({ timeout: 4000 }).catch(() => {});
    ok((await d.getByTestId("diario-foglio").textContent().catch(() => "")).includes("Ci sei tornato · 2ª volta"), "posti fissi: 'Ci sono tornato' apre il foglio '↻ Ci sei tornato · 2ª volta'");
    await d.getByTestId("diario-salta").click({ timeout: 5000 }).catch(() => {});
    await d.waitForTimeout(400);
    ok(!dPatches.some((x) => x.body && "visite" in x.body), `posti fissi: 'Salta' non conta la visita (${JSON.stringify(dPatches)})`);
    await d.getByTestId("diario-scheda-tornato").click({ timeout: 5000 }).catch(() => {});
    await d.getByTestId("diario-salva").click({ timeout: 5000 }).catch(() => {});
    await d.getByTestId("diario-foglio").waitFor({ state: "detached", timeout: 4000 }).catch(() => {});
    await d.waitForTimeout(400);
    { const tp = dPatches.find((x) => x.body && "visite" in x.body); ok(tp?.body.visite === 2 && tp.body.visited_at === oggi && tp.id === pid("06"), `posti fissi: salvando il foglio si contano 2 visite con la data di oggi (${JSON.stringify(dPatches)})`); }
    ok((await d.getByTestId("diario-scheda-tornato").count()) === 0, "posti fissi: dopo la visita di oggi niente '↻ Ci sono tornato' (due tocchi non fanno due visite)");
    ok((await d.getByTestId("diario-scheda-volte").textContent().catch(() => "")).includes("2 volte"), "posti fissi: la scheda dice '· 2 volte'");
    await d.getByTestId("diario-scheda").evaluate((el) => el.scrollIntoView({ block: "center" })).catch(() => {});
    await d.screenshot({ path: `${OUT}/55b-scheda-tornato.png`, caret: "initial" });
    // Senza migrazione: la scheda non mostra la riga della data e non si rompe
    visitedMissing = true;
    await d.goto(`${BASE}/mappa?salvato=${pid("01")}`, { waitUntil: "networkidle" });
    await d.getByTestId("com-era").waitFor({ timeout: 8000 }).catch(() => {});
    await d.getByTestId("diario-scheda").waitFor({ timeout: 5000 }).catch(() => {});
    ok(await d.getByTestId("diario-scheda-link").isVisible() && (await d.getByTestId("diario-scheda-data").count()) === 0, "scheda senza migrazione: solo il link al diario, niente data");
    visitedMissing = false;
    await dctx.close();
  }
}

// 17. Da computer (piano 6.5): a 1280x800 mappa grande a sinistra e pannello a destra con ricerca,
//     lista delle card e scheda del locale. Ricerca e verdetti simulati (stessi finti del giro): niente Google.
//     Sul telefono il pannello non esiste: si controlla anche che a 390px resti tutto come prima.
{
  const dctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await dctx.route("**/api/events", (r) => r.fulfill({ status: 204, body: "" }));
  await dctx.route("**/api/search/intent", (r) => r.fulfill({ status: 204, body: "" }));
  await dctx.route("**/api/places/photo**", (r) => r.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="#c96"/></svg>' }));
  await dctx.route("**/rest/v1/saved_places**", (r) => r.fulfill({ json: [] }));
  await dctx.route("**/rest/v1/place_synthesis**", (r) => r.fulfill({ json: [] }));
  await dctx.route("**/rest/v1/profiles**", (r) => r.fulfill({ json: [] }));
  await dctx.route("**/api/search", (r) => r.fulfill({ json: SEARCH_FAST }));
  await dctx.route("**/api/search/synthesis", (r) => r.fulfill({ json: SYNTH }));
  const dp = await dctx.newPage();
  dp.on("pageerror", (e) => errors.push(e.message));
  await dp.addInitScript(() => { try { localStorage.setItem("mapetite.intro", "visto"); } catch { /* ignorato */ } });
  const scrollX = () => dp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  await dp.goto(`${BASE}/mappa`, { waitUntil: "networkidle" });
  const mappa = await dp.locator(".mapboxgl-map").boundingBox();
  const pannello = await dp.getByTestId("pannello-ricerca").boundingBox();
  ok(!!mappa && !!pannello && mappa.width >= 760 && Math.round(mappa.x + mappa.width) <= Math.round(pannello.x) && pannello.width >= 380 && pannello.x + pannello.width >= 1279,
    `computer: mappa a sinistra (larga ${Math.round(mappa?.width ?? 0)}px) e pannello a destra (da x ${Math.round(pannello?.x ?? 0)})`);
  ok(await dp.getByTestId("pannello-intro").isVisible() && await dp.getByLabel("Cosa cerchi?").isVisible(), "computer: pannello con titolo 'Dove andiamo?' e barra di ricerca in alto");
  { const b = await dp.getByTestId("barra-ricerca").boundingBox(); ok(!!b && !!pannello && b.x >= pannello.x && b.y < 200, `computer: barra di ricerca dentro il pannello, in alto (x ${Math.round(b?.x ?? 0)}, y ${Math.round(b?.y ?? 0)})`); }
  ok((await scrollX()) <= 0, `computer: nessuno scroll orizzontale a mappa vuota (${await scrollX()}px)`);
  await dp.screenshot({ path: `${OUT}/95-computer-mappa.png`, caret: "initial" });

  // Ricerca: le card sono una lista verticale nel pannello, accanto alla mappa (non sopra).
  await (await esempio(dp)).click();
  await dp.getByTestId("card-risultato").first().waitFor({ timeout: 8000 });
  await dp.getByTestId("etichetta-verdetto").first().waitFor({ timeout: 5000 }).catch(() => {});
  const cards = dp.getByTestId("card-risultato");
  const c1 = await cards.nth(0).boundingBox();
  const c2 = await cards.nth(1).boundingBox();
  const mappa2 = await dp.locator(".mapboxgl-map").boundingBox();
  ok((await cards.count()) >= 2 && !!c1 && !!c2 && !!mappa2 && c1.x >= mappa2.x + mappa2.width && c2.y > c1.y + c1.height - 1 && Math.abs(c2.x - c1.x) < 2 && c2.y < 800,
    `computer: card in lista verticale nel pannello, due visibili (x ${Math.round(c1?.x ?? 0)}, y ${Math.round(c1?.y ?? 0)} e ${Math.round(c2?.y ?? 0)})`);
  ok(!!c1 && c1.width >= 340, `computer: card larghe quanto il pannello (${Math.round(c1?.width ?? 0)}px), non strette come sul telefono`);
  ok(await dp.getByTestId("barra-ricerca").isVisible() && (await dp.getByLabel("Cambia altezza pannello").count()) === 0, "computer: barra di ricerca sempre in alto, niente maniglia da trascinare");
  ok((await scrollX()) <= 0, `computer: nessuno scroll orizzontale con i risultati (${await scrollX()}px)`);
  // La lista scorre nel pannello, la pagina no.
  const lista = dp.getByTestId("lista-risultati");
  const scorre = await lista.evaluate((el) => { const prima = el.scrollTop; el.scrollTop = 400; const dopo = el.scrollTop; el.scrollTop = prima; return dopo > prima || el.scrollHeight <= el.clientHeight; });
  ok(scorre && await dp.evaluate(() => window.scrollY === 0), "computer: la lista scorre dentro il pannello, la pagina resta ferma");
  await dp.screenshot({ path: `${OUT}/96-computer-risultati.png`, caret: "initial" });

  // Mouse su una card: si accende il suo pin.
  // Si aspetta che la lista sia ferma (i verdetti la riordinano), poi si passa sulla card per id.
  await dp.waitForTimeout(1500);
  const idSecondo = await dp.locator("ul li[data-id]").nth(1).getAttribute("data-id");
  // Il tocco su "Idee" lascia il mouse dove ora c'è la lista: lo si porta fuori, poi sulla card.
  await dp.mouse.move(5, 400);
  await dp.locator(`ul li[data-id="${idSecondo}"]`).hover();
  await dp.waitForTimeout(300);
  const secondo = await dp.locator("[data-testid=pin][data-focused=true]").getAttribute("data-place").catch(() => null);
  ok(secondo === idSecondo, `computer: col mouse sulla seconda card si accende il suo pin (${secondo} = ${idSecondo})`);

  // Clic su una card: la scheda si apre nel pannello, la mappa resta visibile, nessun velo scuro.
  await cards.first().click();
  const scheda = dp.getByTestId("scheda-pannello");
  await scheda.waitFor({ timeout: 5000 });
  await dp.waitForTimeout(500);
  const sb = await scheda.boundingBox();
  const mappa3 = await dp.locator(".mapboxgl-map").boundingBox();
  const velo = await scheda.evaluate((el) => getComputedStyle(el).backgroundColor);
  ok(!!sb && !!mappa3 && sb.x >= mappa3.x + mappa3.width - 1 && sb.x + sb.width <= 1281 && mappa3.width >= 760 && !/rgba\(0, 0, 0/.test(velo),
    `computer: la scheda si apre nel pannello a destra, mappa visibile e niente velo (x ${Math.round(sb?.x ?? 0)}, sfondo ${velo})`);
  ok(await dp.getByRole("heading", { name: "Terrazza Uno" }).isVisible() && await dp.getByTestId("barra-azioni").isVisible(), "computer: scheda con nome del locale e barra azioni visibili");
  ok((await dp.getByTestId("card-risultato").count()) === 0 && await dp.getByTestId("barra-ricerca").isVisible(), "computer: la scheda prende il posto della lista, la barra di ricerca resta in alto");
  ok((await scrollX()) <= 0, `computer: nessuno scroll orizzontale con la scheda aperta (${await scrollX()}px)`);
  await dp.screenshot({ path: `${OUT}/97-computer-scheda.png`, caret: "initial" });
  // Chiudi: si torna alla lista.
  await scheda.getByRole("button", { name: "Chiudi" }).first().click();
  await dp.getByTestId("card-risultato").first().waitFor({ timeout: 5000 }).catch(() => {});
  ok((await dp.getByTestId("card-risultato").count()) >= 2, "computer: chiusa la scheda torna la lista dei risultati");
  // Clic su un pin: da computer apre subito la scheda (la lista è già a fianco).
  await dp.locator("[data-testid=pin][data-place=P3]").click();
  await dp.waitForTimeout(600);
  ok(await scheda.isVisible().catch(() => false) && await dp.getByRole("heading", { name: "Rooftop Tre" }).isVisible().catch(() => false), "computer: un clic sul pin apre subito la scheda nel pannello");
  await dctx.close();

  // Telefono: niente pannello (titolo nascosto, barra sopra la mappa come prima).
  const mctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await mctx.route("**/api/events", (r) => r.fulfill({ status: 204, body: "" }));
  const mp = await mctx.newPage();
  await mp.addInitScript(() => { try { localStorage.setItem("mapetite.intro", "visto"); } catch { /* ignorato */ } });
  await mp.goto(`${BASE}/mappa`, { waitUntil: "networkidle" });
  const pos = await mp.getByTestId("pannello-ricerca").evaluate((el) => getComputedStyle(el).position);
  const mm = await mp.locator(".mapboxgl-map").boundingBox();
  ok(pos === "absolute" && !(await mp.getByTestId("pannello-intro").isVisible()) && !!mm && mm.width === 390, `telefono: nessun pannello da computer (barra ${pos}, mappa larga ${Math.round(mm?.width ?? 0)}px)`);
  await mctx.close();
}

// Sorprendimi (piano 2.5): UN posto mai provato che probabilmente ti piace, con il perché.
// Una sola ricerca (simulata), "Un altro" senza nuove chiamate, mai salvati né locali di massa.
if (!fakeUser) console.log("SKIP  sorprendimi: dev server senza E2E_FAKE_USER");
else {
  const sm = (id, name, rating, n, extra = {}) => mk(id, name, 41.9 + Number(id.slice(1)) * 0.001, 12.49, { category: "Trattoria", rating, userRatingCount: n, types: ["restaurant"], ...extra });
  const SURP = [
    sm("S1", "Trattoria Di Massa", 4.3, 9000),
    sm("S2", "Osteria Già Salvata", 4.6, 300),
    sm("S3", "Trattoria Gemma", 4.7, 180),
    sm("S4", "Trattoria Buona", 4.4, 600, { editorialSummary: "Cucina romana di quartiere." }),
    sm("S5", "Trattoria Chiusa", 4.6, 120, { openNow: false }),
    sm("S6", "Trattoria Sei", 4.2, 900),
  ];
  const surpRows = [
    { tags: ["Mi è piaciuto", "Già visitato"], places: { category: "Trattoria", lat: 41.9, lng: 12.49, google_place_id: "GT1" } },
    { tags: ["Da provare"], places: { category: "Trattoria", lat: 41.91, lng: 12.48, google_place_id: "GT2" } },
    { tags: ["Da provare"], places: { category: "Trattoria", lat: 41.89, lng: 12.47, google_place_id: "S2" } },
    { tags: ["Non fa per me"], places: { category: "pizza_restaurant", lat: 41.9, lng: 12.5, google_place_id: "GT3" } },
  ];
  let surpSearches = 0, surpBody = null, surpSynth = [], surpAdd = null, surpInsert = null;
  const surpEvents = [];
  const sctxS = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await sctxS.route("**/rest/v1/saved_places**", (r) => {
    if (r.request().method() === "POST") { surpInsert = r.request().postDataJSON(); return r.fulfill({ status: 201, json: {} }); }
    return r.fulfill({ json: surpRows });
  });
  await sctxS.route("**/rest/v1/profiles**", (r) => r.fulfill({ json: [{ cuisines: ["pizza"], price_range: "€€" }] }));
  await sctxS.route("**/rest/v1/place_synthesis**", (r) => r.fulfill({ json: [{ place_id: "S3", verdict: "Carbonara seria e oste che consiglia bene." }] }));
  const surpPhotos = [];
  await sctxS.route("**/api/places/photo**", (r) => { surpPhotos.push(decodeURIComponent(new URL(r.request().url()).searchParams.get("ref") ?? "")); return r.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="#c96"/></svg>' }); });
  await sctxS.route("**/api/events", (r) => { surpEvents.push(r.request().postDataJSON()); return r.fulfill({ status: 204, body: "" }); });
  await sctxS.route("**/api/search", (r) => {
    surpSearches++; surpBody = r.request().postDataJSON();
    return r.fulfill({ json: { risultati: SURP, filtri_usati: { categoria: null, parole_chiave: [], vicino_a_me: false }, sintesi_pendente: { places: [], token: "x", gruppi: [{ places: SURP.slice(0, 3).map((x) => ({ id: x.id })), token: "g1" }, { places: SURP.slice(3).map((x) => ({ id: x.id })), token: "g2" }] } } });
  });
  await sctxS.route("**/api/search/synthesis", async (r) => {
    const b = r.request().postDataJSON(); surpSynth.push(b);
    await new Promise((res) => setTimeout(res, 700));
    const first = surpSynth.filter((x) => x.token === b.token).length === 1;
    return r.fulfill({ json: { dettagli: first ? { S5: { verdict: "Altro locale del gruppo." } } : { S4: { verdict: "Porzioni generose, servizio alla mano." } }, esclusi: [] } });
  });
  await sctxS.route("**/api/places/add", (r) => { surpAdd = r.request().postDataJSON(); return r.fulfill({ json: { place: { id: "00000000-0000-4000-8000-0000000005a4" } } }); });
  const sp = await sctxS.newPage();
  sp.on("pageerror", (e) => errors.push(e.message));
  // Ore 20:30: momento "cena" (la sorpresa dipende dall'ora: il controllo deve valere a qualsiasi ora del giro).
  await sp.clock.setFixedTime(new Date("2026-10-16T20:30:00"));
  await sp.addInitScript(() => { try { localStorage.setItem("mapetite.intro", "visto"); } catch { /* ignorato */ } });

  // Ingressi: home e mappa.
  await sp.goto(`${BASE}/`, { waitUntil: "networkidle" });
  ok(await sp.getByTestId("home-sorprendimi").isVisible() && (await sp.getByTestId("home-sorprendimi").getAttribute("href")) === "/sorprendimi?da=home", "sorprendimi: in home la card '🎲 Sorprendimi' porta a /sorprendimi");
  await sp.goto(`${BASE}/mappa`, { waitUntil: "networkidle" });
  const mapHref = await sp.getByTestId("mappa-sorprendimi").first().getAttribute("href").catch(() => null);
  ok(!!mapHref && /^\/sorprendimi\?da=mappa&lat=-?\d+\.\d{4}&lng=-?\d+\.\d{4}$/.test(mapHref), `sorprendimi: sulla mappa il pulsante porta la zona della mappa (${mapHref})`);
  ok(surpSearches === 0, "sorprendimi: aprire home e mappa non fa ricerche");

  await sp.goto(`${BASE}/sorprendimi?da=mappa&lat=41.9&lng=12.49`, { waitUntil: "networkidle" });
  const card = sp.getByTestId("sorpresa-card");
  await card.waitFor({ timeout: 8000 }).catch(() => {});
  ok(surpSearches === 1 && surpBody?.searchIntent === "structured" && surpBody?.phase === "fast" && surpBody?.source === "world" && surpBody?.query === "Trattoria" && surpBody?.lat === 41.9 && surpBody?.radius === 3000,
    `sorprendimi: UNA ricerca, con i filtri (senza AI), dal tipo che salvi di più e dalla zona della mappa (${JSON.stringify(surpBody)})`);
  ok(await sp.getByRole("heading", { name: "Trattoria Gemma" }).isVisible(), "sorprendimi: prima proposta il 💎 poco conosciuto aperto ora, non il più famoso");
  const why1 = await sp.getByTestId("sorpresa-perche").textContent().catch(() => "");
  ok(why1.includes("Ti è piaciuto un posto così (trattoria)") && why1.includes("💎 Poco conosciuto") && why1.includes("Aperto ora"), `sorprendimi: il perché è fatto di dati veri (${why1})`);
  ok((await sp.getByTestId("sorpresa-verdetto").textContent().catch(() => "")).includes("Carbonara seria"), "sorprendimi: verdetto Mapetite già scritto (cache) mostrato senza chiamate AI");
  ok(surpSynth.length === 0, "sorprendimi: con il verdetto già in cache nessuna richiesta di verdetti");
  ok((await sp.getByTestId("sorpresa-zona").textContent()).includes("Zona della mappa · Roma"), "sorprendimi: dice in che zona cerca");
  await sp.getByTestId("sorpresa-foto").locator("img").waitFor({ timeout: 4000 }).catch(() => {});
  ok(await sp.getByTestId("sorpresa-foto").locator("img").isVisible().catch(() => false) && surpPhotos.length === 1 && surpPhotos[0] === "places/S3/photos/AbC_S3",
    `sorprendimi: la foto della proposta visibile, una sola (${JSON.stringify(surpPhotos)})`);
  await sp.screenshot({ path: `${OUT}/sorprendimi-1.png`, caret: "initial" });

  // "Un altro": dagli stessi risultati, mai i salvati né i locali di massa; i chiusi in fondo.
  const seenNames = [await sp.getByTestId("sorpresa-card").getByRole("heading").textContent()];
  const hVerdict = (await sp.getByTestId("sorpresa-verdetto").boundingBox())?.height ?? 0;
  await sp.getByTestId("sorpresa-altro").click();
  await sp.getByRole("heading", { name: "Trattoria Buona" }).waitFor({ timeout: 3000 }).catch(() => {});
  const attesa = sp.getByTestId("sorpresa-verdetto-attesa");
  const hWait = (await attesa.boundingBox().catch(() => null))?.height ?? 0;
  ok(await attesa.isVisible().catch(() => false) && Math.abs(hWait - hVerdict) <= 2, `sorprendimi: mentre arriva il verdetto c'è il suo segnaposto, alto uguale (${Math.round(hWait)} vs ${Math.round(hVerdict)} px)`);
  await sp.getByTestId("sorpresa-verdetto").waitFor({ timeout: 6000 }).catch(() => {});
  ok(surpSynth.length === 2 && surpSynth.every((x) => x.token === "g2" && x.query === "Trattoria"), `sorprendimi: verdetto chiesto per il gruppo del locale MOSTRATO; saltato dall'AI, richiesto una seconda volta (${JSON.stringify(surpSynth.map((x) => x.token))})`);
  ok(surpPhotos.length === 2 && surpPhotos[1] === "places/S4/photos/AbC_S4", `sorprendimi: 'Un altro' scarica solo la foto della nuova proposta, nessun precaricamento (${surpPhotos.length} foto)`);
  ok((await sp.getByTestId("sorpresa-verdetto").textContent().catch(() => "")).includes("Porzioni generose"), "sorprendimi: il verdetto arriva anche per 'Un altro'");
  await sp.screenshot({ path: `${OUT}/sorprendimi-2-altro.png`, caret: "initial" });
  const headingNow = () => sp.getByTestId("sorpresa-card").getByRole("heading").textContent();
  seenNames.push(await headingNow());
  for (let i = 0; i < 6; i++) {
    await sp.getByTestId("sorpresa-altro").click();
    await sp.waitForTimeout(150);
    if (!(await sp.getByTestId("sorpresa-card").isVisible().catch(() => false))) break;
    seenNames.push(await headingNow());
  }
  ok(surpSearches === 1, `sorprendimi: 'Un altro' non fa nuove ricerche (${surpSearches})`);
  ok(!seenNames.includes("Trattoria Di Massa") && !seenNames.includes("Osteria Già Salvata"), `sorprendimi: mai un tuo salvato né un locale di massa (${seenNames.join(", ")})`);
  ok(seenNames[seenNames.length - 1] === "Trattoria Chiusa" && seenNames.length === 4, `sorprendimi: 4 proposte, il locale chiuso per ultimo (${seenNames.join(", ")})`);
  ok(await sp.getByTestId("sorpresa-finiti").isVisible(), "sorprendimi: finite le proposte lo dice, con 'Ricomincia'");
  await sp.getByRole("button", { name: "Ricomincia" }).click();
  ok(await sp.getByRole("heading", { name: "Trattoria Gemma" }).isVisible(), "sorprendimi: 'Ricomincia' riparte dalla prima, senza ricerche");

  // Freno alla quota: stessa zona e stesso momento entro 30 minuti = nessuna nuova ricerca.
  await sp.reload({ waitUntil: "networkidle" });
  await card.waitFor({ timeout: 8000 }).catch(() => {});
  ok(surpSearches === 1 && await card.isVisible(), `sorprendimi: riaperto entro 30 minuti nella stessa zona riusa la ricerca (${surpSearches} ricerche)`);

  // Salva: entra nei salvati come "Voglio andarci".
  await sp.getByTestId("sorpresa-salva").click();
  await sp.getByText("✓ Salvato").waitFor({ timeout: 4000 }).catch(() => {});
  ok(surpAdd?.googlePlaceId === "S3" && surpAdd?.firma === "firma-S3" && JSON.stringify(surpInsert?.tags) === '["Da provare"]' && await sp.getByText("✓ Salvato").isVisible(), "sorprendimi: 'Salva' lo mette tra i salvati come 'Voglio andarci'");

  // 360px: niente scroll orizzontale, azioni visibili.
  await sp.setViewportSize({ width: 360, height: 780 });
  const sx = await sp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  ok(sx <= 0 && await sp.getByTestId("sorpresa-apri").isVisible(), `sorprendimi 360px: nessuno scroll orizzontale (${sx}px)`);
  await sp.screenshot({ path: `${OUT}/sorprendimi-360.png`, caret: "initial" });
  await sp.setViewportSize({ width: 390, height: 844 });

  // Apri scheda: la scheda della mappa, dalla memoria (nessuna ricerca in più), con il verdetto.
  await sp.getByTestId("sorpresa-apri").click();
  await sp.waitForURL(/\/mappa/, { timeout: 8000 }).catch(() => {});
  await sp.getByRole("heading", { name: "Trattoria Gemma" }).first().waitFor({ timeout: 8000 }).catch(() => {});
  ok((await sp.getByText("Trattoria Gemma").filter({ visible: true }).count()) > 0 && surpSearches === 1, `sorprendimi: 'Apri scheda' apre la scheda del locale sulla mappa senza nuove ricerche (${sp.url().replace(BASE, "")})`);
  ok(await sp.getByText("Carbonara seria e oste che consiglia bene.").first().isVisible().catch(() => false), "sorprendimi: nella scheda c'è lo stesso verdetto");
  ok(!sp.url().includes("sorpresa="), "sorprendimi: tolto il parametro dall'indirizzo (ricaricare non riapre)");
  await sp.screenshot({ path: `${OUT}/sorprendimi-scheda.png`, caret: "initial" });

  const fe = surpEvents.filter((e) => e?.type === "funzione" && String(e.props?.nome ?? "").startsWith("sorpresa"));
  ok(fe.some((e) => e.props.nome === "sorpresa" && e.props.contesto === "google") && fe.some((e) => e.props.nome === "sorpresa" && e.props.contesto === "memoria") && fe.some((e) => e.props.nome === "sorpresa_altro") && fe.some((e) => e.props.nome === "sorpresa_salva") && fe.some((e) => e.props.nome === "sorpresa_apri"),
    `sorprendimi: tracciati apertura (google/memoria), 'Un altro', 'Salva', 'Apri scheda' (${fe.map((e) => e.props.nome + (e.props.contesto ? ":" + e.props.contesto : "")).join(", ")})`);
  ok(droppedKeys(surpEvents).length === 0, `sorprendimi: tutte le chiavi dei segnali sono accettate dal server (${droppedKeys(surpEvents).join(", ")})`);
  await sctxS.close();

  // Senza accesso: valgono il momento e la zona; per salvare si accede.
  const actxS = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await actxS.addCookies([{ name: "e2e_anonimo", value: "1", url: BASE }]);
  await actxS.route("**/api/events", (r) => r.fulfill({ status: 204, body: "" }));
  await actxS.route("**/api/places/photo**", (r) => r.fulfill({ status: 429, json: {} }));
  await actxS.route("**/rest/v1/place_synthesis**", (r) => r.fulfill({ json: [] }));
  let anonBody = null, anonSynth = 0;
  await actxS.route("**/api/search", (r) => { anonBody = r.request().postDataJSON(); return r.fulfill({ json: { risultati: SURP, filtri_usati: {}, sintesi_pendente: { places: [], token: "x", gruppi: [{ places: SURP.slice(0, 3).map((x) => ({ id: x.id })), token: "g1" }] } } }); });
  await actxS.route("**/api/search/synthesis", (r) => { anonSynth++; return r.fulfill({ json: { dettagli: {}, esclusi: [] } }); });
  const ap = await actxS.newPage();
  ap.on("pageerror", (e) => errors.push(e.message));
  await ap.clock.setFixedTime(new Date("2026-10-16T20:30:00"));
  await ap.goto(`${BASE}/sorprendimi?da=home`, { waitUntil: "networkidle" });
  await ap.getByTestId("sorpresa-card").waitFor({ timeout: 8000 }).catch(() => {});
  const whyA = await ap.getByTestId("sorpresa-perche").textContent().catch(() => "");
  ok(anonBody?.query === "ristorante cena" && anonBody?.radius === 11000 && whyA.includes("Adatto all'ora: cena"), `sorprendimi senza accesso: momento della giornata e tutta Roma (${anonBody?.query}, ${anonBody?.radius} m, "${whyA}")`);
  ok(await ap.getByTestId("sorpresa-accedi").isVisible() && (await ap.getByTestId("sorpresa-accedi").getAttribute("href")) === "/login?next=%2Fsorprendimi", "sorprendimi senza accesso: 'Accedi per salvarlo' e poi si torna qui");
  await ap.getByTestId("sorpresa-google").waitFor({ timeout: 5000 }).catch(() => {});
  const anonH = await ap.getByTestId("sorpresa-card").getByRole("heading").textContent().catch(() => null);
  const anonG = await ap.getByTestId("sorpresa-google").textContent().catch(() => "");
  ok(anonH === "Osteria Già Salvata" && anonSynth === 2 && (await ap.getByTestId("sorpresa-verdetto").count()) === 0 && anonG.includes("Dalle recensioni Google") && anonG.includes("Bella vista sulla città."),
    `sorprendimi senza accesso: nessun salvato da escludere; verdetto mai arrivato (2 richieste) → al suo posto una recensione Google vera, detta da dove viene (${anonH}, ${anonSynth} richieste, "${anonG}")`);
  await ap.screenshot({ path: `${OUT}/sorprendimi-anonimo.png`, caret: "initial" });
  await actxS.close();
}

// 11. Incolla più link (piano 3.2): chat di WhatsApp con tanti link → lista con lo stato di ciascuno →
//     "Salva gli N riconosciuti" in una raccolta. API simulata: nessuna chiamata Google.
if (fakeUser) {
  const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, permissions: ["clipboard-read", "clipboard-write"] });
  const mevents = [];
  await mctx.route("**/api/events", (r) => { mevents.push(r.request().postDataJSON()); return r.fulfill({ status: 204, body: "" }); });
  const SAVED_ID = "00000000-0000-4000-8000-0000000005a1";
  const minserts = [];
  await mctx.route("**/rest/v1/saved_places**", (r) => {
    const req = r.request();
    if (req.method() === "POST") { minserts.push(req.postDataJSON()); return r.fulfill({ status: 201, body: "" }); }
    return r.fulfill({ json: [{ place_id: SAVED_ID, tags: ["Da provare", "Weekend"] }] });
  });
  const previews = [];
  let inflight = 0, maxInflight = 0, spent = 0;
  await mctx.route("**/api/places/link-preview", async (r) => {
    const body = r.request().postDataJSON() ?? {};
    previews.push(body);
    inflight++; maxInflight = Math.max(maxInflight, inflight);
    await new Promise((res) => setTimeout(res, 120));
    inflight--;
    const id = (s) => `00000000-0000-4000-8000-${s.padStart(12, "0")}`;
    const link = String(body.link ?? "");
    const place = (k, name, address = "Via di Prova 1, Roma") => ({ id: id(k), name, address });
    let out;
    if (link.includes("AAA111") || link.includes("DUPA11")) out = { stato: "riconosciuto", chiamate: 0, place: place("a1", "Bar Rossi", "Via Roma 1, Roma, Italia") };
    else if (link.includes("SAVED9")) out = { stato: "riconosciuto", chiamate: 0, place: { id: SAVED_ID, name: "Osteria Già Mia", address: "Via dei Salvati 2, Roma" } };
    else if (link.includes("BBB222")) out = body.budget >= 1 ? { stato: "riconosciuto", chiamate: 1, place: place("b2", "Trattoria Due", "") } : { stato: "da_confermare", chiamate: 0, motivo: "Serve una ricerca su Google: toccalo per riconoscerlo.", nome: "Trattoria Due" };
    else if (link.includes("ERR")) out = { stato: "non_riconosciuto", chiamate: 0, motivo: "Il link non si apre: copialo di nuovo da Google Maps." };
    else {
      const n = link.match(/C(\d\d)/)?.[1] ?? "0";
      out = body.budget >= 1 ? { stato: "riconosciuto", chiamate: 1, place: place(`c${n}`, `Locale ${n}`) } : { stato: "da_confermare", chiamate: 0, motivo: "Serve una ricerca su Google: toccalo per riconoscerlo.", nome: `Locale ${n}` };
    }
    spent += out.chiamate;
    return r.fulfill({ json: out });
  });
  const mp = await mctx.newPage();
  mp.on("pageerror", (e) => errors.push(e.message));
  await mp.goto(`${BASE}/importa`, { waitUntil: "networkidle" });
  const mc = mp.getByTestId("importa-multi");
  ok((await mc.count()) === 0, "incolla più link: la lista compare solo dopo aver incollato");
  const yOf = async (id) => (await mp.getByTestId(id).boundingBox())?.y ?? -1;

  const chat = [
    "[15/10/26, 21:02:11] Lorenzo: Da provare! https://maps.app.goo.gl/AAA111",
    "[15/10/26, 21:03:40] Lorenzo: https://maps.app.goo.gl/BBB222",
    "[15/10/26, 21:05:02] Lorenzo: Pizzeria Ai Marmi Roma https://www.instagram.com/reel/XYZ123/",
    "15/10/26, 21:06 - Lorenzo: guarda https://vm.tiktok.com/ZMabc12/",
    "https://maps.app.goo.gl/SAVED9 (questo l'avevo già)",
    "https://maps.app.goo.gl/DUPA11",
    "https://example.com/articolo-sui-bar",
    "https://maps.app.goo.gl/ERR999",
    ...Array.from({ length: 11 }, (_, i) => `https://maps.app.goo.gl/C${String(i + 1).padStart(2, "0")}x`),
    "di nuovo https://maps.app.goo.gl/AAA111",
  ].join("\n");
  await mp.evaluate((t) => navigator.clipboard.writeText(t), chat);
  await mp.getByTestId("importa-incolla").click();
  await mc.waitFor({ timeout: 4000 }).catch(() => {});
  ok(await yOf("importa-google") < await yOf("importa-multi") && await yOf("importa-multi") < await yOf("importa-tessere"), "incolla più link: tanti link misti dall'unico Incolla aprono la lista, subito sotto");
  await mc.getByTestId("multi-avanzamento").waitFor({ timeout: 4000 }).catch(() => {});
  const progress = await mc.getByTestId("multi-avanzamento").textContent().catch(() => "");
  ok(/Leggo i link… \d+ di 19/.test(progress), `incolla più link: avanzamento mentre legge ("${progress.trim()}")`);
  await mp.screenshot({ path: `${OUT}/multi-link-lettura.png`, caret: "initial" });
  await mc.getByTestId("multi-riepilogo").waitFor({ timeout: 15000 });
  const rows = mc.getByTestId("multi-riga");
  const stati = await rows.evaluateAll((els) => els.map((e) => e.getAttribute("data-stato")));
  const by = (s) => stati.filter((x) => x === s).length;
  ok(stati.length === 19, `incolla più link: 19 link diversi trovati nella chat, il doppione dello stesso link tolto (${stati.length})`);
  ok(maxInflight <= 2, `incolla più link: al massimo 2 link letti insieme (${maxInflight})`);
  ok(spent <= 6 && spent >= 5 && previews.every((b) => b.budget >= 0 && b.budget <= 2), `incolla più link: tetto di 6 chiamate Google per import (${spent})`);
  const R = by("riconosciuto");
  const label = (n) => `Salva ${String(n).startsWith("8") || n === 11 ? "gli" : "i"} ${n} riconosciuti`;
  ok(R === 1 + spent && by("da_confermare") === 2 + (12 - spent) && by("gia_salvato") === 1 && by("doppione") === 1 && by("non_riconosciuto") === 2,
    `incolla più link: stati riconosciuto/da confermare/già salvato/non riconosciuto (${JSON.stringify(Object.fromEntries([...new Set(stati)].map((s) => [s, by(s)])))})`);
  ok(previews.every((b) => !/instagram|tiktok|example/.test(b.link)), "incolla più link: Instagram, TikTok e altri siti non partono da soli");
  const first = rows.nth(0);
  ok((await first.textContent()).includes("Bar Rossi") && (await first.textContent()).includes("Via Roma 1, Roma") && !(await first.textContent()).includes("Italia"), "incolla più link: riconosciuto con nome e indirizzo");
  ok((await mc.locator('[data-stato="gia_salvato"]').textContent()).includes("Osteria Già Mia") && (await mc.locator('[data-stato="gia_salvato"]').textContent()).includes("Già salvato"), "incolla più link: chi è già nei salvati è 'Già salvato'");
  const ig = mc.locator('[data-stato="da_confermare"]').filter({ hasText: "Instagram" });
  ok(await ig.getByRole("button", { name: "Carica uno screenshot" }).isVisible() && await ig.getByRole("button", { name: "Cerca “Pizzeria Ai Marmi Roma”" }).isVisible(), "incolla più link: Instagram da confermare, con screenshot e 'Cerca' dal testo della chat");
  ok(await mc.locator('[data-stato="da_confermare"]').filter({ hasText: "TikTok" }).getByRole("button", { name: "✨ Trova dal video" }).isVisible(), "incolla più link: TikTok da confermare con 'Trova dal video'");
  ok(await mc.getByTestId("multi-salva").textContent() === label(R), `incolla più link: pulsante unico '${await mc.getByTestId("multi-salva").textContent()}'`);
  const opts = await mp.locator("#multi-raccolta option").allTextContents();
  ok(opts.includes("📁 Weekend") && opts.some((o) => o.startsWith("＋ Nuova raccolta")), `incolla più link: scelta tra le raccolte esistenti o una nuova (${opts.join(" | ")})`);
  await mp.screenshot({ path: `${OUT}/multi-link-lista.png`, caret: "initial", fullPage: true });

  // Oltre il tetto: un tocco riconosce un link alla volta.
  const before = previews.length;
  await mc.getByTestId("multi-conferma").first().click();
  await mc.getByTestId("multi-salva").getByText(label(R + 1)).waitFor({ timeout: 4000 }).catch(() => {});
  ok(previews.length === before + 1 && previews.at(-1).budget === 2 && await mc.getByTestId("multi-salva").textContent() === label(R + 1), "incolla più link: 'Riconosci' su un link da confermare, uno per uno");

  // 360px: niente scroll orizzontale.
  await mp.setViewportSize({ width: 360, height: 780 });
  const mx = await mp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  ok(mx <= 0, `incolla più link 360px: nessuno scroll orizzontale (${mx}px)`);
  await mc.getByTestId("multi-salva").scrollIntoViewIfNeeded();
  await mp.screenshot({ path: `${OUT}/multi-link-360.png`, caret: "initial" });
  await mp.setViewportSize({ width: 390, height: 844 });

  // Salva tutto in una raccolta nuova.
  await mp.locator("#multi-raccolta").selectOption("__nuova__");
  await mc.getByLabel("Nome della nuova raccolta").fill("Viaggio a Milano");
  await mc.getByTestId("multi-salva").click();
  await mc.getByTestId("multi-fatto").waitFor({ timeout: 8000 });
  ok(minserts.length === R + 1 && minserts.every((b) => JSON.stringify(b.tags) === '["Da provare","Viaggio a Milano"]' && b.user_id === "00000000-0000-0000-0000-000000000001") && !minserts.some((b) => b.place_id === SAVED_ID) && new Set(minserts.map((b) => b.place_id)).size === R + 1,
    `incolla più link: salvati tutti una volta sola, nella raccolta scelta, mai il già salvato (${minserts.length})`);
  ok((await mc.getByTestId("multi-fatto").textContent()).includes(`${R + 1} locali salvati in “Viaggio a Milano”`) && await mc.getByRole("link", { name: "Apri la raccolta" }).getAttribute("href") === "/raccolte/Viaggio%20a%20Milano", "incolla più link: conferma con link alla raccolta");
  await mc.getByTestId("multi-fatto").scrollIntoViewIfNeeded();
  await mp.screenshot({ path: `${OUT}/multi-link-salvati.png`, caret: "initial" });
  const fe = mevents.filter((e) => e?.type === "funzione" && e.props?.nome === "import_multiplo");
  ok(fe.some((e) => e.props.risultati === 19 && e.props.contesto === "letti") && fe.some((e) => e.props.risultati === R + 1 && e.props.contesto === "salvati_raccolta"), `incolla più link: tracciato 'import_multiplo' con i numeri (${fe.map((e) => `${e.props.contesto}:${e.props.risultati}`).join(", ")})`);
  ok(droppedKeys(fe).length === 0 && !JSON.stringify(fe).includes("goo.gl") && !JSON.stringify(fe).includes("instagram"), "incolla più link: nei segnali niente link, solo chiavi accettate");

  // Dopo il salvataggio si può ancora riconoscere un link rimasto e salvarlo.
  const ins0 = minserts.length;
  await mc.getByTestId("multi-conferma").first().click();
  await mc.getByTestId("multi-salva").waitFor({ timeout: 4000 }).catch(() => {});
  await mc.getByTestId("multi-salva").click().catch(() => {});
  await mc.getByTestId("multi-fatto").getByText(`${R + 2} locali salvati`).waitFor({ timeout: 4000 }).catch(() => {});
  ok(minserts.length === ins0 + 1 && (await mc.getByTestId("multi-fatto").textContent()).includes(`${R + 2} locali salvati`), "incolla più link: un link riconosciuto dopo si salva con un secondo tocco");

  // Testo senza link: spiegato in italiano, nessuna chiamata.
  await mc.getByRole("button", { name: "Incolla altri link" }).click();
  ok((await mc.count()) === 0, "incolla più link: 'Incolla altri link' torna all'unico Incolla");
  const n0 = previews.length;
  await mp.getByTestId("importa-google").getByRole("button", { name: "Oppure incollalo in un riquadro" }).click();
  await mp.getByLabel("Link da incollare").fill("ricordati la pizzeria di Marco");
  await mp.getByTestId("importa-google").getByRole("button", { name: "Salva", exact: true }).click();
  ok(await mp.getByTestId("incolla-errore").isVisible() && (await mp.getByTestId("incolla-errore").textContent()).includes("Non vedo un link") && previews.length === n0, "incolla più link: testo senza link spiegato, nessuna chiamata");
  await mctx.close();
} else {
  console.log("SKIP  incolla più link: dev server senza E2E_FAKE_USER");
}

// ─── Invito e primo accesso (PIANO-25-OTTOBRE.md 9.1) ────────────────────────
// /invito/<codice>: nome di chi invita se ha il profilo pubblico (dati finti dal cookie "e2e_social"),
// codice ricordato nel telefono fino alla registrazione e contato una volta (arrivo, registrato).
// Primo accesso in 3 schermate con "Salta" e import da Google Maps proposto subito.
// "Invita un amico" nel profilo. Ricerche simulate: nessuna chiamata Google.
if (!fakeUser) console.log("SKIP  invito: dev server senza E2E_FAKE_USER");
else {
  const GIU = { id: "00000000-0000-4000-8000-0000000009a1", handle: "giulia.rm", display_name: "Giulia", bio: null, city: "Roma", visitati: 4, da_provare: 7, seguaci: 0, seguiti: 0 };
  const socialInv = { profili: [GIU], salvati: [], seguo: [], mio: { handle: "lorenzo", display_name: "Lorenzo", bio: null, city: "Roma", is_public: true } };
  const ictx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const ievents = [];
  await ictx.route("**/api/events", (r) => { ievents.push(r.request().postDataJSON()); return r.fulfill({ status: 204, body: "" }); });
  await ictx.route("**/api/places/photo**", (r) => r.fulfill({ status: 429, json: {} }));
  await ictx.route("**/api/search", (r) => r.fulfill({ json: SEARCH_FAST }));
  await ictx.route("**/api/search/synthesis", (r) => r.fulfill({ json: SYNTH }));
  await ictx.route("**/rest/v1/**", (r) => r.fulfill({ json: [] }));
  await ictx.addCookies([
    { name: "e2e_anonimo", value: "1", url: BASE },
    { name: "e2e_social", value: encodeURIComponent(JSON.stringify(socialInv)), url: BASE },
  ]);
  const ip = await ictx.newPage();
  ip.on("pageerror", (e) => errors.push(e.message));
  const arrivi = () => ievents.filter((e) => e?.type === "funzione" && e.props?.nome === "invito_arrivo");

  // Arrivo con il nome di chi invita.
  await ip.goto(`${BASE}/invito/giulia.rm`, { waitUntil: "networkidle" });
  ok((await ip.getByTestId("invito-titolo").textContent()) === "Giulia ti ha invitato su Mapetite", `invito: nome di chi invita (${await ip.getByTestId("invito-titolo").textContent()})`);
  ok((await ip.getByTestId("invito-posti").textContent()) === "11 posti sulla sua mappa", "invito: quanti posti ha sulla sua mappa");
  ok(await ip.getByTestId("invito-inizia").isVisible() && (await ip.getByTestId("invito-inizia").getAttribute("href")) === "/signup", "invito: un solo pulsante 'Inizia' verso la registrazione");
  ok((await ip.getByRole("link", { name: "Inizia" }).count()) === 1, "invito: 'Inizia' è unico");
  const ib = await ip.getByTestId("invito-inizia").boundingBox();
  ok(ib && ib.y + ib.height <= 844 - 64, `invito 390px: 'Inizia' visibile senza scorrere, sopra la barra (${Math.round(ib?.y ?? -1)})`);
  await ip.waitForTimeout(400);
  ok(arrivi().length === 1 && arrivi()[0].props.contesto === "giulia.rm", `invito: arrivo tracciato con il codice (${JSON.stringify(arrivi().map((e) => e.props))})`);
  ok(droppedKeys(arrivi()).length === 0, "invito: segnale con sole chiavi accettate dal server");
  const stored = await ip.evaluate(() => JSON.parse(localStorage.getItem("mapetite.invito") ?? "null"));
  ok(stored?.codice === "giulia.rm", `invito: codice ricordato nel telefono fino alla registrazione (${JSON.stringify(stored)})`);
  const og = await ip.locator('meta[property="og:title"]').getAttribute("content");
  ok(og === "Giulia ti invita su Mapetite", `invito: anteprima del link su WhatsApp con il nome (${og})`);
  await ip.screenshot({ path: `${OUT}/invito-arrivo.png`, caret: "initial" });
  await ip.reload({ waitUntil: "networkidle" });
  await ip.waitForTimeout(300);
  ok(arrivi().length === 1, "invito: riaprire il link non conta un secondo arrivo");

  // 360px: niente scroll orizzontale, pulsante visibile.
  await ip.setViewportSize({ width: 360, height: 740 });
  const ix = await ip.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  ok(ix <= 0, `invito 360px: nessuno scroll orizzontale (${ix}px)`);
  await ip.screenshot({ path: `${OUT}/invito-arrivo-360.png`, caret: "initial", fullPage: true });
  await ip.setViewportSize({ width: 390, height: 844 });

  // Codici generici e sconosciuti: testo neutro, mai un nome inventato.
  await ip.goto(`${BASE}/invito/tester`, { waitUntil: "networkidle" });
  ok((await ip.getByTestId("invito-titolo").textContent()) === "Sei tra i primi a provare Mapetite" && !(await ip.getByTestId("invito-posti").count()), "invito: codice 'tester' per il gruppo di prova");
  await ip.screenshot({ path: `${OUT}/invito-tester.png`, caret: "initial" });
  await ip.goto(`${BASE}/invito/sconosciuto`, { waitUntil: "networkidle" });
  ok((await ip.getByTestId("invito-titolo").textContent()) === "Ti hanno invitato su Mapetite", "invito: codice senza profilo pubblico → testo neutro");
  const nArr = arrivi().length;
  await ip.goto(`${BASE}/invito/%3Cscript%3E`, { waitUntil: "networkidle" });
  await ip.waitForTimeout(300);
  ok((await ip.getByTestId("invito-titolo").textContent()) === "Ti hanno invitato su Mapetite" && arrivi().length === nArr, "invito: codice non valido → pagina neutra, nessun conteggio");
  ok((await ip.evaluate(() => JSON.parse(localStorage.getItem("mapetite.invito") ?? "null")?.codice)) === "sconosciuto", "invito: si ricorda l'ultimo codice valido");
  await ip.goto(`${BASE}/invito/giulia.rm`, { waitUntil: "networkidle" });
  await ip.getByTestId("invito-inizia").click();
  await ip.waitForURL(/\/signup/, { timeout: 5000 }).then(() => ok(true, "invito: 'Inizia' apre la registrazione"), () => ok(false, "invito: 'Inizia' apre la registrazione"));

  // Primo accesso (dopo la registrazione): 3 schermate, codice contato come "registrato".
  await ictx.clearCookies({ name: "e2e_anonimo" });
  await ip.goto(`${BASE}/onboarding`, { waitUntil: "networkidle" });
  await ip.waitForTimeout(300);
  const reg = ievents.filter((e) => e?.type === "funzione" && e.props?.nome === "invito_registrato");
  ok(reg.length === 1 && reg[0].props.contesto === "giulia.rm", `primo accesso: registrazione da invito contata con il codice (${JSON.stringify(reg.map((e) => e.props))})`);
  ok((await ip.evaluate(() => localStorage.getItem("mapetite.invito"))) === null, "primo accesso: codice d'invito usato una volta sola");
  // Mappa del gusto (sprint 25/10): 4 passi a schermo intero. 1) città e zone.
  ok((await ip.getByTestId("benvenuto-passo").textContent()) === "1 di 4" && (await ip.getByRole("progressbar").getAttribute("aria-valuenow")) === "1", "primo accesso: passo 1 di 4 con barra di avanzamento");
  ok((await ip.getByTestId("barra").count()) === 0, "primo accesso: a schermo intero, senza la barra in basso");
  ok(await ip.getByTestId("benvenuto-citta").isVisible() && (await ip.getByTestId("benvenuto-zone").count()) === 0, "primo accesso: si parte dalla città, le zone compaiono dopo");
  await ip.getByRole("button", { name: "Roma", exact: true }).click();
  await ip.getByRole("button", { name: "Monti", exact: true }).click();
  ok(await ip.getByTestId("benvenuto-zone").isVisible() && (await ip.getByRole("button", { name: "Monti", exact: true }).getAttribute("aria-pressed")) === "true" && (await ip.getByRole("button", { name: "Isola", exact: true }).count()) === 0, "primo accesso: scelta Roma, le zone di Roma (non quelle di Milano)");
  await ip.screenshot({ path: `${OUT}/benvenuto-1-citta-zone.png`, caret: "initial" });
  // 2) dieci tipi di posto 👍/👎
  await ip.getByRole("button", { name: "Continua" }).click();
  ok((await ip.getByTestId("benvenuto-passo").textContent()) === "2 di 4" && (await ip.getByTestId("tipi-contatore").textContent()) === "1 di 10" && (await ip.getByTestId("tipo-card").textContent()).includes("Trattoria di quartiere"), "primo accesso: passo 2, il primo dei 10 tipi di posto");
  await ip.screenshot({ path: `${OUT}/benvenuto-2-tipi.png`, caret: "initial" });
  await ip.getByTestId("tipo-su").click();
  ok((await ip.getByTestId("tipi-contatore").textContent()) === "2 di 10", "primo accesso: dopo il 👍 il tipo successivo");
  await ip.getByRole("button", { name: "↶ Torna al precedente" }).click();
  ok((await ip.getByTestId("tipi-contatore").textContent()) === "1 di 10", "primo accesso: 'Torna al precedente' annulla l'ultimo voto");
  // Scorrimento col dito: a destra è un 👍.
  { const cb = await ip.getByTestId("tipo-card").boundingBox();
    await ip.mouse.move(cb.x + cb.width / 2, cb.y + cb.height / 2); await ip.mouse.down();
    await ip.mouse.move(cb.x + cb.width / 2 + 160, cb.y + cb.height / 2, { steps: 6 }); await ip.mouse.up();
    // La card vola via (180 ms), poi arriva la prossima.
    await ip.waitForFunction(() => document.querySelector('[data-testid="tipi-contatore"]')?.textContent === "2 di 10", null, { timeout: 2000 }).catch(() => {});
    ok((await ip.getByTestId("tipi-contatore").textContent()) === "2 di 10", "primo accesso: trascinando la card a destra si vota 👍 (la card vola via)");
    await ip.getByRole("button", { name: "↶ Torna al precedente" }).click(); }
  for (const v of ["su", "giu", "giu", "su", "su", "su", "giu", "giu", "su", "boh"]) await ip.getByTestId(`tipo-${v}`).click();
  await ip.getByTestId("benvenuto-come").waitFor({ timeout: 3000 }).catch(() => {});
  // 3) come esci: famosi o chicche già proposto dai 👍 (4 chicche su 4), diete
  ok((await ip.getByTestId("benvenuto-passo").textContent()) === "3 di 4" && (await ip.getByRole("radio", { name: /Le chicche/ }).getAttribute("aria-checked")) === "true", "primo accesso: finiti i 10 tipi si passa da soli al passo 3, con 'Le chicche' già scelto dai 👍");
  ok(!(await ip.getByRole("button", { name: "Aperitivo", exact: true }).isVisible()), "primo accesso: occasioni e spesa un tocco più in là (facoltativo)");
  await ip.getByRole("button", { name: "Niente pesce", exact: true }).click();
  await ip.getByTestId("come-altro").locator("summary").click();
  await ip.getByRole("button", { name: "Aperitivo", exact: true }).click();
  await ip.screenshot({ path: `${OUT}/benvenuto-3-come.png`, caret: "initial" });
  // 4) "Ecco cosa ho capito", con i posti per te o prima l'import
  await ip.getByRole("button", { name: "Continua" }).click();
  { const righe = (await ip.getByTestId("capito-riga").allTextContents()).join(" | ");
    ok((await ip.getByTestId("benvenuto-passo").textContent()) === "4 di 4" && righe.includes("Esci soprattutto a Monti") && righe.includes("Ti piacciono: trattoria di quartiere") && righe.includes("Preferisci le chicche") && righe.includes("Eviti pesce") && righe.includes("aperitivo"), `primo accesso: 'Ecco cosa ho capito' riassume zone, gusti, chicche, diete e occasioni (${righe.slice(0, 220)})`); }
  ok(await ip.getByTestId("benvenuto-fine").isVisible() && await ip.getByTestId("benvenuto-importa-si").isVisible() && (await ip.getByTestId("onboarding-salta").count()) === 0, "primo accesso: alla fine 'Mostrami i posti per me' e 'Prima porta qui i tuoi posti', niente 'Salta' doppio");
  { const t = await ip.locator("h1").boundingBox(); ok(!!t && t.y > 0, "primo accesso: ogni schermata parte dall'alto (titolo visibile)"); }
  await ip.screenshot({ path: `${OUT}/benvenuto-4-capito.png`, caret: "initial" });
  await ip.setViewportSize({ width: 360, height: 740 });
  { const ox = await ip.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    const ob = await ip.getByTestId("benvenuto-importa-si").boundingBox();
    ok(ox <= 0 && ob && ob.y + ob.height <= 740, `primo accesso 360px: nessuno scroll orizzontale, pulsanti visibili (${ox}px, ${Math.round(ob?.y ?? -1)})`); }
  await ip.setViewportSize({ width: 390, height: 844 });
  await ip.getByTestId("capito-riga").first().click();
  ok((await ip.getByTestId("benvenuto-passo").textContent()) === "1 di 4" && (await ip.getByRole("button", { name: "Monti", exact: true }).getAttribute("aria-pressed")) === "true", "primo accesso: toccando una riga si torna a cambiarla, con le scelte conservate");
  for (let k = 0; k < 3; k++) await ip.getByRole("button", { name: "Continua" }).click().catch(() => {});
  await ip.getByTestId("benvenuto-importa-si").click();
  await ip.waitForURL(/\/importa\?da=benvenuto/, { timeout: 8000 }).then(() => ok(true, "primo accesso: 'Prima porta qui i tuoi posti' apre l'import"), () => ok(false, `primo accesso: 'Prima porta qui i tuoi posti' apre l'import (${ip.url()})`));
  await ip.getByTestId("importa-incolla").waitFor({ timeout: 5000 }).catch(() => {});
  const mb = await ip.getByTestId("importa-incolla").boundingBox();
  ok(await ip.getByTestId("importa-benvenuto").isVisible() && mb && mb.y < 844 / 2 && await ip.getByTestId("importa-maps-guida").isVisible(), `primo accesso: l'import si apre con 'Incolla un link' in cima e la guida di Google Maps aperta (${Math.round(mb?.y ?? -1)})`);
  await ip.screenshot({ path: `${OUT}/benvenuto-importa-arrivo.png`, caret: "initial" });
  ok(ievents.some((e) => e?.props?.nome === "benvenuto_importa"), "primo accesso: scelta 'importa' tracciata");
  // 18/10: la città scelta diventa il punto di partenza di mappa e assistente, anche passando da Importa.
  { const v = await ip.evaluate(() => { try { return JSON.parse(localStorage.getItem("mapetite.vista") ?? "null"); } catch { return null; } });
    ok(!!v && Math.abs(v.lat - 41.893) < 0.01 && Math.abs(v.lng - 12.483) < 0.01, `primo accesso: la città scelta (Roma) resta come punto di partenza della mappa (${JSON.stringify(v)})`); }

  // Fine: "Mostrami i posti per me" cerca il tipo piaciuto nella zona; chi ama le chicche "fuori dai giri turistici".
  await ip.goto(`${BASE}/onboarding`, { waitUntil: "networkidle" });
  await ip.getByRole("button", { name: "Roma", exact: true }).click();
  await ip.getByRole("button", { name: "Pigneto", exact: true }).click();
  await ip.getByRole("button", { name: "Continua" }).click();
  await ip.getByTestId("tipo-su").click();
  await ip.getByRole("button", { name: "Basta così, continua" }).click();
  await ip.getByRole("button", { name: "Continua" }).click();
  await ip.getByTestId("benvenuto-fine").click();
  await ip.waitForURL(/\/mappa/, { timeout: 8000 }).catch(() => {});
  ok(new URL(ip.url()).pathname === "/mappa" && new URL(ip.url()).searchParams.get("q") === "Trattoria di quartiere fuori dai giri turistici a Pigneto", `primo accesso: 'Mostrami i posti per me' → trattoria fuori dai giri turistici al Pigneto (${new URL(ip.url()).searchParams.get("q")})`);
  // Chi ama i posti famosi: niente "fuori dai giri"; "Salta" al passo 2 salta solo quel passo.
  await ip.goto(`${BASE}/onboarding`, { waitUntil: "networkidle" });
  await ip.getByRole("button", { name: "Milano", exact: true }).click();
  await ip.getByRole("button", { name: "Continua" }).click();
  await ip.getByTestId("onboarding-salta").click();
  ok((await ip.getByTestId("benvenuto-passo").textContent()) === "3 di 4", "primo accesso: 'Salta' al passo 2 va al passo 3");
  await ip.getByRole("button", { name: "Indietro" }).click();
  await ip.getByTestId("tipo-giu").click();
  await ip.getByTestId("tipo-giu").click();
  await ip.getByTestId("tipo-su").click(); // pizzeria con la fila (molto nota)
  await ip.getByRole("button", { name: "Basta così, continua" }).click();
  await ip.getByRole("button", { name: "Continua" }).click();
  await ip.getByTestId("benvenuto-fine").click();
  await ip.waitForURL(/\/mappa/, { timeout: 8000 }).catch(() => {});
  ok(new URL(ip.url()).searchParams.get("q") === "Pizzeria napoletana a Milano", `primo accesso: chi ama i posti famosi → la ricerca senza 'fuori dai giri', nella città (${new URL(ip.url()).searchParams.get("q")})`);

  // "Invita un amico" nel profilo: link personale con il nome pubblico, condiviso o copiato.
  await ictx.addInitScript(() => { Object.defineProperty(navigator, "share", { value: undefined, configurable: true }); });
  await ictx.grantPermissions(["clipboard-read", "clipboard-write"], { origin: BASE });
  await ictx.addCookies([{ name: "e2e_profilo", value: encodeURIComponent(JSON.stringify({ email: "lorenzo@example.com", saved: [], reviews: [] })), url: BASE }]);
  const pp = await ictx.newPage();
  pp.on("pageerror", (e) => errors.push(e.message));
  await pp.goto(`${BASE}/profilo#invita`, { waitUntil: "networkidle" });
  ok((await pp.getByTestId("invito-mappa-gusto").count()) === 0, "profilo: con la mappa del gusto già fatta, nessun invito a farla");
  ok((await pp.getByTestId("invita-amico-link").textContent()) === "/invito/lorenzo", `profilo: 'Invita un amico' con il proprio link (${await pp.getByTestId("invita-amico-link").textContent()})`);
  await pp.getByTestId("invita-amico").evaluate((el) => el.scrollIntoView({ block: "center" }));
  await pp.screenshot({ path: `${OUT}/invita-amico.png`, caret: "initial" });
  // Mappa del gusto (sprint 25/10): chi si è registrato prima riceve l'invito a farla, in cima al profilo.
  { const pg = await ictx.newPage();
    await ictx.addCookies([{ name: "e2e_profilo", value: encodeURIComponent(JSON.stringify({ email: "lorenzo@example.com", saved: [], reviews: [], senzaGusto: true })), url: BASE }]);
    await pg.goto(`${BASE}/profilo`, { waitUntil: "networkidle" });
    const inv = pg.getByTestId("invito-mappa-gusto");
    const bx = await inv.boundingBox().catch(() => null);
    ok(!!bx && bx.y < 400 && (await inv.getAttribute("href")) === "/onboarding", `profilo: senza mappa del gusto, l'invito a farla in cima (${Math.round(bx?.y ?? -1)})`);
    await pg.screenshot({ path: `${OUT}/profilo-invito-mappa-gusto.png`, caret: "initial" });
    await ictx.addCookies([{ name: "e2e_profilo", value: encodeURIComponent(JSON.stringify({ email: "lorenzo@example.com", saved: [], reviews: [] })), url: BASE }]);
    await pg.close(); }
  await pp.getByTestId("invita-amico-condividi").click();
  await pp.getByTestId("invita-amico-condividi").getByText("✓ Link copiato").waitFor({ timeout: 3000 }).catch(() => {});
  const clip = await pp.evaluate(() => navigator.clipboard.readText()).catch(() => "");
  ok(clip === `${BASE}/invito/lorenzo`, `profilo: senza menu di condivisione il link si copia (${clip})`);
  ok(ievents.some((e) => e?.type === "condividi" && e.props?.contesto === "invito"), "profilo: invito condiviso tracciato");
  await pp.setViewportSize({ width: 360, height: 740 });
  const px = await pp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  ok(px <= 0, `profilo 360px: 'Invita un amico' senza scroll orizzontale (${px}px)`);
  await pp.getByTestId("invita-amico").evaluate((el) => el.scrollIntoView({ block: "center" }));
  await pp.screenshot({ path: `${OUT}/invita-amico-360.png`, caret: "initial" });
  // Senza nome pubblico (parte social non ancora attiva): codice dall'id, funziona lo stesso.
  await ictx.clearCookies({ name: "e2e_social" });
  await pp.goto(`${BASE}/profilo`, { waitUntil: "networkidle" });
  ok((await pp.getByTestId("invita-amico-link").textContent()) === "/invito/u-00000000", `profilo: senza nome pubblico il link usa un codice breve (${await pp.getByTestId("invita-amico-link").textContent()})`);
  await ictx.close();

  // Pannello: arrivi e registrazioni per codice; chi arriva anonimo e poi si registra conta una volta.
  let nmI = null;
  try { nmI = await import(new URL("../../src/lib/numeri.ts", import.meta.url).href); } catch { /* già segnalato sopra */ }
  if (nmI) {
    const t = new Date().toISOString();
    const rowsI = [
      { created_at: t, type: "funzione", user_id: null, anon_id: "a1", props: { nome: "invito_arrivo", contesto: "giulia.rm" } },
      { created_at: t, type: "funzione", user_id: "u1", anon_id: "a1", props: { nome: "invito_registrato", contesto: "giulia.rm" } },
      { created_at: t, type: "funzione", user_id: null, anon_id: "a2", props: { nome: "invito_arrivo", contesto: "giulia.rm" } },
      { created_at: t, type: "funzione", user_id: null, anon_id: "a2", props: { nome: "invito_arrivo", contesto: "giulia.rm" } },
      { created_at: t, type: "funzione", user_id: null, anon_id: "a3", props: { nome: "invito_arrivo", contesto: "tester" } },
      { created_at: t, type: "condividi", user_id: "u9", anon_id: null, props: { contesto: "invito" } },
    ];
    const ni = nmI.computeNumeri(rowsI, 7);
    ok(JSON.stringify(ni.inviti) === JSON.stringify([{ codice: "giulia.rm", arrivi: 2, registrati: 1 }, { codice: "tester", arrivi: 1, registrati: 0 }]), `numeri: arrivi e registrati per codice d'invito (${JSON.stringify(ni.inviti)})`);
    ok(ni.funzioni.some((f) => f.chiave === "invito_condividi" && f.volte === 1), "numeri: 'Invito: link mandato' tra le funzioni");
  }
}

// 18. "Ti è stato utile?" in un tocco (piano 7.6) dopo assistente, serata a tappe, Sorprendimi e
//     prenotazione; domanda settimanale in home; "Valore per i tester" nel pannello. Tutto simulato.
if (!fakeUser) console.log("SKIP  ti è stato utile: dev server senza E2E_FAKE_USER");
else {
  const SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="#c96"/></svg>';
  const uctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await uctx.addInitScript(() => { try { localStorage.setItem("mapetite.intro", "visto"); } catch { /* ignorato */ } });
  const uEv = [];
  await uctx.route("**/api/events", (r) => { uEv.push(r.request().postDataJSON()); return r.fulfill({ status: 204, body: "" }); });
  await uctx.route("**/api/places/photo**", (r) => r.fulfill({ contentType: "image/svg+xml", body: SVG }));
  await uctx.route("**/rest/v1/**", (r) => r.fulfill(r.request().method() === "POST" ? { status: 201, body: "" } : { json: [] }));
  await uctx.route("**/events.mapbox.com/**", (r) => r.fulfill({ status: 204, body: "" }));
  await uctx.route("**/api/search/intent", (r) => r.fulfill({ json: { intent: null } }));
  await uctx.route("**/api/search", (r) => r.fulfill({ json: { ...SEARCH_FAST, risultati: [{ ...PLACES[0], phone: "347 123 4567" }, PLACES[1], PLACES[2]] } }));
  await uctx.route("**/api/search/synthesis", (r) => r.fulfill({ json: SYNTH }));
  await uctx.route("https://wa.me/**", (r) => r.fulfill({ contentType: "text/html", body: "<p>WhatsApp</p>" }));
  const up = await uctx.newPage();
  up.on("pageerror", (e) => errors.push(e.message));
  up.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|mapbox|WebGL/i.test(m.text())) errors.push(m.text().slice(0, process.env.E2E_DEBUG ? 3000 : 150) + (process.env.E2E_DEBUG ? " @ " + m.location().url : "")); });
  const utili = () => uEv.filter((e) => e.type === "utile");

  // Assistente: dopo la risposta con i posti, una volta sola, sotto le card.
  await up.goto(`${BASE}/assistente`, { waitUntil: "networkidle" });
  await up.getByTestId("assistente-campo").fill("rooftop romantico a Roma");
  await up.keyboard.press("Enter");
  const ua = up.getByTestId("assistente-risposta").last().getByTestId("utile");
  await ua.waitFor({ timeout: 10000 }).catch(() => {});
  ok(await ua.getAttribute("data-contesto").catch(() => null) === "assistente" && (await up.getByTestId("utile").count()) === 1, "utile: 'Ti è stato utile?' dopo la risposta dell'assistente, una sola volta");
  { const c = await up.getByTestId("assistente-card").last().boundingBox(); const u = await ua.boundingBox().catch(() => null);
    ok(!!c && !!u && u.y >= c.y + c.height, "utile: sotto le card dei posti, non in mezzo"); }
  await ua.getByRole("button", { name: "No, non utile" }).click();
  const um = up.getByTestId("utile-motivi");
  await um.waitFor({ timeout: 3000 }).catch(() => {});
  const motivi = await um.getByRole("button").allTextContents();
  ok(motivi.join("|") === "Risultati sbagliati|Troppo lento|Posti già noti|Altro" && (await um.locator("input, textarea").count()) === 0, `utile: con 👎 'Cosa mancava?' con 4 scelte rapide, niente testo libero (${motivi.join(", ")})`);
  await um.scrollIntoViewIfNeeded();
  await up.screenshot({ path: `${OUT}/70-utile-assistente-motivi.png`, caret: "initial" });
  await um.getByRole("button", { name: "Troppo lento" }).click();
  await up.getByTestId("utile-grazie").waitFor({ timeout: 3000 }).catch(() => {});
  await up.waitForTimeout(200);
  { const v = utili();
    ok(v.length === 2 && v[0].props.voto === "no" && v[0].props.contesto === "assistente" && typeof v[0].props.risultati === "number"
      && v[1].props.stato === "lento" && v[1].props.contesto === "assistente" && v[1].props.voto === undefined,
      `utile: 👎 e 'Troppo lento' registrati come due segnali, il motivo solo come scelta (${JSON.stringify(v.map((e) => e.props))})`); }
  await up.reload({ waitUntil: "networkidle" });
  await up.getByTestId("assistente-card").first().waitFor({ timeout: 5000 }).catch(() => {});
  ok((await up.getByTestId("utile").count()) === 0 && (await up.getByTestId("utile-motivi").count()) === 0, "utile: ricaricando, la risposta già votata non chiede di nuovo");

  // Prenotazione: dopo l'invio, nel foglio Prenota.
  await up.getByTestId("assistente-nuova").click().catch(() => {});
  await up.getByTestId("assistente-campo").fill("prenotami domani alle 21 per 2 con terrazza a Roma");
  await up.keyboard.press("Enter");
  await up.getByRole("button", { name: "Prenota da Terrazza Uno" }).click({ timeout: 10000 });
  await up.getByTestId("foglio-prenota").waitFor({ timeout: 3000 });
  ok((await up.getByTestId("foglio-prenota").getByTestId("utile").count()) === 0, "utile: nel foglio Prenota non compare prima dell'invio");
  await up.getByLabel("Il tuo nome").fill("Giulia");
  const [wa] = await Promise.all([up.waitForEvent("popup"), up.getByTestId("prenota-whatsapp").click()]);
  await wa.close();
  await up.getByTestId("prenota-fatto").waitFor({ timeout: 3000 });
  const fu = up.getByTestId("foglio-prenota").getByTestId("utile");
  ok(await fu.isVisible() && await fu.getAttribute("data-contesto") === "prenota", "utile: dopo l'invio della prenotazione, 'Ti è stato utile?' nel foglio");
  { const f = await up.getByRole("button", { name: "Fatto" }).boundingBox(); const u = await fu.boundingBox();
    ok(!!f && !!u && u.y > f.y + f.height, "utile: nel foglio sta sotto 'Fatto', non prima del pulsante principale"); }
  { const w = await up.evaluate(() => document.scrollingElement.scrollWidth); ok(w <= 390, `utile: foglio Prenota senza scorrimento orizzontale (${w}px)`); }
  await fu.scrollIntoViewIfNeeded();
  await up.screenshot({ path: `${OUT}/71-utile-prenota.png`, caret: "initial" });
  await fu.getByRole("button", { name: "Sì, utile" }).click();
  await up.getByTestId("foglio-prenota").getByTestId("utile-grazie").waitFor({ timeout: 3000 }).catch(() => {});
  await up.waitForTimeout(200);
  ok(utili().some((e) => e.props.voto === "si" && e.props.contesto === "prenota"), "utile: 👍 dopo la prenotazione registrato con contesto 'prenota'");
  await up.getByRole("button", { name: "Fatto" }).click();

  // Serata a tappe: contesto "serata".
  await up.getByTestId("assistente-nuova").click().catch(() => {});
  await up.goto(`${BASE}/assistente?q=${encodeURIComponent("aperitivo e cena a Trastevere")}`, { waitUntil: "networkidle" });
  await up.waitForFunction(() => document.querySelectorAll("[data-testid=serata-scelto]").length === 2, null, { timeout: 8000 }).catch(() => {});
  const us = up.getByTestId("assistente-risposta").last().getByTestId("utile");
  await us.waitFor({ timeout: 5000 }).catch(() => {});
  ok(await us.getAttribute("data-contesto").catch(() => null) === "serata", "utile: dopo la serata a tappe, con contesto 'serata'");
  { const s = await up.getByTestId("serata").boundingBox(); const u = await us.boundingBox().catch(() => null);
    ok(!!s && !!u && u.y >= s.y + s.height, "utile: sotto la serata, in fondo alla risposta"); }
  await us.getByRole("button", { name: "Sì, utile" }).click().catch(() => {});
  await up.waitForTimeout(200);
  ok(utili().some((e) => e.props.voto === "si" && e.props.contesto === "serata" && e.props.risultati === 2), "utile: 👍 sulla serata registrato con le tappe trovate");

  // Sorprendimi: sotto la carta, resta uno solo anche con "Un altro".
  await uctx.route("**/rest/v1/saved_places**", (r) => r.fulfill({ json: [{ tags: ["Mi è piaciuto"], places: { category: "Trattoria", lat: 41.9, lng: 12.49, google_place_id: "GT1" } }] }));
  const sm = (id, name) => mk(id, name, 41.9 + Number(id.slice(2)) * 0.001, 12.49, { category: "Trattoria", rating: 4.6, userRatingCount: 200, types: ["restaurant"] });
  await uctx.route("**/api/search", (r) => r.fulfill({ json: { risultati: [sm("SU1", "Trattoria Uno"), sm("SU2", "Trattoria Due")], filtri_usati: { categoria: null, parole_chiave: [], vicino_a_me: false }, sintesi_pendente: null } }));
  const sp2 = await uctx.newPage();
  sp2.on("pageerror", (e) => errors.push(e.message));
  await sp2.clock.setFixedTime(new Date("2026-10-16T20:30:00"));
  await sp2.goto(`${BASE}/sorprendimi?da=mappa&lat=41.9&lng=12.49`, { waitUntil: "networkidle" });
  await sp2.getByTestId("sorpresa-card").waitFor({ timeout: 8000 }).catch(() => {});
  const usp = sp2.getByTestId("utile");
  ok(await usp.isVisible().catch(() => false) && await usp.getAttribute("data-contesto") === "sorpresa", "utile: 'Ti è stato utile?' sotto la proposta di Sorprendimi");
  { const c = await sp2.getByTestId("sorpresa-card").boundingBox(); const u = await usp.boundingBox().catch(() => null);
    ok(!!c && !!u && u.y >= c.y + c.height, "utile: sotto la carta, non sopra i pulsanti"); }
  await sp2.getByTestId("sorpresa-altro").click();
  await sp2.waitForTimeout(300);
  ok((await sp2.getByTestId("utile").count()) === 1, "utile: con 'Un altro' resta una sola domanda");
  await sp2.evaluate(() => window.scrollTo(0, document.scrollingElement.scrollHeight));
  await sp2.waitForTimeout(200);
  await sp2.screenshot({ path: `${OUT}/72-utile-sorprendimi.png`, caret: "initial" });
  await usp.getByRole("button", { name: "No, non utile" }).click().catch(() => {});
  await sp2.getByTestId("utile-motivi").getByRole("button", { name: "Posti già noti" }).click().catch(() => {});
  await sp2.getByTestId("utile-grazie").waitFor({ timeout: 3000 }).catch(() => {});
  await sp2.waitForTimeout(200);
  ok(utili().some((e) => e.props.voto === "no" && e.props.contesto === "sorpresa") && utili().some((e) => e.props.stato === "gia_noti" && e.props.contesto === "sorpresa"), "utile: 👎 e 'Posti già noti' su Sorprendimi registrati");
  { const w = await sp2.evaluate(() => document.scrollingElement.scrollWidth); ok(w <= 390, `utile: Sorprendimi senza scorrimento orizzontale (${w}px)`); }
  await sp2.close();
  const lostU = droppedKeys(utili());
  ok(lostU.length === 0, `utile: tutte le chiavi dei segnali sono tra quelle che il server conserva (${lostU.join(", ") || "nessuna scartata"})`);
  ok(!JSON.stringify(uEv).includes("rooftop romantico") && !JSON.stringify(uEv).includes("Giulia"), "utile: nei segnali niente frasi scritte né nomi");
  { const r = await up.request.post(`${BASE}/api/events`, { data: { type: "utile", props: { contesto: "assistente", stato: "lento" } } });
    ok(r.status() === 204, `utile: /api/events accetta il motivo del 👎 (${r.status()})`); }
  await uctx.close();

  // Domanda settimanale in home: solo dopo 2 giorni diversi d'uso, una volta ogni 7 giorni.
  const day = (n) => { const d = new Date(Date.now() - n * 86_400_000); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  const wctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const wEv = [];
  await wctx.route("**/api/events", (r) => { wEv.push(r.request().postDataJSON()); return r.fulfill({ status: 204, body: "" }); });
  await wctx.route("**/rest/v1/**", (r) => r.fulfill({ json: [] }));
  await wctx.addInitScript(() => { try { localStorage.setItem("mapetite.intro", "visto"); } catch { /* ignorato */ } });
  const wp = await wctx.newPage();
  wp.on("pageerror", (e) => errors.push(e.message));
  wp.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/i.test(m.text())) errors.push(m.text().slice(0, process.env.E2E_DEBUG ? 3000 : 150) + (process.env.E2E_DEBUG ? " @ " + m.location().url : "")); });
  await wp.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await wp.waitForTimeout(300);
  ok((await wp.getByTestId("domanda-settimanale").count()) === 0, "settimanale: al primo giorno d'uso la domanda non c'è");
  ok((await wp.evaluate(() => JSON.parse(localStorage.getItem("mapetite.giorni_uso") ?? "[]"))).length === 1, "settimanale: il giorno d'uso è segnato nel telefono");
  await wp.evaluate((d) => localStorage.setItem("mapetite.giorni_uso", JSON.stringify([d])), day(2));
  await wp.reload({ waitUntil: "networkidle" });
  const dq = wp.getByTestId("domanda-settimanale");
  await dq.waitFor({ timeout: 3000 }).catch(() => {});
  ok(await dq.isVisible() && (await dq.textContent()).includes("Quanto ti ha aiutato Mapetite questa settimana a scegliere dove andare?"), "settimanale: dal secondo giorno diverso compare in home");
  ok((await dq.getByTestId("domanda-voto").getByRole("button").count()) === 5, "settimanale: voto da 1 a 5");
  { const b = await dq.getByRole("button", { name: "1 su 5" }).boundingBox(); ok(!!b && b.height >= 44 && b.width >= 44, `settimanale: pulsanti grandi abbastanza per il dito (${Math.round(b?.width ?? 0)}×${Math.round(b?.height ?? 0)})`); }
  { const s = await wp.getByPlaceholder("Cosa cerchi?").boundingBox().catch(() => null);
    ok(!!s && s.y + s.height <= 844, `settimanale: il campo di ricerca in home resta sullo schermo (${Math.round((s?.y ?? 0) + (s?.height ?? 0))} px)`); }
  await dq.scrollIntoViewIfNeeded();
  await wp.screenshot({ path: `${OUT}/73-settimanale-voto.png`, caret: "initial" });
  await dq.getByRole("button", { name: "4 su 5" }).click();
  await dq.getByTestId("domanda-consiglio").waitFor({ timeout: 3000 }).catch(() => {});
  ok((await dq.textContent()).includes("Lo consiglieresti a un amico?") && (await dq.getByTestId("domanda-consiglio").getByRole("button").allTextContents()).join() === "Sì,Forse,No", "settimanale: poi 'Lo consiglieresti a un amico?' Sì/Forse/No");
  await wp.screenshot({ path: `${OUT}/74-settimanale-consiglio.png`, caret: "initial" });
  await dq.getByTestId("domanda-consiglio").getByRole("button", { name: "Forse" }).click();
  await dq.getByTestId("domanda-grazie").waitFor({ timeout: 3000 }).catch(() => {});
  await wp.waitForTimeout(200);
  { const s = wEv.filter((e) => e.type === "funzione" && e.props?.nome === "domanda_settimanale");
    ok(s.length === 2 && s[0].props.voto === 4 && s[1].props.stato === "forse", `settimanale: voto e consiglio registrati (${JSON.stringify(s.map((e) => e.props))})`);
    const lost = droppedKeys(s);
    ok(lost.length === 0, `settimanale: chiavi tutte conservate dal server (${lost.join(", ") || "nessuna scartata"})`); }
  await wp.reload({ waitUntil: "networkidle" });
  await wp.waitForTimeout(300);
  ok((await wp.getByTestId("domanda-settimanale").count()) === 0, "settimanale: risposta data, non torna prima di 7 giorni");
  // Dopo 8 giorni torna; chiusa con la X, si ricorda e lo registra.
  await wp.evaluate(() => localStorage.setItem("mapetite.domanda_settimanale", String(Date.now() - 8 * 86_400_000)));
  await wp.setViewportSize({ width: 360, height: 780 });
  await wp.reload({ waitUntil: "networkidle" });
  await dq.waitFor({ timeout: 3000 }).catch(() => {});
  ok(await dq.isVisible(), "settimanale: dopo 7 giorni la domanda torna");
  { const w = await wp.evaluate(() => document.scrollingElement.scrollWidth); ok(w <= 360, `settimanale 360 px: niente scorrimento orizzontale (${w}px)`); }
  await dq.scrollIntoViewIfNeeded();
  await wp.screenshot({ path: `${OUT}/75-settimanale-360.png`, caret: "initial" });
  await dq.getByRole("button", { name: "Chiudi la domanda" }).click();
  await wp.waitForTimeout(200);
  ok((await wp.getByTestId("domanda-settimanale").count()) === 0 && wEv.some((e) => e.props?.nome === "domanda_settimanale" && e.props?.stato === "chiusa"), "settimanale: si chiude con la X (registrato come 'chiusa')");
  await wp.reload({ waitUntil: "networkidle" });
  await wp.waitForTimeout(300);
  ok((await wp.getByTestId("domanda-settimanale").count()) === 0, "settimanale: chiusa, non riappare ricaricando");

  // Pannello: "Valore per i tester".
  const iso = (minAgo) => new Date(Date.now() - minAgo * 60_000).toISOString();
  const V = "00000000-0000-0000-0000-00000000000c";
  const ev = (type, min, props, user = V) => ({ created_at: iso(min), type, user_id: user, anon_id: null, session_id: "sv", props });
  await wctx.addCookies([{ name: "e2e_eventi", url: BASE, value: encodeURIComponent(JSON.stringify([
    ev("sessione_inizio", 60, { prima_volta: 1 }),
    ev("utile", 50, { voto: "si", contesto: "assistente", risultati: 3 }),
    ev("utile", 49, { voto: "si", contesto: "assistente", risultati: 3 }),
    ev("utile", 48, { voto: "no", contesto: "assistente", risultati: 3 }),
    ev("utile", 47, { contesto: "assistente", stato: "lento" }),
    ev("utile", 46, { voto: "si", contesto: "sorpresa" }),
    ev("utile", 45, { voto: "si", contesto: "prenota" }),
    ev("funzione", 40, { nome: "domanda_settimanale", voto: 4 }),
    ev("funzione", 39, { nome: "domanda_settimanale", stato: "si" }),
    ev("funzione", 38, { nome: "domanda_settimanale", voto: 5 }, "00000000-0000-0000-0000-00000000000d"),
    ev("funzione", 37, { nome: "domanda_settimanale", stato: "si" }, "00000000-0000-0000-0000-00000000000d"),
    ev("funzione", 36, { nome: "domanda_settimanale", stato: "no" }, "00000000-0000-0000-0000-00000000000e"),
  ])) }]);
  await wp.setViewportSize({ width: 390, height: 844 });
  await wp.goto(`${BASE}/admin/numeri?giorni=7`, { waitUntil: "networkidle" });
  const uf = (await wp.getByTestId("numeri-utile-funzioni").textContent().catch(() => "")) ?? "";
  ok(uf.includes("Assistente") && uf.includes("67%") && uf.includes("Sorprendimi") && uf.includes("Prenotazione") && uf.includes("Serata a tappe"), `pannello: % utile per funzione (${uf.slice(0, 160)})`);
  ok(((await wp.getByTestId("numeri-utile-motivi").textContent().catch(() => "")) ?? "").includes("Troppo lento"), "pannello: cosa mancava dopo un 👎");
  const st = (await wp.getByTestId("numeri-settimanale").textContent().catch(() => "")) ?? "";
  ok(st.includes("4,5/5") && st.includes("67%") && st.includes("netto +33"), `pannello: voto medio settimanale e 'lo consiglierebbe' (${st})`);
  ok(!((await wp.getByTestId("numeri-funzioni").textContent().catch(() => "")) ?? "").includes("domanda settimanale"), "pannello: la domanda settimanale non finisce tra le funzioni");
  ok(((await wp.getByTestId("numeri-utile").textContent().catch(() => "")) ?? "").includes("su 5 voti"), "pannello: 👍/👎 totali (il motivo non conta come voto)");
  { const w = await wp.evaluate(() => document.scrollingElement.scrollWidth); ok(w <= 390, `pannello valore: niente scorrimento orizzontale (${w}px)`); }
  await wp.getByTestId("numeri-utile").scrollIntoViewIfNeeded();
  await wp.evaluate(() => window.scrollBy(0, -60));
  await wp.screenshot({ path: `${OUT}/76-pannello-valore.png`, caret: "initial" });
  await wctx.close();
}

// ── Pitch (sezione separata): creator, posti in evidenza e trend di zona, premium ─────────────
// 5.6b Creator e critici: badge sul profilo pubblico e "Liste dei creator da seguire" in /amici.
//      Dati finti dal cookie "e2e_social" (campo `creator`); senza creator la sezione non c'è.
if (!fakeUser) console.log("SKIP  creator: dev server senza E2E_FAKE_USER");
else {
  const CR = "00000000-0000-4000-8000-0000000005c1";
  const NORMALE = "00000000-0000-4000-8000-0000000005c2";
  const profC = (id, handle, display_name) => ({ id, handle, display_name, bio: "Trattorie vere, lontano dai giri turistici", city: "Roma", visitati: 2, da_provare: 1, seguaci: 0, seguiti: 0 });
  const svC = (user_id, handle, place_id, name, tags) => ({ user_id, handle, display_name: handle, place_id, name, category: "restaurant", tags, created_at: "2026-10-12T19:00:00Z", address: "Via del Pigneto 10, 00176 Roma RM, Italy", lat: 41.889, lng: 12.53 });
  const socialC = {
    profili: [profC(CR, "sara.mangia", "Sara Mangia"), profC(NORMALE, "luca.rm", "Luca")],
    salvati: [
      svC(CR, "sara.mangia", "44444444-0000-4000-8000-0000000000c1", "Trattoria Pigneto", ["Già visitato", "Trattorie di quartiere"]),
      svC(CR, "sara.mangia", "44444444-0000-4000-8000-0000000000c2", "Osteria Nascosta", ["Già visitato", "Trattorie di quartiere"]),
      svC(CR, "sara.mangia", "44444444-0000-4000-8000-0000000000c3", "Vino Vivo", ["Da provare", "Vini naturali"]),
      svC(NORMALE, "luca.rm", "44444444-0000-4000-8000-0000000000c4", "Bar Luca", ["Da provare", "Colazioni"]),
    ],
    seguo: [],
    mio: { handle: null, display_name: null, bio: null, city: null, is_public: false },
    creator: [{ id: CR, tipo: "Food blogger" }],
  };
  const cctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const cEv = [];
  await cctx.route("**/api/events", (r) => { cEv.push(r.request().postDataJSON()); return r.fulfill({ status: 204, body: "" }); });
  await cctx.route("**/api/places/photo**", (r) => r.fulfill({ status: 429, json: {} }));
  const cp = await cctx.newPage();
  cp.on("pageerror", (e) => errors.push(e.message));
  const setC = (v) => cctx.addCookies([{ name: "e2e_social", value: encodeURIComponent(JSON.stringify(v)), url: BASE }]);
  await setC(socialC);
  await cp.goto(`${BASE}/u/sara.mangia`, { waitUntil: "networkidle" });
  ok(((await cp.getByTestId("badge-creator").first().textContent().catch(() => "")) ?? "").includes("Creator · Food blogger"), "creator: badge 'Creator · Food blogger' sul profilo pubblico");
  await cp.screenshot({ path: `${OUT}/80-creator-profilo.png`, caret: "initial" });
  await cp.goto(`${BASE}/u/luca.rm`, { waitUntil: "networkidle" });
  ok((await cp.getByTestId("badge-creator").count()) === 0, "creator: nessun badge su un profilo normale");
  await cp.goto(`${BASE}/amici`, { waitUntil: "networkidle" });
  const cl = cp.getByTestId("creator-liste");
  ok(await cl.isVisible(), "creator: sezione 'Liste dei creator da seguire' in /amici");
  ok((await cl.getByTestId("creator-card").count()) === 1 && ((await cl.textContent()) ?? "").includes("Sara Mangia") && !((await cl.textContent()) ?? "").includes("Luca"), "creator: solo i creator nella sezione");
  const prima = cl.getByTestId("creator-raccolta").first();
  ok(((await prima.textContent()) ?? "").includes("Trattorie di quartiere") && (await prima.getAttribute("href")) === "/u/sara.mangia/raccolte/Trattorie%20di%20quartiere", "creator: la raccolta pubblica si apre dalla card");
  ok(await cl.getByTestId("segui").isVisible(), "creator: bottone Segui nella card");
  await cp.waitForTimeout(400);
  ok(cEv.some((e) => e.type === "funzione" && e.props?.nome === "creator_liste"), "creator: vista della sezione registrata (trackFeature)");
  { const w = await cp.evaluate(() => document.scrollingElement.scrollWidth); ok(w <= 390, `creator /amici: niente scorrimento orizzontale (${w}px)`); }
  await cl.scrollIntoViewIfNeeded();
  await cp.screenshot({ path: `${OUT}/81-creator-amici.png`, caret: "initial" });
  await setC({ ...socialC, creator: [] });
  await cp.goto(`${BASE}/amici`, { waitUntil: "networkidle" });
  ok((await cp.getByTestId("creator-liste").count()) === 0 && await cp.getByTestId("amici").isVisible(), "creator: senza creator (o senza migrazione) la sezione è nascosta e la pagina regge");
  await cctx.close();
}


// 8.3 Posti in evidenza e 8.4 Trend di zona (dimostrativi, pannello del ristoratore).
{
  const tctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const tEv = [];
  await tctx.route("**/api/events", (r) => { tEv.push(r.request().postDataJSON()); return r.fulfill({ status: 204, body: "" }); });
  const tp = await tctx.newPage();
  tp.on("pageerror", (e) => errors.push(e.message));
  await tp.goto(`${BASE}/ristoratore/demo`, { waitUntil: "networkidle" });
  await tp.getByRole("tab", { name: "Zona" }).click();
  const trend = tp.getByTestId("pannello-trend");
  ok(await trend.isVisible() && (await trend.getByTestId("trend-fascia").count()) === 6 && (await trend.getByTestId("trend-esempio").count()) === 0 && await trend.getByTestId("trend-picco").isVisible(), "trend di zona (demo): sei fasce orarie con le richieste e il momento di picco");
  ok((await trend.getByTestId("trend-fascia").locator("visible=true").count()) === 3, "trend di zona (demo): aperte le 3 fasce più cercate, le altre dietro 'Vedi tutto'");
  await tp.getByRole("tab", { name: "Promozione" }).click();
  const evd = tp.getByTestId("pannello-evidenza");
  ok(await evd.isVisible() && ((await evd.getByTestId("etichetta-sponsorizzato").textContent()) ?? "").includes("Sponsorizzato"), "in evidenza (demo): card con l'etichetta 'Sponsorizzato'");
  ok((await evd.getByTestId("evidenza-si").count()) === 1 && (await evd.getByTestId("evidenza-no").count()) === 2, "in evidenza (demo): compare solo nella ricerca adatta, non nelle altre due");
  ok(((await evd.getByTestId("evidenza-no").last().textContent()) ?? "").includes("terrazza"), "in evidenza (demo): spiega cosa manca (terrazza)");
  await tp.waitForTimeout(400);
  ok(tEv.some((e) => e.type === "funzione" && e.props?.nome === "ristoratore_evidenza"), "in evidenza (demo): vista registrata (trackFeature)");
  { const w = await tp.evaluate(() => document.documentElement.scrollWidth); ok(w <= 390, `trend e in evidenza: niente scorrimento orizzontale (${w}px)`); }
  await tp.getByRole("tab", { name: "Zona" }).click(); await trend.scrollIntoViewIfNeeded();
  await tp.screenshot({ path: `${OUT}/90-trend-zona-demo.png`, caret: "initial" });
  await tp.getByRole("tab", { name: "Promozione" }).click(); await evd.scrollIntoViewIfNeeded();
  await tp.screenshot({ path: `${OUT}/91-in-evidenza-demo.png`, caret: "initial" });
  // Nei risultati veri non c'è nessuno sponsorizzato: la parola non compare nel codice della ricerca.
  { const src = ["src/app/api/search/route.ts", "src/components/venue-sheet.tsx", "src/components/place-card.tsx"].map((f) => { try { return readFileSync(new URL(`../../${f}`, import.meta.url), "utf8"); } catch { return ""; } }).join("\n");
    ok(!/sponsorizzat/i.test(src), "in evidenza: nessuno sponsorizzato nei risultati veri della ricerca"); }
  // Pannello vero con pochi dati: il trend è un esempio DICHIARATO.
  if (fakeUser) {
    const LT = "44444444-0000-4000-8000-0000000000d1";
    const Lt = { id: LT, name: "Bar Prova Trend", address: "Via del Pigneto 1, 00176 Roma RM, Italy", category: "bar", lat: 41.888, lng: 12.53, google_place_id: "GTREND" };
    await tctx.addCookies([{ name: "e2e_ristoratore", url: BASE, value: encodeURIComponent(JSON.stringify({ locale: Lt, simili: [Lt], verificato: false, salvati: [], eventi: [
      { created_at: new Date(Date.now() - 3_600_000).toISOString(), type: "ricerca", user_id: null, anon_id: "t1", session_id: "t1", place_id: null, google_place_id: null, props: { modo: "ai", tipo: "bar", requisiti: ["tavoli all'aperto"], zona: "Pigneto" } },
    ] })) }]);
    await tp.goto(`${BASE}/ristoratore/${LT}`, { waitUntil: "networkidle" }); await tp.getByRole("tab", { name: "Zona" }).click();
    ok(await tp.getByTestId("trend-esempio").isVisible() && (await tp.getByTestId("pannello-evidenza").count()) === 0, "trend di zona (pannello vero, pochi dati): esempio etichettato 'Esempio', niente sezione sponsorizzati");
  } else console.log("SKIP  trend pannello vero: dev server senza E2E_FAKE_USER");
  await tctx.close();
}

// 8b Utente premium: /premium con l'elenco "in arrivo", nessun pagamento, "Mi interessa" registrato.
{
  const pmctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const pmEv = [];
  await pmctx.route("**/api/events", (r) => { pmEv.push(r.request().postDataJSON()); return r.fulfill({ status: 204, body: "" }); });
  const pm = await pmctx.newPage();
  pm.on("pageerror", (e) => errors.push(e.message));
  const r = await pm.goto(`${BASE}/premium`, { waitUntil: "networkidle" });
  ok(r?.status() === 200 && (await pm.getByRole("heading", { level: 1 }).textContent()) === "Mapetite Premium" && (await pm.getByTestId("premium-funzione").count()) >= 3, "premium: pagina con l'elenco delle funzioni");
  const body = (await pm.getByTestId("premium").textContent()) ?? "";
  ok(body.includes("Assistente senza limiti") && body.includes("Raccolte e mappe illimitate") && body.includes("Serate organizzate") && body.includes("In arrivo"), "premium: assistente senza limiti, raccolte illimitate, serate organizzate, tutto 'in arrivo'");
  ok(await pm.getByTestId("premium-nessun-pagamento").isVisible() && !/€|\bcarta\b|abbonati ora|paga ora/i.test(body), "premium: nessun prezzo né pagamento");
  await pm.getByTestId("premium-interesse").first().click();
  await pm.getByTestId("premium-interesse-fatto").first().waitFor({ timeout: 3000 }).catch(() => {});
  ok(await pm.getByTestId("premium-interesse-fatto").first().isVisible() && pmEv.some((e) => e.type === "funzione" && e.props?.nome === "premium_interesse" && e.props?.contesto === "assistente"), "premium: 'Mi interessa' registrato (trackFeature) e confermato");
  ok(pmEv.some((e) => e.type === "funzione" && e.props?.nome === "premium"), "premium: vista della pagina registrata");
  await pm.reload({ waitUntil: "networkidle" });
  ok((await pm.getByTestId("premium-interesse-fatto").count()) === 1, "premium: 'Mi interessa' ricordato ricaricando");
  { const w = await pm.evaluate(() => document.scrollingElement.scrollWidth); ok(w <= 390, `premium: niente scorrimento orizzontale (${w}px)`); }
  await pm.screenshot({ path: `${OUT}/92-premium.png`, caret: "initial" });
  if (fakeUser) {
    await pmctx.addCookies([{ name: "e2e_profilo", value: encodeURIComponent(JSON.stringify({ email: "tester@example.com", saved: [], reviews: [] })), url: BASE }]);
    await pm.goto(`${BASE}/profilo`, { waitUntil: "networkidle" });
    ok((await pm.getByTestId("profilo-premium").getAttribute("href")) === "/premium", "premium: collegato dal profilo");
    ok((await pm.getByTestId("profilo-ristoratori").getAttribute("href")) === "/per-i-ristoratori", "profilo: link 'Mapetite per i ristoratori'");
  } else console.log("SKIP  premium dal profilo: dev server senza E2E_FAKE_USER");
  await pmctx.close();
}

// 19. Liste di gruppo (piano 5.5): /gruppi, /gruppi/<id>, /gruppi/entra/<codice>, "Proponi" dalla scheda.
//     Il server legge i dati finti dal cookie "e2e_gruppi"; senza cookie le liste sono "in arrivo"
//     (come in produzione finché la migrazione 20261016_liste_gruppo non è applicata).
//     Le scritture verso Supabase (rpc, gruppi_posti, gruppi_voti) sono simulate e registrate.
if (!fakeUser) console.log("SKIP  liste di gruppo: dev server senza E2E_FAKE_USER");
else {
  const ME = "00000000-0000-0000-0000-000000000001";
  const G1 = "00000000-0000-4000-8000-0000000006a1";
  const G2 = "00000000-0000-4000-8000-0000000006a2";
  const CODICE = "abcd1234ef";
  const PL = (n) => `00000000-0000-4000-8000-0000000006b${n}`;
  const posto = (id, place, name, category, voti, votanti, created_at, extra = {}) => ({
    posto_id: id, place_id: place, google_place_id: null, name, category, address: "Via del Moro 12, 00153 Roma RM, Italy",
    lat: 41.889, lng: 12.469, aggiunto_da: "u-giulia", aggiunto_da_nome: "Giulia", created_at, voti, votanti, ho_votato: false, ...extra,
  });
  const gruppo = { id: G1, nome: "Cene del giovedì", emoji: "🍽️", codice: CODICE, creato_da: ME, created_at: "2026-10-14T10:00:00Z", membri: 3, posti: 2, voti: 3 };
  const dati = {
    gruppi: [gruppo],
    membri: { [G1]: [{ user_id: ME, nome: "Lorenzo" }, { user_id: "u-giulia", nome: "Giulia" }, { user_id: "u-marco", nome: "Marco" }] },
    posti: { [G1]: [
      posto("pA", PL(1), "Trattoria Uno", "restaurant", 1, ["Giulia"], "2026-10-14T11:00:00Z"),
      posto("pB", PL(2), "Osteria Due", "restaurant", 2, ["Giulia", "Marco"], "2026-10-14T12:00:00Z"),
    ] },
    inviti: { [CODICE]: { id: G1, nome: "Cene del giovedì", emoji: "🍽️", membri: 3, posti: 2, sono_dentro: false } },
  };
  const profiloG = {
    email: "tester@example.com",
    saved: [
      { created_at: "2026-10-10", tags: ["Da provare"], note: null, places: { id: PL(3), name: "Forno Tre", category: "bakery", address: "Via Ostiense 50, Roma", lat: 41.87, lng: 12.48 } },
      { created_at: "2026-10-09", tags: ["Già visitato"], note: null, places: { id: PL(1), name: "Trattoria Uno", category: "restaurant", address: "Via del Moro 12, Roma", lat: 41.889, lng: 12.469 } },
    ],
    reviews: [],
  };
  const setCookie = (c, name, v) => c.addCookies([{ name, value: encodeURIComponent(JSON.stringify(v)), url: BASE }]);
  const gctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const gEv = [];
  const writes = [];
  await gctx.route("**/api/events", (r) => { gEv.push(r.request().postDataJSON()); return r.fulfill({ status: 204, body: "" }); });
  await gctx.route("**/api/places/photo**", (r) => r.fulfill({ status: 429, json: {} }));
  await gctx.route("**/rest/v1/rpc/crea_gruppo**", (r) => { writes.push({ t: "crea", body: r.request().postDataJSON() }); return r.fulfill({ json: [{ id: G1, codice: CODICE }] }); });
  await gctx.route("**/rest/v1/rpc/entra_gruppo**", (r) => { writes.push({ t: "entra", body: r.request().postDataJSON() }); return r.fulfill({ json: G1 }); });
  await gctx.route("**/rest/v1/gruppi_posti**", (r) => { writes.push({ t: `posti-${r.request().method()}`, body: r.request().postDataJSON?.() ?? null }); return r.fulfill({ json: { id: "pNuovo" } }); });
  await gctx.route("**/rest/v1/gruppi_voti**", (r) => { writes.push({ t: `voti-${r.request().method()}`, body: r.request().method() === "POST" ? r.request().postDataJSON() : null, url: r.request().url() }); return r.fulfill({ status: r.request().method() === "POST" ? 201 : 204, body: "" }); });
  const gp = await gctx.newPage();
  gp.on("pageerror", (e) => errors.push(e.message));
  const noHScroll = async (label) => { const w = await gp.evaluate(() => document.scrollingElement.scrollWidth); ok(w <= 390, `${label}: niente scorrimento orizzontale (${w}px)`); };

  // In arrivo: senza dati (migrazione non applicata) nessuna pagina si rompe.
  await setCookie(gctx, "e2e_profilo", profiloG);
  for (const path of ["/gruppi", `/gruppi/${G1}`, `/gruppi/entra/${CODICE}`]) {
    const r = await gp.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
    ok(r?.status() === 200 && await gp.getByTestId("gruppi-in-arrivo").isVisible(), `gruppi in arrivo: ${path} dice 'in arrivo' invece di rompersi`);
  }
  await gp.goto(`${BASE}/profilo`, { waitUntil: "networkidle" });
  // Semplificare 5 (17/10): le liste di gruppo si aprono da Amici (chip "Liste di gruppo"), non più dal profilo.
  ok((await gp.getByTestId("profilo-gruppi").count()) === 0, "profilo: niente 'Liste di gruppo' (stanno in Amici)");

  // Senza account: invito alla registrazione, e il link d'invito torna qui dopo.
  await setCookie(gctx, "e2e_gruppi", dati);
  await gctx.addCookies([{ name: "e2e_anonimo", value: "1", url: BASE }]);
  await gp.goto(`${BASE}/gruppi`, { waitUntil: "networkidle" });
  ok(await gp.getByTestId("gruppi-accedi").isVisible(), "gruppi senza account: 'Accedi' invece della pagina");
  await gp.goto(`${BASE}/gruppi/entra/${CODICE}`, { waitUntil: "networkidle" });
  ok((await gp.getByTestId("gruppo-invito-titolo").textContent()) === "Cene del giovedì" && await gp.getByText("3 persone · 2 posti").isVisible(), "invito di gruppo: nome della lista e numeri (senza nomi né posti)");
  ok((await gp.getByTestId("gruppo-invito-registrati").getAttribute("href")) === `/signup?next=${encodeURIComponent(`/gruppi/entra/${CODICE}`)}`, "invito di gruppo: 'Crea un account ed entra' torna all'invito");
  ok((await gp.locator("body").innerText()).includes("Giulia") === false, "invito di gruppo: nessun nome dei membri prima di entrare");
  await noHScroll("invito di gruppo");
  await gp.screenshot({ path: `${OUT}/93-gruppi-invito.png`, caret: "initial" });
  await gctx.clearCookies({ name: "e2e_anonimo" });

  // Con account: entra con il proprio nome.
  await gp.goto(`${BASE}/gruppi/entra/${CODICE}`, { waitUntil: "networkidle" });
  await gp.locator("#entra-nome").fill("Lorenzo");
  await gp.getByTestId("gruppo-entra").click();
  await gp.waitForURL(`**/gruppi/${G1}`, { timeout: 8000 }).catch(() => {});
  { const w = writes.find((x) => x.t === "entra"); ok(w?.body?.p_codice === CODICE && w?.body?.p_mio_nome === "Lorenzo" && new URL(gp.url()).pathname === `/gruppi/${G1}`, `invito di gruppo: 'Entra nella lista' entra con il codice e apre la lista (${gp.url()})`); }
  await setCookie(gctx, "e2e_gruppi", { ...dati, inviti: { [CODICE]: { ...dati.inviti[CODICE], sono_dentro: true } } });
  await gp.goto(`${BASE}/gruppi/entra/${CODICE}`, { waitUntil: "networkidle" });
  ok((await gp.getByTestId("gruppo-invito-apri").getAttribute("href")) === `/gruppi/${G1}`, "invito di gruppo: chi è già dentro ha 'Apri la lista'");
  await gp.goto(`${BASE}/gruppi/entra/zz`, { waitUntil: "networkidle" });
  ok(await gp.getByTestId("gruppo-invito-non-valido").isVisible(), "invito di gruppo: codice sbagliato = 'Invito non valido'");

  // Elenco.
  await setCookie(gctx, "e2e_gruppi", dati);
  await gp.goto(`${BASE}/gruppi`, { waitUntil: "networkidle" });
  { const r = gp.getByTestId("gruppo-riga"); ok((await r.count()) === 1 && (await r.first().innerText()).includes("Cene del giovedì") && (await r.first().innerText()).includes("3 persone · 2 posti"), "gruppi: elenco delle liste con persone e posti"); }
  ok((await gp.locator("nav a[aria-current=page]").allInnerTexts()).some((t) => t.includes("Amici")), "gruppi: pagina sotto la voce 'Amici' della barra");
  await noHScroll("gruppi");
  await gp.screenshot({ path: `${OUT}/94-gruppi-elenco.png`, caret: "initial" });

  // Lista: il più votato in cima, 👍 sposta l'ordine, "Proponi dai tuoi salvati".
  await gp.goto(`${BASE}/gruppi/${G1}`, { waitUntil: "networkidle" });
  const names = async () => (await gp.getByTestId("gruppo-posto").allInnerTexts()).map((t) => t.includes("Osteria Due") ? "Osteria Due" : t.includes("Trattoria Uno") ? "Trattoria Uno" : t.includes("Forno Tre") ? "Forno Tre" : "?");
  ok((await names()).join(",") === "Osteria Due,Trattoria Uno", `lista di gruppo: il più votato in cima (${(await names()).join(", ")})`);
  ok((await gp.getByTestId("gruppo-posto").first().getByTestId("gruppo-in-testa").count()) === 1, "lista di gruppo: '🏆 In testa' sul più votato");
  ok((await gp.getByTestId("gruppo-posto").first().innerText()).includes("Piace a Giulia e Marco"), "lista di gruppo: si vede a chi piace");
  ok((await gp.getByTestId("gruppo-membri").innerText()).includes("Tu") && (await gp.getByTestId("gruppo-membri").innerText()).includes("Marco"), "lista di gruppo: chi c'è nella lista (tu per primo)");
  // 18/10: con gli amici già dentro l'invito è un pulsante "Invita" accanto al nome, niente riquadro grande.
  ok(await gp.getByTestId("gruppo-condividi").isVisible() && (await gp.getByTestId("gruppo-condividi").textContent())?.trim() === "Invita" && (await gp.getByTestId("gruppo-invita").count()) === 0, "lista di gruppo: 'Invita' compatto accanto al nome, niente riquadro grande");
  await noHScroll("lista di gruppo");
  await gp.screenshot({ path: `${OUT}/95-gruppo-lista.png`, caret: "initial" });
  const trattoria = gp.getByTestId("gruppo-posto").filter({ hasText: "Trattoria Uno" });
  await trattoria.getByTestId("gruppo-vota").click();
  await gp.waitForTimeout(300);
  { const v = writes.find((x) => x.t === "voti-POST"); ok(v?.body?.posto_id === "pA" && v?.body?.user_id === ME, "lista di gruppo: 👍 registra il voto a tuo nome"); }
  ok((await trattoria.getByTestId("gruppo-vota").getAttribute("aria-pressed")) === "true" && (await trattoria.getByTestId("gruppo-vota").innerText()).trim() === "2", "lista di gruppo: 👍 acceso e conteggio +1");
  ok((await names())[0] === "Trattoria Uno" && (await gp.getByTestId("gruppo-in-testa").count()) === 0, "lista di gruppo: a pari voti sale chi è stato proposto prima, nessuno 'in testa'");
  await gp.getByTestId("gruppo-posto").filter({ hasText: "Trattoria Uno" }).getByTestId("gruppo-vota").click();
  await gp.waitForTimeout(300);
  ok(writes.some((x) => x.t === "voti-DELETE" && x.url.includes("posto_id=eq.pA")) && (await names())[0] === "Osteria Due", "lista di gruppo: secondo tocco toglie il voto e l'ordine torna");
  await gp.getByTestId("gruppo-aggiungi").click();
  ok((await gp.getByTestId("gruppo-salvato").count()) === 1 && (await gp.getByTestId("gruppo-salvato").innerText()).includes("Forno Tre"), "lista di gruppo: tra i tuoi salvati solo quelli non ancora proposti");
  await gp.getByTestId("gruppo-salvato").click();
  await gp.waitForTimeout(300);
  { const w = writes.find((x) => x.t === "posti-POST"); ok(w?.body?.gruppo_id === G1 && w?.body?.place_id === PL(3) && w?.body?.aggiunto_da === ME, "lista di gruppo: 'Proponi' aggiunge il salvato (UUID del locale, a tuo nome)"); }
  ok((await gp.getByTestId("gruppo-posto").count()) === 3 && (await names())[2] === "Forno Tre" && (await gp.getByTestId("gruppo-posto").filter({ hasText: "Forno Tre" }).innerText()).includes("proposto da te"), "lista di gruppo: il posto proposto compare in fondo (0 voti), 'proposto da te'");
  ok((await gp.getByTestId("gruppo-numeri").textContent()) === "3 persone · 3 posti", "lista di gruppo: i numeri si aggiornano");
  const nonTrovato = await gp.goto(`${BASE}/gruppi/${G2}`, { waitUntil: "networkidle" });
  ok(nonTrovato?.status() === 200 && await gp.getByTestId("gruppo-non-trovato").isVisible(), "lista di gruppo: chi non è membro vede 'Lista non disponibile'");

  // Nuova lista: dal vuoto, form già aperto, poi la lista con l'invito in evidenza.
  await setCookie(gctx, "e2e_gruppi", { ...dati, gruppi: [] });
  await gp.goto(`${BASE}/gruppi`, { waitUntil: "networkidle" });
  ok(await gp.getByTestId("nuova-lista-form").isVisible() && await gp.getByTestId("crea-lista").isDisabled(), "nuova lista: senza liste il modulo è già aperto (e serve un nome)");
  await gp.getByRole("button", { name: "🍽️ Cene del giovedì" }).click();
  await gp.locator("#gruppo-mio-nome").fill("Lorenzo");
  await gp.screenshot({ path: `${OUT}/96-gruppi-nuova.png`, caret: "initial" });
  await setCookie(gctx, "e2e_gruppi", dati);
  await gp.getByTestId("crea-lista").click();
  await gp.waitForURL(`**/gruppi/${G1}?nuova=1`, { timeout: 8000 }).catch(() => {});
  { const w = writes.find((x) => x.t === "crea"); ok(w?.body?.p_nome === "Cene del giovedì" && w?.body?.p_emoji === "🍽️" && w?.body?.p_mio_nome === "Lorenzo", "nuova lista: crea con nome, simbolo e il tuo nome"); }
  ok((await gp.getByTestId("gruppo-invita").innerText().catch(() => "")).includes("Lista creata! Ora invita gli amici"), "nuova lista: si apre la lista con l'invito in evidenza");

  // Dalla scheda di un locale salvato: "Proponi in una lista di gruppo" → scegli la lista.
  const before = writes.filter((x) => x.t === "posti-POST").length;
  await gp.goto(`${BASE}/gruppi?proponi=${PL(3)}`, { waitUntil: "networkidle" });
  ok((await gp.getByTestId("gruppi-proponi").textContent())?.includes("Forno Tre"), "proponi: 'Scegli la lista in cui proporre Forno Tre'");
  await gp.getByRole("button", { name: "Proponi in Cene del giovedì" }).click();
  await gp.waitForURL(`**/gruppi/${G1}`, { timeout: 8000 }).catch(() => {});
  ok(writes.filter((x) => x.t === "posti-POST").length === before + 1 && new URL(gp.url()).pathname === `/gruppi/${G1}`, "proponi: tocco sulla lista = posto proposto e lista aperta");
  {
    const saved = [{ tags: ["Da provare"], note: null, places: { id: PL(3), name: "Forno Tre", category: "bakery", address: "Via Ostiense 50, Roma", lat: 41.9, lng: 12.49, google_place_id: "GF3" } }];
    await gctx.route("**/rest/v1/saved_places**", (r) => r.request().url().includes("select=place_id") ? r.fulfill({ json: saved.map((x) => ({ place_id: x.places.id })) }) : r.fulfill({ json: saved }));
    await gctx.route("**/rest/v1/place_synthesis**", (r) => r.fulfill({ json: [] }));
    await gp.goto(`${BASE}/mappa?vista=salvati`, { waitUntil: "networkidle" });
    await gp.locator("ul.snap-x li").first().locator("button").last().click({ timeout: 5000 }).catch(() => {});
    await gp.getByTestId("altro-apri").click({ timeout: 5000 }).catch(() => {});
    await gp.getByTestId("proponi-gruppo").waitFor({ timeout: 4000 }).catch(() => {});
    ok((await gp.getByTestId("proponi-gruppo").getAttribute("href").catch(() => null)) === `/gruppi?proponi=${PL(3)}`, "scheda salvato: 'Proponi in una lista di gruppo' porta alla scelta della lista");
  }

  // Segnali: ogni azione manda il suo nome, con chiavi che il server conserva.
  { const nomi = gEv.filter((e) => e.type === "funzione").map((e) => e.props?.nome);
    ok(["gruppo_entra", "gruppo_voto", "gruppo_aggiungi", "gruppo_crea"].every((n) => nomi.includes(n)), `segnali gruppi: entra, voto, aggiungi, crea (${[...new Set(nomi)].join(", ")})`);
    const lost = droppedKeys(gEv.filter((e) => String(e.props?.nome ?? "").startsWith("gruppo_")));
    ok(lost.length === 0, `segnali gruppi: chiavi tutte conservate dal server (${lost.join(", ") || "nessuna scartata"})`); }
  await gctx.close();
}

// ─── Community nella scheda del locale: recensioni degli utenti e reel (PIANO-25-OTTOBRE.md 5.6c, 5.6d) ───
// Dati finti dal cookie "e2e_community" (letto da src/lib/community.ts solo in sviluppo), scritture
// verso Supabase e anteprime oEmbed intercettate qui: nessuna chiamata vera a Google, TikTok o Supabase.
if (!fakeUser) console.log("SKIP  community del locale: dev server senza E2E_FAKE_USER");
else {
  const CID = "55555555-0000-4000-8000-000000000005";
  const locC = { place: { id: CID, name: "Osteria del Pigneto", address: "Via del Pigneto 41, 00176 Roma RM, Italy", lat: 41.888, lng: 12.53, category: "restaurant", rating: 4.5, price_level: 2, google_place_id: "GPIGNETO" }, synthesis: null };
  const cctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const setC = (name, value) => cctx.addCookies([{ name, value: encodeURIComponent(JSON.stringify(value)), url: BASE }]);
  await setC("e2e_locale", locC);
  const cEv = [];
  await cctx.route("**/api/events", (r) => { cEv.push(r.request().postDataJSON()); return r.fulfill({ status: 204, body: "" }); });
  await cctx.route("**/rest/v1/saved_places**", (r) => r.fulfill({ json: [] }));
  let reviewPost = null;
  await cctx.route("**/rest/v1/reviews**", (r) => {
    if (r.request().method() === "POST") { reviewPost = r.request().postDataJSON(); return r.fulfill({ status: 201, body: "" }); }
    return r.fulfill({ json: [] });
  });
  let reelPost = null;
  await cctx.route("**/rest/v1/contenuti_locali**", (r) => {
    if (r.request().method() === "POST") { reelPost = r.request().postDataJSON(); return r.fulfill({ status: 201, body: "" }); }
    return r.fulfill({ json: [] });
  });
  const oembedAsked = [];
  await cctx.route("**/api/places/oembed**", (r) => {
    oembedAsked.push(new URL(r.request().url()).searchParams.get("url"));
    return r.fulfill({ json: { titolo: "La carbonara più sincera del Pigneto", autore: "mangiaroma", miniatura: "https://miniature.test/tt.jpg" } });
  });
  await cctx.route("https://miniature.test/**", (r) => r.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="180" height="320"><rect width="180" height="320" fill="#a0522d"/></svg>' }));
  await cctx.route("https://www.tiktok.com/**", (r) => r.fulfill({ contentType: "text/html", body: "<html><body>TikTok</body></html>" }));
  const cp = await cctx.newPage();
  cp.on("pageerror", (e) => errors.push(e.message));
  const section = cp.getByTestId("community-pubblica");
  const txt = async (loc) => (await loc.textContent().catch(() => "")) ?? "";

  // 1. Nessuna recensione: la sezione c'è e invita a scrivere la prima; senza migrazione niente reel.
  await cp.goto(`${BASE}/locali/${CID}`, { waitUntil: "networkidle" });
  await cp.getByTestId("community-locale").waitFor({ timeout: 5000 }).catch(() => {});
  ok(await section.isVisible() && (await txt(section)).includes("Dalla community Mapetite"), "community: la pagina del locale ha la sezione 'Dalla community Mapetite'");
  ok(await cp.getByTestId("community-vuota").isVisible() && await cp.getByTestId("recensione-form").isVisible(), "community: senza recensioni invita a scrivere la prima (modulo visibile)");
  ok((await cp.getByTestId("reel-sezione").count()) === 0, "community: migrazione non applicata (reelPronti false) → nessuna sezione reel, nessun errore");

  // 2. Recensioni degli altri (prima chi segui) e un reel TikTok con l'anteprima ufficiale.
  await setC("e2e_community", {
    recensioni: [
      { id: "r1", rating: 5, comment: "Carbonara da applausi, chiedete il tavolo in fondo.", created_at: "2026-10-10T20:00:00Z", autore: { user_id: "u-giulia", handle: "giulia.rm", display_name: "Giulia" }, amico: true },
      { id: "r2", rating: 4, comment: null, created_at: "2026-10-12T20:00:00Z", autore: null, amico: false },
    ],
    mia: null,
    reel: [{ id: "v1", url: "https://www.tiktok.com/@mangiaroma/video/7420000000000000001", fonte: "TikTok", autore: { user_id: "u-giulia", handle: "giulia.rm", display_name: "Giulia" }, mio: false }],
    reelPronti: true,
  });
  await cp.goto(`${BASE}/locali/${CID}`, { waitUntil: "networkidle" });
  await cp.getByTestId("community-media").waitFor({ timeout: 5000 }).catch(() => {});
  const media = cp.getByTestId("community-media");
  ok((await txt(media)).includes("4,5") && (await txt(media)).includes("2 recensioni Mapetite"), `community: media e numero delle recensioni Mapetite (${await txt(media)})`);
  const rows = cp.getByTestId("recensione-community");
  ok((await rows.count()) === 2 && (await txt(rows.nth(0))).includes("Giulia") && (await txt(rows.nth(0))).includes("Amico") && await rows.nth(0).getByRole("link", { name: "Giulia" }).getAttribute("href") === "/u/giulia.rm", "community: prima la recensione di chi segui, con il link al profilo");
  ok((await txt(rows.nth(1))).includes("Un membro di Mapetite"), "community: chi ha il profilo privato resta anonimo");
  const reelSec = cp.getByTestId("reel-sezione");
  await cp.getByTestId("reel-locale").first().getByText("La carbonara più sincera").waitFor({ timeout: 4000 }).catch(() => {});
  ok((await txt(reelSec)).includes("Visto su TikTok") && (await cp.getByTestId("reel-locale").count()) === 1 && (await txt(cp.getByTestId("reel-locale").first())).includes("@mangiaroma"), "community: 'Visto su TikTok' con titolo e autore dall'oEmbed");
  ok(oembedAsked.length >= 1 && oembedAsked.every((u) => u?.startsWith("https://www.tiktok.com/")), "community: l'anteprima si chiede solo all'oEmbed, con il link del video");
  ok(await cp.getByTestId("reel-locale").first().getAttribute("href") === "https://www.tiktok.com/@mangiaroma/video/7420000000000000001" && await cp.getByTestId("reel-locale").first().getAttribute("target") === "_blank", "community: il reel si apre sulla piattaforma (nuova scheda)");
  ok(cEv.some((e) => e.props?.nome === "community_scheda" && e.props?.risultati === 2 && e.props?.stato === "con_reel"), "community: registrata la vista della sezione con recensioni e reel");
  await section.scrollIntoViewIfNeeded();
  await cp.screenshot({ path: `${OUT}/97-community-locale.png`, caret: "initial" });
  { const [pop] = await Promise.all([cctx.waitForEvent("page", { timeout: 3000 }).catch(() => null), cp.getByTestId("reel-locale").first().click()]);
    await pop?.close().catch(() => {});
    await cp.waitForTimeout(200);
    ok(cEv.some((e) => e.props?.nome === "reel" && e.props?.stato === "aperto" && e.props?.fonte === "TikTok"), "community: aprire un reel è registrato (fonte TikTok)"); }

  // 3. La tua recensione: senza stelle non parte, con 4 stelle e due righe si pubblica.
  const form = cp.getByTestId("recensione-form");
  await form.getByRole("button", { name: "Pubblica" }).click();
  ok((await txt(form)).includes("Scegli da 1 a 5 stelle") && reviewPost == null, "community: senza stelle la recensione non parte");
  await form.getByRole("radio", { name: "4 stelle" }).click();
  await form.getByLabel("Il tuo commento").fill("Amatriciana vera, sala piccola: prenotate.");
  await form.getByRole("button", { name: "Pubblica" }).click();
  await cp.getByTestId("mia-recensione").waitFor({ timeout: 4000 }).catch(() => {});
  ok(reviewPost?.rating === 4 && reviewPost?.comment === "Amatriciana vera, sala piccola: prenotate." && reviewPost?.place_id === CID && reviewPost?.user_id === process.env.E2E_FAKE_USER, `community: recensione scritta a proprio nome sul locale (${JSON.stringify(reviewPost)})`);
  ok(await cp.getByTestId("mia-recensione").isVisible() && (await txt(cp.getByTestId("mia-recensione"))).includes("Pubblicata") && (await txt(media)).includes("3 recensioni"), "community: dopo la pubblicazione 'La tua recensione' e la media aggiornata");
  { const r = cEv.filter((e) => e.props?.nome === "recensione_community");
    ok(r.length === 1 && r[0].props.voto === 4 && r[0].props.stato === "nuova" && r[0].props.contesto === "locale", `community: recensione registrata come evento (${JSON.stringify(r[0]?.props ?? null)})`);
    const lost = droppedKeys([...r, ...cEv.filter((e) => e.props?.nome === "reel" || e.props?.nome === "community_scheda")]);
    ok(lost.length === 0, `community: chiavi degli eventi tutte conservate dal server (${lost.join(", ") || "nessuna scartata"})`); }

  // 4. Collegare un reel: link non valido → messaggio; reel Instagram → link pulito, fonte giusta.
  await cp.getByTestId("reel-aggiungi").click();
  const rf = cp.getByTestId("reel-form");
  await rf.getByLabel("Link del video").fill("https://example.com/video");
  await rf.getByRole("button", { name: "Collega" }).click();
  ok(await cp.getByTestId("reel-errore").isVisible() && reelPost == null, "community: un link che non è un reel non si salva");
  await rf.getByLabel("Link del video").fill("https://www.instagram.com/reel/C9xYz12AbCd/?igsh=MTRhbmVzZ3B4");
  await rf.getByRole("button", { name: "Collega" }).click();
  await cp.waitForTimeout(400);
  ok(reelPost?.url === "https://www.instagram.com/reel/C9xYz12AbCd" && reelPost?.fonte === "Instagram" && reelPost?.place_id === CID && Object.keys(reelPost ?? {}).sort().join() === "fonte,place_id,url,user_id", `community: reel salvato con il solo link pulito (${JSON.stringify(reelPost)})`);
  ok((await cp.getByTestId("reel-locale").count()) === 2 && (await txt(reelSec)).includes("Visto sui social") && (await txt(reelSec)).includes("Salvato da te"), "community: il reel nuovo compare subito ('Visto sui social')");
  ok(cEv.some((e) => e.props?.nome === "reel" && e.props?.stato === "aggiunto" && e.props?.fonte === "Instagram"), "community: collegare un reel è registrato");
  ok(oembedAsked.every((u) => !u?.includes("instagram.com")), "community: per Instagram nessuna richiesta oEmbed (serve un token Meta): solo il link");
  await reelSec.scrollIntoViewIfNeeded();
  await cp.screenshot({ path: `${OUT}/98-community-reel.png`, caret: "initial" });

  // 5. Telefono piccolo (360 px): niente scorrimento orizzontale della pagina (i reel scorrono nella loro fila).
  await cp.setViewportSize({ width: 360, height: 780 });
  await cp.reload({ waitUntil: "networkidle" });
  await cp.getByTestId("community-locale").waitFor({ timeout: 5000 }).catch(() => {});
  ok(await cp.evaluate(() => document.documentElement.scrollWidth - innerWidth) <= 0, "community 360px: niente scorrimento orizzontale");

  // 6. Senza accesso: si leggono le recensioni, per scrivere serve "Accedi" (che riporta al locale).
  await setC("e2e_anonimo", 1);
  await cp.setViewportSize({ width: 390, height: 844 });
  await cp.reload({ waitUntil: "networkidle" });
  await cp.getByTestId("community-locale").waitFor({ timeout: 5000 }).catch(() => {});
  const acc = section.getByRole("link", { name: "Accedi" });
  ok((await cp.getByTestId("recensione-form").count()) === 0 && (await cp.getByTestId("reel-aggiungi").count()) === 0 && decodeURIComponent((await acc.getAttribute("href").catch(() => "")) ?? "") === `/login?next=/locali/${CID}`, "community senza accesso: niente modulo, 'Accedi' riporta al locale");
  ok((await cp.getByTestId("recensione-community").count()) === 2, "community senza accesso: le recensioni si leggono comunque");
  await cctx.close();
}

// Vicino a me adesso e raggio sulla mappa (piano 2.1): una riga in "Ti suggeriamo" e il raggio nei Filtri.
// Una sola ricerca (simulata) per tocco; il cerchio ha la sua misura sul bordo.
{
  let vn = null;
  try { vn = await import(new URL("../../src/lib/vicino.ts", import.meta.url).href); } catch (e) { ok(false, `vicino: modulo src/lib/vicino.ts importabile (${e.message})`); }
  if (vn) {
    const at = (h, m = 0) => vn.nearNowQuery(new Date(2026, 9, 16, h, m)).query;
    ok(/colazione/.test(at(8)) && /pranzo/.test(at(13)) && /aperitivo/.test(at(19)) && /cena/.test(at(21)) && /cocktail/.test(at(1)), "vicino: la ricerca cambia con l'ora (colazione, pranzo, aperitivo, cena, notte)");
    ok(vn.radiusLabel(0.5) === "500 m" && vn.radiusLabel(2) === "2 km", "vicino: misure del raggio in italiano (500 m, 2 km)");
    const c = vn.circlePolygon({ lat: 41.9, lng: 12.49 }, 1000).geometry.coordinates[0];
    ok(c.length === 65 && Math.abs(c[16][1] - 41.9 - 1000 / 111320) < 1e-6, "vicino: il cerchio sulla mappa ha il raggio giusto");
  }
  const vctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, permissions: ["geolocation"], geolocation: { latitude: 41.9001, longitude: 12.4901 } });
  const vEv = [];
  await vctx.route("**/api/events", (r) => { vEv.push(r.request().postDataJSON()); return r.fulfill({ status: 204, body: "" }); });
  await vctx.route("**/api/places/photo**", (r) => r.fulfill({ status: 429, json: {} }));
  await vctx.route("**/rest/v1/**", (r) => r.fulfill({ json: [] }));
  const vBodies = [];
  await vctx.route("**/api/search", (r) => { vBodies.push(r.request().postDataJSON()); return r.fulfill({ json: SEARCH_FAST }); });
  await vctx.route("**/api/search/synthesis", (r) => r.fulfill({ json: SYNTH }));
  const vp = await vctx.newPage();
  await vp.addInitScript(() => { try { localStorage.setItem("mapetite.intro", "visto"); } catch { /* ignorato */ } });
  vp.on("pageerror", (e) => errors.push(e.message));
  await vp.goto(`${BASE}/mappa`, { waitUntil: "networkidle" });
  await idee(vp);
  const riga = vp.getByTestId("vicino-adesso");
  ok(await riga.isVisible() && (await riga.textContent())?.includes("Vicino a me, aperto adesso"), "vicino: riga '📍 Vicino a me, aperto adesso' nel pannello 'Ti suggeriamo' (gruppo Adesso)");
  ok((await vp.getByTestId("vicino-adesso").locator("xpath=ancestor::section[1]").textContent())?.startsWith("Adesso"), "vicino: la riga sta nel gruppo 'Adesso'");
  await vp.screenshot({ path: `${OUT}/99-vicino-idee.png`, caret: "initial" });
  await riga.click();
  await vp.getByTestId("intestazione-lista").waitFor({ timeout: 6000 }).catch(() => {});
  await vp.waitForTimeout(600);
  const b = vBodies[0] ?? {};
  const expected = vn ? vn.nearNowQuery(new Date()).query : null;
  ok(vBodies.length === 1, `vicino: una sola ricerca per tocco (${vBodies.length})`);
  ok(b.searchIntent === "structured" && b.openNowOnly === true && b.radius === 1000 && Math.abs(b.lat - 41.9001) < 1e-6 && Math.abs(b.lng - 12.4901) < 1e-6, `vicino: aperti ora, entro 1 km dalla mia posizione (${JSON.stringify({ o: b.openNowOnly, r: b.radius, lat: b.lat, lng: b.lng })})`);
  ok(expected == null || b.query === expected, `vicino: la frase per Google è quella dell'ora (${b.query})`);
  const head = (await vp.getByTestId("intestazione-lista").textContent().catch(() => "")) ?? "";
  ok(head.includes("entro 1 km da te") && head.includes("aperti ora"), `vicino: l'intestazione dice 'entro 1 km da te · aperti ora' (${head})`);
  ok((await vp.getByTestId("raggio-etichetta").textContent().catch(() => "")) === "1 km" && await vp.getByTestId("tu-sei-qui").isVisible(), "vicino: cerchio con la misura '1 km' e il punto 'tu sei qui' sulla mappa");
  await vp.waitForTimeout(1000);
  { const lb = await vp.getByTestId("raggio-etichetta").boundingBox(); ok(!!lb && lb.y > 0 && lb.y + lb.height < 844 && lb.x > 0 && lb.x + lb.width < 390, `vicino: la mappa mostra tutto il cerchio (misura in vista, y=${Math.round(lb?.y ?? -1)})`); }
  ok(vEv.some((e) => e.type === "funzione" && e.props?.nome === "vicino_adesso") && vEv.some((e) => e.props?.nome === "raggio" && e.props?.origine === "me" && e.props?.contesto === "1 km"), "vicino: tocco e raggio registrati (trackFeature)");
  { const lost = droppedKeys(vEv.filter((e) => ["vicino_adesso", "raggio"].includes(e.props?.nome))); ok(lost.length === 0, `vicino: chiavi degli eventi conservate dal server (${lost.join(", ") || "nessuna scartata"})`); }
  await vp.screenshot({ path: `${OUT}/99b-vicino-risultati.png`, caret: "initial" });
  // Filtri, "Quanto lontano?": 500 m dal centro della mappa (niente 'da te', cerchio di 500 m).
  await vp.getByRole("button", { name: "Filtri", exact: true }).click();
  const rag = vp.getByTestId("filtri-raggio");
  await rag.waitFor({ timeout: 4000 });
  ok((await rag.getByRole("button", { name: "500 m" }).count()) === 1 && (await rag.getByRole("button", { name: "5 km" }).count()) === 1, "raggio: scelte 500 m / 1 km / 2 km / 5 km nei Filtri");
  ok((await vp.getByTestId("raggio-da-me").getAttribute("aria-pressed")) === "true", "raggio: dopo 'Vicino a me' nei Filtri risulta 'Da me'");
  await rag.getByRole("button", { name: "500 m" }).click();
  await vp.getByTestId("raggio-da-mappa").click();
  await rag.scrollIntoViewIfNeeded();
  await vp.screenshot({ path: `${OUT}/99c-raggio-filtri.png`, caret: "initial" });
  await vp.getByRole("button", { name: /^Applica filtri/ }).click();
  await vp.getByTestId("intestazione-lista").waitFor({ timeout: 5000 }).catch(() => {});
  await vp.waitForTimeout(600);
  const b2 = vBodies[1] ?? {};
  const head2 = (await vp.getByTestId("intestazione-lista").textContent().catch(() => "")) ?? "";
  ok(vBodies.length === 2 && b2.radius === 500, `raggio: 500 m arriva al server con una sola ricerca (${b2.radius}, ${vBodies.length} ricerche)`);
  ok(head2.includes("entro 500 m") && !head2.includes("da te") && (await vp.getByTestId("raggio-etichetta").textContent().catch(() => "")) === "500 m", `raggio: dal centro della mappa, cerchio di 500 m (${head2})`);
  await vp.screenshot({ path: `${OUT}/99d-raggio-mappa.png`, caret: "initial" });
  ok(await vp.evaluate(() => document.documentElement.scrollWidth - innerWidth) <= 0, "raggio: niente scorrimento orizzontale");
  await vctx.close();
  // Posizione negata: spiegazione umana e ricerca comunque intorno alla mappa (sempre una sola).
  const dctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const dBodies = [];
  await dctx.route("**/api/events", (r) => r.fulfill({ status: 204, body: "" }));
  await dctx.route("**/api/places/photo**", (r) => r.fulfill({ status: 429, json: {} }));
  await dctx.route("**/rest/v1/**", (r) => r.fulfill({ json: [] }));
  await dctx.route("**/api/search", (r) => { dBodies.push(r.request().postDataJSON()); return r.fulfill({ json: SEARCH_FAST }); });
  await dctx.route("**/api/search/synthesis", (r) => r.fulfill({ json: SYNTH }));
  const dp = await dctx.newPage();
  await dp.addInitScript(() => {
    try { localStorage.setItem("mapetite.intro", "visto"); } catch { /* ignorato */ }
    navigator.geolocation.getCurrentPosition = (_ok, err) => setTimeout(() => err({ code: 1, PERMISSION_DENIED: 1, message: "negata" }), 50);
  });
  dp.on("pageerror", (e) => errors.push(e.message));
  await dp.goto(`${BASE}/mappa`, { waitUntil: "networkidle" });
  await idee(dp);
  await dp.getByTestId("vicino-adesso").click();
  const msg = await dp.getByText(/Per cercare vicino a te mi serve la posizione/).waitFor({ timeout: 5000 }).then(() => true, () => false);
  await dp.getByTestId("intestazione-lista").waitFor({ timeout: 5000 }).catch(() => {});
  await dp.waitForTimeout(500);
  ok(msg && await dp.getByText(/Per cercare vicino a te/).isVisible(), "vicino, posizione negata: spiegazione umana che resta in vista");
  ok(dBodies.length === 1 && dBodies[0]?.radius === 1000 && dBodies[0]?.openNowOnly === true, `vicino, posizione negata: cerca comunque intorno alla mappa, una sola ricerca (${dBodies.length})`);
  await dp.screenshot({ path: `${OUT}/99e-vicino-negata.png`, caret: "initial" });
  await dctx.close();
}

// 12. Carica il file di Google Maps (piano 3.2): file di Takeout letto nel telefono → anteprima per zone →
//     salvataggio in blocco. Con le coordinate zero chiamate Google; i .csv al massimo 10. Scritture simulate.
if (fakeUser) {
  const tctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const tev = [];
  await tctx.route("**/api/events", (r) => { tev.push(r.request().postDataJSON()); return r.fulfill({ status: 204, body: "" }); });
  const tins = [];
  await tctx.route("**/rest/v1/saved_places**", (r) => {
    if (r.request().method() === "POST") { tins.push(...[].concat(r.request().postDataJSON())); return r.fulfill({ status: 201, body: "" }); }
    return r.fulfill({ json: [] });
  });
  const tfile = [];
  await tctx.route("**/api/places/import-file", (r) => {
    const items = r.request().postDataJSON()?.items ?? [];
    tfile.push(...items);
    return r.fulfill({ json: { risultati: items.map((_, i) => ({ id: `00000000-0000-4000-8000-0000000007${String(tfile.length - items.length + i).padStart(2, "0")}` })) } });
  });
  const tprev = [];
  await tctx.route("**/api/places/link-preview", (r) => {
    const b = r.request().postDataJSON() ?? {};
    tprev.push(b);
    if (String(b.link).includes("Osteria")) return r.fulfill({ json: { stato: "riconosciuto", chiamate: 2, place: { id: "00000000-0000-4000-8000-000000000799", name: "Osteria Finta", address: "" } } });
    return r.fulfill({ json: { stato: "da_confermare", chiamate: 0, motivo: "Serve una ricerca su Google", nome: "Pizzeria Inventata" } });
  });
  const tp = await tctx.newPage();
  tp.on("pageerror", (e) => errors.push(e.message));
  await tp.goto(`${BASE}/importa`, { waitUntil: "networkidle" });
  await tp.getByTestId("importa-tessera-file").click();
  const tc = tp.getByTestId("importa-file");
  ok(await tc.getByText("Carica il file di Google Maps").isVisible() && await tc.getByRole("button", { name: "Scegli il file" }).isVisible() && (await tp.getByTestId("file-passi").count()) === 0, "file Takeout: card pulita, i passi si aprono solo a richiesta");
  await tp.getByTestId("file-aiuto").click();
  const passi = await tp.getByTestId("file-passi").textContent();
  ok(passi.includes("takeout.google.com") && passi.includes("Saved Places.json") && (await tp.getByTestId("file-passi").locator("li").count()) === 3 && (await tp.getByRole("link", { name: "takeout.google.com" }).getAttribute("href")) === "https://takeout.google.com/", "file Takeout: 3 passi con il link a takeout.google.com");
  await tc.screenshot({ path: `${OUT}/takeout-1-card.png` });
  await tp.getByTestId("file-input").setInputFiles([
    { name: "Saved Places.json", mimeType: "application/json", buffer: readFileSync(new URL("./takeout-esempio.json", import.meta.url)) },
    { name: "Want to go.csv", mimeType: "text/csv", buffer: readFileSync(new URL("./takeout-want-to-go.csv", import.meta.url)) },
  ]);
  await tp.getByTestId("file-anteprima").waitFor({ timeout: 5000 }).catch(() => {});
  const ries = (await tp.getByTestId("file-riepilogo").textContent().catch(() => "")).replace(/\s+/g, " ");
  ok(ries === "Trovati 5 posti: 2 a Roma, 1 a Milano, 2 senza posizione", `file Takeout: anteprima per città ("${ries}")`);
  const scart = await tp.getByTestId("file-scartati").textContent().catch(() => "");
  ok(scart.includes("Lasciati fuori 3") && scart.includes("albergo") && scart.includes("museo"), `file Takeout: hotel, museo e punto senza nome lasciati fuori e detti ("${scart.slice(0, 80)}")`);
  const liste = await tp.getByTestId("file-liste").textContent();
  ok(liste.includes("«Want to go» → 📌 Voglio andarci") && liste.includes("«Luoghi salvati» → 📌 Voglio andarci"), `file Takeout: lista di Google → stato in Mapetite (${liste})`);
  ok((await tp.getByTestId("file-avviso-csv").textContent()).includes("al massimo 10"), "file Takeout: avviso sui posti dei .csv senza posizione (al massimo 10 ricerche)");
  ok(tfile.length === 0 && tprev.length === 0, "file Takeout: leggere il file non chiama il server (resta nel telefono)");
  await tp.screenshot({ path: `${OUT}/takeout-2-anteprima.png`, caret: "initial", fullPage: true });
  await tc.getByRole("button", { name: "Milano · 1" }).click();
  ok(await tp.getByTestId("file-salva").textContent() === "Salva 4 posti", "file Takeout: si toglie una città con un tocco");
  await tc.getByRole("button", { name: "Nessuno" }).click();
  ok(await tp.getByTestId("file-salva").isDisabled(), "file Takeout: 'Nessuno' disattiva il salvataggio");
  await tc.getByRole("button", { name: "Tutti" }).click();
  await tc.getByRole("button", { name: "Milano · 1" }).click();
  ok(await tp.evaluate(() => document.documentElement.scrollWidth - innerWidth) <= 0, "file Takeout 390px: niente scorrimento orizzontale");
  await tp.getByTestId("file-salva").click();
  await tp.getByTestId("file-fatto").waitFor({ timeout: 8000 }).catch(() => {});
  ok(tfile.length === 2 && tfile.every((i) => typeof i.lat === "number" && !("url" in i) && i.googlePlaceId === null) && !tfile.some((i) => i.name.includes("Milano")), `file Takeout: al server solo nome e coordinate dei 2 posti di Roma, nessun Place ID inventato dal cid (${tfile.map((i) => i.name).join(", ")})`);
  ok(tprev.length === 2 && tprev.every((b) => b.budget <= 2), `file Takeout: i 2 posti del .csv passano dal riconoscimento con un tetto (${tprev.map((b) => b.budget).join(",")})`);
  if (process.env.E2E_DEBUG) console.log("DBG takeout", JSON.stringify(tins), JSON.stringify(tprev));
  for (let i = 0; i < 40 && !(tins.length === 3 && tins.some((r) => r.note?.includes("Giulia"))); i++) await tp.waitForTimeout(250);
  ok(tins.length === 3 && tins.every((r) => r.user_id === process.env.E2E_FAKE_USER && JSON.stringify(r.tags) === '["Da provare"]') && tins.some((r) => r.note?.includes("Giulia")), `file Takeout: 3 salvati in 📌 Voglio andarci, con la nota del file (${JSON.stringify(tins.map((r) => r.tags))})`);
  const fatto = await tp.getByTestId("file-fatto").textContent().catch(() => "");
  ok(fatto.includes("Salvati 3 posti") && fatto.includes("1 da completare"), `file Takeout: esito chiaro ("${fatto}")`);
  const coda = await tp.getByTestId("file-coda").textContent().catch(() => "");
  ok(coda.includes("1 posto aspetta la posizione") && coda.includes("Altri domani"), `file Takeout: il posto senza posizione resta da completare, un gruppo al giorno ("${coda}")`);
  ok(tev.some((e) => e.props?.nome === "import_file" && e.props.contesto === "letti" && e.props.risultati === 5) && tev.some((e) => e.props?.nome === "import_file" && e.props.contesto === "salvati" && e.props.risultati === 3), "file Takeout: tracciato 'import_file' (letti e salvati)");
  ok(droppedKeys(tev.filter((e) => e.props?.nome === "import_file")).length === 0, "file Takeout: le chiavi del segnale arrivano tutte al server");
  await tc.scrollIntoViewIfNeeded();
  await tp.screenshot({ path: `${OUT}/takeout-3-fatto.png`, caret: "initial" });
  // File sbagliato: messaggio chiaro, niente schermata vuota.
  await tp.reload({ waitUntil: "networkidle" });
  await tp.getByTestId("file-input").setInputFiles({ name: "foto.json", mimeType: "application/json", buffer: Buffer.from('{"ciao":1}') });
  ok((await tp.getByTestId("file-errore").textContent().catch(() => "")).includes("Non trovo posti"), "file Takeout: file senza posti spiegato");
  await tctx.close();
}

// 99. Salva da iPhone (piano 3.3) e Scopritori (piano 5.6). Tutto simulato: niente Google, niente Supabase.
if (!fakeUser) console.log("SKIP  salva da iPhone / scopritori: dev server senza E2E_FAKE_USER");
else {
  const IPHONE_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
  const ANDROID_UA = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36";
  const tEv = [];
  const telCtx = async (userAgent) => {
    const c = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, userAgent, permissions: ["clipboard-read", "clipboard-write"] });
    await c.route("**/api/events", (r) => { tEv.push(r.request().postDataJSON()); return r.fulfill({ status: 204, body: "" }); });
    await c.route("**/api/places/photo**", (r) => r.fulfill({ status: 429, json: {} }));
    await c.route("**/rest/v1/saved_places**", (r) => r.fulfill({ status: r.request().method() === "POST" ? 201 : 200, json: [] }));
    await c.route("**/api/places/from-link", (r) => r.fulfill({ json: { risultati: [{ link: "https://maps.app.goo.gl/TEL111", place: { id: "00000000-0000-0000-0000-000000000199", name: "Osteria Nascosta" } }] } }));
    return c;
  };
  const featureEv = (nome) => tEv.filter((e) => e.type === "funzione" && e.props?.nome === nome);

  // A) iPhone: guida in 2 passi in cima a /importa; "Incolla il link copiato" legge gli appunti e salva.
  const ic = await telCtx(IPHONE_UA);
  const ip = await ic.newPage();
  ip.on("pageerror", (e) => errors.push(e.message));
  await ip.goto(`${BASE}/importa`, { waitUntil: "networkidle" });
  const guide = ip.getByTestId("salva-telefono");
  await guide.waitFor({ timeout: 5000 }).catch(() => {});
  ok(await guide.getAttribute("data-telefono").catch(() => null) === "iphone", "salva da iPhone: su iPhone compare la guida iPhone");
  ok((await guide.getByTestId("salva-telefono-passo").count()) === 0 && await guide.getByTestId("salva-telefono-apri").getByText("Come salvare dal telefono").isVisible(), "salva da iPhone: guida chiusa in una riga discreta 'Come salvare dal telefono'");
  await guide.getByTestId("salva-telefono-apri").click();
  ok((await guide.getByTestId("salva-telefono-passo").count()) === 2 && await guide.getByText("Copia il link").isVisible() && (await guide.getByRole("button", { name: /Incolla/ }).count()) === 0 && (await ip.getByRole("button", { name: /Incolla/ }).count()) === 1, "salva da iPhone: 2 passi (Copia il link → Incolla) e un solo pulsante Incolla nella pagina");
  ok(featureEv("salva_da_telefono_apri").some((e) => e.props?.contesto === "iphone"), "salva da iPhone: l'apertura della guida è registrata (contesto iphone)");
  const yG = (await guide.boundingBox())?.y ?? 0;
  const yMaps = (await ip.getByTestId("importa-google").boundingBox())?.y ?? 9999;
  ok(yMaps < yG, "salva da iPhone: la guida sta sotto il pulsante Incolla");
  await ip.screenshot({ path: `${OUT}/99a-salva-iphone.png`, caret: "initial" });
  await ip.evaluate(() => navigator.clipboard.writeText("Guarda qui https://maps.app.goo.gl/TEL111"));
  await ip.getByTestId("importa-incolla").click();
  ok(await ip.getByTestId("importa-google").getByTestId("link-salvato").first().waitFor({ timeout: 5000 }).then(() => true, () => false) && await ip.getByText("Osteria Nascosta").isVisible(), "salva da iPhone: il link copiato si salva con un tocco");
  await ip.screenshot({ path: `${OUT}/99b-salva-iphone-salvato.png`, caret: "initial" });
  // Reel di Instagram: non si legge, si chiede lo screenshot in un passo (Salva dal reel).
  await ip.evaluate(() => navigator.clipboard.writeText("https://www.instagram.com/reel/C9xYz12AbCd/"));
  await ip.getByTestId("importa-incolla").click();
  ok(await ip.getByTestId("reel-chiedi").waitFor({ timeout: 4000 }).then(() => true, () => false) && await ip.getByTestId("reel-screenshot").isVisible(), "salva da iPhone: un reel di Instagram incollato chiede lo screenshot (un passo)");
  await ip.setViewportSize({ width: 360, height: 780 });
  ok(await ip.evaluate(() => document.documentElement.scrollWidth - innerWidth) <= 0, "salva da iPhone 360px: niente scorrimento orizzontale");
  await ic.close();

  // B) Android: Condividi → Mapetite; incollare resta l'alternativa; si può passare alla guida iPhone.
  const ac = await telCtx(ANDROID_UA);
  const ap = await ac.newPage();
  ap.on("pageerror", (e) => errors.push(e.message));
  await ap.goto(`${BASE}/importa`, { waitUntil: "networkidle" });
  const ag = ap.getByTestId("salva-telefono");
  await ag.waitFor({ timeout: 5000 }).catch(() => {});
  await ag.getByTestId("salva-telefono-apri").click().catch(() => {});
  ok(await ag.getAttribute("data-telefono").catch(() => null) === "android" && await ag.getByText("Scegli Mapetite").isVisible() && await ap.getByTestId("importa-incolla").isVisible(), "salva da Android: guida 'Condividi → Scegli Mapetite', incolla resta l'alternativa in cima");
  await ap.screenshot({ path: `${OUT}/99c-salva-android.png`, caret: "initial" });
  await ag.getByTestId("salva-telefono-cambia").click();
  ok(await ag.getAttribute("data-telefono") === "iphone" && featureEv("salva_da_telefono_cambia").length > 0, "salva da Android: 'Hai un iPhone?' passa alla guida iPhone");
  await ac.close();

  // C) Scopritori: riga nel profilo, badge sul profilo pubblico, classifica in Amici.
  const ME = "00000000-0000-0000-0000-000000000001";
  const GIU = "00000000-0000-4000-8000-0000000009a1";
  const MAR = "00000000-0000-4000-8000-0000000009a2";
  const LIA = "00000000-0000-4000-8000-0000000009a3";
  const prof = (id, handle, display_name) => ({ id, handle, display_name, bio: null, city: "Roma", visitati: 1, da_provare: 1, seguaci: 1, seguiti: 1 });
  const base = {
    profili: [prof(GIU, "giulia.rm", "Giulia"), prof(MAR, "marco", "Marco"), prof(LIA, "lia", "Lia")],
    salvati: [], seguo: [GIU, MAR, LIA],
    mio: { handle: "io.test", display_name: "Io", bio: null, city: null, is_public: true },
  };
  const scop = [
    { id: ME, handle: "io.test", display_name: "Io", gemme: 2, gemme_provate: 1 },
    { id: GIU, handle: "giulia.rm", display_name: "Giulia", gemme: 9, gemme_provate: 3 },
    { id: MAR, handle: "marco", display_name: "Marco", gemme: 0, gemme_provate: 0 },
    { id: LIA, handle: "lia", display_name: "Lia", gemme: 1, gemme_provate: 0 },
  ];
  const sc = await telCtx(IPHONE_UA);
  const setS = (v) => sc.addCookies([{ name: "e2e_social", value: encodeURIComponent(JSON.stringify(v)), url: BASE }]);
  await sc.addCookies([{ name: "e2e_profilo", value: encodeURIComponent(JSON.stringify({ email: "io@example.com", saved: [], reviews: [] })), url: BASE }]);
  await setS({ ...base, scopritori: scop });
  const s = await sc.newPage();
  s.on("pageerror", (e) => errors.push(e.message));
  await s.goto(`${BASE}/profilo`, { waitUntil: "networkidle" });
  const riga = s.getByTestId("scopritore-riga");
  ok(await riga.isVisible() && (await riga.textContent())?.includes("Scopritore · Esploratore") && await riga.getByTestId("scopritore-livello").textContent() === "Liv. 2", "scopritori: nel profilo la riga compatta '💎 Scopritore · Esploratore · Liv. 2'");
  const yRiga = (await riga.boundingBox())?.y ?? 9999;
  ok(yRiga < ((await s.getByTestId("profilo-mie-cose").boundingBox())?.y ?? 0), "scopritori: la riga sta sotto i numeri, prima di 'Le mie cose'");
  await riga.locator("summary").click();
  ok((await riga.getByTestId("scopritore-mancano").textContent())?.includes("Ancora 5 punti per il livello 3") && (await riga.getByTestId("scopritore-cerca").getAttribute("href")) === "/sorprendimi", "scopritori: aperta dice quanto manca e porta a scoprire un posto poco conosciuto");
  await s.waitForTimeout(300);
  ok(featureEv("scopritore_apri").some((e) => e.props?.contesto === "livello-2"), "scopritori: l'apertura della riga è registrata");
  await s.screenshot({ path: `${OUT}/99d-scopritore-profilo.png`, caret: "initial" });

  await s.goto(`${BASE}/amici`, { waitUntil: "networkidle" });
  const cl = s.getByTestId("scopritori-amici");
  const rows = cl.getByTestId("scopritore-amico");
  const names = await rows.allTextContents();
  ok(await cl.isVisible() && names.length === 3 && names[0].includes("Giulia") && names[1].includes("Tu") && names[2].includes("Lia"), `scopritori: in Amici classifica Giulia → Tu → Lia, chi non ha gemme non compare (${names.map((n) => n.slice(0, 12)).join(" | ")})`);
  ok((await rows.first().locator("a").getAttribute("href")) === "/u/giulia.rm" && (await rows.nth(1).locator("a").getAttribute("href")) === "/profilo", "scopritori: dalla classifica si apre il profilo dell'amico (o il proprio)");
  ok(featureEv("scopritori_amici_vista").length > 0, "scopritori: la vista della classifica è registrata");
  await cl.scrollIntoViewIfNeeded();
  await s.screenshot({ path: `${OUT}/99e-scopritori-amici.png`, caret: "initial" });

  await s.goto(`${BASE}/u/giulia.rm`, { waitUntil: "networkidle" });
  ok((await s.getByTestId("scopritore-badge").textContent().catch(() => ""))?.includes("💎 Scopritore · liv. 3"), "scopritori: sul profilo pubblico il badge '💎 Scopritore · liv. 3'");
  await s.screenshot({ path: `${OUT}/99f-scopritore-pubblico.png`, caret: "initial" });
  await s.goto(`${BASE}/u/marco`, { waitUntil: "networkidle" });
  ok(await s.getByTestId("profilo-pubblico").isVisible() && (await s.getByTestId("scopritore-badge").count()) === 0, "scopritori: senza gemme nessun badge");

  // Migrazione 20261016_scopritori non applicata: niente riga, niente classifica, nessun errore.
  await setS(base);
  await s.goto(`${BASE}/profilo`, { waitUntil: "networkidle" });
  ok(await s.getByTestId("guida-contatori").isVisible() && (await s.getByTestId("scopritore-riga").count()) === 0, "scopritori senza migrazione: il profilo resta com'era");
  await s.goto(`${BASE}/amici`, { waitUntil: "networkidle" });
  ok(await s.getByTestId("amici").isVisible() && (await s.getByTestId("scopritori-amici").count()) === 0, "scopritori senza migrazione: Amici resta com'era");
  await s.goto(`${BASE}/u/giulia.rm`, { waitUntil: "networkidle" });
  ok(await s.getByTestId("profilo-pubblico").isVisible() && (await s.getByTestId("scopritore-badge").count()) === 0, "scopritori senza migrazione: profilo pubblico senza badge");
  { const lost = droppedKeys(tEv); ok(lost.length === 0, `salva da iPhone / scopritori: chiavi degli eventi tutte conservate dal server (${lost.join(", ") || "nessuna scartata"})`); }
  await sc.close();
}

// QA visivo generico (voce 6.6, 16/10): a 360 e 390 px nessuna pagina scorre di lato e nessun pulsante
// o campo visibile finisce sotto la barra in basso (il cerchio della Mappa sporge 28px sopra la barra).
// In cima si controllano solo gli elementi fissi/appiccicati (barre azioni, campi); in fondo alla pagina tutti.
{
  const qctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  await qctx.route("**/api/events", (r) => r.fulfill({ status: 204, body: "" }));
  await qctx.route("**/api/places/photo**", (r) => r.fulfill({ status: 429, json: {} }));
  await qctx.route("**/rest/v1/**", (r) => r.fulfill({ json: [] }));
  await qctx.addInitScript(() => { try { localStorage.setItem("mapetite.intro", "visto"); } catch { /* ignorato */ } });
  const qProfilo = { email: "qa@example.com", saved: [{ created_at: "2026-10-10", tags: ["Da provare", "Romantico"], note: null, places: { id: "00000000-0000-4000-8000-0000000009a1", name: "Trattoria QA", category: "restaurant", address: "Via del Moro 12, 00153 Roma RM, Italy", lat: 41.889, lng: 12.469 } }], reviews: [] };
  if (fakeUser) await qctx.addCookies([{ name: "e2e_collegato", value: "1", url: BASE }, { name: "e2e_profilo", value: encodeURIComponent(JSON.stringify(qProfilo)), url: BASE }]);
  const qp = await qctx.newPage();
  qp.on("pageerror", (e) => errors.push(e.message));
  const QA_PAGINE = ["/", "/mappa", "/assistente", "/amici", "/profilo", "/profilo/diario", "/raccolte/Romantico", "/stasera", "/sorprendimi", "/importa", "/gruppi", "/onboarding", "/login", "/signup", "/per-i-ristoratori", "/per-i-ristoratori/rivendica", "/premium", "/prenotazioni", "/ristoratore/demo"];
  for (const [w, h] of [[360, 780], [390, 844]]) {
    await qp.setViewportSize({ width: w, height: h });
    for (const path of QA_PAGINE) {
      await qp.goto(`${BASE}${path}`, { waitUntil: "networkidle" }).catch(() => {});
      await qp.waitForTimeout(300);
      const r = await qp.evaluate(() => {
        const nav = document.querySelector("[data-testid=barra]");
        const hs = document.scrollingElement.scrollWidth - innerWidth;
        if (!nav || getComputedStyle(nav).display === "none") return { hs, coperti: [] };
        const fisso = (el) => { for (let a = el; a; a = a.parentElement) { const p = getComputedStyle(a).position; if (p === "fixed" || p === "sticky") return true; } return false; };
        const coperti = new Set();
        const guarda = (soloFissi) => {
          for (const el of document.querySelectorAll("a[href], button, input, textarea, select, [role=button]")) {
            if (nav.contains(el) || el.closest(".mapboxgl-map") || (soloFissi && !fisso(el))) continue;
            const b = el.getBoundingClientRect();
            if (b.width < 2 || b.height < 2 || b.bottom <= 0 || b.top >= innerHeight || getComputedStyle(el).visibility === "hidden") continue;
            const y = Math.min(b.bottom - 3, innerHeight - 1);
            const punti = [[b.left + b.width / 2, b.top + b.height / 2], [b.left + b.width / 2, y], [b.left + 6, y], [b.right - 6, y]];
            if (punti.some(([x, yy]) => { const hit = document.elementFromPoint(x, yy); return hit && nav.contains(hit); })) coperti.add((el.getAttribute("aria-label") || el.textContent || el.getAttribute("placeholder") || el.tagName).trim().replace(/\s+/g, " ").slice(0, 40));
          }
        };
        guarda(true);
        scrollTo({ top: document.scrollingElement.scrollHeight, behavior: "instant" });
        guarda(false);
        return { hs, coperti: [...coperti] };
      });
      ok(r.hs <= 0, `QA ${w}px ${path}: niente scorrimento orizzontale (${r.hs}px in più)`);
      ok(r.coperti.length === 0, `QA ${w}px ${path}: nessun pulsante sotto la barra in basso${r.coperti.length ? " (" + r.coperti.join(" | ") + ")" : ""}`);
    }
  }
  await qctx.close();
}

// Carta del gusto (/profilo/gusto): card condivisibile fatta SOLO dai salvati (numeri e tipi,
// titolo da regole fisse), immagine PNG verticale, stato vuoto sotto i 3 salvati.
if (!process.env.E2E_FAKE_USER) console.log("SKIP  carta del gusto: serve E2E_FAKE_USER");
else {
  const gEv = [];
  const gc = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await gc.route("**/api/events", (r) => { gEv.push(r.request().postDataJSON()); return r.fulfill({ status: 204, body: "" }); });
  await gc.route("**/api/places/photo**", (r) => r.fulfill({ status: 429, json: {} }));
  await gc.route("**/rest/v1/**", (r) => r.fulfill({ json: [] }));
  const cartaEv = (nome) => gEv.filter((e) => e.type === "funzione" && e.props?.nome === nome);
  const setP = (v) => gc.addCookies([{ name: "e2e_profilo", value: encodeURIComponent(JSON.stringify(v)), url: BASE }]);
  const pl = (n, category, address, poco) => ({ id: `00000000-0000-4000-8000-0000000007${String(n).padStart(2, "0")}`, name: `Locale Segreto ${n}`, category, address, poco_conosciuto: poco });
  const R = "Via di Prova 1, 00100 Roma RM, Italy";
  const M = "Via Tortona 15, 20144 Milano MI, Italy";
  const saved = [
    { created_at: "2026-10-10", tags: ["Romantico", "Già visitato"], note: null, places: pl(1, "Trattoria", R, null) },
    { created_at: "2026-10-09", tags: ["Con amici", "Da provare"], note: null, places: pl(2, "Trattoria", R, null) },
    { created_at: "2026-10-08", tags: ["Romantico"], note: null, places: pl(3, "italian_restaurant", R, null) },
    { created_at: "2026-10-07", tags: ["Già visitato"], note: null, places: pl(4, "cocktail_bar", M, null) },
    { created_at: "2026-10-06", tags: ["Con amici", "Romantico"], note: null, places: pl(5, "wine_bar", R, null) },
    { created_at: "2026-10-05", tags: ["Da provare"], note: null, places: pl(6, "Trattoria", M, null) },
  ];
  await setP({ email: "giulia@example.com", saved, reviews: [] });
  const g = await gc.newPage();
  g.on("pageerror", (e) => errors.push(e.message));
  await g.goto(`${BASE}/profilo`, { waitUntil: "networkidle" });
  const entry = g.getByTestId("profilo-carta-gusto");
  ok(await entry.isVisible() && (await g.getByTestId("profilo-mie-cose").getByTestId("profilo-carta-gusto").count()) === 1, "carta del gusto: ingresso compatto dentro 'Le mie cose'");
  await entry.click();
  await g.waitForURL(/\/profilo\/gusto$/, { timeout: 8000 }).catch(() => {});
  const card = g.getByTestId("carta-gusto");
  await card.waitFor({ timeout: 8000 }).catch(() => {});
  ok(await card.isVisible(), "carta del gusto: dal profilo si apre la card");
  ok(await g.getByTestId("carta-titolo").textContent() === "Cacciatore di trattorie" && (await g.getByTestId("carta-perche").textContent())?.includes("4 dei tuoi 6 salvati"), `carta del gusto: titolo da regole con il suo perché (${await g.getByTestId("carta-titolo").textContent()} · ${await g.getByTestId("carta-perche").textContent()})`);
  const nums = (await g.getByTestId("carta-numeri").textContent()) ?? "";
  ok(nums.includes("6salvati") && nums.includes("2provati") && nums.includes("2città"), `carta del gusto: numeri veri (salvati, provati, città) (${nums})`);
  const tipi = await g.getByTestId("carta-tipi").locator("li").allTextContents();
  ok(tipi.length === 3 && tipi[0].includes("Trattoria") && tipi[0].includes("3"), `carta del gusto: top 3 tipi di locale (${tipi.join(" | ")})`);
  ok((await g.getByTestId("carta-raccolte").textContent())?.startsWith("Romantico") && !(await g.getByTestId("carta-raccolte").textContent())?.includes("Da provare"), "carta del gusto: raccolte principali, senza i tag di stato");
  ok((await card.textContent())?.includes("Roma · Milano") && !(await card.textContent())?.includes("Locale Segreto"), "carta del gusto: città sì, nomi dei locali no");
  ok(!(await card.textContent())?.includes("poco conosciuti"), "carta del gusto: senza il dato 'poco conosciuto' la percentuale non compare (niente numeri inventati)");
  await g.waitForTimeout(300);
  ok(cartaEv("carta_gusto_vista").some((e) => e.props?.contesto === "piena"), "carta del gusto: la vista è registrata");
  ok(await g.evaluate(() => document.documentElement.scrollWidth - innerWidth) <= 0, "carta del gusto 390px: niente scorrimento orizzontale");
  await g.screenshot({ path: `${OUT}/99g-carta-gusto.png`, caret: "initial", fullPage: true });
  // Immagine PNG verticale (formato storia).
  const img = await g.request.get(`${BASE}/profilo/gusto/immagine`);
  const buf = img.ok() ? await img.body() : Buffer.alloc(0);
  const pngW = buf.length > 24 ? buf.readUInt32BE(16) : 0;
  const pngH = buf.length > 24 ? buf.readUInt32BE(20) : 0;
  ok(img.status() === 200 && (img.headers()["content-type"] ?? "").includes("image/png") && pngW === 1080 && pngH === 1920, `carta del gusto: immagine PNG 1080×1920 (${img.status()} ${pngW}×${pngH})`);
  if (buf.length) { const { writeFileSync } = await import("fs"); writeFileSync(`${OUT}/99h-carta-gusto-immagine.png`, buf); }
  // "Condividi" senza condivisione di file (Chromium del test): l'immagine si scarica.
  const dl = g.waitForEvent("download", { timeout: 15000 }).catch(() => null);
  await g.getByTestId("carta-condividi").click();
  const file = await dl;
  ok(file?.suggestedFilename() === "carta-del-gusto-mapetite.png" && (await g.getByTestId("carta-condividi-esito").textContent())?.includes("Immagine salvata"), "carta del gusto: senza condivisione di file l'immagine si scarica");
  ok(cartaEv("carta_gusto_condividi").some((e) => e.props?.contesto === "scaricata"), "carta del gusto: il tocco su Condividi è registrato");
  // Con il telefono che condivide file: parte il foglio di condivisione con il PNG.
  await g.evaluate(() => {
    window.__condiviso = null;
    navigator.canShare = () => true;
    navigator.share = async (d) => { window.__condiviso = { n: d.files?.length ?? 0, type: d.files?.[0]?.type ?? "" }; };
  });
  await g.getByTestId("carta-condividi").click();
  await g.waitForFunction(() => window.__condiviso, null, { timeout: 15000 }).catch(() => {});
  const sh = await g.evaluate(() => window.__condiviso);
  ok(sh?.n === 1 && sh?.type === "image/png", `carta del gusto: sul telefono si condivide l'immagine PNG (${JSON.stringify(sh)})`);
  // Posti poco conosciuti: con il dato presente compare la percentuale e il titolo dedicato.
  await setP({ email: "giulia@example.com", saved: saved.map((s, i) => ({ ...s, places: { ...s.places, poco_conosciuto: i < 4 } })), reviews: [] });
  await g.goto(`${BASE}/profilo/gusto`, { waitUntil: "networkidle" });
  ok((await g.getByTestId("carta-numeri").textContent())?.includes("67%poco conosciuti") && await g.getByTestId("carta-titolo").textContent() === "Cercatore di posti nascosti", "carta del gusto: con il dato 💎 compare la % di poco conosciuti e il titolo 'Cercatore di posti nascosti'");
  // Meno di 3 salvati: stato vuoto con invito, niente immagine.
  await setP({ email: "giulia@example.com", saved: saved.slice(0, 1), reviews: [] });
  await g.goto(`${BASE}/profilo/gusto`, { waitUntil: "networkidle" });
  const vuota = g.getByTestId("carta-vuota");
  ok(await vuota.isVisible() && (await vuota.textContent())?.includes("Ancora 2 posti") && await vuota.getByRole("link", { name: "Importa da Instagram o Maps" }).isVisible(), "carta del gusto: sotto i 3 salvati invito a salvare o importare");
  ok((await g.request.get(`${BASE}/profilo/gusto/immagine`)).status() === 404, "carta del gusto: sotto i 3 salvati nessuna immagine");
  await g.screenshot({ path: `${OUT}/99i-carta-gusto-vuota.png`, caret: "initial" });
  { const lost = droppedKeys(gEv); ok(lost.length === 0, `carta del gusto: chiavi degli eventi tutte conservate dal server (${lost.join(", ") || "nessuna scartata"})`); }
  await gc.close();
}

// ─── Foto degli utenti: diario e community (PIANO-25-OTTOBRE.md 4.4 e 5.6c) ───
// Foto proprie dal cookie "e2e_foto", foto della community dal cookie "e2e_community" (lette dal
// server solo in sviluppo). Caricamenti verso Supabase Storage e foto_locali intercettati qui:
// si controlla che l'immagine parta già rimpicciolita nel telefono (JPEG, lato lungo 1600 px, < 500 KB).
if (!fakeUser) console.log("SKIP  foto degli utenti: dev server senza E2E_FAKE_USER");
else {
  const FU = process.env.E2E_FAKE_USER;
  const fpid = (n) => `00000000-0000-4000-8000-0000000009${n}`;
  const ROMA = "Via del Pigneto, 10, 00176 Roma RM, Italy";
  const fpl = (n, name, category) => ({ id: fpid(n), name, category, address: ROMA, lat: 41.89, lng: 12.53 });
  const fprofilo = {
    email: "giulia@example.com",
    saved: [
      { created_at: "2026-10-12T20:00:00Z", visited_at: "2026-10-12", tags: ["Già visitato", "Mi è piaciuto"], note: "Cacio e pepe perfetta", places: fpl("01", "Osteria delle Foto", "restaurant") },
      { created_at: "2026-10-05T20:00:00Z", visited_at: "2026-10-05", tags: ["Già visitato"], note: null, places: fpl("02", "Bar Senza Foto", "cocktail_bar") },
    ],
    reviews: [],
  };
  const fotoFinte = { [fpid("01")]: [{ id: "f0000001", url: "https://foto.test/a.jpg", pubblica: false }, { id: "f0000002", url: "https://foto.test/b.jpg", pubblica: false }] };
  const fctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const setF = (name, value) => fctx.addCookies([{ name, value: encodeURIComponent(JSON.stringify(value)), url: BASE }]);
  await setF("e2e_profilo", fprofilo);
  await setF("e2e_foto", fotoFinte);
  const fEv = [];
  await fctx.route("**/rest/v1/**", (r) => r.fulfill({ json: [] }));
  await fctx.route("**/api/events", (r) => { fEv.push(r.request().postDataJSON()); return r.fulfill({ status: 204, body: "" }); });
  await fctx.route("**/api/places/photo**", (r) => r.fulfill({ status: 429, json: {} }));
  await fctx.route("https://foto.test/**", (r) => r.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="#c8693f"/><circle cx="200" cy="150" r="80" fill="#f4d29c"/></svg>' }));
  const uploads = [];
  const storageDeletes = [];
  await fctx.route("**/storage/v1/object/foto-utenti**", (r) => {
    const req = r.request();
    if (req.method() === "POST") { uploads.push({ url: decodeURIComponent(req.url()), body: req.postDataBuffer() ?? Buffer.alloc(0) }); return r.fulfill({ json: { Key: "foto-utenti/x", Id: "x" } }); }
    if (req.method() === "DELETE") { storageDeletes.push(req.postDataJSON()); return r.fulfill({ json: [] }); }
    return r.fulfill({ json: {} });
  });
  const rowPosts = [];
  const rowDeletes = [];
  const rowPatches = [];
  await fctx.route("**/rest/v1/foto_locali**", (r) => {
    const req = r.request();
    if (req.method() === "POST") { rowPosts.push(req.postDataJSON()); return r.fulfill({ status: 201, body: "" }); }
    if (req.method() === "DELETE") { rowDeletes.push(decodeURIComponent(req.url())); return r.fulfill({ status: 204, body: "" }); }
    if (req.method() === "PATCH") { rowPatches.push({ url: decodeURIComponent(req.url()), body: req.postDataJSON() }); return r.fulfill({ status: 204, body: "" }); }
    return r.fulfill({ json: [] });
  });
  // JPEG dentro il corpo multipart: misure lette dall'intestazione SOF, peso del solo file.
  const jpegInfo = (buf) => {
    const start = buf.indexOf(Buffer.from([0xff, 0xd8, 0xff]));
    const end = buf.lastIndexOf(Buffer.from([0xff, 0xd9]));
    if (start < 0 || end < start) return null;
    const j = buf.subarray(start, end + 2);
    for (let i = 2; i < j.length - 9;) {
      if (j[i] !== 0xff) { i++; continue; }
      const m = j[i + 1];
      if (m >= 0xc0 && m <= 0xc3) return { bytes: j.length, h: j.readUInt16BE(i + 5), w: j.readUInt16BE(i + 7) };
      i += 2 + j.readUInt16BE(i + 2);
    }
    return { bytes: j.length, w: 0, h: 0 };
  };
  const fp = await fctx.newPage();
  fp.on("pageerror", (e) => errors.push(e.message));
  await fp.addInitScript(() => { try { localStorage.setItem("mapetite.intro", "visto"); } catch {} });
  // Foto "scattata" col telefono: 4000×3000, generata nel browser (sfumature e dettagli, pesante).
  await fp.goto(`${BASE}/profilo/diario`, { waitUntil: "networkidle" });
  const bigPhoto = Buffer.from(await fp.evaluate(async () => {
    const c = document.createElement("canvas");
    c.width = 4000; c.height = 3000;
    const g = c.getContext("2d");
    const grad = g.createLinearGradient(0, 0, 4000, 3000);
    grad.addColorStop(0, "#d9a066"); grad.addColorStop(1, "#3b5e4a");
    g.fillStyle = grad; g.fillRect(0, 0, 4000, 3000);
    for (let i = 0; i < 1500; i++) { g.fillStyle = `hsl(${(i * 37) % 360},60%,${30 + (i % 40)}%)`; g.beginPath(); g.arc((i * 997) % 4000, (i * 613) % 3000, 10 + (i % 60), 0, 7); g.fill(); }
    const blob = await new Promise((res) => c.toBlob(res, "image/jpeg", 0.97));
    const b = new Uint8Array(await blob.arrayBuffer());
    let s = ""; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
    return btoa(s);
  }), "base64");
  const fotoFile = (name = "IMG_0042.jpg") => ({ name, mimeType: "image/jpeg", buffer: bigPhoto });
  const ftxt = async (loc) => (await loc.textContent().catch(() => "")) ?? "";

  // 1. Diario: la prima foto è la copertina della voce (+1 se ce ne sono altre); senza foto c'è "+ Aggiungi una foto".
  const vA = fp.getByTestId("diario-voce").filter({ hasText: "Osteria delle Foto" });
  const vB = fp.getByTestId("diario-voce").filter({ hasText: "Bar Senza Foto" });
  const cop = vA.getByTestId("diario-copertina");
  ok(await cop.isVisible() && (await cop.locator("img").getAttribute("src")) === "https://foto.test/a.jpg" && (await ftxt(cop)).includes("+1"), "foto diario: la prima foto tua è la copertina della voce (+1)");
  ok((await vB.getByTestId("diario-copertina").count()) === 0 && await vB.getByTestId("diario-aggiungi-foto").isVisible(), "foto diario: senza foto la voce ha l'emoji e '+ Aggiungi una foto'");
  ok(bigPhoto.length > 500 * 1024, `foto diario: la foto di prova è pesante come una vera (${Math.round(bigPhoto.length / 1024)} KB)`);
  await cop.click();
  const lb = fp.getByTestId("foto-lightbox");
  ok(await lb.isVisible() && (await ftxt(fp.getByTestId("foto-lightbox-autore"))).includes("La tua foto") && (await ftxt(fp.getByTestId("foto-lightbox-autore"))).includes("1 di 2"), "foto diario: un tocco sulla copertina apre le foto a schermo intero, con l'etichetta");
  await lb.getByRole("button", { name: "Foto successiva" }).click();
  ok((await ftxt(fp.getByTestId("foto-lightbox-autore"))).includes("2 di 2"), "foto diario: si scorre alla foto successiva");
  await lb.getByRole("button", { name: "Chiudi la foto" }).click();
  ok((await lb.count()) === 0, "foto diario: la foto a schermo intero si chiude");

  // 2. Aggiungere una foto dal foglio "Com'è andata?": parte già rimpicciolita, privata, a nome proprio.
  await vB.getByTestId("diario-aggiungi-foto").click();
  const ff = fp.getByTestId("diario-foglio");
  await ff.getByTestId("diario-foto").waitFor({ timeout: 5000 }).catch(() => {});
  const inp = ff.locator("input[type=file]");
  ok(await ff.getByTestId("foto-aggiungi").isVisible() && (await inp.getAttribute("accept")) === "image/*" && (await inp.getAttribute("capture")) == null && (await ftxt(ff.getByTestId("diario-foto"))).includes("le vedi solo tu"), "foto diario: nel foglio 'Aggiungi foto' (fotocamera o galleria, solo immagini), private come la nota");
  { const box = await ff.getByTestId("foto-aggiungi").boundingBox(); ok(box && box.width >= 44 && box.height >= 44, `foto diario: il pulsante 'Aggiungi foto' è grande almeno 44 px (${box?.width}×${box?.height})`); }
  await inp.setInputFiles(fotoFile());
  await ff.getByTestId("foto-mia").first().waitFor({ timeout: 15000 }).catch(() => {});
  const up = uploads[0];
  const info = up ? jpegInfo(up.body) : null;
  ok(uploads.length === 1 && new RegExp(`/foto-utenti/${FU}/${fpid("02")}/[0-9a-f-]{36}\\.jpg$`).test(up.url), `foto diario: il file va nella cartella dell'utente, sotto il locale (${up?.url.split("/storage/v1/object/")[1] ?? "nessun caricamento"})`);
  ok(info && Math.max(info.w, info.h) === 1600 && info.bytes < 500 * 1024 && up.body.includes(Buffer.from("image/jpeg")), `foto diario: rimpicciolita nel telefono, JPEG 1600 px sotto i 500 KB (${info ? `${info.w}×${info.h}, ${Math.round(info.bytes / 1024)} KB` : "nessun JPEG"})`);
  const rp = rowPosts[0];
  ok(rowPosts.length === 1 && rp?.user_id === FU && rp?.place_id === fpid("02") && rp?.pubblica === false && rp?.path === up?.url.split("/foto-utenti/")[1] && Object.keys(rp ?? {}).sort().join() === "id,path,place_id,pubblica,user_id", `foto diario: collegata al locale giusto, privata (${JSON.stringify(rp)})`);
  ok((await ff.getByTestId("foto-mia").count()) === 1 && (await ff.getByTestId("foto-mia").locator("img").getAttribute("src"))?.startsWith("blob:"), "foto diario: l'anteprima compare subito (dal telefono, senza riscaricarla)");
  { const e = fEv.filter((x) => x.props?.nome === "foto_utente" && x.props?.stato === "aggiunta");
    ok(e.length === 1 && e[0].props.contesto === "diario" && e[0].props.fonte === "privata" && e[0].props.risultati === 1, `foto diario: 'foto aggiunta' registrata (${JSON.stringify(e[0]?.props ?? null)})`); }
  // Un file che non è un'immagine non parte.
  await inp.setInputFiles({ name: "menu.txt", mimeType: "text/plain", buffer: Buffer.from("non sono una foto") });
  await fp.waitForTimeout(300);
  ok(await ff.getByTestId("foto-errore").isVisible() && uploads.length === 1, "foto diario: un file che non è una foto non si carica (messaggio chiaro)");
  await fp.screenshot({ path: `${OUT}/99j-foto-diario-foglio.png`, caret: "initial" });
  // Chiuso il foglio, la foto è già la copertina della voce (salvata subito, senza "Salva").
  await ff.getByTestId("diario-salta").click();
  ok(await vB.getByTestId("diario-copertina").isVisible() && (await vB.getByTestId("diario-aggiungi-foto").count()) === 0, "foto diario: la foto nuova diventa subito la copertina della voce");
  // Togliere una foto: riga e file.
  await vB.getByTestId("diario-modifica").click();
  await ff.getByTestId("foto-togli").first().click();
  await fp.waitForTimeout(300);
  ok(rowDeletes.length === 1 && rowDeletes[0].includes(`user_id=eq.${FU}`) && storageDeletes.length === 1 && JSON.stringify(storageDeletes[0]).includes(`${FU}/${fpid("02")}/`) && (await ff.getByTestId("foto-mia").count()) === 0, `foto diario: la × toglie la foto (riga e file) (${rowDeletes.length}/${storageDeletes.length})`);
  { const box = await ff.getByTestId("foto-aggiungi").boundingBox(); ok(box != null, "foto diario: tolta la foto si può aggiungerne un'altra"); }
  await ff.getByTestId("diario-salta").click();

  // 3. Massimo 3 foto per locale: con 2 foto e 2 scelte se ne carica una sola, poi il pulsante sparisce.
  await vA.getByTestId("diario-modifica").click();
  await ff.getByTestId("diario-foto").waitFor({ timeout: 5000 }).catch(() => {});
  ok((await ff.getByTestId("foto-mia").count()) === 2, "foto diario: nel foglio ci sono le foto già caricate");
  const before = uploads.length;
  await ff.locator("input[type=file]").setInputFiles([fotoFile("IMG_1.jpg"), fotoFile("IMG_2.jpg")]);
  await ff.getByTestId("foto-mia").nth(2).waitFor({ timeout: 15000 }).catch(() => {});
  ok(uploads.length - before === 1 && (await ff.getByTestId("foto-mia").count()) === 3 && (await ff.getByTestId("foto-aggiungi").count()) === 0 && (await ftxt(ff.getByTestId("foto-errore"))).includes("al massimo 3"), `foto diario: al massimo 3 foto per locale (${uploads.length - before} caricata)`);
  // "Mostrale nella scheda del locale": tutte le foto del locale diventano pubbliche.
  const cond = ff.getByTestId("diario-foto-condividi");
  await cond.check();
  await fp.waitForTimeout(300);
  ok(rowPatches.length === 1 && rowPatches[0].body?.pubblica === true && rowPatches[0].url.includes(`place_id=eq.${fpid("01")}`) && rowPatches[0].url.includes(`user_id=eq.${FU}`) && (await ftxt(ff.getByTestId("diario-foto"))).includes("visibili nella scheda del locale"), `foto diario: 'Mostrale nella scheda' le rende pubbliche (${JSON.stringify(rowPatches[0] ?? null)})`);
  ok(fEv.some((e) => e.props?.nome === "foto_utente" && e.props?.stato === "pubblicate"), "foto diario: la scelta di mostrarle è registrata");
  { const w = await fp.evaluate(() => document.documentElement.scrollWidth); const box = await ff.boundingBox(); ok(w <= 390 && box && box.x >= 0 && box.x + box.width <= 390, `foto diario: il foglio con le foto sta nello schermo (${w})`); }
  await ff.getByTestId("diario-foto").scrollIntoViewIfNeeded();
  const SHOTS = new URL("../../docs/autonomia/screenshots/2026-10-17/", import.meta.url).pathname;
  mkdirSync(SHOTS, { recursive: true });
  await fp.screenshot({ path: `${OUT}/99k-foto-diario.png`, caret: "initial" });
  await fp.screenshot({ path: `${SHOTS}foto-diario.png`, caret: "initial" });
  await ff.getByTestId("diario-salta").click();
  await fp.screenshot({ path: `${OUT}/99l-foto-diario-copertine.png`, caret: "initial" });

  // 4. Community nella pagina del locale: le foto degli altri con "Foto di <nome>", le tue con "Aggiungi foto".
  const CF = "55555555-0000-4000-8000-000000000009";
  await setF("e2e_locale", { place: { id: CF, name: "Trattoria delle Foto", address: ROMA, lat: 41.888, lng: 12.53, category: "restaurant", rating: 4.5, price_level: 2, google_place_id: "GFOTO" }, synthesis: null });
  const comm = {
    recensioni: [{ id: "r1", rating: 5, comment: "Tavolo in fondo, carbonara da applausi.", created_at: "2026-10-10T20:00:00Z", autore: { user_id: "u-giulia", handle: "giulia.rm", display_name: "Giulia" }, amico: true }],
    mia: null, reel: [], reelPronti: false,
    foto: [
      { id: "c0000001", url: "https://foto.test/c1.jpg", autore: { user_id: "u-giulia", handle: "giulia.rm", display_name: "Giulia" } },
      { id: "c0000002", url: "https://foto.test/c2.jpg", autore: null },
    ],
    mieFoto: [{ id: "m0000001", url: "https://foto.test/m1.jpg", pubblica: false }],
    fotoPronte: true,
  };
  await setF("e2e_community", comm);
  await fp.goto(`${BASE}/locali/${CF}`, { waitUntil: "networkidle" });
  await fp.getByTestId("community-locale").waitFor({ timeout: 8000 }).catch(() => {});
  const strip = fp.getByTestId("foto-community");
  const autori = await fp.getByTestId("foto-community-autore").allTextContents();
  ok(await strip.isVisible() && autori.join("|") === "Foto di Giulia|Foto di un membro di Mapetite", `foto community: le foto degli altri con l'etichetta di chi le ha scattate (${autori.join(" | ")})`);
  ok(await fp.getByTestId("community-pubblica").getByTestId("foto-community").isVisible(), "foto community: le foto stanno nella sezione 'Dalla community Mapetite', separate da quelle Google");
  const mie = fp.getByTestId("community-mie-foto");
  ok(await mie.isVisible() && (await mie.getByTestId("foto-mia").count()) === 0 && (await ftxt(mie)).includes("le vedono tutti"), "foto community: 'Le tue foto' mostra solo le tue pubbliche (quelle private del diario restano private)");
  await fp.getByTestId("foto-community-foto").first().click();
  ok((await ftxt(fp.getByTestId("foto-lightbox-autore"))).includes("Foto di Giulia"), "foto community: a schermo intero resta 'Foto di Giulia'");
  await fp.keyboard.press("Escape");
  await fp.getByTestId("foto-lightbox").waitFor({ state: "detached", timeout: 3000 }).catch(() => {});
  const nUp = uploads.length;
  await mie.locator("input[type=file]").setInputFiles(fotoFile("IMG_3.jpg"));
  await mie.getByTestId("foto-mia").first().waitFor({ timeout: 15000 }).catch(() => {});
  const rc = rowPosts.at(-1);
  ok(uploads.length === nUp + 1 && uploads.at(-1).url.includes(`/foto-utenti/${FU}/${CF}/`) && rc?.pubblica === true && rc?.place_id === CF && rc?.user_id === FU, `foto community: la foto aggiunta alla recensione è pubblica, sul locale giusto (${JSON.stringify(rc)})`);
  { const e = fEv.filter((x) => x.props?.nome === "foto_utente" && x.props?.stato === "aggiunta" && x.props?.contesto === "locale");
    ok(e.length === 1 && e[0].props.fonte === "pubblica" && e[0].props.risultati === 1, `foto community: 'foto aggiunta' registrata (${JSON.stringify(e[0]?.props ?? null)})`); }
  ok(await fp.evaluate(() => document.documentElement.scrollWidth - innerWidth) <= 0, "foto community 390px: niente scorrimento orizzontale");
  await strip.scrollIntoViewIfNeeded();
  await fp.evaluate(() => scrollBy(0, 120));
  await fp.screenshot({ path: `${OUT}/99m-foto-community.png`, caret: "initial" });
  await fp.screenshot({ path: `${SHOTS}foto-community.png`, caret: "initial" });
  { const lost = droppedKeys(fEv.filter((e) => e.props?.nome === "foto_utente"));
    ok(lost.length === 0, `foto: chiavi degli eventi tutte conservate dal server (${lost.join(", ") || "nessuna scartata"})`); }

  // 5. Senza accesso: le foto degli altri si vedono, aggiungerne no. Migrazione non applicata: niente pulsante.
  await setF("e2e_anonimo", 1);
  await fp.reload({ waitUntil: "networkidle" });
  await fp.getByTestId("community-locale").waitFor({ timeout: 8000 }).catch(() => {});
  ok(await fp.getByTestId("foto-community").isVisible() && (await fp.getByTestId("community-mie-foto").count()) === 0, "foto community senza accesso: le foto si vedono, nessun 'Aggiungi foto'");
  await fctx.clearCookies({ name: "e2e_anonimo" });
  await setF("e2e_community", { ...comm, fotoPronte: false, foto: [] });
  await fp.reload({ waitUntil: "networkidle" });
  await fp.getByTestId("community-locale").waitFor({ timeout: 8000 }).catch(() => {});
  ok((await fp.getByTestId("community-mie-foto").count()) === 0 && (await fp.getByTestId("foto-community").count()) === 0 && await fp.getByTestId("recensione-form").isVisible(), "foto community senza migrazione: niente foto, la recensione funziona come prima");
  await fctx.close();
}

// Voci piccole del 16/10 sera: primo accesso senza doppioni, risposte che non si perdono, microfono.
{
  const vctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const vp = await vctx.newPage();
  vp.on("pageerror", (e) => errors.push(e.message));
  // 1. Ultimo passo del primo accesso: niente "Salta" in alto; senza risposte nessuna sintesi inventata.
  await vp.goto(`${BASE}/onboarding`, { waitUntil: "networkidle" });
  await vp.getByRole("button", { name: "Continua" }).click();
  ok(await vp.getByTestId("onboarding-salta").isVisible(), "primo accesso: 'Salta' resta al passo 2");
  await vp.getByTestId("onboarding-salta").click();
  await vp.getByRole("button", { name: "Continua" }).click();
  ok((await vp.getByTestId("benvenuto-passo").textContent()) === "4 di 4" && (await vp.getByTestId("onboarding-salta").count()) === 0 && (await vp.getByText("Salta", { exact: true }).count()) === 0, "primo accesso: all'ultimo passo niente 'Salta'");
  ok(await vp.getByTestId("capito-vuoto").isVisible(), "primo accesso: senza risposte, 'Ecco cosa ho capito' dice che imparerà dall'uso (niente di inventato)");

  // 2. Accesso scaduto mentre si risponde: si passa dal login e, tornati, le risposte ci sono ancora.
  await vp.evaluate(() => localStorage.removeItem("mapetite.benvenuto")); // il passo 1 sopra ha lasciato la sua bozza
  await vp.goto(`${BASE}/onboarding`, { waitUntil: "networkidle" });
  ok((await vp.getByTestId("benvenuto-ripreso").count()) === 0, "risposte conservate: senza bozza l'onboarding parte da capo, senza avviso");
  await vp.getByRole("button", { name: "Milano", exact: true }).click();
  await vp.getByRole("button", { name: "Continua" }).click();
  await vp.getByTestId("tipo-giu").click();
  await vp.getByTestId("tipo-giu").click();
  await vp.getByTestId("tipo-su").click();
  await vp.getByRole("button", { name: "Basta così, continua" }).click();
  await vp.getByRole("button", { name: "Continua" }).click();
  await vctx.addCookies([{ name: "e2e_anonimo", value: "1", url: BASE }]);
  await vp.getByTestId("benvenuto-fine").click();
  await vp.waitForURL(/\/login/, { timeout: 8000 }).catch(() => {});
  ok(new URL(vp.url()).pathname === "/login", `risposte conservate: senza accesso il salvataggio porta al login (${vp.url().replace(BASE, "")})`);
  const bozza = await vp.evaluate(() => JSON.parse(localStorage.getItem("mapetite.benvenuto") ?? "null"));
  ok(bozza?.su?.includes("pizza") && bozza?.giu?.length === 2 && bozza?.city === "Milano" && bozza?.step === 3, `risposte conservate: tipi votati, città e passo restano sul telefono (${JSON.stringify(bozza && { su: bozza.su, city: bozza.city, step: bozza.step })})`);
  await vctx.clearCookies({ name: "e2e_anonimo" });
  await vp.goto(`${BASE}/onboarding`, { waitUntil: "networkidle" });
  await vp.getByTestId("benvenuto-ripreso").waitFor({ timeout: 5000 }).catch(() => {});
  ok(await vp.getByTestId("benvenuto-ripreso").isVisible() && (await vp.getByTestId("benvenuto-passo").textContent()) === "4 di 4", "risposte conservate: dopo l'accesso si riparte dall'ultimo passo con l'avviso");
  await vp.screenshot({ path: `${OUT}/zz-benvenuto-ripreso.png`, caret: "initial" });
  ok((await vp.getByTestId("capito-riga").allTextContents()).join(" ").includes("pizzeria napoletana"), "risposte conservate: i tipi votati ci sono ancora");
  await vp.getByTestId("benvenuto-fine").click();
  await vp.waitForURL(/\/mappa/, { timeout: 8000 }).catch(() => {});
  ok(new URL(vp.url()).searchParams.get("q") === "Pizzeria napoletana a Milano", `risposte conservate: applicate dopo l'accesso, mappa sui gusti nella città (${new URL(vp.url()).searchParams.get("q")})`);
  ok((await vp.evaluate(() => localStorage.getItem("mapetite.benvenuto"))) === null, "risposte conservate: salvate le risposte, la bozza sparisce");
  await vp.goto(`${BASE}/onboarding`, { waitUntil: "networkidle" });
  ok((await vp.getByTestId("benvenuto-ripreso").count()) === 0 && (await vp.getByTestId("benvenuto-passo").textContent()) === "1 di 4", "risposte conservate: riaperto dopo, l'onboarding riparte da capo");
  // Una bozza scaduta (più di 2 giorni) o con valori sconosciuti non si riprende.
  await vp.evaluate(() => localStorage.setItem("mapetite.benvenuto", JSON.stringify({ ts: Date.now() - 3 * 864e5, step: 2, su: ["pizza"], city: "Roma" })));
  await vp.goto(`${BASE}/onboarding`, { waitUntil: "networkidle" });
  ok((await vp.getByTestId("benvenuto-ripreso").count()) === 0 && (await vp.getByTestId("benvenuto-passo").textContent()) === "1 di 4", "risposte conservate: una bozza vecchia di 3 giorni non si riprende");
  await vp.evaluate(() => localStorage.setItem("mapetite.benvenuto", JSON.stringify({ ts: Date.now(), step: 1, su: ["inventato"], zone: ["Atlantide"], city: "Roma" })));
  await vp.goto(`${BASE}/onboarding`, { waitUntil: "networkidle" });
  ok((await vp.getByTestId("benvenuto-passo").textContent()) === "2 di 4" && (await vp.getByTestId("tipi-contatore").textContent()) === "1 di 10", "risposte conservate: tipi e zone sconosciuti nella bozza si ignorano");
  await vp.evaluate(() => localStorage.removeItem("mapetite.benvenuto"));

  // "Rifalla" (da I tuoi gusti): si riparte da quello che il profilo ha già, diete comprese (non si perdono).
  await vctx.addCookies([{ name: "e2e_gusto", value: encodeURIComponent(JSON.stringify({ city: "Roma", occasions: [], priceRange: null, zone: ["Monti"], su: ["trattoria"], giu: [], scoperta: "chicche", diete: ["celiaco"] })), url: BASE }]);
  await vp.goto(`${BASE}/onboarding`, { waitUntil: "networkidle" });
  ok((await vp.getByRole("button", { name: "Roma", exact: true }).getAttribute("aria-pressed")) === "true" && (await vp.getByRole("button", { name: "Monti", exact: true }).getAttribute("aria-pressed")) === "true" && (await vp.getByTestId("benvenuto-ripreso").count()) === 0, "rifalla: città e zone già salvate sono già scelte (senza l'avviso della bozza)");
  await vp.getByRole("button", { name: "Continua" }).click();
  await vp.getByRole("button", { name: "Basta così, continua" }).click();
  ok((await vp.getByRole("button", { name: "Senza glutine", exact: true }).getAttribute("aria-pressed")) === "true" && (await vp.getByRole("radio", { name: /Le chicche/ }).getAttribute("aria-checked")) === "true", "rifalla: la dieta salvata (senza glutine) e 'chicche' restano, non si cancellano");
  await vctx.clearCookies({ name: "e2e_gusto" });
  await vp.evaluate(() => localStorage.removeItem("mapetite.benvenuto"));

  // Funzioni pure della mappa del gusto (src/lib/mappa-gusto.ts).
  { const mg = await import(new URL("../../src/lib/mappa-gusto.ts", import.meta.url).href);
    const m = mg.pulisciMappa({ zone: ["Monti", "Atlantide"], su: ["trattoria", "x"], giu: ["trattoria", "gourmet"], scoperta: "boh" }, (z) => z === "Monti");
    ok(JSON.stringify(m) === '{"v":1,"zone":["Monti"],"su":["trattoria"],"giu":["gourmet"],"scoperta":null}', `mappa del gusto: solo valori conosciuti, un tipo non può essere sia 👍 sia 👎 (${JSON.stringify(m)})`);
    ok(mg.scopertaDedotta(["trattoria", "enoteca"]) === "chicche" && mg.scopertaDedotta(["pizza", "rooftop"]) === "famosi" && mg.scopertaDedotta(["pizza", "enoteca"]) === "misto" && mg.scopertaDedotta([]) === null, "mappa del gusto: famosi o chicche dedotto dai 👍");
    const g = mg.gustiDaTipi(["gourmet", "pizza", "trattoria"], { occasions: [], priceRange: null });
    ok(g.priceRange === "€€" && g.cuisines.includes("pizza") && g.atmospheres.includes("raffinata"), `mappa del gusto: cucine, atmosfere e spesa ricavate dai tipi piaciuti (${JSON.stringify(g)})`);
    ok(mg.queryPerTe({ v: 1, zone: [], su: [], giu: [], scoperta: "chicche" }, "Roma") === null, "mappa del gusto: senza tipi piaciuti nessuna ricerca inventata");
    ok(JSON.stringify(mg.gustoPerAI({ v: 1, zone: [], su: [], giu: [], scoperta: null })) === "null", "mappa del gusto: profilo vuoto → niente all'AI"); }
  { const ms = await import(new URL("../../src/lib/mainstream.ts", import.meta.url).href);
    const P = (name, n, r = 4.5) => ({ name, userRatingCount: n, rating: r });
    const lista = [P("Roscioli Salumeria", 12000), P("Osteria Due", 800), P("Trattoria Tre", 600), P("Da Quattro", 900), P("Cinque", 700)];
    ok(JSON.stringify(ms.demoteForChicche("cena a Monti", lista).demoted) === '["Roscioli Salumeria"]', "chicche: il posto di massa va in fondo anche senza scriverlo");
    ok(ms.demoteForChicche("Roscioli", lista).demoted.length === 0, "chicche: un locale cercato per nome resta dov'è");
    ok(ms.demoteForChicche("i posti più famosi di Roma", lista).demoted.length === 0 && ms.demoteForChicche("ristoranti iconici", lista).demoted.length === 0, "chicche: chi chiede i famosi li ha in cima (la frase vince sul profilo)"); }

  // 5. Microfono: cerchio di 36px ma area di tocco di 44px; la barra di ricerca non cambia altezza.
  await vctx.addInitScript(() => {
    const Fake = class { start() {} stop() { this.onend?.(); } };
    window.SpeechRecognition = Fake;
    window.webkitSpeechRecognition = Fake;
  });
  const tocco = () => vp.evaluate(() => {
    const m = document.querySelector("[data-testid=microfono]");
    if (!m) return null;
    const r = m.getBoundingClientRect();
    const cx = r.x + r.width / 2, cy = r.y + r.height / 2;
    const hit = (x, y) => document.elementFromPoint(x, y)?.closest("[data-testid=microfono]") === m;
    // 4px fuori dal cerchio su ogni lato (44px in tutto) il tocco arriva ancora al microfono.
    return { w: Math.round(r.width), h: Math.round(r.height), bordi: [hit(r.left - 3.5, cy), hit(r.right + 3.5, cy), hit(cx, r.top - 3.5), hit(cx, r.bottom + 3.5)], fuori: hit(r.left - 6, cy) };
  });
  await vp.goto(`${BASE}/mappa?beta=voce`, { waitUntil: "networkidle" });
  await vp.getByTestId("microfono").waitFor({ timeout: 8000 }).catch(() => {});
  const tm = await tocco();
  const hBarra = Math.round((await vp.getByTestId("barra-ricerca").boundingBox())?.height ?? 0);
  ok(tm && tm.w === 36 && tm.h === 36 && tm.bordi.every(Boolean) && !tm.fuori, `microfono sulla mappa: cerchio 36px, area di tocco 44px (${JSON.stringify(tm)})`);
  ok(hBarra === 44, `microfono sulla mappa: la barra di ricerca resta alta 44px (${hBarra}px)`);
  await vp.goto(`${BASE}/assistente`, { waitUntil: "networkidle" });
  await vp.getByTestId("microfono").waitFor({ timeout: 8000 }).catch(() => {});
  const ta = await tocco();
  ok(ta && ta.w === 36 && ta.h === 36 && ta.bordi.every(Boolean), `microfono nell'assistente: area di tocco 44px senza cambiare il cerchio (${JSON.stringify(ta)})`);
  await vp.screenshot({ path: `${OUT}/zz-microfono-assistente.png`, caret: "initial" });
  await vctx.close();
}

// 30. Dove era la mappa (17/10): senza GPS l'assistente e i link senza punto cercano lì, non a Roma.
{
  const lctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await lctx.addInitScript(() => { try { localStorage.setItem("mapetite.intro", "visto"); localStorage.setItem("mapetite.vista", JSON.stringify({ lat: 45.4642, lng: 9.19, zoom: 13, t: Date.now() })); } catch { /* ignorato */ } });
  await lctx.route("**/api/events", (r) => r.fulfill({ status: 204, body: "" }));
  await lctx.route("**/rest/v1/**", (r) => r.fulfill({ json: [] }));
  await lctx.route("**/api/search/intent", (r) => r.fulfill({ json: { intent: null } }));
  await lctx.route("**/api/search/synthesis", (r) => r.fulfill({ json: { dettagli: {}, esclusi: [], livelli: {} } }));
  const lBodies = [];
  await lctx.route("**/api/search", (r) => { lBodies.push(r.request().postDataJSON()); return r.fulfill({ json: { ...SEARCH_FAST, filtri_usati: { categoria: "wine bar", parole_chiave: ["tranquillo"], vicino_a_me: false, zona: null } } }); });
  const lp = await lctx.newPage();
  lp.on("pageerror", (e) => errors.push(e.message));
  await lp.goto(`${BASE}/assistente`, { waitUntil: "networkidle" });
  await lp.getByTestId("assistente-campo").fill("wine bar tranquillo");
  await lp.keyboard.press("Enter");
  await lp.getByTestId("assistente-nota").first().waitFor({ timeout: 8000 }).catch(() => {});
  const nota = (await lp.getByTestId("assistente-nota").first().textContent().catch(() => "")) ?? "";
  ok(lBodies.length === 1 && Math.abs(lBodies[0].lat - 45.4642) < 1e-3 && Math.abs(lBodies[0].lng - 9.19) < 1e-3, `assistente senza GPS: cerca dove era la mappa (Milano), non a Roma (${lBodies[0]?.lat},${lBodies[0]?.lng})`);
  ok(/intorno a Milano, dove avevi lasciato la mappa/.test(nota), `assistente senza GPS: lo dice ("${nota.slice(0, 90)}")`);
  await lp.goto(`${BASE}/mappa?q=${encodeURIComponent("bar cozy")}`, { waitUntil: "networkidle" });
  await lp.waitForTimeout(1500);
  ok(lBodies.length === 2 && Math.abs(lBodies[1].lat - 45.4642) < 1e-3, `link di ricerca senza punto (home, ricerche recenti): cerca dove era la mappa (${lBodies[1]?.lat})`);
  await lctx.close();
}

// Catalogo condiviso (proposta di sicurezza della PR #54): /api/places/add VERO, con un locale già
// nel catalogo. Nome, indirizzo e voto mandati dal telefono senza firma valida non devono cambiare
// la riga che vedono tutti. Nessuna chiamata Google; nessuna scrittura (il locale esiste già e i dati
// firmati sono identici a quelli salvati). Serve il dev server con E2E_FAKE_USER.
{
  const SB = process.env.NEXT_PUBLIC_SUPABASE_URL, ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const leggi = (q) => fetch(`${SB}/rest/v1/places?select=id,name,address,lat,lng,category,rating,price_level,google_place_id&${q}`, { headers: { apikey: ANON, Authorization: `Bearer ${ANON}` } })
    .then((r) => (r.ok ? r.json() : [])).catch(() => []);
  const rows = fakeUser && SB && ANON ? await leggi("google_place_id=not.is.null&lat=not.is.null&limit=1") : [];
  const v = rows[0];
  if (!v) console.log("SKIP  catalogo firmato: serve il dev server con E2E_FAKE_USER e un locale nel catalogo");
  else {
    const { createHmac } = await import("crypto");
    const firma = (entry, key) => { const p = Buffer.from(JSON.stringify(entry)).toString("base64url"); return `${p}.${createHmac("sha256", key).update("catalogo-v1:" + p).digest("hex")}`; };
    const falso = { id: v.google_place_id, name: "Nome Falso E2E", address: "Via Inventata 1", lat: v.lat, lng: v.lng, category: "bar", rating: 1, priceLevel: 4, userRatingCount: 3 };
    const add = (extra) => fetch(`${BASE}/api/places/add`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ googlePlaceId: v.google_place_id, name: falso.name, address: falso.address, lat: v.lat, lng: v.lng, category: "bar", rating: 1, priceLevel: 4, ...extra }),
    }).then(async (r) => ({ status: r.status, place: (await r.json().catch(() => null))?.place ?? null }));
    const senza = await add({});
    const rotta = await add({ firma: "abc.def" });
    const chiaveSbagliata = await add({ firma: firma(falso, "chiave-sbagliata") });
    const stessi = (p) => !!p && p.id === v.id && p.name === v.name;
    ok(senza.status === 200 && stessi(senza.place), `catalogo: un salvataggio senza firma ritrova il locale ma non cambia il nome ("${senza.place?.name}")`);
    ok(rotta.status === 200 && stessi(rotta.place) && chiaveSbagliata.status === 200 && stessi(chiaveSbagliata.place), "catalogo: con una firma rovinata o fatta con un'altra chiave il nome non cambia");
    const KEY = process.env.SUPABASE_SECRET_KEY;
    if (KEY) {
      // Firma vera ma di un ALTRO locale: non vale per questo Place ID.
      const altro = await add({ firma: firma({ ...falso, id: "ChIJaltroLocaleE2E00000" }, KEY) });
      ok(altro.status === 200 && stessi(altro.place), "catalogo: la firma di un altro locale non vale per questo");
      // Firma vera con gli stessi dati del catalogo: accettata, nulla da correggere.
      const vera = await add({ name: v.name, address: v.address ?? "", firma: firma({ id: v.google_place_id, name: v.name, address: v.address ?? "", lat: v.lat, lng: v.lng, category: null, rating: null, priceLevel: null, userRatingCount: null }, KEY) });
      ok(vera.status === 200 && stessi(vera.place), "catalogo: con la firma del server il salvataggio va a buon fine sullo stesso locale");
    }
    const dopo = (await leggi(`id=eq.${v.id}`))[0];
    ok(!!dopo && JSON.stringify(dopo) === JSON.stringify(v), "catalogo: dopo i tentativi la riga del locale è identica (nome, indirizzo, posizione, voto)");
  }
}

// Posizione già permessa (18/10): la mappa parte da dove sei, senza mai chiedere il permesso all'apertura.
// Lorenzo a Milano il 17/10 apriva la mappa su Roma e doveva riscrivere "a Milano".
{
  const MILANO = { latitude: 45.4642, longitude: 9.19 };
  const prova = async ({ permesso, ultima, url, scrivi, campo = "Cosa cerchi?" }) => {
    const c = await browser.newContext({ viewport: { width: 390, height: 844 }, permissions: permesso ? ["geolocation"] : [], geolocation: MILANO });
    let body = null;
    await c.route("**/api/search", async (route) => { body = JSON.parse(route.request().postData() ?? "{}"); return route.fulfill({ json: SEARCH_FAST }); });
    await c.route("**/api/search/intent", (route) => route.fulfill({ status: 503, json: {} }));
    await c.route("**/api/search/synthesis", (route) => route.fulfill({ json: SYNTH }));
    await c.addInitScript((u) => {
      try {
        localStorage.setItem("mapetite.intro", "visto");
        if (u) localStorage.setItem("mapetite.vista", JSON.stringify({ ...u, zoom: 13, t: Date.now() }));
      } catch { /* ignorato */ }
    }, ultima ?? null);
    const g = await c.newPage();
    g.on("pageerror", (e) => errors.push(e.message));
    await g.goto(`${BASE}${url}`, { waitUntil: "networkidle" });
    if (scrivi) {
      await g.waitForTimeout(800);
      await g.getByLabel(campo).fill(scrivi);
      await g.getByLabel(campo).press("Enter");
    }
    for (let i = 0; i < 40 && !body; i++) await g.waitForTimeout(150);
    await c.close();
    return body ? { lat: body.lat, lng: body.lng } : null;
  };
  const vicino = (b, lat, lng) => !!b && Math.abs(b.lat - lat) < 0.05 && Math.abs(b.lng - lng) < 0.05;
  const a1 = await prova({ permesso: true, url: "/mappa", scrivi: "wine bar tranquillo" });
  ok(vicino(a1, 45.4642, 9.19), `posizione permessa, nessuna ultima vista: la ricerca scritta parte da Milano (${JSON.stringify(a1)})`);
  const a2 = await prova({ permesso: true, ultima: { lat: 41.9028, lng: 12.4964 }, url: "/mappa?q=wine%20bar%20tranquillo" });
  ok(vicino(a2, 45.4642, 9.19), `posizione permessa, ultima vista a Roma: la ricerca dalla home parte da Milano (${JSON.stringify(a2)})`);
  const a3 = await prova({ permesso: true, ultima: { lat: 45.4785, lng: 9.1606 }, url: "/mappa?q=wine%20bar%20tranquillo" });
  ok(vicino(a3, 45.4785, 9.1606) && Math.abs(a3.lng - 9.19) > 0.02, `ultima vista nella stessa città: resta quella, non salta sulla posizione (${JSON.stringify(a3)})`);
  const a4 = await prova({ permesso: false, url: "/mappa?q=wine%20bar%20tranquillo" });
  ok(vicino(a4, 41.9028, 12.4964), `senza permesso: nessuna richiesta, si parte da Roma come prima (${JSON.stringify(a4)})`);
  const a5 = await prova({ permesso: true, ultima: { lat: 41.9028, lng: 12.4964 }, url: "/assistente", scrivi: "wine bar tranquillo", campo: "Scrivi all'assistente" });
  ok(vicino(a5, 45.4642, 9.19), `assistente: con la posizione permessa cerca da dove sei, non dalla mappa di ieri a Roma (${JSON.stringify(a5)})`);
  const a6 = await prova({ permesso: true, url: "/sorprendimi?da=home" });
  ok(vicino(a6, 45.464, 9.19), `Sorprendimi dalla home: con la posizione permessa la città dove sei (${JSON.stringify(a6)})`);
  const a7 = await prova({ permesso: false, url: "/sorprendimi?da=home" });
  ok(vicino(a7, 41.9028, 12.4964), `Sorprendimi senza permesso: Roma come prima (${JSON.stringify(a7)})`);
  const a8 = await prova({ permesso: false, ultima: { lat: 45.4785, lng: 9.1606 }, url: "/sorprendimi?da=home" });
  ok(vicino(a8, 45.464, 9.19), `Sorprendimi senza permesso ma con la mappa lasciata a Milano (o Milano scelta al primo accesso): cerca a Milano (${JSON.stringify(a8)})`);
  // Mappa su Milano: "Prova a chiedere" con gli esempi di Milano.
  { const c = await browser.newContext({ viewport: { width: 390, height: 844 }, permissions: ["geolocation"], geolocation: MILANO });
    await c.addInitScript(() => { try { localStorage.setItem("mapetite.intro", "visto"); } catch { /* ignorato */ } });
    const m = await c.newPage();
    m.on("pageerror", (e) => errors.push(e.message));
    await m.goto(`${BASE}/mappa`, { waitUntil: "networkidle" });
    await m.waitForTimeout(1000);
    await idee(m);
    ok(await m.getByRole("button", { name: "Rooftop romantico per due a Milano", exact: true }).isVisible() && (await m.getByRole("button", { name: "Rooftop romantico per due a Roma", exact: true }).count()) === 0, "mappa su Milano: 'Prova a chiedere' con gli esempi di Milano");
    await c.close(); }
  // Assistente con la quota Google finita: il messaggio porta ai propri salvati.
  { const c = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await c.route("**/api/search", (r) => r.fulfill({ status: 503, json: { error: "Le ricerche nuove sono finite per ora: ripartono alle 9:00. Intanto puoi cercare tra i tuoi salvati." } }));
    await c.route("**/api/search/intent", (r) => r.fulfill({ status: 503, json: {} }));
    const a = await c.newPage();
    a.on("pageerror", (e) => errors.push(e.message));
    await a.goto(`${BASE}/assistente`, { waitUntil: "networkidle" });
    await a.getByLabel("Scrivi all'assistente").fill("un posto per un aperitivo");
    await a.getByLabel("Scrivi all'assistente").press("Enter");
    const l = a.getByTestId("assistente-quota-salvati");
    ok(await l.waitFor({ timeout: 6000 }).then(() => true, () => false) && (await l.getAttribute("href")) === "/mappa?vista=salvati", "assistente con la quota finita: 'Cerca nei tuoi salvati' sotto il messaggio");
    // Sorprendimi con la quota finita: invece di "Riprova" (fallirebbe fino alle 9:00) la scelta tra i salvati.
    await a.goto(`${BASE}/sorprendimi?da=home`, { waitUntil: "networkidle" });
    const st = a.getByTestId("sorpresa-quota-stasera");
    ok(await st.waitFor({ timeout: 6000 }).then(() => true, () => false) && (await st.getAttribute("href")) === "/stasera", "Sorprendimi con la quota finita: 'Scegli tra i tuoi salvati' invece di 'Riprova'");
    await c.close(); }
  // Salvati senza account (18/10): cosa sono in una frase e "Crea la tua mappa", niente lucchetto.
  { const c = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await c.addCookies([{ name: "e2e_anonimo", value: "1", url: BASE }]);
    await c.addInitScript(() => { try { localStorage.setItem("mapetite.intro", "visto"); } catch { /* ignorato */ } });
    const a = await c.newPage();
    a.on("pageerror", (e) => errors.push(e.message));
    await a.goto(`${BASE}/mappa`, { waitUntil: "networkidle" });
    await vaiSalvati(a);
    const box = a.getByTestId("salvati-senza-account");
    ok(await box.waitFor({ timeout: 5000 }).then(() => true, () => false) && (await box.getByRole("link", { name: "Crea la tua mappa" }).getAttribute("href")) === "/signup?next=%2Fmappa%3Fvista%3Dsalvati" && (await a.getByText("Accesso richiesto").count()) === 0, "salvati senza account: spiegazione in una frase e 'Crea la tua mappa' che torna ai salvati");
    await a.screenshot({ path: `${OUT}/08c-salvati-senza-account.png`, caret: "initial" });
    await c.close(); }
  // Home: idee e classifiche della città dove sei (Milano), senza permesso quelle di Roma.
  for (const [permesso, atteso] of [[true, "Milano"], [false, "Roma"]]) {
    const c = await browser.newContext({ viewport: { width: 390, height: 844 }, permissions: permesso ? ["geolocation"] : [], geolocation: MILANO });
    await c.addInitScript(() => { try { localStorage.setItem("mapetite.intro", "visto"); } catch { /* ignorato */ } });
    const h = await c.newPage();
    h.on("pageerror", (e) => errors.push(e.message));
    await h.goto(`${BASE}/`, { waitUntil: "networkidle" });
    const ok1 = await h.getByTestId("home-classifiche").getByText(`Le classifiche di ${atteso}`).waitFor({ timeout: 4000 }).then(() => true, () => false);
    const labels = await h.getByTestId("home-suggerimenti").locator("[data-esempio]").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label") ?? ""));
    ok(ok1 && labels.length === 3 && labels.every((l) => l.endsWith(`a ${atteso}`)), `home ${permesso ? "a Milano" : "senza permesso"}: idee e classifiche di ${atteso} (${labels.join(" | ")})`);
    await c.close();
  }
}

// "Quando ci vai?" (proposta 17): il salvato segnato per oggi va primo in "Stasera dove andiamo?".
{ const c = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await c.addInitScript(() => { try { localStorage.setItem("mapetite.intro", "visto"); } catch { /* ignorato */ } });
  const oggi = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(new Date());
  const row = (i, name, tags, piano) => ({ tags, note: null, piano_al: piano, places: { id: `00000000-0000-0000-0000-00000000090${i}`, name, category: "ristorante", address: "Via Po 2, 00198 Roma RM, Italy", lat: 41.91, lng: 12.5, google_place_id: `GS${i}` } });
  const rows = [row(1, "Osteria Uno", ["Da provare"], null), row(2, "Trattoria Due", ["Da provare"], null), row(3, "Pizzeria Tre", ["Da provare"], null), row(4, "Bistrot Quattro", [], oggi), row(5, "Enoteca Cinque", ["Da provare"], "2020-01-04")];
  await c.route("**/rest/v1/saved_places**", (r) => r.fulfill({ json: rows }));
  await c.route("**/rest/v1/place_synthesis**", (r) => r.fulfill({ json: [] }));
  const st = await c.newPage();
  st.on("pageerror", (e) => errors.push(e.message));
  await st.goto(`${BASE}/stasera`, { waitUntil: "networkidle" });
  await st.getByTestId("stasera-proponi").click();
  await st.getByTestId("stasera-proposta").first().waitFor({ timeout: 4000 }).catch(() => {});
  const first = st.getByTestId("stasera-proposta").first();
  ok((await first.getAttribute("data-id")) === "00000000-0000-0000-0000-000000000904" && (await first.getByTestId("stasera-stato").textContent()) === "📅 Avevi detto: ci vado", "stasera: il salvato segnato 'Stasera' è il primo, con 'Avevi detto: ci vado'");
  ok(!(await st.locator("[data-testid=stasera-proposta][data-id='00000000-0000-0000-0000-000000000905']").getByText("Avevi detto").count()), "stasera: un giorno passato da tempo non conta più");
  await st.screenshot({ path: `${OUT}/90-stasera-in-programma.png` });
  await c.close(); }

ok(errors.length === 0, `nessun errore JavaScript in console${errors.length ? ": " + (process.env.E2E_DEBUG ? errors.join("\n") : errors.slice(0, 3).join(" | ")) : ""}`);
await browser.close();
console.log(failed === 0 ? "\nTUTTO OK" : `\n${failed} CONTROLLI FALLITI`);
process.exit(failed === 0 ? 0 : 1);
