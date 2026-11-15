// "Te l'ha consigliato Giulia" (PROPOSTE.md 58): il nome di chi ha consigliato un posto.
// Arriva nel link di condivisione (?da=Giulia) o lo scrive a mano chi salva; resta sulla riga del
// salvato (saved_places.consigliato_da), privato di chi salva.
//
// Modulo senza dipendenze: lo importa anche scripts/e2e/giro.mjs per i controlli.

export const CONSIGLIATO_MAX = 40;

// Solo lettere (anche accentate), spazi, apostrofo e trattino: niente link, cifre o simboli.
const NOME_RE = /^[\p{L}][\p{L}\p{M} '’-]*$/u;

/** Nome ripulito (spazi compattati, max 40), oppure null se vuoto o con caratteri non ammessi. */
export function pulisciConsigliatoDa(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const v = raw.normalize("NFC").replace(/\s+/g, " ").trim();
  if (!v || v.length > CONSIGLIATO_MAX) return null;
  return NOME_RE.test(v) ? v : null;
}

/** Primo nome dal display_name del profilo ("Giulia Rossi" → "Giulia"), già ripulito; null se non va. */
export function primoNome(displayName: string | null | undefined): string | null {
  const first = (displayName ?? "").trim().split(/\s+/)[0] ?? "";
  return pulisciConsigliatoDa(first.slice(0, CONSIGLIATO_MAX));
}

/** Messaggio di "Dillo a Giulia" dopo la visita: con 👍 "avevi ragione", altrimenti solo il grazie. */
export function messaggioGrazie(posto: string, piaciuto: boolean): string {
  return piaciuto
    ? `Sono stato da ${posto}: avevi ragione, grazie del consiglio!`
    : `Sono stato da ${posto}, grazie del consiglio!`;
}
