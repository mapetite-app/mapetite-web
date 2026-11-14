import { isGem } from "@/lib/gem";
import { distanceMeters } from "@/lib/distance";

// Proposta 55 "Tre, non trenta" (PROBLEMI.md 24: davanti a dodici posti non si decide). Dai risultati già arrivati
// restano tre posti che non si somigliano, ognuno con il suo perché in due parole:
//  1. "Il più in tema": il primo della lista com'è ordinata (adattezza alla richiesta e ai gusti, mai le recensioni).
//  2. "💎 Poco conosciuto": il primo posto con buon voto e poche recensioni (VISIONE: far emergere i non mainstream).
//  3. "Il più vicino": il più vicino a te, se sappiamo dove sei; altrimenti "Diverso dagli altri" (un altro tipo).
// Nessuna scelta usa il numero di recensioni per premiare: al contrario, il 💎 lo usa per far salire i piccoli.
// Niente chiamate a Google o all'AI: solo scelta e ordine sui dati già in pagina.

export type PostoTre = {
  id: string;
  name: string;
  category: string | null;
  lat: number;
  lng: number;
  rating: number | null;
  businessStatus?: string | null;
};

export type Motivo = "tema" | "gemma" | "vicino" | "diverso" | "altro";
export const MOTIVO_LABEL: Record<Motivo, string> = {
  tema: "Il più in tema",
  gemma: "💎 Poco conosciuto",
  vicino: "Il più vicino",
  diverso: "Un altro tipo",
  // Revisore 14/11 sera: se non c'è un tipo nuovo il posto non si chiama "diverso" (l'app non dice cose false).
  altro: "Anche in tema",
};

// Sotto questo numero di posti la scelta non serve: si vedono già tutti.
export const MIN_POSTI_TRE = 5;

export function scegliTre<T extends PostoTre>(
  posti: readonly T[],
  opz: {
    recensioni?: (id: string) => number | null | undefined;
    origine?: { lat: number; lng: number } | null;
    fuoriTema?: readonly string[];
    gemme?: boolean;
  } = {},
): { posto: T; motivo: Motivo }[] {
  // Fuori i chiusi e quelli che l'AI giudica fuori tema: la scelta stretta deve essere sicura.
  const buoni = posti.filter((p) => !p.businessStatus?.startsWith("CLOSED") && !(opz.fuoriTema?.includes(p.id) ?? false));
  if (buoni.length < MIN_POSTI_TRE) return [];
  const scelti: { posto: T; motivo: Motivo }[] = [];
  const preso = (p: T) => scelti.some((s) => s.posto.id === p.id);
  const tipi = () => new Set(scelti.map((s) => s.posto.category ?? ""));
  // A parità, un tipo nuovo prima di uno già scelto: tre pizzerie non sono una scelta.
  const primo = (lista: readonly T[]) => lista.find((p) => !preso(p) && !tipi().has(p.category ?? "")) ?? lista.find((p) => !preso(p));

  scelti.push({ posto: buoni[0], motivo: "tema" });
  if (opz.gemme !== false && opz.recensioni) {
    const g = primo(buoni.filter((p) => isGem(p.rating, opz.recensioni!(p.id), p.name)));
    if (g) scelti.push({ posto: g, motivo: "gemma" });
  }
  const o = opz.origine;
  if (o) {
    const vicini = [...buoni].sort((a, b) => distanceMeters(o, a) - distanceMeters(o, b));
    // Il più vicino davvero (non "il più vicino di un altro tipo"): se è già scelto, il secondo più vicino.
    const v = vicini.find((p) => !preso(p));
    if (v) scelti.push({ posto: v, motivo: "vicino" });
  }
  while (scelti.length < 3) {
    const d = primo(buoni);
    if (!d) break;
    scelti.push({ posto: d, motivo: tipi().has(d.category ?? "") ? "altro" : "diverso" });
  }
  return scelti.slice(0, 3);
}
