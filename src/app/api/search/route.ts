import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createAdminClient } from "@/lib/supabase/admin";
import { searchGooglePlaces, type PlaceResult } from "@/lib/google-places";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Public pricing for claude-haiku-4-5 (https://platform.claude.com/docs/en/pricing)
const HAIKU_INPUT_PER_MTOK = 1.00;
const HAIKU_OUTPUT_PER_MTOK = 5.00;

type SearchFilters = {
  categoria: string | null;
  parole_chiave: string[];
  vicino_a_me: boolean;
};

// Strip chars that could break PostgREST or() filter string syntax
const sanitize = (s: string): string =>
  s.replace(/[^a-zA-ZÀ-ÿ0-9 ]/g, "").trim().slice(0, 100);

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const query = body?.query;
  const source: "world" | "saved" =
    body?.source === "world" ? "world" : "saved";
  const lat = typeof body?.lat === "number" ? body.lat : undefined;
  const lng = typeof body?.lng === "number" ? body.lng : undefined;

  if (typeof query !== "string" || query.trim() === "") {
    return NextResponse.json(
      { error: "Il campo 'query' è obbligatorio e deve essere una stringa non vuota." },
      { status: 400 }
    );
  }

  if (query.length > 500) {
    return NextResponse.json(
      { error: "La query non può superare i 500 caratteri." },
      { status: 400 }
    );
  }

  let filtri: SearchFilters = {
    categoria: null,
    parole_chiave: [],
    vicino_a_me: false,
  };

  let risultati: PlaceResult[];

  if (source === "world") {
    try {
      risultati = await searchGooglePlaces(query.trim(), { lat, lng });
    } catch (err) {
      console.error("[search/route] Google Places error:", err);
      risultati = [];
    }
  } else {
    try {
      const message = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 512,
        system: `Sei un assistente che traduce frasi di ricerca di locali in filtri strutturati.
Rispondi SOLO con un oggetto JSON valido, senza testo aggiuntivo, senza backtick, senza markdown.
La struttura deve essere esattamente:
{"categoria":string|null,"parole_chiave":string[],"vicino_a_me":boolean}

REGOLE PER OGNI CAMPO:

"categoria": il tipo di locale. Se la frase non nomina un tipo esplicito, deducilo dal contesto
(es. "cena" o "cenare" → "ristorante", "aperitivo" → "bar", "colazione" → "bar" o "caffè").
Usa null SOLO se non c'è davvero alcun indizio sul tipo di locale.

"parole_chiave": estrai SEMPRE tutti gli aggettivi e le qualità descrittive presenti nella frase
(romantico, autentico, economico, elegante, tranquillo, vista mare, economico, tipico, moderno…).
Includile anche se ovvie o implicite. Scrivile in forma base singolare (maschile o femminile a seconda
del contesto). Non lasciare questo campo vuoto se ci sono qualità nella frase.

"vicino_a_me": metti true ogni volta che compaiono espressioni di prossimità come
"vicino casa", "qui vicino", "vicino a me", "nei paraggi", "in zona", "nelle vicinanze",
"in zona mia", "a due passi". False in tutti gli altri casi.

ESEMPI (input → output atteso):

"un posto romantico per cena vicino casa"
→ {"categoria":"ristorante","parole_chiave":["romantico"],"vicino_a_me":true}

"una pizzeria autentica e non troppo cara"
→ {"categoria":"pizzeria","parole_chiave":["autentica","economica"],"vicino_a_me":false}

"sushi all you can eat in zona"
→ {"categoria":"sushi","parole_chiave":["all you can eat"],"vicino_a_me":true}`,
        messages: [{ role: "user", content: query }],
      });

      const { input_tokens, output_tokens } = message.usage;
      const cost =
        (input_tokens / 1_000_000) * HAIKU_INPUT_PER_MTOK +
        (output_tokens / 1_000_000) * HAIKU_OUTPUT_PER_MTOK;
      console.log(
        `[haiku-cost] source=${source} in=${input_tokens}tok out=${output_tokens}tok cost=$${cost.toFixed(6)} query="${query.trim().slice(0, 60)}"`
      );

      const rawText =
        message.content[0].type === "text" ? message.content[0].text.trim() : "";

      // Strip markdown code fences (```json ... ``` or ``` ... ```)
      let text = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
      // Extract just the JSON object in case there's stray text before/after
      const start = text.indexOf("{");
      const end = text.lastIndexOf("}");
      if (start !== -1 && end !== -1 && end > start) {
        text = text.slice(start, end + 1);
      }

      try {
        const parsed = JSON.parse(text);
        filtri = {
          categoria: typeof parsed.categoria === "string" ? parsed.categoria : null,
          parole_chiave: Array.isArray(parsed.parole_chiave)
            ? parsed.parole_chiave.filter((k: unknown) => typeof k === "string")
            : [],
          vicino_a_me:
            typeof parsed.vicino_a_me === "boolean" ? parsed.vicino_a_me : false,
        };
      } catch {
        // keep default empty filters on JSON parse error
      }
    } catch {
      // proceed with empty filters rather than returning an error
    }

    const supabase = createAdminClient();

    const categoria = filtri.categoria ? sanitize(filtri.categoria) : null;
    const keywords = filtri.parole_chiave
      .map(sanitize)
      .filter((kw) => kw.length > 0);

    const fetchPlaces = async (withKeywords: boolean) => {
      let q = supabase
        .from("places")
        .select("id, name, category, address, lat, lng");

      if (categoria) {
        q = q.ilike("category", `%${categoria}%`);
      }

      if (withKeywords && keywords.length > 0) {
        // places has no note/descrizione — search keywords in name and category only
        const orFilter = keywords
          .flatMap((kw) => [`name.ilike.%${kw}%`, `category.ilike.%${kw}%`])
          .join(",");
        q = q.or(orFilter);
      }

      const { data, error } = await q.order("name");

      if (error) {
        console.error("[search/route] Supabase error:", error);
        return [];
      }
      return (data ?? []).map((row) => ({
        id: row.id,
        name: row.name,
        address: row.address ?? "",
        lat: row.lat,
        lng: row.lng,
        category: row.category,
        rating: null,
        userRatingCount: null,
        priceLevel: null,
        openNow: null,
      }));
    };

    if (keywords.length > 0) {
      risultati = await fetchPlaces(true);
      // fallback: if no results with keywords, try category-only
      if (risultati.length === 0) {
        risultati = await fetchPlaces(false);
      }
    } else {
      risultati = await fetchPlaces(false);
    }
  }

  return NextResponse.json({ risultati, filtri_usati: filtri });
}
