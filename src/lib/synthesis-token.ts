import { createHmac, timingSafeEqual } from "crypto";
import type { PlaceResult } from "@/lib/google-places";
import { REVIEW_CHAR_LIMIT, REVIEWS_PER_PLACE_FOR_SYNTHESIS, SYNTHESIS_LIMIT } from "@/lib/haiku-synthesis";
import type { Candidato } from "@/lib/prova-requisito";

// Ricerca in due tempi: la prima risposta porta solo i dati Google; la seconda
// chiamata (verdetti) riceve dal client gli stessi dati. Per evitare che il client
// li alteri (la sintesi è messa in cache per Place ID) la prima risposta li firma
// con un HMAC che solo il server può produrre. Nessuna chiamata Google in più.

export type SynthesisInput = Pick<
  PlaceResult,
  "id" | "name" | "category" | "rating" | "userRatingCount" | "priceLevel" | "editorialSummary" | "types" | "reviewTexts"
> & {
  // "✓ terrazza" candidati (frase copiata da una recensione da 4-5 stelle): l'AI del secondo tempo
  // dice quali affermano davvero il requisito. Firmati con il resto: il client non può aggiungerne.
  prove?: Candidato[];
};

export function buildSynthesisInput(places: PlaceResult[], prove: Record<string, Candidato[]> = {}): SynthesisInput[] {
  return places.slice(0, SYNTHESIS_LIMIT).map((p) => ({
    id: p.id,
    name: p.name,
    category: p.category,
    rating: p.rating,
    userRatingCount: p.userRatingCount,
    priceLevel: p.priceLevel,
    editorialSummary: p.editorialSummary,
    types: p.types ? p.types.slice(0, 6) : null,
    reviewTexts: p.reviewTexts
      ? p.reviewTexts.slice(0, REVIEWS_PER_PLACE_FOR_SYNTHESIS).map((r) => r.slice(0, REVIEW_CHAR_LIMIT))
      : null,
    ...(prove[p.id]?.length ? { prove: prove[p.id] } : {}),
  }));
}

function key(): string {
  const k = process.env.SUPABASE_SECRET_KEY;
  if (!k) throw new Error("SUPABASE_SECRET_KEY non configurata sul server.");
  return k;
}

function mac(query: string, places: SynthesisInput[]): Buffer {
  return createHmac("sha256", key()).update(JSON.stringify({ q: query, p: places })).digest();
}

export function signSynthesisInput(query: string, places: SynthesisInput[]): string {
  return mac(query, places).toString("hex");
}

export function verifySynthesisInput(query: string, places: SynthesisInput[], token: unknown): boolean {
  if (typeof token !== "string" || !/^[0-9a-f]{64}$/.test(token)) return false;
  const expected = mac(query, places);
  const given = Buffer.from(token, "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}
