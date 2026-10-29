// Avvisi push dal browser (proposta 6): registrazione del service worker e iscrizione, solo su
// richiesta della persona. La chiave pubblica arriva dal server (/api/push/chiave): senza chiavi
// VAPID configurate gli avvisi semplicemente non compaiono.

export type PushStato = "non_supportato" | "ios_da_installare" | "spento" | "acceso" | "negato";

let chiave: Promise<string | null> | null = null;
export function chiavePubblica(): Promise<string | null> {
  chiave ??= fetch("/api/push/chiave")
    .then((r) => (r.ok ? r.json() : null))
    .then((d: { key?: unknown } | null) => (typeof d?.key === "string" && d.key ? d.key : null))
    .catch(() => null);
  return chiave;
}

function isIos(): boolean {
  return /iPhone|iPad|iPod/.test(navigator.userAgent);
}
function installata(): boolean {
  return window.matchMedia?.("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
}

export async function statoPush(): Promise<PushStato> {
  if (typeof window === "undefined") return "non_supportato";
  // Su iPhone gli avvisi ci sono solo con l'app aggiunta alla schermata Home (iOS 16.4+).
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    return isIos() && !installata() ? "ios_da_installare" : "non_supportato";
  }
  if (Notification.permission === "denied") return "negato";
  const reg = await navigator.serviceWorker.getRegistration("/");
  const sub = reg ? await reg.pushManager.getSubscription() : null;
  return sub ? "acceso" : "spento";
}

function base64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** Prima di "Esci": il telefono non riceve più gli avvisi di questo account (telefono condiviso). */
export async function spegniPerUscita(): Promise<void> {
  await Promise.race([spegniPush().catch(() => {}), new Promise((r) => setTimeout(r, 1500))]);
}

/** Chiede il permesso, si iscrive e salva l'iscrizione sul server. Lancia un errore leggibile. */
export async function accendiPush(): Promise<void> {
  const key = await chiavePubblica();
  if (!key) throw new Error("Gli avvisi non sono ancora attivi.");
  const permesso = await Notification.requestPermission();
  if (permesso !== "granted") throw new Error("Hai detto no agli avvisi: puoi cambiarlo nelle impostazioni del telefono.");
  const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
  await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64ToBytes(key) }));
  const res = await fetch("/api/push/iscrizione", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(sub.toJSON()) });
  if (!res.ok) {
    await sub.unsubscribe().catch(() => {});
    throw new Error("Non sono riuscito ad accendere gli avvisi: riprova.");
  }
}

export async function spegniPush(): Promise<void> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  const reg = await navigator.serviceWorker.getRegistration("/");
  const sub = reg ? await reg.pushManager.getSubscription() : null;
  if (!sub) return;
  await fetch("/api/push/iscrizione", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) }).catch(() => {});
  await sub.unsubscribe();
}
