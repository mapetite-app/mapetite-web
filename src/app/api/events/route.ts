import { NextResponse, after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { EVENT_TYPES, recordEvent, type EventType } from "@/lib/events";
import { clientKey } from "@/lib/ai-limit";

// Segnali dal telefono (aperture scheda, salvataggi, percorso…). Solo campi previsti,
// niente testo libero: props è ridotto a poche chiavi brevi. Risponde subito; la scrittura
// avviene dopo la risposta. Senza la tabella `events` non fa nulla (vedi src/lib/events.ts).
// "tag" tolto (14/10): i nomi delle raccolte sono testo scritto dall'utente.
const PROP_KEYS = ["fonte", "stato", "posizione"] as const;

// Freno alle scritture (la route è aperta anche a chi non ha fatto l'accesso): al massimo
// 200 segnali all'ora per persona o indirizzo, così un ciclo non riempie i dati di comportamento.
const PER_HOUR = 200;
const recent = new Map<string, number[]>();
function allowEvent(key: string, now = Date.now()): boolean {
  const ts = (recent.get(key) ?? []).filter((t) => now - t < 3_600_000);
  if (ts.length >= PER_HOUR) { recent.set(key, ts); return false; }
  ts.push(now);
  recent.set(key, ts);
  if (recent.size > 5000) for (const [k, v] of recent) if (v.every((t) => now - t >= 3_600_000)) recent.delete(k);
  return true;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const type = body?.type as EventType;
  if (!EVENT_TYPES.includes(type) || type === "ricerca") {
    return new NextResponse(null, { status: 400 });
  }
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!allowEvent(clientKey(request, data?.user?.id))) return new NextResponse(null, { status: 204 });
  const props: Record<string, string | number> = {};
  for (const k of PROP_KEYS) {
    const v = body?.props?.[k];
    if (typeof v === "string") props[k] = v.slice(0, 40);
    else if (typeof v === "number" && Number.isFinite(v)) props[k] = v;
  }
  after(() => recordEvent({
    type,
    userId: data?.user?.id ?? null,
    anonId: typeof body?.anonId === "string" ? body.anonId : null,
    placeId: typeof body?.placeId === "string" ? body.placeId : null,
    googlePlaceId: typeof body?.googlePlaceId === "string" ? body.googlePlaceId : null,
    lat: typeof body?.lat === "number" ? body.lat : null,
    lng: typeof body?.lng === "number" ? body.lng : null,
    props,
  }));
  return new NextResponse(null, { status: 204 });
}
