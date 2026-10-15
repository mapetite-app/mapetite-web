"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { getCategoryEmoji } from "@/lib/emoji";
import { updateTags } from "@/lib/raccolte-write";
import { withoutCollection } from "@/lib/raccolte";

// "Mettili in ordine" (piano 4.2): per i salvati senza raccolta l'AI propone dove metterli, solo
// tra le raccolte dell'utente e poche standard, guardando nome, tipo, città e verdetto già salvati.
// Niente si scrive finché l'utente non accetta (una proposta o tutte con un tocco).

type Row = { placeId: string; name: string; category?: string | null; tags: string[] };
type Proposta = { id: string; name: string; raccolte: string[] };
type Stato = "fermo" | "carico" | "pronto" | "errore";

export default function RaccolteProposte({
  userId,
  rows,
  onTags,
}: {
  userId: string;
  rows: Row[];
  onTags: (placeId: string, tags: string[]) => void;
}) {
  const [stato, setStato] = useState<Stato>("fermo");
  const [proposte, setProposte] = useState<Proposta[]>([]);
  const [fatti, setFatti] = useState<Set<string>>(new Set());
  const [esclusi, setEsclusi] = useState<string[]>([]);
  const [restanti, setRestanti] = useState(0);
  const [errore, setErrore] = useState<string | null>(null);
  const [scrivo, setScrivo] = useState(false);

  const senza = withoutCollection(rows).length;
  if (stato === "fermo" && senza === 0) return null;

  async function chiedi() {
    setStato("carico");
    setErrore(null);
    try {
      const res = await fetch("/api/raccolte/proposte", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ escludi: esclusi }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) {
        setErrore(data?.error ?? "Non sono riuscito a preparare le proposte: riprova tra poco.");
        setStato("errore");
        return;
      }
      setProposte((data.proposte ?? []) as Proposta[]);
      setEsclusi((prev) => [...prev, ...((data.esaminati ?? []) as string[])]);
      setRestanti(Number(data.restanti) || 0);
      setFatti(new Set());
      setStato("pronto");
    } catch {
      setErrore("Sei offline? Riprova quando torna la connessione.");
      setStato("errore");
    }
  }

  async function accetta(lista: Proposta[]) {
    const daFare = lista.filter((p) => !fatti.has(p.id));
    if (daFare.length === 0 || scrivo) return;
    setScrivo(true);
    setErrore(null);
    const byId = new Map(daFare.map((p) => [p.id, p.raccolte]));
    const targets = daFare.map((p) => ({ placeId: p.id, tags: rows.find((r) => r.placeId === p.id)?.tags ?? [] }));
    // Ogni locale ha le sue raccolte: una scrittura per locale (tag riletti prima, come sempre).
    for (const t of targets) {
      const add = byId.get(t.placeId) ?? [];
      const f = await updateTags(userId, [t], (tags) => [...tags, ...add.filter((a) => !tags.includes(a))], (placeId, tags) => {
        if (tags) {
          onTags(placeId, tags);
          setFatti((prev) => new Set(prev).add(placeId));
        }
      });
      if (f > 0) setErrore("Non sono riuscito a salvare alcune proposte: controlla la connessione e riprova.");
    }
    setScrivo(false);
  }

  const aperte = proposte.filter((p) => !fatti.has(p.id));
  const scarta = (id: string) => setProposte((prev) => prev.filter((p) => p.id !== id));

  return (
    <div data-testid="proposte-raccolte" className="mb-4 rounded-card border border-brand/15 bg-brand/[0.04] p-4">
      {stato !== "pronto" && (
        <>
          <p className="flex items-center gap-2 font-display text-[15px] font-semibold text-brand">
            <Sparkles size={18} aria-hidden className="shrink-0 text-accent" />
            {senza === 1 ? "1 salvato senza raccolta" : `${senza} salvati senza raccolta`}
          </p>
          <p className="mt-1 text-sm text-text-muted">
            Ti propongo dove metterli guardando solo quello che hai già salvato. Decidi tu cosa tenere.
          </p>
          {errore && <p role="alert" className="mt-2 text-sm text-error">{errore}</p>}
          <button
            type="button"
            data-testid="proponi-raccolte"
            onClick={() => void chiedi()}
            disabled={stato === "carico"}
            className="mt-3 inline-flex min-h-11 items-center rounded-pill bg-brand px-5 text-sm font-display font-semibold text-white active:scale-95 disabled:opacity-60"
          >
            {stato === "carico" ? "Leggo i tuoi salvati…" : "Proponi le raccolte"}
          </button>
        </>
      )}

      {stato === "pronto" && (
        <>
          <div className="flex items-center justify-between gap-2">
            <p className="flex min-w-0 items-center gap-2 font-display text-[15px] font-semibold text-brand">
              <Sparkles size={18} aria-hidden className="shrink-0 text-accent" />
              <span className="truncate">{proposte.length === 0 ? "Nessuna proposta sicura" : proposte.length === 1 ? "1 proposta" : `${proposte.length} proposte`}</span>
            </p>
            {aperte.length > 1 && (
              <button
                type="button"
                data-testid="accetta-tutte"
                disabled={scrivo}
                onClick={() => void accetta(aperte)}
                className="inline-flex min-h-10 shrink-0 items-center rounded-pill bg-brand px-4 text-sm font-display font-semibold text-white active:scale-95 disabled:opacity-60"
              >
                Accetta tutte
              </button>
            )}
          </div>
          {proposte.length === 0 && (
            <p className="mt-1 text-sm text-text-muted">Per questi locali non ci sono indizi chiari: meglio lasciarli come sono che metterli nella raccolta sbagliata.</p>
          )}
          <ul className="mt-3 space-y-2">
            {proposte.map((p) => {
              const row = rows.find((r) => r.placeId === p.id);
              const done = fatti.has(p.id);
              return (
                <li key={p.id} data-testid="proposta" className="flex items-center gap-3 rounded-card border border-border bg-white p-2.5">
                  <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-btn bg-accent-light text-xl">
                    {getCategoryEmoji(row?.category ?? null, p.name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-display text-sm font-semibold text-text">{p.name}</span>
                    <span className="mt-1 flex flex-wrap gap-1">
                      {p.raccolte.map((c) => (
                        <span key={c} className="max-w-full truncate whitespace-nowrap rounded-pill bg-accent-light px-2 py-0.5 text-[11px] font-display font-semibold text-accent">{c}</span>
                      ))}
                    </span>
                  </span>
                  {done ? (
                    <span className="shrink-0 text-sm font-display font-semibold text-success">✓ Fatto</span>
                  ) : (
                    <span className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        aria-label={`Scarta la proposta per ${p.name}`}
                        onClick={() => scarta(p.id)}
                        className="flex h-10 w-9 items-center justify-center text-lg text-text-muted active:scale-95"
                      >
                        ✕
                      </button>
                      <button
                        type="button"
                        data-testid="accetta-proposta"
                        disabled={scrivo}
                        onClick={() => void accetta([p])}
                        className="min-h-10 rounded-pill border border-brand px-3 text-sm font-display font-semibold text-brand active:scale-95 disabled:opacity-60"
                      >
                        Accetta
                      </button>
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
          {errore && <p role="alert" className="mt-2 text-sm text-error">{errore}</p>}
          {aperte.length === 0 && restanti > 0 && (
            <button
              type="button"
              data-testid="proponi-altri"
              onClick={() => void chiedi()}
              className="mt-3 inline-flex min-h-11 items-center rounded-pill border border-brand px-5 text-sm font-display font-semibold text-brand active:scale-95"
            >
              Proponi per altri {Math.min(restanti, 30)}
            </button>
          )}
        </>
      )}
    </div>
  );
}
