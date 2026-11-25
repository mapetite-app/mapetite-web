import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { puoGestireLocale } from "@/lib/ristoratore-accesso";
import { annoDa } from "@/lib/anno-tavola";
import { annoLocale, type AnnoLocale } from "@/lib/ristoratore-anno";
import type { RistReel, RistSalvataggio } from "@/lib/ristoratore";

// "Il vostro anno su Mapetite" (proposta 87): legge con la chiave di servizio, solo dal server, i salvataggi del
// locale, i video collegati nell'anno e chi lo ha salvato su consiglio di un amico. Al telefono arrivano solo i
// conteggi di annoLocale (da 3 persone in su). Stesso accesso del pannello: admin o titolare verificato.

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export type DatiAnnoLocale = { nome: string; anno: AnnoLocale };
type Riga = RistSalvataggio & { solo_per_me?: boolean | null; consigliato_da?: string | null };

// Solo in sviluppo con E2E_FAKE_USER: dati finti dal cookie "e2e_rist_anno" (scritto da scripts/e2e/giro.mjs).
async function e2e(id: string): Promise<DatiAnnoLocale | null> {
  if (process.env.NODE_ENV !== "development" || !process.env.E2E_FAKE_USER) return null;
  const raw = (await cookies()).get("e2e_rist_anno")?.value;
  if (!raw) return null;
  try {
    const v = JSON.parse(decodeURIComponent(raw));
    if (v?.id !== id) return null;
    const anno = Number(v.anno) || annoDa();
    return { nome: String(v.nome ?? "Locale"), anno: annoLocale({ placeId: id, righe: v.righe ?? [], reel: v.reel ?? [], consigliati: v.consigliati ?? [] }, anno) };
  } catch {
    return null;
  }
}

/** null = la pagina non esiste per chi guarda (404), come il pannello. */
export async function caricaAnnoLocale(id: string): Promise<DatiAnnoLocale | null> {
  if (!UUID_RE.test(id)) return null;
  const finto = await e2e(id);
  if (finto) return finto;
  if (!(await puoGestireLocale(id))) return null;
  const db = createAdminClient();
  const { data: locale } = await db.from("places").select("id, name").eq("id", id).maybeSingle<{ id: string; name: string }>();
  if (!locale) return null;
  const anno = annoDa();

  const leggi = (cols: string) => db.from("saved_places").select(cols).eq("place_id", id).limit(5000).returns<Riga[]>();
  let { data: righe, error } = await leggi("place_id,user_id,created_at,tags,visited_at,visite,solo_per_me,consigliato_da");
  if (error?.code === "42703") ({ data: righe, error } = await leggi("place_id,user_id,created_at,tags,visited_at,visite"));
  if (error) {
    console.error("[ristoratore-anno] lettura salvataggi:", error.code, error.message);
    return null;
  }
  const tutte = righe ?? [];

  // Lucchetto delle raccolte (profiles.raccolte_private): se l'elenco non si legge, nel dubbio la riga è privata.
  const privateDi = new Map<string, string[]>();
  let ignote = false;
  const utenti = [...new Set(tutte.map((r) => r.user_id))];
  for (let i = 0; i < utenti.length && !ignote; i += 200) {
    const { data: pr, error: e } = await db.from("profiles").select("id, raccolte_private").in("id", utenti.slice(i, i + 200));
    if (e) {
      if (e.code === "42703") break;
      console.error("[ristoratore-anno] lettura raccolte private:", e.message);
      ignote = true;
      break;
    }
    for (const p of (pr ?? []) as { id: string; raccolte_private: string[] | null }[]) privateDi.set(p.id, p.raccolte_private ?? []);
  }
  const salvati: RistSalvataggio[] = tutte.map(({ solo_per_me, consigliato_da: _c, ...r }) => ({
    ...r,
    privato: ignote || solo_per_me === true || (r.tags ?? []).some((t) => (privateDi.get(r.user_id) ?? []).includes(t)),
  }));
  const consigliati = tutte.filter((r) => r.consigliato_da).map((r) => r.user_id);

  // Video collegati dall'inizio dell'anno (a Roma, con un giorno di margine) a fine anno.
  const { data: reel, error: rErr } = await db
    .from("contenuti_locali")
    .select("user_id, place_id, fonte, created_at")
    .eq("place_id", id)
    .gte("created_at", new Date(Date.UTC(anno, 0, 1) - 2 * 86_400_000).toISOString())
    .lt("created_at", new Date(Date.UTC(anno + 1, 0, 2)).toISOString())
    .limit(5000);
  if (rErr && rErr.code !== "42P01" && rErr.code !== "PGRST205") console.error("[ristoratore-anno] lettura reel:", rErr.message);

  return { nome: locale.name, anno: annoLocale({ placeId: id, righe: salvati, reel: (reel ?? []) as RistReel[], consigliati }, anno) };
}
