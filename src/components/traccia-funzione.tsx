"use client";

import { useEffect } from "react";
import { trackFeature } from "@/lib/track";

// Registra una sola volta che una funzione è stata vista (pagine server senza altri client).
export default function TracciaFunzione({ nome, contesto }: { nome: string; contesto?: string }) {
  useEffect(() => {
    trackFeature(nome, contesto ? { contesto } : undefined);
  }, [nome, contesto]);
  return null;
}
