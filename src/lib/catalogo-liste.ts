import { createAdminClient } from "@/lib/supabase/admin";
import { cityFromAddress } from "@/lib/city";
import { ilikePattern, pickUnique, type Area, type Candidato } from "@/lib/catalogo-match";

// Proposta 38: posto di una lista di Google cercato nel catalogo di Mapetite (tabella "places") prima
// di spendere una chiamata Google. Solo dati già nostri, nessuna scrittura, ZERO chiamate Google.
// Le regole di corrispondenza sono in catalogo-match.ts (solo locale unico, con Place ID Google).

const LIMIT = 40;
const COLUMNS = "id, name, lat, lng, google_place_id, address";

export type TrovatoNelCatalogo = { id: string; name: string; address: string; lat: number; lng: number };

export async function findInCatalog(name: string, area: Area | null): Promise<TrovatoNelCatalogo | null> {
  const pattern = ilikePattern(name);
  if (!area || !pattern) return null;
  let q = createAdminClient().from("places").select(COLUMNS).ilike("name", `%${pattern}%`);
  if (area.tipo === "box") {
    q = q.gte("lat", area.minLat).lte("lat", area.maxLat).gte("lng", area.minLng).lte("lng", area.maxLng);
  } else {
    // Solo lettere, vocali jolly ("Forlì" ≈ "Forli"): mai caratteri speciali nel filtro.
    const c = area.citta.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[aeiouAEIOU]|[^A-Za-z ]/g, "_").trim();
    if (c.length < 3) return null;
    q = q.ilike("address", `%${c}%`);
  }
  const { data, error } = await q.limit(LIMIT);
  if (error) {
    console.error("[catalogo-liste] lettura:", error.message);
    return null; // nel dubbio, Google
  }
  const rows = (data ?? []) as Candidato[];
  const hit = pickUnique(name, rows, area, cityFromAddress, rows.length < LIMIT);
  return hit ? { id: hit.id, name: hit.name, address: hit.address ?? "", lat: hit.lat, lng: hit.lng } : null;
}
