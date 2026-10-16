"use client";

import { createContext } from "react";
import type { Voto } from "@/lib/diario";

// Dalla scheda del locale (venue-sheet) al blocco "Ci sono stato" (diario-scheda): quando l'utente
// ha appena toccato "✓ Ci sono stato" e come cambiare voto e nota passando da map-view, che tiene
// lo stato dei salvati (scrivere i tag da fuori lo lascerebbe vecchio e un tocco dopo lo riscriverebbe).
export type VisitaScheda = {
  askedAt: number | null; // momento del tocco su "Ci sono stato" in questa scheda
  consume: () => void;
  voto: Voto | null;
  setVoto: (v: Voto | null) => void;
  note: string | null;
  onEditNote?: () => void;
};

export const VisitaContext = createContext<VisitaScheda | null>(null);
