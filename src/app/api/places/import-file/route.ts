import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { findOrCreateImportedPlace, findOrCreatePlace } from "@/lib/places-store";

// Import in blocco da un file di Google Takeout / My Maps (piano 3.2). Il file l'ha letto il telefono:
// qui arrivano solo nome, indirizzo e coordinate dei posti scelti, a gruppi di MAX_ITEMS.
// Costo Google: ZERO chiamate. Si crea (o si ritrova) il locale nel catalogo; i salvati li scrive
// il telefono (saved_places con le regole RLS), come negli altri import.

const MAX_ITEMS = 40;
const PLACE_ID = /^ChIJ[A-Za-z0-9_-]{10,290}$/;

type In = { name: string; address: string; lat: number; lng: number; googlePlaceId: string | null };

function valid(x: unknown): In | null {
  const o = x as Record<string, unknown> | null;
  if (!o || typeof o.name !== "string" || typeof o.lat !== "number" || typeof o.lng !== "number") return null;
  const name = o.name.trim();
  const address = typeof o.address === "string" ? o.address.trim() : "";
  if (!name || name.length > 200 || address.length > 300) return null;
  if (!Number.isFinite(o.lat) || !Number.isFinite(o.lng) || Math.abs(o.lat) > 90 || Math.abs(o.lng) > 180 || (o.lat === 0 && o.lng === 0)) return null;
  const gid = typeof o.googlePlaceId === "string" && PLACE_ID.test(o.googlePlaceId) ? o.googlePlaceId : null;
  return { name, address, lat: o.lat, lng: o.lng, googlePlaceId: gid };
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) return NextResponse.json({ error: "Devi accedere per importare i tuoi posti." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const list = Array.isArray(body?.items) ? (body.items as unknown[]) : [];
  if (list.length === 0 || list.length > MAX_ITEMS) {
    return NextResponse.json({ error: `Da 1 a ${MAX_ITEMS} posti alla volta.` }, { status: 400 });
  }

  const risultati: ({ id: string } | { error: string })[] = new Array(list.length);
  let next = 0;
  let created = 0;
  const worker = async () => {
    while (next < list.length) {
      const i = next++;
      const it = valid(list[i]);
      if (!it) { risultati[i] = { error: "Dati del posto non validi." }; continue; }
      const r = it.googlePlaceId
        ? await findOrCreatePlace({ googlePlaceId: it.googlePlaceId, name: it.name, address: it.address, lat: it.lat, lng: it.lng }, "import-file")
        : await findOrCreateImportedPlace(it);
      if ("error" in r) risultati[i] = { error: r.error };
      else { risultati[i] = { id: r.place.id }; if (r.created) created++; }
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
  console.log(`[import-file] ${list.length} posti, ${created} nuovi nel catalogo, 0 chiamate Google`);
  return NextResponse.json({ risultati });
}
