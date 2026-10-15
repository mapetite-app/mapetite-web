// Riclassificazione automatica dei salvati (piano 4.2): l'AI propone in quali raccolte mettere i
// salvati che non ne hanno. Funzioni pure, senza dipendenze (le usa anche scripts/e2e/giro.mjs).
//
// Regole (LORENZO.md / VISIONE.md):
//  - l'AI vede SOLO ciò che è già salvato: nome, tipo di locale, città e il verdetto già in
//    memoria (place_synthesis). Nessuna chiamata a Google, nessun dato inventato;
//  - può proporre solo raccolte già usate dall'utente o quelle standard qui sotto: ogni altro
//    nome viene scartato; ogni locale con un id che non era nella richiesta viene scartato;
//  - nel dubbio nessuna proposta: meglio un locale senza raccolta che in quella sbagliata;
//  - è una proposta: si scrive solo quando l'utente accetta.

export const STANDARD_COLLECTIONS = [
  "Romantici",
  "Con amici",
  "Pranzo veloce",
  "Aperitivo",
  "Brunch",
  "Da provare in viaggio",
  "Speciali",
] as const;

export const MAX_PER_CALL = 30; // un gruppo = una chiamata Haiku
export const MAX_PER_PLACE = 2; // al massimo 2 raccolte proposte per locale
export const MAX_TOKENS = 900; // ~30 righe brevi in uscita (vedi stima costi nel resoconto)

export type ClassifyInput = {
  id: string; // UUID Supabase: non va all'AI (si usano numeri brevi "1", "2", …)
  name: string;
  category: string | null;
  city: string | null;
  verdict: string | null;
};

export type Proposal = { id: string; collections: string[] };

const clip = (s: string | null | undefined, n: number) => (s ?? "").replace(/\s+/g, " ").trim().slice(0, n);

/** Nomi ammessi: raccolte dell'utente + standard, senza doppioni (confronto senza maiuscole). */
export function allowedCollections(existing: string[]): string[] {
  const out: string[] = [];
  for (const n of [...existing, ...STANDARD_COLLECTIONS]) {
    const t = clip(n, 24);
    if (t && !out.some((o) => o.toLowerCase() === t.toLowerCase())) out.push(t);
  }
  return out.slice(0, 40);
}

/** Testo per Haiku. Città più frequente di tutte = "casa": "Da provare in viaggio" vale per le altre. */
export function buildPrompt(places: ClassifyInput[], existing: string[]): string {
  const allowed = allowedCollections(existing);
  const cities = new Map<string, number>();
  for (const p of places) if (p.city) cities.set(p.city, (cities.get(p.city) ?? 0) + 1);
  const home = [...cities.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const lines = places.slice(0, MAX_PER_CALL).map((p, i) =>
    [`${i + 1}`, clip(p.name, 60), clip(p.category, 30) || "-", clip(p.city, 30) || "-", clip(p.verdict, 160) || "-"].join(" | "),
  );
  return [
    "Sei l'assistente di Mapetite, un'app per salvare locali (ristoranti, bar, caffè).",
    "Per ogni locale salvato qui sotto proponi in quali raccolte metterlo, scegliendo SOLO tra queste:",
    allowed.map((a) => `- ${a}`).join("\n"),
    "",
    "Regole:",
    `- Al massimo ${MAX_PER_PLACE} raccolte per locale. Nessuna se non è chiaro: è meglio lasciarlo senza raccolta.`,
    "- Basati SOLO su nome, tipo di locale, città e verdetto scritti qui. Non inventare caratteristiche.",
    "- \"Romantici\" solo se il verdetto parla di atmosfera intima/romantica; \"Aperitivo\" per bar, cocktail bar, enoteche o se il verdetto parla di aperitivo; \"Brunch\" solo se il verdetto o il tipo parlano di brunch o colazione; \"Pranzo veloce\" per forni, pizza al taglio, street food, panini.",
    home
      ? `- "Da provare in viaggio" solo per locali in una città diversa da ${home} (la città con più salvati).`
      : "- \"Da provare in viaggio\" solo se la città è chiaramente diversa dalle altre.",
    "",
    "Locali (numero | nome | tipo | città | verdetto):",
    lines.join("\n"),
    "",
    'Rispondi SOLO con JSON, senza testo prima o dopo: {"proposte":[{"n":1,"raccolte":["Aperitivo"]}]}',
    "Ometti i locali senza proposte.",
  ].join("\n");
}

/** Legge la risposta di Haiku e tiene solo proposte valide (numeri richiesti, nomi ammessi). */
export function parseProposals(text: string, places: ClassifyInput[], existing: string[]): Proposal[] {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return [];
  let raw: unknown;
  try {
    raw = JSON.parse(text.slice(start, end + 1));
  } catch {
    return [];
  }
  const list = (raw as { proposte?: unknown })?.proposte;
  if (!Array.isArray(list)) return [];
  const allowed = allowedCollections(existing);
  const canonical = (n: unknown) => (typeof n === "string" ? allowed.find((a) => a.toLowerCase() === n.trim().toLowerCase()) ?? null : null);
  const seen = new Set<string>();
  const out: Proposal[] = [];
  for (const item of list) {
    const n = Number((item as { n?: unknown })?.n);
    if (!Number.isInteger(n) || n < 1 || n > Math.min(places.length, MAX_PER_CALL)) continue;
    const place = places[n - 1];
    if (seen.has(place.id)) continue;
    const names = Array.isArray((item as { raccolte?: unknown })?.raccolte) ? ((item as { raccolte: unknown[] }).raccolte) : [];
    const collections = [...new Set(names.map(canonical).filter((c): c is string => !!c))].slice(0, MAX_PER_PLACE);
    if (collections.length === 0) continue;
    seen.add(place.id);
    out.push({ id: place.id, collections });
  }
  return out;
}

// Prezzi pubblici di claude-haiku-4-5 (USD per milione di token), come in haiku-synthesis.ts.
export function estimateCostUsd(inputTokens: number, outputTokens: number): number {
  return (inputTokens * 1.0 + outputTokens * 5.0) / 1_000_000;
}
