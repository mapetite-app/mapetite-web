import Anthropic from "@anthropic-ai/sdk";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEnrichmentForPlaces } from "@/lib/enrichment";
import type { PlaceResult } from "@/lib/google-places";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
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
};

// Riga cache: matchReason NON è persistito (dipende dalla query).
type CachedSynthesis = {
  synthesis: string;
  tags: string[];
  verdict: string;
  goFor: string[];
  dontExpect: string[];
};

const SYNTHESIS_SYSTEM = `REGOLA ASSOLUTA: scrivi ESCLUSIVAMENTE in italiano corretto. Le recensioni in input sono in inglese: NON copiare parole inglesi, NON usare calchi, NON inventare parole. Ogni singola parola di synthesis, tags, verdict, go_for e dont_expect deve essere una parola italiana esistente. Se un concetto è espresso in inglese nelle recensioni, traducilo.

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
Struttura esatta: [{"id":string,"matchReason":string}]
- id identico a quello ricevuto
- matchReason: una frase, massima concretezza, riferita alla richiesta dell'utente e, se disponibili, ai suoi gusti. Se il locale non centra bene, dillo.`;

function costOf(inputTokens: number, outputTokens: number): number {
  return (
    (inputTokens / 1_000_000) * HAIKU_INPUT_PER_MTOK +
    (outputTokens / 1_000_000) * HAIKU_OUTPUT_PER_MTOK
  );
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

  // 2. Legge la cache.
  const cached = new Map<string, CachedSynthesis>();
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("place_synthesis")
      .select("place_id, synthesis, tags, verdict, go_for, dont_expect")
      .in("place_id", ids);
    if (error) {
      console.error("[haiku-synthesis] cache read error:", error);
    } else {
      for (const row of data ?? []) {
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
  const missing = targets.filter((p) => !cached.has(p.id));

  // 4. UNA chiamata Haiku in batch SOLO per i missing.
  const generated = new Map<string, CachedSynthesis>();
  if (missing.length > 0) {
    try {
      // Enrichment nel contesto: una sola query batch per i soli missing.
      // Stesso place_id (Google Place ID) di place_synthesis. Additivo: se vuoto
      // o in errore, la sintesi procede solo sulle recensioni.
      const enrichmentByPlace = await getEnrichmentForPlaces(missing.map((p) => p.id));

      const userPayload = missing.map((p) => ({
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
        enrichment: (enrichmentByPlace.get(p.id) ?? []).map((e) => ({
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
        max_tokens: 1536,
        system: SYNTHESIS_SYSTEM,
        messages: [{ role: "user", content: JSON.stringify(userPayload) }],
      });

      const { input_tokens, output_tokens } = message.usage;
      const cost = costOf(input_tokens, output_tokens);
      totalCost += cost;
      console.log(
        `[haiku-synthesis] call=synthesis places=${missing.length} cached=${cached.size} in=${input_tokens} out=${output_tokens} cost=$${cost.toFixed(6)}`,
      );

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
        const rows = Array.from(generated.entries()).map(([place_id, s]) => ({
          place_id,
          synthesis: s.synthesis,
          tags: s.tags,
          verdict: s.verdict,
          go_for: s.goFor,
          dont_expect: s.dontExpect,
        }));
        const { error } = await supabase
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

  // 6. SECONDA chiamata Haiku: matchReason per TUTTI quelli con sintesi disponibile.
  const matchReasons = new Map<string, string>();
  const withSynthesis = targets.filter((p) => base.has(p.id));
  if (withSynthesis.length > 0) {
    try {
      const userPayload = withSynthesis.map((p) => ({
        id: p.id,
        name: p.name,
        category: p.category,
        synthesis: base.get(p.id)?.synthesis ?? "",
      }));

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

      const message = await anthropic.messages.create({
        model: HAIKU_MODEL,
        max_tokens: 1024,
        system: MATCH_REASON_SYSTEM,
        messages: [
          {
            role: "user",
            content: `Richiesta dell'utente: ${query}${tasteBlock}\n\nLocali:\n${JSON.stringify(userPayload)}`,
          },
        ],
      });

      const { input_tokens, output_tokens } = message.usage;
      const cost = costOf(input_tokens, output_tokens);
      totalCost += cost;
      console.log(
        `[haiku-synthesis] call=matchReason places=${withSynthesis.length} cached=${cached.size} in=${input_tokens} out=${output_tokens} cost=$${cost.toFixed(6)}`,
      );

      const rawText =
        message.content[0]?.type === "text" ? message.content[0].text : "";
      const arr = parseJsonArray(rawText);
      for (const item of arr) {
        if (!item || typeof item !== "object") continue;
        const o = item as Record<string, unknown>;
        if (typeof o.id !== "string" || !validIds.has(o.id)) continue;
        if (typeof o.matchReason === "string") matchReasons.set(o.id, o.matchReason);
      }
      if (matchReasons.size < withSynthesis.length) {
        const missingIds = withSynthesis.map((p) => p.id).filter((id) => !matchReasons.has(id));
        console.warn(
          `[haiku-synthesis] MISSING call=matchReason expected=${withSynthesis.length} received=${matchReasons.size} missingIds=${JSON.stringify(missingIds)}`,
        );
      }
    } catch (err) {
      console.error("[haiku-synthesis] matchReason call exception:", err);
    }
  }

  console.log(
    `[haiku-synthesis] total places=${targets.length} cached=${cached.size} generated=${generated.size} cost=$${totalCost.toFixed(6)}`,
  );

  // 7. Record<place_id, PlaceSynthesis>
  const result: Record<string, PlaceSynthesis> = {};
  for (const [id, s] of base) {
    result[id] = {
      synthesis: s.synthesis,
      tags: s.tags,
      verdict: s.verdict,
      goFor: s.goFor,
      dontExpect: s.dontExpect,
      matchReason: matchReasons.get(id) ?? "",
    };
  }
  return result;
}
