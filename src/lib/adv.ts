// Proposta 60 "Il reel è segnato come pubblicità": SOLO quando la didascalia lo dice in modo esplicito
// (AGCOM: "ADV", "Pubblicità", "Sponsorizzato", "in collaborazione con"). Mai indovinare dal tono, mai un
// giudizio sul locale o sul creator. Senza dicitura: false.
//
// Modulo senza dipendenze: lo importa anche scripts/e2e/giro.mjs per i controlli.

// Hashtag di promozione dichiarata (non "#gifted" o "#regalo": ambigui).
const HASHTAG = /(?:^|[^\p{L}\p{N}_])#(?:adv|ad|advertising|advertisement|sponsored|sponsorizzato|sponsorizzata|pubblicit[aà]|paidpartnership|partnershipapagamento|collaborazione|inCollaborazioneCon)(?![\p{L}\p{N}_])/iu;
// Parole intere nel testo (non dentro altre parole): "Pubblicità", "Sponsorizzato", "in collaborazione con",
// "paid partnership", "partnership a pagamento", "advertising", "contenuto sponsorizzato". "ADV" da solo solo in maiuscolo.
const FRASI = /(?:^|[^\p{L}\p{N}_])(?:pubblicit[aà]|sponsorizzat[oa]|in collaborazione con|paid partnership|partnership a pagamento|advertising)(?![\p{L}\p{N}_])/iu;
const ADV_MAIUSCOLO = /(?:^|[^\p{L}\p{N}_])ADV(?![\p{L}\p{N}_])/u;

/** true solo se il testo contiene una dicitura esplicita di promozione. */
export function segnataComePubblicita(testo: unknown): boolean {
  if (typeof testo !== "string" || testo.trim() === "") return false;
  const t = testo.normalize("NFC");
  return HASHTAG.test(t) || FRASI.test(t) || ADV_MAIUSCOLO.test(t);
}

export const RIGA_ADV = "Il reel è segnato come pubblicità · il verdetto viene dalle recensioni";
