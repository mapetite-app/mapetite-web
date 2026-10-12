"use client";

import { useState } from "react";
import Link from "next/link";
import { saveNote, type LinkOutcome } from "@/lib/save-from-link";

// Esito di "Salva da Google Maps": una riga per link, con "Apri sulla mappa" e "Aggiungi nota".
export default function LinkResults({ results, userId }: { results: LinkOutcome[]; userId: string }) {
  return (
    <ul className="space-y-3" data-testid="link-esiti">
      {results.map((r, i) => (
        <li key={`${r.link}-${i}`}>
          {r.place && !r.error ? <SavedRow r={r} userId={userId} /> : <ErrorRow r={r} />}
        </li>
      ))}
    </ul>
  );
}

function SavedRow({ r, userId }: { r: LinkOutcome; userId: string }) {
  const place = r.place!;
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const submit = async () => {
    setState("saving");
    try {
      await saveNote(userId, place.id, note);
      setState("saved");
      setNoteOpen(false);
    } catch {
      setState("error");
    }
  };

  return (
    <div className="rounded-card border border-success/30 bg-success/10 p-4" data-testid="link-salvato">
      <p className="text-sm text-text">
        <span aria-hidden>✅ </span>
        {r.alreadySaved ? "Era già nei tuoi salvati: " : "Salvato in Mapetite: "}
        <span className="font-semibold">{place.name}</span>
      </p>
      {state === "saved" && <p className="mt-1 text-xs text-text-muted">Nota salvata.</p>}
      {noteOpen && (
        <div className="mt-3 space-y-2">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            maxLength={500}
            placeholder="Es. me l'ha consigliato Giulia, provare la carbonara"
            aria-label="Nota"
            className="w-full rounded-btn border border-border bg-white px-3 py-2 text-base focus:border-brand focus:outline-none"
          />
          {state === "error" && <p className="text-xs text-error">Nota non salvata. Riprova.</p>}
          <button
            type="button"
            onClick={submit}
            disabled={state === "saving"}
            className="min-h-11 rounded-pill bg-brand px-4 text-sm font-display font-semibold text-white disabled:opacity-60"
          >
            {state === "saving" ? "Salvo..." : "Salva nota"}
          </button>
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          href={`/mappa?salvato=${encodeURIComponent(place.id)}`}
          className="inline-flex min-h-11 items-center rounded-pill bg-brand px-4 text-sm font-display font-semibold text-white"
        >
          Apri sulla mappa
        </Link>
        {!r.alreadySaved && !noteOpen && state !== "saved" && (
          <button
            type="button"
            onClick={() => setNoteOpen(true)}
            className="min-h-11 rounded-pill border border-border bg-white px-4 text-sm font-medium text-text"
          >
            Aggiungi nota
          </button>
        )}
      </div>
    </div>
  );
}

function ErrorRow({ r }: { r: LinkOutcome }) {
  return (
    <div className="rounded-card bg-error/10 p-4 text-sm text-error" data-testid="link-errore">
      <p>{r.place ? `${r.place.name}: ` : ""}{r.error}</p>
      <p className="mt-1 break-all text-xs opacity-80">{r.link}</p>
    </div>
  );
}
