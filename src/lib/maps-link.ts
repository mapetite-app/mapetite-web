// Lettura dei link di Google Maps condivisi dall'utente ("Condividi" → "Copia link").
// Solo l'indirizzo del link: non si apre mai la pagina di Google (niente scraping).
// Funzioni pure, senza dipendenze: provate da scripts/e2e/maps-link.mjs.

export type MapsLinkInfo = {
  name: string | null;
  lat: number | null;
  lng: number | null;
  placeId: string | null; // Google Place ID ("ChIJ..."), solo se scritto nel link
  query: string | null; // testo "q=" del link (nome e indirizzo), se c'è
};

// Link corti da seguire (redirect): solo questi host vengono contattati dal server.
const SHORT_HOSTS = new Set(["maps.app.goo.gl", "goo.gl"]);

export function isShortMapsLink(u: URL): boolean {
  if (u.protocol !== "https:" || !SHORT_HOSTS.has(u.hostname)) return false;
  // goo.gl è stato chiuso per tutto tranne i link di Maps (goo.gl/maps/...).
  return u.hostname === "maps.app.goo.gl" || u.pathname.startsWith("/maps");
}

// google.com, google.it, maps.google.com, www.google.co.uk... (mai "google.com.evil.net").
function isGoogleHost(host: string): boolean {
  return /^(?:[a-z0-9-]+\.)*google\.(?:com|[a-z]{2,3}|com?\.[a-z]{2})$/.test(host);
}

export function isGoogleMapsLink(u: URL): boolean {
  if (u.protocol !== "https:" && u.protocol !== "http:") return false;
  if (isShortMapsLink(u)) return true;
  if (!isGoogleHost(u.hostname)) return false;
  return u.hostname.startsWith("maps.") || u.pathname.startsWith("/maps") || u.hostname.startsWith("consent.");
}

// Tutti i link Google Maps nel testo condiviso (anche più di uno, uno per riga), senza doppioni.
export function extractMapsLinks(text: string): string[] {
  const found: string[] = [];
  for (const m of text.matchAll(/https?:\/\/[^\s<>"']+/g)) {
    const raw = m[0].replace(/[),.;!?]+$/, "");
    let u: URL;
    try { u = new URL(raw); } catch { continue; }
    if (!isGoogleMapsLink(u)) continue;
    if (!found.includes(u.toString())) found.push(u.toString());
  }
  return found;
}

// Pagina di consenso dei cookie (Europa): il link vero è nel parametro "continue".
export function unwrapConsent(u: URL): URL {
  if (!u.hostname.startsWith("consent.")) return u;
  const next = u.searchParams.get("continue");
  if (!next) return u;
  try {
    const inner = new URL(next);
    return isGoogleMapsLink(inner) ? inner : u;
  } catch {
    return u;
  }
}

function validCoords(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);
}

const COORD_PAIR = /^\s*(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)\s*$/;
const PLACE_ID = /^[A-Za-z0-9_-]{16,}$/;

function decode(s: string): string {
  try { return decodeURIComponent(s.replace(/\+/g, " ")); } catch { return s.replace(/\+/g, " "); }
}

export function parseMapsUrl(input: string): MapsLinkInfo {
  const info: MapsLinkInfo = { name: null, lat: null, lng: null, placeId: null, query: null };
  let u: URL;
  try { u = unwrapConsent(new URL(input)); } catch { return info; }
  const href = u.toString();

  // Nome: /maps/place/<Nome>/...
  const placeSeg = u.pathname.match(/\/maps\/place\/([^/]+)/);
  if (placeSeg) {
    const name = decode(placeSeg[1]).trim();
    if (name && !COORD_PAIR.test(name)) info.name = name;
  }

  // Coordinate: !3d<lat>!4d<lng> (il punto del locale) prima di @lat,lng (il centro della mappa).
  const pin = [...href.matchAll(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/g)].at(-1);
  if (pin && validCoords(+pin[1], +pin[2])) {
    info.lat = +pin[1]; info.lng = +pin[2];
  } else {
    const at = href.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
    if (at && validCoords(+at[1], +at[2])) { info.lat = +at[1]; info.lng = +at[2]; }
  }

  const params = u.searchParams;
  const q = params.get("q") ?? params.get("query");
  if (q) {
    const pair = q.match(COORD_PAIR);
    if (pair) {
      if (info.lat == null && validCoords(+pair[1], +pair[2])) { info.lat = +pair[1]; info.lng = +pair[2]; }
    } else if (q.startsWith("place_id:")) {
      const id = q.slice("place_id:".length);
      if (PLACE_ID.test(id)) info.placeId = id;
    } else {
      info.query = q.trim();
      if (!info.name) info.name = q.split(",")[0].trim() || null;
    }
  }
  const ll = params.get("ll")?.match(COORD_PAIR);
  if (ll && info.lat == null && validCoords(+ll[1], +ll[2])) { info.lat = +ll[1]; info.lng = +ll[2]; }

  const qpid = params.get("query_place_id");
  if (qpid && PLACE_ID.test(qpid)) info.placeId = qpid;

  return info;
}
