// Memoria dei gusti dell'assistente (piano 1.4): preferenze DICHIARATE nei messaggi ("sono
// vegetariano", "non mi piace il pesce", "evito i posti rumorosi", "budget basso") riconosciute a
// regole, senza AI. Si ricordano solo dopo un "Sì" della persona e poi entrano nelle ricerche
// dell'assistente come parole della richiesta: nessuna chiamata Google o Haiku in più.
// Anche la zona abituale (dai salvati) si calcola qui, senza chiamate.
// Nessun import con alias: il giro automatico importa questo file da Node.

export type Gusto = {
  id: string;
  label: string;   // come si mostra: "vegetariano", "niente pesce"
  testo: string;   // cosa si aggiunge alla richiesta: "con piatti vegetariani"
  // La richiesta parla già di questo (o chiede il contrario): la richiesta scritta vince.
  salta: RegExp;
  // Solo per i posti dove si mangia (non per "cocktail bar" o "gelato").
  cibo?: boolean;
  // Posti da mettere in fondo (mai esclusi) se categoria o nome lo dicono chiaramente.
  inFondo?: RegExp;
  inFondoLabel?: string;
};

const DEFS: Record<string, Omit<Gusto, "id">> = {
  vegano: { label: "vegano", testo: "con piatti vegani", salta: /vegan|pesce|carne|sushi|bistecc|steak|bracer|formagg/, cibo: true },
  vegetariano: { label: "vegetariano", testo: "con piatti vegetariani", salta: /vegetar|vegan|pesce|carne|sushi|bistecc|steak|bracer/, cibo: true },
  celiaco: { label: "senza glutine", testo: "senza glutine", salta: /glutine|celiac|gluten/, cibo: true },
  "no-lattosio": { label: "senza lattosio", testo: "senza lattosio", salta: /lattosio/, cibo: true },
  "no-pesce": {
    label: "niente pesce", testo: "senza pesce", cibo: true,
    salta: /pesce|sushi|\bmare\b|crudo|frutti|ostric|seafood|poke|pescheria|marinar/,
    inFondo: /seafood|sushi|pesce|\bfish|frutti di mare|\bcrudo|ostric|pescheria/i, inFondoLabel: "di pesce",
  },
  "no-carne": {
    label: "niente carne", testo: "senza carne", cibo: true,
    salta: /carne|bistecc|bracer|steak|burger|griglia|fiorentina/,
    inFondo: /steak|bracer|bisteccher|griglier|macelleri|\bcarne|burger/i, inFondoLabel: "di carne",
  },
  "no-maiale": { label: "niente maiale", testo: "senza maiale", salta: /maiale|porchett/, cibo: true },
  "no-piccante": { label: "niente piccante", testo: "non piccante", salta: /piccant/, cibo: true },
  tranquillo: { label: "niente posti rumorosi", testo: "tranquillo", salta: /tranquill|vivac|movida|musica|karaoke|discotec|festa|rumoros|ballare/ },
  "no-turistici": { label: "niente posti turistici", testo: "non turistico", salta: /turistic/ },
  "budget-basso": { label: "budget basso", testo: "economico", salta: BUDGET_SALTA() },
};
function BUDGET_SALTA() { return /economic|\bcar[oiae]\b|lusso|stellat|gourmet|chic|elegant|raffinat|€|euro|budget|spendere|alta cucina/; }

// "budget-30": fino a 30 € a testa. Oltre 45 € non c'è una parola onesta da aggiungere: non si propone.
function budgetDef(n: number): Omit<Gusto, "id"> {
  return { label: `fino a ${n} € a testa`, testo: n <= 25 ? "economico" : "prezzi nella media", salta: BUDGET_SALTA() };
}

export function gustoDa(id: string): Gusto | null {
  if (DEFS[id]) return { id, ...DEFS[id] };
  const m = /^budget-(\d{1,2})$/.exec(id);
  if (m && Number(m[1]) >= 5 && Number(m[1]) <= 45) return { id, ...budgetDef(Number(m[1])) };
  return null;
}

// Da ciò che arriva dal database o dal telefono: solo id conosciuti, senza doppioni, al massimo 12.
export function gustiValidi(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const v of raw) if (typeof v === "string" && gustoDa(v) && !out.includes(v)) out.push(v);
  return out.slice(0, 12);
}

// Aggiungere un gusto: "vegano" assorbe "vegetariano", un budget nuovo sostituisce il vecchio.
export function aggiungiGusti(prima: string[], nuovi: string[]): string[] {
  let out = [...prima];
  for (const id of nuovi) {
    if (out.includes(id)) continue;
    if (id.startsWith("budget-")) out = out.filter((x) => !x.startsWith("budget-"));
    if (id === "vegano") out = out.filter((x) => x !== "vegetariano");
    if (id === "vegetariano" && out.includes("vegano")) continue;
    out.push(id);
  }
  return out.slice(0, 12);
}

// ── Riconoscimento nei messaggi ──
const norm = (t: string) => t.toLowerCase().replace(/[’`]/g, "'").replace(/\s+/g, " ").trim();

// Verbi "forti" (un'abitudine: si propone anche dentro una ricerca) e "deboli" ("niente pesce":
// spesso vale solo per stasera, si propone solo se il messaggio è SOLO la preferenza).
const STRONG = "non mi piace|non mi piacciono|non amo|odio|detesto|non mangio|non sopporto|evito|sono allergic[oa]|sono intollerante|allergia|intolleranza";
const WEAK = "niente|no";
const ART = "(?:(?:a|al|alla|allo|ai|agli|alle|il|la|lo|i|gli|le|l'|del|della|dei|delle|di)\\s*)?";
const FOODS: [RegExp, string][] = [
  [/(?:pesce|frutti di mare|crostacei|molluschi)/, "no-pesce"],
  [/(?:carne)/, "no-carne"],
  [/(?:maiale)/, "no-maiale"],
  [/(?:piccante|cibo piccante)/, "no-piccante"],
  [/(?:lattosio|latticini)/, "no-lattosio"],
  [/(?:glutine)/, "celiaco"],
];
const PLACES_STEM = "(?:rumor\\w*|caotic\\w*|affollat\\w*|musica alta|confusione|casin\\w*)";

type Found = { id: string; weak: boolean; span: [number, number] };

function findAll(t: string): Found[] {
  const found: Found[] = [];
  const push = (re: RegExp, id: string, weak: boolean) => {
    for (const m of t.matchAll(new RegExp(re.source, "g"))) found.push({ id, weak, span: [m.index!, m.index! + m[0].length] });
  };
  push(/\b(?:sono|siamo|io sono) vegan[oaie]\b|\bmangio vegano\b|\bdieta vegana\b/, "vegano", false);
  push(/\b(?:sono|siamo|io sono) vegetarian[oaie]\b|\bmangio vegetariano\b|\bdieta vegetariana\b/, "vegetariano", false);
  push(/\b(?:sono|siamo|io sono) celiac[oaih]\w*\b|\bceliachia\b/, "celiaco", false);
  for (const [food, id] of FOODS) {
    push(new RegExp(`\\b(?:${STRONG})\\s+${ART}${food.source}\\b`), id, false);
    push(new RegExp(`(?:^|[,;.]\\s*|\\b(?:e|ma)\\s+)(?:${WEAK})\\s+${ART}${food.source}\\b`), id, true);
  }
  push(new RegExp(`\\b(?:evit\\w*|odio|detesto|non (?:mi piac\\w*|amo|sopporto))\\b[^.,;]{0,30}?\\b${PLACES_STEM}`), "tranquillo", false);
  push(new RegExp(`(?:^|[,;.]\\s*)(?:niente|no)\\b[^.,;]{0,20}?\\b${PLACES_STEM}`), "tranquillo", true);
  push(/\b(?:evit\w*|odio|detesto|non (?:mi piac\w*|amo|sopporto))\b[^.,;]{0,30}?\bturistic\w*/, "no-turistici", false);
  push(/(?:^|[,;.]\s*)(?:niente|no)\b[^.,;]{0,20}?\bturistic\w*/, "no-turistici", true);
  push(/\bbudget (?:basso|limitato|ridotto|stretto|piccolo)\b|\b(?:spendo|spendere|spendiamo) poco\b|\bnon (?:voglio|posso|vogliamo) spendere (?:molto|tanto|troppo)\b/, "budget-basso", false);
  for (const m of t.matchAll(/\b(?:budget(?: di)?|max|massimo|al massimo|non più di|non piu di|fino a|entro(?: i)?)\s*(\d{1,3})\s*(?:€|euro)(?:\s*(?:a testa|a persona|in due))?/g)) {
    const n = Number(m[1]);
    if (n >= 5 && n <= 45) found.push({ id: `budget-${n}`, weak: false, span: [m.index!, m.index! + m[0].length] });
  }
  return found;
}

// Parole di contorno: se dopo aver tolto le preferenze resta solo questo, il messaggio era SOLO una
// preferenza ("ricordati che sono vegetariano") e non parte nessuna ricerca.
const FILLER = /\b(?:ricordati|ricorda|ricordatelo|ricordalo|tieni (?:presente|a mente|conto)|sappi|ti dico|ti avviso|che|io|e|ed|ma|però|pero|comunque|poi|anche|in generale|di solito|sempre|mai|per favore|grazie|ok|allora|guarda|ah|eh|quindi|inoltre|tra l'altro|per la cronaca|nota|tipo|in genere|posti|locali|i|gli|il|la|le|lo|a|di)\b/g;

export function gustiDichiarati(text: string): { ids: string[]; soloPreferenza: boolean } {
  const t = norm(text);
  const found = findAll(t);
  if (found.length === 0) return { ids: [], soloPreferenza: false };
  let rest = t;
  for (const f of [...found].sort((a, b) => b.span[0] - a.span[0])) rest = rest.slice(0, f.span[0]) + " " + rest.slice(f.span[1]);
  const soloPreferenza = rest.replace(FILLER, " ").replace(/[^a-zà-ÿ]+/g, "").length < 3;
  let ids: string[] = [];
  for (const f of found) if ((soloPreferenza || !f.weak) && !ids.includes(f.id)) ids = aggiungiGusti(ids, [f.id]);
  return { ids, soloPreferenza: soloPreferenza && ids.length > 0 };
}

// ── Uso nelle ricerche ──
const DRINK_ONLY = /\b(?:cocktail|bar|enoteca|wine|vino|vini|birr\w*|pub|caff\w*|gelat\w*|aperitiv\w*|drink|dopocena|pasticceri\w*|cornett\w*|colazione)\b/;
const FOOD = /\b(?:ristorant\w*|trattori\w*|osteri\w*|cena|pranzo|mangiare|pizz\w*|brunch|cucina|bistrot|piatti)\b/;

export function gustiPerRicerca(query: string, ids: string[], saltati: string[] = []): { query: string; usati: Gusto[] } {
  const q = norm(query);
  const soloBere = DRINK_ONLY.test(q) && !FOOD.test(q);
  const usati: Gusto[] = [];
  for (const id of ids) {
    const g = gustoDa(id);
    if (!g || saltati.includes(id)) continue;
    if (g.salta.test(q)) continue;      // la richiesta scritta vince ("ristorante di pesce")
    if (g.cibo && soloBere) continue;   // "piatti vegetariani" non c'entra con un cocktail bar
    usati.push(g);
  }
  if (usati.length === 0) return { query: query.trim(), usati };
  return { query: `${query.trim()}, ${usati.map((g) => g.testo).join(", ")}`.slice(0, 300), usati };
}

// Posti che chiaramente vanno contro un gusto (categoria o nome: "seafood_restaurant", "Bisteccheria"):
// in fondo, mai esclusi (nel dubbio il locale resta). Ordine di Google rispettato per il resto.
export function inFondoPerGusti<T extends { name: string; category: string | null }>(places: T[], usati: Gusto[]): { places: T[]; spostati: number; motivo: string | null } {
  const rules = usati.filter((g) => g.inFondo);
  if (rules.length === 0) return { places, spostati: 0, motivo: null };
  const hit = (p: T) => rules.find((g) => g.inFondo!.test(`${p.category ?? ""} ${p.name}`));
  const top = places.filter((p) => !hit(p));
  const bottom = places.filter((p) => hit(p));
  if (bottom.length === 0 || top.length === 0) return { places, spostati: 0, motivo: null };
  const labels = [...new Set(bottom.map((p) => hit(p)!.inFondoLabel!))];
  return { places: [...top, ...bottom], spostati: bottom.length, motivo: labels.join(" e ") };
}

// ── Zona abituale (dai salvati) ──
// Centri approssimativi dei quartieri dove si parte (Roma e Milano, VISIONE.md). Un salvato conta
// per un quartiere se è entro 800 m dal centro.
export type Zona = { nome: string; citta: string; lat: number; lng: number };
export const ZONE: Zona[] = [
  { nome: "Monti", citta: "Roma", lat: 41.8945, lng: 12.4930 },
  { nome: "Trastevere", citta: "Roma", lat: 41.8885, lng: 12.4695 },
  { nome: "Testaccio", citta: "Roma", lat: 41.8775, lng: 12.4760 },
  { nome: "Pigneto", citta: "Roma", lat: 41.8890, lng: 12.5290 },
  { nome: "San Lorenzo", citta: "Roma", lat: 41.8985, lng: 12.5150 },
  { nome: "Prati", citta: "Roma", lat: 41.9080, lng: 12.4600 },
  { nome: "Ostiense", citta: "Roma", lat: 41.8680, lng: 12.4790 },
  { nome: "Garbatella", citta: "Roma", lat: 41.8600, lng: 12.4880 },
  { nome: "Centocelle", citta: "Roma", lat: 41.8780, lng: 12.5590 },
  { nome: "Esquilino", citta: "Roma", lat: 41.8955, lng: 12.5050 },
  { nome: "Centro Storico", citta: "Roma", lat: 41.8990, lng: 12.4740 },
  { nome: "Parioli", citta: "Roma", lat: 41.9250, lng: 12.4950 },
  { nome: "Brera", citta: "Milano", lat: 45.4720, lng: 9.1870 },
  { nome: "Navigli", citta: "Milano", lat: 45.4520, lng: 9.1750 },
  { nome: "Isola", citta: "Milano", lat: 45.4880, lng: 9.1890 },
  { nome: "Porta Venezia", citta: "Milano", lat: 45.4750, lng: 9.2050 },
  { nome: "NoLo", citta: "Milano", lat: 45.4970, lng: 9.2190 },
  { nome: "Porta Romana", citta: "Milano", lat: 45.4520, lng: 9.2030 },
  { nome: "Città Studi", citta: "Milano", lat: 45.4780, lng: 9.2270 },
  { nome: "Paolo Sarpi", citta: "Milano", lat: 45.4800, lng: 9.1750 },
  { nome: "Tortona", citta: "Milano", lat: 45.4520, lng: 9.1640 },
];

export function metri(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const dy = (b.lat - a.lat) * 111_320;
  const dx = (b.lng - a.lng) * 111_320 * Math.cos((a.lat * Math.PI) / 180);
  return Math.hypot(dx, dy);
}

// La zona dove la persona salva più spesso: almeno 3 salvati lì e almeno un terzo di quelli in una
// zona conosciuta. Altrimenti null (meglio nessun suggerimento che uno a caso).
export function zonaAbituale(points: { lat: number; lng: number }[]): Zona | null {
  const count = new Map<string, number>();
  let located = 0;
  for (const p of points) {
    let best: Zona | null = null;
    let bestM = 800;
    for (const z of ZONE) { const m = metri(z, p); if (m < bestM) { bestM = m; best = z; } }
    if (best) { located++; count.set(best.nome, (count.get(best.nome) ?? 0) + 1); }
  }
  const top = [...count.entries()].sort((a, b) => b[1] - a[1])[0];
  if (!top || top[1] < 3 || top[1] / located < 1 / 3) return null;
  return ZONE.find((z) => z.nome === top[0]) ?? null;
}

// La frase dice già dove (un quartiere, una città, "vicino", una via)? Allora niente suggerimento.
const CITTA = /\b(?:roma|milano|torino|napoli|firenze|bologna|venezia|genova|palermo|bari|verona)\b/;
export function fraseConZona(text: string): boolean {
  const t = norm(text);
  if (CITTA.test(t) || /\b(?:vicino|qui|zona|quartiere|via|piazza|viale|corso|largo|centro)\b/.test(t)) return true;
  return ZONE.some((z) => t.includes(z.nome.toLowerCase()));
}
