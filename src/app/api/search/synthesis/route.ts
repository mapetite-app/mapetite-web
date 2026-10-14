import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSynthesis } from "@/lib/haiku-synthesis";
import type { PlaceResult } from "@/lib/google-places";
import { verifySynthesisInput, type SynthesisInput } from "@/lib/synthesis-token";
import { allowAi, clientKey } from "@/lib/ai-limit";

// Secondo tempo della ricerca: verdetti, perché-è-adatto ed esclusioni.
// Riceve i dati Google già ottenuti dal primo tempo (firmati dal server).
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const query = body?.query;
  const places = body?.places as SynthesisInput[] | undefined;

  if (typeof query !== "string" || query.trim() === "" || query.length > 500 || !Array.isArray(places) || places.length > 20) {
    return NextResponse.json({ error: "Richiesta non valida." }, { status: 400 });
  }
  let valid = false;
  try {
    valid = verifySynthesisInput(query.trim(), places, body?.token);
  } catch (err) {
    console.error("[search/synthesis] firma non verificabile:", err);
  }
  if (!valid) {
    return NextResponse.json({ error: "Richiesta non valida." }, { status: 400 });
  }

  // Oltre il tetto AI: niente verdetti, restano i dati Google (le card mostrano descrizione o recensione).
  // Utente letto prima del tetto: il limite conta per persona, non per rete Wi-Fi condivisa.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!allowAi("verdetti", clientKey(request, user?.id))) {
    return NextResponse.json({ dettagli: {}, esclusi: [], livelli: {} });
  }

  const stubs: PlaceResult[] = places.map((p) => ({
    id: p.id,
    name: p.name,
    address: "",
    lat: null,
    lng: null,
    category: p.category,
    rating: p.rating,
    userRatingCount: p.userRatingCount,
    priceLevel: p.priceLevel,
    openNow: null,
    types: p.types,
    websiteUri: null,
    editorialSummary: p.editorialSummary,
    reviewTexts: p.reviewTexts,
    phone: null,
    photoRef: null,
  }));

  let sintesi: Awaited<ReturnType<typeof getSynthesis>> = {};
  try {
    sintesi = await getSynthesis(stubs, query.trim(), user?.id ?? null);
  } catch (err) {
    console.error("[search/synthesis] errore Haiku:", err);
  }

  // Locali che chiaramente non rispettano la richiesta. Nel dubbio restano;
  // se Haiku li scartasse tutti non ne escludiamo nessuno.
  const allIds = stubs.map((p) => p.id);
  let esclusi = allIds.filter((id) => sintesi[id]?.fit === false);
  if (esclusi.length === allIds.length) esclusi = [];

  const dettagli: Record<string, unknown> = {};
  for (const [id, s] of Object.entries(sintesi)) {
    dettagli[id] = {
      synthesis: s.synthesis || null,
      tags: s.tags,
      verdict: s.verdict || null,
      goFor: s.goFor,
      dontExpect: s.dontExpect,
      matchReason: s.matchReason || null,
    };
  }
  // Quanto ogni locale è adatto alla richiesta secondo Haiku: il telefono mette in cima gli "alto"
  // e in fondo i "basso" (mai esclusi). Prima l'ordine restava quello di Google anche quando il
  // "perché" diceva "meno adatto per un anniversario" (visto il 14/10 con Haiku vero).
  const livelli: Record<string, string> = {};
  for (const [id, s] of Object.entries(sintesi)) livelli[id] = s.match;
  return NextResponse.json({ dettagli, esclusi, livelli });
}
