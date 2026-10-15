import { NextResponse } from "next/server";
import { loadFriendsAtAnyPlace } from "@/lib/social";

// "Chi dei tuoi amici c'è stato" nella scheda della mappa (piano 6.2): stessa lettura della
// pagina pubblica del locale (src/lib/social.ts, solo viste pubbliche e propri follow).
// GET ?id=<UUID Supabase o Place ID Google>. Risponde sempre 200: { amici: null } se non c'è
// niente da mostrare (nessun accesso, nessun amico, migrazione social non applicata).
// Si restituiscono solo i campi che servono a disegnare la riga: mai tag o note.

type Person = { user_id: string; handle: string; display_name: string | null };
const slim = (p: Person): Person => ({ user_id: p.user_id, handle: p.handle, display_name: p.display_name });
const NO_STORE = { headers: { "Cache-Control": "private, no-store" } };

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id")?.trim() ?? "";
  if (!/^[A-Za-z0-9_-]{2,200}$/.test(id)) return NextResponse.json({ amici: null }, NO_STORE);
  try {
    const friends = await loadFriendsAtAnyPlace(id);
    const amici = friends ? { visitati: friends.visitati.map(slim), daProvare: friends.daProvare.map(slim) } : null;
    return NextResponse.json({ amici }, NO_STORE);
  } catch (err) {
    console.error("[amici] lettura fallita:", err instanceof Error ? err.message : err);
    return NextResponse.json({ amici: null }, NO_STORE);
  }
}
