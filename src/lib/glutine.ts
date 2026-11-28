// Proposta 91 "Per chi è celiaco" (27/11): cosa dicono del senza glutine le recensioni Google che leggiamo
// (le 5 della Text Search, con il voto). Solo regole, nessuna chiamata in più, e solo frasi copiate:
// mai scritto "sicuro" o "adatto ai celiaci" da noi. Quattro casi:
// - "attenzione": una recensione che parla del glutine mette in guardia, in qualunque sua frase (contaminazione,
//   stare male, sintomi, stessa cucina, "era con glutine", "per errore"); prova vera del 27/11: «era un pane
//   normale con il glutine» stava in una recensione da 1 stella di un locale che altrimenti aveva il ✓;
// - una recensione da 1-2 stelle che ne parla senza avvisi: "ne-parla" con il voto, vince sul ✓;
// - "bene": frasi di recensioni da 4-5 stelle che ne parlano bene, senza negazioni né dubbi;
// - "ne-parla": se ne parla, ma non in modo chiaro (si mostra la frase, senza ✓);
// - "niente": nessuna delle recensioni lette ne parla ("chiedi al locale").
// Nel dubbio si scende di grado: meglio "ne parla" che un ✓ falso (VISIONE: l'app non inventa).
// Limite dichiarato: l'ironia («super, davvero il top... come no») non si riconosce a regole.
// Nessun import con alias: il giro automatico importa questo file da Node.

export type Glutine = {
  stato: "bene" | "attenzione" | "ne-parla" | "niente";
  frase: string | null; // copiata dalla recensione, al massimo 140 caratteri
  n: number; // recensioni che ne parlano bene (solo "bene")
  voto?: number | null; // "ne-parla" da una recensione da 1-2 stelle senza parole d'avviso: "Una recensione da 1 stella ne parla"
  lette: number; // recensioni lette
  frasi?: string[]; // solo "bene": tutte le frasi che ne parlano bene (copiate), nell'ordine
  // Solo "bene": le frasi da far confermare all'AI con la recensione intera (contesto). Il ✓ si vede solo se
  // l'AI le conferma (src/lib/conferma-prove.ts, due giri); il contesto resta sul server (si toglie in route).
  candidati?: { frase: string; contesto: string }[];
};

// Il requisito con cui le frasi "bene" passano dalla conferma dell'AI (stessa chiamata del "✓ terrazza").
// Nome a parte: la scheda non lo mostra mai come chip, solo nella riga "🌾 Senza glutine".
export const R_GLUTINE = "senza glutine (piatti per celiaci)";

// Quante frasi "bene" l'AI ha confermato: il ✓ vale solo per quelle (proposta 91, seconda versione del 28/11).
// Senza conferma (AI spenta, oltre il tetto, oltre 7 s) la riga resta "ne parla", in grigio, con la frase.
export function glutineConfermato(g: Glutine | null | undefined, requisiti: { r: string; prova: string }[] | null | undefined): Glutine | null {
  if (!g) return null;
  if (g.stato !== "bene") return g;
  const ok = new Set((requisiti ?? []).filter((x) => x.r === R_GLUTINE).map((x) => x.prova));
  const confermate = (g.frasi ?? [g.frase ?? ""]).filter((f) => ok.has(f));
  if (confermate.length > 0) return { ...g, frase: confermate[0], n: confermate.length };
  return { ...g, stato: "ne-parla", n: Math.max(1, g.frasi?.length ?? 1) };
}

const MAX = 140;

function normalizza(t: string): string {
  return t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[’`]/g, "'");
}

// Se ne parla: glutine, celiaco/a/i, gluten free (anche nelle recensioni in inglese).
const MENZIONE = /\b(glutine|gluten|celiac\w*|coeliac\w*|senza glutine|gluten.?free)\b/;
// Mette in guardia: contaminazione, stare male, nessuna attenzione, "non hanno niente senza glutine".
const ATTENZIONE = /contaminaz\w*|contamina\w*|cross.?contam\w*|\bstat[oaie] mal\w*|\bsentit[oaie] mal\w*|malessere|\bmal di pancia|got sick|\bpoca attenzione|\bnessuna attenzione|\bzero attenzione|\bnon (?:sono|erano|e|era|siete) (?:\w+ )?(?:attent\w*|preparat\w*|informat\w*|adatt\w*|sicur\w*)|\bnon (?:hanno|avevano|c'e|c'era|ci sono|c'erano|offrono|esiste|esistono) (?:\w+ ){0,4}(?:senza glutine|gluten|celiac\w*)|\bniente (?:di )?senza glutine|\bnessun\w* (?:piatt\w*|opzion\w*|alternativ\w*) (?:\w+ ){0,2}senza glutine|\bsconsigli\w*|\bnot (?:safe|suitable)|\bno gluten.?free|\bnon (?:hanno|c'e|ci sono|avevano) (?:\w+ ){0,2}(?:cucin\w*|forn\w*|spazi\w*|zon\w*|friggitri\w*|post\w*) separat\w*|\bstav[oaie] mal\w*|\bsto male|\bstar male|\bmalissimo|\bsintom\w*|\breazion\w*|\bglutinat\w*|glutened|\bgot (?:ill|sick)|\btracce\b|\bstess[oaie] (?:cucin\w*|friggitri\w*|olio|forn\w*|pal[ae]|pian\w*)|\bcucina in comune|\bper (?:sbaglio|errore)|\bnon sapev\w*|\bvomit\w*|pronto soccorso|\bin bagno\b|\bcrampi|dissenteria|diarrea|\bnause\w*|\bgonfi\w*|felt (?:ill|sick)|\bnon garantisc\w*|\b(?:portat\w*|servit\w*|dat[oaie]|era|erano|arrivat\w*) (?:\w+ ){0,3}(?:pane|pasta|pizza|birra|quella|quello) normale\b|\bstess[oaie] (?:acqua|bancone|tagliere|piastr\w*)|\bbriciole|\bdisastro|\b(?:stat|sentit|stav)[oaie] (?:\w+ )?mal\w*|\brischiare|\bpoco chiar\w*|\bmal di (?:testa|stomaco)|\b(?:was|were|been|felt) (?:\w+ )?(?:sick|ill)\b|\bpoco bene\b|\bconfusion\w*|\bconfus[oaie]\b/;
// In una recensione da 1-2 stelle, la frase da mostrare: prima quella che dice il fatto ("era con glutine").
const GRAVE = /\bcon (?:il )?glutine\b|errore|sbagliat\w*|imperdonabil\w*|grav[ei]\b|pericol\w*|rischi\w*|non (?:era|erano|fosse) (?:\w+ )?(?:senza glutine|gluten.?free)/;
// Un avviso negato non è un avviso: "senza preoccuparsi di contaminazioni", "nessuna contaminazione",
// "per evitare contaminazioni", "nessuno è stato male", "non sono stata male" (prova vera del 27/11).
const NEGATO = /\b(?:senza|nessun\w*|zero|evit\w*|niente|alcun\w*|privo|priva|rischio zero|non c'e|non (?:ci sono stati|c'e stat\w*|ho avuto|abbiamo avuto|(?:sono|siamo|e) (?:mai )?stat[oaie])|mai (?:stat[oaie]|avuto)|prevenire|previen\w*|no)\b(?:\s+\S+){0,6}\s+(?:contamina\w*|cross.?contam\w*|(?:e |sono |siamo )?(?:stat|sentit|stav)[oaie] mal\w*|st(?:ar|o) male|malissimo|malessere|sintom\w*|reazion\w*|problem\w*)/g;
// Il nome della cosa contiene "senza" (che altrove è un dubbio): si toglie prima del controllo.
const NOME_COSA = /senza glutine|senza lattosio|gluten.?free|lactose.?free|per (?:i |le )?celiac\w*|ai celiac\w*|alle celiac\w*/g;
// Negazioni, dubbi, confronti, attese deluse (come in prova-requisito.ts, più stretto: "ma" e "pero" compresi).
const DUBBIO = /\b(non|niente|nessun[oa]?|senza|manca\w*|mai|purtroppo|peccato|poco|forse|granche|deludent\w*|delusion\w*|aspett\w*|rispetto|invece|tranne|nonostante|nulla|pero|ma|troppo|pecca|solo|dovev\w*|volev\w*|sper\w*|sarebbe|neanche|nemmeno|neppure|meno|unico|unica|limitat\w*|scars\w*|ridott\w*|chiedete|chiedere|chiedi|attenzione a|occhio|rischio|dubbi\w*|incert\w*|anche se|not|but|however|only)\b/;
// Per il ✓ la frase deve parlare della cosa (piatti senza glutine, attenzione ai celiaci), non della persona:
// "Mio marito è celiaco, io ho preso la carbonara buonissima" non dice niente del senza glutine.
const COSA = /senza glutine|gluten.?free|\b(?:per|ai|alle|dei|delle|degli) (?:i |le |gli )?(?:\w+ )?celiac\w*|celiachia|\bgf\b/;
// Ne parla bene: un giudizio positivo nella stessa frase.
const POSITIVO = /\b(bell\w*|perfett\w*|stupend\w*|sublim\w*|eccellen\w*|fenomenal\w*|spettacolar\w*|incredibil\w*|paradiso|sogno|ottim\w*|meraviglios\w*|fantastic\w*|eccezional\w*|buon\w*|buonissim\w*|squisit\w*|gustos\w*|delizios\w*|attent\w*|attenzione|disponibil\w*|gentil\w*|preparat\w*|cura|curat\w*|tranquill\w*|serenita|sicur\w*|separat\w*|dedicat\w*|apposit\w*|ampia|ampio|tant\w*|consigliat\w*|consiglio|top|super|great|amazing|delicious|excellent|careful|safe)\b/;

function frasi(text: string): string[] {
  return text.split(/(?<=[.!?…])\s+|\n+/).map((f) => f.trim()).filter(Boolean);
}

function corta(f: string, at: number): string {
  const pulita = f.replace(/\s+/g, " ").replace(/^[«"“]+|[»"”]+$/g, "");
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
  let quante = 0; // recensioni che ne parlano (per "3 recensioni ne parlano")
  const bene: string[] = [];
  const contesti: string[] = [];
  for (const r of lette) {
    const tutte = frasi(r.text);
    const sulGlutine = tutte.map((f) => ({ f, n: normalizza(f) })).map((x) => ({ ...x, at: x.n.search(MENZIONE) })).filter((x) => x.at >= 0);
    if (sulGlutine.length === 0) continue;
    quante++;
    // Revisore 27/11: l'avviso si cerca in TUTTA la recensione che parla del glutine, non solo nella frase
    // («Pasta senza glutine ottima. Dopo sono stata malissimo.» dava ✓). La frase mostrata: quella dell'avviso,
    // preceduta da quella sul glutine se l'avviso da solo non lo nomina.
    // La negazione evita solo il ⚠️ («nessuna contaminazione»), mai con «così male» o «non fanno nulla per evitare».
    const senzaNegati = (n: string) => (/\bcosi\b|non (?:fanno|stanno|prestano|garantisc)/.test(n) ? n : n.replace(NEGATO, " "));
    const avviso = tutte.find((f) => ATTENZIONE.test(senzaNegati(normalizza(f))));
    // "con il glutine", "per errore" contano da 3 stelle in giù: nelle 4-5 stelle sono confronti («buona come quella con il glutine»).
    const grave = (r.rating ?? 3) <= 3 ? sulGlutine.find((x) => GRAVE.test(x.n)) : undefined;
    if (avviso || grave) {
      if (!attenzione) {
        // Il fatto prima del contorno: «era con glutine» prima di «per errore».
        const fatto = sulGlutine.find((x) => (r.rating ?? 3) <= 3 && /\bcon (?:il )?glutine\b|non (?:era|erano|fosse)/.test(x.n))?.f;
        const f = fatto ?? avviso ?? grave!.f;
        const n = normalizza(f);
        attenzione = MENZIONE.test(n) ? corta(f, n.search(MENZIONE)) : `${corta(sulGlutine[0].f, sulGlutine[0].at)} … ${corta(f, 0)}`;
      }
      continue;
    }
    // Recensione da 1-2 stelle che ne parla, senza parole d'avviso: si dice, in grigio, senza ⚠️ (revisore 27/11:
    // «dolci arrivati schiacciati» non è un problema di glutine).
    if (r.rating != null && r.rating <= 2) {
      const x = sulGlutine.find((y) => /\bcon (?:il )?glutine\b|non (?:era|erano|fosse)/.test(y.n)) ?? sulGlutine[0];
      if (!basso || r.rating < basso.voto) basso = { f: corta(x.f, x.at), voto: r.rating, grave: 0 };
      continue;
    }
    const voto = r.rating ?? 3;
    // Il ✓ solo se nessuna frase sul glutine della recensione ha un dubbio («…ma solo un tipo», «anche se l'olio è lo stesso»).
    // Secondo revisore 27/11: una parola d'avviso anche negata, o un "però / peccato / ma" in un'altra frase della
    // stessa recensione, toglie il ✓ (la negazione evita il ⚠️, non regala il ✓).
    const ombra = tutte.some((f) => ATTENZIONE.test(normalizza(f)) || /\b(pero|peccato|purtroppo|ma|tuttavia|but|though|unfortunately|scherz\w*|dubito|rischi\w*|come no)\b/.test(normalizza(f)));
    const dubbia = ombra || sulGlutine.some((x) => DUBBIO.test(x.n.replace(NOME_COSA, " ")) || x.n.includes("?"));
    let beneQui: string | null = null;
    for (const x of sulGlutine) {
      const resto = x.n.replace(NOME_COSA, " ");
      const cosa = COSA.test(x.n), positivo = POSITIVO.test(resto);
      if (voto >= 4 && !dubbia && !beneQui && cosa && x.f.length >= 25 && positivo) { beneQui = corta(x.f, x.at); continue; }
      // "Ne parla": la frase che parla della cosa e bene, poi il voto (non «la mia ragazza celiaca ha avuto un problema»).
      const punti = (cosa ? 20 : 0) + (positivo ? 10 : 0) + voto;
      if (!neParla || punti > neParla.punti) neParla = { f: corta(x.f, x.at), punti };
    }
    if (beneQui) { bene.push(beneQui); contesti.push(r.text.slice(0, 1000)); }
  }
  // Un avviso vince sempre: un locale non può essere "✓" se anche una sola recensione mette in guardia.
  if (attenzione) return { stato: "attenzione", frase: attenzione, n: bene.length, lette: lette.length };
  if (basso) return { stato: "ne-parla", frase: basso.f, n: bene.length, lette: lette.length, voto: basso.voto };
  if (bene.length > 0) return { stato: "bene", frase: bene[0], n: bene.length, lette: lette.length, frasi: bene, candidati: bene.map((frase, i) => ({ frase, contesto: contesti[i] })) };
  if (neParla) return { stato: "ne-parla", frase: neParla.f, n: quante, lette: lette.length };
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
  if (g.stato === "ne-parla") return g.voto != null ? `Una recensione da ${g.voto === 1 ? "1 stella" : `${g.voto} stelle`} ne parla` : g.n > 1 ? `${g.n} recensioni ne parlano` : "Una recensione ne parla";
  return "Nessuna recensione ne parla";
}
