"use client";

import Link from "next/link";
import { useSyncExternalStore, useState } from "react";
import { BookUser } from "lucide-react";
import Avatar from "@/components/avatar";
import SeguiButton from "@/components/segui-button";
import { browserClient } from "@/lib/supabase/client-lazy";
import { personName, profilePath } from "@/lib/handle";
import { trackFeature } from "@/lib/track";

// "Trova amici dalla rubrica" (Lorenzo 14/11), solo dove il browser ha il Contact Picker (Chrome su Android;
// Safari su iPhone no, e lì il tasto non compare). La persona sceglie i contatti nel selettore del telefono;
// qui le email diventano impronte SHA-256 e solo quelle vanno al server (trova_da_contatti), che risponde con
// chi ha il profilo pubblico. Niente viene salvato, né qui né sul server (solo quante ricerche al giorno: max 3).

type Person = { id: string; handle: string; display_name: string | null; city: string | null };
type ContactsNav = Navigator & { contacts?: { select: (props: string[], opts: { multiple: boolean }) => Promise<{ email?: string[] }[]> } };

const haPicker = () => typeof navigator !== "undefined" && typeof (navigator as ContactsNav).contacts?.select === "function";

async function impronta(email: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(email.trim().toLowerCase()));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

export default function TrovaRubrica({ viewerId, seguo }: { viewerId: string; seguo: string[] }) {
  const disponibile = useSyncExternalStore(() => () => {}, haPicker, () => false);
  const [stato, setStato] = useState<"idle" | "cerco" | "fatto" | "errore" | "limite">("idle");
  const [trovati, setTrovati] = useState<Person[]>([]);
  const [scelti, setScelti] = useState(0);
  if (!disponibile) return null;

  const cerca = async () => {
    let contatti: { email?: string[] }[] = [];
    try {
      contatti = await (navigator as ContactsNav).contacts!.select(["email"], { multiple: true });
    } catch {
      return; // selettore chiuso
    }
    const email = [...new Set(contatti.flatMap((c) => c.email ?? []).map((e) => e.trim().toLowerCase()).filter((e) => e.includes("@")))].slice(0, 200);
    setScelti(contatti.length);
    if (email.length === 0) { setTrovati([]); setStato("fatto"); return; }
    setStato("cerco");
    // Solo impronte SHA-256 (64 cifre esadecimali): il server rifiuta tutto il resto (migrazione 20261114e).
    const hash = (await Promise.all(email.map(impronta))).filter((h) => /^[0-9a-f]{64}$/.test(h));
    const client = await browserClient().catch(() => null);
    if (!client) { setStato("errore"); return; }
    const { data, error } = await client.rpc("trova_da_contatti", { p_hash: hash });
    if (error) { setStato(error.message.includes("troppe") ? "limite" : "errore"); return; }
    const r = (data as Person[] | null) ?? [];
    setTrovati(r);
    setStato("fatto");
    trackFeature("rubrica_cerca", { risultati: r.length });
  };

  return (
    <div data-testid="trova-rubrica" className="mt-3">
      <button
        type="button"
        data-testid="trova-rubrica-tasto"
        onClick={cerca}
        disabled={stato === "cerco"}
        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-pill border border-border bg-white px-4 text-sm font-display font-semibold text-brand active:scale-[0.98] disabled:opacity-60"
      >
        <BookUser size={17} aria-hidden />
        {stato === "cerco" ? "Cerco…" : "Trova amici dalla rubrica"}
      </button>
      <p className="mt-1.5 text-center text-xs font-sans text-text-muted">Scegli tu i contatti: parte solo un&apos;impronta delle email, e non si salva.</p>
      {stato === "limite" && <p role="alert" className="mt-2 text-sm font-sans text-text-muted">Per oggi hai già cercato 3 volte: riprova domani.</p>}
      {stato === "errore" && <p role="alert" className="mt-2 text-sm font-sans text-text-muted">Non sono riuscito a cercare. Riprova tra poco.</p>}
      {stato === "fatto" && trovati.length === 0 && (
        <p data-testid="trova-rubrica-vuoto" className="mt-2 text-sm font-sans text-text-muted">
          {scelti === 0 ? "Nessun contatto scelto." : "Nessuno dei contatti scelti è su Mapetite con il profilo pubblico."}{" "}
          <Link href="/profilo#invita" className="font-semibold text-brand underline underline-offset-2">Mandagli il tuo link</Link>
        </p>
      )}
      {trovati.length > 0 && (
        <ul data-testid="trova-rubrica-risultati" className="mt-3 space-y-2">
          {trovati.map((p) => (
            <li key={p.id} data-testid="persona" className="flex items-center gap-3 rounded-card border border-border bg-white p-3 shadow-card">
              <Link href={profilePath(p.handle)} className="flex min-w-0 flex-1 items-center gap-3">
                <Avatar person={p} size={44} />
                <span className="min-w-0">
                  <span className="block truncate font-display text-[15px] font-semibold text-text">{personName(p)}</span>
                  <span className="block truncate text-xs font-sans text-text-muted">@{p.handle}{p.city ? ` · ${p.city}` : ""}</span>
                </span>
              </Link>
              <SeguiButton compact viewerId={viewerId} targetId={p.id} targetName={personName(p)} initialFollowing={seguo.includes(p.id)} returnPath="/amici" />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
