import { createHash } from "node:crypto";

// Testo arrivato dal Condividi di Android, ricomposto come lo legge /importa/condividi (titolo, poi testo e link).
// Il ricevi lascia l'impronta in un cookie: la pagina salva da sola un reel solo se il testo è lo stesso,
// così un link costruito a mano (/importa/condividi?text=…) non scrive nei salvati di chi lo apre.
export const CONDIVISO_COOKIE = "mapetite_condiviso";

export function condivisoTesto(title: string, text: string, url: string): string {
  return [title, [text, url].filter(Boolean).join("\n")].filter(Boolean).join("\n");
}

export function impronta(testo: string): string {
  return createHash("sha256").update(testo).digest("hex").slice(0, 32);
}
