// "Chiedi ai tuoi posti" (PROPOSTE.md 33): una domanda a parole ("dove porto mia madre domenica a
// pranzo?") e l'AI sceglie SOLO tra i salvati della persona. Funzioni pure (le usa anche il giro).
//
// Regole (LORENZO.md / VISIONE.md):
//  - nessuna chiamata Google: l'AI vede solo nome, tipo, città, raccolte, nota della persona e
//    verdetto/sintesi già in memoria (place_synthesis);
//  - il "perché" deve venire da quei dati: mai caratteristiche inventate;
//  - si tengono solo numeri della lista inviata, senza doppioni; al massimo MAX_SCELTI posti;
//  - nel dubbio nessuno: meglio "nessuno dei tuoi posti" che uno sbagliato.

export const MAX_POSTI = 80; // i più recenti. Caso peggiore (80 con nota, verdetto e sintesi): ~12k token, ~1,2 centesimi
export const MAX_SCELTI = 3;
export const MAX_TOKENS = 400;
export const MAX_DOMANDA = 160;

export type PostoSalvato = {
  id: string; // UUID Supabase: non va all'AI (si usano numeri brevi)
  name: string;
  category: string | null;
  city: string | null;
  raccolte: string[];
  note: string | null;
  verdict: string | null;
  synthesis: string | null;
};

export type Scelta = { id: string; perche: string };

const clip = (s: string | null | undefined, n: number) => (s ?? "").replace(/\s+/g, " ").trim().slice(0, n);

export function pulisciDomanda(d: unknown): string | null {
  if (typeof d !== "string") return null;
  const t = clip(d, MAX_DOMANDA);
  return t.length >= 3 ? t : null;
}

/** Una domanda vera (non un nome da cercare): almeno 3 parole, o un punto di domanda. */
export function sembraDomanda(q: string): boolean {
  const t = q.trim();
  return t.length >= 3 && (t.includes("?") || t.split(/\s+/).filter(Boolean).length >= 3);
}

export function buildPrompt(domanda: string, posti: PostoSalvato[]): string {
  const lines = posti.slice(0, MAX_POSTI).map((p, i) =>
    [
      `${i + 1}`,
      clip(p.name, 60),
      clip(p.category, 30) || "-",
      clip(p.city, 30) || "-",
      p.raccolte.length ? p.raccolte.map((r) => clip(r, 24)).join(", ") : "-",
      clip(p.note, 100) || "-",
      clip(p.verdict, 160) || "-",
      clip(p.synthesis, 160) || "-",
    ].join(" | "),
  );
  return [
    "Sei l'assistente di Mapetite, un'app dove la persona salva i locali (ristoranti, bar, caffè) che vuole provare o che le sono piaciuti.",
    `La persona chiede: «${domanda}»`,
    `Scegli al massimo ${MAX_SCELTI} locali SOLO tra i suoi salvati qui sotto, i più adatti alla domanda, dal più adatto.`,
    "",
    "Regole:",
    "- Basati SOLO su nome, tipo, città, raccolte, nota della persona, verdetto e sintesi scritti qui. Non inventare caratteristiche, orari, prezzi o piatti.",
    "- Se la domanda ha un vincolo esplicito (tipo di locale, città o zona, occasione, atmosfera, pranzo/cena) e un locale chiaramente non lo rispetta, non sceglierlo.",
    "- Scegli un locale SOLO se un dato scritto qui (nota, raccolta, verdetto o sintesi) lo collega davvero alla domanda. Un locale che non ha niente in contrario ma niente a favore NON va scelto: meglio una scelta giusta che tre.",
    "- Per ogni scelta scrivi \"perche\": una frase breve in italiano (massimo 14 parole) con le parole di quel dato (es. la nota o il verdetto), senza aggiungere qualità che non sono scritte. Dai del tu.",
    "- Se nessun locale è adatto, rispondi con la lista vuota. È meglio nessuna scelta che una sbagliata.",
    "",
    "Salvati (numero | nome | tipo | città | raccolte | nota della persona | verdetto | sintesi recensioni):",
    lines.join("\n"),
    "",
    'Rispondi SOLO con JSON, senza testo prima o dopo: {"scelti":[{"n":1,"perche":"..."}]}',
  ].join("\n");
}

/** Legge la risposta: numeri validi, senza doppioni, al massimo MAX_SCELTI, "perché" non vuoto. */
export function parseScelte(text: string, posti: PostoSalvato[]): Scelta[] {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return [];
  let raw: unknown;
  try {
    raw = JSON.parse(text.slice(start, end + 1));
  } catch {
    return [];
  }
  const list = (raw as { scelti?: unknown })?.scelti;
  if (!Array.isArray(list)) return [];
  const max = Math.min(posti.length, MAX_POSTI);
  const seen = new Set<string>();
  const out: Scelta[] = [];
  for (const item of list) {
    const n = Number((item as { n?: unknown })?.n);
    if (!Number.isInteger(n) || n < 1 || n > max) continue;
    const p = posti[n - 1];
    const perche = clip(typeof (item as { perche?: unknown })?.perche === "string" ? (item as { perche: string }).perche : "", 140);
    if (seen.has(p.id) || !perche) continue;
    seen.add(p.id);
    out.push({ id: p.id, perche });
    if (out.length >= MAX_SCELTI) break;
  }
  return out;
}

export function estimateCostUsd(inputTokens: number, outputTokens: number): number {
  return (inputTokens * 1.0 + outputTokens * 5.0) / 1_000_000;
}
