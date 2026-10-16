"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { MIO_NOME_MAX, gruppoPath } from "@/lib/gruppi";
import { entraGruppo } from "@/lib/gruppi-write";
import { trackFeature } from "@/lib/track";

// "Entra nella lista": il nome con cui si compare agli altri (lo sceglie la persona) e un tocco.
export default function EntraForm({ codice, nomeIniziale }: { codice: string; nomeIniziale: string }) {
  const router = useRouter();
  const [nome, setNome] = useState(nomeIniziale);
  const [busy, setBusy] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  const entra = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !nome.trim()) return;
    setBusy(true);
    setErrore(null);
    const r = await entraGruppo(codice, nome.trim().slice(0, MIO_NOME_MAX));
    if (!r.ok) {
      setBusy(false);
      setErrore(r.errore);
      return;
    }
    trackFeature("gruppo_entra");
    router.push(gruppoPath(r.data));
  };

  return (
    <form onSubmit={entra} data-testid="gruppo-entra-form">
      <label htmlFor="entra-nome" className="block text-xs font-display font-semibold uppercase tracking-wide text-text-muted">
        Il tuo nome nella lista
      </label>
      <input
        id="entra-nome"
        value={nome}
        onChange={(e) => setNome(e.target.value.slice(0, MIO_NOME_MAX))}
        placeholder="Come ti chiamano gli amici"
        className="mt-1 min-h-12 w-full rounded-btn border border-border bg-white px-3 text-base font-sans text-text outline-none focus:border-brand"
      />
      {errore && <p role="alert" className="mt-2 text-sm text-error">{errore}</p>}
      <button
        type="submit"
        data-testid="gruppo-entra"
        disabled={busy || !nome.trim()}
        className="mt-3 flex min-h-13 w-full items-center justify-center rounded-pill bg-accent px-6 py-3.5 font-display text-base font-semibold text-white shadow-float active:scale-[0.98] disabled:opacity-60"
      >
        {busy ? "Entro…" : "Entra nella lista"}
      </button>
    </form>
  );
}
