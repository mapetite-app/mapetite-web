import { personName } from "@/lib/handle";

// Foto degli utenti (piani 4.4 diario e 5.6c community): 1–3 foto SCATTATE DALL'UTENTE per locale,
// in Supabase Storage (bucket privato "foto-utenti", migrazione 20261017_foto_utenti.sql).
// Mai foto Google (i termini Google vietano di copiarle sui nostri server) e mai mescolate a
// quelle: si mostrano a parte, sempre con l'etichetta "Foto di <nome>".
// Modulo senza dipendenze dal server: lo usano server e browser.

export const FOTO_MAX = 3;
export const FOTO_BUCKET = "foto-utenti";

/** Foto propria: `pubblica` = visibile anche agli altri nella scheda del locale. */
export type FotoUtente = { id: string; url: string; pubblica: boolean };

/** Foto di un'altra persona (solo pubbliche): autore null = profilo privato. */
export type FotoCommunity = {
  id: string;
  url: string;
  autore: { user_id: string; handle: string; display_name: string | null } | null;
};

/** Indirizzo dell'immagine: passa dal server, che controlla chi può vederla (src/app/api/foto-utenti/[id]). */
export const fotoUrl = (id: string) => `/api/foto-utenti/${id}`;

export const fotoLabel = (autore: FotoCommunity["autore"]) =>
  autore ? `Foto di ${personName(autore)}` : "Foto di un membro di Mapetite";

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Tabella o vista delle foto non ancora creata (migrazione 20261017_foto_utenti non applicata). */
export function isMissingFoto(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  return error.code === "42P01" || error.code === "PGRST205" || /foto_locali|foto_pubbliche/.test(error.message ?? "");
}
