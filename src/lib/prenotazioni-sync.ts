import { ACCOUNT_KEY, loadBookings, sostituisciPrenotazioni } from "@/lib/booking";
import { pulisciPrenotazione, unisciPrenotazioni, type PrenotazioneAccount } from "@/lib/prenotazioni-account";

// Telefono ↔ account per le prenotazioni (solo con il consenso acceso in /prenotazioni).
export type StatoAccount = "fuori" | "spento" | "acceso" | "errore";

function flag(on: boolean) {
  try {
    if (on) window.localStorage.setItem(ACCOUNT_KEY, "1");
    else window.localStorage.removeItem(ACCOUNT_KEY);
  } catch { /* storage non disponibile */ }
}
function remote(v: unknown): PrenotazioneAccount[] {
  return Array.isArray(v) ? v.map(pulisciPrenotazione).filter((p): p is PrenotazioneAccount => p !== null) : [];
}
function unisci(list: PrenotazioneAccount[]) {
  const locali = loadBookings();
  const merged = unisciPrenotazioni(locali, list);
  if (JSON.stringify(merged) !== JSON.stringify(locali)) sostituisciPrenotazioni(merged);
}

// Stato del consenso e, se acceso, prenotazioni dell'account unite a quelle del telefono.
// Le prenotazioni del telefono che l'account non ha ancora vengono caricate.
export async function sincronizzaPrenotazioni(): Promise<StatoAccount> {
  try {
    const res = await fetch("/api/prenotazioni", { cache: "no-store" });
    if (res.status === 401) return "fuori";
    if (!res.ok) return "errore";
    const j = (await res.json()) as { consenso?: boolean; prenotazioni?: unknown };
    if (!j.consenso) { flag(false); return "spento"; }
    flag(true);
    const list = remote(j.prenotazioni);
    unisci(list);
    const ids = new Set(list.map((p) => p.id));
    const mancanti = loadBookings().filter((b) => !ids.has(b.id));
    if (mancanti.length > 0) {
      await fetch("/api/prenotazioni", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prenotazioni: mancanti }) }).catch(() => null);
    }
    return "acceso";
  } catch {
    return "errore";
  }
}

export async function accendiPrenotazioniAccount(): Promise<boolean> {
  try {
    const res = await fetch("/api/prenotazioni", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prenotazioni: loadBookings() }) });
    if (!res.ok) return false;
    const j = (await res.json()) as { prenotazioni?: unknown };
    flag(true);
    unisci(remote(j.prenotazioni));
    return true;
  } catch {
    return false;
  }
}

// Spegnere cancella tutto dall'account e toglie il consenso; sul telefono restano.
export async function spegniPrenotazioniAccount(): Promise<boolean> {
  try {
    const res = await fetch("/api/prenotazioni", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tutte: true }) });
    if (!res.ok) return false;
    flag(false);
    return true;
  } catch {
    return false;
  }
}
