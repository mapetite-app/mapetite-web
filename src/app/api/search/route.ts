import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { searchGooglePlaces, type PlaceResult } from "@/lib/google-places";
import { getSynthesis, type PlaceSynthesis } from "@/lib/haiku-synthesis";
import { selectQualityReviews } from "@/lib/review-selection";

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
  // Intento dichiarato dal chiamante: "natural" = query in linguaggio naturale →
  // preserva la rilevanza Google; "structured" (o assente) = modalità a filtri →
  // sort per qualità. Nessuna euristica: lo decide chi fa la ricerca, non il server.
  const searchIntent: "natural" | "structured" =
    body?.searchIntent === "natural" ? "natural" : "structured";
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

  // Il ramo saved aggiunge tags/note personali (assenti nel ramo world): campi opzionali.
  let risultati: (PlaceResult & { tags?: string[] | null; note?: string | null })[];
  // Sintesi editoriale Haiku: solo sul ramo world, opzionale e degradabile.
  let sintesi: Record<string, PlaceSynthesis> = {};

  if (source === "world") {
    try {
      risultati = await searchGooglePlaces(query.trim(), {
        lat,
        lng,
        minRating: typeof body?.minRating === "number" ? body.minRating : undefined,
        minReviews: typeof body?.minReviews === "number" ? body.minReviews : undefined,
        minPriceLevel: typeof body?.minPriceLevel === "number" ? body.minPriceLevel : undefined,
        maxPriceLevel: typeof body?.maxPriceLevel === "number" ? body.maxPriceLevel : undefined,
        openNowOnly: body?.openNowOnly === true ? true : undefined,
        radius: typeof body?.radius === "number" ? body.radius : undefined,
        categories: Array.isArray(body?.categories) ? body.categories : undefined,
        sortMode: searchIntent === "natural" ? "relevance" : "quality",
      });
    } catch (err) {
      console.error("[search/route] Google Places error:", err);
      risultati = [];
    }

    if (risultati.length > 0) {
      try {
        // Utente opzionale: la ricerca world è pubblica. Se autenticato, i suoi
        // gusti personalizzano matchReason; altrimenti degrada su richiesta+locale.
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        sintesi = await getSynthesis(risultati, query.trim(), user?.id ?? null);
      } catch (err) {
        console.error("[search/route] Haiku synthesis error:", err);
        sintesi = {};
      }
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

    // Client server AUTENTICATO: la ricerca "tra i miei salvati" deve rispettare la RLS
    // e leggere saved_places dell'utente, non il catalogo globale places.
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: "Autenticazione richiesta." },
        { status: 401 }
      );
    }

    const categoria = filtri.categoria ? sanitize(filtri.categoria) : null;
    const keywords = filtri.parole_chiave
      .map(sanitize)
      .filter((kw) => kw.length > 0);

    type SavedRow = {
      tags: string[] | null;
      note: string | null;
      place: {
        id: string;
        name: string;
        category: string | null;
        address: string | null;
        lat: number | null;
        lng: number | null;
      };
    };

    const fetchPlaces = async (withKeywords: boolean) => {
      // Pattern identico a map-view.tsx: saved_places join places, filtrato per utente.
      const { data, error } = await supabase
        .from("saved_places")
        .select("tags, note, places(id, name, category, address, lat, lng)")
        .eq("user_id", user.id);

      if (error) {
        console.error("[search/route] Supabase error:", error);
        return [];
      }

      let rows: SavedRow[] = (data ?? [])
        .map((row) => {
          const place = row.places as unknown as SavedRow["place"] | null;
          if (!place || place.lat == null || place.lng == null) return null;
          return { tags: row.tags as string[] | null, note: row.note as string | null, place };
        })
        .filter((r): r is SavedRow => r !== null);

      // Filtri applicati in memoria (poche decine di righe per utente):
      // si evita l'embedded filtering PostgREST sui campi joinati.
      if (categoria) {
        const c = categoria.toLowerCase();
        rows = rows.filter((r) => (r.place.category ?? "").toLowerCase().includes(c));
      }
      if (withKeywords && keywords.length > 0) {
        rows = rows.filter((r) =>
          keywords.some((kw) => {
            const k = kw.toLowerCase();
            return (
              (r.place.name ?? "").toLowerCase().includes(k) ||
              (r.place.category ?? "").toLowerCase().includes(k)
            );
          })
        );
      }

      rows.sort((a, b) => (a.place.name ?? "").localeCompare(b.place.name ?? ""));

      return rows.map((r) => ({
        id: r.place.id,
        name: r.place.name,
        address: r.place.address ?? "",
        lat: r.place.lat,
        lng: r.place.lng,
        category: r.place.category,
        rating: null,
        userRatingCount: null,
        priceLevel: null,
        openNow: null,
        types: null,
        websiteUri: null,
        editorialSummary: null,
        reviewTexts: null,
        phone: null,
        photoRef: null,
        // tag e nota personali dell'utente, presi da saved_places
        tags: r.tags,
        note: r.note,
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

  // Un locale = un solo oggetto completo: fonde la sintesi nei risultati,
  // sostituisce reviewTexts (server-only) con le recensioni selezionate per la scheda.
  // Nel ramo saved `sintesi` è {}, quindi i campi editoriali risultano null.
  const risultatiFinali = risultati.map((p) => {
    const s = sintesi[p.id];
    const { reviewTexts, ...rest } = p;
    return {
      ...rest,
      selectedReviews: selectQualityReviews(reviewTexts),
      synthesis: s?.synthesis ?? null,
      tags: s?.tags ?? rest.tags ?? null,
      verdict: s?.verdict ?? null,
      goFor: s?.goFor ?? null,
      dontExpect: s?.dontExpect ?? null,
      matchReason: s?.matchReason ?? null,
    };
  });

  // [search-funnel] diagnostica branch + Haiku. haiku = sintesi invocata (solo ramo
  // world con risultati); verdicts/matchReasons = quanti campi non vuoti ha prodotto.
  const synthVals = Object.values(sintesi);
  const haikuInvoked = source === "world" && risultati.length > 0;
  const verdictsCount = synthVals.filter(
    (s) => typeof s.verdict === "string" && s.verdict.trim() !== "",
  ).length;
  const matchReasonsCount = synthVals.filter(
    (s) => typeof s.matchReason === "string" && s.matchReason.trim() !== "",
  ).length;
  console.log(
    `[search-funnel] sent=${JSON.stringify(query.trim())} branch=${source} ` +
      `haiku=${haikuInvoked} verdicts=${verdictsCount} matchReasons=${matchReasonsCount}`,
  );

  return NextResponse.json({ risultati: risultatiFinali, filtri_usati: filtri });
}
