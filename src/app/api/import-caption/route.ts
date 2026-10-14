import { NextResponse } from "next/server";
import { extractPlace, type ImportImage } from "@/lib/import-caption";
import { allowAi, clientKey, AI_LIMIT_SCREENSHOT_MESSAGE } from "@/lib/ai-limit";

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
