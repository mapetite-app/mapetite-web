import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { buildCarta, CARTA_MIN } from "@/lib/carta-gusto";
import { loadCartaRows } from "@/lib/carta-gusto-server";
import CartaGustoCondividi from "@/components/carta-gusto-condividi";
import TracciaFunzione from "@/components/traccia-funzione";

export const metadata: Metadata = {
  title: "La tua carta del gusto · Mapetite",
  description: "Il tuo gusto in una card da condividere, fatta solo dai tuoi salvati.",
};

function Indietro() {
  return (
    <Link href="/profilo" className="-ml-2 inline-flex min-h-11 items-center gap-1 px-2 text-sm font-display font-semibold text-brand">
      <ChevronLeft size={18} aria-hidden /> Profilo
    </Link>
  );
}

export default async function CartaGustoPage() {
  const rows = await loadCartaRows();

  if (rows === null) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="font-title text-2xl font-semibold text-text">La tua carta del gusto</h1>
        <p className="max-w-xs text-sm text-text-muted">Accedi per vedere il tuo gusto riassunto in una card da condividere.</p>
        <Link href="/login?next=%2Fprofilo%2Fgusto" className="inline-flex min-h-11 items-center rounded-pill bg-brand px-5 text-sm font-display font-semibold text-white">
          Accedi
        </Link>
      </div>
    );
  }

  if (rows.length < CARTA_MIN) {
    const mancano = CARTA_MIN - rows.length;
    return (
      <div className="mx-auto max-w-md px-4 pb-8 pt-4">
        <TracciaFunzione nome="carta_gusto_vista" contesto="vuota" />
        <Indietro />
        <div data-testid="carta-vuota" className="mt-6 rounded-card bg-brand px-6 py-10 text-center text-white">
          <p className="font-display text-sm text-white/70">La tua carta del gusto</p>
          <p className="mt-2 font-title text-[28px] leading-tight">
            Ancora {mancano} {mancano === 1 ? "posto" : "posti"} e la tua carta è pronta
          </p>
          <p className="mx-auto mt-3 max-w-xs text-sm text-white/80">
            La costruiamo solo da quello che salvi: più posti salvi, più ti somiglia.
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <Link href="/mappa" className="inline-flex min-h-11 items-center justify-center rounded-pill bg-accent px-5 text-sm font-display font-semibold text-white">
              Cerca un locale da salvare
            </Link>
            <Link href="/importa" className="inline-flex min-h-11 items-center justify-center rounded-pill border border-white/40 px-5 text-sm font-display font-semibold text-white">
              Importa da Instagram o Maps
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const c = buildCarta(rows);
  const maxTipo = Math.max(1, ...c.tipi.map((t) => t.count));
  const stats = [
    { value: String(c.salvati), label: "salvati" },
    { value: String(c.provati), label: "provati" },
    c.gemmePct != null ? { value: `${c.gemmePct}%`, label: "poco conosciuti" } : { value: String(c.cittaCount), label: "città" },
  ];

  return (
    <div className="mx-auto max-w-md px-4 pb-8 pt-4">
      <TracciaFunzione nome="carta_gusto_vista" contesto="piena" />
      <Indietro />
      <article data-testid="carta-gusto" aria-label="La tua carta del gusto" className="mt-2 overflow-hidden rounded-[28px] bg-brand px-6 pb-6 pt-7 text-white shadow-float">
        <div className="flex items-center gap-2">
          <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-accent" />
          <span className="font-display text-sm font-bold">Mapetite</span>
        </div>
        <p className="mt-6 font-display text-sm text-white/70">La mia carta del gusto</p>
        <h1 data-testid="carta-titolo" className="mt-1 font-title text-[36px] leading-[1.05] text-accent">{c.titolo}</h1>
        <p data-testid="carta-perche" className="mt-2 text-sm text-white/85">{c.perche}</p>

        <div data-testid="carta-numeri" className="mt-6 grid grid-cols-3 gap-2">
          {stats.map((s) => (
            <p key={s.label} className="rounded-2xl bg-white/[0.08] px-3 py-3">
              <span className="block font-display text-2xl font-bold leading-none">{s.value}</span>
              <span className="mt-1 block text-[11px] text-white/70">{s.label}</span>
            </p>
          ))}
        </div>

        {c.tipi.length > 0 && (
          <section className="mt-6">
            <h2 className="mb-2 font-display text-[11px] font-semibold uppercase tracking-widest text-white/60">Cosa salvo di più</h2>
            <ol data-testid="carta-tipi" className="space-y-2.5">
              {c.tipi.map((t, i) => (
                <li key={t.label} className="flex items-center gap-3">
                  <span className={`w-4 font-display text-base font-bold ${i === 0 ? "text-accent" : "text-white/55"}`}>{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex justify-between gap-2 font-display text-sm font-semibold">
                      <span className="truncate">{t.label}</span>
                      <span className="font-normal text-white/60">{t.count}</span>
                    </span>
                    <span className="mt-1 block h-1.5 rounded-full bg-white/[0.12]">
                      <span className={`block h-1.5 rounded-full ${i === 0 ? "bg-accent" : "bg-white/55"}`} style={{ width: `${Math.round((t.count / maxTipo) * 100)}%` }} />
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          </section>
        )}

        {c.raccolte.length > 0 && (
          <section className="mt-6">
            <h2 className="mb-2 font-display text-[11px] font-semibold uppercase tracking-widest text-white/60">Le mie raccolte</h2>
            <ul data-testid="carta-raccolte" className="flex flex-wrap gap-1.5">
              {c.raccolte.map((r) => (
                <li key={r.nome} className="max-w-full truncate rounded-pill border border-white/35 px-3 py-1 text-xs">{r.nome}</li>
              ))}
            </ul>
          </section>
        )}

        {c.citta.length > 0 && (
          <p data-testid="carta-citta" className="mt-6 font-display text-xs font-semibold text-white/80">{c.citta.join(" · ")}</p>
        )}
      </article>

      <CartaGustoCondividi />
      <p className="text-center text-[11px] text-text-muted">Fatta solo dai tuoi salvati. Nessun nome di locale nell’immagine.</p>
    </div>
  );
}
