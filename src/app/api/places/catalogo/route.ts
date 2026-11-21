import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { cityFromAddress } from "@/lib/city";
import { parseMapsUrl } from "@/lib/maps-link";
import { areaFor, type Punto } from "@/lib/catalogo-match";
import { findInCatalog, type TrovatoNelCatalogo } from "@/lib/catalogo-liste";

// Proposta 38: i posti di UNA lista di Google senza posizione (.csv di Takeout) cercati nel catalogo di
// Mapetite, prima di Google. Arrivano nome e link di ogni posto, più la zona della lista: la città nel suo
// nome e i posti della stessa lista già con la posizione. Si risponde con il locale solo se nella zona
// ce n'è uno soltanto con quel nome; per gli altri null, e il telefono passa a Google come prima.
// Costo Google: ZERO chiamate. Nessuna scrittura nel catalogo.

const MAX_ITEMS = 40;
const MAX_PUNTI = 30;

function punti(x: unknown): Punto[] {
  if (!Array.isArray(x)) return [];
  return x.slice(0, MAX_PUNTI).flatMap((p) => {
    const o = p as { lat?: unknown; lng?: unknown } | null;
    const lat = Number(o?.lat), lng = Number(o?.lng);
    return typeof o?.lat === "number" && typeof o?.lng === "number" && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0) ? [{ lat, lng }] : [];
  });
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
  const citta = typeof body?.citta === "string" ? body.citta.trim().slice(0, 60) : null;
  const vicini = punti(body?.punti);
  const listArea = areaFor({ citta, punti: vicini });

  const risultati: (TrovatoNelCatalogo | null)[] = new Array(list.length).fill(null);
  let next = 0;
  const worker = async () => {
    while (next < list.length) {
      const i = next++;
      const o = list[i] as { name?: unknown; url?: unknown } | null;
      const name = typeof o?.name === "string" ? o.name.trim().slice(0, 200) : "";
      if (!name) continue;
      // Città scritta nel link ("q=Nome, Via …, 00186 Roma"): vale più della zona della lista.
      const query = typeof o?.url === "string" ? parseMapsUrl(o.url.slice(0, 2000)).query : null;
      const rigaCitta = query && query.includes(",") ? cityFromAddress(query.split(",").slice(1).join(",")) : null;
      const area = rigaCitta ? areaFor({ citta: rigaCitta }) : listArea;
      try {
        risultati[i] = await findInCatalog(name, area);
      } catch {
        risultati[i] = null; // nel dubbio, Google
      }
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
  const trovati = risultati.filter(Boolean).length;
  console.log(`[catalogo] ${list.length} posti di una lista, ${trovati} trovati nel catalogo (zona: ${listArea ? listArea.tipo : "nessuna"}), 0 chiamate Google`);
  return NextResponse.json({ risultati });
}
