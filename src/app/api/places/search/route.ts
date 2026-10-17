import { NextResponse } from "next/server";
import { searchGooglePlaces } from "@/lib/google-places";
import { createClient } from "@/lib/supabase/server";
import { allowAi, clientKey } from "@/lib/ai-limit";
import { signCatalogEntry } from "@/lib/catalog-sig";

// Ricerca Google di un locale per nome (Importa: a mano e da screenshot). Ogni chiamata è una
// Text Search a pagamento sulle 50 al giorno condivise con la ricerca della mappa: solo per chi
// ha fatto l'accesso (servono comunque per salvare) e con un tetto per persona.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const query = body?.query;

  if (typeof query !== "string" || query.trim() === "") {
    return NextResponse.json(
      { error: "Il campo 'query' è obbligatorio e deve essere una stringa non vuota." },
      { status: 400 }
    );
  }
  if (query.length > 200) {
    return NextResponse.json({ error: "Testo troppo lungo: scrivi solo nome e città del locale." }, { status: 400 });
  }

  const devUser = process.env.NODE_ENV === "development" ? process.env.E2E_FAKE_USER ?? null : null;
  const { data: { user } } = await (await createClient()).auth.getUser();
  const userId = user?.id ?? devUser;
  if (!userId) {
    return NextResponse.json({ error: "Accedi per cercare e salvare un locale." }, { status: 401 });
  }
  if (!allowAi("luoghi", clientKey(request, userId))) {
    return NextResponse.json({ error: "Hai cercato tanti locali in poco tempo: riprova tra qualche minuto." }, { status: 429 });
  }

  try {
    const results = await searchGooglePlaces(query.trim());
    // Firma dei dati Google per il catalogo condiviso (src/lib/catalog-sig.ts).
    return NextResponse.json({ results: results.map((p) => ({ ...p, firma: signCatalogEntry(p) })) });
  } catch (err) {
    console.error("[places/search] Google:", err);
    return NextResponse.json({ error: "Non riesco a cercare il locale su Google Maps. Riprova." }, { status: 500 });
  }
}
