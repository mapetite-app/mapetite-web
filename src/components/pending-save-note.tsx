"use client";

import { useEffect, useState } from "react";
import { peekPendingSaveName } from "@/lib/pending-save";

// Registrazione partita da "Salva" senza accesso: ricorda quale locale verrà salvato.
export default function PendingSaveNote() {
  const [name, setName] = useState<string | null>(null);
  useEffect(() => {
    const n = peekPendingSaveName();
    if (n) setTimeout(() => setName(n), 0);
  }, []);
  if (!name) return null;
  return (
    <p role="status" data-testid="salva-dopo-accesso" className="mt-6 rounded-btn bg-success/10 px-4 py-3 text-sm font-sans text-success">
      📌 Appena entri salvo “{name}” nei tuoi salvati.
    </p>
  );
}
