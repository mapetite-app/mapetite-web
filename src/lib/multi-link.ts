import { isGoogleMapsLink } from "@/lib/maps-link";
import { placeHintFromText } from "@/lib/social-link";
import { videoSourceOf } from "@/lib/video-caption";

// "Incolla più link" (piano 3.2): da un testo qualsiasi (chat di WhatsApp con sé stessi, una nota,
// un elenco) si estraggono TUTTI i link e si dice di che tipo sono. Nessuna chiamata parte da qui.
// Funzioni pure, usate dal browser.

export type LinkKind = "maps" | "instagram" | "tiktok" | "youtube" | "altro";
export type FoundLink = {
  url: string;
  kind: LinkKind;
  // Testo scritto accanto al link sulla stessa riga ("Da Enzo, Trastevere https://…"): proposta di
  // ricerca per i link che non si possono leggere (Instagram). Mai cercato senza un tocco.
  hint: string | null;
};

export const MAX_LINKS = 40;

const LINK_RE = /https?:\/\/[^\s<>"']+/g;
// Inizio riga di una chat di WhatsApp esportata o copiata: "[16/10/26, 10:12:05] Lorenzo: " o "16/10/26, 10:12 - Lorenzo: ".
const WHATSAPP_PREFIX = /^\s*\[?\d{1,2}[/.]\d{1,2}[/.]\d{2,4},?\s+\d{1,2}[:.]\d{2}(?:[:.]\d{2})?\]?\s*(?:-\s*)?[^:\n]{1,40}:\s*/;

function kindOf(u: URL): LinkKind {
  if (isGoogleMapsLink(u)) return "maps";
  const host = u.hostname.toLowerCase().replace(/^(www\.|m\.)/, "");
  if (host === "instagram.com" || host === "instagr.am") return "instagram";
  const video = videoSourceOf(u.toString());
  if (video === "TikTok") return "tiktok";
  if (video === "YouTube") return "youtube";
  return "altro";
}

/** Tutti i link del testo, in ordine, senza doppioni; "oltre" = quanti ne restano fuori dal limite. */
export function extractAllLinks(text: string, max = MAX_LINKS): { links: FoundLink[]; oltre: number } {
  const links: FoundLink[] = [];
  const seen = new Set<string>();
  let oltre = 0;
  for (const line of text.split(/\r?\n/)) {
    const matches = [...line.matchAll(LINK_RE)];
    if (matches.length === 0) continue;
    const rest = line.replace(WHATSAPP_PREFIX, "");
    const hint = matches.length === 1 ? placeHintFromText(rest) : null;
    for (const m of matches) {
      const raw = m[0].replace(/[),.;!?]+$/, "");
      let u: URL;
      try { u = new URL(raw); } catch { continue; }
      if (u.protocol !== "https:" && u.protocol !== "http:") continue;
      const key = u.toString();
      if (seen.has(key)) continue;
      seen.add(key);
      if (links.length >= max) { oltre++; continue; }
      links.push({ url: key, kind: kindOf(u), hint });
    }
  }
  return { links, oltre };
}

export const KIND_LABEL: Record<LinkKind, string> = {
  maps: "Google Maps",
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  altro: "Link",
};

/** "Salva i 7 riconosciuti" / "Salva gli 11 riconosciuti" / "Salva il locale riconosciuto". */
export function saveLabel(n: number): string {
  if (n === 1) return "Salva il locale riconosciuto";
  // "gli" davanti ai numeri che si leggono con una vocale: otto, undici, ottanta…
  const gli = String(n).startsWith("8") || n === 11;
  return `Salva ${gli ? "gli" : "i"} ${n} riconosciuti`;
}
