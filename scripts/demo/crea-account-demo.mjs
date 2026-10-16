#!/usr/bin/env node
// Account demo per tester e investitori (piano 9.2).
//
// Crea (o riallinea, se esiste già) l'utente demo con profilo pubblico, gusti, ~25 salvati tra
// Roma e Milano (stati, raccolte, note, date di visita, classifica) e due recensioni; più un
// secondo account "amico" pubblico, così in demo si vedono Amici, "chi dei tuoi amici c'è stato"
// e il profilo di un'altra persona.
//
// Regole:
// - Usa SOLO locali già presenti nella tabella places (nessuna chiamata Google, nessun locale
//   inventato). Se un locale dell'elenco non c'è, lo salta e lo scrive.
// - Tocca SOLO i due account demo (righe con il loro user_id). Mai dati di altri utenti.
// - Idempotente: rilanciarlo aggiunge ciò che manca e riallinea tag, note e date dei salvati
//   dell'elenco. Con --reset toglie anche i salvati dei due account demo che non sono
//   nell'elenco (per ripulire dopo una demo).
// - Le prenotazioni non si possono preparare: oggi stanno solo nel telefono (localStorage,
//   src/lib/booking.ts), non nel database.
//
// Uso:
//   node scripts/demo/crea-account-demo.mjs --dry-run      # stampa cosa farebbe, non scrive
//   DEMO_PASSWORD=... node scripts/demo/crea-account-demo.mjs
//
// Variabili d'ambiente:
//   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY (obbligatorie)
//   DEMO_EMAIL         (facoltativa, predefinita demo@mapetite.app)
//   DEMO_PASSWORD      (facoltativa: se manca e l'utente è nuovo ne genera una e la stampa;
//                       se l'utente esiste già e c'è, la password viene aggiornata)
//   DEMO_AMICO_EMAIL   (facoltativa, predefinita demo-amico@mapetite.app)

import { randomBytes } from "node:crypto";

const DRY = process.argv.includes("--dry-run");
const RESET = process.argv.includes("--reset");

const URL_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "");
const KEY = process.env.SUPABASE_SECRET_KEY;
if (!URL_BASE || !KEY) {
  console.error("Mancano NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SECRET_KEY nell'ambiente.");
  process.exit(1);
}

const DEMO_EMAIL = (process.env.DEMO_EMAIL || "demo@mapetite.app").toLowerCase();
const AMICO_EMAIL = (process.env.DEMO_AMICO_EMAIL || "demo-amico@mapetite.app").toLowerCase();

// ── Persone ──
const DEMO_PROFILO = {
  handle: "sofia.mangia",
  display_name: "Sofia",
  city: "Roma",
  bio: "Trattorie di quartiere, pizza e aperitivi con vista",
  is_public: true,
  onboarding_completed: true,
  cuisines: ["romana_laziale", "pizza", "giapponese"],
  occasions: ["cena_romantica", "aperitivo", "cena_amici"],
  atmospheres: ["intima", "aperto", "informale"],
  price_range: "€€",
  // Memoria dei gusti dell'assistente (src/lib/gusti.ts): solo id conosciuti.
  gusti_ricordati: ["no-turistici", "tranquillo"],
};

const AMICO_PROFILO = {
  handle: "marco.mangia",
  display_name: "Marco",
  city: "Roma",
  bio: "Pizza, sushi e posti dove tornare",
  is_public: true,
  onboarding_completed: true,
  cuisines: ["pizza", "giapponese", "romana_laziale"],
  occasions: ["cena_amici", "pranzo_veloce"],
  atmospheres: ["informale", "vivace"],
  price_range: "€€",
};

// ── Salvati ──
// Nomi ESATTI come in places. Stati: "Già visitato" (Ci sono stato) / "Da provare" (Voglio andarci).
// Opinioni: "Mi è piaciuto" / "Non fa per me". Gli altri tag sono raccolte.
// giorni = giorni fa della visita (visited_at); rank = classifica personale (più alto = più amato).
// Le note sono personali (cose della persona), mai fatti sul locale.
const V = "Già visitato";
const P = "Da provare";
const OK = "Mi è piaciuto";
const NO = "Non fa per me";

const DEMO_SALVATI = [
  // Roma, ci sono stata
  { nome: "Trattoria Della Stampa", tags: [V, OK, "Con amici"], note: "Da rifare con il gruppo del giovedì", giorni: 9, rank: 10 },
  { nome: "Hostaria Del Moro", tags: [V, OK, "Romantico"], note: "Anniversario con Luca: da rifare", giorni: 23, rank: 9 },
  { nome: "Pizzeria da Simone Malatesta", tags: [V, OK, "Con amici", "Economico"], note: "La pizza del venerdì", giorni: 5, rank: 8 },
  { nome: "Sa Tanca Crostaceria", tags: [V, OK, "Speciale"], note: null, giorni: 40, rank: 7 },
  { nome: "Santa Cocktail Club - Roma", tags: [V, OK, "Aperitivi"], note: "Dopocena dopo il cinema", giorni: 12, rank: 6 },
  { nome: "Antico Forno Santini", tags: [V, OK, "Pranzi veloci"], note: null, giorni: 3, rank: 5 },
  { nome: "Pizzium - Roma via Piave", tags: [V, "Pranzi veloci"], note: null, giorni: 60, rank: 4 },
  { nome: "Caffè Trastevere", tags: [V, NO], note: "Troppo di passaggio per i miei gusti", giorni: 30, rank: 1 },
  // Roma, voglio andarci
  { nome: "Daruma Sushi - Rione Monti", tags: [P, "Pranzi veloci"], note: "Visto in un reel" },
  { nome: "Kiko Sushi Bar", tags: [P], note: "Consigliato da Marco" },
  { nome: "180Grammi Pizzeria Romana", tags: [P, "Con amici"], note: "Salvato da un video TikTok" },
  { nome: "L'Elementare - Trastevere", tags: [P, "Con amici"], note: null },
  { nome: "Dal Toscano Restaurant", tags: [P], note: null },
  { nome: "Terrazza Nainer", tags: [P, "Romantico", "Aperitivi"], note: "Aperitivo al tramonto con Luca" },
  { nome: "8th Floor Rooftop", tags: [P, "Romantico", "Aperitivi"], note: null },
  { nome: "Terrazza Les Étoiles", tags: [P, "Aperitivi"], note: null },
  { nome: "Ambrosia", tags: [P], note: null },
  { nome: "Don's - Meats & Spirits", tags: [P, "Con amici"], note: "Per il compleanno di Ale?" },
  { nome: "DA’MARE", tags: [P, "Speciale"], note: null },
  { nome: "Blu Mare Restaurant", tags: [P, "Romantico"], note: null },
  { nome: "Bakery Roscioli Pietro", tags: [P, "Pranzi veloci"], note: null },
  { nome: "Gelateria La Romana dal 1947", tags: [P], note: null },
  { nome: "Il Sorpasso", tags: [P, "Aperitivi"], note: "Me l'ha detto Giulia, zona Prati" },
  // Milano
  { nome: "Gloria Osteria Milano", tags: [V, OK, "Viaggio a Milano", "Romantico"], note: "Cena del weekend a Milano", giorni: 50, rank: 10 },
  { nome: "Miyabi Milano", tags: [P, "Viaggio a Milano"], note: "Per la trasferta di novembre" },
];

const AMICO_SALVATI = [
  { nome: "Trattoria Della Stampa", tags: [V, OK], note: null, giorni: 15, rank: 9 },
  { nome: "Daruma Sushi - Rione Monti", tags: [V, OK], note: null, giorni: 20, rank: 8 },
  { nome: "Kiko Sushi Bar", tags: [V, OK], note: null, giorni: 35, rank: 10 },
  { nome: "180Grammi Pizzeria Romana", tags: [V, OK], note: null, giorni: 8, rank: 7 },
  { nome: "L'Elementare - Trastevere", tags: [V], note: null, giorni: 44, rank: 5 },
  { nome: "Terrazza Nainer", tags: [P], note: null },
];

// Recensioni dell'utente demo ("Le mie recensioni" nel profilo): opinioni sue, voto 1–5.
const DEMO_RECENSIONI = [
  { nome: "Trattoria Della Stampa", rating: 5, comment: "Il posto dove porto chi viene a trovarmi a Roma." },
  { nome: "Pizzeria da Simone Malatesta", rating: 4, comment: "La mia pizza del venerdì sera." },
];

// ── REST ──
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

async function api(method, path, body, extra = {}) {
  const res = await fetch(`${URL_BASE}${path}`, { method, headers: { ...H, ...extra }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path.split("?")[0]} → ${res.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}
const rest = (method, path, body, extra) => api(method, `/rest/v1/${path}`, body, extra);

const log = (...a) => console.log(...a);
const plan = (what) => log(`${DRY ? "[dry-run] farei" : "→"} ${what}`);

async function write(what, fn) {
  plan(what);
  if (!DRY) return fn();
  return null;
}

const daysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const cityOf = (address) => (/\bMilano\b/i.test(address ?? "") ? "Milano" : /\bRoma\b/i.test(address ?? "") ? "Roma" : "altrove");
const sameSet = (a, b) => a.length === b.length && a.every((x) => b.includes(x));

// ── Utenti (API di amministrazione Auth) ──
async function findUser(email) {
  for (let page = 1; page <= 50; page++) {
    const data = await api("GET", `/auth/v1/admin/users?page=${page}&per_page=200`);
    const users = data?.users ?? [];
    const hit = users.find((u) => (u.email ?? "").toLowerCase() === email);
    if (hit) return hit;
    if (users.length < 200) return null;
  }
  return null;
}

async function ensureUser(email, password, label, { printPassword }) {
  const found = await findUser(email);
  if (found) {
    log(`${label}: esiste già (${email}, id ${found.id}).`);
    if (password && printPassword) {
      await write(`aggiornare la password di ${email} con DEMO_PASSWORD`, () =>
        api("PUT", `/auth/v1/admin/users/${found.id}`, { password }));
    } else if (printPassword) {
      log("  DEMO_PASSWORD non impostata: la password resta quella di prima.");
    }
    return found.id;
  }
  const pwd = password || randomBytes(9).toString("base64url");
  if (DRY) {
    plan(`creare l'utente ${email} (email già confermata)${printPassword ? (password ? " con DEMO_PASSWORD" : " con una password generata") : ""}`);
    return `dry-run-${label}`;
  }
  const created = await api("POST", "/auth/v1/admin/users", { email, password: pwd, email_confirm: true, user_metadata: { demo: true } });
  log(`→ ${label}: creato ${email} (id ${created.id}).`);
  if (printPassword && !password) log(`  PASSWORD GENERATA (annotala): ${pwd}`);
  return created.id;
}

// ── Profilo ──
async function ensureProfile(userId, profilo, label) {
  if (!userId.startsWith("dry-run")) {
    const clash = await rest("GET", `profiles?select=id&handle=eq.${encodeURIComponent(profilo.handle)}`);
    if (clash.some((r) => r.id !== userId)) {
      log(`  ATTENZIONE: il nome @${profilo.handle} è già di un altro utente: lo lascio vuoto per ${label}.`);
      profilo = { ...profilo, handle: null, is_public: false };
    }
  }
  let row = { id: userId, ...profilo, updated_at: new Date().toISOString() };
  // gusti_ricordati arriva con la migrazione 20261016: se manca la colonna non lo scrivo.
  if (!(await hasColumn("profiles", "gusti_ricordati"))) {
    delete row.gusti_ricordati;
    log("  Colonna profiles.gusti_ricordati assente: gusti dell'assistente non scritti.");
  }
  if (userId.startsWith("dry-run")) row = { ...row, id: "<nuovo id>" };
  await write(`scrivere il profilo di ${label}: @${row.handle ?? "—"}, ${row.city}, pubblico=${row.is_public}, gusti ${[...row.cuisines, ...row.occasions, ...row.atmospheres].join(", ")}${row.gusti_ricordati ? `; ricordati: ${row.gusti_ricordati.join(", ")}` : ""}`, () =>
    rest("POST", "profiles?on_conflict=id", row, { Prefer: "resolution=merge-duplicates,return=minimal" }));
}

let schema;
async function hasColumn(table, column) {
  schema ??= await api("GET", "/rest/v1/");
  return !!schema?.definitions?.[table]?.properties?.[column];
}

// ── Salvati ──
async function ensureSaved(userId, list, byName, label) {
  const target = [];
  const missing = [];
  for (const s of list) {
    const place = byName.get(s.nome);
    if (!place) { missing.push(s.nome); continue; }
    target.push({ ...s, place });
  }
  if (missing.length) log(`  ${label}: locali non presenti in places, saltati: ${missing.join(", ")}`);

  const withVisited = await hasColumn("saved_places", "visited_at");
  const withRank = await hasColumn("saved_places", "rank_score");
  const existing = userId.startsWith("dry-run") ? [] : await rest("GET", `saved_places?select=id,place_id,tags,note,visited_at,rank_score&user_id=eq.${userId}`);
  const byPlace = new Map(existing.map((r) => [r.place_id, r]));

  let added = 0, updated = 0, same = 0;
  for (const s of target) {
    const row = { tags: s.tags, note: s.note ?? null };
    if (withVisited) row.visited_at = s.giorni != null ? daysAgo(s.giorni) : null;
    if (withRank) row.rank_score = s.rank ?? null;
    const now = byPlace.get(s.place.id);
    const descr = `${s.place.name} [${cityOf(s.place.address)}] ${s.tags.join(" · ")}${s.note ? ` — "${s.note}"` : ""}${row.visited_at ? ` (visita ${row.visited_at})` : ""}${row.rank_score != null ? ` #${row.rank_score}` : ""}`;
    if (!now) {
      added++;
      await write(`aggiungere a ${label}: ${descr}`, () =>
        rest("POST", "saved_places", { user_id: userId, place_id: s.place.id, ...row }, { Prefer: "return=minimal" }));
    } else {
      // Le date di visita si spostano ogni giorno (sono "N giorni fa"): non contano per "uguale".
      const differs = !sameSet(now.tags ?? [], row.tags) || (now.note ?? null) !== row.note
        || (withRank && (now.rank_score == null ? null : Number(now.rank_score)) !== (row.rank_score ?? null))
        || (withVisited && (now.visited_at == null) !== (row.visited_at == null));
      if (!differs) { same++; continue; }
      updated++;
      await write(`riallineare in ${label}: ${descr}`, () =>
        rest("PATCH", `saved_places?id=eq.${now.id}&user_id=eq.${userId}`, row, { Prefer: "return=minimal" }));
    }
  }

  const keep = new Set(target.map((s) => s.place.id));
  const extra = existing.filter((r) => !keep.has(r.place_id));
  if (extra.length) {
    if (RESET) {
      for (const r of extra) {
        await write(`togliere da ${label} un salvato fuori elenco (place ${r.place_id})`, () =>
          rest("DELETE", `saved_places?id=eq.${r.id}&user_id=eq.${userId}`, undefined, { Prefer: "return=minimal" }));
      }
    } else {
      log(`  ${label}: ${extra.length} salvati fuori elenco lasciati com'erano (usa --reset per toglierli).`);
    }
  }
  if (!withVisited) log("  Colonna saved_places.visited_at assente: date del diario non scritte.");
  if (!withRank) log("  Colonna saved_places.rank_score assente: classifica non scritta.");

  const cities = target.reduce((m, s) => m.set(cityOf(s.place.address), (m.get(cityOf(s.place.address)) ?? 0) + 1), new Map());
  const visited = target.filter((s) => s.tags.includes(V)).length;
  log(`  ${label}: ${target.length} salvati (${[...cities].map(([c, n]) => `${c} ${n}`).join(", ")}; ${visited} "Ci sono stato", ${target.length - visited} "Voglio andarci"). Nuovi ${added}, riallineati ${updated}, già a posto ${same}.`);
}

// ── Recensioni ──
async function ensureReviews(userId, byName) {
  const existing = userId.startsWith("dry-run") ? [] : await rest("GET", `reviews?select=id,place_id,rating,comment&user_id=eq.${userId}`);
  const byPlace = new Map(existing.map((r) => [r.place_id, r]));
  for (const r of DEMO_RECENSIONI) {
    const place = byName.get(r.nome);
    if (!place) { log(`  Recensione saltata, locale assente: ${r.nome}`); continue; }
    const now = byPlace.get(place.id);
    if (now && now.rating === r.rating && now.comment === r.comment) continue;
    if (now) {
      await write(`aggiornare la recensione di ${place.name}: ${r.rating}/5`, () =>
        rest("PATCH", `reviews?id=eq.${now.id}&user_id=eq.${userId}`, { rating: r.rating, comment: r.comment }, { Prefer: "return=minimal" }));
    } else {
      await write(`scrivere la recensione di ${place.name}: ${r.rating}/5 "${r.comment}"`, () =>
        rest("POST", "reviews", { user_id: userId, place_id: place.id, rating: r.rating, comment: r.comment }, { Prefer: "return=minimal" }));
    }
  }
}

// ── Amici (follows tra i due account demo, in entrambe le direzioni) ──
async function ensureFollow(from, to, what) {
  if (!from.startsWith("dry-run") && !to.startsWith("dry-run")) {
    const hit = await rest("GET", `follows?select=follower_id&follower_id=eq.${from}&followed_id=eq.${to}`);
    if (hit.length) return;
  }
  await write(what, () => rest("POST", "follows", { follower_id: from, followed_id: to }, { Prefer: "return=minimal" }));
}

// ── Via ──
async function main() {
  log(`Account demo Mapetite${DRY ? " — PROVA (--dry-run): nessuna scrittura" : ""}${RESET ? " — con --reset" : ""}`);
  log(`Database: ${new URL(URL_BASE).host}\n`);

  const places = await rest("GET", "places?select=id,name,address,category,google_place_id&limit=5000");
  const byName = new Map();
  for (const p of places) if (!byName.has(p.name) && p.google_place_id) byName.set(p.name, p);
  const perCity = places.reduce((m, p) => m.set(cityOf(p.address), (m.get(cityOf(p.address)) ?? 0) + 1), new Map());
  log(`Locali in places: ${places.length} (${[...perCity].map(([c, n]) => `${c} ${n}`).join(", ")}). Uso solo quelli con Place ID Google.\n`);

  const demoId = await ensureUser(DEMO_EMAIL, process.env.DEMO_PASSWORD, "Utente demo", { printPassword: true });
  const amicoId = await ensureUser(AMICO_EMAIL, process.env.DEMO_AMICO_PASSWORD, "Amico demo", { printPassword: false });
  log("");

  await ensureProfile(demoId, DEMO_PROFILO, "utente demo");
  await ensureProfile(amicoId, AMICO_PROFILO, "amico demo");
  log("");
  await ensureSaved(demoId, DEMO_SALVATI, byName, "utente demo");
  await ensureSaved(amicoId, AMICO_SALVATI, byName, "amico demo");
  log("");
  await ensureReviews(demoId, byName);
  await ensureFollow(demoId, amicoId, "far seguire @marco.mangia all'utente demo");
  await ensureFollow(amicoId, demoId, "far seguire l'utente demo da @marco.mangia");

  log("\nNon preparato: le prenotazioni (oggi stanno solo nel telefono, non nel database). In demo se ne fa una dal vivo.");
  log(`Fatto${DRY ? " (prova)" : ""}. Accesso: ${DEMO_EMAIL}${process.env.DEMO_PASSWORD ? " con DEMO_PASSWORD" : ""}. Profilo pubblico: /u/${DEMO_PROFILO.handle}`);
}

main().catch((e) => {
  console.error(`\nErrore: ${e.message}`);
  process.exit(1);
});
