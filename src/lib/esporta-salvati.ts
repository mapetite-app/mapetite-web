// Proposta 70 "Porta via i tuoi salvati": un file CSV con i dati della persona (nome, indirizzo, link
// Google Maps, stato, raccolte, nota, chi l'ha consigliato, data). Nessun contenuto Google (recensioni,
// foto, voti): solo quello che la persona ha salvato. Separatore ";" e BOM: Excel in italiano lo apre
// già in colonne, Google Fogli lo riconosce da solo.
// Senza import: il giro automatico la carica da sola con Node.

export type RigaSalvato = {
  created_at?: string | null;
  tags?: string[] | null;
  note?: string | null;
  consigliato_da?: string | null;
  places?: { name?: string | null; address?: string | null; google_place_id?: string | null } | null;
};

const STATI: Record<string, string> = {
  "Da provare": "Da provare",
  "Già visitato": "Ci sono stato",
};
const VOTI: Record<string, string> = {
  "Mi è piaciuto": "Mi è piaciuto",
  "Non fa per me": "Non fa per me",
};

export const INTESTAZIONE = ["Nome", "Indirizzo", "Google Maps", "Stato", "Com'era", "Raccolte", "Nota", "Consigliato da", "Salvato il"];

// Una cella: virgolette raddoppiate; chi inizia con = + - @ (o tab/a capo) non diventa una formula in Excel.
export function cella(v: string | null | undefined): string {
  let t = (v ?? "").replace(/\r\n?/g, "\n");
  if (/^[=+\-@\t\r]/.test(t)) t = `'${t}`;
  return /[";\n]/.test(t) || t !== t.trim() ? `"${t.replace(/"/g, '""')}"` : t;
}

const DATA = new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", day: "2-digit", month: "2-digit", year: "numeric" });

function linkMaps(nome: string, pid: string | null | undefined): string {
  // Solo Place ID di Google (ChIJ…); i posti aggiunti a mano hanno solo il nome e l'indirizzo.
  if (!pid || !/^[A-Za-z0-9_-]{10,}$/.test(pid) || /^[0-9a-f-]{36}$/i.test(pid)) return "";
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(nome)}&query_place_id=${encodeURIComponent(pid)}`;
}

export function rigaCsv(r: RigaSalvato): string {
  const nome = r.places?.name?.trim() || "";
  const tags = r.tags ?? [];
  const stato = tags.map((t) => STATI[t]).find(Boolean) ?? "";
  const voto = tags.map((t) => VOTI[t]).find(Boolean) ?? "";
  const raccolte = tags.filter((t) => !Object.hasOwn(STATI, t) && !Object.hasOwn(VOTI, t)).join(", ");
  const d = r.created_at ? new Date(r.created_at) : null;
  const quando = d && !Number.isNaN(d.getTime()) ? DATA.format(d) : "";
  return [nome, r.places?.address ?? "", linkMaps(nome, r.places?.google_place_id), stato, voto, raccolte, r.note ?? "", r.consigliato_da ?? "", quando].map(cella).join(";");
}

export function salvatiCsv(righe: RigaSalvato[]): string {
  return `﻿${[INTESTAZIONE.map(cella).join(";"), ...righe.filter((r) => r.places?.name).map(rigaCsv)].join("\r\n")}\r\n`;
}

export function nomeFile(now: Date = new Date()): string {
  const [g, m, a] = DATA.format(now).split("/");
  return `mapetite-salvati-${a}-${m}-${g}.csv`;
}
