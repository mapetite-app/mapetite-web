import Anthropic from "@anthropic-ai/sdk";

// Lettura di un locale da caption o screenshot di un post social (Claude Haiku).
// Usata da /api/import-caption (Importa → screenshot) e da /importa/condividi/ricevi
// (screenshot condiviso da Instagram/TikTok su Android): una sola chiamata per immagine.

export type Luogo = { nome: string; citta: string | null; categoria: string | null };

export type ImportResult = {
  nome: string | null;
  citta: string | null;
  categoria: string | null;
  // Tutti i locali nominati nel post (i reel "5 posti dove…"), il primo è nome/citta/categoria. Max 5.
  luoghi?: Luogo[];
};

export const EMPTY: ImportResult = { nome: null, citta: null, categoria: null, luoghi: [] };
export const MAX_LUOGHI = 5;

const SYSTEM_PROMPT = `Sei un assistente che estrae i locali (ristoranti, bar, caffè, ecc.) nominati in caption di post social (Instagram, TikTok, YouTube) o in screenshot di post e reel.
Rispondi SOLO con un oggetto JSON valido, senza testo aggiuntivo, senza backtick, senza markdown.
La struttura deve essere esattamente:
{"luoghi":[{"nome":string,"citta":string|null,"categoria":string|null}]}

DOVE CERCARE (negli screenshot guarda tutto): il tag posizione del post (📍 o la riga sotto il nome del profilo),
le scritte sovrapposte al video, la didascalia, i @profili taggati, gli hashtag con il nome del locale, l'insegna se leggibile.

REGOLE:
- Inserisci SOLO locali il cui nome è scritto esplicitamente nel testo o nell'immagine. MAI inventare o indovinare un locale
  da una descrizione ("la carbonara più buona di Roma" senza nome → nessun locale). Se non ce n'è nessuno: {"luoghi":[]}.
- Il profilo di chi pubblica (creator, food blogger, "Autore:") NON è un locale, a meno che sia chiaramente il profilo del locale stesso.
- Un @profilo o un hashtag del locale va riscritto come si legge: @trattoria_da_enzo → "Trattoria da Enzo", #pizzeriabella → "Pizzeria Bella".
- Se il post nomina più locali (classifiche, "3 posti dove…"), mettili tutti nell'ordine in cui compaiono, al massimo 5.
- "citta": la città del locale (non provincia né nazione). Un quartiere famoso vale la sua città (Trastevere → Roma, Navigli → Milano).
  Se la città vale per tutto il post, mettila in ogni locale. Se assente, null.
- "categoria": SOLO una tra pizzeria, sushi, ristorante di pesce, gelateria, pasticceria, caffè, enoteca, bar, pub,
  hamburgheria, ristorante ramen, ristorante cinese, ristorante thai, braceria, trattoria, osteria, ristorante. Se non deducibile, null.

ESEMPI (input → output atteso):

"Serata magica da Borghese a Milano 🍝 uno dei migliori ristoranti della città! #foodie #milano"
→ {"luoghi":[{"nome":"Borghese","citta":"Milano","categoria":"ristorante"}]}

"Finalmente ho provato @sushizen.roma — nigiri incredibili, ve lo consiglio!\nAutore: giulia.mangia"
→ {"luoghi":[{"nome":"Sushi Zen","citta":"Roma","categoria":"sushi"}]}

"3 colazioni da provare a Napoli 🥐 1. Pasticceria Martini 2. @caffe_mexico 3. Leopoldo"
→ {"luoghi":[{"nome":"Pasticceria Martini","citta":"Napoli","categoria":"pasticceria"},{"nome":"Caffè Mexico","citta":"Napoli","categoria":"caffè"},{"nome":"Leopoldo","citta":"Napoli","categoria":"pasticceria"}]}

"La carbonara più buona di Roma, non ci credete? 🤤 #roma #carbonara"
→ {"luoghi":[]}`;

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
      max_tokens: 400,
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
      return fromParsed(JSON.parse(text));
    } catch {
      return EMPTY; // JSON non valido
    }
  } catch {
    return EMPTY; // errore di rete o della API: niente eccezioni verso chi chiama
  }
}

const str = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

// Risposta dell'AI → risultato. Accetta anche il vecchio formato {nome, citta, categoria}.
export function fromParsed(parsed: unknown): ImportResult {
  const o = (parsed ?? {}) as Record<string, unknown>;
  const raw = Array.isArray(o.luoghi) ? o.luoghi : o.nome ? [o] : [];
  const luoghi: Luogo[] = [];
  for (const l of raw as Record<string, unknown>[]) {
    const nome = str(l?.nome, 120);
    if (!nome) continue;
    if (luoghi.some((x) => x.nome.toLowerCase() === nome.toLowerCase())) continue;
    luoghi.push({ nome, citta: str(l.citta, 80), categoria: str(l.categoria, 40) });
    if (luoghi.length === MAX_LUOGHI) break;
  }
  const first = luoghi[0];
  return { nome: first?.nome ?? null, citta: first?.citta ?? null, categoria: first?.categoria ?? null, luoghi };
}
