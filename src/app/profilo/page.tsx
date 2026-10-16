import { createClient, getUser } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import Link from "next/link";
import PlaceCard from "@/components/place-card";
import { cityFromAddress } from "@/lib/city";
import ProfiloRicerche from "@/components/profilo-ricerche";
import BookingReminder from "@/components/booking-reminder";
import ProfiloPrenotazioni from "@/components/profilo-prenotazioni";
import ProfiloRaccolte, { type RaccoltaRow } from "@/components/profilo-raccolte";
import VisitPrompt, { type VisitCandidate } from "@/components/visit-prompt";
import ProfiloSocial from "@/components/profilo-social";
import { loadMySocial } from "@/lib/social";
import ProfiloClassifica, { type ClassificaRow } from "@/components/profilo-classifica";
import { isMissingColumn } from "@/lib/classifica";
import { isMissingVisitedAt } from "@/lib/diario";
import ProfiloAccount from "@/components/profilo-account";

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
  // Contatori come il profilo di Places: voglio andarci / ci sono stato / città.
  const wantCount = saved.filter((r) => r.tags?.includes(STATE_WANT)).length;
  const doneCount = saved.filter((r) => r.tags?.includes(STATE_DONE)).length;
  const cityCount = cityGroups.filter(([c]) => c !== "Altre zone").length;
  const counters = [
    { label: "Salvati", value: saved.length, href: savedHref(), id: "salvati" },
    { label: "📌 Voglio andarci", value: wantCount, href: savedHref({ stato: "voglio" }), id: "voglio" },
    { label: "✓ Ci sono stato", value: doneCount, href: savedHref({ stato: "fatto" }), id: "fatto" },
    { label: "Città", value: cityCount, href: savedHref(), id: "citta" },
  ];

  // Raccolte = i tag dell'utente (esclusi i due di stato): le gestisce il componente client.
  const raccoltaRows: RaccoltaRow[] = saved.flatMap((row) =>
    row.places ? [{ placeId: row.places.id, name: row.places.name, address: row.places.address, category: row.places.category, tags: row.tags ?? [] }] : [],
  );

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

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6 flex items-center gap-4">
        <span aria-hidden className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand font-title text-2xl font-semibold text-white">
          {initial}
        </span>
        <div className="min-w-0">
          <p className="truncate font-display text-base font-semibold text-text">{user.email}</p>
          <p className="mt-0.5 text-sm text-text-muted">
            {saved.length} {saved.length === 1 ? "locale salvato" : "locali salvati"} ·{" "}
            {reviews.length} {reviews.length === 1 ? "recensione" : "recensioni"}
          </p>
          <Link href="/me" className="inline-flex min-h-10 items-center text-sm font-display font-semibold text-accent">
            I tuoi gusti →
          </Link>
        </div>
      </div>

      {/* Prenotazioni richieste dall'assistente (salvate nel telefono). */}
      <BookingReminder />

      {/* Il momento della scelta (VISIONE.md: "ritrovarlo nel momento giusto"): tre proposte dai propri salvati. */}
      <Link
        href="/stasera"
        data-testid="profilo-stasera"
        className="mb-4 flex min-h-[84px] items-center gap-4 rounded-card bg-brand px-4 py-4 text-white shadow-float active:scale-[0.99] transition-transform duration-150"
      >
        <span aria-hidden className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent text-2xl">🍽️</span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-lg font-semibold leading-tight">Stasera dove andiamo?</span>
          <span className="mt-0.5 block text-sm text-white/75">Scegli tra i tuoi salvati</span>
        </span>
        <span aria-hidden className="text-xl text-white/70">→</span>
      </Link>

      <ProfiloPrenotazioni />

      {/* La mia guida: numeri toccabili, ognuno apre la mappa sui salvati già filtrati. */}
      <nav aria-label="La mia guida" data-testid="guida-contatori" className="mb-8 grid grid-cols-4 gap-2">
        {counters.map((c) => (
          <Link
            key={c.id}
            href={c.href}
            data-testid={`guida-${c.id}`}
            className="flex min-h-[84px] flex-col items-center justify-center gap-1 rounded-card border border-border bg-surface px-1 py-3 text-center active:scale-[0.97] transition-transform duration-150"
          >
            <span className="font-title text-2xl font-semibold leading-none text-brand">{c.value}</span>
            <span className="text-[11px] font-display leading-tight text-text-muted">{c.label}</span>
          </Link>
        ))}
      </nav>

      <VisitPrompt userId={user.id} candidates={visitCandidates} withDate={diaryWithDate} />

      {/* Diario (4.4): i posti provati con data, voto e nota. */}
      <Link
        href="/profilo/diario"
        data-testid="profilo-diario"
        className="mb-8 flex min-h-[72px] items-center gap-4 rounded-card border border-border bg-surface px-4 py-3 active:scale-[0.99] transition-transform duration-150"
      >
        <span aria-hidden className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent-light text-2xl">📔</span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-base font-semibold leading-tight text-text">Il mio diario</span>
          <span className="mt-0.5 block text-sm text-text-muted">
            {doneCount === 0 ? "I posti dove sei stato, con voto e note" : `${doneCount} ${doneCount === 1 ? "posto provato" : "posti provati"}, con voto e note`}
          </span>
        </span>
        <span aria-hidden className="text-xl text-text-muted">→</span>
      </Link>

      <ProfiloRaccolte userId={user.id} initialRows={raccoltaRows} />

      {ranks && <ProfiloClassifica userId={user.id} initialRows={classificaRows} />}

      <ProfiloRicerche />

      <ProfiloSocial userId={user.id} initial={"stato" in social ? null : social} />

      <section className="mb-10">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="font-title text-xl font-semibold text-brand">I miei locali salvati</h2>
          {saved.length > 0 && (
            <Link href={savedHref()} className="inline-flex min-h-10 shrink-0 items-center text-sm font-display font-semibold text-accent">Sulla mappa →</Link>
          )}
        </div>
        {/* "Importa" non è più nella barra in basso (ora c'è "Salvati"): si raggiunge da qui. */}
        <Link
          href="/importa"
          data-testid="profilo-importa"
          className="mb-3 flex min-h-11 items-center justify-center rounded-pill border border-dashed border-brand/40 px-4 text-sm font-display font-semibold text-brand active:scale-[0.99]"
        >
          + Importa locali
        </Link>
        {saved.length === 0 ? (
          <div className="rounded-card border border-border bg-surface p-5 text-center">
            <p className="text-sm text-text-muted">Non hai ancora salvato nessun locale.</p>
            <Link href="/mappa" className="mt-3 inline-flex min-h-11 items-center rounded-pill bg-brand px-5 text-sm font-display font-semibold text-white">
              Cerca un locale
            </Link>
          </div>
        ) : (
          cityGroups.map(([city, rows]) => (
            <div key={city} className="mb-5">
              <h3 className="mb-2 text-xs font-display font-semibold uppercase tracking-wider text-text-muted">
                📍 {city} · {rows.length}
              </h3>
              <ul className="space-y-2">
                {rows.map(({ places: place, tags, note }, i) =>
                  place ? (
                    <li key={place.id ?? i}>
                      {/* Tocco: apre la scheda del locale sulla mappa (prima la card non portava da nessuna parte). */}
                      <Link href={`/mappa?salvato=${place.id}`} data-testid="profilo-salvato" className="block active:scale-[0.99]">
                        <PlaceCard
                          name={place.name}
                          category={place.category}
                          address={place.address}
                          tags={tags ?? undefined}
                          note={note}
                        />
                      </Link>
                    </li>
                  ) : null
                )}
              </ul>
            </div>
          ))
        )}
      </section>

      <section>
        <h2 className="mb-3 font-title text-xl font-semibold text-brand">Le mie recensioni</h2>
        {reviews.length === 0 ? (
          <p className="text-sm text-text-muted">Non hai ancora scritto recensioni.</p>
        ) : (
          <ul className="space-y-2">
            {reviews.map((review) => (
              <li key={review.id} className="rounded-card border border-border bg-white p-4 shadow-card">
                <p className="font-display font-semibold text-text">
                  {review.places?.name ?? "Locale sconosciuto"}
                </p>
                <div className="mt-1">
                  <Stars rating={review.rating} />
                </div>
                {review.comment && (
                  <p className="mt-1.5 text-sm text-text-muted">{review.comment}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <ProfiloAccount loggedIn />
    </div>
  );
}
