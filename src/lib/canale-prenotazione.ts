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

// Pagine che sono un modulo di prenotazione o la scheda del locale sulla piattaforma (dove si prenota),
// non le home né i link "scarica l'app" o "lavora con noi".
const PERCORSO_OK: Record<string, RegExp> = {
  thefork: /\/(?:ristorante|restaurant|restaurante|widget|module|[a-z]{2}\/[0-9a-f-]{8,})/i,
  quandoo: /\/(?:place|widget|booking|reserv)/i,
  zenchef: /./,
  covermanager: /\/(?:reserve|reserva|reservation|module)/i,
  opentable: /\/(?:r\/|restref|booking|restaurant)/i,
  sevenrooms: /\/(?:reservations|explore)/i,
  resy: /\/(?:cities\/|venues?)/i,
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

/** Nella pagina del locale, il primo link o modulo incorporato di una piattaforma di prenotazione. */
export function trovaCanale(html: string, base: string): Canale | null {
  const re = /(?:href|src|data-src|data-url)\s*=\s*["']([^"'<>\s]{8,600})["']/gi;
  for (let m = re.exec(html), i = 0; m && i < 5000; m = re.exec(html), i++) {
    let abs: string;
    try { abs = new URL(m[1].replace(/&amp;/g, "&"), base).toString(); } catch { continue; }
    const c = canaleDaUrl(abs);
    if (c) return c;
  }
  return null;
}
