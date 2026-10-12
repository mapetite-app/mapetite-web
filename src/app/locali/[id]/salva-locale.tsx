"use client";

import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Invito per chi ha ricevuto il link: salvarlo in Mapetite ("📌 Voglio andarci", tag "Da provare",
// lo stesso dei salvataggi da link e dalla scheda) oppure scoprire l'app.
// Il pulsante principale sta in una barra flottante in fondo (come la scheda B): sempre in vista.
const WANT_TAG = "Da provare";

const PRIMARY =
  "inline-flex min-h-12 w-full items-center justify-center rounded-pill bg-accent px-5 text-[15px] font-display font-semibold text-white shadow-float active:scale-95 disabled:opacity-70";

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
    <>
      <section data-testid="invito-mapetite" className="mx-5 mt-6 rounded-card border border-border bg-surface p-5">
        <p className="font-display text-base font-semibold text-brand">Ti hanno consigliato {placeName}?</p>
        <p className="mt-1 text-sm font-sans text-text-muted">
          Salvalo in Mapetite: lo ritrovi sulla tua mappa quando devi scegliere dove andare.
        </p>
        {!userId && (
          <p data-testid="invito-accedi" className="mt-2 text-sm font-sans text-text-muted">
            Crea un account gratis, poi riapri questo link e salvalo con un tocco.{" "}
            <Link href="/login" className="font-display font-semibold text-brand">Hai già un account? Accedi</Link>
          </p>
        )}
        <Link
          href="/"
          className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-pill border border-border bg-white px-5 text-sm font-display font-semibold text-brand"
        >
          Scopri Mapetite
        </Link>
      </section>

      <div className="sticky bottom-[calc(var(--nav-height-mobile)+0.75rem)] z-10 mt-6 px-5">
        {done ? (
          <div role="status" data-testid="salvato-pubblico" className="flex flex-col gap-2 rounded-card bg-brand p-3 shadow-float">
            <p className="text-center text-sm font-display font-semibold text-white">
              {state === "saved" ? "✓ Salvato tra i tuoi “Voglio andarci”" : "✓ È già tra i tuoi salvati"}
            </p>
            <Link
              href={`/mappa?salvato=${placeId}`}
              className="inline-flex min-h-11 items-center justify-center rounded-pill bg-white px-5 text-sm font-display font-semibold text-brand"
            >
              Aprilo sulla tua mappa
            </Link>
          </div>
        ) : userId ? (
          <button type="button" onClick={save} disabled={state === "saving"} className={PRIMARY}>
            {state === "saving" ? "Salvo…" : "📌 Salva in Mapetite"}
          </button>
        ) : (
          <Link href="/signup" className={PRIMARY}>
            📌 Salva in Mapetite
          </Link>
        )}
        {state === "error" && (
          <p role="alert" className="mt-2 rounded-pill bg-surface px-3 py-1 text-center text-xs font-sans text-error shadow-card">
            Non sono riuscito a salvarlo. Riprova.
          </p>
        )}
      </div>
    </>
  );
}
