// "Il locale dice: senza glutine" (PROPOSTE.md, proposta 92; migrazione 20261128_glutine_locale.sql):
// il titolare di un locale VERIFICATO dice a tocco se fa piatti senza glutine (sì / su richiesta / no), se li
// prepara a parte e se è socio AFC di AIC. Niente testo libero. Sulla scheda, nel riquadro del titolare:
// "🌾 Senza glutine su richiesta, preparati a parte · dice il locale". È parola del locale e lo dice: "socio AFC"
// è dichiarato da lui, non una nostra certificazione (finché non c'è un accordo con AIC, proposta 93).
// Non copre mai la riga 🌾 delle recensioni (proposta 91): si vedono tutte e due.
// Con "no" la riga c'è: "Niente senza glutine" evita un viaggio a vuoto a chi è celiaco (VISIONE: sapere prima).
// Funzioni pure e nessun import, così il giro automatico le prova anche senza server.

export type PiattiGlutine = "si" | "richiesta" | "no";
export type GlutineLocale = { piatti: PiattiGlutine; separati: boolean | null; afc: boolean | null; at: string };

const bool = (v: unknown): boolean | null => (v === true ? true : v === false ? false : null);

/** Valori validi o null. Con "no" non si dice altro (preparati a parte e AFC non hanno senso). */
export function pulisciGlutineLocale(piatti: unknown, separati: unknown, afc: unknown, at: unknown): GlutineLocale | null {
  if (piatti !== "si" && piatti !== "richiesta" && piatti !== "no") return null;
  const quando = typeof at === "string" && !Number.isNaN(Date.parse(at)) ? at : "";
  if (piatti === "no") return { piatti, separati: null, afc: null, at: quando };
  return { piatti, separati: bool(separati), afc: bool(afc), at: quando };
}

/** La frase della scheda, senza "dice il locale" (lo aggiunge il riquadro del titolare), o null.
 *  AFC detto come dichiarazione del locale («si dichiara socio AFC»), mai come certificazione nostra (revisore 28/11). */
export function fraseGlutineLocale(g: GlutineLocale | null | undefined): string | null {
  if (!g) return null;
  if (g.piatti === "no") return "Niente senza glutine";
  const parti = [g.piatti === "si" ? "Piatti senza glutine" : "Senza glutine su richiesta"];
  if (g.separati === true) parti.push("preparati a parte");
  if (g.separati === false) parti.push("cucina in comune");
  if (g.afc === true) parti.push("socio AFC");
  return parti.join(", ");
}
