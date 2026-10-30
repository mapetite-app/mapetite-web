import { createHmac } from "node:crypto";

// Codice del giorno dell'omaggio (PROPOSTE.md 12): 4 lettere che cambiano ogni giorno, uguali per
// tutti i clienti di quel locale quel giorno, così il personale le confronta con il pannello e uno
// screenshot di ieri non vale. HMAC con una chiave del server: dal codice di oggi non si ricava domani. Solo server.
const LETTERE = "ACDEFHJKLMNPRTUVWXY"; // niente lettere che si confondono (B/8, O/0, I/1, S/5, G/6, Q, Z/2)

export function codiceDelGiorno(placeId: string, giorno: string): string {
  const chiave = process.env.SUPABASE_SECRET_KEY || process.env.CRON_SECRET || "mapetite-omaggio";
  const h = createHmac("sha256", chiave).update(`omaggio:${placeId}:${giorno}`).digest();
  return Array.from(h.subarray(0, 4), (b) => LETTERE[b % LETTERE.length]).join("");
}
