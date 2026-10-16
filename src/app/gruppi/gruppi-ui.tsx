import Link from "next/link";

// Pezzi comuni delle pagine delle liste di gruppo (piano 5.5), lato server.

/** Migrazione 20261016_liste_gruppo non ancora applicata (o lettura non riuscita): niente errori tecnici. */
export function GruppiInArrivo() {
  return (
    <section data-testid="gruppi-in-arrivo" className="rounded-card border border-border bg-surface p-6 text-center">
      <p aria-hidden className="text-4xl">🍽️</p>
      <p className="mt-2 font-display text-lg font-semibold text-brand">Le liste di gruppo arrivano presto</p>
      <p className="mx-auto mt-1 max-w-xs text-sm font-sans text-text-muted">
        Presto potrai creare liste come &quot;Cene del giovedì&quot; con gli amici: ognuno propone un posto, si vota e si sceglie. Intanto la tua mappa funziona come sempre.
      </p>
      <Link href="/mappa" className="mt-4 inline-flex min-h-11 items-center rounded-pill bg-brand px-5 text-sm font-display font-semibold text-white">
        Torna alla mappa
      </Link>
    </section>
  );
}

export function GruppiAccedi({ next }: { next: string }) {
  const n = encodeURIComponent(next);
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center" data-testid="gruppi-accedi">
      <p aria-hidden className="text-4xl">🍽️</p>
      <p className="font-display text-xl font-semibold text-brand">Scegliete insieme dove andare</p>
      <p className="max-w-xs text-sm text-text-muted">Accedi per creare una lista con gli amici: ognuno propone un posto, si vota e vince il preferito.</p>
      <div className="flex gap-2">
        <a href={`/login?next=${n}`} className="inline-flex min-h-11 items-center rounded-pill bg-brand px-5 text-sm font-display font-semibold text-white">Accedi</a>
        <a href={`/signup?next=${n}`} className="inline-flex min-h-11 items-center rounded-pill border border-border px-5 text-sm font-display font-semibold text-brand">Crea un account</a>
      </div>
    </div>
  );
}

/** Nome con cui comparire nella lista: quello pubblico se c'è, altrimenti lo si sceglie entrando. */
export function nomeSuggerito(social: { display_name: string | null; handle: string | null } | { stato: string }): string {
  if ("stato" in social) return "";
  return (social.display_name?.trim() || social.handle || "").slice(0, 40);
}
