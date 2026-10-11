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
