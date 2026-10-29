"use client";

import { ChevronRight, LogOut, MessageCircle } from "lucide-react";
import { logout } from "@/lib/supabase/actions";
import { FEEDBACK_EMAIL, feedbackMailto } from "@/lib/feedback";
import EliminaAccount from "@/components/elimina-account";
import AvvisiPush from "@/components/avvisi-push";

// Fondo del profilo: "Dai un feedback" ed "Esci" (prima erano nella barra in basso, piano 6.4).
// Da non collegati c'è solo il feedback. Sotto, discreto, "Elimina il mio account" (solo da collegati).
export default function ProfiloAccount({ loggedIn }: { loggedIn: boolean }) {
  const row = "flex min-h-14 w-full items-center gap-3 px-4 text-left font-display text-sm font-semibold active:bg-surface";
  return (
    <>
      <section aria-label="Account" data-testid="profilo-account" className="mt-10 overflow-hidden rounded-card border border-border bg-white">
        <a
          href={`mailto:${FEEDBACK_EMAIL}`}
          // Costruito al tocco: l'email porta con sé la pagina e il telefono.
          onClick={(e) => { e.currentTarget.href = feedbackMailto(); }}
          className={`${row} text-text`}
        >
          <MessageCircle aria-hidden className="h-5 w-5 text-brand" strokeWidth={1.75} />
          <span className="flex-1">
            Dai un feedback
            <span className="block text-xs font-sans font-normal text-text-muted">Cosa ti piace, cosa non va, cosa ti manca</span>
          </span>
          <ChevronRight aria-hidden className="h-4 w-4 text-text-muted" />
        </a>
        {loggedIn && <AvvisiPush forma="riga" contesto="profilo" />}
        {loggedIn && (
          <form action={logout} className="border-t border-border">
            <button type="submit" className={`${row} text-error`}>
              <LogOut aria-hidden className="h-5 w-5" strokeWidth={1.75} />
              <span className="flex-1">Esci</span>
            </button>
          </form>
        )}
      </section>
      {loggedIn && <EliminaAccount />}
    </>
  );
}
