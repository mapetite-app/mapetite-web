import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { FOTO_BUCKET, UUID_RE } from "@/lib/foto-utenti";

// Immagine di una foto caricata da un utente (piani 4.4 e 5.6c). Il bucket è privato: qui si
// controlla chi può vederla e solo dopo si legge il file con la chiave del server.
//   - foto pubblica → la vista foto_pubbliche la mostra a tutti (anche senza accesso);
//   - foto privata  → solo il suo autore (RLS su foto_locali).
// L'indirizzo contiene solo l'id della foto: mai l'id dell'autore (resta anonimo se il profilo è privato).
// Mai foto Google: in questo bucket ci sono solo file caricati dagli utenti.

const NOT_FOUND = () => new Response("Foto non trovata", { status: 404, headers: { "Cache-Control": "no-store" } });

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!UUID_RE.test(id) || !process.env.SUPABASE_SECRET_KEY) return NOT_FOUND();
  try {
    const supabase = await createClient();
    const [pub, own] = await Promise.all([
      supabase.from("foto_pubbliche").select("id").eq("id", id).maybeSingle(),
      supabase.from("foto_locali").select("path").eq("id", id).maybeSingle<{ path: string }>(),
    ]);
    const admin = createAdminClient();
    let path = own.data?.path ?? null;
    if (!path && pub.data) {
      const { data } = await admin.from("foto_locali").select("path").eq("id", id).maybeSingle<{ path: string }>();
      path = data?.path ?? null;
    }
    if (!path) return NOT_FOUND();
    const { data: file, error } = await admin.storage.from(FOTO_BUCKET).download(path);
    if (error || !file) {
      console.error("[foto] file non letto:", error?.message);
      return NOT_FOUND();
    }
    return new Response(file, {
      headers: {
        "Content-Type": "image/jpeg",
        // Privata nella cache del telefono: se l'autore la toglie, sparisce al più entro un'ora.
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    console.error("[foto] lettura fallita:", err instanceof Error ? err.message : err);
    return NOT_FOUND();
  }
}
