// Tripadvisor nella riga "A confronto" della scheda (richiesta di Lorenzo, 17/10).
// SOLO l'API ufficiale Content API (https://tripadvisor-content-api.readme.io), mai scraping.
// Regole (LORENZO.md):
// - senza chiave (TRIPADVISOR_API_KEY) nessuna chiamata: la scheda mostra solo il link di ricerca;
// - i dati Tripadvisor vanno solo al telefono, MAI in un prompt o nella sintesi Haiku;
// - nessun database: cache in memoria del server, breve (24 h) e con un numero massimo di voci;
// - tetto giornaliero di chiamate in memoria, per restare nella fascia gratuita;
// - il locale si abbina solo se il nome è simile E la distanza è sotto i 150 m, altrimenti niente:
//   un voto di un altro locale sarebbe un dato inventato.
// Nessun import: il giro automatico lo carica direttamente (con un fetch finto).

export type TripadvisorDato = {
  rating: number | null; // 1–5 in mezzi punti, null se Tripadvisor non lo dà
  numReviews: number | null;
  webUrl: string; // pagina del locale su Tripadvisor (obbligatoria per le regole di visualizzazione)
  ratingImageUrl: string | null; // bolle ufficiali del voto
  nome: string;
};

export type TripadvisorEsito =
  | { stato: "senza-chiave" }
  | { stato: "trovato"; dato: TripadvisorDato }
  | { stato: "nessuno" } // nessun locale abbinabile con sicurezza
  | { stato: "limite" } // tetto giornaliero raggiunto
  | { stato: "errore" };

export const TA_MAX_DISTANZA_M = 150;
export const TA_TETTO_GIORNO = 150; // chiamate API al giorno (ricerca + dettagli contano entrambe)
export const TA_CACHE_MS = 24 * 3600_000;
export const TA_CACHE_ERRORE_MS = 10 * 60_000;
export const TA_CACHE_MAX = 500;
const API = "https://api.content.tripadvisor.com/api/v1";
const MAX_DETTAGLI = 2; // al massimo 2 candidati verificati per ricerca

// ── Abbinamento (regole pure) ────────────────────────────────────────────────
// Parole che non distinguono un locale da un altro ("Trattoria da Enzo" ≈ "Da Enzo al 29").
const GENERICHE = new Set([
  "ristorante", "trattoria", "osteria", "pizzeria", "bar", "caffe", "cafe", "bistrot", "bistro", "enoteca",
  "pub", "locanda", "hostaria", "taverna", "restaurant", "cocktail", "wine", "pasticceria", "gelateria",
  "con", "il", "lo", "la", "i", "gli", "le", "l", "da", "di", "del", "della", "dei", "al", "alla", "ai", "e", "ed", "the", "and", "a",
  "roma", "milano", "rome", "milan",
]);

export function normalizzaNome(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " e ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Solo le parole distintive: "Bar Roma" e "Bar Milano" non devono sembrare lo stesso locale.
function parole(s: string): string[] {
  return normalizzaNome(s).split(" ").filter((p) => p && !GENERICHE.has(p));
}

/** Nome "simile": uguale, uno contenuto nell'altro (parole intere), o metà almeno delle parole distintive in comune. */
export function nomiSimili(a: string, b: string): boolean {
  const na = normalizzaNome(a), nb = normalizzaNome(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const pa = parole(a), pb = parole(b);
  if (pa.length === 0 || pb.length === 0) return false; // solo parole generiche: serve il nome identico
  const ja = ` ${pa.join(" ")} `, jb = ` ${pb.join(" ")} `;
  if (ja.trim().length >= 4 && jb.trim().length >= 4 && (ja.includes(jb) || jb.includes(ja))) return true;
  const sa = new Set(pa), sb = new Set(pb);
  const comuni = [...sa].filter((p) => sb.has(p) && p.length >= 3).length;
  return comuni > 0 && comuni / Math.min(sa.size, sb.size) >= 0.5 && comuni / Math.max(sa.size, sb.size) >= 0.5;
}

export function distanzaMetri(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Il locale di Tripadvisor è lo stesso? Nome simile E meno di 150 m (servono entrambi). */
export function stessoLocale(
  nostro: { nome: string; lat: number; lng: number },
  loro: { nome: string; lat: number | null; lng: number | null },
): boolean {
  if (loro.lat == null || loro.lng == null || !Number.isFinite(loro.lat) || !Number.isFinite(loro.lng)) return false;
  return nomiSimili(nostro.nome, loro.nome) && distanzaMetri(nostro, { lat: loro.lat, lng: loro.lng }) < TA_MAX_DISTANZA_M;
}

const num = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v.replace(",", ".")) : NaN;
  return Number.isFinite(n) ? n : null;
};
const httpsDi = (v: unknown, host: RegExp): string | null => {
  if (typeof v !== "string") return null;
  try {
    const u = new URL(v);
    return u.protocol === "https:" && host.test(u.hostname) ? u.toString() : null;
  } catch {
    return null;
  }
};

/** Dai dettagli dell'API ai soli campi da mostrare; null se manca la pagina del locale. */
export function datoDaDettagli(d: Record<string, unknown>): TripadvisorDato | null {
  const webUrl = httpsDi(d.web_url, /(^|\.)tripadvisor\.[a-z.]+$/);
  if (!webUrl) return null;
  const r = num(d.rating);
  const n = num(d.num_reviews);
  return {
    rating: r != null && r >= 1 && r <= 5 ? r : null,
    numReviews: n != null && n >= 0 ? Math.round(n) : null,
    webUrl,
    ratingImageUrl: httpsDi(d.rating_image_url, /(^|\.)(tripadvisor|tacdn)\.[a-z.]+$/),
    nome: typeof d.name === "string" ? d.name : "",
  };
}

// ── Ricerca con cache e tetto (stato in memoria del server) ──────────────────
type Voce = { esito: TripadvisorEsito; scade: number };
export type TripadvisorStato = { cache: Map<string, Voce>; giorno: string; chiamate: number };
export const nuovoStato = (): TripadvisorStato => ({ cache: new Map(), giorno: "", chiamate: 0 });

export type Dipendenze = {
  key: string | undefined;
  fetch: (url: string, init?: { headers?: Record<string, string>; signal?: AbortSignal }) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;
  now?: () => number;
  stato: TripadvisorStato;
  log?: (msg: string) => void;
};

const chiave = (nome: string, lat: number, lng: number) => `${normalizzaNome(nome)}|${lat.toFixed(4)}|${lng.toFixed(4)}`;

function ricorda(s: TripadvisorStato, k: string, esito: TripadvisorEsito, scade: number) {
  s.cache.delete(k);
  s.cache.set(k, { esito, scade });
  while (s.cache.size > TA_CACHE_MAX) {
    const primo = s.cache.keys().next().value;
    if (primo === undefined) break;
    s.cache.delete(primo);
  }
}

export async function cercaTripadvisor(
  locale: { nome: string; lat: number; lng: number },
  dip: Dipendenze,
): Promise<TripadvisorEsito> {
  const key = dip.key?.trim();
  if (!key) return { stato: "senza-chiave" }; // nessuna chiamata
  const now = dip.now?.() ?? Date.now();
  const s = dip.stato;
  const k = chiave(locale.nome, locale.lat, locale.lng);
  const c = s.cache.get(k);
  if (c && c.scade > now) return c.esito;
  if (c) s.cache.delete(k);

  const oggi = new Date(now).toISOString().slice(0, 10);
  if (s.giorno !== oggi) { s.giorno = oggi; s.chiamate = 0; }
  // Serve spazio almeno per ricerca + un dettaglio.
  if (s.chiamate + 2 > TA_TETTO_GIORNO) return { stato: "limite" };

  const headers = { accept: "application/json" };
  const get = async (url: string): Promise<Record<string, unknown> | null> => {
    s.chiamate++;
    const r = await dip.fetch(url, { headers, signal: AbortSignal.timeout(4000) });
    if (!r.ok) { dip.log?.(`[tripadvisor] HTTP ${r.status}`); return null; }
    const j = await r.json();
    return j && typeof j === "object" ? (j as Record<string, unknown>) : null;
  };

  try {
    const qs = new URLSearchParams({
      key,
      searchQuery: locale.nome,
      category: "restaurants",
      latLong: `${locale.lat},${locale.lng}`,
      radius: "0.3",
      radiusUnit: "km",
      language: "it",
    });
    const ricerca = await get(`${API}/location/search?${qs}`);
    if (!ricerca) {
      ricorda(s, k, { stato: "errore" }, now + TA_CACHE_ERRORE_MS);
      return { stato: "errore" };
    }
    const lista = Array.isArray(ricerca.data) ? (ricerca.data as Record<string, unknown>[]) : [];
    const candidati = lista
      .filter((x) => typeof x.location_id === "string" || typeof x.location_id === "number")
      .filter((x) => typeof x.name === "string" && nomiSimili(locale.nome, x.name))
      .slice(0, MAX_DETTAGLI);

    for (const cand of candidati) {
      if (s.chiamate + 1 > TA_TETTO_GIORNO) break;
      const dq = new URLSearchParams({ key, language: "it", currency: "EUR" });
      const d = await get(`${API}/location/${encodeURIComponent(String(cand.location_id))}/details?${dq}`);
      if (!d) continue;
      const dato = datoDaDettagli(d);
      const loro = { nome: typeof d.name === "string" ? d.name : String(cand.name), lat: num(d.latitude), lng: num(d.longitude) };
      if (dato && stessoLocale(locale, loro)) {
        const esito: TripadvisorEsito = { stato: "trovato", dato };
        ricorda(s, k, esito, now + TA_CACHE_MS);
        return esito;
      }
    }
    const esito: TripadvisorEsito = { stato: "nessuno" };
    ricorda(s, k, esito, now + TA_CACHE_MS);
    return esito;
  } catch (err) {
    dip.log?.(`[tripadvisor] ${err instanceof Error ? err.message : String(err)}`);
    ricorda(s, k, { stato: "errore" }, now + TA_CACHE_ERRORE_MS);
    return { stato: "errore" };
  }
}
