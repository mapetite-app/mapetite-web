import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { cleanCodiceGruppo, isUuid, ordinaPosti, type Gruppo, type InvitoGruppo, type Membro, type PostoGruppo } from "@/lib/gruppi";

// Liste di gruppo (piano 5.5): letture lato server per /gruppi, /gruppi/<id> e /gruppi/entra/<codice>.
// Tutto passa dalle funzioni della migrazione 20261016_liste_gruppo.sql (che controllano da sole
// chi è membro) e dalla RLS. Se la migrazione non è ancora applicata, ogni lettura restituisce
// "in-arrivo": la pagina lo dice con garbo invece di rompersi (come la parte social).

export type InArrivo = { stato: "in-arrivo" };

// ── Test automatico ──────────────────────────────────────────────────────────
// Solo in sviluppo con E2E_FAKE_USER: dati finti dal cookie "e2e_gruppi" (scritto da
// scripts/e2e/giro.mjs). Senza cookie le liste risultano "in arrivo". In produzione NODE_ENV è
// sempre "production" e questo ramo non si attiva.
type FakeGruppi = {
  inArrivo?: boolean;
  gruppi?: Gruppo[];
  membri?: Record<string, Membro[]>;
  posti?: Record<string, PostoGruppo[]>;
  inviti?: Record<string, InvitoGruppo>;
};
const dev = () => process.env.NODE_ENV === "development" && !!process.env.E2E_FAKE_USER;

async function fake(): Promise<FakeGruppi | "in-arrivo" | null> {
  if (!dev()) return null;
  const raw = (await cookies()).get("e2e_gruppi")?.value;
  if (!raw) return "in-arrivo";
  try {
    const data = JSON.parse(decodeURIComponent(raw)) as FakeGruppi;
    return data.inArrivo ? "in-arrivo" : data;
  } catch {
    return "in-arrivo";
  }
}

function logMissing(where: string, error: { code?: string; message: string }) {
  console.error(`[gruppi] ${where}: ${error.code ?? ""} ${error.message} (migrazione 20261016_liste_gruppo non applicata?)`);
}

export async function loadMyGruppi(): Promise<Gruppo[] | InArrivo> {
  const f = await fake();
  if (f === "in-arrivo") return { stato: "in-arrivo" };
  if (f) return f.gruppi ?? [];
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("miei_gruppi");
  if (error) {
    logMissing("miei_gruppi", error);
    return { stato: "in-arrivo" };
  }
  return (data ?? []) as Gruppo[];
}

export type GruppoPage =
  | InArrivo
  | { stato: "non-trovato" }
  | { stato: "ok"; gruppo: Gruppo; membri: Membro[]; posti: PostoGruppo[] };

export async function loadGruppo(id: string): Promise<GruppoPage> {
  if (!isUuid(id)) return { stato: "non-trovato" };
  const f = await fake();
  if (f === "in-arrivo") return { stato: "in-arrivo" };
  if (f) {
    const gruppo = (f.gruppi ?? []).find((g) => g.id === id);
    if (!gruppo) return { stato: "non-trovato" };
    return { stato: "ok", gruppo, membri: f.membri?.[id] ?? [], posti: ordinaPosti(f.posti?.[id] ?? []) };
  }
  const supabase = await createClient();
  // L'elenco delle proprie liste porta anche i numeri: una sola funzione per l'intestazione.
  const [gs, ms, ps] = await Promise.all([
    supabase.rpc("miei_gruppi"),
    supabase.from("gruppi_membri").select("user_id, nome").eq("gruppo_id", id).order("created_at"),
    supabase.rpc("posti_gruppo", { p_gruppo: id }),
  ]);
  if (gs.error) {
    logMissing("miei_gruppi", gs.error);
    return { stato: "in-arrivo" };
  }
  const gruppo = ((gs.data ?? []) as Gruppo[]).find((g) => g.id === id);
  if (!gruppo) return { stato: "non-trovato" }; // non esiste o non sei membro: stessa risposta
  if (ms.error) logMissing("gruppi_membri", ms.error);
  if (ps.error) logMissing("posti_gruppo", ps.error);
  const posti = ((ps.data ?? []) as PostoGruppo[]).map((p) => ({ ...p, votanti: p.votanti ?? [], lat: p.lat == null ? null : Number(p.lat), lng: p.lng == null ? null : Number(p.lng) }));
  return { stato: "ok", gruppo, membri: (ms.data ?? []) as Membro[], posti: ordinaPosti(posti) };
}

export type InvitoPage = InArrivo | { stato: "non-trovato" } | { stato: "ok"; codice: string; invito: InvitoGruppo };

export async function loadInvitoGruppo(raw: string): Promise<InvitoPage> {
  const codice = cleanCodiceGruppo(raw);
  if (!codice) return { stato: "non-trovato" };
  const f = await fake();
  if (f === "in-arrivo") return { stato: "in-arrivo" };
  if (f) {
    const invito = f.inviti?.[codice];
    return invito ? { stato: "ok", codice, invito } : { stato: "non-trovato" };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("gruppo_da_invito", { p_codice: codice });
  if (error) {
    logMissing("gruppo_da_invito", error);
    return { stato: "in-arrivo" };
  }
  const invito = ((data ?? []) as InvitoGruppo[])[0];
  return invito ? { stato: "ok", codice, invito } : { stato: "non-trovato" };
}
