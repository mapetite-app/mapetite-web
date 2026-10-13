// "Ristorante stellato", "stella Michelin": per Lorenzo stellato = almeno una stella
// Michelin. Non abbiamo una fonte Michelin, quindi l'app NON può dire che un locale
// è stellato (nessun badge). Può solo:
//   - tenere "stellato Michelin" nella query a Google e non restringerla a un tipo di
//     cucina (con includedType "seafood_restaurant" Google tiene fuori i ristoranti di
//     alta cucina registrati come "fine_dining_restaurant", cioè proprio gli stellati, e
//     viceversa "fine_dining_restaurant" tiene fuori lo stellato registrato come "pesce");
//   - mettere IN CIMA i locali di cui la descrizione Google o le recensioni parlano
//     esplicitamente della stella Michelin. Gli altri restano, dopo. Mai esclusi.
// Solo ordine e testo che Google dà già: nessuna chiamata in più.

// "Cena sotto un cielo stellato" non è una richiesta di stella Michelin.
const CIELO = /\b(?:cielo|notte|serata|volta|soffitto)\s+stellat[oaie]\b|\bsotto\s+le\s+stelle\b/gi;
const ASKS = /\bmichelin\b|\bstellat[oaie]\b|\bstell[ae]\s+michelin|\bstarred\b/i;

// Nelle recensioni / descrizione: Michelin, stellato, "una stella", Michelin star, starred.
const MENTIONS = /\bmichelin\b|\bstellat[oaie]\b|\bstarred\s+(?:restaurant|chef)\b|\b(?:una|1|due|2|tre|3)\s+stell[ae]\s+michelin/i;

export function wantsMichelin(query: string): boolean {
  return ASKS.test(query.replace(CIELO, " "));
}

// Tipi Google troppo stretti per una richiesta di stellato: si allargano a "restaurant".
const NARROW_RESTAURANT_TYPES = new Set([
  "seafood_restaurant", "italian_restaurant", "sushi_restaurant", "steak_house",
  "pizza_restaurant", "vegetarian_restaurant", "vegan_restaurant", "bar_and_grill",
  "fine_dining_restaurant",
]);

// Query e tipo per Google quando la richiesta chiede uno stellato. Mantiene la frase
// "stellato Michelin" anche se la riscrittura dell'intento l'ha tolta.
export function michelinGoogleQuery(
  query: string,
  queryGoogle: string,
  includedType: string | null | undefined,
): { queryGoogle: string; includedType: string | null | undefined; changed: string[] } {
  if (!wantsMichelin(query)) return { queryGoogle, includedType, changed: [] };
  const changed: string[] = [];
  let q = queryGoogle;
  if (!/\bmichelin\b/i.test(q)) {
    q = /\bstellat[oaie]\b/i.test(q) ? `${q} Michelin` : `${q} stellato Michelin`;
    changed.push(`query "${queryGoogle}" → "${q}"`);
  }
  let t = includedType;
  if (t && NARROW_RESTAURANT_TYPES.has(t)) {
    t = "restaurant";
    changed.push(`tipo ${includedType} → restaurant`);
  }
  return { queryGoogle: q, includedType: t, changed };
}

export type MichelinInput = {
  name: string;
  editorialSummary?: string | null;
  reviewTexts?: string[] | null;
  reviewOrigins?: { lang: string | null; text: string | null }[] | null;
};

// Quante fonti Google (descrizione + recensioni) citano la stella. 0 = nessuna.
export function michelinMentions(p: MichelinInput): number {
  const texts = [p.editorialSummary ?? "", ...(p.reviewTexts ?? []).map((t, i) => `${t}\n${p.reviewOrigins?.[i]?.text ?? ""}`)];
  return texts.filter((t) => t && MENTIONS.test(t.replace(CIELO, " "))).length;
}

export function promoteMichelin<T extends MichelinInput>(
  query: string,
  places: T[],
): { places: T[]; applied: boolean; cited: string[]; log: string[] } {
  if (!wantsMichelin(query)) return { places, applied: false, cited: [], log: [] };
  const scored = places.map((p) => ({ p, n: michelinMentions(p) }));
  const cited = scored.filter((x) => x.n > 0);
  const rest = scored.filter((x) => x.n === 0);
  return {
    // Ordine stabile: dentro ciascun gruppo resta l'ordine di Google.
    places: [...cited.map((x) => x.p), ...rest.map((x) => x.p)],
    applied: true,
    cited: cited.map((x) => x.p.name),
    log: cited.map((x) => `${x.p.name} (citata in ${x.n} ${x.n === 1 ? "testo" : "testi"})`),
  };
}
