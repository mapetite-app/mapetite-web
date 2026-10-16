import { cache } from "react";
import { cookies } from "next/headers";
import { createClient, getUser } from "@/lib/supabase/server";
import { isValidHandle } from "@/lib/handle";

// Parte social (piano 5.1–5.4): letture lato server per /u/<handle>, /amici, la scheda pubblica
// del locale e le impostazioni del profilo.
// Si legge SOLO dalle viste pubbliche (profili_pubblici, salvati_pubblici: mai la nota privata)
// e dai propri follow. Se la migrazione 20261015_social.sql non è ancora applicata (viste,
// tabella o colonne mancanti) ogni lettura restituisce "in-arrivo": la pagina lo dice con
// garbo invece di rompersi.

export type PublicProfile = {
  id: string;
  handle: string;
  display_name: string | null;
  bio: string | null;
  city: string | null;
  visitati: number;
  da_provare: number;
  seguaci: number;
  seguiti: number;
};

export type PublicSaved = {
  user_id: string;
  handle: string;
  display_name: string | null;
  place_id: string;
  tags: string[] | null;
  created_at: string;
  name: string;
  category: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
};

export type MySocial = {
  handle: string | null;
  display_name: string | null;
  bio: string | null;
  city: string | null;
  is_public: boolean;
};

export type InArrivo = { stato: "in-arrivo" };

const PROFILE_COLUMNS = "id, handle, display_name, bio, city, visitati, da_provare, seguaci, seguiti";
const SAVED_COLUMNS = "user_id, handle, display_name, place_id, tags, created_at, name, category, address, lat, lng";

// ── Test automatico ──────────────────────────────────────────────────────────
// Solo in sviluppo con E2E_FAKE_USER: dati finti dal cookie "e2e_social" (scritto da
// scripts/e2e/giro.mjs), perché il test non può simulare le letture del server. Senza cookie
// la parte social risulta "in arrivo" (nessuna lettura verso Supabase durante il giro).
// In produzione NODE_ENV è sempre "production" e questo ramo non si attiva.
type FakeSocial = {
  inArrivo?: boolean;
  profili?: PublicProfile[];
  salvati?: PublicSaved[];
  seguo?: string[];
  mio?: MySocial;
};
const dev = () => process.env.NODE_ENV === "development" && !!process.env.E2E_FAKE_USER;

async function fake(): Promise<FakeSocial | "in-arrivo" | null> {
  if (!dev()) return null;
  const raw = (await cookies()).get("e2e_social")?.value;
  if (!raw) return "in-arrivo";
  try {
    const data = JSON.parse(decodeURIComponent(raw)) as FakeSocial;
    return data.inArrivo ? "in-arrivo" : data;
  } catch {
    return "in-arrivo";
  }
}

// Chi sta guardando (null = nessun accesso). In sviluppo con E2E_FAKE_USER l'utente finto,
// o nessuno con il cookie "e2e_anonimo", come in /stasera e /locali.
export const viewerId = cache(async (): Promise<string | null> => {
  if (dev()) return (await cookies()).get("e2e_anonimo") ? null : process.env.E2E_FAKE_USER!;
  const { data } = await getUser();
  return data?.user?.id ?? null;
});

function logMissing(where: string, error: { code?: string; message: string }) {
  console.error(`[social] ${where}: ${error.code ?? ""} ${error.message} (migrazione 20261015_social non applicata?)`);
}

// Id di chi segue l'utente (solo i propri follow, RLS).
export async function followedIds(userId: string): Promise<string[] | InArrivo> {
  const f = await fake();
  if (f === "in-arrivo") return { stato: "in-arrivo" };
  if (f) return f.seguo ?? [];
  const supabase = await createClient();
  const { data, error } = await supabase.from("follows").select("followed_id").eq("follower_id", userId);
  if (error) {
    logMissing("follows", error);
    return { stato: "in-arrivo" };
  }
  return (data ?? []).map((r) => r.followed_id as string);
}

// ── Profilo pubblico /u/<handle> ─────────────────────────────────────────────
export type ProfilePage =
  | InArrivo
  | { stato: "non-trovato" }
  | { stato: "ok"; profile: PublicProfile; places: PublicSaved[]; iFollow: boolean; isMe: boolean; viewer: string | null };

export const loadProfilePage = cache(async (rawHandle: string): Promise<ProfilePage> => {
  const handle = decodeURIComponent(rawHandle).toLowerCase();
  if (!isValidHandle(handle)) return { stato: "non-trovato" };
  const viewer = await viewerId();
  const f = await fake();
  if (f === "in-arrivo") return { stato: "in-arrivo" };

  let profile: PublicProfile | null;
  let places: PublicSaved[];
  if (f) {
    profile = (f.profili ?? []).find((p) => p.handle === handle) ?? null;
    places = profile ? (f.salvati ?? []).filter((s) => s.user_id === profile!.id) : [];
  } else {
    const supabase = await createClient();
    const { data, error } = await supabase.from("profili_pubblici").select(PROFILE_COLUMNS).eq("handle", handle).maybeSingle();
    if (error) {
      logMissing("profili_pubblici", error);
      return { stato: "in-arrivo" };
    }
    profile = (data as PublicProfile | null) ?? null;
    places = [];
    if (profile) {
      const { data: s, error: sErr } = await supabase
        .from("salvati_pubblici")
        .select(SAVED_COLUMNS)
        .eq("user_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(300);
      if (sErr) logMissing("salvati_pubblici", sErr);
      places = (s as PublicSaved[] | null) ?? [];
    }
  }
  if (!profile) return { stato: "non-trovato" };

  let iFollow = false;
  if (viewer && viewer !== profile.id) {
    const ids = await followedIds(viewer);
    iFollow = Array.isArray(ids) && ids.includes(profile.id);
  }
  return { stato: "ok", profile, places, iFollow, isMe: viewer === profile.id, viewer };
});

// ── Feed di /amici ───────────────────────────────────────────────────────────
export type FeedPage = InArrivo | { stato: "ok"; seguiti: PublicProfile[]; attivita: PublicSaved[]; mio: MySocial | null };

export async function loadFeed(userId: string): Promise<FeedPage> {
  const ids = await followedIds(userId);
  if (!Array.isArray(ids)) return ids;
  const mio = await loadMySocial(userId);
  const meState = "stato" in mio ? null : mio;
  if (ids.length === 0) return { stato: "ok", seguiti: [], attivita: [], mio: meState };

  const f = await fake();
  if (f && f !== "in-arrivo") {
    return {
      stato: "ok",
      seguiti: (f.profili ?? []).filter((p) => ids.includes(p.id)),
      attivita: (f.salvati ?? []).filter((s) => ids.includes(s.user_id)).sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 60),
      mio: meState,
    };
  }
  const supabase = await createClient();
  const [{ data: profili, error: pErr }, { data: salvati, error: sErr }] = await Promise.all([
    supabase.from("profili_pubblici").select(PROFILE_COLUMNS).in("id", ids),
    supabase.from("salvati_pubblici").select(SAVED_COLUMNS).in("user_id", ids).order("created_at", { ascending: false }).limit(60),
  ]);
  if (pErr || sErr) {
    logMissing("feed", (pErr ?? sErr)!);
    return { stato: "in-arrivo" };
  }
  return { stato: "ok", seguiti: (profili as PublicProfile[]) ?? [], attivita: (salvati as PublicSaved[]) ?? [], mio: meState };
}

// ── "N amici ci sono stati" nella scheda pubblica del locale ─────────────────
export type FriendsAtPlace = { visitati: PublicSaved[]; daProvare: PublicSaved[] };

export async function loadFriendsAtPlace(placeId: string): Promise<FriendsAtPlace | null> {
  const viewer = await viewerId();
  if (!viewer) return null;
  const ids = await followedIds(viewer);
  if (!Array.isArray(ids) || ids.length === 0) return null;
  let rows: PublicSaved[];
  const f = await fake();
  if (f && f !== "in-arrivo") {
    rows = (f.salvati ?? []).filter((s) => s.place_id === placeId && ids.includes(s.user_id));
  } else {
    const supabase = await createClient();
    const { data, error } = await supabase.from("salvati_pubblici").select(SAVED_COLUMNS).eq("place_id", placeId).in("user_id", ids).limit(50);
    if (error) {
      logMissing("salvati_pubblici", error);
      return null;
    }
    rows = (data as PublicSaved[]) ?? [];
  }
  const visitati = rows.filter((r) => r.tags?.includes("Già visitato"));
  const daProvare = rows.filter((r) => !r.tags?.includes("Già visitato") && r.tags?.includes("Da provare"));
  return visitati.length + daProvare.length > 0 ? { visitati, daProvare } : null;
}

// Stessa lettura dalla scheda della mappa (/api/places/amici), dove l'id può essere il Place ID
// Google di un risultato di ricerca: si cerca la riga in places (lettura pubblica) solo dopo aver
// visto che chi guarda è collegato e segue qualcuno, così chi non ha amici non costa nulla.
// Nel giro automatico (dati finti dal cookie) l'id si usa così com'è.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function loadFriendsAtAnyPlace(id: string): Promise<FriendsAtPlace | null> {
  const viewer = await viewerId();
  if (!viewer) return null;
  const ids = await followedIds(viewer);
  if (!Array.isArray(ids) || ids.length === 0) return null;
  if (UUID_RE.test(id) || (await fake())) return loadFriendsAtPlace(id);
  const supabase = await createClient();
  const { data, error } = await supabase.from("places").select("id").eq("google_place_id", id).limit(1).maybeSingle<{ id: string }>();
  if (error) console.error("[social] places per Place ID:", error.message);
  return data?.id ? loadFriendsAtPlace(data.id) : null;
}

// ── Impostazioni del proprio profilo pubblico (/profilo) ─────────────────────
export async function loadMySocial(userId: string): Promise<MySocial | InArrivo> {
  const f = await fake();
  if (f === "in-arrivo") return { stato: "in-arrivo" };
  if (f) return f.mio ?? { handle: null, display_name: null, bio: null, city: null, is_public: false };
  const supabase = await createClient();
  const { data, error } = await supabase.from("profiles").select("handle, display_name, bio, city, is_public").eq("id", userId).maybeSingle();
  if (error) {
    logMissing("profiles", error);
    return { stato: "in-arrivo" };
  }
  const d = data as Partial<MySocial> | null;
  return { handle: d?.handle ?? null, display_name: d?.display_name ?? null, bio: d?.bio ?? null, city: d?.city ?? null, is_public: d?.is_public === true };
}
