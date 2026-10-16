"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus } from "lucide-react";
import { EMOJI_GRUPPO, MIO_NOME_MAX, NOME_MAX, gruppoPath, numeriGruppo, type Gruppo } from "@/lib/gruppi";
import { aggiungiPosto, creaGruppo } from "@/lib/gruppi-write";
import { trackFeature } from "@/lib/track";

const IDEE = [
  { nome: "Cene del giovedì", emoji: "🍽️" },
  { nome: "Aperitivo dopo il lavoro", emoji: "🍸" },
  { nome: "Pizza con gli amici", emoji: "🍕" },
];

export default function GruppiElenco({
  userId,
  gruppi,
  nomeIniziale,
  proponi,
}: {
  userId: string;
  gruppi: Gruppo[];
  nomeIniziale: string;
  proponi: { placeId: string; name: string | null } | null;
}) {
  const router = useRouter();
  const [aperto, setAperto] = useState(gruppi.length === 0 && !proponi);
  const [nome, setNome] = useState("");
  const [emoji, setEmoji] = useState<string>(EMOJI_GRUPPO[0]);
  const [mioNome, setMioNome] = useState(nomeIniziale);
  const [busy, setBusy] = useState<string | null>(null);
  const [errore, setErrore] = useState<string | null>(null);

  const crea = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !nome.trim() || !mioNome.trim()) return;
    setBusy("nuova");
    setErrore(null);
    const r = await creaGruppo(nome.trim().slice(0, NOME_MAX), emoji, mioNome.trim().slice(0, MIO_NOME_MAX));
    if (!r.ok) {
      setBusy(null);
      setErrore(r.errore);
      return;
    }
    trackFeature("gruppo_crea", proponi ? { fonte: "scheda" } : undefined);
    if (proponi) {
      const a = await aggiungiPosto(r.data.id, proponi.placeId, userId);
      if (a.ok) trackFeature("gruppo_aggiungi", { fonte: "scheda" });
    }
    router.push(`${gruppoPath(r.data.id)}?nuova=1`);
  };

  const proponiIn = async (g: Gruppo) => {
    if (!proponi || busy) return;
    setBusy(g.id);
    setErrore(null);
    const r = await aggiungiPosto(g.id, proponi.placeId, userId);
    if (!r.ok) {
      setBusy(null);
      setErrore(r.errore);
      return;
    }
    trackFeature("gruppo_aggiungi", { fonte: "scheda" });
    router.push(gruppoPath(g.id));
  };

  return (
    <div>
      {proponi && (
        <p data-testid="gruppi-proponi" className="mb-4 rounded-card bg-accent-light px-4 py-3 text-sm font-sans text-text">
          Scegli la lista in cui proporre{" "}
          <span className="font-display font-semibold">{proponi.name ?? "questo locale"}</span>
          {gruppi.length === 0 ? ", oppure creane una nuova." : "."}
        </p>
      )}

      {gruppi.length > 0 && (
        <ul className="flex flex-col gap-2" data-testid="gruppi-elenco">
          {gruppi.map((g) => {
            const inner = (
              <>
                <span aria-hidden className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent-light text-2xl">{g.emoji}</span>
                <span className="min-w-0 flex-1 text-left">
                  <span className="block truncate font-display text-base font-semibold text-text">{g.nome}</span>
                  <span className="mt-0.5 block text-sm text-text-muted">{numeriGruppo(g)}</span>
                </span>
                <span aria-hidden className="shrink-0 text-xl text-text-muted">
                  {proponi ? (busy === g.id ? "…" : "+") : "→"}
                </span>
              </>
            );
            const cls = "flex min-h-[72px] w-full items-center gap-4 rounded-card border border-border bg-surface px-4 py-3 active:scale-[0.99] transition-transform duration-150 disabled:opacity-70";
            return (
              <li key={g.id} data-testid="gruppo-riga">
                {proponi ? (
                  <button type="button" className={cls} onClick={() => proponiIn(g)} disabled={!!busy} aria-label={`Proponi in ${g.nome}`}>
                    {inner}
                  </button>
                ) : (
                  <Link href={gruppoPath(g.id)} className={cls}>
                    {inner}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {errore && !aperto && (
        <p role="alert" className="mt-3 text-sm font-sans text-error">{errore}</p>
      )}

      {!aperto ? (
        <button
          type="button"
          data-testid="nuova-lista"
          onClick={() => setAperto(true)}
          className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-pill border border-dashed border-brand/40 bg-white px-4 text-[15px] font-display font-semibold text-brand active:scale-[0.98]"
        >
          <Plus size={18} aria-hidden /> Nuova lista
        </button>
      ) : (
        <form onSubmit={crea} data-testid="nuova-lista-form" className="mt-4 rounded-card border border-border bg-white p-4 shadow-card">
          <p className="font-display text-base font-semibold text-brand">Nuova lista di gruppo</p>
          {gruppi.length === 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {IDEE.map((i) => (
                <button
                  key={i.nome}
                  type="button"
                  onClick={() => { setNome(i.nome); setEmoji(i.emoji); }}
                  className="min-h-9 rounded-pill bg-surface px-3 text-[13px] font-display font-medium text-brand active:scale-95"
                >
                  {i.emoji} {i.nome}
                </button>
              ))}
            </div>
          )}
          <label className="mt-3 block text-xs font-display font-semibold uppercase tracking-wide text-text-muted" htmlFor="gruppo-nome">Nome</label>
          <input
            id="gruppo-nome"
            value={nome}
            onChange={(e) => setNome(e.target.value.slice(0, NOME_MAX))}
            placeholder="Es. Cene del giovedì"
            className="mt-1 min-h-11 w-full rounded-btn border border-border bg-white px-3 text-base font-sans text-text outline-none focus:border-brand"
          />
          <div className="mt-3 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Simbolo della lista">
            {EMOJI_GRUPPO.map((e) => (
              <button
                key={e}
                type="button"
                role="radio"
                aria-checked={emoji === e}
                onClick={() => setEmoji(e)}
                className={`flex h-10 w-10 items-center justify-center rounded-full text-xl active:scale-95 ${emoji === e ? "bg-brand/10 ring-2 ring-brand" : "bg-surface"}`}
              >
                {e}
              </button>
            ))}
          </div>
          <label className="mt-3 block text-xs font-display font-semibold uppercase tracking-wide text-text-muted" htmlFor="gruppo-mio-nome">Il tuo nome nella lista</label>
          <input
            id="gruppo-mio-nome"
            value={mioNome}
            onChange={(e) => setMioNome(e.target.value.slice(0, MIO_NOME_MAX))}
            placeholder="Come ti chiamano gli amici"
            className="mt-1 min-h-11 w-full rounded-btn border border-border bg-white px-3 text-base font-sans text-text outline-none focus:border-brand"
          />
          {errore && <p role="alert" className="mt-2 text-sm font-sans text-error">{errore}</p>}
          <div className="mt-4 flex gap-2">
            {(gruppi.length > 0 || proponi) && (
              <button type="button" onClick={() => setAperto(false)} className="min-h-11 flex-1 rounded-pill border border-border bg-white px-4 text-sm font-display font-semibold text-brand">
                Annulla
              </button>
            )}
            <button
              type="submit"
              data-testid="crea-lista"
              disabled={!nome.trim() || !mioNome.trim() || busy === "nuova"}
              className="min-h-11 flex-1 rounded-pill bg-accent px-4 text-sm font-display font-semibold text-white disabled:opacity-50"
            >
              {busy === "nuova" ? "Creo…" : proponi ? "Crea e proponi" : "Crea la lista"}
            </button>
          </div>
        </form>
      )}

      {gruppi.length === 0 && !aperto && (
        <p className="mt-3 text-center text-sm text-text-muted">Non sei ancora in nessuna lista.</p>
      )}
    </div>
  );
}
