import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { fotoUrl, isMissingFoto, type FotoCommunity, type FotoUtente } from "@/lib/foto-utenti";

// Lettura delle foto degli utenti (piani 4.4 e 5.6c). Le proprie con la sessione dell'utente
// (RLS: solo le sue); quelle degli altri dalla vista foto_pubbliche (solo pubbliche, autore solo
// se il profilo è pubblico). Le immagini si scaricano da /api/foto-utenti/<id>.

// ── Test automatico ──────────────────────────────────────────────────────────
// Solo in sviluppo con E2E_FAKE_USER: le proprie foto dal cookie "e2e_foto" ({ <place_id>: FotoUtente[] },
// scritto da scripts/e2e/giro.mjs). Senza cookie nessuna foto e nessuna lettura verso Supabase.
const dev = () => process.env.NODE_ENV === "development" && !!process.env.E2E_FAKE_USER;

async function fakeMine(): Promise<Record<string, FotoUtente[]> | null> {
  if (!dev()) return null;
  const raw = (await cookies()).get("e2e_foto")?.value;
  if (!raw) return {};
  try {
    const data = JSON.parse(decodeURIComponent(raw));
    return data && typeof data === "object" ? (data as Record<string, FotoUtente[]>) : {};
  } catch {
    return {};
  }
}

export type FotoMie = { foto: Map<string, FotoUtente[]>; pronte: boolean };

/** Foto dell'utente, per locale (dal più vecchio, così la copertina non cambia aggiungendone). */
export async function fotoMie(userId: string, placeIds?: string[]): Promise<FotoMie> {
  const fake = await fakeMine();
  if (fake) {
    const map = new Map(Object.entries(fake).filter(([id]) => !placeIds || placeIds.includes(id)));
    return { foto: map, pronte: true };
  }
  if (placeIds && placeIds.length === 0) return { foto: new Map(), pronte: true };
  const supabase = await createClient();
  let q = supabase.from("foto_locali").select("id, place_id, pubblica").eq("user_id", userId).order("created_at", { ascending: true }).limit(600);
  if (placeIds) q = q.in("place_id", placeIds.slice(0, 300));
  const { data, error } = await q;
  if (error) {
    if (!isMissingFoto(error)) console.error("[foto] lettura foto proprie:", error.message);
    return { foto: new Map(), pronte: !isMissingFoto(error) };
  }
  const map = new Map<string, FotoUtente[]>();
  for (const r of (data ?? []) as { id: string; place_id: string; pubblica: boolean }[]) {
    const list = map.get(r.place_id) ?? [];
    list.push({ id: r.id, url: fotoUrl(r.id), pubblica: r.pubblica });
    map.set(r.place_id, list);
  }
  return { foto: map, pronte: true };
}

type PubRow = { id: string; user_id: string | null; handle: string | null; display_name: string | null; mia: boolean | null };

/** Foto pubbliche degli ALTRI sul locale (le proprie si leggono con fotoMie). */
export async function fotoPubbliche(placeId: string): Promise<FotoCommunity[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("foto_pubbliche")
    .select("id, user_id, handle, display_name, mia")
    .eq("place_id", placeId)
    .order("created_at", { ascending: false })
    .limit(24);
  if (error) {
    if (!isMissingFoto(error)) console.error("[foto] lettura foto pubbliche:", error.message);
    return [];
  }
  return ((data ?? []) as PubRow[])
    .filter((r) => !r.mia)
    .map((r) => ({
      id: r.id,
      url: fotoUrl(r.id),
      autore: r.user_id && r.handle ? { user_id: r.user_id, handle: r.handle, display_name: r.display_name } : null,
    }));
}
