import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  maxRetries: 0,
});

const HAIKU_MODEL = "claude-haiku-4-5-20251001";
const HAIKU_INPUT_PER_MTOK = 1.0;
const HAIKU_OUTPUT_PER_MTOK = 5.0;

// Tipi Google (Table A) ammessi come includedType. Lista chiusa: un valore
// sbagliato farebbe fallire la Text Search con 400, quindi Haiku non può
// inventarne altri.
export const ALLOWED_INCLUDED_TYPES = [
  "restaurant", "bar", "cafe", "coffee_shop", "pub", "wine_bar", "bakery",
  "pizza_restaurant", "italian_restaurant", "sushi_restaurant", "seafood_restaurant",
  "steak_house", "hamburger_restaurant", "breakfast_restaurant", "brunch_restaurant",
  "fine_dining_restaurant", "ice_cream_shop", "vegetarian_restaurant", "vegan_restaurant",
  "bar_and_grill", "night_club",
] as const;

export type SearchIntent = {
  zona: string | null;            // città/quartiere nominato nella frase
  vicino_a_me: boolean;
  tipo: string | null;            // tipo di locale in parole
  includedType: string | null;    // tipo Google, solo se chiarissimo
  requisiti: string[];            // caratteristiche fisiche/atmosfera/occasione
  queryGoogle: string;            // testo per la Text Search
};

const INTENT_SYSTEM = `Sei il traduttore di richieste di Mapetite (scoperta locali food & beverage in Italia).
Dalla frase dell'utente estrai l'intento e costruisci una query mirata per Google Places.
Rispondi SOLO con un oggetto JSON valido, senza backtick e senza testo aggiuntivo:
{"zona":string|null,"vicino_a_me":boolean,"tipo":string|null,"included_type":string|null,"requisiti":string[],"query_google":string}

- zona: città o quartiere NOMINATO nella frase (es. "Trastevere", "Roma"). null se non c'è. Non dedurre zone non scritte.
- vicino_a_me: true solo per espressioni di prossimità ("vicino a me", "qui vicino", "nei paraggi", "vicino casa").
- tipo: tipo di locale in italiano (es. "ristorante", "cocktail bar", "trattoria"). Deducilo dal contesto ("cena" → ristorante, "aperitivo" → bar, "colazione" → bar/caffè). null se davvero assente.
- included_type: UNO tra [${ALLOWED_INCLUDED_TYPES.join(", ")}] solo se il tipo è chiaro; altrimenti null. Per "rooftop"/"terrazza" senza altro tipo usa "bar"; per cena/ristorante "restaurant".
- requisiti: caratteristiche esplicite della richiesta, brevi: fisiche (rooftop, vista, giardino, all'aperto), occasione (coppia, amici, lavoro), atmosfera (romantico, vivace, autentico). Solo ciò che è scritto o chiaramente implicito.
- query_google: query breve in italiano per la ricerca testuale: tipo + caratteristiche fisiche chiave + zona se presente. Non includere "vicino a me". Es: "ristorante rooftop terrazza panoramica Roma".
- Se la frase chiede un locale "stellato" / con "stella Michelin" (stellato = almeno una stella Michelin; "cielo stellato" NON lo è): metti "stellato Michelin" nei requisiti e "stellato Michelin" in query_google, e come included_type usa "restaurant" (mai un tipo di cucina né "fine_dining_restaurant": molti stellati non sono registrati così). Es: "ristorante stellato dove mangiare pesce a Roma" → query_google "ristorante pesce stellato Michelin Roma".`;

function parseJsonObject(raw: string): Record<string, unknown> | null {
  let text = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  const s = text.indexOf("{");
  const e = text.lastIndexOf("}");
  if (s !== -1 && e > s) text = text.slice(s, e + 1);
  try {
    const v = JSON.parse(text);
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v.trim().slice(0, 120) : null;
}

// Estrae l'intento con Haiku PRIMA della ricerca Google. Degrada in sicurezza:
// qualsiasi errore o timeout → null e il chiamante usa la frase originale.
export async function extractSearchIntent(query: string): Promise<SearchIntent | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  try {
    const message = await anthropic.messages.create(
      {
        model: HAIKU_MODEL,
        max_tokens: 400,
        system: INTENT_SYSTEM,
        messages: [{ role: "user", content: query }],
      },
      { timeout: 6000 },
    );
    const { input_tokens, output_tokens } = message.usage;
    const cost =
      (input_tokens / 1_000_000) * HAIKU_INPUT_PER_MTOK +
      (output_tokens / 1_000_000) * HAIKU_OUTPUT_PER_MTOK;
    console.log(`[search-intent] in=${input_tokens} out=${output_tokens} cost=$${cost.toFixed(6)}`);

    const raw = message.content[0]?.type === "text" ? message.content[0].text : "";
    const o = parseJsonObject(raw);
    if (!o) return null;
    const queryGoogle = str(o.query_google);
    if (!queryGoogle) return null;
    const inc = str(o.included_type);
    return {
      zona: str(o.zona),
      vicino_a_me: o.vicino_a_me === true,
      tipo: str(o.tipo),
      includedType: inc && (ALLOWED_INCLUDED_TYPES as readonly string[]).includes(inc) ? inc : null,
      requisiti: Array.isArray(o.requisiti)
        ? o.requisiti.filter((r): r is string => typeof r === "string" && r.trim() !== "").map((r) => r.trim().slice(0, 60)).slice(0, 8)
        : [],
      queryGoogle,
    };
  } catch (err) {
    console.error("[search-intent] errore, uso la frase originale:", err);
    return null;
  }
}
