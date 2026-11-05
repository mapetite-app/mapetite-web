// "Ti porterei da…" (richiesta 5 di Lorenzo del 5/11: "ricerca che capisce i gusti come una chat").
// Con una frase da chat ("devo festeggiare i 70 anni di mio papà, ama il pesce, saremo in 10…")
// l'AI non si ferma alla lista: sceglie UN posto tra i risultati e dice perché, come farebbe un amico.
// Funzioni pure (le usa anche il giro automatico).
//
// Regole (VISIONE.md, LORENZO.md):
//  - si sceglie SOLO tra i risultati già mostrati (dati Google firmati dal server + verdetto in memoria);
//  - il "perché" viene da recensioni, verdetto o descrizione Google: mai caratteristiche inventate;
//  - un vincolo esplicito (budget, numero di persone, tipo, atmosfera) che un posto chiaramente non
//    rispetta lo esclude; nel dubbio nessun consiglio (meglio nessuno che uno sbagliato);
//  - non premia il più famoso: il numero di recensioni non è un motivo (VISIONE: non mainstream).

export const MAX_POSTI = 12;
export const MAX_TOKENS = 220;
const REVIEWS = 3;
const REVIEW_CHARS = 220;

export type PostoConsiglio = {
  id: string;
  name: string;
  category: string | null;
  priceLevel: number | null;
  rating: number | null;
  editorialSummary: string | null;
  reviewTexts: string[] | null;
  verdict: string | null;
  // Dal secondo tempo della ricerca (stessa frase): quanto è adatto ("alto"/"medio"/"basso") e perché.
  livello?: "alto" | "medio" | "basso" | null;
};

export type Consiglio = { id: string; perche: string };

const clip = (s: string | null | undefined, n: number) => (s ?? "").replace(/\s+/g, " ").trim().slice(0, n);

// Parole di una richiesta "da chat": un'occasione, una persona, un vincolo pratico.
const OCCASIONE = /\b(compleann\w*|anniversari\w*|festeggi\w*|laure\w*|promozion\w*|addio al|pap[aà]|mamma|madre|padre|genitori|nonn[ioae]|suoceri|fidanzat[oa]|ragazz[oa]|moglie|marito|amic[oiha]\w*|colleghi|cliente|clienti|bambin\w*|figli\w*|primo appuntamento|appuntamento|saremo|siamo in|in \d+|persone|a testa|budget|euro|€|tranquill\w*|dove si parla|sorpres\w*|speciale|ricorrenza)\b/i;

/**
 * La frase merita un consiglio? Sì se è lunga come un messaggio (almeno 8 parole), se è una domanda,
 * o se nomina un'occasione o una persona e ha almeno 5 parole. "trattoria a Trastevere" no.
 */
export function vuoleConsiglio(q: string): boolean {
  const t = q.trim();
  const parole = t.split(/\s+/).filter(Boolean).length;
  if (parole < 4) return false;
  if (parole >= 8) return true;
  if (t.includes("?")) return true;
  return parole >= 5 && OCCASIONE.test(t);
}

const EURO = ["", "€", "€€", "€€€", "€€€€"];

export function buildPrompt(richiesta: string, posti: PostoConsiglio[]): string {
  const blocchi = posti.slice(0, MAX_POSTI).map((p, i) => {
    const righe = [
      `${i + 1}. ${clip(p.name, 60)} — ${clip(p.category, 30) || "locale"}${p.priceLevel ? ` · prezzo ${EURO[p.priceLevel] ?? ""}` : ""}${p.rating ? ` · voto ${p.rating}` : ""}`,
    ];
    if (p.livello) righe.push(`   Adatto alla richiesta: ${p.livello}`);
    if (p.verdict) righe.push(`   Verdetto: ${clip(p.verdict, 220)}`);
    if (p.editorialSummary) righe.push(`   Google: ${clip(p.editorialSummary, 160)}`);
    for (const r of (p.reviewTexts ?? []).slice(0, REVIEWS)) righe.push(`   Recensione: ${clip(r, REVIEW_CHARS)}`);
    return righe.join("\n");
  });
  return [
    "Sei l'amico esperto di Mapetite, un'app per scegliere dove mangiare e bere in Italia.",
    `La persona ti ha scritto: «${clip(richiesta, 500)}»`,
    "Qui sotto ci sono i posti che la ricerca ha trovato, con i dati veri (verdetto di Mapetite, descrizione di Google, recensioni).",
    "Scegli UN SOLO posto, quello in cui la porteresti tu per questa richiesta, e dille perché.",
    "",
    "Regole:",
    "- Rispetta tutti i vincoli scritti nella richiesta: occasione, persone (età, quanti), cucina, atmosfera, budget, zona. Un posto che chiaramente ne viola uno non si sceglie.",
    "- Prezzo: € fino a ~15 euro a testa, €€ ~15–35, €€€ ~35–60, €€€€ oltre. Con un budget scritto, non scegliere un posto chiaramente sopra.",
    "- Conta prima l'occasione (con chi si va e perché: festa, coppia, lavoro, famiglia) e l'atmosfera che richiede, poi il cibo. Per una cena di lavoro o una festa scegli un posto curato e adatto a parlare, non il più economico o il più alla buona. Preferisci i posti con \"Adatto alla richiesta: alto\".",
    "- Il numero di recensioni o la fama NON sono un motivo: conta quanto il posto è adatto a questa persona.",
    "- \"perche\": UNA frase in italiano, massimo 14 parole e 95 caratteri, che dà del tu e dice perché è il più adatto a QUESTA richiesta, con fatti presi SOLO da verdetto, descrizione o recensioni qui sotto (es. \"sala tranquilla e compleanni festeggiati con cura, dicono le recensioni\"). Non riscrivere il verdetto. Non inventare piatti, sale, orari o servizi che non sono scritti. Non attribuire alla persona un'occasione che non ha scritto (se dice \"con la mia fidanzata\", non parlare di anniversario) e non esagerare gli aggettivi delle recensioni.",
    "- Se le recensioni dello stesso posto si contraddicono su un punto (una dice silenzioso, un'altra rumoroso), quel punto non è un motivo: usane un altro o scegli un altro posto.",
    "- Nel \"perche\" non nominare prezzo, budget, numero di persone, età o gruppi, a meno che una recensione o il verdetto ne parlino con quelle parole. Non ripetere il nome del posto.",
    "- Se nessun posto ha nei dati qualcosa che lo lega davvero alla richiesta, rispondi {\"n\":null}. Meglio nessun consiglio che uno sbagliato.",
    "",
    "Posti:",
    blocchi.join("\n"),
    "",
    'Rispondi SOLO con JSON, senza testo prima o dopo: {"n":3,"perche":"..."}',
  ].join("\n");
}

/** Legge la risposta: numero valido della lista e "perché" non vuoto; altrimenti nessun consiglio. */
export function parseConsiglio(text: string, posti: PostoConsiglio[]): Consiglio | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
  const o = raw as { n?: unknown; perche?: unknown };
  const n = Number(o?.n);
  const max = Math.min(posti.length, MAX_POSTI);
  if (o?.n == null || !Number.isInteger(n) || n < 1 || n > max) return null;
  const perche = accorcia(clip(typeof o.perche === "string" ? o.perche : "", 300).replace(/^["«]|["»]$/g, "").replace(/[.]+$/, ""));
  if (perche.split(/\s+/).length < 3) return null;
  // Il perché non ripete il nome del posto (si legge già nel titolo "Ti porterei da …").
  return { id: posti[n - 1].id, perche: perche.charAt(0).toUpperCase() + perche.slice(1) };
}

// Il perché sta in 2 righe sotto il titolo (revisore 5/11: la parte che spiegava finiva nei puntini). Oltre
// MAX_PERCHE caratteri si taglia all'ultima virgola o "e" prima del limite, così resta una frase intera.
export const MAX_PERCHE = 105;

// Anti-invenzione (secondo revisore del 5/11: «sala tranquilla dove si parla» era la richiesta rimandata
// indietro come un fatto). Una parola del perché che viene dalla richiesta deve stare anche nei dati del
// posto (verdetto, descrizione, recensioni), confrontando le prime 5 lettere senza accenti; altrimenti il
// consiglio si scarta e resta la frase di sempre.
const norm = (t: string) => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const radici = (t: string) => new Set((norm(t).match(/[a-z]{5,}/g) ?? []).map((w) => w.slice(0, 5)));
export function perchePrestato(perche: string, richiesta: string, datiPosto: string): string[] {
  const dallaRichiesta = radici(richiesta);
  const neiDati = radici(datiPosto);
  return [...new Set((norm(perche).match(/[a-z]{5,}/g) ?? []))].filter((w) => dallaRichiesta.has(w.slice(0, 5)) && !neiDati.has(w.slice(0, 5)));
}
export function accorcia(t: string): string {
  if (t.length <= MAX_PERCHE) return t;
  const testa = t.slice(0, MAX_PERCHE);
  const taglio = Math.max(testa.lastIndexOf(", "), testa.lastIndexOf(" e "), testa.lastIndexOf("; "));
  return taglio >= 40 ? t.slice(0, taglio) : testa.slice(0, testa.lastIndexOf(" ")) + "…";
}

export function estimateCostUsd(inputTokens: number, outputTokens: number): number {
  return (inputTokens * 1.0 + outputTokens * 5.0) / 1_000_000;
}
