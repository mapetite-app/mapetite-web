"use client";

import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Invito per chi ha ricevuto il link: salvarlo in Mapetite ("📌 Voglio andarci", tag "Da provare",
// lo stesso dei salvataggi da link e dalla scheda) oppure scoprire l'app.
const WANT_TAG = "Da provare";

export default function SalvaLocale({ placeId, placeName, userId }: { placeId: string; placeName: string; userId: string | null }) {
  const [state, setState] = useState<"idle" | "saving" | "saved" | "already" | "error">("idle");

  const save = async () => {
    if (!userId || state === "saving") return;
    setState("saving");
    const { error } = await createClient()
      .from("saved_places")
      .insert({ user_id: userId, place_id: placeId, tags: [WANT_TAG], note: null });
    if (error && error.code === "23505") setState("already");
    else if (error) setState("error");
    else setState("saved");
  };

  const done = state === "saved" || state === "already";

  return (
    <section data-testid="invito-mapetite" className="mx-5 mt-6 rounded-card border border-border bg-surface p-5">
      <p className="font-display text-base font-semibold text-brand">Ti hanno consigliato {placeName}?</p>
      <p className="mt-1 text-sm font-sans text-text-muted">
        Salvalo in Mapetite: lo ritrovi sulla tua mappa quando devi scegliere dove andare.
      </p>

      {done ? (
        <div role="status" data-testid="salvato-pubblico" className="mt-4 flex flex-col gap-2">
          <p className="text-sm font-display font-semibold text-success">
            {state === "saved" ? "✓ Salvato tra i tuoi “Voglio andarci”" : "✓ È già tra i tuoi salvati"}
          </p>
          <Link
            href={`/mappa?salvato=${placeId}`}
            className="inline-flex min-h-11 items-center justify-center rounded-pill bg-brand px-5 text-sm font-display font-semibold text-white"
          >
            Aprilo sulla tua mappa
          </Link>
        </div>
      ) : userId ? (
        <button
          type="button"
          onClick={save}
          disabled={state === "saving"}
          className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-pill bg-accent px-5 text-sm font-display font-semibold text-white active:scale-95 disabled:opacity-70"
        >
          {state === "saving" ? "Salvo…" : "📌 Salva in Mapetite"}
        </button>
      ) : (
        <>
          <Link
            href="/signup"
            className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-pill bg-accent px-5 text-sm font-display font-semibold text-white active:scale-95"
          >
            📌 Salva in Mapetite
          </Link>
          <p data-testid="invito-accedi" className="mt-2 text-xs font-sans text-text-muted">
            Crea un account gratis, poi riapri questo link e salvalo con un tocco.{" "}
            <Link href="/login" className="font-display font-semibold text-brand">Hai già un account? Accedi</Link>
          </p>
        </>
      )}
      {state === "error" && (
        <p role="alert" className="mt-2 text-xs font-sans text-error">Non sono riuscito a salvarlo. Riprova.</p>
      )}

      <Link
        href="/"
        className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-pill border border-border bg-white px-5 text-sm font-display font-semibold text-brand"
      >
        Scopri Mapetite
      </Link>
    </section>
  );
}
