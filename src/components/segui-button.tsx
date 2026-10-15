"use client";

import Link from "next/link";
import { useState } from "react";
import { UserPlus, UserCheck } from "lucide-react";
import { browserClient } from "@/lib/supabase/client-lazy";
import { withNext } from "@/lib/next-path";

// "Segui" / "Segui già": scrive in follows con la sessione dell'utente (RLS: solo i propri
// follow, solo profili pubblici). Senza accesso porta alla registrazione e poi torna qui.
export default function SeguiButton({
  viewerId,
  targetId,
  targetName,
  initialFollowing,
  returnPath,
  onChange,
  compact = false,
}: {
  viewerId: string | null;
  targetId: string;
  targetName: string;
  initialFollowing: boolean;
  returnPath: string;
  onChange?: (following: boolean) => void;
  compact?: boolean;
}) {
  const [following, setFollowing] = useState(initialFollowing);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const size = compact ? "min-h-10 px-3 text-[13px]" : "min-h-11 px-5 text-sm";

  if (!viewerId) {
    return (
      <Link
        href={withNext("/signup", returnPath)}
        data-testid="segui"
        className={`inline-flex items-center justify-center gap-1.5 rounded-pill bg-accent font-display font-semibold text-white active:scale-95 ${size}`}
      >
        <UserPlus size={16} aria-hidden className="shrink-0" />
        Segui
      </Link>
    );
  }

  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const next = !following;
    const client = await browserClient().catch(() => null);
    if (!client) {
      setBusy(false);
      setError("Sei offline: riprova.");
      return;
    }
    const { error: err } = next
      ? await client.from("follows").insert({ follower_id: viewerId, followed_id: targetId })
      : await client.from("follows").delete().eq("follower_id", viewerId).eq("followed_id", targetId);
    setBusy(false);
    // 23505 = segui già (doppio tocco): lo stato giusto è "segui".
    if (err && !(next && err.code === "23505")) {
      setError("Non è andata. Riprova tra poco.");
      return;
    }
    setFollowing(next);
    onChange?.(next);
  };

  return (
    <span className="inline-flex flex-col items-start">
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        aria-pressed={following}
        aria-label={following ? `Smetti di seguire ${targetName}` : `Segui ${targetName}`}
        data-testid="segui"
        className={`inline-flex items-center justify-center gap-1.5 rounded-pill font-display font-semibold active:scale-95 transition-colors duration-150 disabled:opacity-70 ${size} ${
          following ? "border border-border bg-white text-brand" : "bg-accent text-white"
        }`}
      >
        {following ? <UserCheck size={16} aria-hidden className="shrink-0" /> : <UserPlus size={16} aria-hidden className="shrink-0" />}
        {following ? "Segui già" : "Segui"}
      </button>
      {error && (
        <span role="alert" className="mt-1 text-xs font-sans text-error">
          {error}
        </span>
      )}
    </span>
  );
}
