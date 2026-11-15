import { isGem } from "@/lib/gem";
import { distanceMeters } from "@/lib/distance";
import { categoryLabel } from "@/lib/category-label";

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
const VICINO_MAX_M = 3_000;

// Il tipo come lo legge la persona sulla card.
export function tipoMostrato(p: { category: string | null; name: string }): string {
  return (categoryLabel(p.category, p.name) ?? p.category ?? "").toLowerCase();
}

// Su quanti posti si sceglie davvero: senza i chiusi e i fuori tema (revisore 15/11: "Su 6" contava un chiuso).
export function candidatiTre<T extends PostoTre>(posti: readonly T[], fuoriTema?: readonly string[]): T[] {
  return posti.filter((p) => !p.businessStatus?.startsWith("CLOSED") && !(fuoriTema?.includes(p.id) ?? false));
}

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
  const buoni = candidatiTre(posti, opz.fuoriTema);
  if (buoni.length < MIN_POSTI_TRE) return [];
  const scelti: { posto: T; motivo: Motivo }[] = [];
  const preso = (p: T) => scelti.some((s) => s.posto.id === p.id);
  // Revisore 15/11: il tipo si confronta com'è scritto sulla card ("Trattoria" anche con italian_restaurant e
  // seafood_restaurant; pastry_shop e cake_shop sono entrambe "Pasticceria"), non col tipo Google grezzo.
  const tipo = (p: T) => tipoMostrato(p);
  const tipi = () => new Set(scelti.map((s) => tipo(s.posto)));
  // A parità, un tipo nuovo prima di uno già scelto: tre pizzerie non sono una scelta.
  const primo = (lista: readonly T[]) => lista.find((p) => !preso(p) && !tipi().has(tipo(p))) ?? lista.find((p) => !preso(p));

  scelti.push({ posto: buoni[0], motivo: "tema" });
  if (opz.gemme !== false && opz.recensioni) {
    const g = primo(buoni.filter((p) => isGem(p.rating, opz.recensioni!(p.id), p.name)));
    if (g) scelti.push({ posto: g, motivo: "gemma" });
  }
  const o = opz.origine;
  if (o) {
    const vicini = [...buoni].sort((a, b) => distanceMeters(o, a) - distanceMeters(o, b));
    // Revisore 14/11 sera: "Il più vicino" solo se lo è davvero (il primo per distanza, non già scelto) ed è
    // raggiungibile a piedi o quasi (entro 3 km): a 480 km è vero ma sembra un errore.
    const v = vicini[0];
    if (v && !preso(v) && distanceMeters(o, v) <= VICINO_MAX_M) scelti.push({ posto: v, motivo: "vicino" });
  }
  while (scelti.length < 3) {
    const d = primo(buoni);
    if (!d) break;
    scelti.push({ posto: d, motivo: tipi().has(tipo(d)) ? "altro" : "diverso" });
  }
  return scelti.slice(0, 3);
}
