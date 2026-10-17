import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordEvent } from "@/lib/events";
import { FOTO_BUCKET } from "@/lib/foto-utenti";

// "Elimina il mio account" (profilo, in fondo). Solo per l'utente collegato, su sé stesso.
// Ordine: segnale d'uso (senza dati personali) → segnali passati resi anonimi → foto nello
// Storage → utente in Supabase Auth. Le righe nelle tabelle (profilo, salvati, recensioni, foto,
// contenuti, gruppi, voti, seguiti, rivendicazioni) spariscono da sole: tutte le chiavi verso
// auth.users sono ON DELETE CASCADE (verificato sul database di produzione il 17/10/2026;
// gruppi_posti.aggiunto_da è ON DELETE SET NULL: il posto resta nella lista di gruppo).
// Gli `events` hanno anche loro CASCADE: per non perdere i segnali di comportamento li si
// stacca prima dall'utente (user_id = null), così restano solo come dati anonimi.

export const dynamic = "force-dynamic";

const json = (status: number, body: Record<string, unknown>) => Response.json(body, { status });

/** Tutti i file dell'utente nel bucket delle foto: cartella `<userId>/<placeId>/<fotoId>.jpg`. */
async function percorsiFoto(admin: ReturnType<typeof createAdminClient>, userId: string): Promise<string[]> {
  const paths = new Set<string>();
  // Dalle righe della tabella (percorso salvato al caricamento)…
  const { data: righe } = await admin.from("foto_locali").select("path").eq("user_id", userId);
  for (const r of righe ?? []) if (typeof r.path === "string" && r.path.startsWith(`${userId}/`)) paths.add(r.path);
  // …e dalla cartella, per i file rimasti senza riga.
  const bucket = admin.storage.from(FOTO_BUCKET);
  const { data: cartelle } = await bucket.list(userId, { limit: 1000 });
  for (const c of cartelle ?? []) {
    if (c.id) { paths.add(`${userId}/${c.name}`); continue; } // file direttamente nella cartella
    const { data: files } = await bucket.list(`${userId}/${c.name}`, { limit: 1000 });
    for (const f of files ?? []) if (f.id) paths.add(`${userId}/${c.name}/${f.name}`);
  }
  return [...paths];
}

export async function POST() {
  if (!process.env.SUPABASE_SECRET_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return json(503, { error: "Non disponibile in questo momento. Riprova più tardi." });
  }
  const supabase = await createClient();
  const { data, error: userError } = await supabase.auth.getUser();
  const user = data?.user;
  if (userError || !user) return json(401, { error: "Accedi per eliminare il tuo account." });
  // Mai l'utente finto del giro automatico (che comunque non ha una sessione vera).
  if (process.env.E2E_FAKE_USER && user.id === process.env.E2E_FAKE_USER) return json(400, { error: "Utente di prova." });

  // Segnale d'uso PRIMA di cancellare, senza utente né email: si conta solo che è successo.
  await recordEvent({ type: "funzione", props: { nome: "elimina_account", contesto: "eliminato" } });

  const admin = createAdminClient();

  // 1. Segnali passati: restano, ma anonimi (la colonna user_id ammette null).
  const { error: evError } = await admin.from("events").update({ user_id: null }).eq("user_id", user.id);
  if (evError && evError.code !== "42P01" && evError.code !== "PGRST205") {
    // Non blocca: se non si riesce ad anonimizzarli, il CASCADE li cancella con l'utente.
    console.warn("[account] segnali non resi anonimi (verranno cancellati):", evError.code, evError.message);
  }

  // 2. Foto dell'utente nello Storage (le righe di foto_locali vanno via con il CASCADE).
  try {
    const paths = await percorsiFoto(admin, user.id);
    for (let i = 0; i < paths.length; i += 100) {
      const { error } = await admin.storage.from(FOTO_BUCKET).remove(paths.slice(i, i + 100));
      if (error) console.warn("[account] foto non tolte dallo Storage:", error.message);
    }
    console.log(`[account] eliminazione: ${paths.length} foto tolte dallo Storage`);
  } catch (err) {
    console.warn("[account] lettura delle foto non riuscita:", err);
  }

  // 3. L'utente: con lui spariscono (CASCADE) profilo, salvati, recensioni e il resto.
  const { error: delError } = await admin.auth.admin.deleteUser(user.id);
  if (delError) {
    console.error("[account] eliminazione non riuscita:", delError.status, delError.message);
    return json(500, { error: "Non sono riuscito a eliminare l'account. Riprova tra poco." });
  }

  // 4. Fuori dalla sessione (i cookie si tolgono anche se la sessione non esiste più).
  await supabase.auth.signOut().catch(() => {});
  return json(200, { ok: true });
}
