// Cosa vedono gli altri con il profilo pubblico: UNA sola fonte di testo per il foglio di conferma
// (profilo-social.tsx) e per la sezione "Profilo pubblico e amici" di /privacy (revisore 8/11: i due
// testi dicevano cose diverse). Deve restare uguale a quello che escono dalle viste pubbliche
// (profili_pubblici, salvati_pubblici, classifica_pubblica, recensioni/foto/contenuti_pubblici).
// Lessico: "Provati" per numeri e titoli, "Ci sono stato" solo per la propria azione.

export const PUBBLICO_CHI = "Chi ha il link o ti cerca su Mapetite vede";

export const PUBBLICO_VEDONO = [
  "Nome, @nome, città, bio, quanti segui e ti seguono",
  "Posti provati e da provare, raccolte e tipi che salvi di più",
  "Quelli che ti sono piaciuti e la tua classifica",
  "Recensioni, foto e video che pubblichi, con il tuo nome",
  "Chi ha l'accesso: i posti che avete in comune",
  "Chi ti segue: i posti che salvi e quando, anche sulla pagina di ogni locale",
] as const;

export const PUBBLICO_MAI = ["note", "il giudizio “Non fa per me”", "gusti", "prenotazioni", "posizione", "email", "data del diario"] as const;

// Migrazione 20261108_non_fa_per_me_privati applicata l'8/11: i posti "Non fa per me" non si vedono agli altri.
export const NON_FA_PER_ME_NOTA = "I posti segnati “Non fa per me” restano solo tuoi.";

export const PUBBLICO_REVOCA = "Puoi tornare privato quando vuoi, con un tocco: vale subito.";

/** Le voci in una frase sola, separate da ";" e con l'iniziale minuscola (per /privacy). */
export function elenco(voci: readonly string[]): string {
  return voci.map((v) => v.charAt(0).toLocaleLowerCase("it") + v.slice(1)).join("; ") + ".";
}
