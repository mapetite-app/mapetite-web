import { cookies } from "next/headers";
import { createClient, getUser } from "@/lib/supabase/server";

// Letture lato server per la pagina di una propria raccolta (/raccolte/<nome>).
// Solo i salvati dell'utente (RLS) e il verdetto già in memoria (place_synthesis, lettura
// pubblica): nessuna chiamata a Google o all'AI.

export type MySavedRow = {
  placeId: string; // UUID Supabase
  googlePlaceId: string | null;
  name: string;
  category: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  tags: string[];
  note: string | null;
  verdict: string | null;
  createdAt: string;
};

type FakePlace = { id: string; name: string; category: string | null; address: string | null; lat?: number; lng?: number; google_place_id?: string; verdict?: string };
type FakeRow = { created_at: string; tags: string[] | null; note: string | null; places: FakePlace | null };

const dev = () => process.env.NODE_ENV === "development" && !!process.env.E2E_FAKE_USER;

// Solo in sviluppo con E2E_FAKE_USER: i salvati finti dal cookie "e2e_profilo" (lo stesso del
// profilo, scritto da scripts/e2e/giro.mjs). In produzione questo ramo non si attiva.
async function fakeSaved(): Promise<FakeRow[] | null> {
  if (!dev()) return null;
  const raw = (await cookies()).get("e2e_profilo")?.value;
  if (!raw) return null;
  try {
    return (JSON.parse(decodeURIComponent(raw)).saved ?? []) as FakeRow[];
  } catch {
    return null;
  }
}

/** Utente collegato (null = nessuno). In sviluppo con E2E_FAKE_USER, l'utente finto. */
export async function myUserId(): Promise<string | null> {
  if (dev()) return (await cookies()).get("e2e_anonimo") ? null : process.env.E2E_FAKE_USER!;
  const { data } = await getUser();
  return data?.user?.id ?? null;
}

/** Tutti i salvati dell'utente, dal più recente, con il verdetto in cache se c'è. */
export async function loadMySaved(userId: string): Promise<MySavedRow[]> {
  const fake = await fakeSaved();
  if (fake) {
    return fake.flatMap((r) =>
      r.places
        ? [{
            placeId: r.places.id, googlePlaceId: r.places.google_place_id ?? null, name: r.places.name,
            category: r.places.category, address: r.places.address, lat: r.places.lat ?? null, lng: r.places.lng ?? null,
            tags: r.tags ?? [], note: r.note, verdict: r.places.verdict ?? null, createdAt: r.created_at,
          }]
        : [],
    );
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("saved_places")
    .select("created_at, tags, note, places (id, name, category, address, lat, lng, google_place_id)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) console.error("[raccolte] lettura saved_places fallita:", error.message);
  type Row = { created_at: string; tags: string[] | null; note: string | null; places: { id: string; name: string; category: string | null; address: string | null; lat: number | null; lng: number | null; google_place_id: string | null } | null };
  const rows = ((data ?? []) as unknown as Row[]).flatMap((r) =>
    r.places
      ? [{
          placeId: r.places.id, googlePlaceId: r.places.google_place_id, name: r.places.name, category: r.places.category,
          address: r.places.address, lat: r.places.lat, lng: r.places.lng, tags: r.tags ?? [], note: r.note,
          verdict: null as string | null, createdAt: r.created_at,
        }]
      : [],
  );
  return rows;
}

/** Aggiunge il verdetto in cache (place_synthesis) ai salvati indicati. Su errore, nessun verdetto. */
export async function withVerdicts(rows: MySavedRow[]): Promise<MySavedRow[]> {
  const ids = rows.filter((r) => !r.verdict && r.googlePlaceId).map((r) => r.googlePlaceId!);
  if (ids.length === 0 || dev()) return rows;
  const supabase = await createClient();
  const { data, error } = await supabase.from("place_synthesis").select("place_id, verdict").in("place_id", ids);
  if (error) {
    console.error("[raccolte] lettura place_synthesis fallita:", error.message);
    return rows;
  }
  const byId = new Map((data ?? []).map((d) => [d.place_id as string, (d.verdict as string | null) ?? null]));
  return rows.map((r) => (r.googlePlaceId && byId.get(r.googlePlaceId) ? { ...r, verdict: byId.get(r.googlePlaceId)! } : r));
}
