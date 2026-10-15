import Link from "next/link";

// Stato "in arrivo" della parte social: la migrazione del database non è ancora applicata
// (o la lettura non riesce). Niente errori tecnici, niente pagine rotte.
export default function SocialInArrivo({ titolo = "Gli amici arrivano presto" }: { titolo?: string }) {
  return (
    <section data-testid="social-in-arrivo" className="rounded-card border border-border bg-surface p-6 text-center">
      <p aria-hidden className="text-4xl">👥</p>
      <p className="mt-2 font-display text-lg font-semibold text-brand">{titolo}</p>
      <p className="mx-auto mt-1 max-w-xs text-sm font-sans text-text-muted">
        Stiamo preparando profili pubblici, amici da seguire e i posti consigliati da chi conosci. Intanto la tua mappa funziona come sempre.
      </p>
      <Link href="/mappa" className="mt-4 inline-flex min-h-11 items-center rounded-pill bg-brand px-5 text-sm font-display font-semibold text-white">
        Torna alla mappa
      </Link>
    </section>
  );
}
