// Nome pubblico (handle) del profilo: /u/<handle>. Stesse regole del vincolo nel database
// (supabase/migrations/20261015_social.sql): minuscolo, 3–20 caratteri tra lettere, numeri, "." e "_".
// Modulo senza dipendenze: lo usano server, browser e scripts/e2e/giro.mjs.

export const HANDLE_RE = /^[a-z0-9._]{3,20}$/;

/** Ripulisce quello che scrive l'utente: "@Giulia Rossi" → "giuliarossi" (accenti tolti). */
export function cleanHandle(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/^@+/, "")
    .replace(/[^a-z0-9._]/g, "")
    .slice(0, 20);
}

export function isValidHandle(handle: string | null | undefined): handle is string {
  return typeof handle === "string" && HANDLE_RE.test(handle);
}

/** Nome da mostrare: il nome scelto, altrimenti il handle. */
export function personName(p: { display_name?: string | null; handle?: string | null }): string {
  return p.display_name?.trim() || p.handle || "Qualcuno";
}

/** Iniziale per l'avatar (niente foto: mai immagini finte). */
export function personInitial(p: { display_name?: string | null; handle?: string | null }): string {
  return personName(p).charAt(0).toUpperCase();
}

/** Indirizzi da condividere. */
export const profilePath = (handle: string) => `/u/${handle}`;
export const profileMapPath = (handle: string) => `/u/${handle}/mappa`;
