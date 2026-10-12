import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { findOrCreatePlace, type StoredPlace } from "@/lib/places-store";
import {
  extractMapsLinks,
  isGoogleMapsLink,
  isShortMapsLink,
  parseMapsUrl,
  unwrapConsent,
} from "@/lib/maps-link";

// "Salva da Google Maps": l'utente condivide (o incolla) uno o più link di Google Maps.
// Dal link si leggono nome e coordinate; il Place ID arriva da UNA Text Search che chiede
// SOLO l'ID (fascia "IDs Only" del listino Places API New, da ricontrollare: dovrebbe
// essere gratuita). Nessun altro campo a pagamento: indirizzo vuoto, voti e foto si
// caricano come oggi quando si apre il locale.

const MAX_LINKS = 10;
const MAX_HOPS = 3;
const NO_COORDS = "Non riesco a leggere il link: apri il locale in Google Maps e condividi di nuovo.";

type LinkResult = { link: string; place?: StoredPlace; error?: string };

// Segue i link corti (maps.app.goo.gl) leggendo SOLO l'intestazione Location del redirect:
// la pagina non viene mai letta. Si contattano solo maps.app.goo.gl e goo.gl/maps (niente SSRF).
async function resolveShortLink(start: URL): Promise<URL | null> {
  let current = start;
  for (let hop = 0; hop < MAX_HOPS; hop++) {
    if (!isShortMapsLink(current)) return current;
    let res: Response;
    try {
      res = await fetch(current, {
        redirect: "manual",
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      });
    } catch (e) {
      console.warn("[from-link] redirect non raggiungibile:", current.toString(), e);
      return null;
    }
    res.body?.cancel().catch(() => {});
    const location = res.headers.get("location");
    if (res.status < 300 || res.status >= 400 || !location) return null;
    let next: URL;
    try { next = new URL(location, current); } catch { return null; }
    if (!isGoogleMapsLink(next)) {
      console.warn("[from-link] redirect verso host non Google, fermo:", next.hostname);
      return null;
    }
    current = unwrapConsent(next);
  }
  return isShortMapsLink(current) ? null : current;
}

async function findPlaceId(apiKey: string, textQuery: string, lat: number, lng: number): Promise<string | null> {
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      // SOLO l'ID: è la fascia gratuita ("IDs Only"). Non aggiungere campi qui.
      "X-Goog-FieldMask": "places.id",
    },
    body: JSON.stringify({
      textQuery,
      pageSize: 1,
      languageCode: "it",
      locationBias: { circle: { center: { latitude: lat, longitude: lng }, radius: 100 } },
    }),
  });
  if (!res.ok) {
    console.error("[from-link] Text Search (solo ID) errore", res.status, (await res.text()).slice(0, 300));
    throw new Error("google");
  }
  const data: { places?: { id?: string }[] } = await res.json();
  return data.places?.[0]?.id ?? null;
}

// Prima riga del testo condiviso che non è un link: su Android di solito è il nome del locale.
function nameFromSharedText(text: string): string | null {
  const line = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find((l) => l && !/https?:\/\//.test(l));
  return line ? line.slice(0, 120) : null;
}

async function resolveOne(apiKey: string, link: string, fallbackName: string | null): Promise<LinkResult> {
  let url: URL;
  try { url = new URL(link); } catch { return { link, error: NO_COORDS }; }
  const finalUrl = isShortMapsLink(url) ? await resolveShortLink(url) : unwrapConsent(url);
  if (!finalUrl) return { link, error: "Il link non si apre: copialo di nuovo da Google Maps e riprova." };

  const info = parseMapsUrl(finalUrl.toString());
  const name = info.name ?? fallbackName;
  if (info.lat == null || info.lng == null) {
    console.log("[from-link] link senza coordinate:", finalUrl.origin + finalUrl.pathname);
    return { link, error: NO_COORDS };
  }
  if (!name) return { link, error: NO_COORDS };

  let placeId = info.placeId;
  if (!placeId) {
    try {
      placeId = await findPlaceId(apiKey, info.query ?? name, info.lat, info.lng);
    } catch {
      return { link, error: "Google non risponde in questo momento. Riprova tra poco." };
    }
  }
  if (!placeId) return { link, error: `Non trovo "${name}" su Google. Prova con un altro link.` };

  const stored = await findOrCreatePlace(
    { googlePlaceId: placeId, name, address: "", lat: info.lat, lng: info.lng },
    "from-link",
  );
  if ("error" in stored) return { link, error: stored.error };
  return { link, place: stored.place };
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) {
    return NextResponse.json({ error: "Devi accedere per salvare un locale." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text.slice(0, 5000) : "";
  const title = typeof body?.title === "string" ? body.title.trim().slice(0, 120) : "";

  const links = extractMapsLinks(text);
  if (links.length === 0) {
    return NextResponse.json(
      { error: "Non vedo un link di Google Maps. In Google Maps apri il locale, tocca Condividi e poi Copia link." },
      { status: 400 },
    );
  }
  if (links.length > MAX_LINKS) {
    return NextResponse.json(
      { error: `Massimo ${MAX_LINKS} link alla volta: incollane meno e riprova.` },
      { status: 400 },
    );
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    console.error("[from-link] GOOGLE_PLACES_API_KEY non configurata sul server.");
    return NextResponse.json({ error: "Servizio non disponibile in questo momento." }, { status: 500 });
  }

  // Con un solo link il nome può arrivare anche dal titolo o dal testo condiviso.
  const fallbackName = links.length === 1 ? title || nameFromSharedText(text) : null;

  const risultati: LinkResult[] = [];
  for (const link of links) {
    risultati.push(await resolveOne(apiKey, link, fallbackName));
  }
  console.log("[from-link]", risultati.map((r) => (r.place ? `ok ${r.place.google_place_id}` : `errore: ${r.error}`)).join(" | "));

  return NextResponse.json({ risultati });
}
