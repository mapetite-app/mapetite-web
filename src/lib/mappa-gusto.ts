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

export type MappaGusto = {
  v: 1;
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
  return { v: 1, zone: soloNoti(o.zone, zoneNote, 4), su, giu, scoperta };
}

export const dieteValide = (raw: unknown): string[] => soloNoti(raw, (x) => DIETE.some((d) => d.id === x), DIETE.length);

/** Famosi o chicche, dedotto dai 👍: chi ama più i posti poco noti preferisce le chicche. */
export function scopertaDedotta(su: string[]): Scoperta | null {
  const tipi = su.map(tipoDa).filter((t): t is TipoPosto => t != null);
  if (tipi.length === 0) return null;
  const famosi = tipi.filter((t) => t.famoso).length;
  const chicche = tipi.length - famosi;
  if (chicche >= famosi + 1) return "chicche";
  if (famosi > chicche) return "famosi";
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

/** La prima ricerca "5 posti per te": il tipo piaciuto più adatto, la zona, e "non turistico" per chi ama le chicche. */
export function queryPerTe(m: MappaGusto, citta: string | null): string | null {
  const scoperta = m.scoperta ?? scopertaDedotta(m.su);
  const tipi = m.su.map(tipoDa).filter((t): t is TipoPosto => t != null);
  // Per chi ama le chicche si parte da un tipo "chicca"; per chi ama i famosi da uno famoso.
  const primo = (scoperta === "chicche" ? tipi.find((t) => !t.famoso) : scoperta === "famosi" ? tipi.find((t) => t.famoso) : null) ?? tipi[0];
  if (!primo) return null;
  const base = primo.query.charAt(0).toUpperCase() + primo.query.slice(1);
  const nonTuristico = scoperta === "chicche" ? " non turistico" : "";
  const dove = m.zone[0] ? ` a ${m.zone[0]}` : citta ? ` a ${citta}` : "";
  return `${base}${nonTuristico}${dove}`;
}

/** "Ecco cosa ho capito di te": righe brevi, solo da quello che la persona ha detto. */
export function capito(m: MappaGusto, extra: { citta: string | null; priceRange: string | null; diete: string[]; occasions: { label: string }[] }): { chiave: string; emoji: string; testo: string }[] {
  const out: { chiave: string; emoji: string; testo: string }[] = [];
  const dove = m.zone.length ? m.zone.join(", ") : extra.citta;
  if (dove) out.push({ chiave: "zone", emoji: "📍", testo: `Esci soprattutto a ${dove}` });
  const su = m.su.map(tipoDa).filter((t): t is TipoPosto => t != null);
  if (su.length) out.push({ chiave: "su", emoji: "❤️", testo: `Ti piacciono: ${su.slice(0, 3).map((t) => t.titolo.toLowerCase()).join(", ")}` });
  const giu = m.giu.map(tipoDa).filter((t): t is TipoPosto => t != null);
  if (giu.length) out.push({ chiave: "giu", emoji: "🙅", testo: `Meno: ${giu.slice(0, 2).map((t) => t.titolo.toLowerCase()).join(", ")}` });
  const scoperta = m.scoperta ?? scopertaDedotta(m.su);
  if (scoperta === "chicche") out.push({ chiave: "scoperta", emoji: "💎", testo: "Preferisci le chicche: i posti di massa li metto in fondo" });
  else if (scoperta === "famosi") out.push({ chiave: "scoperta", emoji: "⭐", testo: "Ti piacciono anche i posti famosi" });
  if (extra.occasions.length) out.push({ chiave: "occasioni", emoji: "🗓️", testo: `Esci per: ${extra.occasions.slice(0, 3).map((o) => o.label.toLowerCase()).join(", ")}` });
  if (extra.priceRange) out.push({ chiave: "spesa", emoji: "💶", testo: `Spesa tipica ${extra.priceRange}` });
  const diete = extra.diete.map((id) => DIETE.find((d) => d.id === id)?.label.toLowerCase()).filter(Boolean);
  if (diete.length) out.push({ chiave: "diete", emoji: "🥗", testo: `Sempre: ${diete.join(", ")}` });
  return out;
}

/** Per l'AI dei verdetti: il profilo in parole, senza id interni. */
export function gustoPerAI(m: MappaGusto): { zone_preferite: string[]; tipi_che_piacciono: string[]; tipi_che_non_piacciono: string[]; preferisce: string | null } | null {
  const scoperta = m.scoperta ?? scopertaDedotta(m.su);
  const piace = m.su.map((id) => tipoDa(id)?.titolo).filter((x): x is string => !!x);
  const no = m.giu.map((id) => tipoDa(id)?.titolo).filter((x): x is string => !!x);
  if (!m.zone.length && !piace.length && !no.length && !scoperta) return null;
  return {
    zone_preferite: m.zone,
    tipi_che_piacciono: piace,
    tipi_che_non_piacciono: no,
    preferisce: scoperta === "chicche" ? "posti poco noti, non turistici" : scoperta === "famosi" ? "anche i posti famosi" : scoperta === "misto" ? "famosi e poco noti" : null,
  };
}
