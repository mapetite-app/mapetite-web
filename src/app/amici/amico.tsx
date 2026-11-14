"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Avatar from "@/components/avatar";
import { personName, profilePath } from "@/lib/handle";
import { trackFeature } from "@/lib/track";
import { togliAmico } from "./actions";

// Un amico (vi seguite a vicenda) nella riga in cima ad Amici. Un tocco apre un foglio dal basso, come Places:
// "Apri il profilo" se è pubblico, "Togli dagli amici" in rosso (toglie i due "segui") e "Annulla".
// Revisore 14/11 (terzo giro): prima era un riquadro sotto l'avatar, tagliato dalla riga che scorre di lato,
// e solo per gli amici con il profilo privato.
type Amico = { id: string; display_name: string | null; handle: string | null; is_public: boolean };

export default function AmicoRiga({ amico }: { amico: Amico }) {
  const [aperto, setAperto] = useState(false);
  const [stato, setStato] = useState<"idle" | "salvo" | "tolto" | "errore">("idle");
  const nome = personName(amico);
  const pubblico = amico.is_public && !!amico.handle;

  useEffect(() => {
    if (!aperto) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setAperto(false); };
    window.addEventListener("keydown", esc);
    const prima = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", esc); document.body.style.overflow = prima; };
  }, [aperto]);

  if (stato === "tolto") return null;
  const chiudi = () => { if (stato !== "salvo") setAperto(false); };

  return (
    <li data-testid="amico" data-privato={pubblico ? undefined : "1"} className="shrink-0">
      <button type="button" onClick={() => setAperto(true)} aria-haspopup="dialog" aria-expanded={aperto} className="flex w-16 flex-col items-center gap-1 text-center">
        <Avatar person={amico} size={52} />
        <span className="w-full truncate text-[11px] font-display text-text">{nome}</span>
        {!pubblico && <span className="text-[10px] font-sans text-text-muted">Privato</span>}
      </button>
      {aperto && createPortal(
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40" onClick={chiudi}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`${nome}: amicizia`}
            data-testid="amico-foglio"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-t-[1.5rem] bg-bg px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 shadow-float"
          >
            <div aria-hidden className="mx-auto mb-3 h-1 w-10 rounded-full bg-border" />
            <div className="flex items-center gap-3">
              <Avatar person={amico} size={48} />
              <div className="min-w-0">
                <p className="truncate font-display text-[17px] font-semibold text-text">{nome}</p>
                <p className="text-[13px] font-sans text-text-muted">{pubblico ? "Vi seguite a vicenda." : "Profilo privato: vedi il nome, non i posti."}</p>
              </div>
            </div>
            <div className="mt-4 flex flex-col gap-2">
              {pubblico && (
                <Link href={profilePath(amico.handle!)} data-testid="amico-profilo" className="flex min-h-12 items-center justify-center rounded-pill bg-brand font-display text-[15px] font-semibold text-white">
                  Apri il profilo
                </Link>
              )}
              {/* Revisore 14/11 (quarto giro): lo si dice prima. accetta_invito risponde "gia-usato" alla coppia tolta. */}
              <p data-testid="togli-avviso" className="mt-1 text-center text-[13px] font-sans text-text-muted">Non potrete tornare amici con un invito.</p>
              <button
                type="button"
                data-testid="togli-amico"
                disabled={stato === "salvo"}
                onClick={async () => {
                  setStato("salvo");
                  const ok = await togliAmico(amico.id).catch(() => false);
                  trackFeature("amico_tolto", { stato: ok ? "ok" : "errore" });
                  if (!ok) { setStato("errore"); return; }
                  setStato("tolto");
                  setAperto(false);
                }}
                className="flex min-h-12 items-center justify-center rounded-pill border border-border bg-white font-display text-[15px] font-semibold text-error disabled:opacity-60"
              >
                {stato === "salvo" ? "Un attimo…" : "Togli dagli amici"}
              </button>
              <button type="button" data-testid="togli-annulla" onClick={chiudi} className="flex min-h-12 items-center justify-center font-display text-[15px] font-semibold text-text-muted">
                Annulla
              </button>
            </div>
            {stato === "errore" && <p role="alert" className="mt-1 text-center text-sm text-error">Non ci sono riuscito: riprova.</p>}
          </div>
        </div>,
        document.body,
      )}
    </li>
  );
}
