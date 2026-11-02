import Link from "next/link";
import Avatar from "@/components/avatar";
import TracciaFunzione from "@/components/traccia-funzione";
import { personName, profilePath } from "@/lib/handle";
import { livelloScopritore, punti } from "@/lib/scopritori";
import type { ScopritoreRow } from "@/lib/social";

// Scopritori tra i tuoi amici (piano 5.6): piccola classifica fra chi segui (solo profili
// pubblici, vista scopritori_pubblici) e te. Gioco leggero: al massimo 5 righe, niente
// "ultimi posti", e conta solo chi ha salvato almeno un posto 💎 poco conosciuto.
type Riga = { id: string; nome: string; handle: string | null; display_name: string | null; gemme: number; provate: number; tu: boolean };

export default function ScopritoriAmici({ amici, mie, viewer }: { amici: ScopritoreRow[]; mie: { gemme: number; provate: number } | null; viewer: string }) {
  const righe: Riga[] = amici
    .filter((a) => a.gemme > 0 && a.id !== viewer)
    .map((a) => ({ id: a.id, nome: personName(a), handle: a.handle, display_name: a.display_name, gemme: a.gemme, provate: a.gemme_provate, tu: false }));
  if (righe.length === 0) return null;
  if (mie) righe.push({ id: viewer, nome: "Tu", handle: null, display_name: "Tu", gemme: mie.gemme, provate: mie.provate, tu: true });
  righe.sort((a, b) => punti({ gemme: b.gemme, provate: b.provate }) - punti({ gemme: a.gemme, provate: a.provate }) || Number(b.tu) - Number(a.tu));
  const top = righe.slice(0, 5);
  // Se non sei tra i primi 5 compari comunque in fondo: è il tuo gioco.
  const me = righe.find((r) => r.tu);
  if (me && !top.includes(me)) top.push(me);

  return (
    <section className="mt-6" aria-labelledby="scopritori-titolo" data-testid="scopritori-amici">
      <TracciaFunzione nome="scopritori_amici_vista" />
      <h2 id="scopritori-titolo" className="font-display text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">💎 Scopritori tra i tuoi amici</h2>
      <p className="mt-0.5 text-xs text-text-muted">Chi trova più posti poco conosciuti. Provarli vale doppio.</p>
      <ol className="mt-2 divide-y divide-border rounded-card border border-border bg-white">
        {top.map((r) => {
          const l = livelloScopritore({ gemme: r.gemme, provate: r.provate });
          const pos = righe.indexOf(r) + 1;
          const body = (
            <>
              <span className="w-5 shrink-0 text-center font-display text-sm font-semibold text-text-muted">{pos}</span>
              <Avatar person={r} size={32} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-display text-sm font-semibold text-text">{r.nome}</span>
                <span className="block truncate text-xs text-text-muted">{l.livello > 0 ? l.nome : "Ancora nessuna gemma"}</span>
              </span>
              <span className="shrink-0 font-display text-sm font-semibold text-accent">💎 {r.gemme}</span>
            </>
          );
          return (
            <li key={r.id} data-testid="scopritore-amico" className={r.tu ? "bg-surface" : undefined}>
              <Link href={r.tu || !r.handle ? "/profilo" : profilePath(r.handle)} className="flex min-h-12 items-center gap-3 px-3 py-2">{body}</Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
