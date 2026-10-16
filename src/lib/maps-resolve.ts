import { isGoogleMapsLink, isShortMapsLink, unwrapConsent } from "@/lib/maps-link";

// Chiamate verso Google per i link di Google Maps, condivise da /api/places/from-link (un link
// alla volta o pochi insieme) e /api/places/link-preview ("Incolla più link"). Solo server.
// Costo: resolveShortLink = 0 (segue il solo redirect, nessuna API); findPlaceId = 1 Text Search
// "IDs Only"; placeEssentials = 1 Place Details "Essentials". Ognuna conta nella quota giornaliera.

const MAX_HOPS = 3;

// Segue i link corti (maps.app.goo.gl) leggendo SOLO l'intestazione Location del redirect:
// la pagina non viene mai letta. Si contattano solo maps.app.goo.gl e goo.gl/maps (niente SSRF).
export async function resolveShortLink(start: URL): Promise<URL | null> {
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

// Link senza coordinate ("?q=Nome,+Indirizzo&ftid=…", decisione 10 del backlog, 15/10): dopo l'ID
// (gratuito) si chiedono a Place Details SOLO posizione, nome e indirizzo, fascia "Essentials"
// (10.000 gratuite al mese, poi ~5 $ ogni 1.000). Conta 1 nella quota Place Details (50/giorno).
export async function placeEssentials(apiKey: string, placeId: string): Promise<{ name: string | null; address: string; lat: number; lng: number } | null> {
  const res = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?languageCode=it`, {
    headers: {
      "X-Goog-Api-Key": apiKey,
      // Solo campi Essentials. Non aggiungere campi qui.
      "X-Goog-FieldMask": "id,displayName,formattedAddress,location",
    },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) {
    console.error("[from-link] Place Details (Essentials) errore", res.status, (await res.text()).slice(0, 300));
    throw new Error("google");
  }
  const d: { displayName?: { text?: string }; formattedAddress?: string; location?: { latitude?: number; longitude?: number } } = await res.json();
  const lat = d.location?.latitude;
  const lng = d.location?.longitude;
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  return {
    name: d.displayName?.text?.trim() || null,
    address: (d.formattedAddress ?? "").replace(/,\s*Ital(ia|y)$/i, ""),
    lat,
    lng,
  };
}

export async function findPlaceId(apiKey: string, textQuery: string, lat?: number, lng?: number): Promise<string | null> {
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
      ...(lat != null && lng != null
        ? { locationBias: { circle: { center: { latitude: lat, longitude: lng }, radius: 100 } } }
        : {}),
    }),
  });
  if (!res.ok) {
    console.error("[from-link] Text Search (solo ID) errore", res.status, (await res.text()).slice(0, 300));
    throw new Error("google");
  }
  const data: { places?: { id?: string }[] } = await res.json();
  return data.places?.[0]?.id ?? null;
}
