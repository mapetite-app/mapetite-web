import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { allowAi, clientKey } from "@/lib/ai-limit";
import { verifySynthesisInput, type SynthesisInput } from "@/lib/synthesis-token";
import { categoryLabel } from "@/lib/category-label";
import { MAX_POSTI, MAX_TOKENS, buildPrompt, estimateCostUsd, parseConsiglio, correggiRefusi, senzaAttribuzioneFalsa, numeriNonNeiDati, perchePrestato, percheNonNeiDati, promptRiscrivi, RIPETE, ripeteVerdetto, vuoleConsiglio, type PostoConsiglio } from "@/lib/consiglio";

// "Ti porterei da…" (richiesta 5 di Lorenzo del 5/11). Terzo tempo della ricerca, dopo i verdetti:
// riceve gli stessi dati Google firmati del primo tempo (il client non può cambiarli) e l'ordine
// della lista che la persona vede (solo id di quei dati). Verdetti letti dalla memoria (place_synthesis,
// scritti dai verdetti appena chiesti). Una chiamata Haiku, nessuna chiamata Google.
// Risponde { consiglio: { id, perche } | null }. Senza AI o oltre il tetto: { consiglio: null }.

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 0, timeout: 8_000 });
const HAIKU_MODEL = "claude-haiku-4-5-20251001";
const MEMORIA_MS = 24 * 60 * 60 * 1000;
const memoria = new Map<string, { at: number; consiglio: ReturnType<typeof parseConsiglio> }>();

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const query = body?.query;
  const places = body?.places as SynthesisInput[] | undefined;
  const ids: string[] = Array.isArray(body?.ids) ? body.ids.filter((x: unknown): x is string => typeof x === "string").slice(0, MAX_POSTI) : [];
  if (typeof query !== "string" || query.trim() === "" || query.length > 500 || !Array.isArray(places) || places.length > 20 || ids.length === 0) {
    return NextResponse.json({ error: "Richiesta non valida." }, { status: 400 });
  }
  let valid = false;
  try {
    valid = verifySynthesisInput(query.trim(), places, body?.token);
  } catch (err) {
    console.error("[search-consiglio] firma non verificabile:", err);
  }
  if (!valid) return NextResponse.json({ error: "Richiesta non valida." }, { status: 400 });
  if (!vuoleConsiglio(query) || !process.env.ANTHROPIC_API_KEY) return NextResponse.json({ consiglio: null });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!allowAi("consiglio", clientKey(request, user?.id))) return NextResponse.json({ consiglio: null });

  // Solo i posti ancora in lista, nell'ordine in cui la persona li vede.
  const byId = new Map(places.map((p) => [p.id, p]));
  const scelti = [...new Set(ids)].map((id) => byId.get(id)).filter((p): p is SynthesisInput => !!p);
  if (scelti.length < 2) return NextResponse.json({ consiglio: null });

  const verdetti = new Map<string, string>();
  const { data, error } = await supabase.from("place_synthesis").select("place_id, verdict").in("place_id", scelti.map((p) => p.id));
  if (error) console.error("[search-consiglio] lettura place_synthesis fallita:", error.message);
  for (const r of data ?? []) if (typeof r.verdict === "string" && r.verdict.trim()) verdetti.set(r.place_id as string, r.verdict);

  // Giudizio del secondo tempo (stessa frase), rimandato dal telefono: solo "alto"/"medio"/"basso", nessun
  // testo libero (revisore 5/11: un testo non firmato nel prompt farebbe dire al server cose non vere).
  const livelli = body?.livelli && typeof body.livelli === "object" ? body.livelli as Record<string, unknown> : {};
  const livello = (v: unknown) => (v === "alto" || v === "medio" || v === "basso" ? v : null);
  const posti: PostoConsiglio[] = scelti.map((p) => ({
    id: p.id,
    name: p.name,
    category: categoryLabel(p.category) ?? p.category,
    priceLevel: p.priceLevel,
    rating: p.rating,
    editorialSummary: p.editorialSummary,
    reviewTexts: p.reviewTexts,
    verdict: verdetti.get(p.id) ?? null,
    livello: livello(livelli[p.id]),
  }));

  // Stessa frase → stesso consiglio, se quel posto è ancora in lista (revisori 5/11: in una demo rifare la ricerca
  // non deve cambiarlo; la lista può avere 11 o 12 posti a seconda dei verdetti, quindi la chiave è solo la frase).
  const chiave = query.trim().toLowerCase().replace(/\s+/g, " ");
  const giaDato = memoria.get(chiave);
  if (giaDato && Date.now() - giaDato.at < MEMORIA_MS && (giaDato.consiglio === null || posti.some((p) => p.id === giaDato.consiglio!.id))) {
    return NextResponse.json({ consiglio: giaDato.consiglio });
  }

  const t0 = Date.now();
  try {
    const prompt = buildPrompt(query.trim(), posti);
    const chiedi = (content: string) =>
      anthropic.messages.create({ model: HAIKU_MODEL, max_tokens: MAX_TOKENS, temperature: 0, messages: [{ role: "user", content }] });
    const testo = (m: Awaited<ReturnType<typeof chiedi>>) => m.content.map((c) => (c.type === "text" ? c.text : "")).join("");
    const datiDi = (p: PostoConsiglio) => [p.verdict, p.editorialSummary, ...(p.reviewTexts ?? [])].filter(Boolean).join(" ");
    // Parole del perché che i dati del posto non dicono: quelle prese dalla richiesta (5/11) e ogni altra (6/11).
    const fuori = (c: ReturnType<typeof parseConsiglio>) => {
      const p = c ? posti.find((x) => x.id === c.id) : null;
      if (!c || !p) return [];
      c.perche = senzaAttribuzioneFalsa(correggiRefusi(c.perche, datiDi(p)), [p.editorialSummary, ...(p.reviewTexts ?? [])].filter(Boolean).join(" "));
      return [...new Set([...perchePrestato(c.perche, query, datiDi(p)), ...percheNonNeiDati(c.perche, datiDi(p)), ...numeriNonNeiDati(c.perche, datiDi(p)), ...(ripeteVerdetto(c.perche, p.verdict) ? [RIPETE] : [])])];
    };
    const message = await chiedi(prompt);
    let { input_tokens, output_tokens } = message.usage;
    const text = testo(message);
    let consiglio = parseConsiglio(text, posti);
    let prestate = fuori(consiglio);
    if (consiglio && prestate.length > 0) {
      // Una sola seconda richiesta (~0,45 centesimi), solo quando il perché ha parole non sostenute dai dati.
      console.log(`[search-consiglio] riscrivo: parole che i dati non dicono: ${JSON.stringify(prestate)} (perche=${JSON.stringify(consiglio.perche)})`);
      const primo = consiglio.id;
      const m2 = await chiedi(promptRiscrivi(prompt, text, prestate));
      input_tokens += m2.usage.input_tokens;
      output_tokens += m2.usage.output_tokens;
      const c2 = parseConsiglio(testo(m2), posti);
      consiglio = c2 && c2.id === primo ? c2 : null;
      prestate = fuori(consiglio);
    }
    const scelto = consiglio ? posti.find((p) => p.id === consiglio!.id) : null;
    // 6/11 sera: se dopo la riscrittura l'unico difetto è ripetere il verdetto (ogni parola sta nei dati), il
    // consiglio resta: la scelta del posto vale da sola, e un riquadro che compare una volta sì e una no non si
    // capisce (VISIONE). Le parole inventate scartano sempre.
    // Revisore 6/11 sera: il perché ripetuto si leggeva due volte (riquadro e card): resta solo la scelta, senza perché.
    if (prestate.length === 1 && prestate[0] === RIPETE && consiglio) {
      console.log(`[search-consiglio] tenuto senza perché (ripeteva il verdetto): ${JSON.stringify(consiglio.perche)}`);
      consiglio = { ...consiglio, perche: "" };
      prestate = [];
    }
    if (prestate.length > 0) {
      console.log(`[search-consiglio] scartato: parole che i dati di ${JSON.stringify(scelto?.name)} non dicono: ${JSON.stringify(prestate)} (perche=${JSON.stringify(consiglio?.perche)})`);
      consiglio = null;
    }
    const nome = consiglio ? scelto?.name : null;
    console.log(`[search-consiglio] q=${JSON.stringify(query.trim().slice(0, 80))} posti=${posti.length} scelto=${JSON.stringify(nome ?? null)} perche=${JSON.stringify(consiglio?.perche ?? null)} ms=${Date.now() - t0} in=${input_tokens} out=${output_tokens} cost=$${estimateCostUsd(input_tokens, output_tokens).toFixed(6)}`);
    memoria.set(chiave, { at: Date.now(), consiglio });
    if (memoria.size > 300) memoria.delete(memoria.keys().next().value!);
    return NextResponse.json({ consiglio });
  } catch (err) {
    console.error("[search-consiglio] chiamata Haiku fallita:", err);
    return NextResponse.json({ consiglio: null });
  }
}
