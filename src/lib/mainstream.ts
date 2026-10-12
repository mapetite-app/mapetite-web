// "Non turistico", "autentico", "poco conosciuto": la richiesta chiede
// esplicitamente di evitare i locali di massa. Google mette in cima proprio
// quelli con decine di migliaia di recensioni (Tonnarello, 110k a Trastevere),
// quindi in questi casi si spostano IN FONDO (mai esclusi) i locali con molte
// più recensioni degli altri risultati. Solo ordine: nessuna chiamata in più.
const OFF_THE_BEATEN_PATH =
  /\b(?:non|poco)\s+(?:troppo\s+)?(?:turistic|famos|mainstream|commercial|conosciut)|\bautentic|\bgenuin|\bnascost|\bsconosciut|\bsegret|\bda\s+romani|\bdove\s+vanno\s+(?:i|gli)\s+(?:romani|milanesi|napoletani|fiorentini|locali|abitanti)|\bfuori\s+dai\s+(?:soliti\s+)?giri|\bgemm[ae]\b|\blontano\s+dai\s+turisti|\bsenza\s+turisti/i;

// Massiccio = almeno MIN_COUNT recensioni E più di RATIO volte la mediana dei risultati.
// 2,5 (era 3): a Trastevere Da Enzo (10.239 recensioni, mediana ~3.900) restava primo.
// MIN_COUNT 3.000 (era 8.000): ai Navigli i locali da turisti hanno ~4.500 recensioni, non 10.000;
// a Roma non cambia nulla perché lì decide la mediana (×2,5 ≈ 9.750).
const MIN_COUNT = 3000;
const RATIO = 2.5;
const MEDIOCRE_RATING = 4.3;

export function wantsOffTheBeatenPath(query: string): boolean {
  return OFF_THE_BEATEN_PATH.test(query);
}

export function demoteMainstream<T extends { name: string; userRatingCount: number | null; rating?: number | null }>(
  query: string,
  places: T[],
): { places: T[]; demoted: string[] } {
  if (places.length < 4 || !wantsOffTheBeatenPath(query)) return { places, demoted: [] };
  const counts = places.map((p) => p.userRatingCount ?? 0).sort((a, b) => a - b);
  const median = counts[Math.floor(counts.length / 2)];
  const limit = Math.max(MIN_COUNT, median * RATIO);
  // Di massa: molte più recensioni degli altri, oppure tante recensioni con un voto mediocre
  // (il segno tipico del posto da turisti: Spritz Navigli 4,0 con 4.526 recensioni).
  const isMass = (p: T) => {
    const n = p.userRatingCount ?? 0;
    return n > limit || (n >= MIN_COUNT && p.rating != null && p.rating < MEDIOCRE_RATING);
  };
  const kept = places.filter((p) => !isMass(p));
  // Se sono tutti "di massa" non si tocca nulla.
  if (kept.length === 0 || kept.length === places.length) return { places, demoted: [] };
  const mass = places.filter(isMass);
  return { places: [...kept, ...mass], demoted: mass.map((p) => p.name) };
}
