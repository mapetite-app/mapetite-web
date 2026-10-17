import { NextResponse } from "next/server";
import { viewerId } from "@/lib/social";
import { fotoMie } from "@/lib/foto-utenti-server";
import { UUID_RE } from "@/lib/foto-utenti";

// Le proprie foto di un locale (piano 4.4), per il foglio "Com'è andata?" aperto dalla scheda.
// GET ?place=<UUID Supabase>. Risponde sempre 200: { foto: [], pronte } se non c'è niente.
// "pronte" = false finché la migrazione 20261017_foto_utenti non è applicata (niente pulsante).
const NO_STORE = { headers: { "Cache-Control": "private, no-store" } };

export async function GET(request: Request) {
  const place = new URL(request.url).searchParams.get("place")?.trim() ?? "";
  const user = await viewerId();
  if (!user || !UUID_RE.test(place)) return NextResponse.json({ foto: [], pronte: false }, NO_STORE);
  try {
    const { foto, pronte } = await fotoMie(user, [place]);
    return NextResponse.json({ foto: foto.get(place) ?? [], pronte }, NO_STORE);
  } catch (err) {
    console.error("[foto] lettura fallita:", err instanceof Error ? err.message : err);
    return NextResponse.json({ foto: [], pronte: false }, NO_STORE);
  }
}
