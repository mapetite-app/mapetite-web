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
// Details). Tetti: una prova al giorno per telefono (cookie), il limitatore per IP e PROVE_AL_GIORNO per tutta
// l'app (tabella prove_reel, prenotazione atomica), così le 50 ricerche Google al giorno restano agli utenti.
// Niente si salva: per salvarlo serve l'account ("Salvalo" porta alla registrazione con il link).
const PROVE_AL_GIORNO = 5;
const COOKIE = "mapetite_prova";
const romeDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit" });

// Prenota una prova sul tetto di tutta l'app (funzione atomica, migrazione 20261121b): true = si può
// cercare su Google. Su errore niente prova: il tetto non deve sparire se il database non risponde.
async function prenotaProva(): Promise<boolean> {
  if (process.env.NODE_ENV === "development") return true; // in sviluppo niente scritture nel database vero
  try {
    const { data, error } = await createAdminClient().rpc("prenota_prova_reel", { tetto: PROVE_AL_GIORNO });
    if (error) throw error;
    return data === true;
  } catch (e) {
    console.error("[prova-reel] prenotazione non riuscita:", e);
    return false;
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

  // 2. Tetto di tutta l'app (prenotazione atomica), poi la ricerca Google (l'unica chiamata a pagamento).
  if (!(await prenotaProva())) {
    console.warn(`[prova-reel] tetto di ${PROVE_AL_GIORNO} prove al giorno raggiunto (o conteggio non riuscito)`);
    return err(429, "pieno", "Per oggi le prove sono finite: crea l'account e salvalo lo stesso.");
  }
  void recordEvent({ type: "funzione", anonId: jar.get(ANON_COOKIE)?.value ?? null, props: { nome: "prova_reel_server", fonte: social ?? "nome" } });

  // Il nome scritto a mano si cerca com'è (con la zona: "Da Felice Testaccio"); quello letto dal video con la città.
  // Ordine di Google (rilevanza), non per voto: conta trovare proprio quel locale.
  // Senza la città nel nome scritto Google può non trovare niente ("Felice a Testaccio" → nessun risultato).
  const conCitta = (t: string) => (luogo.citta && !t.toLowerCase().includes(luogo.citta.toLowerCase()) ? `${t} ${luogo.citta}` : t);
  const query = nome ? conCitta(nome) : [luogo.nome, luogo.citta].filter(Boolean).join(" ");
  const trovati = await searchGooglePlaces(query, { sortMode: "relevance", locationMode: "none" }).catch((e) => { console.error("[prova-reel] Google:", e); return null; });
  if (!trovati) return err(502, "google", "Google Maps non risponde: riprova più tardi.");
  jar.set(COOKIE, oggi, { maxAge: 60 * 60 * 24, sameSite: "lax", path: "/", httpOnly: true });
  const firma = (p: (typeof trovati)[number]) => ({
    id: p.id, name: p.name, address: p.address, lat: p.lat, lng: p.lng, category: p.category, rating: p.rating,
    priceLevel: p.priceLevel, photoRef: p.photoRef, photoAuthor: p.photoAuthor ?? null, firma: signCatalogEntry(p),
  });
  // Solo un risultato con lo stesso nome è "il posto del reel". Altrimenti si dice che non siamo sicuri e si
  // mostra il nome del candidato senza verdetto: mai il verdetto di un altro locale come se fosse la risposta.
  // Il nome letto dall'AI o, se l'ha scritto la persona, il suo nome com'è ("Felice a Testaccio").
  const uguale = trovati.find((p) => sameName(luogo.nome, p.name) || (nome !== "" && sameName(nome, p.name))) ?? null;
  const risultati = [...(uguale ? [uguale] : []), ...trovati.filter((p) => p !== uguale)].slice(0, 5).map(firma);
  console.log(`[prova-reel] ${JSON.stringify(query)} → ${uguale ? uguale.name : `nessun nome uguale (primo: ${trovati[0]?.name ?? "niente"})`} (${trovati.length} da Google)`);
  if (!uguale) {
    return NextResponse.json({ letto: luogo, scritto: Boolean(nome), posto: null, candidato: trovati[0]?.name ?? null, verdetto: null, risultati });
  }
  const posto = uguale;

  // 3. Verdetto: dalla cache se c'è, altrimenti Haiku con le recensioni già arrivate dalla ricerca.
  const s = (await getSynthesis([posto], "", null, { soloVerdetto: true }).catch(() => ({})) as Record<string, { verdict?: string; goFor?: string[]; dontExpect?: string[]; recensioniN?: number | null; recensioneUltima?: string | null }>)[posto.id];
  // I dati Google si mostrano e basta (mai salvati: termini Google, 3.2.3(b)).
  return NextResponse.json({
    letto: luogo,
    scritto: Boolean(nome),
    posto: { ...risultati[0], userRatingCount: posto.userRatingCount },
    verdetto: s?.verdict ? { verdict: s.verdict, goFor: s.goFor ?? [], dontExpect: s.dontExpect ?? [], recensioniN: s.recensioniN ?? null, recensioneUltima: s.recensioneUltima ?? null } : null,
    // Gli stessi risultati, per non ripetere la ricerca dopo la registrazione (cache del telefono).
    risultati,
  });
}
