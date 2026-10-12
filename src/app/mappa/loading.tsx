// Mentre arriva la mappa (rete lenta, prima apertura): niente pagina bianca.
export default function Loading() {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-bg md:top-14" role="status" aria-live="polite">
      <span aria-hidden className="text-4xl">🗺️</span>
      <p className="mt-3 flex items-center gap-2 font-display text-base font-semibold text-brand">
        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-border border-t-accent" />
        Apro la mappa…
      </p>
    </div>
  );
}
