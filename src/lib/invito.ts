// Link d'invito personale (piano 9.1): /invito/<codice>. Il codice è il nome pubblico (handle)
// di chi invita, oppure "u-" + le prime 8 cifre del suo id se non ha ancora un nome, oppure un
// codice generico scelto da Lorenzo (es. "tester"). Serve solo a contare gli arrivi per invito
// nel pannello /admin/numeri: nessuna tabella nuova, nessun premio, nessun dato personale.
// Modulo senza dipendenze: lo usano server, browser e scripts/e2e/giro.mjs.

export const INVITE_RE = /^[a-z0-9._-]{2,30}$/;

// Dove il telefono conserva il codice fino alla registrazione (localStorage, 30 giorni).
export const INVITE_KEY = "mapetite.invito";
export const INVITE_TTL = 30 * 86_400_000;

/** Codice ripulito ("@Giulia" → "giulia"), o null se non è un codice accettabile. */
export function cleanInviteCode(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  let v = raw;
  try {
    v = decodeURIComponent(raw);
  } catch {
    // malformato: si usa com'è (e quasi certamente non passa il controllo)
  }
  v = v.trim().toLowerCase().replace(/^@+/, "");
  return INVITE_RE.test(v) ? v : null;
}

/** Codice d'invito di una persona: il suo nome pubblico, altrimenti un pezzo del suo id. */
export function myInviteCode(p: { handle?: string | null; id: string }): string {
  const h = cleanInviteCode(p.handle ?? "");
  if (h) return h;
  return `u-${p.id.replace(/[^a-z0-9]/gi, "").slice(0, 8).toLowerCase()}`;
}

export const invitePath = (code: string) => `/invito/${code}`;

// Codice salvato nel telefono, se non scaduto (null altrimenti). Solo nel browser.
export function readStoredInvite(now = Date.now()): string | null {
  try {
    const raw = JSON.parse(window.localStorage.getItem(INVITE_KEY) ?? "null");
    if (!raw || typeof raw.codice !== "string" || typeof raw.t !== "number") return null;
    if (now - raw.t > INVITE_TTL) return null;
    return cleanInviteCode(raw.codice);
  } catch {
    return null;
  }
}

export function storeInvite(code: string, now = Date.now()): void {
  try {
    window.localStorage.setItem(INVITE_KEY, JSON.stringify({ codice: code, t: now }));
  } catch {
    // storage non disponibile (navigazione privata): l'arrivo è già contato, la registrazione no
  }
}

export function clearStoredInvite(): void {
  try {
    window.localStorage.removeItem(INVITE_KEY);
  } catch {
    // ignorato
  }
}
