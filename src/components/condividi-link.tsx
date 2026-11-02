"use client";

import { useState } from "react";
import { Share2 } from "lucide-react";
import { track } from "@/lib/track";

// Condivide un indirizzo di Mapetite (profilo pubblico o mappa di una persona): menu di
// condivisione del telefono se c'è, altrimenti copia il link. Il link si apre anche senza
// account e in fondo invita a creare la propria mappa.
export default function CondividiLink({
  path,
  title,
  text,
  cosa,
  label = "Condividi",
  variant = "outline",
  testId,
  className = "",
}: {
  path: string;
  title: string;
  text: string;
  cosa: "profilo" | "mappa" | "raccolta" | "invito" | "gruppo" | "locale";
  label?: string;
  variant?: "outline" | "solid";
  testId?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState<"ok" | "errore" | null>(null);

  const share = async () => {
    const url = `${window.location.origin}${path}`;
    // "contesto": chiave accettata da /api/events ("cosa" veniva scartata dal server).
    track("condividi", null, { contesto: cosa });
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch (e) {
        // Chiuso dall'utente: nessun messaggio. Altri errori: si prova a copiare.
        if (e instanceof DOMException && e.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied("ok");
    } catch {
      setCopied("errore");
    }
    window.setTimeout(() => setCopied(null), 2500);
  };

  const cls =
    variant === "solid"
      ? "bg-brand text-white"
      : "border border-border bg-white text-brand";

  return (
    <button
      type="button"
      onClick={share}
      data-testid={testId}
      className={`inline-flex min-h-11 items-center justify-center gap-1.5 rounded-pill px-4 text-sm font-display font-semibold active:scale-95 transition-transform duration-150 ${cls} ${className}`}
    >
      <Share2 size={16} aria-hidden className="shrink-0" />
      <span role={copied ? "status" : undefined}>
        {copied === "ok" ? "✓ Link copiato" : copied === "errore" ? "Copia non riuscita" : label}
      </span>
    </button>
  );
}
