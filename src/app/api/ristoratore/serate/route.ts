import { NextResponse, after } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { puoGestireLocale } from "@/lib/ristoratore-accesso";
import { giorniNuovi, pulisciGiorni } from "@/lib/serate";
import { pulisciApertoDal } from "@/lib/aperto-dal";
import { pulisciOmaggio, type Omaggio } from "@/lib/omaggio";
import { pulisciPrezzo, type Prezzo } from "@/lib/prezzo-locale";
import { giorniValidi, oggiRomaFeste, pulisciMenuFeste, stagioneMenu, type MenuFeste } from "@/lib/menu-feste";
import { avvisaChiSegue } from "@/lib/push-server";

// L'invio degli avvisi "c'è posto" (PROPOSTE.md 72) gira dopo la risposta: gli si lascia il tempo.
export const maxDuration = 30;

// "Serate tranquille" (POSIZIONAMENTO.md, proposta 1; migrazione 20261018_serate_tranquille.sql)
// e "Aperto da poco" (PROPOSTE.md, proposta 7; migrazione 20261020_aperto_dal.sql): GET dà anche
// apertoDal ("AAAA-MM" o null); POST accetta giorni e/o apertoDal.
// "Grazie di essere tornato" (PROPOSTE.md 12; migrazione 20261030b_omaggio.sql): GET dà anche
// omaggio ({ testo, soglia } o null); POST accetta omaggio ({ testo, soglia } o null per spegnerlo).
// "Fascia di prezzo confermata dal locale" (PROPOSTE.md 65; migrazione 20261117_prezzo_medio.sql): GET dà
// anche prezzo ({ min, max, bevande } o null); POST accetta prezzo (oggetto valido o null per toglierlo).
// "Menu delle feste" (PROPOSTE.md 90; migrazione 20261126_menu_feste.sql): GET dà anche feste ({ prezzo, bevande,
// giorni, gruppi, at } o null); POST accetta feste (oggetto valido o null per toglierlo), solo dal 1/11 al 6/1.
// GET ?id=<UUID o Place ID Google> → { verificato, giorni, at } per la riga della scheda (pubblico,
// come places). POST { id: UUID, giorni: [0..6] } → li salva: solo admin o titolare verificato,
// e solo su un locale verificato. Nessuna chiamata a Google.

const NO_STORE = { headers: { "Cache-Control": "private, no-store" } };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VUOTO = { verificato: false, giorni: [] as number[], at: null as string | null, apertoDal: null as string | null, omaggio: null as Omaggio | null, prezzo: null as Prezzo | null, feste: null as MenuFeste | null };
type Riga = { verified_at: string | null; giorni_tranquilli?: number[] | null; giorni_tranquilli_at?: string | null; aperto_dal?: string | null; omaggio_testo?: string | null; omaggio_soglia?: number | null; prezzo_min?: number | null; prezzo_max?: number | null; prezzo_bevande?: boolean | null; feste_prezzo?: number | null; feste_bevande?: boolean | null; feste_giorni?: string[] | null; feste_gruppi?: number | null; feste_at?: string | null };

// Solo in sviluppo con E2E_FAKE_USER: il giro scrive e rilegge dal cookie "e2e_serate".
const dev = () => process.env.NODE_ENV === "development" && !!process.env.E2E_FAKE_USER;

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id")?.trim() ?? "";
  if (!/^[A-Za-z0-9_-]{2,200}$/.test(id)) return NextResponse.json(VUOTO, NO_STORE);
  if (dev()) {
    const raw = (await cookies()).get("e2e_serate")?.value;
    try {
      const v = raw ? JSON.parse(decodeURIComponent(raw)) : null;
      return NextResponse.json(v && (v.id === id || v.gid === id) ? { verificato: !!v.verificato, giorni: pulisciGiorni(v.giorni), at: v.at ?? null, apertoDal: pulisciApertoDal(v.apertoDal), omaggio: v.verificato ? pulisciOmaggio(v.omaggio?.testo, v.omaggio?.soglia) : null, prezzo: v.verificato ? pulisciPrezzo(v.prezzo?.min, v.prezzo?.max, v.prezzo?.bevande) : null, feste: v.verificato ? pulisciMenuFeste(v.feste?.prezzo, v.feste?.bevande, v.feste?.giorni, v.feste?.gruppi, v.feste?.at) : null } : VUOTO, NO_STORE);
    } catch {
      return NextResponse.json(VUOTO, NO_STORE);
    }
  }
  try {
    const supabase = await createClient();
    const col = UUID_RE.test(id) ? "id" : "google_place_id";
    let { data, error } = await supabase.from("places").select("verified_at, giorni_tranquilli, giorni_tranquilli_at, aperto_dal, omaggio_testo, omaggio_soglia, prezzo_min, prezzo_max, prezzo_bevande, feste_prezzo, feste_bevande, feste_giorni, feste_gruppi, feste_at").eq(col, id).limit(1).maybeSingle<Riga>();
    // 42703 = colonna assente (migrazione del menu delle feste non applicata): si rilegge senza.
    if (error?.code === "42703") ({ data, error } = await supabase.from("places").select("verified_at, giorni_tranquilli, giorni_tranquilli_at, aperto_dal, omaggio_testo, omaggio_soglia, prezzo_min, prezzo_max, prezzo_bevande").eq(col, id).limit(1).maybeSingle<Riga>());
    // 42703 = colonna assente (migrazione prezzo, omaggio o aperto_dal non applicata): si rilegge senza.
    if (error?.code === "42703") ({ data, error } = await supabase.from("places").select("verified_at, giorni_tranquilli, giorni_tranquilli_at, aperto_dal, omaggio_testo, omaggio_soglia").eq(col, id).limit(1).maybeSingle<Riga>());
    if (error?.code === "42703") ({ data, error } = await supabase.from("places").select("verified_at, giorni_tranquilli, giorni_tranquilli_at, aperto_dal").eq(col, id).limit(1).maybeSingle<Riga>());
    if (error?.code === "42703") ({ data, error } = await supabase.from("places").select("verified_at, giorni_tranquilli, giorni_tranquilli_at").eq(col, id).limit(1).maybeSingle<Riga>());
    // Ancora 42703 (nemmeno le serate): nessuna riga, la scheda non cambia.
    if (error?.code === "42703") ({ data, error } = { data: null, error: null });
    if (error) console.error("[serate] lettura:", error.message);
    if (!data?.verified_at) return NextResponse.json(VUOTO, NO_STORE);
    return NextResponse.json({ verificato: true, giorni: pulisciGiorni(data.giorni_tranquilli), at: data.giorni_tranquilli_at ?? null, apertoDal: pulisciApertoDal(data.aperto_dal), omaggio: pulisciOmaggio(data.omaggio_testo, data.omaggio_soglia), prezzo: pulisciPrezzo(data.prezzo_min, data.prezzo_max, data.prezzo_bevande), feste: pulisciMenuFeste(data.feste_prezzo, data.feste_bevande, data.feste_giorni, data.feste_gruppi, data.feste_at) }, NO_STORE);
  } catch (err) {
    console.error("[serate] lettura fallita:", err instanceof Error ? err.message : err);
    return NextResponse.json(VUOTO, NO_STORE);
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id.trim() : "";
  const conGiorni = Array.isArray(body?.giorni);
  const conApertura = body != null && typeof body === "object" && "apertoDal" in body;
  const conOmaggio = body != null && typeof body === "object" && "omaggio" in body;
  const conPrezzo = body != null && typeof body === "object" && "prezzo" in body;
  // prezzo: { min, max, bevande } valido (euro interi 1..500, min ≤ max) oppure null per toglierlo.
  const prezzo = conPrezzo ? pulisciPrezzo(body.prezzo?.min, body.prezzo?.max, body.prezzo?.bevande) : null;
  // Revisore 3 (17/11): "bevande" deve essere proprio sì/no (una stringa "true" non diventa "escluse" in silenzio).
  if (conPrezzo && body.prezzo != null && body.prezzo?.bevande !== undefined && typeof body.prezzo?.bevande !== "boolean") return NextResponse.json({ error: "Bevande incluse: sì o no." }, { status: 400 });
  if (conPrezzo && body.prezzo != null && !prezzo) return NextResponse.json({ error: "Scrivi due cifre in euro tra 1 e 500, la prima non più alta della seconda." }, { status: 400 });
  // feste: { prezzo, bevande, giorni, gruppi } valido oppure null per toglierlo; si scrive solo nella stagione (1/11–6/1).
  const conFeste = body != null && typeof body === "object" && "feste" in body;
  const at0 = new Date().toISOString();
  const feste = conFeste && body.feste != null ? pulisciMenuFeste(body.feste?.prezzo, body.feste?.bevande, body.feste?.giorni, body.feste?.gruppi, at0) : null;
  if (conFeste && body.feste != null && typeof body.feste?.bevande !== "boolean") return NextResponse.json({ error: "Bevande incluse: sì o no." }, { status: 400 });
  // Revisore 27/11: un giorno sconosciuto non si scarta in silenzio.
  if (conFeste && body.feste != null && Array.isArray(body.feste?.giorni) && feste && body.feste.giorni.length !== feste.giorni.length) return NextResponse.json({ error: "Giorni non validi." }, { status: 400 });
  if (conFeste && body.feste != null && !feste) return NextResponse.json({ error: "Scegli almeno un giorno e un prezzo tra 1 e 500 €." }, { status: 400 });
  if (conFeste && body.feste != null && stagioneMenu(oggiRomaFeste()) == null) return NextResponse.json({ error: "Il menu delle feste si scrive dal 1 novembre al 6 gennaio." }, { status: 409 });
  // Revisore 26/11: un menu con soli giorni già passati non si vedrebbe mai.
  if (conFeste && feste && giorniValidi(feste, oggiRomaFeste()).length === 0) return NextResponse.json({ error: "I giorni scelti sono già passati." }, { status: 400 });
  // omaggio: { testo, soglia } valido oppure null per spegnerlo; un testo non valido (vuoto, denaro) è un errore.
  const omaggio = conOmaggio ? pulisciOmaggio(body.omaggio?.testo, body.omaggio?.soglia) : null;
  // apertoDal: "AAAA-MM" (non futuro) oppure null per toglierlo.
  const apertoDal = conApertura ? pulisciApertoDal(body.apertoDal) : null;
  if (conOmaggio && body.omaggio != null && !omaggio) return NextResponse.json({ error: "Scrivi un omaggio breve (2–40 lettere), senza sconti né euro." }, { status: 400 });
  if (!UUID_RE.test(id) || (!conGiorni && !conApertura && !conOmaggio && !conPrezzo && !conFeste) || (conApertura && body.apertoDal != null && !apertoDal)) return NextResponse.json({ error: "Richiesta non valida" }, { status: 400 });
  const giorni = conGiorni ? pulisciGiorni(body.giorni) : [];
  const at = new Date().toISOString();

  if (dev()) {
    const jar = await cookies();
    const raw = jar.get("e2e_serate")?.value;
    let prev: Record<string, unknown> = {};
    try { prev = raw ? JSON.parse(decodeURIComponent(raw)) : {}; } catch { /* cookie rovinato */ }
    if (prev.id !== id) return NextResponse.json({ error: "Non puoi modificare questo locale" }, { status: 403 });
    const next = { ...prev, ...(conGiorni ? { giorni, at } : {}), ...(conApertura ? { apertoDal } : {}), ...(conOmaggio ? { omaggio } : {}), ...(conPrezzo ? { prezzo } : {}), ...(conFeste ? { feste } : {}) };
    jar.set("e2e_serate", encodeURIComponent(JSON.stringify(next)), { path: "/" });
    return NextResponse.json({ giorni: pulisciGiorni(next.giorni), at: (next.at as string) ?? null, apertoDal: pulisciApertoDal(next.apertoDal), ...(conOmaggio ? { omaggio } : {}), ...(conPrezzo ? { prezzo } : {}), ...(conFeste ? { feste } : {}) });
  }

  if (!(await puoGestireLocale(id))) return NextResponse.json({ error: "Non puoi modificare questo locale" }, { status: 403 });
  const db = createAdminClient();
  // Proposta 72: com'erano i giorni prima, per avvisare chi segue il locale solo se ne arrivano di nuovi.
  const { data: prima } = conGiorni
    ? await db.from("places").select("name, giorni_tranquilli, giorni_tranquilli_at").eq("id", id).maybeSingle<{ name: string | null; giorni_tranquilli: number[] | null; giorni_tranquilli_at: string | null }>()
    : { data: null };
  const { data, error } = await db
    .from("places")
    .update({
      ...(conGiorni ? { giorni_tranquilli: giorni.length ? giorni : null, giorni_tranquilli_at: giorni.length ? at : null } : {}),
      ...(conApertura ? { aperto_dal: apertoDal ? `${apertoDal}-01` : null } : {}),
      ...(conOmaggio ? { omaggio_testo: omaggio?.testo ?? null, omaggio_soglia: omaggio?.soglia ?? null } : {}),
      ...(conPrezzo ? { prezzo_min: prezzo?.min ?? null, prezzo_max: prezzo?.max ?? null, prezzo_bevande: prezzo ? prezzo.bevande : null } : {}),
      ...(conFeste ? { feste_prezzo: feste?.prezzo ?? null, feste_bevande: feste ? feste.bevande : null, feste_giorni: feste?.giorni ?? null, feste_gruppi: feste?.gruppi ?? null, feste_at: feste ? feste.at : null } : {}),
    })
    .eq("id", id)
    .not("verified_at", "is", null)
    .select("id");
  if (error) {
    console.error("[serate] scrittura:", error.code, error.message);
    if (conFeste && error.code === "42703") return NextResponse.json({ error: "Il menu delle feste non è ancora attivo. Riprova tra poco." }, { status: 503 });
    if (conPrezzo && error.code === "42703") return NextResponse.json({ error: "Il prezzo a testa non è ancora attivo. Riprova tra poco." }, { status: 503 });
    return NextResponse.json({ error: "Non sono riuscito a salvare. Riprova tra poco." }, { status: 500 });
  }
  if (!data?.length) return NextResponse.json({ error: "Prima serve la verifica del locale." }, { status: 409 });
  if (conGiorni && prima?.name && giorniNuovi({ giorni: prima.giorni_tranquilli, at: prima.giorni_tranquilli_at }, giorni)) {
    const nome = prima.name;
    after(() => avvisaChiSegue(id, nome, giorni).catch((e) => console.warn("[avvisi-posto] invio:", e instanceof Error ? e.message : e)));
  }
  // Solo quello che è stato scritto: un POST con il solo mese non dice niente delle serate.
  return NextResponse.json({ ...(conGiorni ? { giorni, at: giorni.length ? at : null } : {}), ...(conApertura ? { apertoDal } : {}), ...(conOmaggio ? { omaggio } : {}), ...(conPrezzo ? { prezzo } : {}), ...(conFeste ? { feste } : {}) });
}
