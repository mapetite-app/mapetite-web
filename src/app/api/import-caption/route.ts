import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

type ImportResult = {
  nome: string | null;
  citta: string | null;
  categoria: string | null;
};

const EMPTY: ImportResult = { nome: null, citta: null, categoria: null };

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

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const caption: unknown = body?.caption;
  const image: unknown = body?.image;

  const hasCaption = typeof caption === "string" && caption.trim() !== "";
  const hasImage =
    typeof image === "string" && /^data:[^;]+;base64,/.test(image);

  if (!hasCaption && !hasImage) {
    return NextResponse.json(
      { error: "Almeno uno tra 'caption' e 'image' è obbligatorio." },
      { status: 400 }
    );
  }

  if (hasCaption && (caption as string).length > 2000) {
    return NextResponse.json(
      { error: "La caption non può superare i 2000 caratteri." },
      { status: 400 }
    );
  }

  // Build content array for the user message
  type ContentBlock =
    | { type: "image"; source: { type: "base64"; media_type: string; data: string } }
    | { type: "text"; text: string };

  const content: ContentBlock[] = [];

  if (hasImage) {
    const match = (image as string).match(/^data:([^;]+);base64,([\s\S]+)$/);
    if (match) {
      content.push({
        type: "image",
        source: { type: "base64", media_type: match[1], data: match[2] },
      });
    }
  }

  if (hasCaption) {
    content.push({ type: "text", text: caption as string });
  }

  let risultato: ImportResult = EMPTY;

  try {
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
      risultato = {
        nome: typeof parsed.nome === "string" ? parsed.nome : null,
        citta: typeof parsed.citta === "string" ? parsed.citta : null,
        categoria: typeof parsed.categoria === "string" ? parsed.categoria : null,
      };
    } catch {
      // keep EMPTY on JSON parse error
    }
  } catch {
    // return EMPTY rather than propagating errors to the client
  }

  return NextResponse.json(risultato);
}
