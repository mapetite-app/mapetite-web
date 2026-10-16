// Liste di gruppo (piano 5.5): tipi e regole comuni a server e browser.
// Modulo senza dipendenze: lo usano le pagine /gruppi e scripts/e2e/giro.mjs.

export type Gruppo = {
  id: string;
  nome: string;
  emoji: string;
  codice: string;
  creato_da: string;
  created_at: string;
  membri: number;
  posti: number;
  voti: number;
};

export type Membro = { user_id: string; nome: string };

export type PostoGruppo = {
  posto_id: string;
  place_id: string; // UUID Supabase (places.id)
  google_place_id: string | null;
  name: string;
  category: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  aggiunto_da: string | null;
  aggiunto_da_nome: string | null;
  created_at: string;
  voti: number;
  votanti: string[];
  ho_votato: boolean;
};

export type InvitoGruppo = { id: string; nome: string; emoji: string; membri: number; posti: number; sono_dentro: boolean };

export const EMOJI_GRUPPO = ["🍽️", "🍕", "🍷", "🍣", "🍔", "☕", "🍸", "🥐", "🌮", "🎉"] as const;

export const NOME_MAX = 60;
export const MIO_NOME_MAX = 40;

export const gruppoPath = (id: string) => `/gruppi/${id}`;
export const invitoGruppoPath = (codice: string) => `/gruppi/entra/${codice}`;

const CODICE_RE = /^[a-z0-9]{8,16}$/;
export function cleanCodiceGruppo(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const v = raw.trim().toLowerCase();
  return CODICE_RE.test(v) ? v : null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: unknown): v is string => typeof v === "string" && UUID_RE.test(v);

/** Il più votato in cima; a pari voti resta prima chi è stato proposto prima. */
export function ordinaPosti<T extends { voti: number; created_at: string }>(posti: T[]): T[] {
  return [...posti].sort((a, b) => b.voti - a.voti || a.created_at.localeCompare(b.created_at));
}

/** "3 persone · 5 posti". */
export function numeriGruppo(g: { membri: number; posti: number }): string {
  const m = g.membri === 1 ? "1 persona" : `${g.membri} persone`;
  const p = g.posti === 0 ? "nessun posto" : g.posti === 1 ? "1 posto" : `${g.posti} posti`;
  return `${m} · ${p}`;
}

/** Testo sotto il posto: chi l'ha votato. */
export function votantiLabel(votanti: string[]): string {
  if (votanti.length === 0) return "Ancora nessun voto";
  if (votanti.length <= 2) return `Piace a ${votanti.join(" e ")}`;
  return `Piace a ${votanti.slice(0, 2).join(", ")} e altri ${votanti.length - 2}`;
}
