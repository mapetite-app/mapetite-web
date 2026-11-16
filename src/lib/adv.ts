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
const HASHTAG_NOMI = String.raw`(?:adv|ad|advertising|advertisement|sponsored|sponsorizzato|sponsorizzata|pubblicit[aàá]|paidpartnership|partnershipapagamento|inCollaborazioneCon)`;
const HASHTAG = new RegExp(String.raw`(?:^|[^\p{L}\p{N}_])#${HASHTAG_NOMI}(?![\p{L}\p{N}_])`, "iu");
const NEGAZIONE = /(?:^|[^\p{L}\p{N}_])(?:non|no|niente|nessun[oa]?|senza|not|zero|mai|never|nope|macch[eé]|assolutamente)(?![\p{L}\p{N}_])/iu;
// Revisore 3 del 16/11: la smentita può venire DOPO ("ADV? No, pago io", "Pubblicità\n(scherzo)") o l'hashtag
// può essere l'argomento ("Basta con i finti consigli #adv"). Se il testo contiene una di queste frasi, nessuna
// riga: un falso positivo accusa un creator onesto, un falso negativo lascia solo il verdetto (che c'è sempre).
const SMENTITA = new RegExp(
  [
    String.raw`pag(?:o|ato|ata|ati|hiamo)\s+(?:tutto\s+)?(?:da\s+)?(?:io|me|noi)`, String.raw`paid (?:for it )?myself`,
    "scherz", "joke", String.raw`macch[eé]`, "nope", "ma de che", String.raw`\blol\b`,
    String.raw`\bbasta\b`, String.raw`\bfint[io]\b`, String.raw`\bodio\b`, String.raw`\bstanc[oa]\b`, String.raw`\bproblema\b`,
    String.raw`chie(?:sto|dete|dono|de) se`, String.raw`#ad\s*#?hoc\b`, String.raw`\bse fosse\b`, String.raw`non (?:è|e'|sto facendo|faccio)`,
  ].join("|"),
  "iu",
);
const HANDLE = String.raw`@[\p{L}\p{N}_.]+`;
// Un pezzo che è solo l'etichetta, eventualmente con "post/contenuto" davanti e "con/da @nome" (o "@nome") dietro.
const ETICHETTA = new RegExp(
  String.raw`^(?:(?:post|contenuto|video|reel|foto)\s+)?(?:pubblicit[aàá]|sponsorizzat[oa]|sponsored|adv|advertising|advertisement|paid partnership|partnership a pagamento|in collaborazione)(?:\s+(?:(?:con|da|by|with|x|per)\s+)?${HANDLE}(?:\s+${HANDLE})*)?$`,
  "iu",
);
// "In collaborazione con @…" anche dentro una frase ("evento in collaborazione con @cantina"), mai con un nome
// senza @ ("con lo chef", "con la Pro Loco") e mai dopo una negazione nello stesso pezzo.
const COLLAB = new RegExp(String.raw`(?:^|[^\p{L}\p{N}_])in collaborazione con\s+${HANDLE}`, "iu");
// Separatori tra un pezzo e l'altro (tenuti, per sapere se un'etichetta è una domanda: "ADV?").
const SEPARATORI = /([\n\r|·•,;:.!?()[\]{}"“”«»*]+|\s[-–—]+\s|^[-–—]+\s|\s[-–—]+$)/u;
const pulisci = (p: string) => p.replace(/^[^\p{L}\p{N}@#]+|[^\p{L}\p{N}@#]+$/gu, "").replace(/\s+/g, " ");

type Pezzo = { testo: string; dopo: string };
function pezzi(t: string): Pezzo[] {
  const parti = t.split(SEPARATORI);
  const out: Pezzo[] = [];
  for (let i = 0; i < parti.length; i += 2) {
    const testo = pulisci(parti[i] ?? "");
    const dopo = parti[i + 1] ?? "";
    if (testo) out.push({ testo, dopo });
    else if (out.length && dopo) out[out.length - 1].dopo += dopo;
  }
  return out;
}

// Hashtag che vale: in un pezzo senza negazione prima, e non in una domanda ("#adv?").
function hashtagValido(p: Pezzo): boolean {
  const m = HASHTAG.exec(p.testo);
  return !!m && !NEGAZIONE.test(p.testo.slice(0, m.index)) && !p.dopo.includes("?");
}

/** true solo se il testo contiene una dicitura esplicita di promozione. */
export function segnataComePubblicita(testo: unknown): boolean {
  if (typeof testo !== "string" || testo.trim() === "") return false;
  const t = testo.normalize("NFC");
  if (SMENTITA.test(t)) return false;
  // "Supplì da paura 🤤 ADV": ADV in maiuscolo come ultima parola del testo.
  if (/(?:^|\s)ADV$/u.test(pulisci(t))) return true;
  const ps = pezzi(t);
  return ps.some((p, i) => {
    if (p.dopo.includes("?")) return false; // "ADV?", "Pubblicità?": una domanda non è una dicitura
    const seguito = ps[i + 1]?.testo ?? "";
    if (NEGAZIONE.test(seguito.split(" ").slice(0, 2).join(" "))) return false; // "ADV: no", "Pubblicità. Zero"
    return ETICHETTA.test(p.testo) || hashtagValido(p) || (COLLAB.test(p.testo) && !NEGAZIONE.test(p.testo));
  });
}

export const RIGA_ADV = "Il reel è segnato come pubblicità · il verdetto viene dalle recensioni";
