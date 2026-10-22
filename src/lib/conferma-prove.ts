import Anthropic from "@anthropic-ai/sdk";
import type { Candidato, Requisito } from "./prova-requisito";

// "✓ terrazza": seconda chiave (23/10). Le regole di prova-requisito.ts trovano una frase che nomina il
// requisito; qui l'AI dice SOLO se quella frase afferma davvero che QUESTO locale ce l'ha. Sceglie,
// non scrive: la frase mostrata resta quella copiata dalla recensione.
// Chiamata dedicata (non un campo in più nel prompt del "perché": il collaudo del 23/10 l'ha trovata
// instabile, 5 falsi su 65 trabocchetti e diversi a ogni giro), a temperatura 0, con la recensione
// intera, risposta scomposta in domande semplici, e due giri: il ✓ resta solo se dicono sì tutti e due.

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 1, timeout: 15_000 });
export const CONFERMA_MODEL = "claude-haiku-4-5-20251001";

export const CONFERMA_SYSTEM = `Controlli prove per un'app di ristoranti. Per ogni caso ricevi: il requisito cercato (r), il nome del locale, la frase candidata e la recensione intera da cui viene. Devi dire se la frase è una PROVA che QUESTO locale ha OGGI quella caratteristica. L'app mostrerà la frase come prova: una prova falsa è un errore grave, perdere una prova vera non lo è. Nel dubbio: no.

Per ogni caso rispondi a queste domande, nell'ordine:
1. soggetto: la caratteristica appartiene a QUESTO locale (la sua sala, la sua terrazza, la sua vista, la sua atmosfera)? "altro" se è di un posto vicino, di un altro edificio, del quartiere, della strada, di un altro locale, di un parcheggio o di qualcosa visto passeggiando.
2. significato: la parola è usata nel senso che interessa a chi sceglie un locale? "altro" se ha un altro senso: periodo o stile artistico (quadri del periodo romantico), "tranquilli" riferito a parcheggio, prezzo, prenotazione o modo di fare; "vista" sulla cucina, sul bancone, sul parcheggio, sul muro, "a vista", "vista" come verbo; "terrazza" o "giardino" come nome di piatto, di sala chiusa o di un altro posto; "coppia" di supplì o di ingredienti; "intimo" riferito a capi d'abbigliamento o a tavoli troppo vicini.
3. tono: "positivo" se la frase dice chiaramente che la caratteristica c'è ed è bella o adatta; "ironico" se è sarcastica o il seguito della recensione la smentisce; "negativo" o "misto" se contiene un difetto, una delusione, una chiusura, una stagione in cui non c'è, una promessa non mantenuta, un confronto con altri posti, o se la caratteristica c'era in passato o era occupata o non disponibile per loro.
4. afferma: la frase dice com'è il locale (sì) o solo cosa volevano fare loro, o un augurio, un consiglio, una domanda (no)? "Siamo andati per una cena romantica" o "Era la mia prima volta qui per una cena romantica e mi è piaciuto" non dicono che il locale è romantico (dicono perché ci sono andati); "Locale romantico, luci soffuse" sì.
5. ok: true SOLO se soggetto "locale", significato "giusto", tono "positivo" e afferma true. Leggi tutta la recensione: se altrove smentisce la frase, ok è false.

Rispondi SOLO con un array JSON valido, senza testo, senza backtick:
[{"i":number,"soggetto":"locale"|"altro","significato":"giusto"|"altro","tono":"positivo"|"ironico"|"negativo"|"misto","afferma":boolean,"ok":boolean}]`;

type Caso = { id: string; nome: string; c: Candidato };

async function giro(casi: Caso[]): Promise<Set<number>> {
  const payload = casi.map((x, i) => ({ i, r: x.c.r, locale: x.nome, frase: x.c.prova, recensione: x.c.contesto }));
  const m = await anthropic.messages.create({
    model: CONFERMA_MODEL,
    max_tokens: 60 + casi.length * 60,
    temperature: 0,
    system: CONFERMA_SYSTEM,
    messages: [{ role: "user", content: JSON.stringify(payload) }],
  });
  const t = m.content[0]?.type === "text" ? m.content[0].text : "";
  const ok = new Set<number>();
  try {
    const arr = JSON.parse(t.slice(t.indexOf("["), t.lastIndexOf("]") + 1)) as Record<string, unknown>[];
    for (const o of arr) {
      // Si ricontrolla ogni risposta: basta un "altro" o un tono non positivo e il ✓ non c'è.
      if (typeof o.i === "number" && o.ok === true && o.soggetto === "locale" && o.significato === "giusto" && o.tono === "positivo" && o.afferma === true) ok.add(o.i);
    }
  } catch {
    console.error("[conferma-prove] risposta non leggibile:", t.slice(0, 200));
  }
  console.log(`[conferma-prove] casi=${casi.length} ok=${ok.size} in=${m.usage.input_tokens} out=${m.usage.output_tokens}`);
  return ok;
}

// Candidati per locale → requisiti confermati per locale (solo frasi copiate). Se l'AI fallisce: nessun ✓.
export async function confermaProve(candidati: Record<string, Candidato[]>, nomi: Record<string, string>): Promise<Record<string, Requisito[]>> {
  const casi: Caso[] = Object.entries(candidati).flatMap(([id, cs]) => cs.map((c) => ({ id, nome: nomi[id] ?? "", c })));
  if (casi.length === 0) return {};
  try {
    // Secondo giro con i casi in ordine inverso: la stessa risposta per caso, non per posizione.
    const inv = [...casi].reverse();
    const [a, bInv] = await Promise.all([giro(casi), giro(inv)]);
    const b = new Set([...bInv].map((j) => casi.length - 1 - j));
    const out: Record<string, Requisito[]> = {};
    casi.forEach((x, i) => {
      if (a.has(i) && b.has(i)) (out[x.id] ??= []).push({ r: x.c.r, prova: x.c.prova });
      else console.log(`[prova-requisito] scartata dall'AI id=${x.id} ${x.c.r}: ${JSON.stringify(x.c.prova.slice(0, 80))} (giri: ${a.has(i) ? "sì" : "no"}/${b.has(i) ? "sì" : "no"})`);
    });
    return out;
  } catch (err) {
    console.error("[conferma-prove] errore:", err);
    return {};
  }
}
