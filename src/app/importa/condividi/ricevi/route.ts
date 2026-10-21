import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { extractPlace, fromParsed, type ImportResult, type Luogo } from "@/lib/import-caption";
import { allowAi, clientKey } from "@/lib/ai-limit";
import { CONDIVISO_COOKIE, condivisoTesto, impronta } from "@/lib/condiviso";

// Destinazione del "Condividi" di Android (share_target POST nel manifest).
// Arrivano due cose diverse:
//  - un link di Google Maps (title/text/url) → si passa alla pagina /importa/condividi di sempre;
//  - screenshot di Instagram/TikTok (campo "immagini", fino a 5 slide di un carosello) → Haiku legge
//    nome e città da ognuno (la stessa chiamata dell'import manuale) e si va alla pagina con l'esito.
// Le immagini non passano da un redirect: qui si leggono e nell'URL va solo l'esito.

// Formati che Haiku accetta; il tipo si ricava dai primi byte (Android a volte non lo manda).
function sniffImageType(b: Uint8Array): string | null {
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return "image/gif";
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "image/webp";
  return null;
}

// Limite della API di Anthropic per una singola immagine.
const MAX_BYTES = 5 * 1024 * 1024;
// Slide di un carosello lette per condivisione e locali tenuti in tutto (proposta 13).
const MAX_IMMAGINI = 5;
const MAX_LUOGHI = 8;
const RESULT_PAGE = "/importa/condividi/immagine";
const LETTO_COOKIE = "mapetite_reel_letto";

const field = (form: FormData, k: string) => {
  const v = form.get(k);
  return typeof v === "string" ? v.trim() : "";
};

async function currentUserId(request: NextRequest): Promise<string | null> {
  // Solo in sviluppo locale: utente finto per il test automatico (scripts/e2e/giro.mjs);
  // il cookie "e2e_anonimo" simula chi non ha fatto l'accesso.
  const dev = process.env.NODE_ENV === "development";
  if (dev && request.cookies.get("e2e_anonimo")) return null;
  if (dev && process.env.E2E_FAKE_USER) return process.env.E2E_FAKE_USER;
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    return data?.user?.id ?? null;
  } catch {
    return null;
  }
}

// Solo in sviluppo con E2E_FAKE_USER: lettura finta dal cookie "e2e_lettura" (niente Haiku nei test).
// Un array dà una lettura diversa per ogni immagine (carosello), nell'ordine.
function fakeReadings(request: NextRequest): ImportResult[] | null {
  if (process.env.NODE_ENV !== "development" || !process.env.E2E_FAKE_USER) return null;
  const raw = request.cookies.get("e2e_lettura")?.value;
  if (!raw) return null;
  try {
    const p: unknown = JSON.parse(decodeURIComponent(raw));
    const list = (Array.isArray(p) ? p : [p]).map(fromParsed);
    return list.length ? list : null;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  // 303: dopo un POST il browser apre la pagina di arrivo con un GET.
  const go = (path: string) => NextResponse.redirect(new URL(path, request.url), 303);

  const form = await request.formData().catch(() => null);
  if (!form) return go("/importa/condividi");

  const images = form.getAll("immagini").filter((f): f is File => typeof f !== "string" && f.size > 0);

  // Nessuna immagine: è un link (Google Maps o altro). Stessa pagina e stessa logica di prima.
  if (images.length === 0) {
    const q = new URLSearchParams();
    for (const k of ["title", "text", "url"]) {
      const v = field(form, k);
      if (v) q.set(k, v);
    }
    const qs = q.toString();
    const res = go(`/importa/condividi${qs ? `?${qs}` : ""}`);
    // Segno del Condividi vero: solo così un reel si salva da solo (un link costruito a mano chiede "È questo?").
    const testo = condivisoTesto(field(form, "title"), field(form, "text"), field(form, "url"));
    if (testo) res.cookies.set(CONDIVISO_COOKIE, impronta(testo), { httpOnly: true, sameSite: "lax", maxAge: 600, path: "/importa/condividi" });
    return res;
  }

  const userId = await currentUserId(request);
  if (!userId) {
    const message = "Accedi a Mapetite, poi condividi di nuovo lo screenshot da Instagram o TikTok.";
    return go(`/login?message=${encodeURIComponent(message)}`);
  }

  // Carosello ("5 posti dove…", una slide per locale): si leggono fino a MAX_IMMAGINI screenshot,
  // una lettura Haiku ciascuno (in parallelo), e i locali si uniscono senza doppioni nell'ordine delle
  // slide. Oltre il massimo si leggono le prime e lo si dice.
  const out = new URLSearchParams();
  if (images.length > MAX_IMMAGINI) out.set("piu", "1");
  const result = (params: Record<string, string | null>) => {
    for (const [k, v] of Object.entries(params)) if (v) out.set(k, v);
    return go(`${RESULT_PAGE}?${out}`);
  };

  const prese = images.slice(0, MAX_IMMAGINI);
  const scelte: { mediaType: string; bytes: Uint8Array }[] = [];
  let scarto: "grande" | "formato" | null = null;
  for (const file of prese) {
    if (file.size > MAX_BYTES) { scarto ??= "grande"; continue; }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const mediaType = sniffImageType(bytes);
    if (!mediaType) { scarto ??= "formato"; continue; }
    scelte.push({ mediaType, bytes });
  }
  if (scelte.length === 0) return result({ errore: scarto ?? "formato" });

  // Tetto AI (src/lib/ai-limit.ts): conta solo le letture vere con Haiku, una per immagine.
  const finte = fakeReadings(request);
  const key = clientKey(request, userId);
  const permesse = finte ? scelte : scelte.filter(() => allowAi("screenshot", key));
  if (permesse.length === 0) return result({ errore: "limite" });

  const letture = await Promise.all(permesse.map((img, i) =>
    finte
      ? Promise.resolve(finte[Math.min(i, finte.length - 1)])
      : extractPlace({ image: { mediaType: img.mediaType, data: Buffer.from(img.bytes).toString("base64") } }).catch(() => null),
  ));
  const luoghi: Luogo[] = [];
  for (const l of letture) {
    for (const x of l?.luoghi?.length ? l.luoghi : l?.nome ? [{ nome: l.nome, citta: l.citta, categoria: l.categoria }] : []) {
      if (luoghi.length >= MAX_LUOGHI) break;
      if (!luoghi.some((y) => y.nome.toLowerCase() === x.nome.toLowerCase())) luoghi.push(x);
    }
  }
  console.log(`[condividi/ricevi] ${permesse.length} screenshot letti:`, luoghi.length ? `${luoghi.length} locali` : "nessun locale");
  if (permesse.length > 1) out.set("lette", String(permesse.length));

  const lettura = luoghi[0];
  if (!lettura) return result({ errore: "illeggibile" });
  // Gli altri locali del post viaggiano insieme, già letti: nessuna nuova lettura AI.
  const altri = luoghi.slice(1);
  const res = result({ nome: lettura.nome, citta: lettura.citta, categoria: lettura.categoria, altri: altri.length ? JSON.stringify(altri) : null });
  // Segno che la lettura l'ha fatta davvero questo telefono: solo così la pagina dell'esito può
  // salvare da sola. Un link costruito a mano con ?nome=… chiede sempre "È questo?".
  res.cookies.set(LETTO_COOKIE, encodeURIComponent(lettura.nome), { httpOnly: true, sameSite: "lax", maxAge: 600, path: RESULT_PAGE });
  return res;
}

// Chi apre l'indirizzo a mano (GET) finisce sulla pagina del Condividi.
export function GET(request: NextRequest) {
  return NextResponse.redirect(new URL("/importa/condividi", request.url), 303);
}
