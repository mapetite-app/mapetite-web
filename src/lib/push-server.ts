import webpush from "web-push";

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
