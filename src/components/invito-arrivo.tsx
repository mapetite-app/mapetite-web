"use client";

import { useEffect } from "react";
import { trackFeature } from "@/lib/track";
import { readStoredInvite, storeInvite } from "@/lib/invito";

// Arrivo da un link d'invito (/invito/<codice>): il telefono si ricorda il codice fino alla
// registrazione (letto poi dall'onboarding) e il pannello conta l'arrivo una volta per codice.
// Chi ha già un account non viene contato: non è un arrivo da invito.
export default function InvitoArrivo({ codice, loggedIn }: { codice: string; loggedIn: boolean }) {
  useEffect(() => {
    if (loggedIn) return;
    const already = readStoredInvite() === codice;
    storeInvite(codice);
    if (!already) trackFeature("invito_arrivo", { contesto: codice });
  }, [codice, loggedIn]);
  return null;
}
