import { NextResponse, after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { EVENT_TYPES, recordEvent, type EventType } from "@/lib/events";

// Segnali dal telefono (aperture scheda, salvataggi, percorso…). Solo campi previsti,
// niente testo libero: props è ridotto a poche chiavi brevi. Risponde subito; la scrittura
// avviene dopo la risposta. Senza la tabella `events` non fa nulla (vedi src/lib/events.ts).
const PROP_KEYS = ["tag", "fonte", "stato", "posizione"] as const;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const type = body?.type as EventType;
  if (!EVENT_TYPES.includes(type) || type === "ricerca") {
    return new NextResponse(null, { status: 400 });
  }
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
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
