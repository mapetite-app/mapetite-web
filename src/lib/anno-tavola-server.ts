import { cookies } from "next/headers";
import { createClient, getUser } from "@/lib/supabase/server";
import { cleanDate } from "@/lib/diario";
import type { AnnoRow } from "@/lib/anno-tavola";

// Lettura per "Il tuo anno a tavola" (proposta 49): i salvati dell'utente con data della visita, numero di
// visite e posizione del locale. Una sola lettura; se una colonna nuova manca si rilegge senza.
type PlaceJoin = { id: string; name: string; category: string | null; address: string | null; lat?: number | null; lng?: number | null; poco_conosciuto?: boolean | null };
type Raw = { created_at: string; tags: string[] | null; visite?: number | null; visited_at?: string | null; places: PlaceJoin | null };

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v)) ? Number(v) : null);

const toRows = (data: Raw[]): AnnoRow[] =>
  data.flatMap((r) =>
    r.places
      ? [{
          id: r.places.id,
          name: r.places.name,
          category: r.places.category,
          address: r.places.address,
          lat: num(r.places.lat),
          lng: num(r.places.lng),
          pocoConosciuto: r.places.poco_conosciuto ?? null,
          tags: r.tags ?? [],
          visite: num(r.visite),
          visitedAt: cleanDate(r.visited_at),
          createdAt: r.created_at,
        }]
      : [],
  );

/** null = nessun accesso. Solo in sviluppo con E2E_FAKE_USER: dati finti dal cookie "e2e_profilo" (come /profilo). */
export async function loadAnnoRows(): Promise<AnnoRow[] | null> {
  if (process.env.NODE_ENV === "development" && process.env.E2E_FAKE_USER) {
    const store = await cookies();
    if (store.get("e2e_anonimo")) return null;
    const raw = store.get("e2e_profilo")?.value;
    if (raw) {
      try {
        return toRows(((JSON.parse(decodeURIComponent(raw)) as { saved?: Raw[] }).saved ?? []).map((r) => ({ ...r, created_at: r.created_at ?? new Date().toISOString() })));
      } catch {
        return [];
      }
    }
  }
  const { data: userData } = await getUser();
  const user = userData?.user;
  if (!user) return null;
  const supabase = await createClient();
  const pieno = await supabase
    .from("saved_places")
    .select("created_at, tags, visite, visited_at, places (id, name, category, address, lat, lng, poco_conosciuto)")
    .eq("user_id", user.id);
  if (!pieno.error) return toRows((pieno.data ?? []) as unknown as Raw[]);
  console.error(`[anno-tavola] ${pieno.error.code ?? ""} ${pieno.error.message} (riprovo con le colonne di base)`);
  const base = await supabase.from("saved_places").select("created_at, tags, places (id, name, category, address, lat, lng)").eq("user_id", user.id);
  if (base.error) {
    console.error(`[anno-tavola] lettura salvati fallita: ${base.error.message}`);
    return [];
  }
  return toRows((base.data ?? []) as unknown as Raw[]);
}
