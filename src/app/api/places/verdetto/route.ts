import { NextResponse } from "next/server";
import { fetchPlaceDetails } from "@/lib/google-places";
import { getSynthesis } from "@/lib/haiku-synthesis";
import { selectQualityReviews } from "@/lib/review-selection";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { allowAi, clientKey } from "@/lib/ai-limit";
import { recordEvent } from "@/lib/events";

// Verdetto Mapetite per un locale salvato che non ce l'ha ancora (importato da Google Maps, salvato
// da un link...). VISIONE: il verdetto deve esserci SEMPRE. Si chiede quando si apre la sua scheda:
// 1 Place Details (recensioni comprese) + 1 Haiku, poi resta in place_synthesis per tutti.
// Tetto: VERDETTI_AL_GIORNO per tutta l'app, così le Place Details restano nella fascia gratuita
// di Google (1.000 al mese per la fascia Enterprise + Atmosphere) e lontane dalla quota di 50.
const VERDETTI_AL_GIORNO = 25;
const romeDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit" });

async function verdettiDiOggi(): Promise<number> {
  try {
    // Mezzanotte di Roma come istante UTC (2 ore di scarto al massimo: basta per un tetto).
    const since = new Date(`${romeDay.format(new Date())}T00:00:00+02:00`).toISOString();
    const { count, error } = await createAdminClient()
      .from("events")
      .select("id", { count: "exact", head: true })
      .eq("type", "funzione")
      .eq("props->>nome", "verdetto_salvato")
      .gte("created_at", since);
    if (error) throw error;
    return count ?? 0;
  } catch (err) {
    // Senza conteggio non si rischia: niente verdetti nuovi.
    console.error("[verdetto] conteggio di oggi non riuscito:", err);
    return VERDETTI_AL_GIORNO;
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const placeId = typeof body?.googlePlaceId === "string" ? body.googlePlaceId.trim() : "";
  if (!/^[A-Za-z0-9_-]{10,300}$/.test(placeId)) {
    return NextResponse.json({ error: "Locale non valido." }, { status: 400 });
  }
  const devUser = process.env.NODE_ENV === "development" ? process.env.E2E_FAKE_USER ?? null : null;
  const { data: { user } } = await (await createClient()).auth.getUser();
  const userId = user?.id ?? devUser;
  if (!userId) return NextResponse.json({ error: "Accedi per vedere il verdetto." }, { status: 401 });

  // Solo per un locale che questa persona ha salvato: non è una porta per chiedere dettagli Google a caso.
  if (!devUser) {
    const { data: saved } = await createAdminClient()
      .from("saved_places")
      .select("place_id, places!inner(google_place_id)")
      .eq("user_id", userId)
      .eq("places.google_place_id", placeId)
      .limit(1);
    if (!saved || saved.length === 0) return NextResponse.json({ error: "Locale non tra i tuoi salvati." }, { status: 404 });
  }

  // Verdetto già scritto (da un'altra ricerca o da un altro utente): nessuna chiamata.
  const { data: cached } = await createAdminClient()
    .from("place_synthesis")
    .select("synthesis, tags, verdict, go_for, dont_expect")
    .eq("place_id", placeId)
    .maybeSingle();
  if (cached && typeof cached.verdict === "string" && cached.verdict.trim() !== "") {
    return NextResponse.json({ verdict: cached.verdict, synthesis: cached.synthesis, tags: cached.tags, goFor: cached.go_for, dontExpect: cached.dont_expect });
  }

  if (!allowAi("verdetti", clientKey(request, userId))) {
    return NextResponse.json({ error: "Troppe richieste: riprova tra qualche minuto." }, { status: 429 });
  }
  if ((await verdettiDiOggi()) >= VERDETTI_AL_GIORNO) {
    console.warn(`[verdetto] tetto di ${VERDETTI_AL_GIORNO} verdetti nuovi al giorno raggiunto`);
    return NextResponse.json({ error: "limite" }, { status: 429 });
  }

  const place = await fetchPlaceDetails(placeId).catch((err) => { console.error("[verdetto] Google:", err); return null; });
  if (!place) return NextResponse.json({ error: "Dati del locale non disponibili." }, { status: 502 });
  void recordEvent({ type: "funzione", userId, googlePlaceId: placeId, props: { nome: "verdetto_salvato" } });

  const s = (await getSynthesis([place], "", userId, { soloVerdetto: true }).catch(() => ({})) as Record<string, { verdict: string; synthesis: string; tags: string[]; goFor: string[]; dontExpect: string[] }>)[placeId];
  console.log(`[verdetto] ${place.name}: ${s?.verdict ? "scritto" : "non riuscito"}`);
  // I dati Google si mostrano nella scheda e basta (mai salvati: termini Google, 3.2.3(b)).
  return NextResponse.json({
    verdict: s?.verdict || null,
    synthesis: s?.synthesis || null,
    tags: s?.tags ?? null,
    goFor: s?.goFor ?? null,
    dontExpect: s?.dontExpect ?? null,
    userRatingCount: place.userRatingCount,
    openNow: place.openNow,
    websiteUri: place.websiteUri,
    phone: place.phone,
    photoRef: place.photoRef,
    photoAuthor: place.photoAuthor ?? null,
    selectedReviews: selectQualityReviews(place.reviewItems ?? place.reviewTexts),
  });
}
