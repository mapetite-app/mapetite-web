import { categoryLabel } from "@/lib/category-label";
import { cityFromAddress } from "@/lib/city";

// "La tua carta del gusto": riassunto del gusto SOLO dai salvati veri dell'utente.
// Niente AI, niente frasi inventate: numeri contati e un titolo scelto da regole fisse,
// sempre con il "perché" (es. "4 dei tuoi 9 salvati"). Nessun nome di locale.

export type CartaRow = {
  category: string | null;
  address: string | null;
  tags: string[] | null;
  pocoConosciuto?: boolean | null; // null/assente = non si sa (colonna nuova, spesso vuota)
};

export type Carta = {
  salvati: number;
  provati: number;
  citta: string[]; // le città con più salvati (max 2)
  cittaCount: number;
  tipi: { label: string; count: number }[]; // top 3
  raccolte: { nome: string; count: number }[]; // top 3
  gemmePct: number | null; // % di posti poco conosciuti, solo se il dato c'è su abbastanza salvati
  titolo: string;
  perche: string;
};

export const CARTA_MIN = 3;
const STATE_WANT = "Da provare";
const STATE_DONE = "Già visitato";
// Il dato "poco conosciuto" si mostra solo se noto per almeno 3 salvati (e metà del totale).
const GEM_MIN_KNOWN = 3;

type Famiglia = { titolo: string; plurale: string; test: RegExp };
// Ordine = priorità a parità di conteggio. Si confronta categoria Google ed etichetta italiana.
const FAMIGLIE: Famiglia[] = [
  { titolo: "Cacciatore di trattorie", plurale: "trattorie e osterie", test: /trattoria|osteria|italian_restaurant|ristorante italiano/ },
  { titolo: "Esploratore di cocktail bar", plurale: "cocktail bar", test: /cocktail|lounge/ },
  { titolo: "Anima da enoteca", plurale: "enoteche e wine bar", test: /wine|enoteca|vino/ },
  { titolo: "Intenditore di pizza", plurale: "pizzerie", test: /pizz/ },
  { titolo: "Amante del pesce", plurale: "posti di pesce", test: /seafood|pesce/ },
  { titolo: "Viaggiatore d'Oriente", plurale: "posti di cucina asiatica", test: /japanese|sushi|ramen|chinese|thai|korean|vietnam|asian|indian|giappon|cinese/ },
  { titolo: "Re della colazione", plurale: "caffè, forni e pasticcerie", test: /cafe|coffee|caff|bakery|forno|pastry|pasticc|breakfast|brunch|colazione/ },
  { titolo: "Goloso seriale", plurale: "gelaterie e dolci", test: /ice_cream|gelat|dessert|dolci|cake|chocolate/ },
  { titolo: "Re dell'aperitivo", plurale: "bar e pub", test: /^bar$|^pub$|bar_and_grill|birr|brew/ },
  { titolo: "Buongustaio da ristorante", plurale: "ristoranti", test: /restaurant|ristorante|bistro|steak|fine_dining/ },
];

function famiglia(category: string | null): Famiglia | null {
  if (!category) return null;
  const c = category.toLowerCase();
  const l = (categoryLabel(category) ?? "").toLowerCase();
  return FAMIGLIE.find((f) => f.test.test(c) || f.test.test(l)) ?? null;
}

function top<T extends string>(items: T[], n: number): { key: T; count: number }[] {
  const m = new Map<T, number>();
  for (const it of items) m.set(it, (m.get(it) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([key, count]) => ({ key, count }));
}

export function buildCarta(rows: CartaRow[]): Carta {
  const salvati = rows.length;
  const provati = rows.filter((r) => r.tags?.includes(STATE_DONE)).length;
  const cities = top(rows.flatMap((r) => { const c = cityFromAddress(r.address); return c ? [c] : []; }), 99);
  const tipi = top(rows.flatMap((r) => { const l = categoryLabel(r.category); return l ? [l] : []; }), 3).map((t) => ({ label: t.key, count: t.count }));
  const raccolte = top(rows.flatMap((r) => (r.tags ?? []).filter((t) => t !== STATE_WANT && t !== STATE_DONE)), 3).map((t) => ({ nome: t.key, count: t.count }));

  const known = rows.filter((r) => r.pocoConosciuto === true || r.pocoConosciuto === false);
  const gems = known.filter((r) => r.pocoConosciuto === true).length;
  const gemmePct = known.length >= GEM_MIN_KNOWN && known.length * 2 >= salvati ? Math.round((gems / known.length) * 100) : null;

  // Titolo: prima i posti poco conosciuti (il differenziatore), poi la famiglia più salvata,
  // poi chi gira molte città; altrimenti un titolo neutro. Ogni titolo ha il suo "perché".
  let titolo = "Buongustaio curioso";
  let perche = `${salvati} posti salvati, ognuno scelto da te`;
  const fam = top(rows.flatMap((r) => { const f = famiglia(r.category); return f ? [f.titolo] : []; }), 1)[0];
  const famDef = fam ? FAMIGLIE.find((f) => f.titolo === fam.key)! : null;
  if (gemmePct != null && gemmePct >= 40 && gems >= 2) {
    titolo = "Cercatore di posti nascosti";
    perche = `${gems} dei tuoi salvati sono posti poco conosciuti`;
  } else if (famDef && fam && fam.count >= 2 && fam.count * 4 >= salvati) {
    titolo = famDef.titolo;
    perche = `${fam.count} dei tuoi ${salvati} salvati sono ${famDef.plurale}`;
  } else if (cities.length >= 3) {
    titolo = "Esploratore di città";
    perche = `Hai salvati in ${cities.length} città diverse`;
  }

  return {
    salvati,
    provati,
    citta: cities.slice(0, 2).map((c) => c.key),
    cittaCount: cities.length,
    tipi,
    raccolte,
    gemmePct,
    titolo,
    perche,
  };
}
