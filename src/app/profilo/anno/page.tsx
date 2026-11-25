import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { annoDa, buildAnno, numeriAnno, type Anno } from "@/lib/anno-tavola";
import { loadAnnoRows } from "@/lib/anno-tavola-server";
import { categoryLabel } from "@/lib/category-label";
import { getCategoryEmoji } from "@/lib/emoji";
import CartaGustoCondividi from "@/components/carta-gusto-condividi";
import TracciaFunzione from "@/components/traccia-funzione";

// "Il tuo anno a tavola" (proposta 49): i posti dove sei stato quest'anno, contati dai tuoi "Ci sono stato".
// Una cosa principale: la card da condividere. Sotto, un tocco più in là, i tuoi preferiti e i "Da provare".
// La mappa è solo una costellazione di punti (nessuno sfondo di Google); l'immagine condivisa non ha nomi né punti.

export const metadata: Metadata = {
  title: "Il tuo anno a tavola · Mapetite",
  description: "I posti dove sei stato quest'anno, i tuoi preferiti e i numeri del tuo anno, da condividere.",
};

function Indietro() {
  return (
    <Link href="/profilo/diario" className="-ml-2 inline-flex min-h-11 items-center gap-1 px-2 text-sm font-display font-semibold text-brand">
      <ChevronLeft size={18} aria-hidden /> Diario
    </Link>
  );
}

const plur = (n: number, uno: string, tanti: string) => `${n} ${n === 1 ? uno : tanti}`;

function Costellazione({ mappa }: { mappa: NonNullable<Anno["mappa"]> }) {
  // Prima gli altri, poi i 👍 sopra; margine di 10 su 100 perché i punti ai bordi non si taglino.
  const punti = [...mappa.punti].sort((a, b) => Number(a.su) - Number(b.su));
  return (
    <figure data-testid="anno-mappa" className="mt-6">
      <div className="relative overflow-hidden rounded-2xl bg-white/[0.06]">
        <svg viewBox="0 0 100 70" role="img" aria-label={`La mappa dei tuoi ${mappa.punti.length} posti${mappa.citta ? ` a ${mappa.citta}` : ""}`} className="block h-auto w-full">
          <defs>
            <pattern id="anno-griglia" width="10" height="10" patternUnits="userSpaceOnUse">
              <path d="M10 0H0V10" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="0.3" />
            </pattern>
          </defs>
          <rect width="100" height="70" fill="url(#anno-griglia)" />
          {punti.map((p, i) => (
            <g key={i}>
              {p.su && <circle cx={23 + p.x * 54} cy={8 + p.y * 54} r="4" fill="#ff6b4a" opacity="0.22" />}
              <circle data-testid="anno-punto" cx={23 + p.x * 54} cy={8 + p.y * 54} r={p.su ? 2.2 : 1.6} fill={p.su ? "#ff6b4a" : "rgba(255,255,255,0.8)"} />
            </g>
          ))}
        </svg>
      </div>
      <figcaption className="mt-2 flex items-center justify-between gap-2 text-[11px] text-white/65">
        <span className="truncate font-display font-semibold text-white/85">{mappa.citta ?? "I tuoi posti"}</span>
        <span className="flex shrink-0 items-center gap-1.5"><span aria-hidden className="h-2 w-2 rounded-full bg-accent" /> ti è piaciuto</span>
      </figcaption>
    </figure>
  );
}

export default async function AnnoPage() {
  const rows = await loadAnnoRows();
  const anno = annoDa();

  if (rows === null) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="font-title text-2xl font-semibold text-text">Il tuo {anno} a tavola</h1>
        <p className="max-w-xs text-sm text-text-muted">Accedi per rivedere i posti dove sei stato quest’anno.</p>
        <Link href="/login?next=%2Fprofilo%2Fanno" className="inline-flex min-h-11 items-center rounded-pill bg-brand px-5 text-sm font-display font-semibold text-white">
          Accedi
        </Link>
      </div>
    );
  }

  const a = buildAnno(rows, anno);

  if (a.provati === 0) {
    return (
      <div className="mx-auto max-w-md px-4 pb-8 pt-4">
        <TracciaFunzione nome="anno_tavola_vista" contesto="vuota" />
        <Indietro />
        <div data-testid="anno-vuoto" className="mt-6 rounded-card bg-brand px-6 py-10 text-center text-white">
          <p className="font-display text-sm text-white/70">Il tuo {anno} a tavola</p>
          <p className="mt-2 font-title text-[28px] leading-tight">Ancora nessun posto provato quest’anno</p>
          <p className="mx-auto mt-3 max-w-xs text-sm text-white/80">
            Segna <span className="font-semibold text-white">✓ Ci sono stato</span> dove vai: qui ritrovi la mappa del tuo anno.
          </p>
          <Link href="/mappa?vista=salvati" className="mt-6 inline-flex min-h-11 items-center justify-center rounded-pill bg-accent px-5 text-sm font-display font-semibold text-white">
            Apri i tuoi salvati
          </Link>
        </div>
      </div>
    );
  }

  const stats = numeriAnno(a);
  const righe = [
    a.tipo && { k: "tipo", label: "Il mio genere", value: `${a.tipo.label} · ${plur(a.tipo.count, "posto", "posti")}` },
    a.mese && { k: "mese", label: "Il mese più goloso", value: `${a.mese.label.charAt(0).toUpperCase()}${a.mese.label.slice(1)} · ${plur(a.mese.count, "posto", "posti")}` },
  ].filter(Boolean) as { k: string; label: string; value: string }[];

  return (
    <div className="mx-auto max-w-md px-4 pb-10 pt-4">
      <TracciaFunzione nome="anno_tavola_vista" contesto="piena" />
      <Indietro />
      <article data-testid="anno-card" aria-label={`Il tuo ${anno} a tavola`} className="mt-2 overflow-hidden rounded-[28px] bg-brand px-6 pb-6 pt-7 text-white shadow-float">
        <div className="flex items-center gap-2">
          <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-accent" />
          <span className="font-display text-sm font-bold">Mapetite</span>
        </div>
        <p className="mt-6 font-display text-sm text-white/70">Il mio {anno} a tavola</p>
        <h1 data-testid="anno-titolo" className="mt-1 flex items-baseline gap-2 font-title leading-none text-accent">
          <span className="text-[64px] font-semibold tracking-tight">{a.provati}</span>
          <span className="text-[26px]">{a.provati === 1 ? "posto provato" : "posti provati"}</span>
        </h1>

        {a.mappa && <Costellazione mappa={a.mappa} />}

        {stats.length > 0 && (
        <div data-testid="anno-numeri" className={`mt-5 grid gap-2 ${stats.length === 3 ? "grid-cols-3" : stats.length === 2 ? "grid-cols-2" : "grid-cols-1"}`}>
          {stats.map((s) => (
            <p key={s.label} className="rounded-2xl bg-white/[0.08] px-3 py-3">
              <span className="block font-display text-2xl font-bold leading-none">{s.value}</span>
              <span className="mt-1 block text-[11px] leading-tight text-white/70">{s.label}</span>
            </p>
          ))}
        </div>
        )}

        {righe.length > 0 && (
          <dl data-testid="anno-righe" className="mt-5 space-y-2.5">
            {righe.map((r) => (
              <div key={r.k} className="flex items-baseline justify-between gap-3 border-b border-white/10 pb-2 last:border-0 last:pb-0">
                <dt className="shrink-0 text-xs text-white/65">{r.label}</dt>
                <dd className="min-w-0 truncate text-right font-display text-sm font-semibold">{r.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </article>

      <CartaGustoCondividi url="/profilo/anno/immagine" fileName={`il-mio-${anno}-a-tavola-mapetite.png`} text={`Il mio ${anno} a tavola su Mapetite`} evento="anno_tavola_condividi" />
      <p className="text-center text-[11px] text-text-muted">Solo dai tuoi “Ci sono stato”. Nell’immagine niente nomi di locali.</p>

      {a.preferiti.length > 0 && (
        <section data-testid="anno-preferiti" aria-labelledby="anno-pref-titolo" className="mt-7">
          <h2 id="anno-pref-titolo" className="mb-2 font-title text-[22px] leading-tight text-text">
            {a.preferiti.length === 1 ? "Il tuo preferito" : `I tuoi ${a.preferiti.length} preferiti`}
          </h2>
          <ol className="divide-y divide-border rounded-card border border-[#e3e7e7] bg-white shadow-card">
            {a.preferiti.map((p, i) => (
              <li key={p.id}>
                <Link href={`/mappa?salvato=${p.id}`} data-testid="anno-preferito" className="flex min-h-14 items-center gap-3 px-4 py-2 active:bg-surface">
                  <span className={`w-4 shrink-0 font-display text-base font-bold ${i === 0 ? "text-accent" : "text-text-muted"}`}>{i + 1}</span>
                  <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-btn bg-accent-light text-xl">{getCategoryEmoji(p.category, p.name)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-display text-[15px] font-semibold text-text">{p.name}</span>
                    <span className="block truncate text-xs text-text-muted">
                      {[p.volte >= 2 ? `ci sei tornato ${p.volte - 1} ${p.volte === 2 ? "volta" : "volte"}` : null, categoryLabel(p.category)].filter(Boolean).join(" · ") || "Locale"}
                    </span>
                  </span>
                  <ChevronRight aria-hidden size={16} className="shrink-0 text-text-muted" />
                </Link>
              </li>
            ))}
          </ol>
        </section>
      )}

      {a.daProvare > 0 && (
        <Link href="/mappa?vista=salvati" data-testid="anno-da-provare" className="mt-4 flex min-h-14 items-center gap-3 rounded-card bg-accent-light px-4 py-3 active:opacity-80">
          <span aria-hidden className="text-xl">✨</span>
          <span className="min-w-0 flex-1">
            <span className="block font-display text-[15px] font-semibold text-text">Nel {anno + 1}: {plur(a.daProvare, "posto da provare", "posti da provare")}</span>
            <span className="block text-xs text-text-muted">Li hai già salvati tu</span>
          </span>
          <ChevronRight aria-hidden size={16} className="shrink-0 text-accent" />
        </Link>
      )}
    </div>
  );
}
