import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";
import { PAUSA_GIORNI, testoAvvisoPosto } from "@/lib/serate";

// Invio degli avvisi push (proposta 6). Chiavi VAPID solo lato server: VAPID_PUBLIC_KEY,
// VAPID_PRIVATE_KEY e VAPID_SUBJECT (un "mailto:"). Senza, niente avvisi e nessun errore.
// Il servizio push del browser (Google, Apple, Mozilla) è gratuito.

export type Avviso = { title: string; body: string; url: string; tag?: string };
export type Iscrizione = { endpoint: string; p256dh: string; auth: string };

export function pushConfigurato(): boolean {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT);
}

let pronto = false;
function prepara() {
  if (pronto) return;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT!, process.env.VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
  pronto = true;
}

/** "ok", "scaduta" (il telefono ha tolto l'iscrizione: va cancellata) o "errore". */
export async function inviaAvviso(sub: Iscrizione, avviso: Avviso): Promise<"ok" | "scaduta" | "errore"> {
  prepara();
  try {
    await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify(avviso), { TTL: 6 * 3600, urgency: "normal" });
    return "ok";
  } catch (e) {
    const status = (e as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) return "scaduta";
    console.warn(`[push] invio non riuscito ${status ?? ""}`);
    return "errore";
  }
}

// "Ci vai domani?" (proposta 36): la sera prima di una prenotazione sull'account, a chi non ha ancora
// risposto. Il tocco apre la home, dove c'è "Sì, ci vado / Non più".
export function avvisoPrenotazioneDomani(nome: string, ora: string | null): Avviso {
  return {
    title: `Domani${ora ? ` alle ${ora}` : ""} da ${nome}`,
    body: "Ci vai? Se non puoi più, avvisa il locale in un tocco.",
    url: "/",
    tag: "prenotazione-domani",
  };
}

// Il giorno del tavolo (Lorenzo, 8/11): "Stasera alle 21:00 da Nome". Il tocco apre la home, dove c'è
// il promemoria con "Portami lì" e "Chiama".
export function avvisoPrenotazioneOggi(nome: string, ora: string | null): Avviso {
  const sera = ora ? Number(ora.slice(0, 2)) >= 18 : true;
  return {
    title: `${sera ? "Stasera" : "Oggi"}${ora ? ` alle ${ora}` : ""} da ${nome}`,
    body: "Indicazioni e numero del locale in un tocco.",
    url: "/",
    tag: "prenotazione-oggi",
  };
}

/** Testo dell'avviso del giorno: "Stasera: Trattoria da Mario" o "Stasera: Da Mario e altri 2". */
export function avvisoDelGiorno(nomi: string[], sabato: boolean): Avviso {
  const quando = sabato ? "Oggi" : "Stasera";
  const primo = nomi[0] ?? "il posto che hai segnato";
  const altri = nomi.length - 1;
  return {
    title: `${quando}: ${primo}${altri > 0 ? ` e ${altri === 1 ? "un altro" : `altri ${altri}`}` : ""}`,
    body: altri > 0 ? "Li avevi segnati per oggi. Scegli in un tocco." : "L'avevi segnato per oggi. Orari e indicazioni in un tocco.",
    url: "/stasera",
    tag: "piano-del-giorno",
  };
}

// "Avvisami quando c'è posto" (PROPOSTE.md 72): il titolare di un locale verificato ha appena segnato giorni nuovi
// con posto. Avvisa chi lo segue (avvisi_posto), al massimo una volta ogni 6 giorni per locale. Parte dopo la
// risposta al titolare (after), con la chiave di servizio. Nessuna chiamata Google o AI.
// Le righe si prenotano in un solo UPDATE (avvisato_at = adesso, solo se libere): due salvataggi di fila del
// titolare non mandano due avvisi. Chi non è stato raggiunto (nessun telefono iscritto) torna com'era.
export async function avvisaChiSegue(placeId: string, nome: string, giorni: number[]): Promise<{ inviati: number }> {
  if (!pushConfigurato() || !process.env.SUPABASE_SECRET_KEY) return { inviati: 0 };
  const testo = testoAvvisoPosto(nome, giorni);
  if (!testo) return { inviati: 0 };
  const admin = createAdminClient();
  const adesso = new Date().toISOString();
  const soglia = new Date(Date.now() - PAUSA_GIORNI * 86_400_000).toISOString();
  const { data: righe, error } = await admin
    .from("avvisi_posto")
    .update({ avvisato_at: adesso })
    .eq("place_id", placeId)
    .or(`avvisato_at.is.null,avvisato_at.lte.${soglia}`)
    .select("user_id");
  if (error) { console.warn(`[avvisi-posto] prenotazione ${error.code ?? ""}`); return { inviati: 0 }; }
  const prenotati = (righe ?? []).map((r) => r.user_id as string);
  if (prenotati.length === 0) return { inviati: 0 };
  // Solo chi ha ancora il locale tra i salvati: tolto il salvato, l'avviso non parte più.
  const { data: ancora } = await admin.from("saved_places").select("user_id").eq("place_id", placeId).in("user_id", prenotati);
  const salvati = new Set((ancora ?? []).map((r) => r.user_id as string));
  const utenti = prenotati.filter((u) => salvati.has(u));
  if (utenti.length === 0) {
    await admin.from("avvisi_posto").update({ avvisato_at: null }).eq("place_id", placeId).eq("avvisato_at", adesso).in("user_id", prenotati);
    return { inviati: 0 };
  }
  const { data: subs } = await admin.from("push_subscriptions").select("id, user_id, endpoint, p256dh, auth").in("user_id", utenti);
  const avviso: Avviso = { ...testo, url: `/locali/${placeId}`, tag: `posto-${placeId}` };
  let inviati = 0;
  const raggiunti = new Set<string>();
  const scadute: string[] = [];
  for (const s of subs ?? []) {
    const esito = await inviaAvviso(s, avviso);
    if (esito === "ok") { inviati++; raggiunti.add(s.user_id); }
    if (esito === "scaduta") scadute.push(s.id);
  }
  if (scadute.length > 0) await admin.from("push_subscriptions").delete().in("id", scadute);
  // Non raggiunti: l'avviso non è arrivato, quindi la pausa non parte (alla prossima occasione ci si riprova).
  const mancati = prenotati.filter((u) => !raggiunti.has(u));
  if (mancati.length > 0) await admin.from("avvisi_posto").update({ avvisato_at: null }).eq("place_id", placeId).eq("avvisato_at", adesso).in("user_id", mancati);
  console.log(`[avvisi-posto] locale=${placeId} prenotati=${utenti.length} iscrizioni=${subs?.length ?? 0} inviati=${inviati} scadute=${scadute.length}`);
  return { inviati };
}
