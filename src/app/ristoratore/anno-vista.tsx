import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import CartaGustoCondividi from "@/components/carta-gusto-condividi";
import TracciaFunzione from "@/components/traccia-funzione";
import { MESI_CORTI } from "@/lib/anno-tavola";
import { numeriAnnoLocale, righeAnnoLocale, titoloAnno, type AnnoLocale } from "@/lib/ristoratore-anno";
import { SOGLIA } from "@/lib/ristoratore";

// "Il vostro anno su Mapetite" (proposta 87): una cosa principale, la card dell'anno da condividere. Stessa
// grafica di "Il tuo anno a tavola" (proposta 49), con i numeri del locale: solo conteggi da 3 persone in su.
export default function AnnoVista({ nome, a, base, demo = false }: { nome: string; a: AnnoLocale; base: string; demo?: boolean }) {
  const titolo = titoloAnno(a);
  const numeri = numeriAnnoLocale(a);
  const righe = righeAnnoLocale(a);
  const maxMese = Math.max(1, ...a.mesi);
  const barre = a.barre;

  return (
    <div className="mx-auto max-w-md px-4 pb-10 pt-4">
      <TracciaFunzione nome="anno_locale_vista" contesto={demo ? "esempio" : titolo ? "piena" : "pochi"} />
      <Link href={base} className="-ml-2 inline-flex min-h-11 items-center gap-1 px-2 text-sm font-display font-semibold text-brand">
        <ChevronLeft size={18} aria-hidden /> Pannello
      </Link>
      {demo && (
        <p data-testid="anno-locale-esempio" className="mb-2 rounded-pill bg-accent-light px-3 py-1 text-center text-xs font-display font-semibold text-accent">
          Esempio dimostrativo: numeri inventati
        </p>
      )}

      {!titolo ? (
        <div data-testid="anno-locale-pochi" className="mt-2 rounded-[28px] bg-brand px-6 py-10 text-center text-white shadow-float">
          <p className="font-display text-sm text-white/70">Il vostro {a.anno} su Mapetite</p>
          <p className="mt-2 font-title text-[28px] leading-tight">Ancora pochi numeri</p>
          <p className="mx-auto mt-3 max-w-xs text-sm text-white/80">
            Scriviamo i numeri solo da {SOGLIA} persone in su, così nessuno si riconosce. Tornate qui quando vi avranno salvato più persone.
          </p>
        </div>
      ) : (
        <>
          <article data-testid="anno-locale-card" aria-label={`Il vostro ${a.anno} su Mapetite`} className="mt-2 overflow-hidden rounded-[28px] bg-brand px-6 pb-6 pt-7 text-white shadow-float">
            <div className="flex items-center gap-2">
              <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-accent" />
              <span className="font-display text-sm font-bold">Mapetite</span>
            </div>
            <p className="mt-6 truncate font-display text-sm text-white/70">{nome} · {a.anno}</p>
            <h1 data-testid="anno-locale-titolo" className="mt-1 font-title leading-none text-accent">
              <span className="block text-[64px] font-semibold tracking-tight">{titolo.numero.toLocaleString("it-IT")}</span>
              <span className="mt-1 block text-[24px] leading-tight">{titolo.testo}</span>
            </h1>

            {numeri.length > 0 && (
              <div data-testid="anno-locale-numeri" className={`mt-5 grid gap-2 ${numeri.length === 3 ? "grid-cols-3" : numeri.length === 2 ? "grid-cols-2" : "grid-cols-1"}`}>
                {numeri.map((s) => (
                  <p key={s.label} className="rounded-2xl bg-white/[0.08] px-3 py-3">
                    <span className="block whitespace-nowrap font-display text-2xl font-bold leading-none">{s.value}</span>
                    <span className="mt-1 block text-[11px] leading-tight text-white/70">{s.label}</span>
                  </p>
                ))}
              </div>
            )}

            {righe.length > 0 && (
              <dl data-testid="anno-locale-righe" className="mt-5 space-y-2.5">
                {righe.map((r) => (
                  <div key={r.k} className="flex items-baseline justify-between gap-3 border-b border-white/10 pb-2 last:border-0 last:pb-0">
                    <dt className="shrink-0 text-xs text-white/65">{r.label}</dt>
                    <dd className="min-w-0 truncate text-right font-display text-sm font-semibold">{r.value}</dd>
                  </div>
                ))}
              </dl>
            )}

            {barre && (
              <figure data-testid="anno-locale-mesi" className="mt-5" aria-label="Salvataggi mese per mese">
                <div className="flex h-14 items-end gap-1">
                  {a.mesi.map((n, i) => (
                    <span key={i} className={`flex-1 rounded-[3px] ${a.mese && n === maxMese ? "bg-accent" : n > 0 ? "bg-white/55" : "bg-white/10"}`} style={{ height: n > 0 ? `${Math.max(12, Math.round((n / maxMese) * 100))}%` : "6%" }} />
                  ))}
                </div>
                <div className="mt-1 flex gap-1">
                  {MESI_CORTI.map((m, i) => <span key={i} className="flex-1 text-center text-[10px] text-white/55">{m}</span>)}
                </div>
              </figure>
            )}
          </article>

          <CartaGustoCondividi url={`${base}/anno/immagine`} fileName={`il-nostro-${a.anno}-su-mapetite.png`} text={`Il nostro ${a.anno} su Mapetite`} evento="anno_locale_condividi" />
          <p className="text-center text-[11px] text-text-muted">Per le storie di Instagram. Solo numeri da {SOGLIA} persone in su: nessun nome, né vostro né dei clienti.</p>
        </>
      )}
    </div>
  );
}
