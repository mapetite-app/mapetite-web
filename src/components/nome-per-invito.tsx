"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { salvaNome } from "@/app/amici/actions";

// Prima del link d'invito, il nome (revisore 14/11): chi riceve il link deve sapere chi lo invita.
// Il nome non rende pubblico il profilo: lo vede solo chi ha il tuo link e i tuoi amici.
export default function NomePerInvito({ chiaro = false }: { chiaro?: boolean }) {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [stato, setStato] = useState<"idle" | "salvo" | "errore">("idle");
  return (
    <form
      data-testid="nome-per-invito"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!nome.trim()) return;
        setStato("salvo");
        const ok = await salvaNome(nome).catch(() => false);
        if (!ok) { setStato("errore"); return; }
        router.refresh();
      }}
      className="relative mt-3"
    >
      <p className={`text-[13px] font-sans ${chiaro ? "text-text-muted" : "text-white/85"}`}>Prima il tuo nome: chi riceve il link deve sapere chi lo invita.</p>
      <div className="mt-2 flex gap-2">
        <input
          data-testid="nome-per-invito-campo"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          maxLength={40}
          autoComplete="name"
          placeholder="es. Giulia Rossi"
          aria-label="Il tuo nome"
          className="min-h-11 min-w-0 flex-1 rounded-pill border-0 bg-white px-4 text-[16px] font-sans text-text outline-none placeholder:text-text-muted"
        />
        <button type="submit" disabled={!nome.trim() || stato === "salvo"} className="inline-flex min-h-11 shrink-0 items-center rounded-pill bg-accent px-4 font-display text-sm font-semibold text-white disabled:opacity-60">
          {stato === "salvo" ? "…" : "Crea il link"}
        </button>
      </div>
      {stato === "errore" && <p role="alert" className={`mt-1 text-xs ${chiaro ? "text-error" : "text-white"}`}>Non sono riuscito a salvare. Riprova.</p>}
    </form>
  );
}
