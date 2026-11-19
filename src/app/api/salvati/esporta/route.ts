import { createClient } from "@/lib/supabase/server";
import { nomeFile, salvatiCsv, type RigaSalvato } from "@/lib/esporta-salvati";

// Proposta 70 "Porta via i tuoi salvati": scarica i propri salvati in CSV (solo le righe della persona,
// lette con la sua sessione: RLS di saved_places). Nessun contenuto Google nel file.
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const testa = (n: string) => ({
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="${n}"`,
    "Cache-Control": "no-store",
  });
  // Giro automatico in sviluppo: utente finto, file con la sola intestazione.
  if (!user && process.env.NODE_ENV === "development" && process.env.E2E_FAKE_USER) {
    return new Response(salvatiCsv([]), { headers: testa(nomeFile()) });
  }
  if (!user) return new Response("Accedi per scaricare i tuoi salvati.", { status: 401 });

  const righe: RigaSalvato[] = [];
  const PAGINA = 1000;
  for (let da = 0; da < 50_000; da += PAGINA) {
    const { data, error } = await supabase
      .from("saved_places")
      .select("created_at, tags, note, consigliato_da, places(name, address, google_place_id)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .range(da, da + PAGINA - 1);
    if (error) {
      console.warn(`[esporta] salvati non letti ${error.code ?? ""}`);
      return new Response("Non sono riuscito a preparare il file. Riprova tra poco.", { status: 500 });
    }
    righe.push(...((data ?? []) as unknown as RigaSalvato[]));
    if (!data || data.length < PAGINA) break;
  }
  return new Response(salvatiCsv(righe), { headers: testa(nomeFile()) });
}
