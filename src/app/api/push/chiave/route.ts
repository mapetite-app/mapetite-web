import { NextResponse } from "next/server";
import { pushConfigurato } from "@/lib/push-server";

// Chiave pubblica VAPID per iscriversi agli avvisi (proposta 6). 404 se gli avvisi non sono configurati:
// il telefono allora non mostra il pulsante.
export function GET() {
  if (!pushConfigurato()) return NextResponse.json({ key: null }, { status: 404 });
  return NextResponse.json({ key: process.env.VAPID_PUBLIC_KEY }, { headers: { "Cache-Control": "public, max-age=3600" } });
}
