// Link di Instagram, TikTok e YouTube Shorts incollati o condivisi in Importa.
// Il post non si può leggere (niente scraping): si spiega di usare uno screenshot e,
// se nel testo condiviso c'è anche un nome plausibile, si propone di cercarlo a mano.
// Funzioni pure, senza dipendenze.

export type SocialSource = "Instagram" | "TikTok" | "YouTube";

function sourceOf(u: URL): SocialSource | null {
  const host = u.hostname.toLowerCase().replace(/^(www\.|m\.)/, "");
  if (host === "instagram.com" || host === "instagr.am") return "Instagram";
  if (host === "tiktok.com" || host.endsWith(".tiktok.com")) return "TikTok";
  if (host === "youtube.com" && u.pathname.startsWith("/shorts")) return "YouTube";
  return null;
}

const LINK_RE = /https?:\/\/[^\s<>"']+/g;

// Primo link social nel testo, se c'è.
export function findSocialLink(text: string): SocialSource | null {
  for (const m of text.matchAll(LINK_RE)) {
    try {
      const s = sourceOf(new URL(m[0].replace(/[),.;!?]+$/, "")));
      if (s) return s;
    } catch {
      // link rotto: si ignora
    }
  }
  return null;
}

// Frasi standard delle app ("Guarda questo video su TikTok", "Check out this reel"): non sono nomi di locali.
const BOILERPLATE = /tiktok|instagram|youtube|\breel\b|\bvideo\b|\bpost\b|guarda|check out|watch|condiviso|shared/i;

// Il testo condiviso senza link: se sembra il nome di un locale (con la città) lo si propone
// come ricerca. Nessuna chiamata parte da qui: la ricerca la avvia l'utente con un tocco.
export function placeHintFromText(text: string): string | null {
  const cleaned = text
    .replace(LINK_RE, " ")
    .replace(/#\S+/g, " ")
    .replace(/@([\w.]+)/g, "$1")
    .replace(/[\p{Extended_Pictographic}️‍]/gu, " ")
    .replace(/[|•·"“”«»]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[-–:,.\s]+|[-–:,.\s]+$/g, "");
  if (cleaned.length < 3 || cleaned.length > 80) return null;
  if (!/\p{L}{2,}/u.test(cleaned)) return null;
  if (cleaned.split(" ").length > 10) return null;
  if (BOILERPLATE.test(cleaned)) return null;
  return cleaned;
}
