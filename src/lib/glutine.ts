// Proposta 91 "Per chi è celiaco" (27/11): cosa dicono del senza glutine le recensioni Google che leggiamo
// (le 5 della Text Search, con il voto). Solo regole, nessuna chiamata in più, e solo frasi copiate:
// mai scritto "sicuro" o "adatto ai celiaci" da noi. Quattro casi:
// - "attenzione": una frase mette in guardia (contaminazione, stare male, nessuna attenzione), oppure una
//   recensione da 1-2 stelle ne parla (prova vera del 27/11: «la pizza era con glutine», «era un pane normale
//   con il glutine» stavano in recensioni da 1 stella di locali che altrimenti avevano il ✓);
// - "bene": frasi di recensioni da 4-5 stelle che ne parlano bene, senza negazioni né dubbi;
// - "ne-parla": se ne parla, ma non in modo chiaro (si mostra la frase, senza ✓);
// - "niente": nessuna delle recensioni lette ne parla ("chiedi al locale").
// Nel dubbio si scende di grado: meglio "ne parla" che un ✓ falso (VISIONE: l'app non inventa).
// Nessun import con alias: il giro automatico importa questo file da Node.

export type Glutine = {
  stato: "bene" | "attenzione" | "ne-parla" | "niente";
  frase: string | null; // copiata dalla recensione, al massimo 140 caratteri
  n: number; // recensioni che ne parlano bene (solo "bene")
  voto?: number | null; // solo "attenzione" da una recensione da 1-2 stelle senza parole d'avviso: "Una recensione da 1 stella ne parla"
  lette: number; // recensioni lette
};

const MAX = 140;

function normalizza(t: string): string {
  return t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[’`]/g, "'");
}

// Se ne parla: glutine, celiaco/a/i, gluten free (anche nelle recensioni in inglese).
const MENZIONE = /\b(glutine|gluten|celiac\w*|coeliac\w*|senza glutine|gluten.?free)\b/;
// Mette in guardia: contaminazione, stare male, nessuna attenzione, "non hanno niente senza glutine".
const ATTENZIONE = /contaminaz\w*|contamina\w*|cross.?contam\w*|\bstat[oaie] mal\w*|\bsentit[oaie] mal\w*|malessere|\bmal di pancia|got sick|\bpoca attenzione|\bnessuna attenzione|\bzero attenzione|\bnon (?:sono|erano|e|era|siete) (?:\w+ )?(?:attent\w*|preparat\w*|informat\w*|adatt\w*|sicur\w*)|\bnon (?:hanno|avevano|c'e|c'era|ci sono|c'erano|offrono|esiste|esistono) (?:\w+ ){0,4}(?:senza glutine|gluten|celiac\w*)|\bniente (?:di )?senza glutine|\bnessun\w* (?:piatt\w*|opzion\w*|alternativ\w*) (?:\w+ ){0,2}senza glutine|\bsconsigli\w*|\bnot (?:safe|suitable)|\bno gluten.?free|\bnon (?:hanno|c'e|ci sono|avevano) (?:\w+ ){0,2}(?:cucin\w*|forn\w*|spazi\w*|zon\w*|friggitri\w*|post\w*) separat\w*/;
// In una recensione da 1-2 stelle, la frase da mostrare: prima quella che dice il fatto ("era con glutine").
const GRAVE = /\bcon (?:il )?glutine\b|errore|sbagliat\w*|imperdonabil\w*|grav[ei]\b|pericol\w*|rischi\w*|non (?:era|erano|fosse) (?:\w+ )?(?:senza glutine|gluten.?free)/;
// Un avviso negato non è un avviso: "senza preoccuparsi di contaminazioni", "nessuna contaminazione",
// "per evitare contaminazioni", "nessuno è stato male", "non sono stata male" (prova vera del 27/11).
const NEGATO = /\b(?:senza|nessun\w*|zero|evit\w*|niente|alcun\w*|privo|priva|rischio zero|non c'e|mai|non|prevenire|previen\w*|no)\b(?:\s+\S+){0,3}?\s+(?:contamina\w*|cross.?contam\w*|(?:e |sono |siamo )?(?:stat|sentit)[oaie] mal\w*|malessere)/g;
// Il nome della cosa contiene "senza" (che altrove è un dubbio): si toglie prima del controllo.
const NOME_COSA = /senza glutine|senza lattosio|gluten.?free|lactose.?free|per (?:i |le )?celiac\w*|ai celiac\w*|alle celiac\w*/g;
// Negazioni, dubbi, confronti, attese deluse (come in prova-requisito.ts, più stretto: "ma" e "pero" compresi).
const DUBBIO = /\b(non|niente|nessun[oa]?|senza|manca\w*|mai|purtroppo|peccato|poco|forse|granche|deludent\w*|delusion\w*|aspett\w*|rispetto|invece|tranne|nonostante|nulla|pero|ma|troppo|pecca|solo|dovev\w*|volev\w*|sper\w*|sarebbe|neanche|nemmeno|neppure|meno|unico|unica|limitat\w*|scars\w*|ridott\w*|chiedete|chiedere|chiedi|attenzione a|occhio|rischio|dubbi\w*|incert\w*|not|but|however|only)\b/;
// Per il ✓ la frase deve parlare della cosa (piatti senza glutine, attenzione ai celiaci), non della persona:
// "Mio marito è celiaco, io ho preso la carbonara buonissima" non dice niente del senza glutine.
const COSA = /senza glutine|gluten.?free|\b(?:per|ai|alle|dei|delle|degli) (?:i |le |gli )?(?:\w+ )?celiac\w*|celiachia|\bgf\b/;
// Ne parla bene: un giudizio positivo nella stessa frase.
const POSITIVO = /\b(bell\w*|perfett\w*|stupend\w*|sublim\w*|eccellen\w*|fenomenal\w*|spettacolar\w*|incredibil\w*|paradiso|sogno|ottim\w*|meraviglios\w*|fantastic\w*|eccezional\w*|buon\w*|buonissim\w*|squisit\w*|gustos\w*|delizios\w*|attent\w*|attenzione|disponibil\w*|gentil\w*|preparat\w*|cura|curat\w*|tranquill\w*|serenita|sicur\w*|separat\w*|dedicat\w*|apposit\w*|ampia|ampio|tant\w*|consigliat\w*|consiglio|top|super|great|amazing|delicious|excellent|careful|safe)\b/;

function frasi(text: string): string[] {
  return text.split(/(?<=[.!?…])\s+|\n+/).map((f) => f.trim()).filter(Boolean);
}

function corta(f: string, at: number): string {
  const pulita = f.replace(/^[«"“]+|[»"”]+$/g, "");
  if (pulita.length <= MAX) return pulita;
  // Finestra attorno alla parola; se la frase finisce poco dopo, la finestra arriva alla fine (niente "senza…").
  const da = Math.min(Math.max(0, at - 50), pulita.length - MAX);
  const fine = da + MAX >= pulita.length;
  let pezzo = pulita.slice(da, da + MAX);
  if (da > 0) pezzo = pezzo.replace(/^\S*\s/, "");
  if (!fine) pezzo = pezzo.replace(/\s\S*$/, "");
  return `${da > 0 ? "…" : ""}${pezzo}${fine ? "" : "…"}`;
}

export function glutineDalleRecensioni(recensioni: { text: string; rating?: number | null }[] | null | undefined): Glutine | null {
  const lette = (recensioni ?? []).filter((r) => typeof r?.text === "string" && r.text.trim().length > 0);
  if (lette.length === 0) return null;
  let attenzione: string | null = null;
  let basso: { f: string; voto: number; grave: number } | null = null;
  let neParla: { f: string; punti: number } | null = null;
  const bene: string[] = [];
  for (const r of lette) {
    let beneQui: string | null = null;
    const voto = r.rating ?? 3;
    for (const f of frasi(r.text)) {
      const n = normalizza(f);
      const at = n.search(MENZIONE);
      if (at < 0) continue;
      if (ATTENZIONE.test(n.replace(NEGATO, " "))) { attenzione ??= corta(f, at); continue; }
      // Recensione da 1-2 stelle che ne parla: si avvisa sempre, con la frase più grave.
      if (r.rating != null && r.rating <= 2) {
        // "era con glutine" prima di "per errore": dice il fatto.
        const grave = /\bcon (?:il )?glutine\b|non (?:era|erano|fosse)/.test(n) ? 2 : GRAVE.test(n) ? 1 : 0;
        if (!basso || grave > basso.grave) basso = { f: corta(f, at), voto: r.rating, grave };
        continue;
      }
      const resto = n.replace(NOME_COSA, " ");
      const cosa = COSA.test(n), positivo = POSITIVO.test(resto);
      if (voto >= 4 && !beneQui && cosa && f.length >= 25 && !n.includes("?") && !DUBBIO.test(resto) && positivo) { beneQui = corta(f, at); continue; }
      // "Ne parla": la frase che parla della cosa e bene, poi il voto (non «la mia ragazza celiaca ha avuto un problema»).
      const punti = (cosa ? 20 : 0) + (positivo ? 10 : 0) + voto;
      if (!neParla || punti > neParla.punti) neParla = { f: corta(f, at), punti };
    }
    if (beneQui) bene.push(beneQui);
  }
  // Un avviso vince sempre: un locale non può essere "✓" se anche una sola recensione mette in guardia.
  if (attenzione) return { stato: "attenzione", frase: attenzione, n: bene.length, lette: lette.length };
  if (basso) return { stato: "attenzione", frase: basso.f, n: bene.length, lette: lette.length, voto: basso.voto };
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
  if (g.stato === "attenzione") return g.voto != null ? `Una recensione da ${g.voto === 1 ? "1 stella" : `${g.voto} stelle`} ne parla` : "Una recensione mette in guardia";
  if (g.stato === "bene") return g.n === 1 ? "Una recensione ne parla bene" : `${g.n} recensioni ne parlano bene`;
  if (g.stato === "ne-parla") return "Una recensione ne parla";
  return "Nessuna recensione ne parla";
}
