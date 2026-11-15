// Proposta 60 "Il reel è segnato come pubblicità": SOLO quando la didascalia lo dice in modo esplicito
// (AGCOM: "ADV", "Pubblicità", "Sponsorizzato", "in collaborazione con"). Mai indovinare dal tono, mai un
// giudizio sul locale o sul creator. Senza dicitura: false.
//
// Modulo senza dipendenze: lo importa anche scripts/e2e/giro.mjs per i controlli.

// Hashtag di promozione dichiarata (non "#gifted", "#regalo" o "#collaborazione": ambigui).
const HASHTAG = /(?:^|[^\p{L}\p{N}_])#(?:adv|ad|advertising|advertisement|sponsored|sponsorizzato|sponsorizzata|pubblicit[aà]|paidpartnership|partnershipapagamento|inCollaborazioneCon)(?![\p{L}\p{N}_])/iu;
// Parole intere: "Pubblicità", "Sponsorizzato/a", "paid partnership", "partnership a pagamento". Revisore 15/11:
// mai dopo una negazione ("non sponsorizzato, pago io", "Non è pubblicità!", "no pubblicità").
const FRASI = /(?:^|[^\p{L}\p{N}_])(?:pubblicit[aà]|sponsorizzat[oa]|paid partnership|partnership a pagamento)(?![\p{L}\p{N}_])/giu;
const NEGAZIONE = /(?:^|[^\p{L}\p{N}_])(?:non|no|niente|nessuna|not|zero)(?:\s+(?:è|e'|e|un[ao]?|una|di|a|is|an?))*\s*[,:]?\s*$/iu;
// "In collaborazione con @…" solo come dicitura (a inizio riga o seguita da @): "cena in collaborazione con lo chef" no.
const COLLAB = /(?:^|\n)\s*in collaborazione con\b|in collaborazione con\s+@/iu;
// "ADV" da solo solo in maiuscolo.
const ADV_MAIUSCOLO = /(?:^|[^\p{L}\p{N}_])ADV(?![\p{L}\p{N}_])/u;

function fraseSenzaNegazione(t: string): boolean {
  for (const m of t.matchAll(FRASI)) {
    const inizio = (m.index ?? 0) + (/^[\p{L}]/u.test(m[0]) ? 0 : 1);
    const prima = t.slice(Math.max(0, inizio - 24), inizio);
    if (!NEGAZIONE.test(prima)) return true;
  }
  return false;
}

/** true solo se il testo contiene una dicitura esplicita di promozione. */
export function segnataComePubblicita(testo: unknown): boolean {
  if (typeof testo !== "string" || testo.trim() === "") return false;
  const t = testo.normalize("NFC");
  return HASHTAG.test(t) || fraseSenzaNegazione(t) || COLLAB.test(t) || ADV_MAIUSCOLO.test(t);
}

export const RIGA_ADV = "Il reel è segnato come pubblicità · il verdetto viene dalle recensioni";
