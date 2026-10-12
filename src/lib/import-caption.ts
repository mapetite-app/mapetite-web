import Anthropic from "@anthropic-ai/sdk";

// Lettura di un locale da caption o screenshot di un post social (Claude Haiku).
// Usata da /api/import-caption (Importa → screenshot) e da /importa/condividi/ricevi
// (screenshot condiviso da Instagram/TikTok su Android): una sola chiamata per immagine.

export type ImportResult = {
  nome: string | null;
  citta: string | null;
  categoria: string | null;
};

export const EMPTY: ImportResult = { nome: null, citta: null, categoria: null };

const SYSTEM_PROMPT = `Sei un assistente che estrae informazioni su locali da caption di post social (Instagram, TikTok, YouTube) o da screenshot di post social.
Rispondi SOLO con un oggetto JSON valido, senza testo aggiuntivo, senza backtick, senza markdown.
La struttura deve essere esattamente:
{"nome":string|null,"citta":string|null,"categoria":string|null}

Il testo può provenire da uno screenshot di un post social: leggi il nome del locale, la città e la tipologia da quello che vedi nell'immagine.

REGOLE PER OGNI CAMPO:

"nome": il nome proprio del locale (ristorante, bar, ecc.). Cerca parole con iniziale maiuscola
o precedute da "da", "al", "il", "@", "#". Se non è identificabile con certezza, metti null.

"citta": la città in cui si trova il locale. Cerca nomi di città, quartieri famosi o riferimenti
geografici espliciti. Restituisci solo la città (non provincia né nazione). Se assente, null.

"categoria": il tipo di locale. Scegli SOLO tra queste categorie valide:
pizzeria, sushi, ristorante di pesce, gelateria, pasticceria, caffè, enoteca, bar, pub,
hamburgheria, ristorante ramen, ristorante cinese, ristorante thai, braceria, trattoria, osteria, ristorante.
Scegli quella più specifica e pertinente. Se non è deducibile, metti null.

ESEMPI (input → output atteso):

"Serata magica da Borghese a Milano 🍝 uno dei migliori ristoranti della città! #foodie #milano"
→ {"nome":"Borghese","citta":"Milano","categoria":"ristorante"}

"Finalmente ho provato @SushiZen Roma — nigiri incredibili, ve lo consiglio!"
→ {"nome":"SushiZen","citta":"Roma","categoria":"sushi"}

"Colazione da sogno alla Pasticceria Martini, Napoli. Il cornetto è una poesia 🥐"
→ {"nome":"Pasticceria Martini","citta":"Napoli","categoria":"pasticceria"}`;

export type ImportImage = { mediaType: string; data: string };

export async function extractPlace(input: { caption?: string; image?: ImportImage }): Promise<ImportResult> {
  type ContentBlock =
    | { type: "image"; source: { type: "base64"; media_type: string; data: string } }
    | { type: "text"; text: string };

  const content: ContentBlock[] = [];
  if (input.image) {
    content.push({ type: "image", source: { type: "base64", media_type: input.image.mediaType, data: input.image.data } });
  }
  if (input.caption) content.push({ type: "text", text: input.caption });
  if (content.length === 0) return EMPTY;

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 256,
      system: SYSTEM_PROMPT,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      messages: [{ role: "user", content: content as any }],
    });

    const rawText =
      message.content[0].type === "text" ? message.content[0].text.trim() : "";

    let text = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start !== -1 && end !== -1 && end > start) {
      text = text.slice(start, end + 1);
    }

    try {
      const parsed = JSON.parse(text);
      return {
        nome: typeof parsed.nome === "string" ? parsed.nome : null,
        citta: typeof parsed.citta === "string" ? parsed.citta : null,
        categoria: typeof parsed.categoria === "string" ? parsed.categoria : null,
      };
    } catch {
      return EMPTY; // JSON non valido
    }
  } catch {
    return EMPTY; // errore di rete o della API: niente eccezioni verso chi chiama
  }
}
