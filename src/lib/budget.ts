// Budget scritto nella frase ("massimo 50 euro a testa", "spendendo poco"): fino al 5/11 la ricerca lo
// ignorava e un posto €€€€ poteva aprire la lista di chi aveva scritto 30 euro. Regole fisse, senza AI
// (stesse risposte salvate per i test). I posti sopra il budget vanno in fondo, mai esclusi; un posto
// senza fascia di prezzo Google resta dov'è (non si sa). Funzioni pure (le usa anche il giro).

// Fascia di prezzo Google (1 = €, 4 = €€€€) dalla cifra a testa: € fino a ~15, €€ ~15–35, €€€ ~35–60.
export function livelloDaEuro(euro: number): number {
  if (euro <= 15) return 1;
  if (euro <= 35) return 2;
  if (euro <= 60) return 3;
  return 4;
}

const CIFRA = String.raw`(\d{1,3})\s*(?:euro|eur|€)`;
const MAX_PRIMA = new RegExp(String.raw`\b(?:massimo|max|entro|sotto|non più di|non piu di|meno di|fino a|budget(?: di)?|spendere|spendendo)\s+(?:i\s+|gli\s+)?${CIFRA}`, "i");
const A_TESTA = new RegExp(String.raw`${CIFRA}\s*(?:a|per)\s*(?:testa|persona|cranio)`, "i");
const POCO = /\b(?:economic[oaie]|spendere poco|spendendo poco|senza spendere|low cost|poco costos[oaie]|prezzi bassi|prezzi onesti|che costi poco)\b/i;

/** Fascia massima (1–4) chiesta nella frase, o null se la frase non parla di budget. */
export function prezzoMax(query: string): number | null {
  const q = query.toLowerCase();
  const m = q.match(MAX_PRIMA) ?? q.match(A_TESTA);
  if (m) {
    const euro = Number(m[1]);
    if (euro >= 5 && euro <= 500) return livelloDaEuro(euro);
  }
  if (POCO.test(q)) return 2;
  return null;
}

/** Sposta in fondo (stesso ordine tra loro) i posti con fascia Google sopra il massimo. */
export function inFondoPerPrezzo<T extends { priceLevel: number | null; name: string }>(places: T[], max: number): { places: T[]; demoted: string[] } {
  const sopra = (p: T) => typeof p.priceLevel === "number" && p.priceLevel > max;
  const tenuti = places.filter((p) => !sopra(p));
  const giu = places.filter(sopra);
  // Se fossero tutti sopra il budget non si sposta niente: l'ordine di Google resta il migliore.
  if (giu.length === 0 || tenuti.length === 0) return { places, demoted: [] };
  return { places: [...tenuti, ...giu], demoted: giu.map((p) => p.name) };
}
