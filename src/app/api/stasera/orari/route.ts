import { NextResponse } from "next/server";
import { fetchOpeningPeriods, type OpeningPeriods } from "@/lib/google-places";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { allowAi, clientKey } from "@/lib/ai-limit";
import { recordEvent } from "@/lib/events";

// Proposta 84: "A che ora?" in "Stasera dove andiamo?". Gli orari dei salvati non sono nel nostro
// database (termini Google): si chiedono a Google solo al tocco di un'ora, per al massimo
// MAX_PER_TOCCO salvati, e mai più di ORARI_AL_GIORNO letture al giorno per tutta l'app.
// Conto della quota (50 Place Details al giorno): verdetti nuovi al massimo 25 + orari 20 = 45.
// Costo: fascia "Place Details Enterprise", soglia gratuita di 1.000 al mese → 20 × 30 = 600, 0 €.
const MAX_PER_TOCCO = 5;
export const ORARI_AL_GIORNO = 20;
const GID = /^[A-Za-z0-9_-]{10,300}$/;

async function orariDiOggi(): Promise<number> {
  try {
    // Ultime 24 ore (revisore 24/11): la quota Google si azzera alle 9 di Roma, non a mezzanotte; così le
    // letture restano al massimo ORARI_AL_GIORNO in qualsiasi giorno di quota.
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count, error } = await createAdminClient()
      .from("events")
      .select("id", { count: "exact", head: true })
      .eq("type", "funzione")
      .eq("props->>nome", "orari_google")
      .gte("created_at", since);
    if (error) throw error;
    return count ?? 0;
  } catch (err) {
    // Senza conteggio non si rischia la quota: nessuna lettura nuova.
    console.error("[orari] conteggio di oggi non riuscito:", err);
    return ORARI_AL_GIORNO;
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const ids: string[] = Array.isArray(body?.ids)
    ? [...new Set((body.ids as unknown[]).filter((x): x is string => typeof x === "string" && GID.test(x)))]
    : [];
  if (ids.length === 0 || ids.length > MAX_PER_TOCCO) {
    return NextResponse.json({ error: "Locali non validi." }, { status: 400 });
  }
  const devUser = process.env.NODE_ENV === "development" ? process.env.E2E_FAKE_USER ?? null : null;
  const { data: { user } } = await (await createClient()).auth.getUser();
  const userId = user?.id ?? devUser;
  if (!userId) return NextResponse.json({ error: "Accedi per vedere gli orari." }, { status: 401 });

  // Solo locali che questa persona ha salvato: non è una porta per chiedere dati Google a caso.
  let mine = ids;
  if (!devUser) {
    const { data: saved, error } = await createAdminClient()
      .from("saved_places")
      .select("places!inner(google_place_id)")
      .eq("user_id", userId)
      .in("places.google_place_id", ids);
    if (error) {
      console.error("[orari] lettura dei salvati fallita:", error);
      return NextResponse.json({ error: "Orari non disponibili." }, { status: 502 });
    }
    const own = new Set((saved ?? []).map((r) => (r.places as unknown as { google_place_id: string | null } | null)?.google_place_id).filter(Boolean));
    mine = ids.filter((g) => own.has(g));
  }
  if (mine.length === 0) return NextResponse.json({ error: "Locali non tra i tuoi salvati." }, { status: 404 });

  if (!allowAi("orari", clientKey(request, userId))) {
    return NextResponse.json({ error: "limite" }, { status: 429 });
  }
  const restano = ORARI_AL_GIORNO - (await orariDiOggi());
  if (restano <= 0) {
    console.warn(`[orari] tetto di ${ORARI_AL_GIORNO} letture al giorno raggiunto`);
    return NextResponse.json({ error: "limite" }, { status: 429 });
  }
  const daLeggere = mine.slice(0, restano);
  const orari: Record<string, OpeningPeriods | null> = {};
  // Si conta prima di chiamare Google (revisore 24/11): se la scrittura dell'evento non riesce, meglio una
  // lettura contata in più che una non contata.
  await Promise.all(daLeggere.map((g) => recordEvent({ type: "funzione", userId, googlePlaceId: g, props: { nome: "orari_google" } })));
  await Promise.all(daLeggere.map(async (g) => {
    orari[g] = await fetchOpeningPeriods(g).catch((err) => { console.error("[orari] Google:", err); return null; });
  }));
  console.log(`[orari] ${daLeggere.length} letture (${Object.values(orari).filter(Boolean).length} con orari)`);
  // I locali oltre il tetto non compaiono nella risposta: per il telefono "orari non noti", restano.
  return NextResponse.json({ orari });
}
