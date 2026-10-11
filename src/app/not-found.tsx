import Link from "next/link";

// 404 in italiano e nello stile Mapetite (quella di Next è in inglese).
export default function NotFound() {
  return (
    <div className="flex min-h-[70dvh] flex-col items-center justify-center px-6 text-center">
      <span aria-hidden className="text-5xl">🗺️</span>
      <h1 className="mt-4 font-title text-2xl font-semibold text-brand">Questa pagina non esiste</h1>
      <p className="mt-2 max-w-xs text-sm text-text-muted">Forse il link è vecchio o incompleto. Dalla mappa trovi tutto.</p>
      <Link href="/mappa" className="mt-6 inline-flex min-h-11 items-center rounded-pill bg-brand px-5 text-sm font-display font-semibold text-white">
        Apri la mappa
      </Link>
    </div>
  );
}
