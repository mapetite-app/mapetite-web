// Lista di Google Maps incollata (piano 2a): Google non la fa leggere da fuori, quindi si porta l'utente
// al "file di Google" (Takeout) con i passi già aperti. Su /importa si apre il pannello senza ricaricare;
// altrove (es. /importa/condividi) si va a /importa?file=aiuto.
export const APRI_FILE_EVENT = "mapetite-apri-file-google";

export function apriFileGoogle() {
  if (typeof window === "undefined") return;
  if (window.location.pathname === "/importa") {
    window.dispatchEvent(new Event(APRI_FILE_EVENT));
    return;
  }
  window.location.assign("/importa?file=aiuto");
}
