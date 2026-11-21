"use client";

import { useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Check, Send, X } from "lucide-react";
import CondividiLink from "@/components/condividi-link";
import { firmaPer } from "@/lib/catalog-firme";
import { trackFeature } from "@/lib/track";
import { withNext } from "@/lib/next-path";
import { scelteOra, type Scelta } from "@/lib/voto-gruppo";
import { ricordaVoto } from "@/lib/voto-gruppo-memoria";

// "Manda al gruppo" (proposta 56): dai tre di "Scegli tra 3" un link da mandare su WhatsApp. Chi lo apre
// vota con un tocco senza account. Qui si sceglie solo quando si chiude il voto; poi "Manda" apre il menu
// di condivisione del telefono (o copia il link). Nessuna chiamata a Google o all'AI.
// Da una raccolta (minori della 56) i posti possono essere più di 3: nel foglio si toccano i 2 o 3 da votare,
// già scelti i primi 3 ancora da provare.

export type PostoDaMandare = {
  id: string; name: string; category: string | null; address: string | null; lat: number | null; lng: number | null;
  verdict: string | null; photoRef: string | null; phone: string | null; websiteUri: string | null;
};

const subscribeNothing = () => () => {};

const MAX_SCELTI = 3;

function primiTre(tutti: PostoDaMandare[], provati?: string[]): string[] {
  const daProvare = tutti.filter((p) => !provati?.includes(p.id));
  return [...daProvare, ...tutti.filter((p) => provati?.includes(p.id))].slice(0, MAX_SCELTI).map((p) => p.id);
}

export default function MandaAlGruppo({ posti: tutti, toccoClass, pillolaClass, da = "mappa", provati, accediDa = "/mappa" }: {
  posti: PostoDaMandare[]; toccoClass: string; pillolaClass: string;
  // Da dove si manda (per i numeri) e i posti già provati (si propongono per ultimi).
  da?: "mappa" | "raccolta"; provati?: string[]; accediDa?: string;
}) {
  const scegliere = tutti.length > MAX_SCELTI;
  const [scelti, setScelti] = useState<string[]>(() => primiTre(tutti, provati));
  const posti = scegliere ? tutti.filter((p) => scelti.includes(p.id)) : tutti;
  const mounted = useSyncExternalStore(subscribeNothing, () => true, () => false);
  const [aperto, setAperto] = useState(false);
  const [{ scelte, predefinita }, setOrari] = useState(() => scelteOra());
  const [scelta, setScelta] = useState<Scelta>(predefinita);
  const [stato, setStato] = useState<{ fase: "pronto" } | { fase: "invio" } | { fase: "fatto"; path: string } | { fase: "errore"; msg: string; accedi?: boolean }>({ fase: "pronto" });
  // Il link vale per questi posti: con altri tre (filtro cambiato) si ricomincia.
  const chiave = tutti.map((p) => p.id).join(",");
  const [perChiave, setPerChiave] = useState(chiave);
  if (perChiave !== chiave) { setPerChiave(chiave); setStato({ fase: "pronto" }); setScelti(primiTre(tutti, provati)); }
  const tocca = (id: string) => {
    if (stato.fase === "invio") return;
    setStato({ fase: "pronto" }); // con altri posti il link di prima non vale più
    setScelti((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length >= MAX_SCELTI ? s : [...s, id]));
  };
  const pochi = posti.length < 2;

  const apri = () => {
    const o = scelteOra();
    setOrari(o);
    if (!o.scelte.some((s) => s.id === scelta)) setScelta(o.predefinita);
    setAperto(true);
    trackFeature("manda_gruppo_apri", { posti: tutti.length, da });
  };

  const crea = async () => {
    setStato({ fase: "invio" });
    try {
      const res = await fetch("/api/voto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scelta,
          posti: posti.map((p) => ({ id: p.id, firma: firmaPer(p.id), nome: p.name, categoria: p.category, indirizzo: p.address, lat: p.lat, lng: p.lng, verdetto: p.verdict })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || typeof data?.codice !== "string") {
        setStato({ fase: "errore", msg: typeof data?.error === "string" ? data.error : "Non sono riuscito a creare il link. Riprova.", accedi: res.status === 401 });
        return;
      }
      const uuidDi = new Map<string, string>((Array.isArray(data.posti) ? data.posti : []).map((x: { id: string; uuid: string }) => [x.id, x.uuid]));
      ricordaVoto(data.codice, posti.flatMap((p) => (uuidDi.has(p.id) ? [{ uuid: uuidDi.get(p.id)!, gid: /^[0-9a-f-]{36}$/i.test(p.id) ? null : p.id, nome: p.name, phone: p.phone, websiteUri: p.websiteUri, lat: p.lat, lng: p.lng }] : [])));
      // Le foto viaggiano nel link (mai salvate da noi): la pagina le accetta solo se sono di quei posti.
      const f = posti.flatMap((p) => (p.photoRef && uuidDi.has(p.id) ? [`f=${encodeURIComponent(p.photoRef)}`] : []));
      setStato({ fase: "fatto", path: `/voto/${data.codice}${f.length ? `?${f.join("&")}` : ""}` });
      trackFeature("manda_gruppo", { posti: posti.length, scelta, da });
    } catch {
      setStato({ fase: "errore", msg: "Sei offline? Riprova tra poco." });
    }
  };

  const foglio = aperto && mounted && createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center" role="dialog" aria-modal="true" aria-labelledby="manda-gruppo-titolo" data-testid="manda-gruppo-foglio">
      <button type="button" aria-label="Chiudi" className="absolute inset-0 bg-black/40" onClick={() => setAperto(false)} />
      <div className="relative w-full max-w-md rounded-t-[1.75rem] bg-bg px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-4 shadow-float">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="manda-gruppo-titolo" className="font-title text-xl font-semibold text-brand">Manda al gruppo</h2>
            <p className="mt-0.5 text-sm font-sans text-text-muted">Votano con un tocco, senza app.</p>
          </div>
          <button type="button" onClick={() => setAperto(false)} aria-label="Chiudi" className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-text-muted active:bg-surface">
            <X size={20} aria-hidden />
          </button>
        </div>
        {scegliere && stato.fase !== "fatto" ? (
          <>
            <p className="mt-4 text-xs font-display font-semibold uppercase tracking-wide text-text-muted">
              Scegline 2 o 3 · <span data-testid="manda-gruppo-scelti">{posti.length} di {MAX_SCELTI}</span>
            </p>
            <ul className="mt-1 max-h-[38dvh] overflow-y-auto" aria-label="Posti da votare">
              {tutti.map((p) => {
                const on = scelti.includes(p.id);
                const pieno = !on && scelti.length >= MAX_SCELTI;
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={on}
                      aria-disabled={pieno}
                      data-testid="manda-gruppo-posto"
                      onClick={() => tocca(p.id)}
                      className={`flex min-h-11 w-full items-center gap-3 py-1 text-left text-[15px] font-sans text-text ${pieno ? "opacity-45" : ""}`}
                    >
                      <span aria-hidden className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${on ? "border-brand bg-brand text-white" : "border-border"}`}>
                        {on && <Check size={14} strokeWidth={3} />}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{p.name}</span>
                      {provati?.includes(p.id) && <span className="shrink-0 text-xs font-sans text-text-muted">Provato</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        ) : (
        <ol className="mt-3 space-y-1">
          {posti.map((p, i) => (
            <li key={p.id} className="flex items-center gap-2 text-[15px] font-sans text-text">
              <span aria-hidden className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-display font-semibold text-white">{i + 1}</span>
              <span className="truncate">{p.name}</span>
            </li>
          ))}
        </ol>
        )}
        {stato.fase !== "fatto" ? (
          <>
            <p className="mt-4 text-xs font-display font-semibold uppercase tracking-wide text-text-muted">Si chiude</p>
            <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label="Quando si chiude il voto">
              {scelte.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  role="radio"
                  aria-checked={scelta === s.id}
                  data-testid="manda-gruppo-ora"
                  onClick={() => setScelta(s.id)}
                  className={`min-h-11 rounded-pill px-4 text-sm font-display font-semibold active:scale-95 ${scelta === s.id ? "bg-brand text-white" : "bg-surface text-brand"}`}
                >
                  {s.label}
                </button>
              ))}
            </div>
            {stato.fase === "errore" && (
              <p role="alert" data-testid="manda-gruppo-errore" className="mt-3 text-sm font-sans text-error">
                {stato.msg}{" "}
                {stato.accedi && <Link href={withNext("/login", accediDa)} className="font-display font-semibold text-brand underline underline-offset-2">Accedi</Link>}
              </p>
            )}
            <button
              type="button"
              data-testid="manda-gruppo-crea"
              onClick={() => void crea()}
              disabled={stato.fase === "invio" || pochi}
              className="mt-4 flex min-h-13 w-full items-center justify-center gap-2 rounded-pill bg-accent px-6 font-display text-base font-semibold text-white shadow-float active:scale-[0.98] disabled:opacity-70"
            >
              {stato.fase === "invio" ? "Preparo il link…" : pochi ? "Scegline almeno 2" : "Crea il link"}
            </button>
          </>
        ) : (
          <>
            <p data-testid="manda-gruppo-pronto" className="mt-4 text-sm font-sans text-text">Link pronto. Quando si chiude vedi chi ha vinto e prenoti.</p>
            <CondividiLink path={stato.path} cosa="voto" title="Dove andiamo? Vota" text="Dove andiamo? Tocca il posto che preferisci:" label="Manda" variant="solid" testId="manda-gruppo-manda" className="mt-3 !min-h-13 w-full !text-base" />
            <Link href={stato.path} data-testid="manda-gruppo-vedi" className="mt-1 flex min-h-11 items-center justify-center text-sm font-display font-semibold text-brand">Apri il voto</Link>
          </>
        )}
      </div>
    </div>,
    document.body,
  );

  return (
    <>
      <button type="button" data-testid="manda-gruppo" onClick={apri} aria-label={scegliere ? "Manda al gruppo: scegli 2 o 3 posti da votare" : `Manda al gruppo i ${posti.length} posti da votare`} className={toccoClass}>
        {/* Come "Scegli tra 3": pillola chiara con l'icona corallo (una sola azione forte per schermo, DESIGN.md). */}
        <span className={`${pillolaClass} gap-1.5 font-semibold bg-surface text-brand`}>
          <Send size={13} aria-hidden className="shrink-0 text-accent" />Manda al gruppo
        </span>
      </button>
      {foglio}
    </>
  );
}
