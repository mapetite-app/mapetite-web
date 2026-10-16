import Anthropic from "@anthropic-ai/sdk";
import { hasEnglish } from "@/lib/italian-check";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEnrichmentForPlaces } from "@/lib/enrichment";
import type { PlaceResult } from "@/lib/google-places";

// Verdetti: chi guarda aspetta. Al massimo un nuovo tentativo (l'SDK ne fa 2) e 25 s di attesa
// (l'SDK ne concede 10 minuti): una risposta a freddo per 12 locali richiede ~15 s.
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  maxRetries: 1,
  timeout: 25_000,
});

const HAIKU_MODEL = "claude-haiku-4-5-20251001";

// Public pricing for claude-haiku-4-5 (https://platform.claude.com/docs/en/pricing)
const HAIKU_INPUT_PER_MTOK = 1.0;
const HAIKU_OUTPUT_PER_MTOK = 5.0;

// Solo i primi N locali ricevono sintesi/verdetto/matchReason; gli altri restano
// senza. Il valore è un trade-off costo/latenza: ogni locale in più è token Haiku
// (due chiamate: synthesis + matchReason) e tempo di risposta aggiunto. La cache
// place_synthesis ne assorbe gran parte — i locali già visti non ripagano la
// chiamata synthesis — quindi il costo marginale reale grava sui soli locali nuovi.
export const SYNTHESIS_LIMIT = 12;
const SYNTHESIS_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;

// Locali per chiamata Haiku: le chiamate dei gruppi partono insieme (latenza ~1/3 con 12 locali).
// 5 ≥ i gruppi che il telefono chiede (2, 3, 3, 4: vedi VERDICT_GROUPS): una chiamata ciascuno.
const HAIKU_BATCH = 5;
function inBatches<T>(items: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += HAIKU_BATCH) out.push(items.slice(i, i + HAIKU_BATCH));
  return out;
}

// Vocabolario chiuso dei tag: ogni tag fuori da questa lista viene scartato lato server.
export const ALLOWED_TAGS = ["romantico","informale","gruppi","business","veloce","aperitivo","famiglia","intimo","vivace","tradizionale","raffinato","economico"] as const;

// Riduzione del payload verso Haiku (solo per la chiamata synthesis, non tocca google-places.ts).
export const REVIEWS_PER_PLACE_FOR_SYNTHESIS = 3;
export const REVIEW_CHAR_LIMIT = 300;

export type PlaceSynthesis = {
  synthesis: string;      // 1-2 frasi, italiano
  tags: string[];         // max 3, lowercase, occasioni (es. "romantico", "gruppi", "informale")
  verdict: string;        // max 12 parole, il "verdetto Mapetite"
  goFor: string[];        // chip "Ci dovresti andare se…" — max 3 motivi concreti
  dontExpect: string[];   // chip "Meno adatto se…" — max 2 limiti reali, [] se nessuno
  matchReason: string;    // perché QUESTO locale risponde a QUELLA query. NON cacheabile.
  // Adeguatezza ai requisiti espliciti della richiesta (tipo, caratteristica
  // fisica, occasione, atmosfera). false SOLO se chiaramente non li rispetta;
  // nel dubbio true. Il chiamante sposta/esclude i false e ne logga il motivo.
  fit: boolean;
  fitReason: string;
  // Quanto è adatto alla richiesta (giudizio di Haiku sulle recensioni). Serve all'ordine:
  // "basso" in fondo, "alto" in cima. Nel dubbio "medio".
  match: MatchLevel;
};
export type MatchLevel = "alto" | "medio" | "basso";

// Riga cache: matchReason NON è persistito (dipende dalla query).
type CachedSynthesis = {
  synthesis: string;
  tags: string[];
  verdict: string;
  goFor: string[];
  dontExpect: string[];
};

const SYNTHESIS_SYSTEM = `REGOLA ASSOLUTA: scrivi ESCLUSIVAMENTE in italiano corretto. Le recensioni in input sono in inglese: NON copiare parole inglesi, NON usare calchi, NON inventare parole. Ogni singola parola di synthesis, tags, verdict, go_for e dont_expect deve essere una parola italiana esistente. Se un concetto è espresso in inglese nelle recensioni, traducilo. Esempi di errori da non fare: "vibe" → atmosfera, "food" → cibo, "view" o "breathtaking" → vista mozzafiato, "handmade" → fatto a mano, "chill" → rilassato, "food pairing" → abbinamenti. Ammessi solo i prestiti entrati nell'italiano: cocktail, drink, staff, brunch, rooftop, lounge, location.

Sei il curatore editoriale di Mapetite, piattaforma di scoperta food & beverage.
Ricevi una lista di locali con dati e recensioni reali da Google. Ogni locale può includere un campo "enrichment": segnali da altre fonti (Google aggregato, guide editoriali come Michelin, Gambero Rosso, Puntarella Rossa). Usa enrichment come CONFERMA o contesto, MAI come sostituto delle recensioni, e non citarne la fonte se non aggiunge valore reale.
Per ogni locale produci una sintesi editoriale in ITALIANO, basata ESCLUSIVAMENTE sui dati forniti. Non inventare nulla.
Rispondi SOLO con un array JSON valido, senza testo aggiuntivo, senza backtick, senza markdown.
Struttura esatta:
[{"id":string,"synthesis":string,"tags":string[],"verdict":string,"go_for":string[],"dont_expect":string[]}]
- id: DEVE essere identico all'id ricevuto in input
- synthesis: 1-2 frasi che dicono cosa rende questo locale quello che è. Concreta, non generica. Vietate frasi come 'locale apprezzato' o 'ottime recensioni'.
- tags: massimo 3, scelti ESCLUSIVAMENTE da questa lista chiusa. Non inventarne altri:
romantico, informale, gruppi, business, veloce, aperitivo, famiglia, intimo, vivace, tradizionale, raffinato, economico
- verdict: massimo 12 parole, tono diretto. VINCOLO CRITICO: il verdetto deve essere verificabile parola per parola contro le recensioni fornite. Non affermare MAI il contrario di ciò che dicono le recensioni. Se non sei certo del senso di un'informazione, ometti quel dettaglio invece di rischiare di invertirlo. Meglio un verdetto più povero che un verdetto sbagliato.
- go_for: array di CHIP brevissime (1-4 parole ciascuna), MASSIMO 3. Ogni chip è un motivo CONCRETO e RICORRENTE per andarci, ricavato dai punti di forza citati più volte nelle recensioni. Esempio: ["carbonara","forno a legna","servizio veloce"]. Niente chip generiche ('buon cibo', 'bella atmosfera'): dì cosa specifico. Se non ci sono motivi forti e ricorrenti, array più corto o vuoto [].
- dont_expect: DEFAULT array vuoto []. Array di CHIP brevissime (1-4 parole), MASSIMO 2. Lo popoli SOLO se nelle recensioni esiste un limite REALE e RICORRENTE — lo stesso limite citato da PIÙ recensioni distinte. Un singolo commento negativo isolato NON basta. VIETATO inventare difetti, VIETATO dedurre limiti non scritti, VIETATO trasformare un punto di forza nel suo rovescio. Nel dubbio: []. Meglio [] che un difetto inventato. Tono onesto, non stroncatorio.`;

const MATCH_REASON_SYSTEM = `REGOLA ASSOLUTA: scrivi ESCLUSIVAMENTE in italiano corretto. Non usare parole inglesi, calchi o parole inventate. Ogni parola di matchReason deve essere una parola italiana esistente.

L'utente cerca un locale. Per ogni locale in lista spiega in una frase breve in ITALIANO perché risponde (o non risponde bene) alla sua richiesta specifica.

Ti possono essere forniti i GUSTI dell'utente in due forme:
- dichiarati: cucine, occasioni, atmosfere e fascia di prezzo che ha scelto nelle preferenze.
- storico_stelle_per_tipologia: la media di stelle che l'utente ha dato per tipologia di locale (comportamento reale, più affidabile delle dichiarazioni).
Quando questi gusti sono presenti, usali per spiegare perché QUESTO locale è adatto (o no) a QUESTA persona, oltre che alla richiesta. Dai peso allo storico comportamentale quando c'è.
Se i gusti sono ASSENTI (nessuna preferenza dichiarata e nessuno storico), giudica SOLO su richiesta + dati del locale. Non inventare MAI preferenze non fornite.

Rispondi SOLO con un array JSON valido, senza backtick, senza markdown.
Struttura esatta: [{"id":string,"matchReason":string,"fit":boolean,"fit_reason":string,"match":"alto"|"medio"|"basso"}]
- id identico a quello ricevuto
- matchReason: una frase, massima concretezza, riferita alla richiesta dell'utente e, se disponibili, ai suoi gusti. Se il locale non centra bene, dillo. Deve basarsi ESCLUSIVAMENTE su recensioni, descrizione e categorie fornite: non affermare caratteristiche (terrazza, vista, prezzi, musica…) che non vi compaiono; se il dato manca, dillo invece di supporlo.
- fit: false SOLO se il locale NON rispetta chiaramente un requisito ESPLICITO della richiesta (tipo di locale, caratteristica fisica come rooftop/terrazza/vista, occasione, atmosfera), e lo puoi dimostrare dalle recensioni, dalla descrizione o dalle categorie fornite. Se mancano dati, se è ambiguo o hai dubbi: true. Non escludere mai per gusti personali o per un requisito non scritto nella richiesta.
- fit_reason: se fit è false, motivo in poche parole basato sui dati forniti; altrimenti stringa vuota.
- match: quanto il locale è adatto a QUESTA richiesta secondo le recensioni e i dati forniti. "alto" se rispetta tutti i requisiti espliciti e le recensioni lo confermano senza problemi rilevanti per l'occasione; "basso" se le recensioni segnalano problemi seri proprio per questa richiesta (es. servizio pessimo o attese lunghe per un anniversario, vista assente per un rooftop) o se rispetta i requisiti solo in parte; "medio" negli altri casi e nel dubbio. Coerente con matchReason: se scrivi che è "meno adatto" o "un rischio", match è "basso". Non giudicare la fama o il numero di recensioni.
- Richieste "non turistico", "autentico", "dove vanno i locali", "nascosto", "poco conosciuto": è un requisito ESPLICITO di atmosfera. Se le recensioni descrivono il locale come turistico (turisti, menù turistico, "trappola per turisti", clientela quasi solo straniera, buttadentro), match è "basso" e matchReason lo dice; se più recensioni lo dicono chiaramente, fit è false. Se le recensioni parlano di clientela del quartiere, romani/milanesi, posto di famiglia, match può essere "alto".`;

function costOf(inputTokens: number, outputTokens: number): number {
  return (
    (inputTokens / 1_000_000) * HAIKU_INPUT_PER_MTOK +
    (outputTokens / 1_000_000) * HAIKU_OUTPUT_PER_MTOK
  );
}

// Recupero best-effort da JSON troncato: estrae gli oggetti {...} top-level
// COMPLETI presenti nel testo, ignorando l'ultimo oggetto tagliato a metà.
// Traccia stringhe/escape per non contare graffe dentro i valori string.
function recoverJsonObjects(text: string): unknown[] {
  const out: unknown[] = [];
  let depth = 0;
  let objStart = -1;
  let inString = false;
  let escaped = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
    } else if (ch === "{") {
      if (depth === 0) objStart = i;
      depth++;
    } else if (ch === "}") {
      if (depth > 0) {
        depth--;
        if (depth === 0 && objStart !== -1) {
          try {
            out.push(JSON.parse(text.slice(objStart, i + 1)));
          } catch {
            // oggetto comunque malformato: lo salto
          }
          objStart = -1;
        }
      }
    }
  }
  return out;
}

// Strippa backtick / ```json e isola l'array JSON. Ritorna [] se il parse fallisce.
function parseJsonArray(raw: string): unknown[] {
  let text = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start !== -1 && end !== -1 && end > start) {
    text = text.slice(start, end + 1);
  }
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    // Risposta probabilmente troncata (es. stop=max_tokens): il parse dell'intero
    // array fallisce. Recupero gli oggetti completi prima del taglio: meglio N-1
    // risultati che zero. Il caso di parse riuscito qui sopra resta invariato.
    const recovered = recoverJsonObjects(text);
    if (recovered.length > 0) {
      console.warn(
        `[haiku-synthesis] JSON troncato: recuperati ${recovered.length} oggetti su parse fallito`,
        err,
      );
      return recovered;
    }
    console.error("[haiku-synthesis] JSON parse error:", err);
    return [];
  }
}

// Normalizza le chip go_for/dont_expect dall'output LLM: tiene solo stringhe non
// vuote, trimma, deduplica case-insensitive (senza forzare il lowercase in
// output — le chip non sono vocabolario chiuso), tronca al cap. Non-array → [].
function normalizeChips(value: unknown, cap: number): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim();
    if (trimmed === "") continue;
    // Chip con parole inglesi copiate dalle recensioni ("vibe informale"): meglio un chip in meno.
    if (hasEnglish(trimmed)) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
    if (out.length >= cap) break;
  }
  return out;
}

// Gusti dell'utente per personalizzare matchReason: preferenze DICHIARATE
// (profiles) + storico COMPORTAMENTALE (media stelle per tipologia da reviews).
// Degrada in sicurezza: qualsiasi errore → taste vuoto (nessuna personalizzazione).
type UserTaste = {
  declared: {
    cuisines: string[];
    occasions: string[];
    atmospheres: string[];
    priceRange: string | null;
  } | null;
  byCategory: { category: string; avgStars: number; count: number }[];
};

async function getUserTaste(userId: string): Promise<UserTaste> {
  const empty: UserTaste = { declared: null, byCategory: [] };
  try {
    const supabase = createAdminClient();
    const [{ data: profile }, { data: reviews }] = await Promise.all([
      supabase
        .from("profiles")
        .select("cuisines, occasions, atmospheres, price_range")
        .eq("id", userId)
        .maybeSingle(),
      // reviews.place_id = UUID interno places → join per leggere la category.
      supabase
        .from("reviews")
        .select("rating, places(category)")
        .eq("user_id", userId),
    ]);

    const declared = profile
      ? {
          cuisines: (profile.cuisines as string[] | null) ?? [],
          occasions: (profile.occasions as string[] | null) ?? [],
          atmospheres: (profile.atmospheres as string[] | null) ?? [],
          priceRange: (profile.price_range as string | null) ?? null,
        }
      : null;

    // Aggregato stelle per tipologia (gusto comportamentale).
    const agg = new Map<string, { sum: number; count: number }>();
    for (const r of (reviews ?? []) as Array<Record<string, unknown>>) {
      const placeField = r.places;
      const cat = Array.isArray(placeField)
        ? (placeField[0] as { category?: string } | undefined)?.category
        : (placeField as { category?: string } | null)?.category;
      const rating = typeof r.rating === "number" ? r.rating : null;
      if (!cat || rating == null) continue;
      const cur = agg.get(cat) ?? { sum: 0, count: 0 };
      cur.sum += rating;
      cur.count += 1;
      agg.set(cat, cur);
    }
    const byCategory = Array.from(agg.entries())
      .map(([category, { sum, count }]) => ({
        category,
        avgStars: Math.round((sum / count) * 10) / 10,
        count,
      }))
      .sort((a, b) => b.count - a.count);

    return { declared, byCategory };
  } catch (err) {
    console.error("[haiku-synthesis] getUserTaste exception:", err);
    return empty;
  }
}

export async function getSynthesis(
  places: PlaceResult[],
  query: string,
  userId: string | null = null,
): Promise<Record<string, PlaceSynthesis>> {
  // 1. Limita ai primi SYNTHESIS_LIMIT locali.
  const targets = places.slice(0, SYNTHESIS_LIMIT);
  if (targets.length === 0) return {};

  const ids = targets.map((p) => p.id);
  const validIds = new Set(ids);

  let totalCost = 0;

  // Le due chiamate Haiku sono INDIPENDENTI. matchReason non dipende più dalla
  // sintesi: opera su `targets` con nome + categoria + recensioni grezze +
  // richiesta + gusti. La lancio SUBITO così la sua fetch gira in parallelo con
  // la chiamata synthesis qui sotto (le due richieste si sovrappongono).
  const matchReasonWork = async (): Promise<{
    matchReasons: Map<string, string>;
    fits: Map<string, { fit: boolean; fitReason: string }>;
    levels: Map<string, MatchLevel>;
    cost: number;
  }> => {
    const matchReasons = new Map<string, string>();
    const fits = new Map<string, { fit: boolean; fitReason: string }>();
    const levels = new Map<string, MatchLevel>();
    let cost = 0;
    try {
      // Gusti dell'utente: iniettati solo se disponibili. Profilo vuoto e zero
      // reviews → taste vuoto → il prompt degrada su richiesta + dati del locale.
      const taste = userId ? await getUserTaste(userId) : null;
      const hasTaste =
        taste != null &&
        ((taste.declared != null &&
          (taste.declared.cuisines.length > 0 ||
            taste.declared.occasions.length > 0 ||
            taste.declared.atmospheres.length > 0 ||
            taste.declared.priceRange != null)) ||
          taste.byCategory.length > 0);
      const tasteBlock = hasTaste
        ? `\n\nGusti dell'utente:\n${JSON.stringify({
            dichiarati: taste!.declared,
            storico_stelle_per_tipologia: taste!.byCategory,
          })}`
        : "";

      // A gruppi di HAIKU_BATCH in parallelo: una sola chiamata scriveva i 12 "perché" in fila
      // (~1.100 token d'uscita, 12-14 s misurati il 14/10). Tre chiamate da 4 finiscono in ~1/3 del
      // tempo; costa solo il prompt di sistema ripetuto (~0,1 centesimi a ricerca).
      await Promise.all(inBatches(targets).map(async (batch) => {
        try {
          const userPayload = batch.map((p) => ({
            id: p.id,
            name: p.name,
            category: p.category,
            types: (p.types ?? []).slice(0, 6),
            editorialSummary: p.editorialSummary,
            reviewTexts: (p.reviewTexts ?? [])
              .slice(0, REVIEWS_PER_PLACE_FOR_SYNTHESIS)
              .map((r) => r.slice(0, REVIEW_CHAR_LIMIT)),
          }));

          const message = await anthropic.messages.create({
            model: HAIKU_MODEL,
            // Il payload matchReason porta ora le recensioni grezze (id+name+category+
            // reviewTexts × ~12 locali): l'input è salito a ~3700 token e l'output pieno
            // (12 frasi + overhead JSON) sfora 1024, causando troncamento a metà stringa
            // e parse error. 3000 dà margine per tutti i 12 senza taglio.
            max_tokens: 3000,
            system: MATCH_REASON_SYSTEM,
            messages: [
              {
                role: "user",
                content: `Richiesta dell'utente: ${query}${tasteBlock}\n\nLocali:\n${JSON.stringify(userPayload)}`,
              },
            ],
          });

          const { input_tokens, output_tokens } = message.usage;
          cost += costOf(input_tokens, output_tokens);
          console.log(
            `[haiku-synthesis] call=matchReason places=${batch.length} in=${input_tokens} out=${output_tokens} stop=${message.stop_reason} cost=$${costOf(input_tokens, output_tokens).toFixed(6)}`,
          );
          if (message.stop_reason === "max_tokens") {
            console.error(
              `[haiku-synthesis] TRONCAMENTO call=matchReason stop=max_tokens places=${batch.length} out=${output_tokens}: risposta tagliata, possibile perdita di risultati. Chiamata comunque a pagamento — alza max_tokens.`,
            );
          }

          const rawText =
            message.content[0]?.type === "text" ? message.content[0].text : "";
          const arr = parseJsonArray(rawText);
          for (const item of arr) {
            if (!item || typeof item !== "object") continue;
            const o = item as Record<string, unknown>;
            if (typeof o.id !== "string" || !validIds.has(o.id)) continue;
            if (typeof o.matchReason === "string") matchReasons.set(o.id, o.matchReason);
            if (o.match === "alto" || o.match === "medio" || o.match === "basso") levels.set(o.id, o.match);
            if (typeof o.fit === "boolean") {
              fits.set(o.id, {
                fit: o.fit,
                fitReason: typeof o.fit_reason === "string" ? o.fit_reason.trim().slice(0, 200) : "",
              });
            }
          }
        } catch (err) {
          console.error("[haiku-synthesis] matchReason batch exception:", err);
        }
      }));
      if (matchReasons.size < targets.length) {
        const missingIds = targets.map((p) => p.id).filter((id) => !matchReasons.has(id));
        console.warn(
          `[haiku-synthesis] MISSING call=matchReason expected=${targets.length} received=${matchReasons.size} missingIds=${JSON.stringify(missingIds)}`,
        );
      }
    } catch (err) {
      console.error("[haiku-synthesis] matchReason call exception:", err);
    }
    return { matchReasons, fits, levels, cost };
  };
  // Fetch lanciata ORA: prosegue mentre sotto gira la pipeline synthesis.
  const matchReasonPromise = matchReasonWork();

  // 2. Legge la cache.
  const cached = new Map<string, CachedSynthesis>();
  const stale = new Set<string>();
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("place_synthesis")
      .select("place_id, synthesis, tags, verdict, go_for, dont_expect, generated_at")
      .in("place_id", ids);
    if (error) {
      console.error("[haiku-synthesis] cache read error:", error);
    } else {
      for (const row of data ?? []) {
        // Verdetto vuoto in cache (risposta dell'AI incompleta): conta come mancante e si rigenera,
        // altrimenti quel locale resterebbe senza verdetto per sempre (VISIONE: verdetto SEMPRE).
        if (typeof row.verdict !== "string" || row.verdict.trim() === "") continue;
        // Verdetto vecchio (decisione 24 del backlog, 15/10): si riscrive con le recensioni di oggi,
        // che arrivano già con la ricerca (nessuna chiamata Google in più; ~0,3 centesimi Haiku a
        // locale ogni 90 giorni). Se la riscrittura fallisce resta quello vecchio.
        const at = Date.parse(String(row.generated_at ?? ""));
        if (Number.isFinite(at) && Date.now() - at > SYNTHESIS_MAX_AGE_MS) stale.add(row.place_id as string);
        cached.set(row.place_id as string, {
          synthesis: (row.synthesis as string) ?? "",
          tags: (row.tags as string[] | null) ?? [],
          verdict: (row.verdict as string) ?? "",
          goFor: (row.go_for as string[] | null) ?? [],
          dontExpect: (row.dont_expect as string[] | null) ?? [],
        });
      }
    }
  } catch (err) {
    console.error("[haiku-synthesis] cache read exception:", err);
  }

  // 3. cached vs missing
  const missing = targets.filter((p) => !cached.has(p.id) || stale.has(p.id));
  if (stale.size > 0) console.log(`[haiku-synthesis] verdetti da rinnovare (oltre 90 giorni): ${stale.size}`);

  // 4. UNA chiamata Haiku in batch SOLO per i missing.
  const generated = new Map<string, CachedSynthesis>();
  if (missing.length > 0) {
    try {
      // Enrichment nel contesto: una sola query batch per i soli missing.
      // Stesso place_id (Google Place ID) di place_synthesis. Additivo: se vuoto
      // o in errore, la sintesi procede solo sulle recensioni.
      const enrichmentByPlace = await getEnrichmentForPlaces(missing.map((p) => p.id));

      // Stessa divisione a gruppi paralleli del "perché" (vedi sopra).
      await Promise.all(inBatches(missing).map(async (batch) => {
        try {
          const userPayload = batch.map((p) => ({
            id: p.id,
            name: p.name,
            category: p.category,
            rating: p.rating,
            userRatingCount: p.userRatingCount,
            priceLevel: p.priceLevel,
            editorialSummary: p.editorialSummary,
            reviewTexts: (p.reviewTexts ?? [])
              .slice(0, REVIEWS_PER_PLACE_FOR_SYNTHESIS)
              .map((r) => r.slice(0, REVIEW_CHAR_LIMIT)),
            // Mai TripAdvisor nella sintesi (regola di LORENZO.md), anche se una riga finisse nel database.
            enrichment: (enrichmentByPlace.get(p.id) ?? []).filter((e) => e.source !== "tripadvisor").map((e) => ({
              source: e.source,
              kind: e.source_kind,
              rating: e.rating_value,
              scale: e.rating_scale,
              ranking: e.ranking,
              comment: e.comment,
            })),
          }));

          const message = await anthropic.messages.create({
            model: HAIKU_MODEL,
            // 12 locali a cache fredda × 5 campi (synthesis, tags, verdict, go_for,
            // dont_expect) ≈ ~180-200 tok/oggetto → ~2200-2400 tok di fabbisogno pieno.
            // 1536 troncava (~65% del necessario); 4000 dà ~1.7× di margine.
            max_tokens: 4000,
            system: SYNTHESIS_SYSTEM,
            messages: [{ role: "user", content: JSON.stringify(userPayload) }],
          });

          const { input_tokens, output_tokens } = message.usage;
          const cost = costOf(input_tokens, output_tokens);
          totalCost += cost;
          console.log(
            `[haiku-synthesis] call=synthesis places=${batch.length} cached=${cached.size} in=${input_tokens} out=${output_tokens} stop=${message.stop_reason} cost=$${cost.toFixed(6)}`,
          );
          if (message.stop_reason === "max_tokens") {
            console.error(
              `[haiku-synthesis] TRONCAMENTO call=synthesis stop=max_tokens places=${batch.length} out=${output_tokens}: risposta tagliata, possibile perdita di risultati. Chiamata comunque a pagamento — alza max_tokens.`,
            );
          }

          const rawText =
            message.content[0]?.type === "text" ? message.content[0].text : "";
          const arr = parseJsonArray(rawText);
          for (const item of arr) {
            if (!item || typeof item !== "object") continue;
            const o = item as Record<string, unknown>;
            // VALIDAZIONE ANTI-ALLUCINAZIONE: scarta id non in input.
            if (typeof o.id !== "string" || !validIds.has(o.id)) continue;
            const rawTags = Array.isArray(o.tags)
              ? o.tags.filter((t): t is string => typeof t === "string").map((t) => t.toLowerCase().trim())
              : [];
            const validTags = rawTags.filter((t) => (ALLOWED_TAGS as readonly string[]).includes(t)).slice(0, 3);
            const scartati = rawTags.filter((t) => !(ALLOWED_TAGS as readonly string[]).includes(t));
            if (scartati.length > 0) {
              console.warn("[haiku-synthesis] tag scartati:", JSON.stringify(scartati));
            }
            generated.set(o.id, {
              synthesis: typeof o.synthesis === "string" ? o.synthesis : "",
              tags: validTags,
              verdict: typeof o.verdict === "string" ? o.verdict : "",
              // Il prompt non li produce ancora (arriva in un commit successivo): default "".
              goFor: normalizeChips(o.go_for, 3),
              dontExpect: normalizeChips(o.dont_expect, 2),
            });
          }
        } catch (err) {
          console.error("[haiku-synthesis] synthesis batch exception:", err);
        }
      }));
      if (generated.size < missing.length) {
        const missingIds = missing.map((p) => p.id).filter((id) => !generated.has(id));
        console.warn(
          `[haiku-synthesis] MISSING call=synthesis expected=${missing.length} received=${generated.size} missingIds=${JSON.stringify(missingIds)}`,
        );
      }
    } catch (err) {
      console.error("[haiku-synthesis] synthesis call exception:", err);
    }

    // 5. Upsert dei nuovi generati.
    if (generated.size > 0) {
      try {
        const supabase = createAdminClient();
        // Solo verdetti veri: uno vuoto in cache bloccherebbe il locale senza verdetto. Uno con parole
        // inglesi si mostra questa volta ma non si salva: la prossima ricerca lo riscrive.
        const rows = Array.from(generated.entries()).filter(([, s]) => s.verdict.trim() !== "" && !hasEnglish(`${s.verdict} ${s.synthesis}`)).map(([place_id, s]) => ({
          place_id,
          synthesis: s.synthesis,
          tags: s.tags,
          verdict: s.verdict,
          go_for: s.goFor,
          dont_expect: s.dontExpect,
          // L'upsert non riscrive il default: senza, un verdetto rinnovato resterebbe "vecchio".
          generated_at: new Date().toISOString(),
        }));
        const { error } = rows.length === 0 ? { error: null } : await supabase
          .from("place_synthesis")
          .upsert(rows, { onConflict: "place_id" });
        if (error) console.error("[haiku-synthesis] upsert error:", error);
      } catch (err) {
        console.error("[haiku-synthesis] upsert exception:", err);
      }
    }
  }

  // Unisce cache + generati: base sintesi (senza matchReason).
  const base = new Map<string, CachedSynthesis>();
  for (const [id, s] of cached) base.set(id, s);
  for (const [id, s] of generated) base.set(id, s);

  // 6. matchReason: attende la fetch lanciata in parallelo a inizio funzione.
  //    Girava mentre sopra completavano cache read + synthesis + upsert.
  const { matchReasons, fits, levels, cost: matchReasonCost } = await matchReasonPromise;
  totalCost += matchReasonCost;

  console.log(
    `[haiku-synthesis] total places=${targets.length} cached=${cached.size} generated=${generated.size} cost=$${totalCost.toFixed(6)}`,
  );

  // 7. Record<place_id, PlaceSynthesis>
  const result: Record<string, PlaceSynthesis> = {};
  // Anche i locali senza sintesi (risposta dell'AI tagliata o fallita): il "perché" e il giudizio
  // sulla richiesta sono già pagati e valgono lo stesso; i campi del verdetto restano vuoti.
  const EMPTY: CachedSynthesis = { synthesis: "", tags: [], verdict: "", goFor: [], dontExpect: [] };
  for (const p of targets) {
    if (!base.has(p.id) && (matchReasons.has(p.id) || fits.has(p.id))) base.set(p.id, EMPTY);
  }
  for (const [id, s] of base) {
    result[id] = {
      synthesis: s.synthesis,
      tags: s.tags,
      verdict: s.verdict,
      goFor: s.goFor,
      dontExpect: s.dontExpect,
      matchReason: matchReasons.get(id) ?? "",
      // Nel dubbio il locale resta: fit mancante = true.
      fit: fits.get(id)?.fit ?? true,
      fitReason: fits.get(id)?.fitReason ?? "",
      match: levels.get(id) ?? "medio",
    };
    if (fits.get(id)?.fit === false) {
      const name = targets.find((p) => p.id === id)?.name ?? id;
      console.log(
        `[search-exclude] query=${JSON.stringify(query.slice(0, 80))} place=${JSON.stringify(name)} id=${id} motivo=${JSON.stringify(fits.get(id)?.fitReason ?? "")}`,
      );
    }
  }
  return result;
}
