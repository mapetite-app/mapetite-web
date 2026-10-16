import { NextResponse } from "next/server";
import { cleanReelUrl, reelSourceOf } from "@/lib/reel";
import { resolveShortTikTok } from "@/lib/video-caption";

// Anteprima di un reel collegato a un locale (piano 5.6d) dagli oEmbed UFFICIALI e gratuiti di
// TikTok e YouTube: il servizio che le piattaforme offrono per mostrare i loro video altrove, non
// uno scraping. Instagram non c'è (il suo oEmbed vuole un'app Meta con token): solo il link.
// Non si salva niente nel database: la risposta resta un giorno nella cache di Next e basta.
// GET ?url=<link del video>  →  { titolo, autore, miniatura } (campi null se non disponibili).

const OEMBED = {
  TikTok: (url: string) => `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`,
  YouTube: (url: string) => `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`,
} as const;

const DAY = 86_400;
const VUOTA = { titolo: null, autore: null, miniatura: null };
const str = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

export async function GET(request: Request) {
  const url = cleanReelUrl(new URL(request.url).searchParams.get("url") ?? "");
  const source = url ? reelSourceOf(url) : null;
  if (!url || !source || source === "Instagram") return NextResponse.json(VUOTA);
  try {
    const full = source === "TikTok" ? await resolveShortTikTok(url) : url;
    const res = await fetch(OEMBED[source](full), { signal: AbortSignal.timeout(5000), next: { revalidate: DAY } });
    if (!res.ok) return NextResponse.json(VUOTA, { headers: { "Cache-Control": "public, max-age=3600" } });
    const o = ((await res.json()) ?? {}) as Record<string, unknown>;
    const thumb = str(o.thumbnail_url, 1000);
    return NextResponse.json(
      {
        titolo: str(o.title, 200),
        autore: str(o.author_name, 80),
        // Solo immagini https: il telefono le carica direttamente dalla piattaforma.
        miniatura: thumb && thumb.startsWith("https://") ? thumb : null,
      },
      { headers: { "Cache-Control": `public, max-age=${DAY}` } },
    );
  } catch {
    return NextResponse.json(VUOTA);
  }
}
