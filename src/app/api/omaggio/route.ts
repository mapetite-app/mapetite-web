import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { giornoItalia, prossimoOmaggio, pulisciOmaggio, OMAGGIO_OGNI_GIORNI } from "@/lib/omaggio";
import { codiceDelGiorno } from "@/lib/omaggio-server";

// "Grazie di essere tornato" (PROPOSTE.md 12; migrazione 20261030b_omaggio.sql).
// POST { id: UUID del locale } → la persona mostra l'omaggio al tavolo. Controlli sul server:
// locale verificato con un omaggio acceso, almeno `soglia` visite segnate in saved_places.visite,
// e nessun omaggio di quel locale negli ultimi 30 giorni. La vicinanza al locale la controlla il
// telefono (la posizione non esce mai dal telefono). Risposte:
//   200 { testo, giorno, codice, volta }  → schermata da mostrare al personale (si registra il giorno)
//   409 { usatoIl, prossimo }             → già usato negli ultimi 30 giorni
//   403 { soglia, visite }                → non ancora abbastanza visite
//   404                                   → nessun omaggio acceso
// Nessuna chiamata a Google.

const NO_STORE = { headers: { "Cache-Control": "private, no-store" } };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Solo in sviluppo con E2E_FAKE_USER: omaggio dal cookie "e2e_serate" (come la riga della scheda),
// visite dal corpo della richiesta, giorno usato nel cookie "e2e_omaggio".
const dev = () => process.env.NODE_ENV === "development" && !!process.env.E2E_FAKE_USER;

function esito(o: { testo: string; soglia: number }, id: string, visite: number, ultimo: string | null) {
  const oggi = giornoItalia();
  if (visite < o.soglia) return NextResponse.json({ soglia: o.soglia, visite }, { status: 403, ...NO_STORE });
  // Lo stesso giorno si può riaprire la schermata (telefono chiuso al tavolo): stesso codice, nessuna riga in più.
  if (ultimo && ultimo !== oggi && prossimoOmaggio(ultimo) > oggi) return NextResponse.json({ usatoIl: ultimo, prossimo: prossimoOmaggio(ultimo) }, { status: 409, ...NO_STORE });
  return NextResponse.json({ testo: o.testo, giorno: oggi, codice: codiceDelGiorno(id, oggi), volta: visite, nuovo: ultimo !== oggi }, NO_STORE);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id.trim() : "";
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Richiesta non valida" }, { status: 400 });

  if (dev()) {
    const jar = await cookies();
    let v: { id?: string; verificato?: boolean; omaggio?: { testo?: string; soglia?: number } } = {};
    try { v = JSON.parse(decodeURIComponent(jar.get("e2e_serate")?.value ?? "{}")); } catch { /* cookie rovinato */ }
    const o = v.id === id && v.verificato ? pulisciOmaggio(v.omaggio?.testo, v.omaggio?.soglia) : null;
    if (!o) return NextResponse.json({ error: "Nessun omaggio" }, { status: 404 });
    const usati: Record<string, string> = (() => { try { return JSON.parse(decodeURIComponent(jar.get("e2e_omaggio")?.value ?? "{}")); } catch { return {}; } })();
    const r = esito(o, id, Number(body?.visite) || 0, usati[id] ?? null);
    if (r.status === 200) jar.set("e2e_omaggio", encodeURIComponent(JSON.stringify({ ...usati, [id]: giornoItalia() })), { path: "/" });
    return r;
  }

  const { data: auth } = await getUser();
  const user = auth?.user;
  if (!user) return NextResponse.json({ error: "Accedi per usare l'omaggio" }, { status: 401 });
  try {
    const db = createAdminClient();
    const { data: locale, error: lErr } = await db.from("places").select("verified_at, omaggio_testo, omaggio_soglia").eq("id", id).maybeSingle<{ verified_at: string | null; omaggio_testo: string | null; omaggio_soglia: number | null }>();
    if (lErr && lErr.code !== "42703") console.error("[omaggio] lettura locale:", lErr.code, lErr.message);
    const o = locale?.verified_at ? pulisciOmaggio(locale.omaggio_testo, locale.omaggio_soglia) : null;
    if (!o) return NextResponse.json({ error: "Nessun omaggio" }, { status: 404 });

    const { data: salvato } = await db.from("saved_places").select("visite").eq("user_id", user.id).eq("place_id", id).maybeSingle<{ visite: number | null }>();
    const visite = typeof salvato?.visite === "number" ? salvato.visite : 0;

    const da = new Date(Date.now() - (OMAGGIO_OGNI_GIORNI + 1) * 86_400_000).toISOString().slice(0, 10);
    const { data: usati, error: uErr } = await db.from("omaggi_usati").select("giorno").eq("user_id", user.id).eq("place_id", id).gte("giorno", da).order("giorno", { ascending: false }).limit(1);
    if (uErr) {
      console.error("[omaggio] lettura usati:", uErr.code, uErr.message);
      return NextResponse.json({ error: "Non riesco a controllare l'omaggio. Riprova tra poco." }, { status: 500 });
    }
    const r = esito(o, id, visite, (usati?.[0] as { giorno?: string } | undefined)?.giorno ?? null);
    if (r.status === 200) {
      const { error } = await db.from("omaggi_usati").upsert({ user_id: user.id, place_id: id, giorno: giornoItalia() }, { onConflict: "user_id,place_id,giorno", ignoreDuplicates: true });
      if (error) {
        console.error("[omaggio] scrittura:", error.code, error.message);
        return NextResponse.json({ error: "Non riesco a registrare l'omaggio. Riprova tra poco." }, { status: 500 });
      }
    }
    return r;
  } catch (err) {
    console.error("[omaggio] fallito:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Non riesco a controllare l'omaggio. Riprova tra poco." }, { status: 500 });
  }
}
