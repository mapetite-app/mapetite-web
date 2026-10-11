import Link from "next/link";

// Home come quella di Places: marchio al centro, esempi e campo "Cosa cerchi?" in basso.
// Il modulo porta a /mappa?q=..., dove la ricerca parte da sola (funziona anche senza JS).
const EXAMPLES = [
  { emoji: "🌇", title: "Rooftop romantico", sub: "per due a Roma", q: "Rooftop romantico per due a Roma" },
  { emoji: "🍝", title: "Trattoria vera", sub: "non turistica a Trastevere", q: "Trattoria autentica non turistica a Trastevere" },
  { emoji: "🍸", title: "Cocktail bar", sub: "elegante per un appuntamento", q: "Cocktail bar elegante per un appuntamento" },
  { emoji: "🥐", title: "Colazione buona", sub: "qui vicino", q: "Colazione buona qui vicino" },
];

export default function Home() {
  return (
    <div className="flex min-h-[calc(100dvh-4rem)] flex-col bg-white px-4 md:min-h-[calc(100dvh-3.5rem)]">
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <span aria-hidden className="text-5xl">🍽️</span>
        <h1 className="mt-3 font-title text-5xl font-semibold tracking-tight text-brand">Mapetite</h1>
        <p className="mt-3 max-w-xs text-base font-sans text-text-muted">
          I locali giusti per te, non quelli di tutti. Scrivi cosa cerchi come lo diresti a un amico.
        </p>
      </div>

      <div className="mx-auto w-full max-w-md pb-4">
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-3 [scrollbar-width:none]">
          {EXAMPLES.map((e) => (
            <Link
              key={e.q}
              href={`/mappa?q=${encodeURIComponent(e.q)}`}
              className="flex min-h-16 w-52 shrink-0 items-center gap-3 rounded-card border border-border bg-surface px-3 py-2.5 text-left active:scale-[0.98]"
            >
              <span aria-hidden className="text-2xl">{e.emoji}</span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-display font-semibold text-text">{e.title}</span>
                <span className="block truncate text-xs font-sans text-text-muted">{e.sub}</span>
              </span>
            </Link>
          ))}
        </div>
        <form action="/mappa" className="flex items-center gap-2 rounded-card border border-border bg-surface py-2 pl-4 pr-2 shadow-card">
          <input
            type="search"
            name="q"
            required
            minLength={3}
            enterKeyHint="search"
            placeholder="Cosa cerchi?"
            aria-label="Cosa cerchi?"
            className="min-h-11 min-w-0 flex-1 bg-transparent text-base font-sans text-text placeholder:text-text-muted focus:outline-none"
          />
          <button type="submit" aria-label="Cerca" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand text-lg text-white active:scale-95">
            →
          </button>
        </form>
        <p className="mt-3 text-center text-xs font-sans text-text-muted">
          Oppure <Link href="/mappa" className="font-semibold text-brand">apri la mappa</Link> ·{" "}
          <Link href="/login" className="font-semibold text-brand">accedi</Link>
        </p>
      </div>
    </div>
  );
}
