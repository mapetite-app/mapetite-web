"use client";

import { useState } from "react";
import Avatar from "@/components/avatar";
import { personName } from "@/lib/handle";
import { trackFeature } from "@/lib/track";
import { togliAmico } from "./actions";

// Amico con il profilo privato (da invito): nome sì, posti no. Un tocco apre "Togli dagli amici".
export default function AmicoPrivato({ amico }: { amico: { id: string; display_name: string | null; handle: string | null } }) {
  const [aperto, setAperto] = useState(false);
  const [stato, setStato] = useState<"idle" | "salvo" | "tolto">("idle");
  if (stato === "tolto") return null;
  const nome = personName(amico);
  return (
    <li data-testid="amico-privato" className="relative shrink-0">
      <button type="button" onClick={() => setAperto((v) => !v)} aria-expanded={aperto} className="flex w-16 flex-col items-center gap-1 text-center">
        <Avatar person={amico} size={52} />
        <span className="w-full truncate text-[11px] font-display text-text">{nome}</span>
        <span className="text-[10px] font-sans text-text-muted">Privato</span>
      </button>
      {aperto && (
        <div role="dialog" aria-label={`${nome}: amicizia`} className="absolute left-0 top-full z-20 mt-1 w-56 rounded-card border border-border bg-white p-3 text-left shadow-float">
          <p className="text-[13px] font-sans text-text-muted">Profilo privato: vedi il nome, non i posti.</p>
          <button
            type="button"
            data-testid="togli-amico"
            disabled={stato === "salvo"}
            onClick={async () => {
              setStato("salvo");
              const ok = await togliAmico(amico.id).catch(() => false);
              trackFeature("amico_tolto", { stato: ok ? "ok" : "errore" });
              setStato(ok ? "tolto" : "idle");
            }}
            className="mt-2 flex min-h-11 w-full items-center justify-center rounded-pill border border-border font-display text-sm font-semibold text-error disabled:opacity-60"
          >
            {stato === "salvo" ? "Un attimo…" : "Togli dagli amici"}
          </button>
        </div>
      )}
    </li>
  );
}
