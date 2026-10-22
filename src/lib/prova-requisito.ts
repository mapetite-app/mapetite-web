// "Come lo sai?" (proposta 18, 22/10): la frase di una recensione Google che conferma un requisito
// della richiesta ("✓ terrazza" → «Cena in terrazza al tramonto»). Solo copiata, mai riscritta:
// se nessuna frase contiene la parola, niente prova (il ✓ resta quello dell'AI).

const MAX = 140;
const VUOTE = new Set(["per", "con", "dei", "del", "della", "una", "uno"]);

// "romantico" → "romantic", "terrazza" → "terrazz": prende anche romantica, romantici, terrazze.
function radice(w: string): string {
  return w.length > 4 ? w.replace(/[aeio]$/, "") : w;
}

function normalizza(t: string): string {
  return t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

// Frasi con una negazione, un dubbio o un confronto OVUNQUE ("purtroppo non è stata utilizzabile",
// "niente di straordinario", "poco romantico", "rispetto a molti rooftop"): non sono una prova.
// Meglio perdere una prova buona che mostrarne una che dice il contrario (terzo collaudo, 22/10).
// Quinto collaudo (22/10 mattina): anche attese deluse ("doveva essere", "speravamo"), chiusure, confronti
// ("più bella quella accanto"), ironia ("romantico come una mensa").
const DUBBIO = /\b(non|niente|nessun[oa]?|senza|manca\w*|mai|purtroppo|peccato|poco|forse|inesistente|granche|deludent\w*|delusion\w*|aspett\w*|rispetto|altri|altro|invece|tranne|nonostante|nulla|pero|ma|troppo|lent\w*|pecca|turistic\w*|chius\w*|riservat\w*|solo|dovev\w*|volev\w*|sper\w*|cercav\w*|pensav\w*|sarebbe|vorrebbe|ne|neanche|nemmeno|neppure|come|piu|meno|meglio|accanto|fronte|rovinat\w*|completo|sedicente|spaccia\w*|inagibil\w*|eufemism\w*|promess\w*|realta|direi|chiamarl\w*|definisc\w*)\b/;
// La frase deve anche DIRE che è bello: un giudizio positivo, non solo nominare la cosa
// ("In inverno la terrazza è chiusa", "Vestitevi eleganti" non sono una prova).
const POSITIVO = /\b(bell\w*|splendid\w*|stupend\w*|perfett\w*|ottim\w*|meraviglios\w*|mozzafiato|suggestiv\w*|incantevol\w*|magic\w*|fantastic\w*|spettacolar\w*|favolos\w*|deliziosa|delizioso|eccezional\w*|piacevol\w*|raffinat\w*|curat\w*|accoglient\w*|ideale|consigliat\w*|molto|davvero|super|top)\b/;
// "vista" verbo ("l'ho vista", "è stata vista"): non è la vista del locale.
const VISTA_VERBO = /\b(l'?ho|ho|hai|abbiamo|avevo|stata|stato|l')\s*vist/;

// Recensioni con il voto (Google): la prova si cerca prima nelle 5 e 4 stelle, mai in quelle da 1-2
// (collaudo del 22/10: "✓ rooftop" mostrava la frase di una recensione da 1 stella).
export function provaRequisito(requisito: string, recensioni: { text: string; rating?: number | null }[] | null | undefined, nomeLocale = ""): string | null {
  const parole = normalizza(requisito).split(/\s+/).filter((w) => w.length >= 3 && !VUOTE.has(w));
  // "non turistico": una frase che contiene "turistico" direbbe spesso il contrario.
  if (parole.length === 0 || parole[0] === "non") return null;
  const radici = parole.map(radice).map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  // Parola intera: la radice e al massimo 3 lettere ("romantic|a" sì, "roma" in "romantica" no,
  // "tranquill|amente" no). Quarto collaudo, 22/10: "roma" e "romana" si confermavano con "romantica".
  const parola = (x: string) => new RegExp(`\\b${x}[a-z]{0,3}\\b`);
  // La parola è nel nome del locale ("Terrazza Palestro", "The Vista Rooftop"): le recensioni la usano
  // per chiamare il posto, non per confermarlo. Niente prova (il nome lo dice già da solo).
  const nome = normalizza(nomeLocale);
  // Nel nome anche attaccata a cifre ("Terrazza12"): \b non separa lettere e cifre.
  if (nome && radici.some((x) => new RegExp(`\\b${x}[a-z]{0,3}(?![a-z])`).test(nome))) return null;
  const ordinate = [...(recensioni ?? [])].filter((r) => r.rating != null && r.rating >= 4).sort((a, b) => (b.rating ?? 3) - (a.rating ?? 3));
  for (const r of ordinate) {
    const frasi = r.text.split(/(?<=[.!?…])\s+|\n+/);
    for (const f of frasi) {
      const n = normalizza(f);
      if (!radici.every((x) => parola(x).test(n))) continue;
      // "vista" che non è il panorama: "cucina a vista", "pietra a vista", "visto il luogo", "vista la location".
      if (radici.includes("vist") && (/\ba vista\b|\bvisto\b|\bvista (la|il|l'|i|le)\b/.test(n) || !/\bvist[ae]\b/.test(n))) continue;
      if (DUBBIO.test(n) || VISTA_VERBO.test(n) || n.includes("?") || !POSITIVO.test(n)) continue;
      const pulita = f.trim().replace(/^[«"“]+|[»"”]+$/g, "");
      if (pulita.length < 25) continue;
      if (pulita.length <= MAX) return pulita;
      // Frase lunga: si taglia attorno alla parola trovata, con i puntini.
      const at = Math.max(0, normalizza(pulita).search(parola(radici[0])) - 50);
      const pezzo = pulita.slice(at, at + MAX).replace(at > 0 ? /^\S*\s/ : /^$/, "").replace(/\s\S*$/, "");
      return `${at > 0 ? "…" : ""}${pezzo}…`;
    }
  }
  return null;
}

// Tipi di locale: non sono requisiti da confermare ("trattoria autentica" → resta solo "autentica").
const TIPI = /^(ristorant|trattori|osteri|pizzeri|enotec|bar|pub|caff|bistrot|locale|posto|cocktail)/;

// Etichetta pulita del requisito: solo parole scritte nella richiesta (stessa radice), senza il tipo
// di locale. null se ne resta fuori anche una (l'AI aggiungeva "vista" o "cucina romana" non chiesti).
export function requisitoDellaRichiesta(requisito: string, richiesta: string, zona: string | null = null): string | null {
  const q = normalizza(richiesta);
  const parole = requisito.trim().toLowerCase().split(/\s+/).filter((w) => !TIPI.test(normalizza(w)));
  if (parole.length === 0 || parole.length > 2) return null;
  // La zona capita dalla ricerca ("ristorante romantico trastevere"): non è un requisito da confermare.
  const zonaParole = new Set(normalizza(zona ?? "").split(/[\s,']+/).filter((w) => w.length >= 3));
  if (parole.some((w) => zonaParole.has(normalizza(w)) || /^(centro|storico)$/.test(normalizza(w)))) return null;
  // Città e zone non sono requisiti da confermare ("a Milano", "sui Navigli", "a Trastevere", "Roma").
  const esc = (w: string) => normalizza(w).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (parole.some((w) => /^(roma|milano|romana|romano|milanese)$/.test(normalizza(w)) || new RegExp(`\\b(a|in|sui|sul|ai|al|nel|nei|zona|vicino)\\s+${esc(w)}\\b`).test(q))) return null;
  const tutte = parole.every((w) => VUOTE.has(w) || w === "non" || new RegExp(`\\b${radice(normalizza(w)).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[a-z]{0,3}\\b`).test(q));
  return tutte ? parole.join(" ") : null;
}

// Requisito confermato e la frase di recensione Google che lo prova (copiata, mai riscritta).
export type Requisito = { r: string; prova: string };

// "✓ terrazza" sulle card (chiave B). Spento il 22/10 notte dopo due bocciature; riacceso il 22/10
// mattina (poi di nuovo spento: terza bocciatura sui casi avversari, regole rafforzate sotto): la prova ora si cerca nel primo tempo della ricerca, sulle 5 recensioni intere con il voto
// (prima: 3 recensioni tagliate a 300 caratteri e senza voto, quindi anche quelle da 1 stella), e per
// i requisiti capiti dalla ricerca invece che per quelli scelti dall'AI. Niente AI: zero costi, subito.
export const REQUISITI_ACCESI = false;

// Requisiti della ricerca ("romantico", "terrazza") confermati da una frase delle recensioni di
// QUESTO locale. Massimo 3; un requisito senza frase che lo provi non compare.
export function requisitiProvati(paroleChiave: string[], richiesta: string, recensioni: { text: string; rating?: number | null }[] | null | undefined, nomeLocale = "", zona: string | null = null): Requisito[] {
  const out: Requisito[] = [];
  for (const k of paroleChiave) {
    const r = requisitoDellaRichiesta(k, richiesta, zona);
    if (!r || out.some((x) => x.r === r)) continue;
    const prova = provaRequisito(r, recensioni, nomeLocale);
    if (prova) out.push({ r, prova });
    if (out.length >= 3) break;
  }
  return out;
}
