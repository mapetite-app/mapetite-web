"use client";

import { useEffect } from "react";

// Variante dei titoli da far scegliere a Lorenzo: ?titoli=serif accende il serif
// (resta acceso su quel telefono), ?titoli=poppins torna all'attuale.
const KEY = "mapetite.titoli";

export default function TitleVariant() {
  useEffect(() => {
    let v: string | null = new URLSearchParams(window.location.search).get("titoli");
    try {
      if (v === "serif" || v === "poppins") window.localStorage.setItem(KEY, v);
      else v = window.localStorage.getItem(KEY);
    } catch {
      // storage non disponibile: vale solo l'indirizzo
    }
    if (v === "serif") document.documentElement.dataset.titoli = "serif";
    else delete document.documentElement.dataset.titoli;
  }, []);
  return null;
}
