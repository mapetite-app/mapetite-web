import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { followedIds, viewerId } from "@/lib/social";
import { reelSourceOf, type ReelSource } from "@/lib/reel";
import { fotoMie, fotoPubbliche } from "@/lib/foto-utenti-server";
import type { FotoCommunity, FotoUtente } from "@/lib/foto-utenti";

// "Dalla community Mapetite" nella scheda del locale (piani 5.6c e 5.6d): recensioni degli utenti
// (tabella reviews, stelle 1–5 + commento) e reel/video collegati al locale (contenuti_locali).
// Mai mescolate ai dati Google: la scheda le mostra in una sezione a parte, con l'autore.
// Privacy (migrazione 20261016_community.sql): gli altri si leggono SOLO dalle viste pubbliche
// (recensioni_pubbliche, contenuti_pubblici), dove l'autore ha un nome solo se il profilo è
// pubblico. Finché la migrazione non è applicata: recensioni dalla tabella reviews (anonime, come
// oggi) e niente reel ("reelPronti: false").
// Foto degli utenti (migrazione 20261017_foto_utenti.sql): quelle pubbliche degli altri dalla vista
// foto_pubbliche (stesse regole delle recensioni), le proprie da foto_locali (RLS).

export type Autore = { user_id: string; handle: string; display_name: string | null };

export type CommunityReview = {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  autore: Autore | null; // null = profilo privato: "Un membro di Mapetite"
  amico: boolean; // è una persona che segui
};

export type CommunityReel = { id: string; url: string; fonte: ReelSource; autore: Autore | null; mio: boolean };

export type Community = {
  placeId: string | null; // UUID Supabase del locale (serve per scrivere), null se non è in places
  recensioni: CommunityReview[]; // degli altri; la propria è in "mia"
  mia: { rating: number; comment: string | null } | null;
  reel: CommunityReel[];
  reelPronti: boolean; // tabella contenuti_locali presente
  viewer: boolean; // chi guarda ha l'accesso
  foto: FotoCommunity[]; // foto pubbliche degli altri
  mieFoto: FotoUtente[]; // le proprie (anche private: contano per il massimo di 3)
  fotoPronte: boolean; // tabella foto_locali presente
};

export const EMPTY_COMMUNITY: Community = { placeId: null, recensioni: [], mia: null, reel: [], reelPronti: false, viewer: false, foto: [], mieFoto: [], fotoPronte: false };
const EMPTY = EMPTY_COMMUNITY;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SOURCES: readonly string[] = ["Instagram", "TikTok", "YouTube"];

// ── Test automatico ──────────────────────────────────────────────────────────
// Solo in sviluppo con E2E_FAKE_USER: dati finti dal cookie "e2e_community" (scritto da
// scripts/e2e/giro.mjs). Senza cookie la sezione è vuota: nessuna lettura verso Supabase.
// In produzione NODE_ENV è sempre "production" e questo ramo non si attiva.
const dev = () => process.env.NODE_ENV === "development" && !!process.env.E2E_FAKE_USER;

async function fake(id: string): Promise<Community | null> {
  if (!dev()) return null;
  const raw = (await cookies()).get("e2e_community")?.value;
  const viewer = (await viewerId()) != null;
  if (!raw) return { ...EMPTY, placeId: UUID_RE.test(id) ? id : null, viewer };
  try {
    const data = JSON.parse(decodeURIComponent(raw)) as Partial<Community>;
    return { ...EMPTY, ...data, placeId: data.placeId ?? (UUID_RE.test(id) ? id : null), viewer };
  } catch {
    return { ...EMPTY, viewer };
  }
}

type ReviewRow = {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  user_id: string | null;
  handle?: string | null;
  display_name?: string | null;
};
type ReelRow = { id: string; url: string; fonte: string; user_id: string; handle?: string | null; display_name?: string | null };

const autoreOf = (r: { user_id: string | null; handle?: string | null; display_name?: string | null }): Autore | null =>
  r.user_id && r.handle ? { user_id: r.user_id, handle: r.handle, display_name: r.display_name ?? null } : null;

/** Recensioni e reel del locale. `id`: UUID Supabase o Place ID Google (risultato di ricerca). */
export async function loadCommunity(id: string): Promise<Community> {
  const f = await fake(id);
  if (f) return f;

  const supabase = await createClient();
  const viewer = await viewerId();

  let placeId: string | null = UUID_RE.test(id) ? id : null;
  if (!placeId) {
    const { data, error } = await supabase.from("places").select("id").eq("google_place_id", id).limit(1).maybeSingle<{ id: string }>();
    if (error) console.error("[community] places per Place ID:", error.message);
    placeId = data?.id ?? null;
  }
  if (!placeId) return { ...EMPTY, viewer: viewer != null };

  const [pub, mine, ids, myReels, pubReels, altrui, mie] = await Promise.all([
    supabase.from("recensioni_pubbliche").select("id, rating, comment, created_at, user_id, handle, display_name").eq("place_id", placeId).order("created_at", { ascending: false }).limit(50),
    viewer
      ? supabase.from("reviews").select("id, rating, comment").eq("place_id", placeId).eq("user_id", viewer).maybeSingle<{ id: string; rating: number; comment: string | null }>()
      : Promise.resolve({ data: null, error: null }),
    viewer ? followedIds(viewer) : Promise.resolve([] as string[]),
    viewer
      ? supabase.from("contenuti_locali").select("id, url, fonte, user_id").eq("place_id", placeId).eq("user_id", viewer).order("created_at", { ascending: false }).limit(12)
      : Promise.resolve({ data: [] as ReelRow[], error: null }),
    supabase.from("contenuti_pubblici").select("id, url, fonte, user_id, handle, display_name").eq("place_id", placeId).order("created_at", { ascending: false }).limit(24),
    fotoPubbliche(placeId),
    viewer ? fotoMie(viewer, [placeId]) : Promise.resolve(null),
  ]);

  // Recensioni: vista pubblica; senza migrazione la tabella reviews com'è oggi (lettura pubblica, anonima).
  let rows: ReviewRow[];
  if (pub.error) {
    const { data, error } = await supabase.from("reviews").select("id, rating, comment, created_at, user_id").eq("place_id", placeId).order("created_at", { ascending: false }).limit(50);
    if (error) console.error("[community] lettura reviews:", error.message);
    rows = ((data as ReviewRow[] | null) ?? []).map((r) => ({ ...r, user_id: null })); // anonime
  } else {
    rows = (pub.data as ReviewRow[] | null) ?? [];
  }
  if (mine.error) console.error("[community] propria recensione:", mine.error.message);
  const myId = mine.data?.id ?? null;
  const friends = new Set(Array.isArray(ids) ? ids : []);
  const recensioni: CommunityReview[] = rows
    .filter((r) => r.id !== myId && (r.user_id == null || r.user_id !== viewer))
    .map((r) => {
      const autore = autoreOf(r);
      return { id: r.id, rating: r.rating, comment: r.comment?.trim() || null, created_at: r.created_at, autore, amico: autore != null && friends.has(autore.user_id) };
    })
    // Prima chi segui, poi chi ha scritto qualcosa, poi le più recenti: mai "le più votate".
    .sort((a, b) => Number(b.amico) - Number(a.amico) || Number(b.comment != null) - Number(a.comment != null) || b.created_at.localeCompare(a.created_at));

  // Reel: i propri (RLS) e quelli dei profili pubblici, senza doppioni dello stesso link.
  const reelPronti = viewer ? !myReels.error : !pubReels.error;
  if (pubReels.error) console.error("[community] contenuti_pubblici:", pubReels.error.message);
  if (myReels.error) console.error("[community] contenuti_locali (migrazione 20261016_community non applicata?):", myReels.error.message);
  const seen = new Set<string>();
  const reel: CommunityReel[] = [];
  for (const r of [...((myReels.data as ReelRow[] | null) ?? []), ...((pubReels.data as ReelRow[] | null) ?? [])]) {
    // Il link deve essere davvero di quella fonte (17/10): chi scrive direttamente nel database
    // poteva pubblicare un link qualsiasi etichettato "Instagram".
    if (!SOURCES.includes(r.fonte) || reelSourceOf(r.url) !== r.fonte || seen.has(r.url)) continue;
    seen.add(r.url);
    const mio = r.user_id === viewer;
    reel.push({ id: r.id, url: r.url, fonte: r.fonte as ReelSource, autore: mio ? null : autoreOf(r), mio });
  }

  return {
    placeId,
    recensioni,
    mia: mine.data ? { rating: mine.data.rating, comment: mine.data.comment ?? null } : null,
    reel: reel.slice(0, 12),
    reelPronti,
    viewer: viewer != null,
    foto: altrui,
    mieFoto: mie?.foto.get(placeId) ?? [],
    fotoPronte: mie?.pronte ?? false,
  };
}
