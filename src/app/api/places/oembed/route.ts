import { NextResponse } from "next/server";
import { cleanReelUrl, reelSourceOf } from "@/lib/reel";
import { instagramCaption, instagramOembedUrl, resolveShortTikTok, tiktokOembedUrl } from "@/lib/video-caption";

// Anteprima di un reel collegato a un locale (piano 5.6d) dagli oEmbed UFFICIALI e gratuiti di
// TikTok e YouTube: il servizio che le piattaforme offrono per mostrare i loro video altrove, non
// uno scraping. Instagram dal 29/10: oEmbed di Meta senza token (src/lib/video-caption.ts).
// Non si salva niente nel database: la risposta resta un giorno nella cache di Next e basta.
// GET ?url=<link del video>  →  { titolo, autore, miniatura } (campi null se non disponibili).

const OEMBED = {
  TikTok: (url: string) => `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`,
  YouTube: (url: string) => `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`,
  Instagram: (url: string) => `https://graph.facebook.com/v25.0/instagram_oembed?omitscript=true&url=${encodeURIComponent(url)}`,
} as const;

const DAY = 86_400;
const VUOTA = { titolo: null, autore: null, miniatura: null };
const str = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

export async function GET(request: Request) {
  const url = cleanReelUrl(new URL(request.url).searchParams.get("url") ?? "");
  const source = url ? reelSourceOf(url) : null;
  if (!url || !source) return NextResponse.json(VUOTA);
  try {
    const full = source === "TikTok" ? tiktokOembedUrl(await resolveShortTikTok(url)) : source === "Instagram" ? instagramOembedUrl(url) : url;
    let res = await fetch(OEMBED[source](full), { signal: AbortSignal.timeout(5000), next: { revalidate: DAY } });
    // Come per la didascalia: se la forma /video/ non va, si prova il link così com'era.
    if (!res.ok && full !== url) res = await fetch(OEMBED[source](url), { signal: AbortSignal.timeout(5000), next: { revalidate: DAY } });
    if (!res.ok) {
      if (source === "Instagram") console.warn(`[oembed] Instagram ${res.status} meta=${(await res.text().catch(() => "")).slice(0, 300)}`);
      return NextResponse.json(VUOTA, { headers: { "Cache-Control": "public, max-age=3600" } });
    }
    const o = ((await res.json()) ?? {}) as Record<string, unknown>;
    const thumb = str(o.thumbnail_url, 1000);
    const ig = source === "Instagram" ? instagramCaption(o) : null;
    if (ig && !ig.title) console.warn(`[oembed] Instagram senza didascalia campi=${Object.keys(o).join(",")}`);
    return NextResponse.json(
      {
        titolo: str(ig ? ig.title : o.title, 200),
        autore: str(ig ? ig.author : o.author_name, 80),
        // Solo immagini https: il telefono le carica direttamente dalla piattaforma.
        miniatura: thumb && thumb.startsWith("https://") ? thumb : null,
      },
      { headers: { "Cache-Control": `public, max-age=${DAY}` } },
    );
  } catch (e) {
    if (source === "Instagram") console.warn("[oembed] Instagram non raggiungibile", e);
    return NextResponse.json(VUOTA);
  }
}
