// "Prenota sulla piattaforma del locale" (chiesto da Lorenzo il 30/10): molti locali italiani hanno sul
// proprio sito il modulo di prenotazione di TheFork, Quandoo, Zenchef, CoverManager o OpenTable.
// Invece di "vai sul sito e cerca dove si prenota", il foglio Prenota apre direttamente quel modulo.
// La prenotazione la conferma la persona sulla piattaforma: Mapetite non prenota da sola (servono gli
// accordi con le piattaforme, PARTNER.md) e non legge tavoli liberi. Funzioni pure: le usa anche il giro.

export type Piattaforma = { id: string; nome: string; host: RegExp };

// Solo i moduli di prenotazione, non le pagine generiche delle piattaforme (home, recensioni).
export const PIATTAFORME: Piattaforma[] = [
  { id: "thefork", nome: "TheFork", host: /^(?:[a-z0-9-]+\.)?(?:thefork\.[a-z]{2,3}(?:\.[a-z]{2})?|lafourchette\.com|eltenedor\.[a-z]{2,3}(?:\.[a-z]{2})?)$/ },
  { id: "quandoo", nome: "Quandoo", host: /^(?:[a-z0-9-]+\.)?quandoo\.[a-z]{2,3}(?:\.[a-z]{2})?$/ },
  { id: "zenchef", nome: "Zenchef", host: /^(?:bookings|widget|reservation)[a-z0-9-]*\.zenchef\.com$/ },
  { id: "covermanager", nome: "CoverManager", host: /^(?:www\.)?covermanager\.com$/ },
  { id: "opentable", nome: "OpenTable", host: /^(?:[a-z0-9-]+\.)?opentable\.[a-z]{2,3}(?:\.[a-z]{2})?$/ },
  { id: "sevenrooms", nome: "SevenRooms", host: /^(?:[a-z0-9-]+\.)?sevenrooms\.com$/ },
  { id: "resy", nome: "Resy", host: /^(?:[a-z0-9-]+\.)?resy\.com$/ },
];

// Solo la pagina del locale sulla piattaforma o il suo modulo incorporato, con il percorso ancorato
// all'inizio: niente blog, premi, elenchi di città o home (collaudo del 30/10).
const PERCORSO_OK: Record<string, RegExp> = {
  thefork: /^\/(?:[a-z]{2}\/)?(?:ristorante|restaurant|restaurante|restaurang)\/[^/?]+-r\d+\/?(?:\?|$)|^\/[a-z]{2}_[A-Z]{2}\/module\/\d+|^\/(?:[a-z]{2}\/)?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
  quandoo: /^\/(?:[a-z]{2}\/)?place\/[^/?]+-\d+\/?(?:\?|$)/i,
  zenchef: /^\/results\/?\?(?:.*&)?rid=\d+/i,
  covermanager: /^\/(?:[a-z]{2}\/)?(?:reserve|reserva|reservation)\/(?:module_restaurant\/)?[^/]+/i,
  opentable: /^\/r\/[^/?]+\/?(?:\?|$)|^\/widget\/reservation\/loader\/?\?(?:.*&)?rid=\d+|^\/restref\/client\/?\?(?:.*&)?rid=\d+/i,
  sevenrooms: /^\/reservations\/[^/?]+/i,
  resy: /^\/cities\/[^/]+\/venues\/[^/?]+/i,
};

export type Canale = { piattaforma: string; nome: string; url: string };

/** L'indirizzo è già il modulo di una piattaforma? (succede: il "sito" su Google è la pagina TheFork). */
export function canaleDaUrl(raw: string): Canale | null {
  let u: URL;
  try { u = new URL(raw); } catch { return null; }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  const host = u.hostname.toLowerCase();
  const p = PIATTAFORME.find((x) => x.host.test(host));
  if (!p || !PERCORSO_OK[p.id].test(u.pathname + u.search)) return null;
  u.protocol = "https:";
  u.hash = "";
  return { piattaforma: p.id, nome: p.nome, url: u.toString() };
}

/** Nella pagina del locale, il modulo di prenotazione di una piattaforma. Prima i moduli incorporati
 *  (iframe, script: sono per forza del locale); poi i link, ma solo se portano tutti allo stesso posto:
 *  con due locali diversi (un "provate anche…") non si sa quale sia il suo, quindi niente. */
export function trovaCanale(html: string, base: string): Canale | null {
  const incorporati: Canale[] = [];
  const link: Canale[] = [];
  const re = /<(iframe|script|a|link|div|button)\b[^>]*?\b(?:href|src|data-src|data-url)\s*=\s*["']([^"'<>\s]{8,600})["']/gi;
  for (let m = re.exec(html), i = 0; m && i < 5000; m = re.exec(html), i++) {
    let abs: string;
    try { abs = new URL(m[2].replace(/&amp;/g, "&"), base).toString(); } catch { continue; }
    const c = canaleDaUrl(abs);
    if (!c) continue;
    (m[1].toLowerCase() === "iframe" || m[1].toLowerCase() === "script" ? incorporati : link).push(c);
  }
  if (incorporati.length) return incorporati[0];
  const diversi = new Set(link.map((c) => c.url.replace(/[?#].*$/, "").replace(/\/$/, "")));
  return diversi.size === 1 ? link[0] : null;
}
