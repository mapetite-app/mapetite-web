import { NextResponse } from "next/server";
import { cercaTripadvisor, nuovoStato } from "@/lib/tripadvisor";

// Riga Tripadvisor di "A confronto" nella scheda del locale. GET ?nome=&lat=&lng=
// Solo l'API ufficiale Content API e solo se c'è TRIPADVISOR_API_KEY (chiave server, mai
// NEXT_PUBLIC_): senza chiave risponde { stato: "senza-chiave" } senza alcuna chiamata esterna.
// Cache e tetto giornaliero in memoria (src/lib/tripadvisor.ts), niente database.
// I dati Tripadvisor vanno solo al telefono: mai in un prompt né nella sintesi Haiku.

// Uno stato per istanza del server: si azzera a ogni riavvio (va bene: è solo un freno).
const stato = nuovoStato();

const cache = (secondi: number) => ({ headers: { "Cache-Control": `private, max-age=${secondi}` } });

export async function GET(request: Request) {
  const p = new URL(request.url).searchParams;
  const nome = p.get("nome")?.trim() ?? "";
  const lat = Number(p.get("lat"));
  const lng = Number(p.get("lng"));
  if (!nome || nome.length > 120 || !p.get("lat") || !p.get("lng") || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return NextResponse.json({ stato: "nessuno" }, { status: 400 });
  }
  const esito = await cercaTripadvisor(
    { nome, lat, lng },
    { key: process.env.TRIPADVISOR_API_KEY, fetch, stato, log: (m) => console.warn(m) },
  );
  return NextResponse.json(esito, cache(esito.stato === "trovato" || esito.stato === "nessuno" ? 3600 : 300));
}
