import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { puoGestireLocale } from "@/lib/ristoratore-accesso";
import { cityFromAddress } from "@/lib/city";
import { computeRistoratore, type RistEvento, type RistLocale, type RistSalvataggio } from "@/lib/ristoratore";
import { pulisciGiorni } from "@/lib/serate";
import { pulisciApertoDal } from "@/lib/aperto-dal";
import { giornoItalia, pulisciOmaggio, OMAGGIO_OGNI_GIORNI, type Omaggio } from "@/lib/omaggio";
import { codiceDelGiorno } from "@/lib/omaggio-server";
import { dateKey, prenotazioniAlLocale, type BookingRequest } from "@/lib/booking";
import { pulisciPrenotazione } from "@/lib/prenotazioni-account";
import Pannello, { PERIODI } from "../pannello";

// Pannello del ristoratore (PIANO-25-OTTOBRE.md 8.2), id = UUID del locale in places.
// Lo vedono solo gli admin (src/lib/admin.ts) e il titolare con una richiesta verificata
// (tabella claims, migrazione 20261015_ristoratori.sql). Per tutti gli altri la pagina non
// esiste (404). Legge events e saved_places con la chiave di servizio, solo dal server: al
// telefono arrivano solo numeri aggregati.
export const metadata: Metadata = { title: "Pannello del ristoratore · Mapetite", robots: { index: false, follow: false } };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PLACE_COLS = "id, name, address, category, lat, lng, google_place_id";
const TIPI = ["ricerca", "apri_scheda", "salva", "ci_sono_stato", "percorso", "chiama", "sito"];
const PAGE = 1000;
const MAX_ROWS = 50_000;

type Serate = { giorni: number[]; at: string | null; apertoDal: string | null; omaggio?: Omaggio | null; codiceOggi?: string | null; omaggiMostrati?: number };
type Prenotazioni = { tavoli: number; diParola: number; persone: number };
type Dati = { locale: RistLocale; citta: string | null; simili: RistLocale[]; eventi: RistEvento[]; salvati: RistSalvataggio[]; attesa: RistSalvataggio[]; verificato: boolean; avviso: string | null; serate: Serate; prenotazioni: Prenotazioni | null };

// Tavoli chiesti da Mapetite nel periodo (dalla data della richiesta, come gli altri numeri).
const inizioPeriodo = (giorni: number) => Date.now() - giorni * 86_400_000;
function contaPrenotazioni(righe: { user_id: unknown; dati: unknown }[], locale: RistLocale, giorni: number): Prenotazioni {
  const tutte = righe.flatMap((r) => { const p = pulisciPrenotazione(r.dati); return p && typeof r.user_id === "string" ? [{ utente: r.user_id, p: p as BookingRequest }] : []; });
  return prenotazioniAlLocale(tutte, [locale.id, ...(locale.google_place_id ? [locale.google_place_id] : [])], inizioPeriodo(giorni));
}

// Solo in sviluppo con E2E_FAKE_USER: dati finti dal cookie "e2e_ristoratore" (scritto da
// scripts/e2e/giro.mjs), perché il giro non può leggere il database. Senza cookie si passa
// dal controllo vero dell'accesso (e il giro, senza accesso, riceve 404).
async function e2eDati(id: string): Promise<Dati | null> {
  if (process.env.NODE_ENV !== "development" || !process.env.E2E_FAKE_USER) return null;
  const raw = (await cookies()).get("e2e_ristoratore")?.value;
  if (!raw) return null;
  try {
    const v = JSON.parse(decodeURIComponent(raw));
    if (v?.locale?.id !== id) return null;
    const giorni = PERIODI.find((p) => String(p) === String(v.giorni)) ?? 30;
    const prenotazioni = Array.isArray(v.prenotazioni) ? contaPrenotazioni(v.prenotazioni, v.locale, giorni) : null;
    return { prenotazioni, locale: v.locale, citta: cityFromAddress(v.locale.address), simili: v.simili ?? [], eventi: v.eventi ?? [], salvati: v.salvati ?? [], attesa: v.attesa ?? [], verificato: !!v.verificato, avviso: null, serate: { giorni: pulisciGiorni(v.serate?.giorni), at: v.serate?.at ?? null, apertoDal: pulisciApertoDal(v.serate?.apertoDal), omaggio: pulisciOmaggio(v.serate?.omaggio?.testo, v.serate?.omaggio?.soglia), codiceOggi: codiceDelGiorno(id, giornoItalia()), omaggiMostrati: Number(v.serate?.omaggiMostrati) || 0 } };
  } catch {
    return null;
  }
}

async function carica(id: string, giorni: number): Promise<Dati | null> {
  const db = createAdminClient();
  let verificato = false;
  let { data: locale, error } = await db.from("places").select(`${PLACE_COLS}, verified_at`).eq("id", id).maybeSingle<RistLocale & { verified_at: string | null }>();
  if (error?.code === "42703") ({ data: locale, error } = await db.from("places").select(PLACE_COLS).eq("id", id).maybeSingle<RistLocale & { verified_at: string | null }>());
  if (error) console.error("[ristoratore] lettura places:", error.message);
  if (!locale) return null;
  verificato = !!locale.verified_at;
  const citta = cityFromAddress(locale.address);

  // Locali simili: stessa categoria e stessa città (dall'indirizzo, come nel resto dell'app).
  let simili: RistLocale[] = [locale];
  if (locale.category && citta) {
    const { data } = await db.from("places").select(PLACE_COLS).eq("category", locale.category).ilike("address", `%${citta}%`).limit(500);
    simili = ((data ?? []) as RistLocale[]).filter((p) => cityFromAddress(p.address) === citta);
    if (!simili.some((p) => p.id === locale.id)) simili.push(locale);
  }

  // Eventi del periodo e di quello precedente (per la variazione), a pagine da 1000.
  const since = new Date(Date.now() - (2 * giorni + 1) * 86_400_000).toISOString();
  let cols = "created_at,type,user_id,anon_id,session_id,place_id,google_place_id,lat,lng,props";
  const eventi: RistEvento[] = [];
  let avviso: string | null = null;
  for (let from = 0; from < MAX_ROWS; from += PAGE) {
    const { data, error: e } = await db.from("events").select(cols).in("type", TIPI).gte("created_at", since).order("id", { ascending: true }).range(from, from + PAGE - 1);
    if (e) {
      if (from === 0 && cols.includes("session_id") && /session_id/.test(e.message)) {
        cols = cols.replace("session_id,", "");
        from -= PAGE;
        continue;
      }
      avviso = e.code === "42P01" || e.code === "PGRST205" ? "Il registro delle visite non è ancora attivo: i numeri compariranno appena lo sarà." : `Lettura dei numeri non riuscita (${e.code}).`;
      break;
    }
    eventi.push(...((data ?? []) as unknown as RistEvento[]));
    if (!data || data.length < PAGE) break;
  }

  // Disdette fatte da Mapetite ("Non vado più"): poche righe, lette a parte per non caricare tutti gli
  // altri segnali "funzione".
  if (!avviso) {
    const { data: dd, error: dErr } = await db.from("events").select(cols).eq("type", "funzione").eq("props->>nome", "prenotazione_disdetta").gte("created_at", since).limit(5000);
    if (dErr) console.error("[ristoratore] lettura disdette:", dErr.message);
    eventi.push(...((dd ?? []) as unknown as RistEvento[]));
  }

  // Salvataggi veri (anche quelli fatti prima che esistesse il segnale "salva").
  const salvati: RistSalvataggio[] = [];
  const ids = simili.map((p) => p.id);
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await db.from("saved_places").select("place_id,user_id,created_at,tags").in("place_id", ids.slice(i, i + 200)).gte("created_at", since);
    salvati.push(...((data ?? []) as RistSalvataggio[]));
  }
  // Tutti i salvataggi del locale, anche vecchi (non solo del periodo): chi lo vuole ancora provare.
  // "visite" (posti fissi, 20261020b_visite.sql): senza la colonna si rilegge senza.
  const leggiTutti = (cols: string) => db.from("saved_places").select(cols).eq("place_id", id).limit(5000).returns<RistSalvataggio[]>();
  let { data: tutti, error: aErr } = await leggiTutti("place_id,user_id,created_at,tags,visited_at,visite");
  if (aErr?.code === "42703") ({ data: tutti, error: aErr } = await leggiTutti("place_id,user_id,created_at,tags,visited_at"));
  if (aErr) console.error("[ristoratore] lettura salvataggi del locale:", aErr.message);
  const attesa = (tutti ?? []) as RistSalvataggio[];
  // Serate tranquille (migrazione 20261018_serate_tranquille.sql): senza colonne, nessun giorno.
  // "Aperto da poco" (20261020_aperto_dal.sql): senza la colonna si rilegge senza.
  // "Omaggio a chi torna" (20261030b_omaggio.sql): senza colonne, si rilegge senza.
  type Sr = { giorni_tranquilli: number[] | null; giorni_tranquilli_at: string | null; aperto_dal?: string | null; omaggio_testo?: string | null; omaggio_soglia?: number | null };
  let { data: sr, error: srErr } = await db.from("places").select("giorni_tranquilli, giorni_tranquilli_at, aperto_dal, omaggio_testo, omaggio_soglia").eq("id", id).maybeSingle<Sr>();
  if (srErr?.code === "42703") ({ data: sr, error: srErr } = await db.from("places").select("giorni_tranquilli, giorni_tranquilli_at, aperto_dal").eq("id", id).maybeSingle<Sr>());
  if (srErr?.code === "42703") ({ data: sr, error: srErr } = await db.from("places").select("giorni_tranquilli, giorni_tranquilli_at").eq("id", id).maybeSingle<Sr>());
  if (srErr) console.error("[ristoratore] lettura serate:", srErr.message);
  // Omaggi mostrati negli ultimi 30 giorni: la fedeltà misurata (senza tabella: 0).
  const daOmaggi = new Date(Date.now() - OMAGGIO_OGNI_GIORNI * 86_400_000).toISOString().slice(0, 10);
  const { count: omaggiMostrati } = await db.from("omaggi_usati").select("user_id", { count: "exact", head: true }).eq("place_id", id).gte("giorno", daOmaggi);
  const serate = { giorni: pulisciGiorni(sr?.giorni_tranquilli), at: sr?.giorni_tranquilli_at ?? null, apertoDal: pulisciApertoDal(sr?.aperto_dal), omaggio: pulisciOmaggio(sr?.omaggio_testo, sr?.omaggio_soglia), codiceOggi: codiceDelGiorno(id, giornoItalia()), omaggiMostrati: omaggiMostrati ?? 0 };
  // "Cliente di parola", passo 3 (PROPOSTE.md 3): tavoli chiesti da Mapetite, solo dalle prenotazioni
  // che le persone tengono sull'account (con il loro consenso: senza, le righe non esistono). Poi tutte
  // le prenotazioni di quelle persone, per sapere se sono di parola. Al telefono arrivano solo numeri.
  let prenotazioni: Prenotazioni | null = null;
  {
    // Il giorno del tavolo viene sempre dopo la richiesta: filtro largo sull'indice, poi conta la data della richiesta.
    const da = dateKey(new Date(inizioPeriodo(giorni)));
    const posti = [locale.id, ...(locale.google_place_id ? [locale.google_place_id] : [])];
    const { data: qui, error: pErr } = await db.from("prenotazioni").select("user_id").in("place_id", posti).is("cancellata_at", null).gte("giorno", da).limit(2000);
    if (pErr) console.error("[ristoratore] lettura prenotazioni:", pErr.message);
    const persone = [...new Set((qui ?? []).map((r) => r.user_id as string))];
    if (persone.length > 0) {
      const { data: righe, error: tErr } = await db.from("prenotazioni").select("user_id, dati").in("user_id", persone.slice(0, 500)).is("cancellata_at", null).limit(10_000);
      if (tErr) console.error("[ristoratore] lettura prenotazioni delle persone:", tErr.message);
      prenotazioni = contaPrenotazioni(righe ?? [], locale, giorni);
    } else if (!pErr) prenotazioni = { tavoli: 0, diParola: 0, persone: 0 };
  }
  return { locale, citta, simili, eventi, salvati, attesa, verificato, avviso, serate, prenotazioni };
}

export default async function RistoratorePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const sp = await searchParams;
  const giorni = PERIODI.find((p) => String(p) === sp.giorni) ?? 30;

  let dati = await e2eDati(id);
  if (!dati) {
    if (!(await puoGestireLocale(id))) notFound();
    dati = await carica(id, giorni);
    if (!dati) notFound();
  }
  const p = computeRistoratore(dati, giorni);
  return <Pannello p={p} locale={dati.locale} citta={dati.citta} verificato={dati.verificato} base={`/ristoratore/${id}`} avviso={dati.avviso} serate={dati.serate} prenotazioni={dati.prenotazioni} vista={typeof sp.vista === "string" ? sp.vista : undefined} />;
}
