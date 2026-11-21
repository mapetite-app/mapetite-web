import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { extractPlace } from "@/lib/import-caption";
import { allowAi, clientKey, AI_LIMIT_SCREENSHOT_MESSAGE } from "@/lib/ai-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchVideoCaption, findVideoLink } from "@/lib/video-caption";
import { findSocialLink, placeHintFromText } from "@/lib/social-link";
import { searchGooglePlaces } from "@/lib/google-places";
import { getSynthesis } from "@/lib/haiku-synthesis";
import { sameName } from "@/lib/reel-match";
import { signCatalogEntry } from "@/lib/catalog-sig";
import { isAutomated, recordEvent, ANON_COOKIE } from "@/lib/events";

// "Provalo senza account" (proposta 75): chi non ha ancora un account incolla un reel in home e vede
// il posto con il verdetto prima di registrarsi. Stessi pezzi di "Salva dal reel" (didascalia dal link
// ufficiale di TikTok/YouTube, o il nome scritto a mano per Instagram; l'AI trova il locale; 1 Text
// Search Google; verdetto dalla cache o da Haiku con le recensioni della stessa ricerca, zero Place
// Details). Tetti: una prova al giorno per telefono (cookie) e PROVE_AL_GIORNO per tutta l'app, contate
// nella tabella events come i verdetti, così le 50 ricerche Google al giorno restano agli utenti.
// Niente si salva: per salvarlo serve l'account ("Salvalo" porta alla registrazione con il link).
const PROVE_AL_GIORNO = 5;
const COOKIE = "mapetite_prova";
const romeDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit" });

async function proveDiOggi(): Promise<number> {
  if (process.env.NODE_ENV === "development") return 0; // in sviluppo gli eventi non si scrivono
  try {
    const since = new Date(`${romeDay.format(new Date())}T00:00:00+02:00`).toISOString();
    const { count, error } = await createAdminClient()
      .from("events")
      .select("id", { count: "exact", head: true })
      .eq("type", "funzione")
      .eq("props->>nome", "prova_reel")
      .gte("created_at", since);
    if (error) throw error;
    return count ?? 0;
  } catch (err) {
    // Senza conteggio non si rischia la quota Google: niente prova.
    console.error("[prova-reel] conteggio di oggi non riuscito:", err);
    return PROVE_AL_GIORNO;
  }
}

const err = (status: number, codice: string, error: string) => NextResponse.json({ codice, error }, { status });

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const testo = typeof body?.testo === "string" ? body.testo.trim() : "";
  const nome = typeof body?.nome === "string" ? body.nome.trim() : "";
  if (!testo && !nome) return err(400, "vuoto", "Incolla il link di un reel.");
  if (testo.length > 1000 || nome.length > 120) return err(400, "lungo", "Testo troppo lungo: incolla solo il link.");
  if (isAutomated(request)) return err(403, "robot", "Prova dal telefono.");

  const jar = await cookies();
  const oggi = romeDay.format(new Date());
  if (jar.get(COOKIE)?.value === oggi) {
    return err(429, "fatta", "Hai già fatto la prova di oggi: crea l'account per salvarne quanti vuoi.");
  }
  if (!allowAi("screenshot", clientKey(request))) return err(429, "troppe", AI_LIMIT_SCREENSHOT_MESSAGE);

  // 1. Cosa leggere: il nome scritto, il testo condiviso con il nome ("Pizzeria Bella a Roma https://…"),
  //    la didascalia ufficiale di TikTok/YouTube. Instagram non la dà: si chiede il nome.
  const social = findSocialLink(testo);
  const video = findVideoLink(testo);
  if (!nome && !social) return err(400, "link", "Questo non sembra il link di un reel di Instagram, TikTok o YouTube.");
  const pezzi = [nome, placeHintFromText(testo) ?? ""].filter(Boolean);
  if (pezzi.length === 0 && video) {
    const didascalia = await fetchVideoCaption(video).catch(() => null);
    if (didascalia) pezzi.push(didascalia.slice(0, 1500));
  }
  if (pezzi.length === 0) {
    return err(422, "nome", social === "Instagram"
      ? "Instagram non lascia leggere i reel alle altre app: scrivi il nome del locale che vedi nel video."
      : "Non riesco a leggere questo video: scrivi il nome del locale che vedi.");
  }
  const letto = await extractPlace({ caption: pezzi.join("\n") }).catch(() => null);
  const luogo = letto?.luoghi?.[0] ?? (letto?.nome ? { nome: letto.nome, citta: letto.citta, categoria: letto.categoria } : null);
  if (!luogo) return err(422, "nome", "Qui non trovo il nome di un locale: scrivilo tu.");

  // 2. Tetto di tutta l'app, poi la ricerca Google (l'unica chiamata a pagamento). L'evento si scrive
  //    prima della chiamata: due prove insieme non superano il tetto.
  if ((await proveDiOggi()) >= PROVE_AL_GIORNO) {
    console.warn(`[prova-reel] tetto di ${PROVE_AL_GIORNO} prove al giorno raggiunto`);
    return err(429, "pieno", "Per oggi le prove sono finite: crea l'account e salvalo lo stesso.");
  }
  await recordEvent({ type: "funzione", anonId: jar.get(ANON_COOKIE)?.value ?? null, props: { nome: "prova_reel", fonte: social ?? "nome" } });
  jar.set(COOKIE, oggi, { maxAge: 60 * 60 * 24, sameSite: "lax", path: "/", httpOnly: true });

  const query = [luogo.nome, luogo.citta].filter(Boolean).join(" ");
  const trovati = await searchGooglePlaces(query).catch((e) => { console.error("[prova-reel] Google:", e); return null; });
  if (!trovati) return err(502, "google", "Google Maps non risponde: riprova più tardi.");
  // Prima un risultato con lo stesso nome; altrimenti il primo di Google, dichiarato ("Nel reel: «…».
  // Su Google Maps trovo questo"): Google scrive spesso il nome con la zona ("Felice a Testaccio | ROMA").
  const uguale = trovati.find((p) => sameName(luogo.nome, p.name)) ?? null;
  const posto = uguale ?? trovati[0] ?? null;
  console.log(`[prova-reel] letto ${JSON.stringify(query)} → ${posto ? `${posto.name}${uguale ? "" : " (nome diverso)"}` : "niente"} (${trovati.length} da Google)`);
  if (!posto) return NextResponse.json({ letto: luogo, posto: null, sicuro: false, verdetto: null, risultati: [] });

  // 3. Verdetto: dalla cache se c'è, altrimenti Haiku con le recensioni già arrivate dalla ricerca.
  const s = (await getSynthesis([posto], "", null, { soloVerdetto: true }).catch(() => ({})) as Record<string, { verdict?: string; goFor?: string[]; dontExpect?: string[]; recensioniN?: number | null; recensioneUltima?: string | null }>)[posto.id];
  const firmati = trovati.slice(0, 5).map((p) => ({
    id: p.id, name: p.name, address: p.address, lat: p.lat, lng: p.lng, category: p.category, rating: p.rating,
    priceLevel: p.priceLevel, photoRef: p.photoRef, photoAuthor: p.photoAuthor ?? null, firma: signCatalogEntry(p),
  }));
  // I dati Google si mostrano e basta (mai salvati: termini Google, 3.2.3(b)).
  return NextResponse.json({
    letto: luogo,
    posto: { ...firmati.find((p) => p.id === posto.id)!, userRatingCount: posto.userRatingCount },
    sicuro: Boolean(uguale),
    verdetto: s?.verdict ? { verdict: s.verdict, goFor: s.goFor ?? [], dontExpect: s.dontExpect ?? [], recensioniN: s.recensioniN ?? null, recensioneUltima: s.recensioneUltima ?? null } : null,
    // Gli stessi risultati, per non ripetere la ricerca dopo la registrazione (cache del telefono).
    risultati: firmati,
  });
}
