"use server";

import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/admin";
import { FOTO_BUCKET } from "@/lib/foto-utenti";

// Proposta 82: Lorenzo decide su una segnalazione dal pannello dei numeri. "Togli" cancella la
// recensione o la foto (e il file della foto) per tutti; "Lascia" la chiude senza toccare niente.
// Solo per gli indirizzi di src/lib/admin.ts.
export async function decidiSegnalazione(form: FormData): Promise<void> {
  const { data } = await getUser();
  if (!isAdminEmail(data?.user?.email)) return;
  const id = String(form.get("id") ?? "");
  const esito = form.get("esito");
  if (!id || (esito !== "tolto" && esito !== "lasciato")) return;
  const admin = createAdminClient();
  const { data: seg } = await admin.from("contenuti_segnalati").select("tipo, contenuto_id").eq("id", id).maybeSingle<{ tipo: string; contenuto_id: string }>();
  if (!seg) return;
  if (esito === "tolto") {
    if (seg.tipo === "recensione") {
      const { error } = await admin.from("reviews").delete().eq("id", seg.contenuto_id);
      if (error) { console.warn(`[moderazione] recensione non tolta ${error.code ?? ""}`); return; }
    } else {
      const { data: foto } = await admin.from("foto_locali").select("path").eq("id", seg.contenuto_id).maybeSingle<{ path: string | null }>();
      const { error } = await admin.from("foto_locali").delete().eq("id", seg.contenuto_id);
      if (error) { console.warn(`[moderazione] foto non tolta ${error.code ?? ""}`); return; }
      if (foto?.path) await admin.storage.from(FOTO_BUCKET).remove([foto.path]).catch(() => {});
    }
  }
  // Tutte le segnalazioni dello stesso contenuto si chiudono insieme.
  await admin.from("contenuti_segnalati").update({ esito }).eq("tipo", seg.tipo).eq("contenuto_id", seg.contenuto_id);
  revalidatePath("/admin/numeri");
}
