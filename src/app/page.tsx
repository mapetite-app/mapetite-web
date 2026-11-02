import Link from "next/link";
import Form from "next/form";
import { SlidersHorizontal, Sparkles } from "lucide-react";
import LogoMark from "@/components/logo-mark";
import { cookies } from "next/headers";
import HomeIntro, { IntroAgain } from "@/components/home-intro";
import HomePerTe, { HomeClassifiche, HomePillole } from "@/components/home-per-te";
import { momentoDi } from "@/lib/home-proposte";
import { pulisciMappa, type MappaGusto } from "@/lib/mappa-gusto";
import { ZONE } from "@/lib/gusti";
import { getCategoryEmoji } from "@/lib/emoji";
import HomeSearchInput from "@/components/home-search-input";
import BookingReminder from "@/components/booking-reminder";
import DomandaSettimanale from "@/components/domanda-settimanale";
import { createClient, getUser } from "@/lib/supabase/server";
import { isWanted } from "@/lib/tags";

type SavedRow = { tags: string[] | null; places: { category: string | null; name: string | null } | null };

// Salvati per la striscia "I tuoi posti": totale, "Da provare" (tag "Da provare") e le emoji degli
// ultimi. In sviluppo con E2E_FAKE_USER li legge dal cookie "e2e_profilo" del giro automatico, come il profilo.
async function savedSummary(supabase: Awaited<ReturnType<typeof createClient>>, userId: string | null): Promise<{ total: number; want: number; emoji: string[] }> {
  let rows: SavedRow[] = [];
  if (process.env.NODE_ENV === "development" && process.env.E2E_FAKE_USER) {
    const raw = (await cookies()).get("e2e_profilo")?.value;
    if (raw) {
      try { rows = JSON.parse(decodeURIComponent(raw)).saved ?? []; } catch { /* cookie non valido */ }
    }
  } else if (userId) {
    const { data } = await supabase.from("saved_places").select("tags, places(category, name)").eq("user_id", userId).order("created_at", { ascending: false });
    rows = (data ?? []) as unknown as SavedRow[];
  }
  const emoji = [...new Set(rows.map((r) => getCategoryEmoji(r.places?.category ?? null, r.places?.name ?? null)))].slice(0, 3);
  // "Da provare" conta anche i salvati senza stato, come Salvati e Profilo (revisore 2/11).
  return { total: rows.length, want: rows.filter((r) => isWanted(r.tags)).length, emoji };
}

// Nome, città e mappa del gusto per il saluto e le proposte. Senza colonne o senza profilo: niente.
async function profilo(supabase: Awaited<ReturnType<typeof createClient>>, userId: string | null): Promise<{ nome: string | null; citta: string | null; gusto: MappaGusto | null }> {
  const zonaNota = (z: string) => ZONE.some((x) => x.nome === z);
  if (process.env.NODE_ENV === "development" && process.env.E2E_FAKE_USER) {
    const raw = (await cookies()).get("e2e_gusto")?.value;
    try {
      const g = raw ? JSON.parse(decodeURIComponent(raw)) : null;
      return { nome: g?.nome ?? null, citta: g?.city ?? null, gusto: g ? pulisciMappa(g, zonaNota) : null };
    } catch { return { nome: null, citta: null, gusto: null }; }
  }
  if (!userId) return { nome: null, citta: null, gusto: null };
  const { data, error } = await supabase.from("profiles").select("display_name, city, gusto").eq("id", userId).maybeSingle();
  if (error || !data) return { nome: null, citta: null, gusto: null };
  const r = data as { display_name?: string | null; city?: string | null; gusto?: unknown };
  return { nome: r.display_name?.trim().split(/\s+/)[0] ?? null, citta: r.city ?? null, gusto: r.gusto ? pulisciMappa(r.gusto, zonaNota) : null };
}

// Home (mockup A del 21/10, scelto da Lorenzo): saluto con l'ora e il nome, un campo "Cosa cerchi?",
// le ricerche recenti, "Per te" (proposte dalle ricerche e dalla mappa del gusto), i tuoi posti e le
// classifiche della città. Tutto porta a /mappa?q=…: nessuna chiamata a pagamento in home.
// <Form> di Next: con JS niente ricaricamento completo, e /mappa si precarica mentre si scrive.
export default async function Home({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  // Arrivo da "Elimina il mio account" (profilo): conferma che è andata.
  const accountEliminato = (await searchParams).account === "eliminato";
  const supabase = await createClient();
  const { data } = await getUser();
  const loggedIn = !!data?.user;
  const userId = data?.user?.id ?? null;
  const [saved, prof] = await Promise.all([savedSummary(supabase, userId), profilo(supabase, userId)]);
  const now = new Date();
  const ora = momentoDi(now);
  // Città: quella scelta al primo accesso, o quella della prima zona; Roma e Milano hanno le classifiche.
  const zonaCitta = prof.gusto?.zone[0] ? ZONE.find((z) => z.nome === prof.gusto!.zone[0])?.citta ?? null : null;
  // Senza città nel profilo la decide il telefono (posizione o ultima mappa): vedi useCitta.
  const cittaProfilo = prof.citta ?? zonaCitta;
  const parole = ora.domanda.split(" ");
  const enfasi = parole.pop();

  return (
    <div className="min-h-[calc(100dvh-4rem)] bg-[#f8f6f2] px-4 pb-8 md:min-h-[calc(100dvh-3.5rem)]">
      {!accountEliminato && <HomeIntro loggedIn={loggedIn} />}
      <div className="mx-auto w-full max-w-md">
        {accountEliminato && (
          <p role="status" data-testid="account-eliminato" className="mt-4 rounded-card border border-border bg-surface px-4 py-3 text-center text-sm text-text">
            <span className="block font-display font-semibold text-brand">Account eliminato</span>
            I tuoi dati sono stati cancellati. Grazie di aver provato Mapetite.
          </p>
        )}

        <header className="flex items-center justify-between pt-5">
          <span className="flex items-center gap-2">
            <LogoMark size={30} />
            <span className="font-display text-xl font-semibold tracking-tight text-brand">mapetite</span>
          </span>
          {loggedIn && (
            <Link href="/profilo" aria-label="Il tuo profilo" data-testid="home-avatar" className="flex h-11 w-11 items-center justify-center rounded-full bg-brand font-display text-base font-semibold text-white">
              {(prof.nome ?? data?.user?.email ?? "?").charAt(0).toUpperCase()}
            </Link>
          )}
        </header>

        <p data-testid="home-momento" className="mt-7 text-xs font-display font-semibold uppercase tracking-[0.16em] text-text-muted">
          {ora.etichetta}{cittaProfilo ? ` · ${cittaProfilo}` : ""}
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-newsreader)] text-[40px] font-medium leading-[1.05] tracking-tight text-text">
          {parole.join(" ")} <em className="text-brand">{enfasi}</em>{prof.nome ? `, ${prof.nome}` : ""}?
        </h1>

        <Form action="/mappa" className="mt-5 flex items-center gap-1.5 rounded-pill border border-border bg-white py-2 pl-4 pr-2 shadow-card">
          <Sparkles size={18} className="shrink-0 text-accent" aria-hidden />
          <HomeSearchInput />
          <Link
            href="/mappa?filtri=1"
            data-testid="home-filtri"
            aria-label="Cerca con i filtri"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-brand active:scale-95"
          >
            <SlidersHorizontal size={19} aria-hidden />
          </Link>
          <button type="submit" aria-label="Cerca" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand text-lg text-white active:scale-95">
            →
          </button>
        </Form>
        <HomePillole momento={ora.momento} cittaProfilo={cittaProfilo} />

        {/* Prenotazioni richieste dall'assistente: promemoria oggi, "Com'è andata?" dopo. */}
        <div className="mt-4 empty:hidden">
          <BookingReminder />
          {/* Domanda settimanale (piano 7.6): una volta ogni 7 giorni, a chi è tornato almeno una volta. */}
          <DomandaSettimanale />
        </div>

        <HomePerTe gusto={prof.gusto} cittaProfilo={cittaProfilo} momento={ora.momento} loggedIn={loggedIn} />

        {saved.total > 0 && (
          <section data-testid="home-salvati" className="mt-6 flex items-center gap-3 rounded-card border border-border bg-white p-3 shadow-sm">
            <Link href="/mappa?vista=salvati" data-testid="home-salvati-tutti" className="flex min-h-12 min-w-0 flex-1 items-center gap-3 active:scale-[0.99]">
              <span aria-hidden className="flex shrink-0 -space-x-2">
                {saved.emoji.map((e) => (
                  <span key={e} className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-surface text-base">{e}</span>
                ))}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-display font-semibold text-text">I tuoi posti · {saved.total}</span>
                <span className="block truncate text-xs font-sans text-text-muted">
                  {saved.want > 0 ? `${saved.want} da provare` : saved.total === 1 ? "1 salvato" : `${saved.total} salvati`}
                </span>
              </span>
            </Link>
            {saved.want > 0 && (
              <Link href="/stasera" data-testid="home-salvati-stasera" className="flex min-h-11 shrink-0 items-center rounded-pill bg-accent px-3.5 text-sm font-display font-semibold text-white active:scale-95">
                Stasera?
              </Link>
            )}
          </section>
        )}

        <HomeClassifiche momento={ora.momento} cittaProfilo={cittaProfilo} adesso={now.getTime()} />

        <p className="mt-6 flex justify-center text-xs font-sans text-text-muted">
          <IntroAgain />
        </p>
      </div>
    </div>
  );
}
