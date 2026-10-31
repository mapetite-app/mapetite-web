import { ACCOUNT_KEY, accountPrenotazioni, loadBookings, segnaTolte, sostituisciPrenotazioni, tolteInAttesa } from "@/lib/booking";
import { pulisciPrenotazione, unisciPrenotazioni, type PrenotazioneAccount } from "@/lib/prenotazioni-account";

// Telefono ↔ account per le prenotazioni (solo con il consenso acceso in /prenotazioni).
//  - "altro": il telefono è legato a un altro account (stesso telefono, accesso diverso): niente
//    sincronizzazione e niente riga, le prenotazioni restano sul telefono.
export type StatoAccount = "fuori" | "spento" | "acceso" | "altro" | "errore";

type Risposta = { utente?: string; consenso?: boolean; prenotazioni?: unknown; tolte?: unknown };
const JSON_H = { "Content-Type": "application/json" };

function lega(utente: string | null) {
  try {
    if (utente) window.localStorage.setItem(ACCOUNT_KEY, utente);
    else window.localStorage.removeItem(ACCOUNT_KEY);
  } catch { /* storage non disponibile */ }
}
function remote(v: unknown): PrenotazioneAccount[] {
  return Array.isArray(v) ? v.map(pulisciPrenotazione).filter((p): p is PrenotazioneAccount => p !== null) : [];
}
function ids(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}
function unisci(j: Risposta) {
  const locali = loadBookings();
  const merged = unisciPrenotazioni(locali, remote(j.prenotazioni), [...ids(j.tolte), ...tolteInAttesa()]);
  if (JSON.stringify(merged) !== JSON.stringify(locali)) sostituisciPrenotazioni(merged);
}

// Stato del consenso e, se acceso: le tolte in attesa vanno all'account, quelle dell'account si
// uniscono al telefono, poi il telefono (modifiche fatte senza rete comprese) si ricarica con una
// POST, che non tocca mai il consenso: se nel frattempo un altro telefono ha spento, la RLS rifiuta.
export async function sincronizzaPrenotazioni(): Promise<StatoAccount> {
  try {
    const res = await fetch("/api/prenotazioni", { cache: "no-store" });
    if (res.status === 401) return "fuori";
    if (!res.ok) return "errore";
    const j = (await res.json()) as Risposta;
    const legato = accountPrenotazioni();
    if (typeof j.utente !== "string") return "errore";
    if (legato && legato !== j.utente) return "altro";
    if (!j.consenso) { lega(null); segnaTolte([]); return "spento"; }
    lega(j.utente);
    const attesa = tolteInAttesa();
    for (const id of attesa) {
      const r = await fetch("/api/prenotazioni", { method: "DELETE", headers: JSON_H, body: JSON.stringify({ id, utente: j.utente }) }).catch(() => null);
      if (r?.ok) segnaTolte(tolteInAttesa().filter((x) => x !== id));
    }
    unisci(j);
    const tutte = loadBookings();
    if (tutte.length > 0) {
      await fetch("/api/prenotazioni", { method: "POST", headers: JSON_H, body: JSON.stringify({ prenotazioni: tutte, utente: j.utente }) }).catch(() => null);
    }
    return "acceso";
  } catch {
    return "errore";
  }
}

export async function accendiPrenotazioniAccount(): Promise<boolean> {
  try {
    const res = await fetch("/api/prenotazioni", { method: "PUT", headers: JSON_H, body: JSON.stringify({ prenotazioni: loadBookings() }) });
    if (!res.ok) return false;
    const j = (await res.json()) as Risposta;
    if (typeof j.utente !== "string") return false;
    lega(j.utente);
    unisci(j);
    return true;
  } catch {
    return false;
  }
}

// Spegnere cancella tutto dall'account e toglie il consenso; sul telefono restano.
export async function spegniPrenotazioniAccount(): Promise<boolean> {
  try {
    const res = await fetch("/api/prenotazioni", { method: "DELETE", headers: JSON_H, body: JSON.stringify({ tutte: true }) });
    if (!res.ok) return false;
    lega(null);
    segnaTolte([]);
    return true;
  } catch {
    return false;
  }
}
