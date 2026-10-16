"use client";

import { useSyncExternalStore } from "react";

// Avviso quando il telefono perde la rete (metro, locale interrato): le ricerche
// non partirebbero e senza spiegazione sembrerebbe un errore dell'app.
function subscribe(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

export default function OfflineBanner() {
  const online = useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
  if (online) return null;
  return (
    <div
      role="status"
      data-testid="offline"
      // In basso, sopra la barra di navigazione: in alto coprirebbe il campo di ricerca.
      className="pointer-events-none fixed inset-x-0 z-[70] flex justify-center px-3"
      style={{ bottom: "calc(var(--nav-height-mobile) + var(--nav-sporgenza) + 0.5rem)" }}
    >
      <p className="rounded-pill bg-brand px-4 py-2 text-sm font-display font-semibold text-white shadow-float">
        📶 Sei senza connessione
      </p>
    </div>
  );
}
