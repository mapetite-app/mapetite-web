// "Mappa del gusto" del primo accesso (sprint 25/10, LORENZO.md): dieci TIPI di posto da valutare
// 👍/👎, mescolando posti famosi e chicche, più zone, occasioni, spesa, diete e "famosi o chicche?".
// Da qui si ricavano i gusti che usano ricerca, verdetti ("perché per te"), filtri e ordine dei risultati.
// Tipi e non locali veri: in archivio ci sono pochi locali (42 il 20/10) e mostrarne di veri
// costerebbe ricerche Google o vorrebbe dire inventarli. Nessuna chiamata, nessun dato inventato.
// Funzioni pure, senza import con alias: il giro automatico importa questo file da Node.

export type Scoperta = "chicche" | "misto" | "famosi";

export type TipoPosto = {
  id: string;
  emoji: string;
  titolo: string;
  riga: string;
  famoso: boolean;
  cuisines: string[];    // valori di CUISINES (preferences.ts)
  atmospheres: string[]; // valori di ATMOSPHERES
  occasions: string[];   // valori di OCCASIONS
  price: "€" | "€€" | "€€€" | "€€€€";
  query: string;         // come si cerca su Mapetite
  sfondo: string;        // due colori per la card (gradiente), solo grafica
};

export const TIPI: TipoPosto[] = [
  { id: "trattoria", emoji: "🍝", titolo: "Trattoria di quartiere", riga: "Tovaglie a quadri, menù a voce, prezzi onesti", famoso: false, cuisines: ["italiana"], atmospheres: ["informale"], occasions: ["cena_amici"], price: "€€", query: "trattoria di quartiere", sfondo: "#7a3e1d,#c9773a" },
  { id: "storica", emoji: "🏛️", titolo: "Osteria storica in centro", riga: "Quella che citano tutte le guide: fila e tavoli stretti", famoso: true, cuisines: ["italiana"], atmospheres: ["storica", "vivace"], occasions: ["cena_amici"], price: "€€", query: "osteria storica", sfondo: "#5b4636,#a8865f" },
  { id: "pizza", emoji: "🍕", titolo: "Pizzeria napoletana con la fila", riga: "Cornicione alto, mezz'ora di attesa, locale pieno", famoso: true, cuisines: ["pizza"], atmospheres: ["vivace"], occasions: ["cena_amici"], price: "€", query: "pizzeria napoletana", sfondo: "#9c2f1f,#e2683c" },
  { id: "speakeasy", emoji: "🍸", titolo: "Cocktail bar nascosto", riga: "Porta senza insegna, drink d'autore, luci basse", famoso: false, cuisines: [], atmospheres: ["intima"], occasions: ["aperitivo", "dopocena"], price: "€€€", query: "cocktail bar d'autore", sfondo: "#1a3c40,#3f7a73" },
  { id: "enoteca", emoji: "🍷", titolo: "Enoteca di vini naturali", riga: "Bancone piccolo, piatti da condividere, l'oste consiglia", famoso: false, cuisines: [], atmospheres: ["intima", "informale"], occasions: ["aperitivo"], price: "€€", query: "enoteca vini naturali", sfondo: "#5a1f33,#9b3d5c" },
  { id: "bistrot", emoji: "🧑‍🍳", titolo: "Bistrot di cucina creativa", riga: "Menù corto che cambia spesso, chef giovane", famoso: false, cuisines: ["italiana"], atmospheres: ["raffinata"], occasions: ["cena_romantica"], price: "€€€", query: "bistrot cucina creativa", sfondo: "#2f4a2b,#6f9a55" },
  { id: "gourmet", emoji: "✨", titolo: "Ristorante gourmet", riga: "Menù degustazione, servizio impeccabile, da occasione", famoso: true, cuisines: [], atmospheres: ["raffinata"], occasions: ["occasione_speciale"], price: "€€€€", query: "ristorante gourmet", sfondo: "#23232e,#5c5c78" },
  { id: "rooftop", emoji: "🌇", titolo: "Rooftop con vista", riga: "Aperitivo al tramonto sopra i tetti", famoso: true, cuisines: [], atmospheres: ["panoramica", "aperto"], occasions: ["aperitivo"], price: "€€€", query: "rooftop con vista", sfondo: "#b5532e,#f2a65a" },
  { id: "mondo", emoji: "🍜", titolo: "Cucina dal mondo, autentica", riga: "Ramen, curry, mezze: posti piccoli, cucina chi viene da lì", famoso: false, cuisines: ["giapponese", "indiana", "mediorientale"], atmospheres: ["informale"], occasions: ["pranzo_veloce"], price: "€", query: "cucina etnica autentica", sfondo: "#7b5a12,#c9a227" },
  { id: "brunch", emoji: "🥐", titolo: "Brunch e caffè di specialità", riga: "Pancake, avocado toast, caffè filtro, luce naturale", famoso: false, cuisines: [], atmospheres: ["informale"], occasions: ["colazione_brunch"], price: "€€", query: "brunch caffè di specialità", sfondo: "#8a5a3c,#d8a77b" },
];

const TIPO = new Map(TIPI.map((t) => [t.id, t]));
export const tipoDa = (id: string): TipoPosto | null => TIPO.get(id) ?? null;

// Diete e cose da evitare: stessi id della memoria dei gusti (gusti.ts), così entrano dove già lavora.
export const DIETE: { id: string; label: string; emoji: string }[] = [
  { id: "vegetariano", label: "Vegetariano", emoji: "🥗" },
  { id: "vegano", label: "Vegano", emoji: "🌱" },
  { id: "celiaco", label: "Senza glutine", emoji: "🌾" },
  { id: "no-lattosio", label: "Senza lattosio", emoji: "🥛" },
  { id: "no-pesce", label: "Niente pesce", emoji: "🐟" },
  { id: "no-carne", label: "Niente carne", emoji: "🥩" },
];

export const SCOPERTE: { value: Scoperta; label: string; riga: string }[] = [
  { value: "chicche", label: "Le chicche", riga: "Posti poco noti, da gente del posto" },
  { value: "misto", label: "Un po' tutto", riga: "Famosi e chicche, basta che siano buoni" },
  { value: "famosi", label: "I posti famosi", riga: "Quelli di cui parlano tutti" },
];

// v: 2 = salvata dal primo accesso nuovo, dove "Famosi o chicche?" è una domanda vista: se manca la
// risposta la persona non ha scelto e non si deduce niente dai 👍 (collaudo del 26/10, B1). v: 1 = primo
// accesso vecchio, dove la scelta poteva mancare e si deduce (lì la proposta dai 👍 si vede).
export type MappaGusto = {
  v: 1 | 2;
  zone: string[];
  su: string[];
  giu: string[];
  scoperta: Scoperta | null;
};

const soloNoti = (v: unknown, ok: (x: string) => boolean, max: number) =>
  Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === "string" && ok(x)))].slice(0, max) : [];

/** Valida quello che arriva dal telefono o dal database: solo valori conosciuti. */
export function pulisciMappa(raw: unknown, zoneNote: (z: string) => boolean): MappaGusto {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const su = soloNoti(o.su, (x) => TIPO.has(x), TIPI.length);
  const giu = soloNoti(o.giu, (x) => TIPO.has(x) && !su.includes(x), TIPI.length);
  const scoperta = SCOPERTE.some((s) => s.value === o.scoperta) ? (o.scoperta as Scoperta) : null;
  return { v: o.v === 2 ? 2 : 1, zone: soloNoti(o.zone, zoneNote, 4), su, giu, scoperta };
}

/** Famosi o chicche per ricerca, verdetti e home: la scelta fatta, oppure (solo profili vecchi) quella dedotta dai 👍. */
export function scopertaPer(m: Pick<MappaGusto, "v" | "su" | "scoperta">): Scoperta | null {
  return m.scoperta ?? (m.v === 2 ? null : scopertaDedotta(m.su));
}

export const dieteValide = (raw: unknown): string[] => soloNoti(raw, (x) => DIETE.some((d) => d.id === x), DIETE.length);

/** Famosi o chicche, dedotto dai 👍: si confronta quanto piacciono i tipi poco noti e quelli famosi
 *  tra quelli visti, non quanti sono (con tutti 👍 venivano "le chicche" solo perché ce ne sono di più:
 *  collaudo 23/10). Senza `visti` vale l'elenco intero. Differenza piccola → "un po' tutto". */
export function scopertaDedotta(su: string[], visti?: string[]): Scoperta | null {
  const tipi = su.map(tipoDa).filter((t): t is TipoPosto => t != null);
  if (tipi.length === 0) return null;
  const famosi = tipi.filter((t) => t.famoso).length;
  const chicche = tipi.length - famosi;
  const visto = visti ? visti.map(tipoDa).filter((t): t is TipoPosto => t != null) : TIPI;
  const famVisti = visto.filter((t) => t.famoso).length;
  const chiVisti = visto.length - famVisti;
  // Visto un solo genere: vince quello.
  if (famVisti === 0 || chiVisti === 0) return chicche > famosi ? "chicche" : famosi > chicche ? "famosi" : "misto";
  const d = chicche / chiVisti - famosi / famVisti;
  if (d >= 0.25) return "chicche";
  if (d <= -0.25) return "famosi";
  return "misto";
}

const PREZZI = ["€", "€€", "€€€", "€€€€"] as const;

/** Gusti per le colonne di sempre (cucine, atmosfere, occasioni, spesa) dai tipi piaciuti, uniti a quelli scelti a mano. */
export function gustiDaTipi(su: string[], scelti: { occasions: string[]; priceRange: string | null }): { cuisines: string[]; atmospheres: string[]; occasions: string[]; priceRange: string | null } {
  const tipi = su.map(tipoDa).filter((t): t is TipoPosto => t != null);
  const uniq = (xs: string[]) => [...new Set(xs)];
  // Spesa: quella scelta a mano vince; altrimenti la mediana dei tipi piaciuti.
  let priceRange = scelti.priceRange;
  if (!priceRange && tipi.length > 0) {
    const idx = tipi.map((t) => PREZZI.indexOf(t.price)).sort((a, b) => a - b);
    priceRange = PREZZI[idx[Math.floor((idx.length - 1) / 2)]];
  }
  return {
    cuisines: uniq(tipi.flatMap((t) => t.cuisines)).slice(0, 6),
    atmospheres: uniq(tipi.flatMap((t) => t.atmospheres)).slice(0, 6),
    occasions: uniq([...scelti.occasions, ...tipi.flatMap((t) => t.occasions)]).slice(0, 6),
    priceRange,
  };
}

/** La prima ricerca "5 posti per te": il tipo piaciuto più adatto, la zona, e "fuori dai giri turistici" per chi ama le chicche. */
export function queryPerTe(m: MappaGusto, citta: string | null): string | null {
  const scoperta = scopertaPer(m);
  const tipi = m.su.map(tipoDa).filter((t): t is TipoPosto => t != null);
  // Per chi ama le chicche si parte da un tipo "chicca"; per chi ama i famosi da uno famoso.
  const primo = (scoperta === "chicche" ? tipi.find((t) => !t.famoso) : scoperta === "famosi" ? tipi.find((t) => t.famoso) : null) ?? tipi[0];
  if (!primo) return null;
  const base = primo.query.charAt(0).toUpperCase() + primo.query.slice(1);
  // "fuori dai giri turistici" (non "non turistico": vale per trattoria e per cocktail bar) attiva
  // la stessa regola di chi lo scrive (mainstream.ts).
  const nonTuristico = scoperta === "chicche" ? " fuori dai giri turistici" : "";
  const dove = m.zone[0] ? ` a ${m.zone[0]}` : citta ? ` a ${citta}` : "";
  return `${base}${nonTuristico}${dove}`;
}

// "e altri 3": senza, chi votava 6 tipi ne vedeva 3 e pensava che gli altri non fossero stati capiti.
const altri = (n: number, shown: number, cosa?: [string, string]) => (n > shown ? ` e ${n - shown === 1 ? `un altro${cosa ? ` ${cosa[0]}` : ""}` : `altri ${n - shown}${cosa ? ` ${cosa[1]}` : ""}`}` : "");
const TIPO_POSTO: [string, string] = ["tipo di posto", "tipi di posto"];

/** "Ecco cosa ho capito di te": righe brevi, solo da quello che la persona ha detto. */
export function capito(m: MappaGusto, extra: { citta: string | null; priceRange: string | null; diete: string[]; occasions: { label: string }[] }): { chiave: string; emoji: string; testo: string }[] {
  const out: { chiave: string; emoji: string; testo: string }[] = [];
  // Stesse preposizioni della frase ("al Pigneto", "ai Navigli"): collaudo del 23/10.
  const dove = m.zone.length
    ? elenco(m.zone.map((z) => { const [prep, t] = PREP[z] ?? ["a "]; return `${prep}${t ?? z}`; }))
    : extra.citta ? `a ${extra.citta.trim().split(/\s+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")}` : null;
  if (dove) out.push({ chiave: "zone", emoji: "📍", testo: `Esci soprattutto ${dove}` });
  const su = m.su.map(tipoDa).filter((t): t is TipoPosto => t != null);
  if (su.length) out.push({ chiave: "su", emoji: "❤️", testo: `${su.length === 1 ? "Ti piace" : "Ti piacciono"}: ${su.slice(0, 3).map((t) => t.titolo.toLowerCase()).join(" · ")}${altri(su.length, 3, TIPO_POSTO)}` });
  const giu = m.giu.map(tipoDa).filter((t): t is TipoPosto => t != null);
  if (giu.length) out.push({ chiave: "giu", emoji: "🙅", testo: `Meno: ${giu.slice(0, 2).map((t) => t.titolo.toLowerCase()).join(" · ")}${altri(giu.length, 2, TIPO_POSTO)}` });
  // Solo la scelta fatta davvero (niente dedotto dai 👍).
  const scoperta = m.scoperta;
  if (scoperta === "chicche") out.push({ chiave: "scoperta", emoji: "💎", testo: "Preferisci le chicche: i posti di massa li metto in fondo" });
  else if (scoperta === "famosi") out.push({ chiave: "scoperta", emoji: "⭐", testo: "Ti piacciono anche i posti famosi" });
  if (extra.occasions.length) out.push({ chiave: "occasioni", emoji: "🗓️", testo: `Esci per: ${extra.occasions.slice(0, 3).map((o) => o.label.toLowerCase()).join(", ")}${extra.occasions.length === 4 ? " e un'altra occasione" : extra.occasions.length > 4 ? ` e altre ${extra.occasions.length - 3} occasioni` : ""}` });
  if (extra.priceRange) out.push({ chiave: "spesa", emoji: "💶", testo: `Spesa tipica ${extra.priceRange}` });
  // "Vegetariano" non è una cosa che si evita: si dice a parte da glutine, pesce, carne…
  // Vegano e vegetariano insieme: basta "vegano" (come nella frase).
  const mangi = extra.diete.includes("vegano") ? ["vegano"] : extra.diete.includes("vegetariano") ? ["vegetariano"] : [];
  const eviti = extra.diete.filter((id) => id !== "vegetariano" && id !== "vegano").map((id) => DIETE.find((d) => d.id === id)?.label.toLowerCase().replace(/^(niente|senza) /, "")).filter(Boolean);
  const frasi = [mangi.length ? `sei ${mangi.join(" e ")}` : null, eviti.length ? `eviti ${eviti.join(", ")}` : null].filter(Boolean).join("; ");
  if (frasi) out.push({ chiave: "diete", emoji: "🍽️", testo: frasi.charAt(0).toUpperCase() + frasi.slice(1) });
  return out;
}

// "Ecco cosa ho capito di te" (mockup A del 21/10): il profilo in una frase da amico, con le parole
// chiave evidenziate. Solo ciò che la persona ha scelto, mai dedotto o inventato. Pezzi: testo normale
// o evidenziato (k = la riga di capito() che lo corregge).
const PLURALE: Record<string, string> = {
  trattoria: "le trattorie di quartiere", storica: "le osterie storiche", pizza: "le pizzerie napoletane",
  speakeasy: "i cocktail bar nascosti", enoteca: "le enoteche di vini naturali", bistrot: "i bistrot creativi",
  gourmet: "i ristoranti gourmet", rooftop: "i rooftop con vista", mondo: "la cucina dal mondo", brunch: "il brunch",
};
const SPESA: Record<string, string> = { "€": "spendi poco", "€€": "spendi il giusto", "€€€": "non badi troppo al conto", "€€€€": "ti concedi l'alta cucina" };
const EVITA: Record<string, string> = { celiaco: "il glutine", "no-lattosio": "il lattosio", "no-pesce": "il pesce", "no-carne": "la carne" };

export type PezzoFrase = { t: string; k?: string; id?: string };

const elenco = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} e ${xs[xs.length - 1]}`);

// Preposizione giusta per ogni zona ("al Pigneto", "ai Navigli", "all'Isola", "in centro"): il collaudo
// del 23/10 ha trovato "Esci a Navigli e Isola". Le zone non elencate prendono "a".
const PREP: Record<string, [string, string?]> = {
  Pigneto: ["al "], Ostiense: ["all'"], Garbatella: ["alla "], Esquilino: ["all'"], "Centro Storico": ["in ", "centro"],
  Parioli: ["ai "], Navigli: ["ai "], Isola: ["all'"], "Paolo Sarpi": ["in zona "], Tortona: ["in zona "],
};
const OCCASIONE: Record<string, string> = {
  cena_romantica: "le cene romantiche", pranzo_veloce: "i pranzi veloci", aperitivo: "l'aperitivo", cena_amici: "le cene con gli amici",
  pranzo_lavoro: "i pranzi di lavoro", colazione_brunch: "la colazione o il brunch", dopocena: "il dopocena", occasione_speciale: "le occasioni speciali",
};
const maiuscola = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

// Elenco evidenziato "A, B e altri 2": nessuna scelta sparisce senza dirlo (collaudo del 23/10).
function evidenziati(xs: PezzoFrase[], max: number, cosa: [string, string] = ["un altro", "altri"]): PezzoFrase[] {
  const vis = xs.slice(0, max);
  const resto = xs.length - vis.length;
  const out: PezzoFrase[] = [];
  vis.forEach((x, i) => {
    if (i > 0) out.push({ t: i === vis.length - 1 && resto === 0 ? " e " : ", " });
    out.push(x);
  });
  // "e un altro tipo di posto", "e altri 2 tipi di posto": mai "e altri 1" (collaudo del 23/10).
  // Toccabile come le altre parole (collaudo del 24/10): porta alla domanda, dove si vedono tutti.
  if (resto > 0) {
    out.push({ t: " e " });
    out.push({ t: resto === 1 ? cosa[0] : cosa[1].replace("N", String(resto)), k: xs[0]?.k });
  }
  return out;
}

// Al massimo `max` frasi (collaudo del 23/10: con i profili ricchi "Correggi" finiva sotto i tasti).
// Si tengono le più importanti (gusti, dove, diete), nell'ordine di lettura; il resto sta dietro "Correggi".
// "Famosi o chicche" prima delle zone (collaudo del 26/10, B3: con più zone e una dieta finiva solo dietro "Correggi").
const PRIORITA: Record<string, number> = { su: 0, stile: 1, diete: 2, dove: 3, giu: 4, occasioni: 5 };
export function fraseCapito(m: MappaGusto, extra: { citta: string | null; priceRange: string | null; diete: string[]; occasions: { value?: string; label: string }[] }, max = Infinity): PezzoFrase[][] {
  const tutte: { f: PezzoFrase[]; p: string }[] = [];
  const frasi = { push: (f: PezzoFrase[], p = "dove") => tutte.push({ f, p }) };
  const su = m.su.filter((id) => PLURALE[id]);
  // Ogni tipo porta il suo id: toccandolo si riapre proprio quella card.
  if (su.length) frasi.push([{ t: "Ami " }, ...evidenziati(su.map((id) => ({ t: PLURALE[id], k: "su", id })), 3, ["un altro tipo di posto", "altri N tipi di posto"]), { t: "." }], "su");
  // Dove, quanto spendi, chicche o famosi: una frase sola, come nel mockup ("Esci a Monti e al Pigneto, spendi il giusto e…").
  // Solo la scelta fatta davvero: niente "chicche" dedotte dai 👍 (collaudo del 23/10).
  const parti: PezzoFrase[][] = [];
  if (m.zone.length) {
    const z = m.zone.slice(0, 4).flatMap((nome, i, a) => {
      const [prep, testo] = PREP[nome] ?? ["a "];
      return [...(i === 0 ? [] : [{ t: i === a.length - 1 ? " e " : ", " }]), { t: prep }, { t: testo ?? nome, k: "zone" }];
    });
    parti.push([{ t: "esci " }, ...z]);
  } else if (extra.citta) {
    parti.push([{ t: "esci a " }, { t: extra.citta.trim().split(/\s+/).map(maiuscola).join(" "), k: "zone" }]);
  }
  if (extra.priceRange && SPESA[extra.priceRange]) parti.push([{ t: SPESA[extra.priceRange], k: "spesa" }]);
  if (m.scoperta === "chicche") parti.push([{ t: "giri alla larga dai posti turistici", k: "scoperta" }]);
  else if (m.scoperta === "famosi") parti.push([{ t: "non ti spaventano i posti famosi", k: "scoperta" }]);
  // Più zone ("a Monti e al Pigneto") e altro da dire: due frasi, se no le "e" si accavallano ("in centro
  // e ai Parioli e non ti…"). Prima c'era il punto e virgola, che sembrava scritto da una macchina (collaudo 23/10).
  const staccaZone = m.zone.length > 1 && parti.length > 1;
  const unisci = (ps: PezzoFrase[][], p: string) => {
    const f = ps.flatMap((x, i) => [...(i === 0 ? [] : [{ t: i === ps.length - 1 ? " e " : ", " }]), ...x]);
    f[0] = { ...f[0], t: maiuscola(f[0].t) };
    frasi.push([...f, { t: "." }], p);
  };
  if (staccaZone) { unisci([parti[0]], "dove"); unisci(parti.slice(1), "stile"); }
  else if (parti.length) unisci(parti, m.scoperta ? "stile" : "dove");
  const occ = extra.occasions.map((o) => (o.value && OCCASIONE[o.value]) || o.label.toLowerCase()).map((t) => ({ t, k: "occasioni" }));
  if (occ.length) frasi.push([{ t: "Le tue uscite: " }, ...evidenziati(occ, 3, ["un'altra occasione", "altre N occasioni"]), { t: "." }], "occasioni");
  const giu = m.giu.filter((id) => PLURALE[id]);
  if (giu.length) frasi.push([{ t: "Ti convincono meno " }, ...evidenziati(giu.map((id) => ({ t: PLURALE[id], k: "giu", id })), 2, ["un altro tipo di posto", "altri N tipi di posto"]), { t: "." }], "giu");
  const mangi = extra.diete.includes("vegano") ? "vegano" : extra.diete.includes("vegetariano") ? "vegetariano" : null;
  const eviti = extra.diete.map((id) => EVITA[id]).filter(Boolean);
  const d: PezzoFrase[] = [];
  if (mangi) d.push({ t: "Sei " }, { t: mangi, k: "diete" });
  if (eviti.length) d.push({ t: mangi ? " ed eviti " : "Eviti " }, { t: elenco(eviti), k: "diete" });
  if (d.length) frasi.push([...d, { t: "." }], "diete");
  const scelte = new Set([...tutte.keys()].sort((x, y) => PRIORITA[tutte[x].p] - PRIORITA[tutte[y].p] || x - y).slice(0, max));
  const out = tutte.filter((_, i) => scelte.has(i)).map((x) => x.f);
  // Profilo corto: una mezza frase vera invece di una pagina vuota.
  if (out.length > 0 && tutte.length < 3) out.push([{ t: "Il resto lo imparo da quello che salvi e cerchi." }]);
  return out;
}

/** Per l'AI dei verdetti: il profilo in parole, senza id interni. */
// Senza le zone: l'AI non sa dove sono i locali (niente indirizzi nel prompt) e con le zone scriveva
// "quello che cerchi a Monteverde" anche per posti altrove. Le zone le usa già la ricerca.
export function gustoPerAI(m: MappaGusto): { tipi_che_piacciono: string[]; tipi_che_non_piacciono: string[]; preferisce: string | null } | null {
  const scoperta = scopertaPer(m);
  const piace = m.su.map((id) => tipoDa(id)?.titolo).filter((x): x is string => !!x);
  const no = m.giu.map((id) => tipoDa(id)?.titolo).filter((x): x is string => !!x);
  if (!piace.length && !no.length && !scoperta) return null;
  return {
    tipi_che_piacciono: piace,
    tipi_che_non_piacciono: no,
    preferisce: scoperta === "chicche" ? "posti poco noti, non turistici" : scoperta === "famosi" ? "anche i posti famosi" : scoperta === "misto" ? "famosi e poco noti" : null,
  };
}
