import { NextResponse } from "next/server";
import { EMPTY_COMMUNITY as EMPTY, loadCommunity } from "@/lib/community";

// "Dalla community Mapetite" nella scheda del locale (piani 5.6c e 5.6d): recensioni degli utenti
// e reel collegati al locale. GET ?id=<UUID Supabase o Place ID Google>.
// Risponde sempre 200: sezione vuota se non c'è niente (o se le letture falliscono).
// Nessuna chiamata a Google: solo Supabase, con le regole di privacy di src/lib/community.ts.

const NO_STORE = { headers: { "Cache-Control": "private, no-store" } };

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id")?.trim() ?? "";
  if (!/^[A-Za-z0-9_-]{2,200}$/.test(id)) return NextResponse.json(EMPTY, NO_STORE);
  try {
    return NextResponse.json(await loadCommunity(id), NO_STORE);
  } catch (err) {
    console.error("[community] lettura fallita:", err instanceof Error ? err.message : err);
    return NextResponse.json(EMPTY, NO_STORE);
  }
}
