"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import Avatar from "@/components/avatar";
import SeguiButton from "@/components/segui-button";
import { browserClient } from "@/lib/supabase/client-lazy";
import { cleanHandle, personName, profilePath } from "@/lib/handle";

// Ricerca persone per nome pubblico (handle) o nome: solo profili pubblici (vista profili_pubblici).
type Person = { id: string; handle: string; display_name: string | null; city: string | null };

export default function CercaPersone({ viewerId, seguo }: { viewerId: string; seguo: string[] }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Person[] | null>(null);
  const [state, setState] = useState<"idle" | "cerco" | "errore">("idle");
  const seq = useRef(0);

  useEffect(() => {
    const term = cleanHandle(q);
    if (term.length < 2) return;
    const my = ++seq.current;
    const t = window.setTimeout(async () => {
      setState("cerco");
      const client = await browserClient().catch(() => null);
      if (!client) { if (my === seq.current) setState("errore"); return; }
      // Il termine è già ripulito (solo lettere, numeri, "." e "_"): sicuro nel filtro "or".
      const { data, error } = await client
        .from("profili_pubblici")
        .select("id, handle, display_name, city")
        .or(`handle.ilike.${term}%,display_name.ilike.%${term}%`)
        .neq("id", viewerId)
        .limit(10);
      if (my !== seq.current) return;
      if (error) { setState("errore"); setResults(null); return; }
      setResults((data as Person[]) ?? []);
      setState("idle");
    }, 300);
    return () => window.clearTimeout(t);
  }, [q, viewerId]);

  const term = cleanHandle(q);

  return (
    <section aria-label="Cerca persone">
      <label className="flex min-h-12 items-center gap-2 rounded-pill border border-border bg-surface px-4 focus-within:border-brand">
        <Search size={18} aria-hidden className="shrink-0 text-text-muted" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cerca per nome, es. giulia"
          aria-label="Cerca persone per nome"
          autoComplete="off"
          autoCapitalize="none"
          className="min-w-0 flex-1 bg-transparent text-[15px] font-sans text-text outline-none placeholder:text-text-muted"
        />
      </label>

      {term.length >= 2 && (
        <div data-testid="persone-risultati" className="mt-3">
          {state === "cerco" && results === null && <p className="text-sm font-sans text-text-muted">Cerco…</p>}
          {state === "errore" && (
            <p className="text-sm font-sans text-text-muted">La ricerca delle persone arriva presto. Riprova più tardi.</p>
          )}
          {results && results.length === 0 && state !== "errore" && (
            <p className="text-sm font-sans text-text-muted">Nessuno con questo nome. Chiedi all&apos;amico il suo nome su Mapetite.</p>
          )}
          {results && results.length > 0 && (
            <ul className="space-y-2">
              {results.map((p) => (
                <li key={p.id} data-testid="persona" className="flex items-center gap-3 rounded-card border border-border bg-white p-3 shadow-card">
                  <Link href={profilePath(p.handle)} className="flex min-w-0 flex-1 items-center gap-3">
                    <Avatar person={p} size={44} />
                    <span className="min-w-0">
                      <span className="block truncate font-display text-[15px] font-semibold text-text">{personName(p)}</span>
                      <span className="block truncate text-xs font-sans text-text-muted">@{p.handle}{p.city ? ` · ${p.city}` : ""}</span>
                    </span>
                  </Link>
                  <SeguiButton
                    compact
                    viewerId={viewerId}
                    targetId={p.id}
                    targetName={personName(p)}
                    initialFollowing={seguo.includes(p.id)}
                    returnPath="/amici"
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
