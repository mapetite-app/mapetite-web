// Feedback dei tester (voce 10): email precompilata, scelta di Lorenzo 11/10
// perché non richiede database né servizi e si legge dal telefono.
export const FEEDBACK_EMAIL = "founder.mapetite@gmail.com";

// Costruito al tocco: include la pagina e il telefono per capire il contesto.
export function feedbackMailto(): string {
  const page = typeof window !== "undefined" ? window.location.pathname + window.location.search : "";
  const device = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const body = [
    "Cosa ti è piaciuto, cosa non ha funzionato o cosa ti manca:",
    "",
    "",
    "",
    "— Lascia queste righe, ci aiutano a capire —",
    `Pagina: ${page}`,
    `Telefono: ${device}`,
  ].join("\n");
  return `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent("Feedback su Mapetite")}&body=${encodeURIComponent(body)}`;
}

// "Questi risultati non vanno?": email con la ricerca e i locali proposti, così Lorenzo
// può aggiungerla a TEST-RICERCHE.md senza chiedere al tester cosa aveva cercato.
export function searchFeedbackMailto(query: string, names: string[]): string {
  const device = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const body = [
    `Ho cercato: "${query}"`,
    "",
    "Cosa non andava (locali fuori tema, zona sbagliata, mancava un posto che conosci…):",
    "",
    "",
    "— Lascia queste righe, ci aiutano a capire —",
    "Locali proposti:",
    ...names.slice(0, 10).map((n, i) => `${i + 1}. ${n}`),
    `Telefono: ${device}`,
  ].join("\n");
  return `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(`Ricerca da migliorare: ${query.slice(0, 60)}`)}&body=${encodeURIComponent(body)}`;
}
