import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { findOrCreatePlace, findStoredPlace, type StoredPlace } from "@/lib/places-store";
import { isGoogleMapsLink, isShortMapsLink, parseMapsUrl, unwrapConsent } from "@/lib/maps-link";
import { findPlaceId, placeEssentials, resolveShortLink } from "@/lib/maps-resolve";

// "Incolla più link" (piano 3.2): riconosce UN link di Google Maps alla volta, senza salvarlo
// nei salvati (lo fa il telefono dopo il tocco su "Salva i N riconosciuti").
// Il telefono dice quante chiamate Google può spendere ("budget", 0–2): il tetto di 10 per import
// lo tiene lui, oltre il link resta "da confermare" e si riconosce con un tocco, uno per uno.
//
// Costo per link (chiamate che contano nella quota giornaliera di Google):
//  - Place ID nel link, o locale già nel catalogo di Mapetite (stesso nome entro ~150 m): 0
//  - nome e coordinate nel link (il caso normale di "Condividi → Copia link"): 1 Text Search "IDs Only"
//  - solo nome/indirizzo, senza coordinate: 2 (Text Search "IDs Only" + Place Details "Essentials")
//  - solo Place ID, locale mai visto: 1 (Place Details "Essentials")
// Il link corto (maps.app.goo.gl) si apre seguendo il solo redirect: non è un'API e non costa.

type Preview =
  | { stato: "riconosciuto"; chiamate: number; place: { id: string; name: string; address: string } }
  | { stato: "da_confermare"; chiamate: number; motivo: string; nome: string | null }
  | { stato: "non_riconosciuto"; chiamate: number; motivo: string };

const NOT_READABLE = "Non riesco a leggere questo link di Google Maps.";
const GOOGLE_DOWN = "Google non risponde in questo momento: riprova tra poco.";

const ok = (p: StoredPlace, chiamate: number, address?: string): Preview => ({
  stato: "riconosciuto",
  chiamate,
  place: { id: p.id, name: p.name, address: p.address || address || "" },
});
const later = (nome: string | null, chiamate = 0, motivo = "Serve una ricerca su Google: toccalo per riconoscerlo."): Preview =>
  ({ stato: "da_confermare", chiamate, motivo, nome });

// "q=Bar Rossi, Via Roma 1, Roma": il nome è la prima parte, il resto l'indirizzo.
function addressFromQuery(q: string | null): string {
  if (!q) return "";
  const parts = q.split(",").map((s) => s.trim()).filter(Boolean);
  return parts.length > 1 ? parts.slice(1).join(", ").replace(/,\s*Ital(ia|y)$/i, "").slice(0, 300) : "";
}

async function preview(apiKey: string, link: string, budget: number): Promise<Preview> {
  let url: URL;
  try { url = new URL(link); } catch { return { stato: "non_riconosciuto", chiamate: 0, motivo: NOT_READABLE }; }
  const finalUrl = isShortMapsLink(url) ? await resolveShortLink(url) : unwrapConsent(url);
  if (!finalUrl) return { stato: "non_riconosciuto", chiamate: 0, motivo: "Il link non si apre: copialo di nuovo da Google Maps." };

  const info = parseMapsUrl(finalUrl.toString());
  const name = info.name;
  const address = addressFromQuery(info.query);
  const hasCoords = info.lat != null && info.lng != null;
  let calls = 0;

  try {
    // 1. Gratis: Place ID scritto nel link, o locale già nel catalogo.
    const known = await findStoredPlace(info.placeId ? { googlePlaceId: info.placeId } : { name, lat: info.lat, lng: info.lng });
    if (known) return ok(known, 0, address);
    if (info.placeId && hasCoords && name) {
      const stored = await findOrCreatePlace({ googlePlaceId: info.placeId, name, address, lat: info.lat!, lng: info.lng! }, "link-preview");
      return "error" in stored ? later(name, 0, stored.error) : ok(stored.place, 0, address);
    }

    // 2. Nome e coordinate: una Text Search che chiede solo l'ID.
    if (hasCoords && name) {
      if (budget < 1) return later(name);
      calls = 1;
      const id = await findPlaceId(apiKey, info.query ?? name, info.lat!, info.lng!);
      if (!id) return { stato: "non_riconosciuto", chiamate: calls, motivo: `Non trovo "${name}" su Google.` };
      const stored = await findOrCreatePlace({ googlePlaceId: id, name, address, lat: info.lat!, lng: info.lng! }, "link-preview");
      return "error" in stored ? later(name, calls, stored.error) : ok(stored.place, calls, address);
    }

    // 3. Senza coordinate: ID (se manca) e poi posizione, nome e indirizzo da Place Details.
    const text = info.query ?? name;
    if (!text && !info.placeId) return { stato: "non_riconosciuto", chiamate: 0, motivo: NOT_READABLE };
    const needed = info.placeId ? 1 : 2;
    if (budget < needed) return later(name ?? text);
    let id = info.placeId;
    if (!id) {
      calls++;
      id = await findPlaceId(apiKey, text!);
      if (!id) return { stato: "non_riconosciuto", chiamate: calls, motivo: `Non trovo "${name ?? text}" su Google.` };
      const again = await findStoredPlace({ googlePlaceId: id });
      if (again) return ok(again, calls, address);
    }
    calls++;
    const full = await placeEssentials(apiKey, id);
    if (!full) return { stato: "non_riconosciuto", chiamate: calls, motivo: NOT_READABLE };
    const stored = await findOrCreatePlace(
      { googlePlaceId: id, name: full.name ?? name ?? text!, address: full.address, lat: full.lat, lng: full.lng },
      "link-preview",
    );
    return "error" in stored ? later(name ?? text, calls, stored.error) : ok(stored.place, calls);
  } catch {
    return later(name, calls, GOOGLE_DOWN);
  }
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) {
    return NextResponse.json({ error: "Devi accedere per salvare i locali." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const link = typeof body?.link === "string" ? body.link.trim().slice(0, 2000) : "";
  const budget = Math.max(0, Math.min(2, Math.floor(Number(body?.budget) || 0)));
  let url: URL | null = null;
  try { url = new URL(link); } catch { /* sotto */ }
  if (!url || !isGoogleMapsLink(url)) {
    return NextResponse.json({ error: "Non è un link di Google Maps." }, { status: 400 });
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    console.error("[link-preview] GOOGLE_PLACES_API_KEY non configurata sul server.");
    return NextResponse.json({ error: "Servizio non disponibile in questo momento." }, { status: 500 });
  }

  const out = await preview(apiKey, link, budget);
  console.log("[link-preview]", out.stato, `chiamate=${out.chiamate}`, out.stato === "riconosciuto" ? "" : out.motivo);
  return NextResponse.json(out);
}
