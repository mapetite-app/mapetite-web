// Il livello "alto" deve essere coerente con il perché scritto da Haiku. Visto dal vivo il 17/10:
// "Torre" era "alto" per "ristorante romantico con terrazza" con il perché "non viene
// esplicitamente menzionata una terrazza", e finiva in cima. Se il perché dichiara un dubbio
// su un requisito, il livello scende a "medio" (resta nella lista, solo meno in alto).
const DUBBIO =
  /\bnon\s+(?:viene|vengono|è|e'|sono|risulta|risultano)\s+(?:\S+\s+)?(?:esplicitamente\s+)?(?:menzionat|indicat|specificat|chiar|confermat|citat|descritt)|\bnon\s+(?:l[oai]\s+|ne\s+)?(?:descriv|menzion|cit|conferm)\w*\s+(?:\S+\s+)?(?:specificamente|esplicitamente|chiaramente)|\bnon\s+emerge|\bmeno\s+(?:adatt|idone)|\bun\s+rischio|\bmancano\s+(?:informazioni|dati)|\bmanca(?:no)?\s+(?:una\s+|la\s+|ogni\s+)?(?:menzion|conferm|riferiment|indicazion)|\bnon\s+si\s+(?:capisce|sa)\b|\bnessuna\s+(?:menzione|recensione\s+(?:parla|cita|menziona))/i;

export type Livello = "alto" | "medio" | "basso";

export function coherentLevel(level: Livello, matchReason: string | undefined): Livello {
  return level === "alto" && matchReason && DUBBIO.test(matchReason) ? "medio" : level;
}
