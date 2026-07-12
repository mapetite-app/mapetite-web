import Anthropic from "@anthropic-ai/sdk";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PlaceResult } from "@/lib/google-places";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const HAIKU_MODEL = "claude-haiku-4-5-20251001";

// Public pricing for claude-haiku-4-5 (https://platform.claude.com/docs/en/pricing)
const HAIKU_INPUT_PER_MTOK = 1.0;
const HAIKU_OUTPUT_PER_MTOK = 5.0;

// Solo i primi N locali vengono sintetizzati; gli altri restano senza sintesi.
export const SYNTHESIS_LIMIT = 8;

// Vocabolario chiuso dei tag: ogni tag fuori da questa lista viene scartato lato server.
export const ALLOWED_TAGS = ["romantico","informale","gruppi","business","veloce","aperitivo","famiglia","intimo","vivace","tradizionale","raffinato","economico"] as const;

// Riduzione del payload verso Haiku (solo per la chiamata synthesis, non tocca google-places.ts).
export const REVIEWS_PER_PLACE_FOR_SYNTHESIS = 3;
export const REVIEW_CHAR_LIMIT = 300;

export type PlaceSynthesis = {
  synthesis: string;      // 1-2 frasi, italiano
  tags: string[];         // max 3, lowercase, occasioni (es. "romantico", "gruppi", "informale")
  verdict: string;        // max 12 parole, il "verdetto Mapetite"
  matchReason: string;    // perché QUESTO locale risponde a QUELLA query. NON cacheabile.
};

// Riga cache: matchReason NON è persistito (dipende dalla query).
type CachedSynthesis = {
  synthesis: string;
  tags: string[];
  verdict: string;
};

const SYNTHESIS_SYSTEM = `REGOLA ASSOLUTA: scrivi ESCLUSIVAMENTE in italiano corretto. Le recensioni in input sono in inglese: NON copiare parole inglesi, NON usare calchi, NON inventare parole. Ogni singola parola di synthesis, tags e verdict deve essere una parola italiana esistente. Se un concetto è espresso in inglese nelle recensioni, traducilo.

Sei il curatore editoriale di Mapetite, piattaforma di scoperta food & beverage.
Ricevi una lista di locali con dati e recensioni reali da Google.
Per ogni locale produci una sintesi editoriale in ITALIANO, basata ESCLUSIVAMENTE sui dati forniti. Non inventare nulla.
Rispondi SOLO con un array JSON valido, senza testo aggiuntivo, senza backtick, senza markdown.
Struttura esatta:
[{"id":string,"synthesis":string,"tags":string[],"verdict":string}]
- id: DEVE essere identico all'id ricevuto in input
- synthesis: 1-2 frasi che dicono cosa rende questo locale quello che è. Concreta, non generica. Vietate frasi come 'locale apprezzato' o 'ottime recensioni'.
- tags: massimo 3, scelti ESCLUSIVAMENTE da questa lista chiusa. Non inventarne altri:
romantico, informale, gruppi, business, veloce, aperitivo, famiglia, intimo, vivace, tradizionale, raffinato, economico
- verdict: massimo 12 parole, tono diretto. VINCOLO CRITICO: il verdetto deve essere verificabile parola per parola contro le recensioni fornite. Non affermare MAI il contrario di ciò che dicono le recensioni. Se non sei certo del senso di un'informazione, ometti quel dettaglio invece di rischiare di invertirlo. Meglio un verdetto più povero che un verdetto sbagliato.`;

const MATCH_REASON_SYSTEM = `REGOLA ASSOLUTA: scrivi ESCLUSIVAMENTE in italiano corretto. Non usare parole inglesi, calchi o parole inventate. Ogni parola di matchReason deve essere una parola italiana esistente.

L'utente cerca un locale. Per ogni locale in lista spiega in una frase breve in ITALIANO perché risponde (o non risponde bene) alla sua richiesta specifica.
Rispondi SOLO con un array JSON valido, senza backtick, senza markdown.
Struttura esatta: [{"id":string,"matchReason":string}]
- id identico a quello ricevuto
- matchReason: una frase, massima concretezza, riferita alla richiesta dell'utente. Se il locale non centra bene la richiesta, dillo.`;

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

export async function getSynthesis(
  places: PlaceResult[],
  query: string,
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
      .select("place_id, synthesis, tags, verdict")
      .in("place_id", ids);
    if (error) {
      console.error("[haiku-synthesis] cache read error:", error);
    } else {
      for (const row of data ?? []) {
        cached.set(row.place_id as string, {
          synthesis: (row.synthesis as string) ?? "",
          tags: (row.tags as string[] | null) ?? [],
          verdict: (row.verdict as string) ?? "",
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
      }));

      const message = await anthropic.messages.create({
        model: HAIKU_MODEL,
        max_tokens: 1024,
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

      const message = await anthropic.messages.create({
        model: HAIKU_MODEL,
        max_tokens: 1024,
        system: MATCH_REASON_SYSTEM,
        messages: [
          {
            role: "user",
            content: `Richiesta dell'utente: ${query}\n\nLocali:\n${JSON.stringify(userPayload)}`,
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
      matchReason: matchReasons.get(id) ?? "",
    };
  }
  return result;
}
