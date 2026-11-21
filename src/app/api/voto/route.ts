import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyCatalogEntry } from "@/lib/catalog-sig";
import { findOrCreatePlace } from "@/lib/places-store";
import { clientKey } from "@/lib/ai-limit";
import { chiusura, isScelta, UUID_RE } from "@/lib/voto-gruppo";
import { creaVoto, permesso, type PostoInArrivo } from "@/lib/voto-gruppo-server";

// "Manda al gruppo" (proposta 56): chi ha un account crea il sondaggio con i 2-3 posti di "Scegli tra 3".
// I posti diventano UUID del catalogo "places" (gli stessi dei salvati): un salvato ha già l'UUID; un
// risultato di ricerca entra nel catalogo con i dati FIRMATI dal server (src/lib/catalog-sig.ts), come
// "Condividi" della scheda. Nessuna chiamata a Google o all'AI. Tetti: 10 sondaggi in 24 ore per persona
// (nel database, atomico) e il limitatore per indirizzo IP.

const ID_RE = /^[A-Za-z0-9_-]{2,300}$/;
const err = (status: number, error: string) => NextResponse.json({ error }, { status });
const str = (v: unknown, max: number): string | null => (typeof v === "string" && v.trim() !== "" ? v.trim().slice(0, max) : null);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { posti?: unknown; scelta?: unknown } | null;
  const lista = Array.isArray(body?.posti) ? (body.posti as Record<string, unknown>[]).slice(0, 4) : [];
  const ids = [...new Set(lista.map((p) => (typeof p?.id === "string" ? p.id : "")).filter((id) => ID_RE.test(id)))];
  if (ids.length < 2 || ids.length > 3) return err(400, "Servono 2 o 3 posti.");
  if (!isScelta(body?.scelta)) return err(400, "Scegli quando si chiude.");
  const chiude = chiusura(body.scelta);
  if (!chiude) return err(400, "Quell'ora è già passata: scegline un'altra.");

  const jar = await cookies();
  const dev = process.env.NODE_ENV === "development" && process.env.E2E_FAKE_USER ? process.env.E2E_FAKE_USER : null;
  let utente: string | null = null;
  if (dev) utente = jar.get("e2e_anonimo") ? null : dev;
  else {
    const { data } = await (await createClient()).auth.getUser();
    utente = data?.user?.id ?? null;
  }
  if (!utente) return err(401, "Accedi per mandarlo al gruppo.");
  if (!permesso("crea", clientKey(request))) return err(429, "Troppi link in poco tempo: riprova più tardi.");

  // Giro automatico: niente database, i posti restano in memoria con quello che manda il telefono.
  if (dev) {
    const finti: PostoInArrivo[] = ids.map((id) => {
      const p = lista.find((x) => x?.id === id) ?? {};
      return { id, nome: str(p.nome, 120) ?? "Locale", categoria: str(p.categoria, 80), indirizzo: str(p.indirizzo, 300), lat: num(p.lat), lng: num(p.lng), verdetto: str(p.verdetto, 400) };
    });
    const codice = await creaVoto(utente, ids, chiude, finti);
    if (codice === "troppi") return err(429, "Hai già creato 10 voti oggi: riprova domani.");
    if (codice === "errore") return err(500, "Non sono riuscito a creare il link. Riprova.");
    return NextResponse.json({ codice, posti: ids.map((id) => ({ id, uuid: id })), chiudeAlle: chiude.toISOString() });
  }

  // Dal Place ID (o UUID) all'UUID del catalogo, senza mai scrivere dati non firmati.
  const admin = createAdminClient();
  const uuidDi = new Map<string, string>();
  const uuids = ids.filter((id) => UUID_RE.test(id));
  if (uuids.length > 0) {
    const { data, error } = await admin.from("places").select("id").in("id", uuids);
    if (error) { console.error(`[voto] lettura catalogo ${error.message}`); return err(500, "Non sono riuscito a creare il link. Riprova."); }
    for (const r of (data ?? []) as { id: string }[]) uuidDi.set(r.id, r.id);
  }
  for (const id of ids.filter((x) => !UUID_RE.test(x))) {
    const p = lista.find((x) => x?.id === id) ?? {};
    const firmato = verifyCatalogEntry(p.firma, id);
    if (firmato) {
      const r = await findOrCreatePlace({
        googlePlaceId: id, name: firmato.name, address: firmato.address, lat: firmato.lat, lng: firmato.lng,
        category: firmato.category, rating: firmato.rating, priceLevel: firmato.priceLevel, userRatingCount: firmato.userRatingCount,
      }, "voto", "google");
      if ("place" in r) uuidDi.set(id, r.place.id);
      continue;
    }
    // Senza firma (pagina ricaricata dopo molto): vale solo se il locale è già nel catalogo.
    const { data } = await admin.from("places").select("id").eq("google_place_id", id).limit(1).maybeSingle<{ id: string }>();
    if (data?.id) uuidDi.set(id, data.id);
  }
  const posti = ids.flatMap((id) => (uuidDi.has(id) ? [{ id, uuid: uuidDi.get(id)! }] : []));
  if (new Set(posti.map((p) => p.uuid)).size !== posti.length || posti.length < 2) {
    console.warn(`[voto] posti risolti ${posti.length} di ${ids.length}`);
    return err(422, "Non riesco a preparare questi posti: rifai la ricerca e riprova.");
  }
  const codice = await creaVoto(utente, posti.map((p) => p.uuid), chiude);
  if (codice === "troppi") return err(429, "Hai già creato 10 voti oggi: riprova domani.");
  if (codice === "errore") return err(500, "Non sono riuscito a creare il link. Riprova.");
  console.log(`[voto] nuovo sondaggio con ${posti.length} posti, chiude ${chiude.toISOString()}`);
  return NextResponse.json({ codice, posti, chiudeAlle: chiude.toISOString() });
}
