import { cookies } from "next/headers";
import { createClient, getUser } from "@/lib/supabase/server";
import type { CartaRow } from "@/lib/carta-gusto";

type PlaceJoin = { category: string | null; address: string | null; poco_conosciuto?: boolean | null };
type SavedJoin = { tags: string[] | null; places: PlaceJoin | null; fuori_gusti?: boolean | null };

// Proposta 66: i posti "Non contarlo nei miei gusti" non entrano nella carta del gusto (tipi, titolo, gemme, totale).
const toRows = (data: SavedJoin[]): CartaRow[] =>
  data.flatMap((r) => (r.places && r.fuori_gusti !== true ? [{ category: r.places.category, address: r.places.address, tags: r.tags, pocoConosciuto: r.places.poco_conosciuto ?? null }] : []));

// I salvati dell'utente per la carta del gusto (pagina e immagine). null = nessun accesso.
// Solo in sviluppo con E2E_FAKE_USER: dati finti dal cookie "e2e_profilo" (come /profilo).
export async function loadCartaRows(): Promise<CartaRow[] | null> {
  if (process.env.NODE_ENV === "development" && process.env.E2E_FAKE_USER) {
    const raw = (await cookies()).get("e2e_profilo")?.value;
    if (raw) {
      try {
        const data = JSON.parse(decodeURIComponent(raw)) as { saved?: SavedJoin[] };
        return toRows(data.saved ?? []);
      } catch {
        return [];
      }
    }
  }
  const { data: userData } = await getUser();
  const user = userData?.user;
  if (!user) return null;
  const supabase = await createClient();
  // fuori_gusti (proposta 66, migrazione 20261118_fuori_gusti): senza la colonna si rilegge come prima.
  const zero = await supabase.from("saved_places").select("fuori_gusti, tags, places (category, address, poco_conosciuto)").eq("user_id", user.id);
  if (!zero.error) return toRows((zero.data ?? []) as unknown as SavedJoin[]);
  const first = await supabase.from("saved_places").select("tags, places (category, address, poco_conosciuto)").eq("user_id", user.id);
  if (!first.error) return toRows((first.data ?? []) as unknown as SavedJoin[]);
  // Colonna poco_conosciuto assente (migrazione 20261016_scopritori non applicata): si legge senza.
  console.error(`[carta-gusto] ${first.error.code ?? ""} ${first.error.message} (riprovo senza poco_conosciuto)`);
  const second = await supabase.from("saved_places").select("tags, places (category, address)").eq("user_id", user.id);
  if (second.error) {
    console.error(`[carta-gusto] lettura salvati fallita: ${second.error.message}`);
    return [];
  }
  return toRows((second.data ?? []) as unknown as SavedJoin[]);
}
