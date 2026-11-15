"use client";

import { useEffect, useState, type ReactNode } from "react";
import { INVITO_SOSPESO_EVENT, isFriendCode, readStoredInvite } from "@/lib/invito";

// Nasconde "Invita un amico" finché in Amici c'è un invito di un amico senza risposta (revisore 15/11, sesto
// giro): una cosa per volta. Torna appena si risponde (Diventa amico, Non ora, o un invito che non vale più).
export default function SenzaInvitoSospeso({ children }: { children: ReactNode }) {
  const [sospeso, setSospeso] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- il codice è nel telefono: si legge solo dopo l'avvio
    setSospeso(isFriendCode(readStoredInvite()));
    const on = (e: Event) => setSospeso(!!(e as CustomEvent<boolean>).detail);
    window.addEventListener(INVITO_SOSPESO_EVENT, on);
    return () => window.removeEventListener(INVITO_SOSPESO_EVENT, on);
  }, []);
  if (sospeso) return null;
  return <>{children}</>;
}
