import { createClient, getUser } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import Link from "next/link";
import PlaceCard from "@/components/place-card";
import { cityFromAddress, displayAddress } from "@/lib/city";
import { getCategoryEmoji } from "@/lib/emoji";
import { BookOpen, ChevronDown, ChevronRight, Download, FolderHeart, Gem, Globe, History, Send, Settings, Sparkles, Store, Trophy, Users } from "lucide-react";
import ProfiloSezione from "@/components/profilo-sezione";
import { TILE_CLASS, TileBody } from "@/components/profilo-tessera";
import ProfiloRicerche from "@/components/profilo-ricerche";
import BookingReminder from "@/components/booking-reminder";
import ProfiloPrenotazioni from "@/components/profilo-prenotazioni";
import ProfiloRaccolte, { type RaccoltaRow } from "@/components/profilo-raccolte";
import VisitPrompt, { type VisitCandidate } from "@/components/visit-prompt";
import ProfiloSocial from "@/components/profilo-social";
import InvitaAmico from "@/components/invita-amico";
import { loadMySocial } from "@/lib/social";
import ProfiloClassifica, { type ClassificaRow } from "@/components/profilo-classifica";
import { isMissingColumn } from "@/lib/classifica";
import { isMissingVisitedAt } from "@/lib/diario";
import ProfiloAccount from "@/components/profilo-account";
import ProfiloGusti from "@/components/profilo-gusti";

type SavedPlaceRow = {
  created_at: string;
  rank_score?: number | null; // solo nei dati finti del giro (la colonna si legge a parte)
  tags: string[] | null;
  note: string | null;
  places: {
    id: string;
    name: string;
    category: string | null;
    address: string | null;
  } | null;
};

type ReviewRow = {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  places: {
    name: string;
  } | null;
};

// I due tag di stato (dati esistenti): non sono "raccolte", hanno i loro contatori.
const STATE_WANT = "Da provare";
const STATE_DONE = "Già visitato";

// Link alla mappa aperta sui salvati, eventualmente filtrati (parametri letti da map-view).
function savedHref(filter?: { stato?: "voglio" | "fatto"; tag?: string }): string {
  const params = new URLSearchParams({ vista: "salvati" });
  if (filter?.stato) params.set("stato", filter.stato);
  if (filter?.tag) params.set("tag", filter.tag);
  return `/mappa?${params.toString()}`;
}

// Solo in sviluppo con E2E_FAKE_USER: profilo finto letto dal cookie "e2e_profilo"
// (scritto da scripts/e2e/giro.mjs), perché il test non può simulare le letture fatte dal server.
// In produzione NODE_ENV è sempre "production" e questo ramo non si attiva.
async function e2eProfile(): Promise<{ email: string; saved: SavedPlaceRow[]; reviews: ReviewRow[]; classifica: boolean; diario: boolean } | null> {
  if (process.env.NODE_ENV !== "development" || !process.env.E2E_FAKE_USER) return null;
  const raw = (await cookies()).get("e2e_profilo")?.value;
  if (!raw) return null;
  try {
    const data = JSON.parse(decodeURIComponent(raw));
    return { email: data.email ?? "tester@example.com", saved: data.saved ?? [], reviews: data.reviews ?? [], classifica: data.classifica !== false, diario: data.diario !== false };
  } catch {
    return null;
  }
}

function Stars({ rating }: { rating: number }) {
  const filled = Math.round(Math.max(0, Math.min(5, rating)));
  return (
    <span aria-label={`${filled} stelle su 5`}>
      <span className="text-star">{"★".repeat(filled)}</span>
      <span className="text-border">{"★".repeat(5 - filled)}</span>
    </span>
  );
}

export default async function ProfiloPage() {
  const supabase = await createClient();
  const fake = await e2eProfile();
  const { data: userData } = fake ? { data: null } : await getUser();
  const user = fake ? { id: process.env.E2E_FAKE_USER!, email: fake.email } : userData?.user ?? null;

  if (!user) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="font-display text-xl font-semibold text-brand">Il tuo profilo ti aspetta</p>
        <p className="max-w-xs text-sm text-text-muted">
          Accedi per ritrovare i tuoi locali salvati, le recensioni e i tuoi gusti.
        </p>
        <div className="flex gap-2">
          <a href="/login?next=%2Fprofilo" className="inline-flex min-h-11 items-center rounded-pill bg-brand px-5 text-sm font-display font-semibold text-white">
            Accedi
          </a>
          <a href="/signup?next=%2Fprofilo" className="inline-flex min-h-11 items-center rounded-pill border border-border px-5 text-sm font-display font-semibold text-brand">
            Crea un account
          </a>
        </div>
        <div className="w-full max-w-xs">
          <ProfiloAccount loggedIn={false} />
        </div>
      </div>
    );
  }

  // Profilo pubblico (social): "in arrivo" finché la migrazione 20261015_social non è applicata.
  const socialPromise = loadMySocial(user.id);
  const [{ data: savedRaw }, { data: reviewsRaw }] = fake
    ? [{ data: fake.saved }, { data: fake.reviews }]
    : await Promise.all([
    supabase
      .from("saved_places")
      .select("created_at, tags, note, places (id, name, category, address)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("reviews")
      .select("id, rating, comment, created_at, places (name)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  const saved = (savedRaw ?? []) as unknown as SavedPlaceRow[];
  // Classifica personale (piano 4.3): letta a parte, così senza la colonna rank_score (migrazione
  // 20261015_classifica non applicata) il resto del profilo non cambia e la sezione resta nascosta.
  let ranks: Map<string, number> | null = null;
  if (fake) {
    ranks = fake.classifica ? new Map(fake.saved.flatMap((r) => (r.places && r.rank_score != null ? [[r.places.id, Number(r.rank_score)] as [string, number]] : []))) : null;
  } else {
    const { data: rankRaw, error: rankError } = await supabase
      .from("saved_places").select("place_id, rank_score").eq("user_id", user.id).not("rank_score", "is", null);
    if (rankError && !isMissingColumn(rankError)) console.error("[profilo] lettura classifica fallita:", rankError.message);
    if (!rankError) ranks = new Map((rankRaw ?? []).map((r) => [r.place_id as string, Number(r.rank_score)]));
  }
  // Diario (4.4): la data della visita esiste solo con la migrazione 20261015_diario; senza, il
  // foglio "Com'è andata?" chiede solo voto e nota. Lettura minima, solo per saperlo.
  let diaryWithDate = false;
  if (fake) {
    diaryWithDate = fake.diario;
  } else {
    const { error: dErr } = await supabase.from("saved_places").select("visited_at").eq("user_id", user.id).limit(1);
    if (dErr && !isMissingVisitedAt(dErr)) console.error("[profilo] lettura diario fallita:", dErr.message);
    diaryWithDate = !dErr;
  }
  const social = await socialPromise;
  const reviews = (reviewsRaw ?? []) as unknown as ReviewRow[];

  // Salvati raggruppati per città (ricavata dall'indirizzo, come nella mappa).
  const byCity = new Map<string, SavedPlaceRow[]>();
  for (const row of saved) {
    if (!row.places) continue;
    const city = cityFromAddress(row.places.address) ?? "Altre zone";
    byCity.set(city, [...(byCity.get(city) ?? []), row]);
  }
  const cityGroups = [...byCity.entries()].sort((a, b) =>
    a[0] === "Altre zone" ? 1 : b[0] === "Altre zone" ? -1 : b[1].length - a[1].length,
  );
  const initial = (user.email ?? "?").charAt(0).toUpperCase();
  const name = (!("stato" in social) && social.display_name) || (user.email ?? "").split("@")[0] || "Il mio profilo";
  // Tre numeri come il profilo di Places: salvati / voglio andarci / ci sono stato (le città
  // sono dette sopra l'anteprima dei salvati).
  const wantCount = saved.filter((r) => r.tags?.includes(STATE_WANT)).length;
  const doneCount = saved.filter((r) => r.tags?.includes(STATE_DONE)).length;
  const cityCount = cityGroups.filter(([c]) => c !== "Altre zone").length;
  const counters = [
    { label: "Salvati", value: saved.length, href: savedHref(), id: "salvati" },
    { label: "Voglio andarci", value: wantCount, href: savedHref({ stato: "voglio" }), id: "voglio" },
    { label: "Ci sono stato", value: doneCount, href: savedHref({ stato: "fatto" }), id: "fatto" },
  ];

  // Raccolte = i tag dell'utente (esclusi i due di stato): le gestisce il componente client.
  const raccoltaRows: RaccoltaRow[] = saved.flatMap((row) =>
    row.places ? [{ placeId: row.places.id, name: row.places.name, address: row.places.address, category: row.places.category, tags: row.tags ?? [] }] : [],
  );
  const raccolteCount = new Set(saved.flatMap((r) => (r.tags ?? []).filter((t) => t !== STATE_WANT && t !== STATE_DONE))).size;

  const classificaRows: ClassificaRow[] = saved.flatMap((r) =>
    r.places && r.tags?.includes(STATE_DONE)
      ? [{ placeId: r.places.id, name: r.places.name, category: r.places.category, address: r.places.address, score: ranks?.get(r.places.id) ?? null }]
      : [],
  );

  // "Ci sei stato?" (?beta=ci-sei-stato): i "Voglio andarci", dal più vecchio (la soglia di 7 giorni nel componente).
  const visitCandidates: VisitCandidate[] = saved
    .filter((r) => r.places && r.tags?.includes(STATE_WANT) && !r.tags.includes(STATE_DONE))
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .slice(0, 20)
    .map((r) => ({ id: r.places!.id, name: r.places!.name, category: r.places!.category, tags: r.tags ?? [], savedAt: r.created_at, note: r.note }));

  const recent = saved.filter((r) => r.places).slice(0, 3);
  const REVIEWS_PREVIEW = 2;
  const icon = { size: 18, strokeWidth: 1.75 } as const;
  const row = "flex min-h-14 items-center gap-3 border-t border-border px-4 py-2 active:bg-surface";

  return (
    <div className="mx-auto max-w-2xl px-4 pb-8 pt-6">
      {/* Intestazione: chi sei, i tre numeri (toccabili) e l'ingranaggio per le cose secondarie. */}
      <header className="mb-5">
        <div className="flex items-center gap-3">
          <span aria-hidden className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand font-title text-2xl font-semibold text-white">
            {initial}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-title text-2xl font-semibold leading-tight text-brand">{name}</h1>
            <p className="truncate text-xs text-text-muted">{user.email}</p>
            <Link href="/me" className="inline-flex min-h-8 items-center text-sm font-display font-semibold text-accent">
              I tuoi gusti →
            </Link>
          </div>
          <a
            href="#altro"
            aria-label="Impostazioni e altro"
            data-testid="profilo-impostazioni"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border text-brand active:scale-95"
          >
            <Settings size={20} strokeWidth={1.75} aria-hidden />
          </a>
        </div>
        {/* La mia guida: numeri toccabili, ognuno apre la mappa sui salvati già filtrati. */}
        <nav aria-label="La mia guida" data-testid="guida-contatori" className="mt-4 grid grid-cols-3 divide-x divide-border rounded-card border border-border bg-surface">
          {counters.map((c) => (
            <Link
              key={c.id}
              href={c.href}
              data-testid={`guida-${c.id}`}
              className="flex min-h-[64px] flex-col items-center justify-center gap-1 px-1 py-2 text-center active:bg-white"
            >
              <span className="font-title text-2xl font-semibold leading-none text-brand">{c.value}</span>
              <span className="text-[11px] font-display leading-tight text-text-muted">{c.label}</span>
            </Link>
          ))}
        </nav>
      </header>

      {/* Il momento della scelta (VISIONE.md: "ritrovarlo nel momento giusto"): tre proposte dai propri salvati. */}
      <Link
        href="/stasera"
        data-testid="profilo-stasera"
        className="mb-5 flex min-h-[72px] items-center gap-4 rounded-card bg-brand px-4 py-3 text-white shadow-float active:scale-[0.99] transition-transform duration-150"
      >
        <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-xl">🍽️</span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-base font-semibold leading-tight">Stasera dove andiamo?</span>
          <span className="mt-0.5 block text-sm text-white/75">Scegli tra i tuoi salvati</span>
        </span>
        <span aria-hidden className="text-xl text-white/70">→</span>
      </Link>

      {/* Promemoria che compaiono solo quando servono. */}
      <BookingReminder />
      <VisitPrompt userId={user.id} candidates={visitCandidates} withDate={diaryWithDate} />

      {/* Le mie cose: ogni funzione del profilo a un tocco, con il suo numero. */}
      <section aria-labelledby="mie-cose-titolo" data-testid="profilo-mie-cose" className="mb-8">
        <h2 id="mie-cose-titolo" className="mb-2 text-xs font-display font-semibold uppercase tracking-wider text-text-muted">Le mie cose</h2>
        <div className="grid grid-cols-3 gap-2">
          <a href="#raccolte" data-testid="tessera-raccolte" className={TILE_CLASS}>
            <TileBody icon={<FolderHeart {...icon} />} label="Raccolte" count={raccolteCount} sub="Per occasione" />
          </a>
          <Link href="/profilo/diario" data-testid="profilo-diario" className={TILE_CLASS}>
            <TileBody icon={<BookOpen {...icon} />} label="Diario" count={doneCount} sub={doneCount === 0 ? "Voti e note" : `${doneCount} ${doneCount === 1 ? "provato" : "provati"}`} />
          </Link>
          {ranks ? (
            <a href="#classifica" data-testid="tessera-classifica" className={TILE_CLASS}>
              <TileBody icon={<Trophy {...icon} />} label="Classifica" count={classificaRows.length} sub="I tuoi preferiti" />
            </a>
          ) : (
            <a href="#ricerche" data-testid="tessera-ricerche" className={TILE_CLASS}>
              <TileBody icon={<History {...icon} />} label="Ricerche" sub="Da rifare" />
            </a>
          )}
          <ProfiloPrenotazioni />
          {/* Liste di gruppo (piano 5.5): scegliere insieme agli amici, con i 👍. */}
          <Link href="/gruppi" data-testid="profilo-gruppi" className={TILE_CLASS}>
            <TileBody icon={<Users {...icon} />} label="Liste di gruppo" sub="Si vota insieme" />
          </Link>
          {/* "Importa" non è più nella barra in basso: si raggiunge da qui. */}
          <Link href="/importa" data-testid="profilo-importa" className={TILE_CLASS}>
            <TileBody icon={<Download {...icon} />} label="Importa" sub="Da altre app" />
          </Link>
        </div>
      </section>

      <div id="raccolte" className="scroll-mt-4">
        <ProfiloRaccolte userId={user.id} initialRows={raccoltaRows} />
      </div>

      {ranks && (
        <div id="classifica" className="scroll-mt-4">
          <ProfiloClassifica userId={user.id} initialRows={classificaRows} />
        </div>
      )}

      {/* Salvati: anteprima breve; l'elenco per città si apre con "Vedi tutti". */}
      <section className="mb-8" data-testid="profilo-salvati">
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <h2 className="font-title text-xl font-semibold text-brand">Ultimi salvati</h2>
          {saved.length > 0 && (
            <Link href={savedHref()} className="inline-flex min-h-10 shrink-0 items-center text-sm font-display font-semibold text-accent">Sulla mappa →</Link>
          )}
        </div>
        {saved.length === 0 ? (
          <div className="rounded-card border border-border bg-surface p-5 text-center">
            <p className="text-sm text-text-muted">Non hai ancora salvato nessun locale.</p>
            <Link href="/mappa" className="mt-3 inline-flex min-h-11 items-center rounded-pill bg-brand px-5 text-sm font-display font-semibold text-white">
              Cerca un locale
            </Link>
          </div>
        ) : (
          <>
            <ul className="divide-y divide-border rounded-card border border-border bg-white">
              {recent.map(({ places: place }) =>
                place ? (
                  <li key={place.id}>
                    <Link href={`/mappa?salvato=${place.id}`} data-testid="profilo-salvato-recente" className="flex min-h-14 items-center gap-3 px-4 py-2 active:bg-surface">
                      <span aria-hidden className="text-xl">{getCategoryEmoji(place.category, place.name)}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-display text-sm font-semibold text-text">{place.name}</span>
                        <span className="block truncate text-xs text-text-muted">{cityFromAddress(place.address) ?? displayAddress(place.address)}</span>
                      </span>
                      <span aria-hidden className="text-text-muted">›</span>
                    </Link>
                  </li>
                ) : null,
              )}
            </ul>
            <details data-testid="profilo-salvati-tutti" className="group mt-2">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-center gap-1 rounded-pill border border-border text-sm font-display font-semibold text-brand active:bg-surface [&::-webkit-details-marker]:hidden">
                Vedi tutti i {saved.length}{cityCount > 1 ? `, divisi per ${cityCount} città` : ""}
                <ChevronDown aria-hidden size={16} className="transition-transform duration-150 group-open:rotate-180" />
              </summary>
              <div className="mt-4">
                {cityGroups.map(([city, rows]) => (
                  <div key={city} className="mb-5">
                    <h3 className="mb-2 text-xs font-display font-semibold uppercase tracking-wider text-text-muted">
                      📍 {city} · {rows.length}
                    </h3>
                    <ul className="space-y-2">
                      {rows.map(({ places: place, tags, note }, i) =>
                        place ? (
                          <li key={place.id ?? i}>
                            <Link href={`/mappa?salvato=${place.id}`} data-testid="profilo-salvato" className="block active:scale-[0.99]">
                              <PlaceCard name={place.name} category={place.category} address={place.address} tags={tags ?? undefined} note={note} />
                            </Link>
                          </li>
                        ) : null,
                      )}
                    </ul>
                  </div>
                ))}
              </div>
            </details>
          </>
        )}
      </section>

      {reviews.length > 0 && (
        <section className="mb-8" data-testid="profilo-recensioni">
          <h2 className="mb-2 font-title text-xl font-semibold text-brand">Le mie recensioni <span className="text-base text-text-muted">· {reviews.length}</span></h2>
          <ul className="space-y-2">
            {reviews.slice(0, REVIEWS_PREVIEW).map((review) => (
              <ReviewItem key={review.id} review={review} />
            ))}
          </ul>
          {reviews.length > REVIEWS_PREVIEW && (
            <details className="group mt-2">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-center gap-1 rounded-pill border border-border text-sm font-display font-semibold text-brand [&::-webkit-details-marker]:hidden">
                Vedi tutte le {reviews.length}
                <ChevronDown aria-hidden size={16} className="transition-transform duration-150 group-open:rotate-180" />
              </summary>
              <ul className="mt-2 space-y-2">
                {reviews.slice(REVIEWS_PREVIEW).map((review) => (
                  <ReviewItem key={review.id} review={review} />
                ))}
              </ul>
            </details>
          )}
        </section>
      )}

      {/* Altro: le cose secondarie in un elenco discreto, ognuna si apre al tocco. */}
      <section id="altro" aria-labelledby="altro-titolo" className="scroll-mt-4">
        <h2 id="altro-titolo" className="mb-2 text-xs font-display font-semibold uppercase tracking-wider text-text-muted">Altro</h2>
        <div className="overflow-hidden rounded-card border border-border bg-white">
          {/* Invito (piano 9.1): il proprio link personale. */}
          <ProfiloSezione id="invita" icon={<Send {...icon} />} title="Invita un amico" hint="Il tuo link personale">
            <InvitaAmico userId={user.id} handle={"stato" in social ? null : social.handle} />
          </ProfiloSezione>
          <ProfiloSezione
            id="pubblico"
            icon={<Globe {...icon} />}
            title="Profilo pubblico"
            hint={"stato" in social ? "In arrivo" : social.is_public ? "Pubblico: gli amici ti trovano" : "Privato"}
          >
            <ProfiloSocial userId={user.id} initial={"stato" in social ? null : social} />
          </ProfiloSezione>
          {/* Memoria dei gusti dell'assistente (piano 1.4): vedere e cancellare. */}
          <ProfiloSezione id="gusti" icon={<Sparkles {...icon} />} title="Cosa so di te" hint="I gusti che l’assistente ricorda">
            <ProfiloGusti userId={user.id} />
          </ProfiloSezione>
          <ProfiloSezione id="ricerche" icon={<History {...icon} />} title="Le tue ricerche" hint="Da rifare con un tocco">
            <ProfiloRicerche />
          </ProfiloSezione>
          {/* Premium (piano 8b): solo l'elenco di cosa arriverà, nessun pagamento. */}
          <Link href="/premium" data-testid="profilo-premium" className={row}>
            <Gem {...icon} aria-hidden className="shrink-0 text-accent" />
            <span className="min-w-0 flex-1">
              <span className="block font-display text-sm font-semibold text-text">Mapetite Premium <span className="text-xs text-accent">· in arrivo</span></span>
              <span className="block truncate text-xs text-text-muted">Assistente senza limiti, raccolte illimitate</span>
            </span>
            <ChevronRight aria-hidden size={16} className="text-text-muted" />
          </Link>
          {/* Lato ristoratori (piano 8). */}
          <Link href="/per-i-ristoratori" data-testid="profilo-ristoratori" className={row}>
            <Store {...icon} aria-hidden className="shrink-0 text-brand" />
            <span className="min-w-0 flex-1">
              <span className="block font-display text-sm font-semibold text-text">Hai un locale?</span>
              <span className="block truncate text-xs text-text-muted">Mapetite per i ristoratori</span>
            </span>
            <ChevronRight aria-hidden size={16} className="text-text-muted" />
          </Link>
        </div>
      </section>

      <ProfiloAccount loggedIn />
    </div>
  );
}

function ReviewItem({ review }: { review: ReviewRow }) {
  return (
    <li className="rounded-card border border-border bg-white p-4 shadow-card">
      <p className="font-display font-semibold text-text">{review.places?.name ?? "Locale sconosciuto"}</p>
      <div className="mt-1">
        <Stars rating={review.rating} />
      </div>
      {review.comment && <p className="mt-1.5 text-sm text-text-muted">{review.comment}</p>}
    </li>
  );
}
