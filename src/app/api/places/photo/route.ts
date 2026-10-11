import { NextResponse } from "next/server";

// Proxy delle foto Google Places: la chiave resta sul server e la risposta è
// messa in cache a lungo (CDN + browser), così la stessa foto si paga una volta.
// Place Photos è a pagamento (autorizzato da Lorenzo l'11/10): tetto giornaliero
// per istanza + quota Google lato console come limite vero.
const MAX_PHOTOS_PER_DAY = 100;
const REF_PATTERN = /^places\/[A-Za-z0-9_-]+\/photos\/[A-Za-z0-9_-]+$/;

let counterDay = "";
let counter = 0;

function underDailyCap(): boolean {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== counterDay) {
    counterDay = today;
    counter = 0;
  }
  if (counter >= MAX_PHOTOS_PER_DAY) return false;
  counter++;
  return true;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ref = searchParams.get("ref") ?? "";
  const w = Math.min(Math.max(Number(searchParams.get("w")) || 400, 100), 800);

  if (!REF_PATTERN.test(ref) || ref.length > 600) {
    return NextResponse.json({ error: "Riferimento foto non valido." }, { status: 400 });
  }
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Foto non disponibili." }, { status: 503 });
  }
  if (!underDailyCap()) {
    console.warn("[photo] tetto giornaliero raggiunto: foto sospese");
    return NextResponse.json({ error: "Foto sospese per oggi." }, { status: 429 });
  }

  try {
    // Prima chiamata (a pagamento): ottiene l'indirizzo temporaneo dell'immagine.
    const meta = await fetch(
      `https://places.googleapis.com/v1/${ref}/media?maxWidthPx=${w}&skipHttpRedirect=true&key=${apiKey}`,
    );
    if (!meta.ok) return NextResponse.json({ error: "Foto non disponibile." }, { status: 404 });
    const { photoUri } = (await meta.json()) as { photoUri?: string };
    // Si scarica solo da host di immagini Google (mai un indirizzo arbitrario).
    const host = photoUri ? new URL(photoUri).hostname : "";
    if (!photoUri || !/(^|\.)(googleusercontent\.com|ggpht\.com)$/.test(host)) {
      return NextResponse.json({ error: "Foto non disponibile." }, { status: 404 });
    }
    const res = await fetch(photoUri);
    if (!res.ok || !(res.headers.get("content-type") ?? "").startsWith("image/")) {
      return NextResponse.json({ error: "Foto non disponibile." }, { status: 404 });
    }
    return new Response(res.body, {
      headers: {
        "Content-Type": res.headers.get("content-type") ?? "image/jpeg",
        // 7 giorni in CDN e browser: la stessa foto non viene riscaricata (né ripagata).
        "Cache-Control": "public, max-age=604800, s-maxage=604800, stale-while-revalidate=86400",
      },
    });
  } catch (err) {
    console.error("[photo] errore:", err);
    return NextResponse.json({ error: "Foto non disponibile." }, { status: 502 });
  }
}
