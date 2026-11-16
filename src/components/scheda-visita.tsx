"use client";

import { createContext } from "react";

// Proposta 61: la sezione recensioni dentro la scheda (mappa, assistente) usa il "Ci sono stato" della scheda,
// non un suo tasto (revisore 16/11: due tasti "Ci sono stato" sulla stessa schermata).
// - visitato: stato vivo della scheda (null = la scheda non lo sa, decide il server);
// - vai: il tasto della scheda è in vista: la sezione dice dov'è e ci porta, senza un secondo tasto;
// - segna: il tasto della scheda non è in vista (sta nel menu ⋯): la sezione ne mostra uno che fa la stessa cosa.
export type SchedaVisita = { visitato: boolean | null; vai: (() => void) | null; segna: (() => void) | null };

export const SchedaVisitaContext = createContext<SchedaVisita | null>(null);
