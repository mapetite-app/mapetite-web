// Proposta 91 "Per chi è celiaco" (27/11): cosa dicono del senza glutine le recensioni Google che leggiamo
// (le 5 della Text Search, con il voto). Solo regole, nessuna chiamata in più, e solo frasi copiate:
// mai scritto "sicuro" o "adatto ai celiaci" da noi. Quattro casi:
// - "attenzione": una frase mette in guardia (contaminazione, stare male, nessuna attenzione);
// - "bene": frasi di recensioni da 4-5 stelle che ne parlano bene, senza negazioni né dubbi;
// - "ne-parla": se ne parla, ma non in modo chiaro (si mostra la frase, senza ✓);
// - "niente": nessuna delle recensioni lette ne parla ("chiedi al locale").
// Nel dubbio si scende di grado: meglio "ne parla" che un ✓ falso (VISIONE: l'app non inventa).
// Nessun import con alias: il giro automatico importa questo file da Node.

export type Glutine = {
  stato: "bene" | "attenzione" | "ne-parla" | "niente";
  frase: string | null; // copiata dalla recensione, al massimo 140 caratteri
  n: number; // recensioni che ne parlano bene (solo "bene")
  lette: number; // recensioni lette
};

const MAX = 140;

function normalizza(t: string): string {
  return t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[’`]/g, "'");
}

// Se ne parla: glutine, celiaco/a/i, gluten free (anche nelle recensioni in inglese).
const MENZIONE = /\b(glutine|gluten|celiac\w*|coeliac\w*|senza glutine|gluten.?free)\b/;
// Mette in guardia: contaminazione, stare male, nessuna attenzione, "non hanno niente senza glutine".
const ATTENZIONE = /contaminaz\w*|contamina\w*|cross.?contam\w*|\bstat[oaie] mal\w*|\bsentit[oaie] mal\w*|malessere|\bmal di pancia|got sick|\bpoca attenzione|\bnessuna attenzione|\bzero attenzione|\bnon (?:sono|erano|e|era|siete) (?:\w+ )?(?:attent\w*|preparat\w*|informat\w*|adatt\w*|sicur\w*)|\bnon (?:hanno|avevano|c'e|c'era|ci sono|c'erano|offrono|esiste|esistono) (?:\w+ ){0,4}(?:senza glutine|gluten|celiac\w*)|\bniente (?:di )?senza glutine|\bnessun\w* (?:piatt\w*|opzion\w*|alternativ\w*) (?:\w+ ){0,2}senza glutine|\bsconsigli\w*|\bnot (?:safe|suitable)|\bno gluten.?free/;
// Il nome della cosa contiene "senza" (che altrove è un dubbio): si toglie prima del controllo.
const NOME_COSA = /senza glutine|gluten.?free|per (?:i |le )?celiac\w*|ai celiac\w*|alle celiac\w*/g;
// Negazioni, dubbi, confronti, attese deluse (come in prova-requisito.ts, più stretto: "ma" e "pero" compresi).
const DUBBIO = /\b(non|niente|nessun[oa]?|senza|manca\w*|mai|purtroppo|peccato|poco|forse|granche|deludent\w*|delusion\w*|aspett\w*|rispetto|invece|tranne|nonostante|nulla|pero|ma|troppo|pecca|solo|dovev\w*|volev\w*|sper\w*|sarebbe|neanche|nemmeno|neppure|meno|unico|unica|limitat\w*|scars\w*|ridott\w*|chiedete|chiedere|chiedi|attenzione a|occhio|rischio|dubbi\w*|incert\w*|not|but|however|only)\b/;
// Per il ✓ la frase deve parlare della cosa (piatti senza glutine, attenzione ai celiaci), non della persona:
// "Mio marito è celiaco, io ho preso la carbonara buonissima" non dice niente del senza glutine.
const COSA = /senza glutine|gluten.?free|\b(?:per|ai|alle|dei|delle|degli) (?:i |le |gli )?(?:\w+ )?celiac\w*|celiachia|\bgf\b/;
// Ne parla bene: un giudizio positivo nella stessa frase.
const POSITIVO = /\b(bell\w*|perfett\w*|ottim\w*|meraviglios\w*|fantastic\w*|eccezional\w*|buon\w*|buonissim\w*|squisit\w*|gustos\w*|delizios\w*|attent\w*|attenzione|disponibil\w*|gentil\w*|preparat\w*|cura|curat\w*|tranquill\w*|serenita|sicur\w*|separat\w*|dedicat\w*|apposit\w*|ampia|ampio|tant\w*|consigliat\w*|consiglio|top|super|great|amazing|delicious|excellent|careful|safe)\b/;

function frasi(text: string): string[] {
  return text.split(/(?<=[.!?…])\s+|\n+/).map((f) => f.trim()).filter(Boolean);
}

function corta(f: string, at: number): string {
  const pulita = f.replace(/^[«"“]+|[»"”]+$/g, "");
  if (pulita.length <= MAX) return pulita;
  const da = Math.max(0, at - 50);
  const pezzo = pulita.slice(da, da + MAX).replace(da > 0 ? /^\S*\s/ : /^$/, "").replace(/\s\S*$/, "");
  return `${da > 0 ? "…" : ""}${pezzo}…`;
}

export function glutineDalleRecensioni(recensioni: { text: string; rating?: number | null }[] | null | undefined): Glutine | null {
  const lette = (recensioni ?? []).filter((r) => typeof r?.text === "string" && r.text.trim().length > 0);
  if (lette.length === 0) return null;
  let attenzione: string | null = null;
  let neParla: { f: string; voto: number } | null = null;
  const bene: string[] = [];
  for (const r of lette) {
    let beneQui: string | null = null;
    for (const f of frasi(r.text)) {
      const n = normalizza(f);
      const at = n.search(MENZIONE);
      if (at < 0) continue;
      if (ATTENZIONE.test(n)) { attenzione ??= corta(f, at); continue; }
      const voto = r.rating ?? 3;
      const resto = n.replace(NOME_COSA, " ");
      if (voto >= 4 && !beneQui && COSA.test(n) && f.length >= 25 && !n.includes("?") && !DUBBIO.test(resto) && POSITIVO.test(resto)) beneQui = corta(f, at);
      else if (!neParla || voto > neParla.voto) neParla = { f: corta(f, at), voto };
    }
    if (beneQui) bene.push(beneQui);
  }
  // Un avviso vince sempre: un locale non può essere "✓" se anche una sola recensione mette in guardia.
  if (attenzione) return { stato: "attenzione", frase: attenzione, n: bene.length, lette: lette.length };
  if (bene.length > 0) return { stato: "bene", frase: bene[0], n: bene.length, lette: lette.length };
  if (neParla) return { stato: "ne-parla", frase: neParla.f, n: 0, lette: lette.length };
  return { stato: "niente", frase: null, n: 0, lette: lette.length };
}

// Quando serve: chi ha "Senza glutine" tra i gusti o chi lo scrive nella ricerca.
export function glutineRichiesto(query: string | null | undefined, diete: string[] | null | undefined): boolean {
  return (diete ?? []).includes("celiaco") || MENZIONE.test(normalizza(query ?? ""));
}

// Le parole della riga in scheda (una sola frase, niente gergo).
export function titoloGlutine(g: Glutine): string {
  if (g.stato === "attenzione") return "Una recensione mette in guardia";
  if (g.stato === "bene") return g.n === 1 ? "Una recensione ne parla bene" : `${g.n} recensioni ne parlano bene`;
  if (g.stato === "ne-parla") return "Una recensione ne parla";
  return "Nessuna recensione ne parla";
}
