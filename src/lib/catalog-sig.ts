import { createHmac, timingSafeEqual } from "crypto";

// Firma dei dati Google che finiscono nel catalogo condiviso (tabella "places").
// Il primo che salva un locale ne scrive nome, indirizzo e posizione per tutti: se questi dati
// arrivassero dal telefono senza controllo, chiunque potrebbe dare un nome falso a un locale vero.
// Le route che ricevono i locali da Google (/api/search, /api/places/search) aggiungono a ogni
// risultato una "firma": i dati del catalogo più un HMAC che solo il server sa produrre.
// /api/places/add scrive nel catalogo i dati DELLA FIRMA, non quelli del corpo della richiesta.
// Nessuna chiamata Google in più. Stesso segreto di synthesis-token.ts, con un prefisso diverso
// perché una firma dei verdetti non valga come firma del catalogo.

export type CatalogEntry = {
  id: string; // Google Place ID
  name: string;
  address: string;
  lat: number;
  lng: number;
  category: string | null;
  rating: number | null;
  priceLevel: number | null;
  userRatingCount: number | null; // solo per "poco conosciuto": non si salva
};

const PREFIX = "catalogo-v1:";
const MAX_LEN = 4000;

function key(): string {
  const k = process.env.SUPABASE_SECRET_KEY;
  if (!k) throw new Error("SUPABASE_SECRET_KEY non configurata sul server.");
  return k;
}

function mac(payload: string): Buffer {
  return createHmac("sha256", key()).update(PREFIX + payload).digest();
}

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() !== "" ? v : null);

/** Firma di un risultato Google, oppure undefined se non si può firmare (mai bloccare la ricerca). */
export function signCatalogEntry(p: {
  id: string; name: string; address?: string | null; lat: number | null; lng: number | null;
  category?: string | null; rating?: number | null; priceLevel?: number | null; userRatingCount?: number | null;
}): string | undefined {
  if (!p.id || !p.name || num(p.lat) == null || num(p.lng) == null) return undefined;
  const entry: CatalogEntry = {
    id: p.id,
    name: p.name,
    address: p.address ?? "",
    lat: p.lat as number,
    lng: p.lng as number,
    category: str(p.category),
    rating: num(p.rating),
    priceLevel: num(p.priceLevel),
    userRatingCount: num(p.userRatingCount),
  };
  try {
    const payload = Buffer.from(JSON.stringify(entry)).toString("base64url");
    return `${payload}.${mac(payload).toString("hex")}`;
  } catch (e) {
    console.error("[catalog-sig] firma non riuscita:", e instanceof Error ? e.message : e);
    return undefined;
  }
}

/** I dati firmati, se la firma è valida e riguarda proprio questo Place ID; altrimenti null. */
export function verifyCatalogEntry(token: unknown, googlePlaceId: unknown): CatalogEntry | null {
  if (typeof token !== "string" || token.length > MAX_LEN || typeof googlePlaceId !== "string") return null;
  const m = token.match(/^([A-Za-z0-9_-]+)\.([0-9a-f]{64})$/);
  if (!m) return null;
  let expected: Buffer;
  try { expected = mac(m[1]); } catch { return null; }
  const given = Buffer.from(m[2], "hex");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const e = JSON.parse(Buffer.from(m[1], "base64url").toString("utf8")) as CatalogEntry;
    if (e?.id !== googlePlaceId || typeof e.name !== "string" || num(e.lat) == null || num(e.lng) == null) return null;
    return {
      id: e.id,
      name: e.name,
      address: typeof e.address === "string" ? e.address : "",
      lat: e.lat,
      lng: e.lng,
      category: str(e.category),
      rating: num(e.rating),
      priceLevel: num(e.priceLevel),
      userRatingCount: num(e.userRatingCount),
    };
  } catch {
    return null;
  }
}
