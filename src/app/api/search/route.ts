import { NextResponse, after } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { searchGooglePlaces, withoutReviewOrigins, type PlaceResult } from "@/lib/google-places";
import { getSynthesis, SYNTHESIS_LIMIT, type PlaceSynthesis } from "@/lib/haiku-synthesis";
import { selectQualityReviews } from "@/lib/review-selection";
import { extractSearchIntent } from "@/lib/search-intent";
import { recordEvent } from "@/lib/events";
import { allowAi, clientKey, AI_LIMIT_MESSAGE } from "@/lib/ai-limit";
import { demoteMainstream } from "@/lib/mainstream";
import { demoteOffType } from "@/lib/off-type";
import { michelinGoogleQuery, promoteMichelin } from "@/lib/michelin";
import { buildSynthesisInput, signSynthesisInput, type SynthesisInput } from "@/lib/synthesis-token";

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
  zona?: string | null; // zona nominata nella frase (solo per mostrarla: "Ho capito: … · a Trastevere")
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
  // "fast": solo dati Google (prima risposta); verdetti con /api/search/synthesis.
  // Assente = comportamento completo di sempre.
  const fastPhase = body?.phase === "fast";
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

  // Tetto alle chiamate AI (src/lib/ai-limit.ts): le ricerche scritte usano Haiku.
  if (source === "world" && searchIntent === "natural" && !allowAi("ricerca", clientKey(request))) {
    return NextResponse.json({ error: AI_LIMIT_MESSAGE }, { status: 429 });
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
  let synthInput: SynthesisInput[] | null = null;
  let synthToken: string | null = null;
  let esclusi: string[] = [];
  // Messi da parte dai riordini (VISIONE.md: il differenziatore deve vedersi): si dice all'utente.
  // perche_turistici: allineato a turistici, il motivo letto nelle recensioni (es. "4 recensioni su 5 in inglese").
  const daParte: { turistici: string[]; perche_turistici: string[]; fuori_tema: string[] } = { turistici: [], perche_turistici: [], fuori_tema: [] };
  // Richieste di "stellato": quanti locali citano la stella nelle recensioni (null = non è questa richiesta).
  let michelinCitati: number | null = null;

  if (source === "world") {
    // Capire la richiesta prima di Google (solo ricerche in linguaggio naturale).
    // Se Haiku non risponde si usa la frase originale come prima.
    const intent = searchIntent === "natural" ? await extractSearchIntent(query.trim()) : null;
    if (intent) {
      filtri = {
        categoria: intent.tipo,
        parole_chiave: intent.requisiti,
        vicino_a_me: intent.vicino_a_me,
        zona: intent.zona,
      };
      console.log(`[search-intent] ${JSON.stringify({ q: query.trim().slice(0, 80), ...intent })}`);
    }
    // Zona nominata → è già nel testo della query: nessun bias sulla posizione della mappa.
    // "Vicino a me" → solo risultati nell'area intorno al centro mappa. Altrimenti bias.
    const locationMode = intent?.zona ? "none" : intent?.vicino_a_me ? "restrict" : "bias";
    // "Stellato": la query a Google tiene "stellato Michelin" e non si restringe a un tipo di cucina.
    const google = searchIntent === "natural"
      ? michelinGoogleQuery(query.trim(), intent?.queryGoogle ?? query.trim(), intent?.includedType)
      : { queryGoogle: intent?.queryGoogle ?? query.trim(), includedType: intent?.includedType, changed: [] };
    if (google.changed.length > 0) {
      console.log(`[search-michelin] q=${JSON.stringify(query.trim().slice(0, 80))} ${google.changed.join("; ")}`);
    }
    try {
      risultati = await searchGooglePlaces(google.queryGoogle, {
        includedType: google.includedType ?? undefined,
        locationMode,
        lat,
        lng,
        minRating: typeof body?.minRating === "number" ? body.minRating : undefined,
        minReviews: typeof body?.minReviews === "number" ? body.minReviews : undefined,
        minPriceLevel: typeof body?.minPriceLevel === "number" ? body.minPriceLevel : undefined,
        maxPriceLevel: typeof body?.maxPriceLevel === "number" ? body.maxPriceLevel : undefined,
        openNowOnly: body?.openNowOnly === true ? true : undefined,
        radius: typeof body?.radius === "number" ? body.radius : intent?.vicino_a_me ? 3000 : undefined,
        categories: Array.isArray(body?.categories) ? body.categories : undefined,
        sortMode: searchIntent === "natural" ? "relevance" : "quality",
      });
    } catch (err) {
      console.error("[search/route] Google Places error:", err);
      risultati = [];
    }
    // "Colazione", "cocktail bar", "ristorante": i locali di tutt'altro tipo
    // (un pub per la colazione) vanno in fondo, mai esclusi.
    if (searchIntent === "natural") {
      const { places, demoted, rule } = demoteOffType(query.trim(), risultati);
      if (demoted.length > 0) {
        risultati = places;
        daParte.fuori_tema = demoted.slice(0, 10);
        console.log(`[search-tipo] q=${JSON.stringify(query.trim().slice(0, 80))} regola=${rule} in fondo (tipo fuori tema): ${JSON.stringify(demoted)}`);
      }
    }
    // "Non turistico", "autentico"…: i locali che le recensioni descrivono come turistici
    // vanno in fondo (mai esclusi). Motivo per ogni locale nei log.
    if (searchIntent === "natural") {
      const { places, demoted, reasons, log } = demoteMainstream(query.trim(), risultati);
      if (log.length > 0) {
        console.log(`[search-mainstream] q=${JSON.stringify(query.trim().slice(0, 80))} ${demoted.length} in fondo:\n  ${log.join("\n  ")}`);
      }
      if (demoted.length > 0) {
        risultati = places;
        daParte.turistici = demoted.slice(0, 10);
        daParte.perche_turistici = reasons.slice(0, 10);
      }
    }
    // "Stellato" / "stella Michelin": in cima chi ne parla nelle recensioni o nella descrizione
    // Google. Nessuna fonte Michelin: non si afferma mai che un locale è stellato.
    if (searchIntent === "natural") {
      const { places, applied, cited, log } = promoteMichelin(query.trim(), risultati);
      if (applied) {
        risultati = places;
        michelinCitati = Math.min(cited.length, SYNTHESIS_LIMIT); // si mostrano solo i primi SYNTHESIS_LIMIT
        console.log(`[search-michelin] q=${JSON.stringify(query.trim().slice(0, 80))} in cima ${cited.length} su ${places.length} (citano la stella): ${JSON.stringify(log)}`);
      }
    }

    // Il verdetto Mapetite deve esserci su OGNI risultato (VISIONE.md): Haiku lo scrive per i
    // primi SYNTHESIS_LIMIT, quindi si mostrano solo quelli. Meglio 12 posti con il verdetto che
    // 20 di cui 8 muti. Nessun costo in più; quelli tagliati sono gli ultimi (spesso già spostati in fondo).
    if (risultati.length > SYNTHESIS_LIMIT) {
      console.log(`[search-limite] mostrati ${SYNTHESIS_LIMIT} su ${risultati.length} (solo quelli con il verdetto)`);
      risultati = risultati.slice(0, SYNTHESIS_LIMIT);
    }

    if (risultati.length > 0 && fastPhase) {
      // Primo tempo: niente Haiku. Il client chiede i verdetti con i dati firmati.
      try {
        synthInput = buildSynthesisInput(risultati);
        synthToken = signSynthesisInput(query.trim(), synthInput);
      } catch (err) {
        console.error("[search/route] firma sintesi non disponibile:", err);
        synthInput = null;
      }
    } else if (risultati.length > 0) {
      try {
        // Utente opzionale: la ricerca world è pubblica. Se autenticato, i suoi
        // gusti personalizzano matchReason; altrimenti degrada su richiesta+locale.
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        sintesi = await getSynthesis(risultati, query.trim(), user?.id ?? null);
        // Esclusione dei locali che chiaramente non rispettano la richiesta
        // (approvata da Lorenzo il 10/10). Se Haiku li scarta tutti, non si esclude nulla.
        esclusi = risultati.filter((p) => sintesi[p.id]?.fit === false).map((p) => p.id);
        if (esclusi.length === risultati.length) esclusi = [];
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
  const risultatiFinali = risultati.filter((p) => !esclusi.includes(p.id)).map((p) => {
    const s = sintesi[p.id];
    // reviewOrigins (lingua delle recensioni) resta sul server come reviewTexts.
    const { reviewTexts, ...rest } = withoutReviewOrigins(p);
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

  // Segnale "ricerca" (VISIONE.md: dati sui comportamenti di scoperta, utili anche ai ristoratori).
  // Mai la frase scritta: solo cosa ha capito l'AI o i filtri scelti. Dopo la risposta, senza attese.
  if (source === "world") {
    after(async () => {
      const { data } = await (await createClient()).auth.getUser();
      await recordEvent({
        type: "ricerca",
        userId: data?.user?.id ?? null,
        lat,
        lng,
        props: {
          modo: searchIntent === "natural" ? "ai" : "filtri",
          tipo: filtri.categoria,
          requisiti: filtri.parole_chiave.slice(0, 6),
          zona: filtri.zona ?? null,
          vicino_a_me: filtri.vicino_a_me,
          categorie: Array.isArray(body?.categories) ? body.categories.slice(0, 6) : null,
          voto_min: typeof body?.minRating === "number" ? body.minRating : null,
          prezzo_max: typeof body?.maxPriceLevel === "number" ? body.maxPriceLevel : null,
          risultati: risultati.length,
        },
      });
    });
  }

  return NextResponse.json({
    risultati: risultatiFinali,
    filtri_usati: filtri,
    ...(daParte.turistici.length > 0 || daParte.fuori_tema.length > 0 ? { da_parte: daParte } : {}),
    // Solo per le richieste di "stellato": quanti risultati citano la stella nelle recensioni.
    ...(michelinCitati !== null ? { michelin: { citati: michelinCitati } } : {}),
    // Solo nel primo tempo: dati firmati per chiedere i verdetti.
    ...(synthInput && synthToken ? { sintesi_pendente: { places: synthInput, token: synthToken } } : {}),
  });
}
