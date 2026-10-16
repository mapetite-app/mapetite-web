import Link from "next/link";
import Form from "next/form";
import { MessageCircle, SlidersHorizontal, Sparkles } from "lucide-react";
import HomeRecent from "@/components/home-recent";
import { cookies } from "next/headers";
import HomeIntro, { IntroAgain } from "@/components/home-intro";
import HomeSaved from "@/components/home-saved";
import HomeSearchInput from "@/components/home-search-input";
import BookingReminder from "@/components/booking-reminder";
import DomandaSettimanale from "@/components/domanda-settimanale";
import { createClient, getUser } from "@/lib/supabase/server";

// Quanti salvati e quanti "Voglio andarci" (tag "Da provare"). In sviluppo con E2E_FAKE_USER
// li legge dal cookie "e2e_profilo" del giro automatico, come il profilo.
async function savedCounts(supabase: Awaited<ReturnType<typeof createClient>>, userId: string | null): Promise<{ total: number; want: number }> {
  let tags: (string[] | null)[] = [];
  if (process.env.NODE_ENV === "development" && process.env.E2E_FAKE_USER) {
    const raw = (await cookies()).get("e2e_profilo")?.value;
    if (raw) {
      try {
        tags = (JSON.parse(decodeURIComponent(raw)).saved ?? []).map((r: { tags?: string[] | null }) => r.tags ?? null);
        return { total: tags.length, want: tags.filter((t) => t?.includes("Da provare")).length };
      } catch { /* cookie non valido: si prosegue */ }
    }
  }
  if (!userId) return { total: 0, want: 0 };
  const { data } = await supabase.from("saved_places").select("tags").eq("user_id", userId);
  tags = (data ?? []).map((r) => (r as { tags: string[] | null }).tags);
  return { total: tags.length, want: tags.filter((t) => t?.includes("Da provare")).length };
}

// Home come quella di Places: marchio al centro, frasi d'esempio e un solo campo "Cosa cerchi?" in basso.
// Il modulo porta a /mappa?q=..., dove la ricerca parte da sola (funziona anche senza JS).
// <Form> di Next: con JS niente ricaricamento completo (navigazione interna come i suggerimenti),
// e la pagina /mappa si precarica mentre si scrive: la ricerca parte prima.
const EXAMPLES = [
  { emoji: "🌇", title: "Rooftop romantico", sub: "per due a Roma", q: "Rooftop romantico per due a Roma" },
  { emoji: "🍝", title: "Trattoria vera", sub: "non turistica a Trastevere", q: "Trattoria autentica non turistica a Trastevere" },
  { emoji: "🍸", title: "Cocktail bar", sub: "elegante per un appuntamento", q: "Cocktail bar elegante per un appuntamento" },
  // Niente "qui vicino": dalla home la posizione non è ancora nota.
  { emoji: "🥐", title: "Colazione buona", sub: "a Prati, con cornetti veri", q: "Colazione buona a Prati con cornetti veri" },
];

export default async function Home() {
  // Serve solo all'ultima schermata dell'intro: "Crea il tuo account" o "Inizia a cercare".
  const supabase = await createClient();
  const { data } = await getUser();
  const loggedIn = !!data?.user;
  const counts = await savedCounts(supabase, data?.user?.id ?? null);
  return (
    <div className="flex min-h-[calc(100dvh-4rem)] flex-col bg-white px-4 md:min-h-[calc(100dvh-3.5rem)]">
      <HomeIntro loggedIn={loggedIn} />
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <span aria-hidden className="text-5xl">🍽️</span>
        <h1 className="mt-3 font-title text-5xl font-semibold tracking-tight text-brand">Mapetite</h1>
        <p className="mt-3 max-w-xs text-base font-sans text-text-muted">
          I locali giusti per te, non quelli di tutti. Scrivi cosa cerchi come lo diresti a un amico.
        </p>
      </div>

      <div className="mx-auto w-full max-w-md pb-4">
        {/* Due modi di cercare, chiari subito (Lorenzo 11/10): chiedere all'AI o usare i filtri. */}
        {/* Prenotazioni richieste dall'assistente: promemoria oggi, "Com'è andata?" dopo. */}
        <BookingReminder />
        {/* Domanda settimanale (piano 7.6): una volta ogni 7 giorni, a chi è tornato almeno una volta. */}
        <DomandaSettimanale />
        <HomeSaved total={counts.total} want={counts.want} />
        <HomeRecent />
        {/* Sorprendimi e Assistente affiancati (Lorenzo 16/10: schermo più pulito, stesse funzioni). */}
        <div className="mb-4 grid grid-cols-2 gap-2">
          {/* Sorprendimi (piano 2.5): un posto mai provato che probabilmente ti piace, con il perché. */}
          <Link
            href="/sorprendimi?da=home"
            data-testid="home-sorprendimi"
            className="flex min-h-14 items-center gap-2.5 rounded-card border border-accent/30 bg-accent-light px-3 py-2.5 active:scale-[0.99]"
          >
            <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-base">🎲</span>
            <span className="min-w-0 flex-1 text-left">
              <span className="block font-display text-sm font-semibold leading-tight text-brand">Sorprendimi</span>
              <span className="block truncate text-xs font-sans text-text-muted">Un posto nuovo</span>
            </span>
          </Link>
          {/* Assistente (piano 1.1): conversazione con seguiti e prenotazione assistita. */}
          <Link
            href="/assistente"
            data-testid="home-assistente"
            className="flex min-h-14 items-center gap-2.5 rounded-card border border-brand/20 bg-brand/5 px-3 py-2.5 active:scale-[0.99]"
          >
            <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand text-white"><MessageCircle size={16} /></span>
            <span className="min-w-0 flex-1 text-left">
              <span className="block font-display text-sm font-semibold leading-tight text-brand">Assistente</span>
              <span className="block truncate text-xs font-sans text-text-muted">Chiedi e prenota</span>
            </span>
          </Link>
        </div>
        {/* Una sola barra (Lorenzo 12/10): sopra, frasi già pronte che mostrano come si chiede all'AI;
            i filtri sono un pulsante dentro la barra, non un secondo blocco. */}
        <p className="mb-2 text-sm font-display font-semibold text-brand">✨ Chiedi all&apos;AI come a un amico, per esempio:</p>
        <div data-testid="home-suggerimenti" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-3 [scrollbar-width:none]">
          {EXAMPLES.map((e) => (
            <Link
              key={e.q}
              href={`/mappa?q=${encodeURIComponent(e.q)}`}
              className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-pill border border-border bg-surface px-3.5 text-sm font-sans text-text active:scale-[0.98]"
            >
              <span aria-hidden>{e.emoji}</span> “{e.q}”
            </Link>
          ))}
        </div>
        <Form action="/mappa" className="flex items-center gap-1.5 rounded-card border border-border bg-surface py-2 pl-3.5 pr-2 shadow-card">
          <Sparkles size={18} className="shrink-0 text-accent" aria-hidden />
          <HomeSearchInput />
          <Link
            href="/mappa?filtri=1"
            data-testid="home-filtri"
            aria-label="Cerca con i filtri"
            className="flex h-11 shrink-0 items-center gap-1 rounded-full px-2.5 text-sm font-display font-semibold text-brand active:scale-95"
          >
            <SlidersHorizontal size={18} aria-hidden /> Filtri
          </Link>
          <button type="submit" aria-label="Cerca" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand text-lg text-white active:scale-95">
            →
          </button>
        </Form>
        {/* Link alti 40px (prima 15px): si toccano senza mirare. */}
        <p className="mt-1 flex flex-wrap items-center justify-center gap-x-1 text-xs font-sans text-text-muted">
          <Link href="/mappa" className="inline-flex min-h-10 items-center px-1 font-semibold text-brand">Apri la mappa</Link> ·
          {/* "accedi" solo a chi non è collegato (prima compariva anche a chi aveva già fatto l'accesso). */}
          {!loggedIn && <><Link href="/login" className="inline-flex min-h-10 items-center px-1 font-semibold text-brand">accedi</Link> ·</>}
          <IntroAgain />
        </p>
      </div>
    </div>
  );
}
