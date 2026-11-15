"use client";

import { firmaPer } from "@/lib/catalog-firme";
import { browserClient } from "@/lib/supabase/client-lazy";
import { primoNome } from "@/lib/consigliato-da";

// "Condividi" nella scheda: manda il link Mapetite del locale (/locali/<UUID>), così chi lo riceve
// vede il verdetto e può salvarlo in Mapetite. I salvati hanno già l'UUID come id; per i risultati
// di ricerca (id = Google Place ID) la riga in "places" si crea o si ritrova con /api/places/add
// (nessuna chiamata a Google: scrive solo fatti già noti). Se non si riesce (es. utente non
// collegato) si torna al link di Google Maps.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type ShareablePlace = {
  id: string; name: string; address: string | null; lat: number; lng: number;
  category: string | null; rating: number | null; priceLevel: number | null; photoRef?: string | null;
};

// Risultati già risolti in questa sessione: il secondo tocco su Condividi non rifà la richiesta.
const known = new Map<string, string>();

async function placeUuid(p: ShareablePlace): Promise<string | null> {
  if (UUID_RE.test(p.id)) return p.id;
  const cached = known.get(p.id);
  if (cached) return cached;
  try {
    const res = await fetch("/api/places/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        googlePlaceId: p.id, name: p.name, address: p.address ?? "", lat: p.lat, lng: p.lng,
        category: p.category, rating: p.rating, priceLevel: p.priceLevel,
        firma: firmaPer(p.id),
      }),
    });
    const data = await res.json().catch(() => ({}));
    const uuid = res.ok && typeof data?.place?.id === "string" && UUID_RE.test(data.place.id) ? (data.place.id as string) : null;
    if (uuid) known.set(p.id, uuid);
    return uuid;
  } catch {
    return null;
  }
}

// "Te l'ha consigliato Giulia" (proposta 58). Il proprio primo nome si legge quando si apre la scheda (così il foglio
// di condivisione non aspetta), una volta per sessione. Va nel link solo se chi condivide si è già fatto vedere:
// profilo pubblico oppure almeno un amico (una riga in follows, da una parte o dall'altra). Qualsiasi errore: niente
// nome, la condivisione va avanti; un errore di rete non resta in memoria.
export type MioNome = { nome: string | null; nelLink: boolean };
// Revisore 15/11 (terzo): tenuta in memoria per tutta la sessione, dopo "Profilo privato" il link portava ancora il
// nome. Ora vale 20 secondi (basta per la scheda appena aperta) e si dimentica appena cambiano profilo o amici.
const letti = new Map<string, { p: Promise<MioNome>; at: number }>();
const VALE_MS = 20_000;
/** Da chiamare quando cambiano nome, profilo pubblico o amici: il prossimo Condividi rilegge. */
export function dimenticaMioNome(): void { letti.clear(); }
async function leggiMioNome(uid: string | null, chiave: string): Promise<MioNome> {
  const nessuno: MioNome = { nome: null, nelLink: false };
  try {
    const client = await browserClient();
    let id = uid;
    if (!id) {
      const { data: s } = await client.auth.getSession();
      id = s?.session?.user?.id ?? null;
    }
    if (!id) return nessuno;
    const { data, error } = await client.from("profiles").select("display_name, is_public").eq("id", id).maybeSingle<{ display_name: string | null; is_public: boolean | null }>();
    if (error) throw error;
    const nome = primoNome(data?.display_name);
    if (!nome) return nessuno;
    if (data?.is_public) return { nome, nelLink: true };
    // Revisore 15/11 (secondo): "amico" come in Amici, cioè reciproco (seguire un profilo pubblico non basta).
    const { data: seguo, error: aErr } = await client.from("follows").select("followed_id").eq("follower_id", id).limit(500);
    if (aErr || !Array.isArray(seguo) || seguo.length === 0) return { nome, nelLink: false };
    const ids = seguo.map((r: { followed_id: string }) => r.followed_id);
    const { data: reciproci, error: rErr } = await client.from("follows").select("follower_id").eq("followed_id", id).in("follower_id", ids).limit(1);
    return { nome, nelLink: !rErr && Array.isArray(reciproci) && reciproci.length > 0 };
  } catch {
    letti.delete(chiave);
    return nessuno;
  }
}
/** Il proprio primo nome e se può andare nei link condivisi (riletto dopo 20 secondi o dopo un cambio). */
export function mioNome(uid?: string | null): Promise<MioNome> {
  const chiave = uid ?? "";
  const c = letti.get(chiave);
  if (c && Date.now() - c.at < VALE_MS) return c.p;
  const p = leggiMioNome(uid ?? null, chiave);
  letti.set(chiave, { p, at: Date.now() });
  return p;
}

// Scelta sul telefono: "Togli" sotto Condividi e i link dopo escono senza nome (finché non si rimette).
const PREF_NOME = "mapetite.condividi.nome";
export function nomeNeiLinkAcceso(): boolean {
  try { return localStorage.getItem(PREF_NOME) !== "no"; } catch { return true; }
}
export function setNomeNeiLink(acceso: boolean): void {
  try { localStorage.setItem(PREF_NOME, acceso ? "si" : "no"); } catch { /* memoria del telefono non disponibile */ }
}
/** Revisore 15/11 (terzo): finché non hai mai condiviso né scelto, la riga "Il link porta il tuo nome · Togli" si vede
 *  già all'apertura della scheda, prima del primo link. Senza memoria del telefono: come se avessi scelto (niente riga fissa). */
export function sceltaNomeFatta(): boolean {
  try { return localStorage.getItem(PREF_NOME) !== null; } catch { return true; }
}

/** Link Mapetite del locale (con la foto, se c'è), oppure null se non si può creare. */
export async function mapetiteShareUrl(p: ShareablePlace): Promise<string | null> {
  const uuid = await placeUuid(p);
  if (!uuid) return null;
  // Le "/" del riferimento restano leggibili: sono valide in un parametro dell'indirizzo.
  const foto = p.photoRef ? `?foto=${encodeURIComponent(p.photoRef).replace(/%2F/g, "/")}` : "";
  return `${window.location.origin}/locali/${uuid}${foto}`;
}

/** Il link con "da=<nome>" (chi lo consiglia), se c'è un nome. */
export function conConsigliatoDa(url: string, da: string | null): string {
  if (!da) return url;
  return `${url}${url.includes("?") ? "&" : "?"}da=${encodeURIComponent(da)}`;
}
