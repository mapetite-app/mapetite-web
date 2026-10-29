import { NextResponse } from "next/server";
import { extractPlace, type ImportImage } from "@/lib/import-caption";
import { allowAi, clientKey, AI_LIMIT_SCREENSHOT_MESSAGE } from "@/lib/ai-limit";
import { createClient } from "@/lib/supabase/server";
import { fetchVideoCaption, videoSourceOf } from "@/lib/video-caption";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const caption: unknown = body?.caption;
  const image: unknown = body?.image;
  const link: unknown = body?.link;

  // Link di un video TikTok o YouTube: si legge la didascalia dall'oEmbed ufficiale e la si passa
  // all'AI come il testo di uno screenshot. Solo con l'accesso (serve per salvare) e nel tetto AI.
  if (typeof link === "string" && link.trim() !== "") {
    if (link.length > 500 || !videoSourceOf(link)) {
      return NextResponse.json({ error: "Questo link non è un video di TikTok o YouTube." }, { status: 400 });
    }
    const devUser = process.env.NODE_ENV === "development" ? process.env.E2E_FAKE_USER ?? null : null;
    const { data: { user } } = await (await createClient()).auth.getUser();
    const userId = user?.id ?? devUser;
    if (!userId) return NextResponse.json({ error: "Accedi per salvare un locale da un video." }, { status: 401 });
    if (!allowAi("screenshot", clientKey(request, userId))) {
      return NextResponse.json({ error: AI_LIMIT_SCREENSHOT_MESSAGE }, { status: 429 });
    }
    const text = await fetchVideoCaption(link.trim());
    if (!text) {
      return NextResponse.json(
        { error: "Non riesco a leggere questo video (forse è privato o rimosso): fai uno screenshot e caricalo qui sotto." },
        { status: 422 },
      );
    }
    console.log(`[import-link] ${videoSourceOf(link)} didascalia=${JSON.stringify(text.slice(0, 120))}`);
    return NextResponse.json(await extractPlace({ caption: text }));
  }

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

  // Immagine: solo i formati che l'AI legge e una dimensione ragionevole (il telefono la rimpicciolisce già).
  if (hasImage) {
    const type = (image as string).slice(5, (image as string).indexOf(";"));
    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(type)) {
      return NextResponse.json({ error: "Formato non supportato: usa uno screenshot (JPG o PNG)." }, { status: 415 });
    }
    if ((image as string).length > 6_000_000) {
      return NextResponse.json({ error: "Immagine troppo grande: prova con uno screenshot più piccolo." }, { status: 413 });
    }
  }

  if (!allowAi("screenshot", clientKey(request))) {
    return NextResponse.json({ error: AI_LIMIT_SCREENSHOT_MESSAGE }, { status: 429 });
  }

  let img: ImportImage | undefined;
  if (hasImage) {
    const match = (image as string).match(/^data:([^;]+);base64,([\s\S]+)$/);
    if (match) img = { mediaType: match[1], data: match[2] };
  }

  const risultato = await extractPlace({
    caption: hasCaption ? (caption as string) : undefined,
    image: img,
  });

  return NextResponse.json(risultato);
}
