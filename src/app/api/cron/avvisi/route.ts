import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { avvisoDelGiorno, avvisoPrenotazioneDomani, avvisoPrenotazioneOggi, inviaAvviso, pushConfigurato, type Avviso } from "@/lib/push-server";
import { oggiRoma } from "@/lib/stasera";

// Avviso del giorno (proposta 6; dall'8/11 prima il tavolo di oggi), una volta al giorno dal cron di Vercel (vercel.json): a chi ha
// acceso gli avvisi e ha segnato un posto per oggi con "Quando ci vai?" (saved_places.piano_al).
// Poi (proposta 36) "Ci vai domani?" a chi ha una prenotazione per domani sull'account e non ha ancora
// risposto né disdetto. Al massimo UN avviso per persona al giorno: vince il posto di oggi. Nessuna chiamata Google o AI.
// Vercel manda "Authorization: Bearer $CRON_SECRET": senza quel segreto non parte niente.

export const maxDuration = 60;

type Riga = { user_id: string; places: { name: string | null } | null };

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Non autorizzato." }, { status: 401 });
  }
  if (!pushConfigurato() || !process.env.SUPABASE_SECRET_KEY) return NextResponse.json({ inviati: 0, motivo: "avvisi non configurati" });

  const admin = createAdminClient();
  const oggi = oggiRoma();
  const sabato = new Date(`${oggi}T12:00:00Z`).getUTCDay() === 6;
  const { data: piani, error } = await admin.from("saved_places").select("user_id, places(name)").eq("piano_al", oggi).limit(2000);
  if (error) {
    console.warn(`[cron-avvisi] lettura piani ${error.code ?? ""}`);
    return NextResponse.json({ error: "Lettura non riuscita." }, { status: 500 });
  }
  const perUtente = new Map<string, string[]>();
  for (const r of (piani ?? []) as unknown as Riga[]) {
    const nomi = perUtente.get(r.user_id) ?? [];
    if (r.places?.name) nomi.push(r.places.name);
    perUtente.set(r.user_id, nomi);
  }
  const avvisi = new Map<string, Avviso>();
  // Il tavolo di oggi (Lorenzo, 8/11) viene prima di tutto: è l'avviso più utile della giornata.
  // Solo prenotazioni sull'account (consenso) con il sì della persona, ancora da fare e con l'ora non già passata.
  const oraRoma = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Rome", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date());
  const { data: prenOggi, error: errOggi } = await admin
    .from("prenotazioni")
    .select("user_id, dati")
    .eq("giorno", oggi)
    .is("cancellata_at", null)
    .is("esito", null)
    .is("disdetta_at", null)
    .limit(2000);
  if (errOggi) console.warn(`[cron-avvisi] lettura prenotazioni di oggi ${errOggi.code ?? ""}`);
  let oggiN = 0;
  for (const r of ((prenOggi ?? []) as { user_id: string; dati: Record<string, unknown> | null }[]).sort((a, c) => String(a.dati?.time ?? "").localeCompare(String(c.dati?.time ?? "")))) {
    const d = r.dati ?? {};
    const ora = typeof d.time === "string" && /^\d{2}:\d{2}$/.test(d.time) ? d.time : null;
    if (avvisi.has(r.user_id) || d.confirmed !== true || d.dismissed || typeof d.placeName !== "string" || (ora && ora <= oraRoma)) continue;
    avvisi.set(r.user_id, avvisoPrenotazioneOggi(d.placeName, ora));
    oggiN++;
  }
  for (const [u, nomi] of perUtente) if (!avvisi.has(u)) avvisi.set(u, avvisoDelGiorno(nomi, sabato));

  const domani = new Date(`${oggi}T12:00:00Z`);
  domani.setUTCDate(domani.getUTCDate() + 1);
  const { data: pren, error: errPren } = await admin
    .from("prenotazioni")
    .select("user_id, dati")
    .eq("giorno", domani.toISOString().slice(0, 10))
    .is("cancellata_at", null)
    .is("esito", null)
    .is("disdetta_at", null)
    .limit(2000);
  if (errPren) console.warn(`[cron-avvisi] lettura prenotazioni ${errPren.code ?? ""}`);
  let domaniN = 0;
  for (const r of (pren ?? []) as { user_id: string; dati: Record<string, unknown> | null }[]) {
    const d = r.dati ?? {};
    if (avvisi.has(r.user_id) || d.ciVado || d.dismissed || d.dismissedEve || typeof d.placeName !== "string") continue;
    avvisi.set(r.user_id, avvisoPrenotazioneDomani(d.placeName, typeof d.time === "string" ? d.time : null));
    domaniN++;
  }
  if (avvisi.size === 0) return NextResponse.json({ inviati: 0 });

  const { data: subs } = await admin.from("push_subscriptions").select("id, user_id, endpoint, p256dh, auth").in("user_id", [...avvisi.keys()]);
  let inviati = 0;
  const scadute: string[] = [];
  for (const s of subs ?? []) {
    const esito = await inviaAvviso(s, avvisi.get(s.user_id)!);
    if (esito === "ok") inviati++;
    if (esito === "scaduta") scadute.push(s.id);
  }
  if (scadute.length > 0) await admin.from("push_subscriptions").delete().in("id", scadute);
  console.log(`[cron-avvisi] ${oggi} persone=${avvisi.size} oggi=${oggiN} domani=${domaniN} iscrizioni=${subs?.length ?? 0} inviati=${inviati} scadute=${scadute.length}`);
  return NextResponse.json({ inviati, scadute: scadute.length });
}
