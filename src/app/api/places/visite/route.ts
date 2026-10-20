import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// "Chi ci è stato, su Mapetite" (PROBLEMI.md 3, recensioni e fiducia): quante persone hanno segnato il
// locale come visitato e quante hanno detto 👍, SEMPRE aggregato. Sotto le 3 persone non si dice niente
// (si riconoscerebbe chi ha risposto). Legge saved_places con la chiave di servizio, solo dal server.
// GET ?id=<UUID o Place ID Google> → { persone, piaciuto }. Nessuna chiamata a Google.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VUOTO = { persone: 0, piaciuto: 0 };
const SOGLIA = 3;
const CACHE = { headers: { "Cache-Control": "public, max-age=300" } };

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id")?.trim() ?? "";
  if (!/^[A-Za-z0-9_-]{2,200}$/.test(id)) return NextResponse.json(VUOTO, CACHE);
  try {
    const db = createAdminClient();
    let uuid = UUID_RE.test(id) ? id : null;
    if (!uuid) {
      const { data } = await db.from("places").select("id").eq("google_place_id", id).limit(1).maybeSingle<{ id: string }>();
      uuid = data?.id ?? null;
    }
    if (!uuid) return NextResponse.json(VUOTO, CACHE);
    const { data, error } = await db.from("saved_places").select("user_id,tags").eq("place_id", uuid).contains("tags", ["Già visitato"]).limit(2000);
    if (error) { console.error("[visite] lettura:", error.message); return NextResponse.json(VUOTO, CACHE); }
    const chi = new Set<string>();
    const su = new Set<string>();
    for (const r of (data ?? []) as { user_id: string; tags: string[] | null }[]) {
      chi.add(r.user_id);
      if ((r.tags ?? []).includes("Mi è piaciuto")) su.add(r.user_id);
    }
    if (chi.size < SOGLIA) return NextResponse.json(VUOTO, CACHE);
    return NextResponse.json({ persone: chi.size, piaciuto: su.size }, CACHE);
  } catch (err) {
    console.error("[visite] errore:", err instanceof Error ? err.message : err);
    return NextResponse.json(VUOTO, CACHE);
  }
}
