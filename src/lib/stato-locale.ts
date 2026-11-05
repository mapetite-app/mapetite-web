// Proposta 45 "Ha chiuso?" (4/11). Quando dei locali passano già da Google (ricerca, scheda di un
// salvato), lo stato si ricorda sulla riga di `places`, se il locale è già in archivio (qualcuno
// l'ha salvato). Nessuna chiamata Google in più; mai cancellato niente: è solo un'etichetta.
import { createAdminClient } from "@/lib/supabase/admin";

export const STATI_VALIDI = ["OPERATIONAL", "CLOSED_TEMPORARILY", "CLOSED_PERMANENTLY"] as const;
export type StatoLocale = (typeof STATI_VALIDI)[number];

export function statoValido(v: unknown): StatoLocale | null {
  return typeof v === "string" && (STATI_VALIDI as readonly string[]).includes(v) ? (v as StatoLocale) : null;
}

export async function ricordaStato(places: { id: string; businessStatus?: string | null }[]): Promise<void> {
  const conStato = places.map((p) => ({ id: p.id, stato: statoValido(p.businessStatus) })).filter((p) => p.stato);
  if (conStato.length === 0) return;
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("places")
      .select("id, google_place_id, business_status")
      .in("google_place_id", conStato.map((p) => p.id));
    if (error) throw error;
    const ora = new Date().toISOString();
    for (const row of data ?? []) {
      const nuovo = conStato.find((p) => p.id === row.google_place_id)?.stato;
      if (!nuovo || nuovo === row.business_status) continue;
      const { error: e } = await admin.from("places").update({ business_status: nuovo, business_status_at: ora }).eq("id", row.id);
      if (e) throw e;
      console.log(`[stato-locale] ${row.google_place_id}: ${row.business_status ?? "—"} → ${nuovo}`);
    }
  } catch (err) {
    // Colonna mancante (migrazione non applicata) o rete: non cambia niente per chi cerca.
    console.error("[stato-locale] non salvato:", err);
  }
}
