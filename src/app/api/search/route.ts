import { NextResponse, after } from "next/server";
import { compattaOrari } from "@/lib/orari";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { searchGooglePlaces, type PlaceResult } from "@/lib/google-places";
import { getSynthesis, SYNTHESIS_LIMIT, type PlaceSynthesis } from "@/lib/haiku-synthesis";
import { selectQualityReviews } from "@/lib/review-selection";
import { extractSearchIntent, sanitizeIntent } from "@/lib/search-intent";
import { distanceMeters } from "@/lib/distance";
import { isAutomated, recordEvent, ANON_COOKIE, SESSION_COOKIE } from "@/lib/events";
import { cookies } from "next/headers";
import { allowAi, clientKey, AI_LIMIT_MESSAGE } from "@/lib/ai-limit";
import { demoteForChicche, demoteMainstream, demoteTouristTraps, lowerMassFromTop } from "@/lib/mainstream";
import { gustiPerRicerca, gustiValidi, inFondoPerGusti } from "@/lib/gusti";
import { pulisciMappa, scopertaDedotta } from "@/lib/mappa-gusto";
import { demoteOffType } from "@/lib/off-type";
import { namedCity, cityNear, withDistrict, demoteOtherCity, wholeCity, cityArea, stripCity, isStreet, isOtherCity, namedOtherCity, ambiguousDistrict, districtCity, demoteFarFrom, districtCenter, stripDistrict, withDefaultType, stripMood } from "@/lib/named-city";
import { requiredAttributes, type WeekTime } from "@/lib/filter-options";
import { buildSynthesisInput, signSynthesisInput, type SynthesisInput } from "@/lib/synthesis-token";
import { signCatalogEntry } from "@/lib/catalog-sig";
import { REQUISITI_ACCESI, requisitiProvati, type Candidato } from "@/lib/prova-requisito";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Public pricing for claude-haiku-4-5 (https://platform.claude.com/docs/en/pricing)
const HAIKU_INPUT_PER_MTOK = 1.00;
const HAIKU_OUTPUT_PER_MTOK = 5.00;

type SearchFilters = {
  categoria: string | null;
  parole_chiave: string[];
  vicino_a_me: boolean;
  zona?: string | null; // zona nominata nella frase (solo per mostrarla: "Ho capito: … · a Trastevere")
};

// Gruppi di verdetti chiesti in parallelo dal telefono (somma = SYNTHESIS_LIMIT).
const VERDICT_GROUPS = [2, 3, 3, 4];

// Strip chars that could break PostgREST or() filter string syntax
const sanitize = (s: string): string =>
  s.replace(/[^a-zA-ZÀ-ÿ0-9 ]/g, "").trim().slice(0, 100);

// Quota giornaliera di Google finita: searchGooglePlaces lancia "… error 429 …".
const isQuota = (err: unknown) => err instanceof Error && /error 429/.test(err.message);
const quotaResponse = () =>
  NextResponse.json(
    // La quota Google si azzera a mezzanotte della costa ovest USA, cioè alle 9:00 in Italia.
    { error: "Le ricerche nuove sono finite per ora: ripartono alle 9:00. Intanto puoi cercare tra i tuoi salvati." },
    { status: 503 },
  );

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const query = body?.query;
  const source: "world" | "saved" =
    body?.source === "world" ? "world" : "saved";
  // Intento dichiarato dal chiamante: "natural" = query in linguaggio naturale →
  // preserva la rilevanza Google; "structured" (o assente) = modalità a filtri →
  // sort per qualità. Nessuna euristica: lo decide chi fa la ricerca, non il server.
  const searchIntent: "natural" | "structured" =
    body?.searchIntent === "natural" ? "natural" : "structured";
  // "fast": solo dati Google (prima risposta); verdetti con /api/search/synthesis.
  // Assente = comportamento completo di sempre.
  const fastPhase = body?.phase === "fast";
  const lat = typeof body?.lat === "number" ? body.lat : undefined;
  const lng = typeof body?.lng === "number" ? body.lng : undefined;
  // Filtri: occasione e caratteristiche (le parole sono già nella query; qui i campi Google).
  const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, 20) : []);
  const occasione = typeof body?.occasion === "string" ? body.occasion : null;
  const caratteristiche = strings(body?.features);
  const attrs = searchIntent === "structured" ? requiredAttributes(occasione, caratteristiche) : [];
  // "Aperto a un'ora scelta": giorno e ora calcolati dal telefono (ora locale, come gli orari Google).
  const oa = body?.openAt;
  const openAt: WeekTime | undefined =
    searchIntent === "structured" && oa && [oa.day, oa.hour, oa.minute].every((n) => Number.isInteger(n)) &&
    oa.day >= 0 && oa.day <= 6 && oa.hour >= 0 && oa.hour <= 23 && oa.minute >= 0 && oa.minute <= 59
      ? { day: oa.day, hour: oa.hour, minute: oa.minute }
      : undefined;

  if (typeof query !== "string" || query.trim() === "") {
    return NextResponse.json(
      { error: "Il campo 'query' è obbligatorio e deve essere una stringa non vuota." },
      { status: 400 }
    );
  }

  if (query.length > 500) {
    return NextResponse.json(
      { error: "La query non può superare i 500 caratteri." },
      { status: 400 }
    );
  }

  // Utente (se ha fatto l'accesso): serve al tetto AI per persona, ai gusti nei verdetti e alla
  // ricerca tra i salvati. Letto una volta sola. Il tetto conta per utente, non per indirizzo IP:
  // a una demo o tra tester sulla stessa rete Wi-Fi non si bloccano a vicenda.
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  const aiKey = clientKey(request, authUser?.id);
  // Profilo del gusto (primo accesso, sprint 25/10): "famosi o chicche?" e cosa si evita. Letto in
  // parallelo con il resto; senza le colonne (migrazioni non applicate) non cambia niente.
  const profiloPromise = authUser
    ? Promise.resolve(supabase.from("profiles").select("gusto, gusti_ricordati").eq("id", authUser.id).maybeSingle()).then(
        ({ data, error }) => {
          if (error || !data) return null;
          const m = pulisciMappa((data as { gusto?: unknown }).gusto, () => true);
          return { chicche: (m.scoperta ?? scopertaDedotta(m.su)) === "chicche", diete: gustiValidi((data as { gusti_ricordati?: unknown }).gusti_ricordati) };
        },
        () => null,
      )
    : Promise.resolve(null);
  // Gusti del profilo usati in questa ricerca: il telefono lo dice ("Per te: chicche, niente pesce").
  const perTe: string[] = [];

  // Tetto alle chiamate AI (src/lib/ai-limit.ts): le ricerche scritte usano Haiku.
  if (source === "world" && searchIntent === "natural" && !allowAi("ricerca", aiKey)) {
    return NextResponse.json({ error: AI_LIMIT_MESSAGE }, { status: 429 });
  }

  let filtri: SearchFilters = {
    categoria: null,
    parole_chiave: [],
    vicino_a_me: false,
  };

  // Il ramo saved aggiunge tags/note personali (assenti nel ramo world): campi opzionali.
  let risultati: (PlaceResult & { tags?: string[] | null; note?: string | null })[];
  // Chiamate Text Search fatte da questa ricerca (1, o 2 con la seconda ricerca): nel segnale "ricerca",
  // così il pannello dei numeri sa quanta quota Google si è usata oggi.
  let googleCalls = 0;
  // Sintesi editoriale Haiku: solo sul ramo world, opzionale e degradabile.
  let sintesi: Record<string, PlaceSynthesis> = {};
  let synthInput: SynthesisInput[] | null = null;
  let synthToken: string | null = null;
  const synthGroups: { places: SynthesisInput[]; token: string }[] = [];
  let esclusi: string[] = [];
  // Messi da parte dai riordini (VISIONE.md: il differenziatore deve vedersi): si dice all'utente.
  // gusti: in fondo per le diete del profilo (niente pesce, niente carne): il telefono li tiene in fondo
  // anche quando arriva l'ordine dell'AI (prima una pescheria "alto" tornava in cima).
  const daParte: { turistici: string[]; fuori_tema: string[]; fuori_zona: string[]; gusti?: string[] } = { turistici: [], fuori_tema: [], fuori_zona: [] };

  if (source === "world") {
    // Capire la richiesta prima di Google (solo ricerche in linguaggio naturale).
    // Se Haiku non risponde si usa la frase originale come prima.
    // Se il telefono ha già fatto capire la frase mentre si scriveva, si risparmiano 1-2 s di Haiku.
    const preIntent = searchIntent === "natural" && body?.intentQuery === query.trim() ? sanitizeIntent(body?.intent) : null;
    if (preIntent) console.log(`[search-intent] già capito mentre si scriveva: "${query.trim().slice(0, 60)}"`);
    const intent = searchIntent === "natural" ? preIntent ?? await extractSearchIntent(query.trim()) : null;
    if (intent) {
      filtri = {
        categoria: intent.tipo,
        parole_chiave: intent.requisiti,
        vicino_a_me: intent.vicino_a_me,
        zona: intent.zona,
      };
      console.log(`[search-intent] ${JSON.stringify({ q: query.trim().slice(0, 80), ...intent })}`);
    }
    // Zona nominata → è già nel testo della query: nessun bias sulla posizione della mappa.
    // "Vicino a me" → solo risultati nell'area intorno al centro mappa. Altrimenti bias.
    // Senza Haiku la città scritta nella frase ("a Milano") si riconosce comunque: niente bias sulla
    // mappa, che altrimenti con la mappa su Roma mescolava locali di Roma a quelli di Milano.
    // Quartiere senza città ("trattoria a Monti", "aperitivo in centro"): la mappa resta una
    // preferenza larga (25 km), altrimenti Google poteva rispondere con un "Monti" di un'altra
    // città. Il testo resta più forte: un quartiere di un'altra città si trova comunque.
    // Una città fuori dalle città note ("trattoria a Parma") è una città, non un quartiere della
    // città della mappa: niente "quartiere" né città della mappa aggiunti, niente preferenza (13a).
    const city = searchIntent === "natural" ? namedCity(query) : null;
    const otherCity = searchIntent === "natural" && !city ? namedOtherCity(query) : null;
    const zonaQuartiere = searchIntent === "natural" && ambiguousDistrict(query, intent?.zona);
    // Google da solo legge "trattoria Monti" come un nome (1 risultato, visto il 15/10): si aggiunge
    // la città in cui è la mappa, se è una delle città note e la frase non ne nomina un'altra.
    const mapCity = zonaQuartiere && typeof lat === "number" && typeof lng === "number" ? cityNear(lat, lng) : null;
    // Un quartiere noto dice già la città ("a Moscova" è Milano anche con la mappa su Roma): conta più
    // della mappa, e la preferenza di 25 km si sposta sul centro di quella città.
    const zonaCity = zonaQuartiere ? districtCity(intent?.zona, query) : null;
    const contextCity = zonaCity ?? mapCity;
    const zonaCentro = zonaCity && zonaCity !== cityNear(lat ?? 0, lng ?? 0) ? cityArea(zonaCity) : null;
    // Quartiere con un centro noto (src/lib/gusti.ts): preferenza stretta intorno al quartiere
    // (2 km invece di 25) e, dopo Google, i locali lontani in fondo.
    // Anche con la città nella frase ("bar a Brera Milano"): il quartiere conta più della città.
    const zonaPunto = searchIntent === "natural" && intent?.zona && !intent.vicino_a_me && !wholeCity(intent.zona)
      ? districtCenter(intent.zona, query)
      : null;
    if (zonaCity && zonaCity !== mapCity) console.log(`[search-quartiere] ${intent?.zona}: quartiere di ${zonaCity} (mappa su ${mapCity ?? "altro"})`);
    // E "quartiere Monti" invece di "Monti": 20 trattorie del rione invece della sola "Trattoria Monti".
    let queryGoogle = intent ? withDefaultType(intent.queryGoogle, intent.zona, intent.tipo) : query.trim();
    if (intent && zonaQuartiere) {
      queryGoogle = withDistrict(queryGoogle, intent.zona!);
      if (contextCity && !namedCity(queryGoogle)) queryGoogle = `${queryGoogle} ${contextCity}`;
    }
    let locationMode: "bias" | "restrict" | "none" = zonaQuartiere ? "bias" : intent?.zona || (!intent && (city || otherCity)) ? "none" : intent?.vicino_a_me ? "restrict" : "bias";
    let area: { lat: number; lng: number; radius: number } | null = null;
    // Filtri con "Dove?" (zona, quartiere o via scritti a mano): come un quartiere nella frase.
    const zonaFiltro = searchIntent === "structured" && typeof body?.zona === "string" ? body.zona.trim().slice(0, 80) : "";
    if (zonaFiltro && isOtherCity(zonaFiltro)) {
      // "Parma" scritto in "Dove?": la città basta, la mappa (su Roma) non deve contare.
      queryGoogle = `${queryGoogle} ${zonaFiltro}`;
      locationMode = "none";
    } else if (zonaFiltro && !wholeCity(zonaFiltro)) {
      const fCity = typeof lat === "number" && typeof lng === "number" ? cityNear(lat, lng) : null;
      queryGoogle = `${queryGoogle} ${isStreet(zonaFiltro) ? zonaFiltro : withDistrict(zonaFiltro, zonaFiltro)}`;
      if (fCity && !namedCity(zonaFiltro)) queryGoogle = `${queryGoogle} ${fCity}`;
      locationMode = "bias";
    }
    // Una città intera ("buon ristorante a Roma", o "Roma" nei filtri): si cerca in tutta l'area
    // della città, non solo intorno al centro (VISIONE: il posto giusto può essere defilato).
    const cityWide = !intent?.vicino_a_me
      ? (intent?.zona ? wholeCity(intent.zona) : !intent && searchIntent === "natural" ? city : zonaFiltro ? wholeCity(zonaFiltro) : null)
      : null;
    if (cityWide) area = cityArea(cityWide);
    if (cityWide && area) {
      queryGoogle = stripCity(queryGoogle, cityWide);
      locationMode = "restrict";
      console.log(`[search-citta] ${cityWide}: tutta l'area della città, query=${JSON.stringify(queryGoogle)}`);
    }
    // Nessun luogo nella frase (né zona, né città, né "vicino a me", né "Dove?" nei filtri): si cerca solo
    // intorno alla mappa, entro 30 km. Con la sola preferenza Google rispondeva con il locale che si chiama
    // come la frase anche a 800 km ("Wine Bar Tranquillo" a Bari con la mappa su Milano: Lorenzo, 16–18/10).
    const senzaLuogo = searchIntent === "natural" && !intent?.zona && !intent?.vicino_a_me && !city && !otherCity && !zonaQuartiere && !zonaFiltro && !area && typeof lat === "number" && typeof lng === "number";
    if (senzaLuogo) locationMode = "restrict";
    // Quota giornaliera di Google finita su una delle seconde ricerche (la prima era andata).
    let quotaFinita = false;
    try {
      const opzioni: Parameters<typeof searchGooglePlaces>[1] = {
        includedType: intent?.includedType ?? undefined,
        locationMode,
        lat: area?.lat ?? zonaPunto?.lat ?? zonaCentro?.lat ?? lat,
        lng: area?.lng ?? zonaPunto?.lng ?? zonaCentro?.lng ?? lng,
        minRating: typeof body?.minRating === "number" ? body.minRating : undefined,
        minReviews: typeof body?.minReviews === "number" ? body.minReviews : undefined,
        minPriceLevel: typeof body?.minPriceLevel === "number" ? body.minPriceLevel : undefined,
        maxPriceLevel: typeof body?.maxPriceLevel === "number" ? body.maxPriceLevel : undefined,
        openNowOnly: body?.openNowOnly === true ? true : undefined,
        // Con una zona scritta la distanza dal centro della mappa non vale (sarebbe da un altro posto).
        radius: area ? area.radius : typeof body?.radius === "number" && !zonaFiltro ? body.radius : zonaPunto ? 2000 : zonaQuartiere || zonaFiltro ? 25000 : intent?.vicino_a_me ? 3000 : senzaLuogo ? 30000 : undefined,
        categories: Array.isArray(body?.categories) ? body.categories : undefined,
        requiredAttributes: attrs.length > 0 ? attrs : undefined,
        openAt,
        maxDistanceMeters: typeof body?.radius === "number" && !zonaFiltro && !area ? body.radius : undefined,
        // Città intera: l'ordine di Google tra quartieri lontani non dice niente; si ordina per voto
        // (le recensioni contano fino a 150: oltre, i locali turistici non guadagnano posizioni).
        sortMode: searchIntent === "natural" && !area ? "relevance" : "quality",
      };
      risultati = await searchGooglePlaces(queryGoogle, opzioni);
      googleCalls++;
      // Quartiere noto con pochi risultati: Google legge il nome del quartiere come parte dell'insegna
      // ("bar cozy quartiere Moscova Milano" → 4 bar, 3 con "Moscova" nel nome: Lorenzo, 17/10). Allora
      // una seconda ricerca senza il nome, dentro un riquadro di ~1,2 km intorno al centro del quartiere,
      // e i nuovi locali dopo quelli già trovati. Solo in questo caso: 1 chiamata Google in più.
      if (zonaPunto && intent && risultati.length < 6) {
        const q2 = stripDistrict(intent.queryGoogle, zonaPunto.nome, zonaPunto.citta);
        try {
          const altri = await searchGooglePlaces(q2, {
            includedType: intent.includedType ?? undefined,
            locationMode: "restrict",
            lat: zonaPunto.lat,
            lng: zonaPunto.lng,
            radius: 1200,
            sortMode: "relevance",
          });
          googleCalls++;
          const visti = new Set(risultati.map((p) => p.id));
          const nuovi = altri.filter((p) => !visti.has(p.id));
          console.log(`[search-quartiere] ${zonaPunto.nome}: solo ${risultati.length} con il nome, +${nuovi.length} nel riquadro di 1,2 km (query=${JSON.stringify(q2)})`);
          risultati = [...risultati, ...nuovi];
        } catch (err) {
          console.error("[search-quartiere] seconda ricerca non riuscita:", err);
          if (isQuota(err)) quotaFinita = true;
        }
      }
      // Pochi risultati con un aggettivo d'atmosfera nella frase per Google ("wine bar tranquillo" →
      // il solo "Wine Bar Tranquillo", a Bari: Lorenzo 16/10 sera). Seconda ricerca senza quelle parole,
      // con la stessa zona; l'atmosfera la valuta poi Haiku sulle recensioni. 1 chiamata in più, solo qui.
      if (!zonaPunto && intent && risultati.length < 6) {
        const q2 = stripMood(queryGoogle, intent.requisiti);
        if (q2) {
          try {
            const altri = await searchGooglePlaces(q2, opzioni);
            googleCalls++;
            const visti = new Set(risultati.map((p) => p.id));
            const nuovi = altri.filter((p) => !visti.has(p.id));
            console.log(`[search-atmosfera] solo ${risultati.length} con ${JSON.stringify(queryGoogle)}, +${nuovi.length} con ${JSON.stringify(q2)}`);
            risultati = [...risultati, ...nuovi];
          } catch (err) {
            console.error("[search-atmosfera] seconda ricerca non riuscita:", err);
            if (isQuota(err)) quotaFinita = true;
          }
        }
      }
    } catch (err) {
      // Un errore di Google (quota giornaliera finita, rete, lentezza) non è "nessun risultato":
      // il telefono mostrerebbe "Non ho trovato nulla, prova con meno requisiti", che è falso.
      console.error("[search/route] Google Places error:", err);
      if (isQuota(err)) return quotaResponse();
      return NextResponse.json({ error: "La ricerca non è disponibile in questo momento: riprova tra poco." }, { status: 503 });
    }
    // "Colazione", "cocktail bar", "ristorante": i locali di tutt'altro tipo
    // (un pub per la colazione) vanno in fondo, mai esclusi.
    if (searchIntent === "natural") {
      const { places, demoted, rule } = demoteOffType(query.trim(), risultati);
      if (demoted.length > 0) {
        risultati = places;
        // Al telefono solo i nomi: "Nome (irish_pub)" è il formato del log, in inglese.
        daParte.fuori_tema = [...daParte.fuori_tema, ...places.slice(places.length - demoted.length).map((p) => p.name)].slice(0, 10);
        console.log(`[search-tipo] q=${JSON.stringify(query.trim().slice(0, 80))} regola=${rule} in fondo (tipo fuori tema): ${JSON.stringify(demoted)}`);
      }
    }
    if (zonaPunto) {
      const { places, demoted } = demoteFarFrom(zonaPunto, risultati);
      if (demoted.length > 0) {
        risultati = places;
        daParte.fuori_zona = demoted.slice(0, 10);
        console.log(`[search-zona] ${zonaPunto.nome}: in fondo (oltre 2 km): ${JSON.stringify(demoted)}`);
      }
    }
    // Nessuna zona né città nella frase: si cerca dove è la mappa. Un locale a centinaia di km (trovato
    // perché il nome somiglia alla frase) va in fondo, detto all'utente come "fuori zona".
    if (searchIntent === "natural" && intent && !intent.zona && !intent.vicino_a_me && !city && !otherCity && !area && !zonaFiltro && typeof lat === "number" && typeof lng === "number") {
      const { places, demoted } = demoteFarFrom({ lat, lng }, risultati, 30000);
      if (demoted.length > 0) {
        risultati = places;
        daParte.fuori_zona = [...daParte.fuori_zona, ...demoted].slice(0, 10);
        console.log(`[search-zona] senza zona: in fondo (oltre 30 km dalla mappa): ${JSON.stringify(demoted)}`);
      }
      // Quota Google finita proprio sulla seconda ricerca: restano solo locali lontani (il "Wine Bar
      // Tranquillo" di Bari con la mappa su Milano, Lorenzo 17/10 alle 22:34). Meglio dirlo che mostrarli.
      const vicini = risultati.filter((p) => p.lat == null || p.lng == null || distanceMeters({ lat, lng }, { lat: p.lat, lng: p.lng }) <= 30000);
      if (quotaFinita && vicini.length === 0) return quotaResponse();
    }
    // "Non turistico", "autentico"…: i locali di massa vanno in fondo (mai esclusi).
    if (searchIntent === "natural") {
      const { places, demoted } = demoteMainstream(query.trim(), risultati);
      if (demoted.length > 0) {
        risultati = places;
        daParte.turistici = demoted.slice(0, 10);
        console.log(`[search-mainstream] q=${JSON.stringify(query.trim().slice(0, 80))} in fondo (troppe recensioni per una richiesta "non turistica"): ${JSON.stringify(demoted)}`);
      }
    }
    // Senza "non turistico" nella frase: in fondo solo le trappole per turisti (tantissime recensioni,
    // voto sotto 4,2). Mai esclusi; un locale cercato per nome resta dov'è.
    if (searchIntent === "natural") {
      const { places, demoted } = demoteTouristTraps(query.trim(), risultati);
      if (demoted.length > 0) {
        risultati = places;
        daParte.turistici = [...daParte.turistici, ...demoted].slice(0, 10);
        console.log(`[search-mainstream] q=${JSON.stringify(query.trim().slice(0, 80))} in fondo (molte recensioni, voto sotto 4,2): ${JSON.stringify(demoted)}`);
      }
    }
    // Profilo del gusto: chi preferisce le chicche ha i locali di massa in fondo anche senza scriverlo
    // (mai esclusi, detti come "messi da parte"); chi evita pesce o carne ha in fondo quei locali.
    if (searchIntent === "natural") {
      const profilo = await profiloPromise;
      if (profilo?.chicche) {
        const { places, demoted } = demoteForChicche(query.trim(), risultati);
        if (demoted.length > 0) {
          risultati = places;
          daParte.turistici = [...new Set([...daParte.turistici, ...demoted])].slice(0, 10);
          perTe.push("chicche");
          console.log(`[search-gusto] q=${JSON.stringify(query.trim().slice(0, 80))} in fondo (profilo: preferisce le chicche): ${JSON.stringify(demoted)}`);
        }
      }
      if (profilo?.diete.length) {
        // Gusti spenti per questa conversazione dall'assistente ("stasera il pesce va bene"): non valgono.
        const { usati } = gustiPerRicerca(query, profilo.diete, strings(body?.skipGusti));
        const r = inFondoPerGusti(risultati, usati);
        if (r.spostati > 0) {
          risultati = r.places;
          daParte.gusti = r.places.slice(r.places.length - r.spostati).map((p) => p.name);
          perTe.push(...usati.filter((g) => g.inFondo).map((g) => g.label));
          console.log(`[search-gusto] q=${JSON.stringify(query.trim().slice(0, 80))} in fondo ${r.spostati} locali ${r.motivo} (profilo)`);
        }
      }
    }
    // Il più famoso non apre la lista solo perché è il più famoso: scende dopo i primi 3, resta in vista.
    if (searchIntent === "natural") {
      const { places, lowered } = lowerMassFromTop(query.trim(), risultati);
      if (lowered.length > 0) {
        risultati = places;
        console.log(`[search-mainstream] q=${JSON.stringify(query.trim().slice(0, 80))} dopo i primi 3 (molte più recensioni degli altri): ${JSON.stringify(lowered)}`);
      }
    }
    // Città nominata ("a Milano"): i locali di un'altra città vanno in fondo (mai esclusi), per ultimi.
    if (city) {
      const { places, demoted } = demoteOtherCity(city, risultati);
      if (demoted.length > 0) {
        risultati = places;
        daParte.fuori_tema = [...daParte.fuori_tema, ...demoted].slice(0, 10);
        console.log(`[search-zona] q=${JSON.stringify(query.trim().slice(0, 80))} citta=${city} in fondo (fuori città): ${JSON.stringify(demoted)}`);
      }
    }

    // Il verdetto Mapetite deve esserci su OGNI risultato (VISIONE.md): Haiku lo scrive per i
    // primi SYNTHESIS_LIMIT, quindi si mostrano solo quelli. Meglio 12 posti con il verdetto che
    // 20 di cui 8 muti. Nessun costo in più; quelli tagliati sono gli ultimi (spesso già spostati in fondo).
    if (risultati.length > SYNTHESIS_LIMIT) {
      console.log(`[search-limite] mostrati ${SYNTHESIS_LIMIT} su ${risultati.length} (solo quelli con il verdetto)`);
      risultati = risultati.slice(0, SYNTHESIS_LIMIT);
    }

    // "✓ terrazza" candidati: la frase di una recensione da 4-5 stelle che nomina il requisito
    // (regole in src/lib/prova-requisito.ts). Non si mostrano da soli: l'AI dei verdetti conferma
    // quali dicono davvero di sì (terza bocciatura del 22/10: le sole regole non reggono l'ironia).
    const prove: Record<string, Candidato[]> = {};
    if (REQUISITI_ACCESI) {
      for (const p of risultati) {
        const c = requisitiProvati(filtri.parole_chiave, query, p.reviewItems, p.name, filtri.zona ?? null);
        if (c.length > 0) prove[p.id] = c;
      }
    }

    if (risultati.length > 0 && fastPhase) {
      // Primo tempo: niente Haiku. Il client chiede i verdetti con i dati firmati.
      try {
        synthInput = buildSynthesisInput(risultati, prove);
        synthToken = signSynthesisInput(query.trim(), synthInput);
        // Verdetti a gruppi chiesti in parallelo: prima le 2 card che si vedono (pronte in ~3-4 s),
        // poi le altre. Stesse chiamate Haiku di prima, solo divise diversamente.
        let from = 0;
        for (const size of VERDICT_GROUPS) {
          const part = synthInput.slice(from, from + size);
          from += size;
          if (part.length > 0) synthGroups.push({ places: part, token: signSynthesisInput(query.trim(), part) });
        }
      } catch (err) {
        console.error("[search/route] firma sintesi non disponibile:", err);
        synthInput = null;
      }
    } else if (risultati.length > 0) {
      try {
        // Utente opzionale: la ricerca world è pubblica. Se autenticato, i suoi
        // gusti personalizzano matchReason; altrimenti degrada su richiesta+locale.
        // Ricerca con i filtri (verdetti subito, senza primo tempo): conta nel tetto AI come
        // /api/search/synthesis. Oltre il tetto restano i dati Google, senza errori.
        if (!allowAi("verdetti", aiKey)) throw new Error("tetto AI raggiunto: verdetti saltati");
        sintesi = await getSynthesis(risultati, query.trim(), authUser?.id ?? null, { prove });
        // Esclusione dei locali che chiaramente non rispettano la richiesta
        // (approvata da Lorenzo il 10/10). Se Haiku li scarta tutti, non si esclude nulla.
        esclusi = risultati.filter((p) => sintesi[p.id]?.fit === false).map((p) => p.id);
        if (esclusi.length === risultati.length) esclusi = [];
      } catch (err) {
        console.error("[search/route] Haiku synthesis error:", err);
        sintesi = {};
      }
    }
  } else {
    // Ricerca tra i salvati: solo con l'accesso (prima Haiku partiva anche senza) e dentro il tetto AI.
    if (!authUser) {
      return NextResponse.json({ error: "Autenticazione richiesta." }, { status: 401 });
    }
    if (!allowAi("ricerca", aiKey)) {
      return NextResponse.json({ error: AI_LIMIT_MESSAGE }, { status: 429 });
    }
    try {
      const message = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 512,
        system: `Sei un assistente che traduce frasi di ricerca di locali in filtri strutturati.
Rispondi SOLO con un oggetto JSON valido, senza testo aggiuntivo, senza backtick, senza markdown.
La struttura deve essere esattamente:
{"categoria":string|null,"parole_chiave":string[],"vicino_a_me":boolean}

REGOLE PER OGNI CAMPO:

"categoria": il tipo di locale. Se la frase non nomina un tipo esplicito, deducilo dal contesto
(es. "cena" o "cenare" → "ristorante", "aperitivo" → "bar", "colazione" → "bar" o "caffè").
Usa null SOLO se non c'è davvero alcun indizio sul tipo di locale.

"parole_chiave": estrai SEMPRE tutti gli aggettivi e le qualità descrittive presenti nella frase
(romantico, autentico, economico, elegante, tranquillo, vista mare, economico, tipico, moderno…).
Includile anche se ovvie o implicite. Scrivile in forma base singolare (maschile o femminile a seconda
del contesto). Non lasciare questo campo vuoto se ci sono qualità nella frase.

"vicino_a_me": metti true ogni volta che compaiono espressioni di prossimità come
"vicino casa", "qui vicino", "vicino a me", "nei paraggi", "in zona", "nelle vicinanze",
"in zona mia", "a due passi". False in tutti gli altri casi.

ESEMPI (input → output atteso):

"un posto romantico per cena vicino casa"
→ {"categoria":"ristorante","parole_chiave":["romantico"],"vicino_a_me":true}

"una pizzeria autentica e non troppo cara"
→ {"categoria":"pizzeria","parole_chiave":["autentica","economica"],"vicino_a_me":false}

"sushi all you can eat in zona"
→ {"categoria":"sushi","parole_chiave":["all you can eat"],"vicino_a_me":true}`,
        messages: [{ role: "user", content: query }],
      });

      const { input_tokens, output_tokens } = message.usage;
      const cost =
        (input_tokens / 1_000_000) * HAIKU_INPUT_PER_MTOK +
        (output_tokens / 1_000_000) * HAIKU_OUTPUT_PER_MTOK;
      console.log(
        `[haiku-cost] source=${source} in=${input_tokens}tok out=${output_tokens}tok cost=$${cost.toFixed(6)} query="${query.trim().slice(0, 60)}"`
      );

      const rawText =
        message.content[0].type === "text" ? message.content[0].text.trim() : "";

      // Strip markdown code fences (```json ... ``` or ``` ... ```)
      let text = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
      // Extract just the JSON object in case there's stray text before/after
      const start = text.indexOf("{");
      const end = text.lastIndexOf("}");
      if (start !== -1 && end !== -1 && end > start) {
        text = text.slice(start, end + 1);
      }

      try {
        const parsed = JSON.parse(text);
        filtri = {
          categoria: typeof parsed.categoria === "string" ? parsed.categoria : null,
          parole_chiave: Array.isArray(parsed.parole_chiave)
            ? parsed.parole_chiave.filter((k: unknown) => typeof k === "string")
            : [],
          vicino_a_me:
            typeof parsed.vicino_a_me === "boolean" ? parsed.vicino_a_me : false,
        };
      } catch {
        // keep default empty filters on JSON parse error
      }
    } catch {
      // proceed with empty filters rather than returning an error
    }

    // Client server AUTENTICATO: la ricerca "tra i miei salvati" deve rispettare la RLS
    // e leggere saved_places dell'utente, non il catalogo globale places.
    const user = authUser;

    const categoria = filtri.categoria ? sanitize(filtri.categoria) : null;
    const keywords = filtri.parole_chiave
      .map(sanitize)
      .filter((kw) => kw.length > 0);

    type SavedRow = {
      tags: string[] | null;
      note: string | null;
      place: {
        id: string;
        name: string;
        category: string | null;
        address: string | null;
        lat: number | null;
        lng: number | null;
      };
    };

    const fetchPlaces = async (withKeywords: boolean) => {
      // Pattern identico a map-view.tsx: saved_places join places, filtrato per utente.
      const { data, error } = await supabase
        .from("saved_places")
        .select("tags, note, places(id, name, category, address, lat, lng)")
        .eq("user_id", user.id);

      if (error) {
        console.error("[search/route] Supabase error:", error);
        return [];
      }

      let rows: SavedRow[] = (data ?? [])
        .map((row) => {
          const place = row.places as unknown as SavedRow["place"] | null;
          if (!place || place.lat == null || place.lng == null) return null;
          return { tags: row.tags as string[] | null, note: row.note as string | null, place };
        })
        .filter((r): r is SavedRow => r !== null);

      // Filtri applicati in memoria (poche decine di righe per utente):
      // si evita l'embedded filtering PostgREST sui campi joinati.
      if (categoria) {
        const c = categoria.toLowerCase();
        rows = rows.filter((r) => (r.place.category ?? "").toLowerCase().includes(c));
      }
      if (withKeywords && keywords.length > 0) {
        rows = rows.filter((r) =>
          keywords.some((kw) => {
            const k = kw.toLowerCase();
            return (
              (r.place.name ?? "").toLowerCase().includes(k) ||
              (r.place.category ?? "").toLowerCase().includes(k)
            );
          })
        );
      }

      rows.sort((a, b) => (a.place.name ?? "").localeCompare(b.place.name ?? ""));

      return rows.map((r) => ({
        id: r.place.id,
        name: r.place.name,
        address: r.place.address ?? "",
        lat: r.place.lat,
        lng: r.place.lng,
        category: r.place.category,
        rating: null,
        userRatingCount: null,
        priceLevel: null,
        openNow: null,
        types: null,
        websiteUri: null,
        editorialSummary: null,
        reviewTexts: null,
        phone: null,
        photoRef: null,
        // tag e nota personali dell'utente, presi da saved_places
        tags: r.tags,
        note: r.note,
      }));
    };

    if (keywords.length > 0) {
      risultati = await fetchPlaces(true);
      // fallback: if no results with keywords, try category-only
      if (risultati.length === 0) {
        risultati = await fetchPlaces(false);
      }
    } else {
      risultati = await fetchPlaces(false);
    }
  }

  // Un locale = un solo oggetto completo: fonde la sintesi nei risultati,
  // sostituisce reviewTexts (server-only) con le recensioni selezionate per la scheda.
  // Nel ramo saved `sintesi` è {}, quindi i campi editoriali risultano null.
  const risultatiFinali = risultati.filter((p) => !esclusi.includes(p.id)).map((p) => {
    const s = sintesi[p.id];
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { reviewTexts, reviewItems, attributes, openingPeriods, regularPeriods, ...rest } = p;
    return {
      ...rest,
      // Orari compatti per il foglio Prenota ("a quell'ora risulta chiuso"): dati Google solo da mostrare.
      orari: compattaOrari(regularPeriods),
      selectedReviews: selectQualityReviews(reviewItems ?? reviewTexts),
      synthesis: s?.synthesis || null,
      tags: s?.tags?.length ? s.tags : rest.tags ?? null,
      verdict: s?.verdict || null,
      goFor: s?.goFor ?? null,
      dontExpect: s?.dontExpect ?? null,
      matchReason: s?.matchReason || null,
      perTe: s?.perTe || null,
      // "✓ terrazza": solo quelli confermati dall'AI (ricerca con i filtri, verdetti subito); nel
      // primo tempo arrivano con i verdetti, da /api/search/synthesis.
      requisiti: s?.requisiti?.length ? s.requisiti : null,
      // Dati Google firmati per il catalogo condiviso: /api/places/add accetta solo questi
      // (src/lib/catalog-sig.ts). Nel ramo saved i locali sono già nel catalogo: niente firma.
      ...(source === "world" ? { firma: signCatalogEntry(p) } : {}),
    };
  });

  // [search-funnel] diagnostica branch + Haiku. haiku = sintesi invocata (solo ramo
  // world con risultati); verdicts/matchReasons = quanti campi non vuoti ha prodotto.
  const synthVals = Object.values(sintesi);
  const haikuInvoked = source === "world" && risultati.length > 0;
  const verdictsCount = synthVals.filter(
    (s) => typeof s.verdict === "string" && s.verdict.trim() !== "",
  ).length;
  const matchReasonsCount = synthVals.filter(
    (s) => typeof s.matchReason === "string" && s.matchReason.trim() !== "",
  ).length;
  console.log(
    `[search-funnel] sent=${JSON.stringify(query.trim())} branch=${source} ` +
      `haiku=${haikuInvoked} verdicts=${verdictsCount} matchReasons=${matchReasonsCount}`,
  );

  // Segnale "ricerca" (VISIONE.md: dati sui comportamenti di scoperta, utili anche ai ristoratori).
  // Mai la frase scritta: solo cosa ha capito l'AI o i filtri scelti. Dopo la risposta, senza attese.
  if (source === "world" && !isAutomated(request)) {
    // Visitatore e sessione dai cookie del telefono (src/lib/track.ts): la ricerca entra negli imbuti.
    const jar = await cookies();
    const anonId = jar.get(ANON_COOKIE)?.value ?? null;
    const sessionId = jar.get(SESSION_COOKIE)?.value ?? null;
    after(async () => {
      await recordEvent({
        type: "ricerca",
        userId: authUser?.id ?? null,
        anonId,
        sessionId,
        lat,
        lng,
        props: {
          modo: searchIntent === "natural" ? "ai" : "filtri",
          tipo: filtri.categoria,
          requisiti: filtri.parole_chiave.slice(0, 6),
          zona: filtri.zona ?? null,
          vicino_a_me: filtri.vicino_a_me,
          categorie: Array.isArray(body?.categories) ? body.categories.slice(0, 6) : null,
          voto_min: typeof body?.minRating === "number" ? body.minRating : null,
          prezzo_max: typeof body?.maxPriceLevel === "number" ? body.maxPriceLevel : null,
          cucine: strings(body?.cuisines).slice(0, 6),
          occasione,
          caratteristiche: caratteristiche.slice(0, 12),
          aperto_a: typeof body?.openAtId === "string" ? body.openAtId.slice(0, 20) : null,
          risultati: risultati.length,
          google: googleCalls,
        },
      });
    });
  }

  return NextResponse.json({
    risultati: risultatiFinali,
    filtri_usati: filtri,
    // "Per te": quali gusti del profilo hanno cambiato l'ordine (il telefono lo dice accanto a "messi da parte").
    ...(daParte.turistici.length > 0 || daParte.fuori_tema.length > 0 || daParte.fuori_zona.length > 0 || perTe.length > 0
      ? { da_parte: { ...daParte, ...(perTe.length > 0 ? { per_te: [...new Set(perTe)] } : {}) } }
      : {}),
    // Solo nel primo tempo: dati firmati per chiedere i verdetti.
    ...(synthInput && synthToken ? { sintesi_pendente: { places: synthInput, token: synthToken, gruppi: synthGroups } } : {}),
  });
}
