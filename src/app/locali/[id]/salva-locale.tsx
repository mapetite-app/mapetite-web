"use client";

import Link from "next/link";
import { useState } from "react";
import { browserClient } from "@/lib/supabase/client-lazy";
import { withNext } from "@/lib/next-path";

// Invito per chi ha ricevuto il link: salvarlo in Mapetite ("📌 Voglio andarci", tag "Da provare",
// lo stesso dei salvataggi da link e dalla scheda) oppure scoprire l'app.
// Il pulsante principale sta in una barra flottante in fondo (come la scheda B): sempre in vista.
const WANT_TAG = "Da provare";

const PRIMARY =
  "inline-flex min-h-12 w-full items-center justify-center rounded-pill bg-accent px-5 text-[15px] font-display font-semibold text-white shadow-float active:scale-95 disabled:opacity-70";

// Chi non ha l'accesso va a login/registrazione con `returnPath`: finito (anche l'onboarding)
// torna qui con "salva=1" e trova il pulsante evidenziato (`highlight`). Il salvataggio
// parte SOLO dal suo tocco: nessuna scrittura automatica.
export default function SalvaLocale({
  placeId,
  placeName,
  userId,
  returnPath,
  highlight = false,
}: {
  placeId: string;
  placeName: string;
  userId: string | null;
  returnPath: string;
  highlight?: boolean;
}) {
  const [state, setState] = useState<"idle" | "saving" | "saved" | "already" | "error">("idle");

  const save = async () => {
    if (!userId || state === "saving") return;
    setState("saving");
    // Senza rete il codice di Supabase potrebbe non essere ancora scaricato: errore, non pulsante bloccato.
    const client = await browserClient().catch(() => null);
    if (!client) { setState("error"); return; }
    const { error } = await client
      .from("saved_places")
      .insert({ user_id: userId, place_id: placeId, tags: [WANT_TAG], note: null });
    if (error && error.code === "23505") setState("already");
    else if (error) setState("error");
    else setState("saved");
  };

  const done = state === "saved" || state === "already";

  return (
    <>
      {/* Solo per chi non ha l'accesso: chi è già dentro Mapetite ha il pulsante qui sotto e basta
          (Lorenzo 17/10, una cosa principale). "Scopri Mapetite" era un doppione del marchio in alto. */}
      {!userId && (
        <section data-testid="invito-mapetite" className="mx-5 mt-6 rounded-card border border-border bg-surface p-4">
          <p className="font-display text-base font-semibold text-brand">Ti hanno consigliato {placeName}?</p>
          <p data-testid="invito-accedi" className="mt-1 text-sm font-sans text-text-muted">
            Salvalo in Mapetite e lo ritrovi sulla tua mappa quando devi scegliere.{" "}
            <Link href={withNext("/login", returnPath)} className="font-display font-semibold text-brand">Hai già un account? Accedi</Link>
          </p>
        </section>
      )}

      <div className="sticky bottom-[calc(var(--nav-height-mobile)+var(--nav-sporgenza)+0.5rem)] z-10 mt-6 px-5">
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
          <>
            {highlight && (
              <p data-testid="salva-evidenziato" className="mb-2 rounded-card bg-brand px-4 py-2.5 text-center text-sm font-display font-semibold text-white shadow-float">
                Ci sei! Tocca qui sotto per salvarlo nella tua mappa.
              </p>
            )}
            <button
              type="button"
              onClick={save}
              disabled={state === "saving"}
              className={`${PRIMARY}${highlight ? " ring-4 ring-accent/35 ring-offset-2 ring-offset-bg" : ""}`}
            >
              {state === "saving" ? "Salvo…" : "📌 Salva in Mapetite"}
            </button>
          </>
        ) : (
          <Link href={withNext("/signup", returnPath)} className={PRIMARY}>
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
