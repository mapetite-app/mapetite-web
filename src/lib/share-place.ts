"use client";

import { firmaPer } from "@/lib/catalog-firme";

// "Condividi" nella scheda: manda il link Mapetite del locale (/locali/<UUID>), così chi lo riceve
// vede il verdetto e può salvarlo in Mapetite. I salvati hanno già l'UUID come id; per i risultati
// di ricerca (id = Google Place ID) la riga in "places" si crea o si ritrova con /api/places/add
// (nessuna chiamata a Google: scrive solo fatti già noti). Se non si riesce (es. utente non
// collegato) si torna al link di Google Maps.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type ShareablePlace = {
  id: string; name: string; address: string | null; lat: number; lng: number;
  category: string | null; rating: number | null; priceLevel: number | null; photoRef?: string | null;
};

// Risultati già risolti in questa sessione: il secondo tocco su Condividi non rifà la richiesta.
const known = new Map<string, string>();

async function placeUuid(p: ShareablePlace): Promise<string | null> {
  if (UUID_RE.test(p.id)) return p.id;
  const cached = known.get(p.id);
  if (cached) return cached;
  try {
    const res = await fetch("/api/places/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        googlePlaceId: p.id, name: p.name, address: p.address ?? "", lat: p.lat, lng: p.lng,
        category: p.category, rating: p.rating, priceLevel: p.priceLevel,
        firma: firmaPer(p.id),
      }),
    });
    const data = await res.json().catch(() => ({}));
    const uuid = res.ok && typeof data?.place?.id === "string" && UUID_RE.test(data.place.id) ? (data.place.id as string) : null;
    if (uuid) known.set(p.id, uuid);
    return uuid;
  } catch {
    return null;
  }
}

/** Link Mapetite del locale (con la foto, se c'è), oppure null se non si può creare. */
export async function mapetiteShareUrl(p: ShareablePlace): Promise<string | null> {
  const uuid = await placeUuid(p);
  if (!uuid) return null;
  // Le "/" del riferimento restano leggibili: sono valide in un parametro dell'indirizzo.
  const foto = p.photoRef ? `?foto=${encodeURIComponent(p.photoRef).replace(/%2F/g, "/")}` : "";
  return `${window.location.origin}/locali/${uuid}${foto}`;
}
