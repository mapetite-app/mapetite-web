// Proposta 60 "Il reel è segnato come pubblicità": SOLO quando la didascalia lo dice in modo esplicito
// (AGCOM: "ADV", "Pubblicità", "Sponsorizzato", "in collaborazione con @…"). Mai indovinare dal tono, mai un
// giudizio sul locale o sul creator. Nel dubbio: false.
//
// Revisori del 15/11: una parola nella frase non basta ("La pubblicità di questo posto", "senza pubblicità",
// "Non è un post sponsorizzato", "NO ADV, pago io"). Vale solo come ETICHETTA: un pezzo del testo, tra
// separatori (a capo, | - : · , . ! ? parentesi), che contiene soltanto la dicitura. Gli hashtag valgono
// ovunque, tranne dopo una negazione nello stesso pezzo ("No #adv").
//
// Modulo senza dipendenze: lo importa anche scripts/e2e/giro.mjs per i controlli.

// Hashtag di promozione dichiarata (non "#gifted", "#regalo" o "#collaborazione": ambigui).
const HASHTAG = /(?:^|[^\p{L}\p{N}_])#(?:adv|ad|advertising|advertisement|sponsored|sponsorizzato|sponsorizzata|pubblicit[aà]|paidpartnership|partnershipapagamento|inCollaborazioneCon)(?![\p{L}\p{N}_])/giu;
const NEGAZIONE = /(?:^|[^\p{L}\p{N}_])(?:non|no|niente|nessun[oa]?|senza|not|zero|mai|never)(?![\p{L}\p{N}_])/iu;
// Separatori tra un pezzo e l'altro. Il trattino solo se staccato ("Pubblicità - Trattoria", non "cento-anni").
const SEPARATORI = /[\n\r|·•,;:.!?()[\]{}"“”«»]|\s[-–—]+\s|^[-–—]+\s|\s[-–—]+$/u;
const HANDLE = String.raw`@[\p{L}\p{N}_.]+`;
// Un pezzo che è solo l'etichetta, eventualmente con "post/contenuto" davanti e "con/da @nome" dietro.
const ETICHETTA = new RegExp(
  String.raw`^(?:(?:post|contenuto|video|reel|foto)\s+)?(?:pubblicit[aà]|sponsorizzat[oa]|sponsored|adv|advertising|paid partnership|partnership a pagamento|in collaborazione)(?:\s+(?:con|da|by|with|x|per)\s+${HANDLE}(?:\s+${HANDLE})*)?$`,
  "iu",
);
// "In collaborazione con @…" anche dentro una frase ("evento in collaborazione con @cantina"), mai con un nome
// senza @ ("con lo chef", "con la Pro Loco") e mai dopo una negazione nello stesso pezzo.
const COLLAB = new RegExp(String.raw`(?:^|[^\p{L}\p{N}_])in collaborazione con\s+${HANDLE}`, "iu");

function pezzi(t: string): string[] {
  return t
    .split(SEPARATORI)
    .map((p) => p.replace(/^[^\p{L}\p{N}@#]+|[^\p{L}\p{N}@#]+$/gu, "").replace(/\s+/g, " "))
    .filter((p) => p !== "");
}

function hashtagSenzaNegazione(p: string): boolean {
  for (const m of p.matchAll(HASHTAG)) {
    if (!NEGAZIONE.test(p.slice(0, m.index ?? 0))) return true;
  }
  return false;
}

/** true solo se il testo contiene una dicitura esplicita di promozione. */
export function segnataComePubblicita(testo: unknown): boolean {
  if (typeof testo !== "string" || testo.trim() === "") return false;
  return pezzi(testo.normalize("NFC")).some(
    (p) => ETICHETTA.test(p) || hashtagSenzaNegazione(p) || (COLLAB.test(p) && !NEGAZIONE.test(p)),
  );
}

export const RIGA_ADV = "Il reel è segnato come pubblicità · il verdetto viene dalle recensioni";
