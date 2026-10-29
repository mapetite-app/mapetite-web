import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { avvisoDelGiorno, inviaAvviso, pushConfigurato } from "@/lib/push-server";
import { oggiRoma } from "@/lib/stasera";

// Avviso del giorno (proposta 6), una volta al giorno dal cron di Vercel (vercel.json): a chi ha
// acceso gli avvisi e ha segnato un posto per oggi con "Quando ci vai?" (saved_places.piano_al).
// Al massimo UN avviso per persona al giorno. Nessuna chiamata Google o AI.
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
  if (perUtente.size === 0) return NextResponse.json({ inviati: 0 });

  const { data: subs } = await admin.from("push_subscriptions").select("id, user_id, endpoint, p256dh, auth").in("user_id", [...perUtente.keys()]);
  let inviati = 0;
  const scadute: string[] = [];
  for (const s of subs ?? []) {
    const esito = await inviaAvviso(s, avvisoDelGiorno(perUtente.get(s.user_id) ?? [], sabato));
    if (esito === "ok") inviati++;
    if (esito === "scaduta") scadute.push(s.id);
  }
  if (scadute.length > 0) await admin.from("push_subscriptions").delete().in("id", scadute);
  console.log(`[cron-avvisi] ${oggi} persone=${perUtente.size} iscrizioni=${subs?.length ?? 0} inviati=${inviati} scadute=${scadute.length}`);
  return NextResponse.json({ inviati, scadute: scadute.length });
}
