"use client";

import Link from "next/link";
import { useState } from "react";
import { Lock, Globe } from "lucide-react";
import CondividiLink from "@/components/condividi-link";
import { browserClient } from "@/lib/supabase/client-lazy";
import { cleanHandle, isValidHandle, profileMapPath, profilePath } from "@/lib/handle";

// Impostazioni del profilo pubblico (piano 5.1) dentro /profilo: nome pubblico (handle), nome,
// città, una riga su di sé e l'interruttore "Profilo pubblico" (spento di default).
// Scrive su profiles con la sessione dell'utente (RLS: solo il proprio profilo).
export type MySocialInitial = {
  handle: string | null;
  display_name: string | null;
  bio: string | null;
  city: string | null;
  is_public: boolean;
};

export default function ProfiloSocial({ userId, initial }: { userId: string; initial: MySocialInitial | null }) {
  const [saved, setSaved] = useState<MySocialInitial | null>(initial);
  const [handle, setHandle] = useState(initial?.handle ?? "");
  const [name, setName] = useState(initial?.display_name ?? "");
  const [city, setCity] = useState(initial?.city ?? "");
  const [bio, setBio] = useState(initial?.bio ?? "");
  const [isPublic, setIsPublic] = useState(initial?.is_public ?? false);
  const [state, setState] = useState<"idle" | "salvo" | "fatto" | "errore">("idle");
  const [error, setError] = useState<string | null>(null);

  if (!initial || !saved) {
    return (
      <section id="profilo-pubblico" data-testid="profilo-social-in-arrivo" className="mb-8 rounded-card border border-border bg-surface p-5">
        <p className="font-display text-base font-semibold text-brand">👥 Profilo pubblico e amici</p>
        <p className="mt-1 text-sm font-sans text-text-muted">
          In arrivo: potrai scegliere un nome, condividere la tua mappa e seguire gli amici. I tuoi salvati restano privati finché non decidi tu.
        </p>
      </section>
    );
  }

  const handleOk = isValidHandle(handle);
  const dirty =
    handle !== (saved.handle ?? "") || name !== (saved.display_name ?? "") || city !== (saved.city ?? "") || bio !== (saved.bio ?? "") || isPublic !== saved.is_public;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (isPublic && handle === "") {
      setError("Per rendere pubblico il profilo scegli prima un nome pubblico.");
      return;
    }
    if (handle !== "" && !handleOk) {
      setError("Il nome pubblico deve avere da 3 a 20 caratteri: lettere, numeri, punto o trattino basso.");
      return;
    }
    setState("salvo");
    const client = await browserClient().catch(() => null);
    if (!client) { setState("errore"); setError("Sei offline: riprova."); return; }
    const next: MySocialInitial = {
      handle: handle || null,
      display_name: name.trim().slice(0, 40) || null,
      city: city.trim().slice(0, 40) || null,
      bio: bio.trim().slice(0, 160) || null,
      is_public: isPublic,
    };
    const { error: err } = await client.from("profiles").update({ ...next, updated_at: new Date().toISOString() }).eq("id", userId);
    if (err) {
      setState("errore");
      setError(err.code === "23505" ? `Il nome "${handle}" è già preso: provane un altro.` : "Non sono riuscito a salvare. Riprova tra poco.");
      return;
    }
    setSaved(next);
    setState("fatto");
  };

  const input = "mt-1 block min-h-11 w-full rounded-btn border border-border bg-white px-3 text-[15px] font-sans text-text outline-none focus:border-brand";
  const live = saved.is_public && saved.handle;

  return (
    <section id="profilo-pubblico" data-testid="profilo-social" className="mb-8 scroll-mt-4 rounded-card border border-border bg-white p-5 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-title text-xl font-semibold text-text">Profilo pubblico</h2>
          <p className="mt-0.5 text-sm font-sans text-text-muted">Fatti trovare dagli amici e condividi la tua mappa.</p>
        </div>
        <span
          data-testid="profilo-stato"
          className={`inline-flex shrink-0 items-center gap-1 rounded-pill px-2.5 py-1 text-xs font-display font-semibold ${live ? "bg-accent-light text-accent" : "bg-surface text-text-muted"}`}
        >
          {live ? <Globe size={12} aria-hidden /> : <Lock size={12} aria-hidden />}
          {live ? "Pubblico" : "Privato"}
        </span>
      </div>

      <form onSubmit={save} className="mt-4 space-y-3">
        <label className="block text-sm font-display font-semibold text-text">
          Nome pubblico
          <span className="mt-1 flex min-h-11 items-center rounded-btn border border-border bg-white px-3 focus-within:border-brand">
            <span aria-hidden className="text-[15px] font-sans text-text-muted">@</span>
            <input
              name="handle"
              value={handle}
              onChange={(e) => { setHandle(cleanHandle(e.target.value)); setState("idle"); }}
              placeholder="es. giulia.rm"
              autoCapitalize="none"
              autoComplete="off"
              maxLength={20}
              className="min-w-0 flex-1 bg-transparent text-[15px] font-sans font-normal text-text outline-none"
            />
          </span>
          <span className="mt-1 block text-xs font-sans font-normal text-text-muted">
            Il tuo indirizzo sarà mapetite…/u/{handle || "nome"}. Minuscole, numeri, punto e trattino basso.
          </span>
        </label>
        <label className="block text-sm font-display font-semibold text-text">
          Nome da mostrare
          <input name="display_name" value={name} onChange={(e) => { setName(e.target.value); setState("idle"); }} maxLength={40} placeholder="es. Giulia" className={input} />
        </label>
        <label className="block text-sm font-display font-semibold text-text">
          Città
          <input name="city" value={city} onChange={(e) => { setCity(e.target.value); setState("idle"); }} maxLength={40} placeholder="es. Roma" className={input} />
        </label>
        <label className="block text-sm font-display font-semibold text-text">
          Due parole su di te <span className="font-normal text-text-muted">(facoltativo)</span>
          <input name="bio" value={bio} onChange={(e) => { setBio(e.target.value); setState("idle"); }} maxLength={160} placeholder="es. Trattorie di quartiere e vini naturali" className={input} />
        </label>

        <div className="rounded-card bg-surface p-4">
          <label className="flex cursor-pointer items-center justify-between gap-3">
            <span className="font-display text-sm font-semibold text-text">Rendi pubblico il mio profilo</span>
            <input
              type="checkbox"
              role="switch"
              name="is_public"
              checked={isPublic}
              onChange={(e) => { setIsPublic(e.target.checked); setState("idle"); }}
              aria-checked={isPublic}
              className="peer sr-only"
            />
            <span aria-hidden className="relative h-7 w-12 shrink-0 rounded-pill bg-border transition-colors duration-150 peer-checked:bg-accent peer-focus-visible:ring-2 peer-focus-visible:ring-brand after:absolute after:left-0.5 after:top-0.5 after:h-6 after:w-6 after:rounded-full after:bg-white after:shadow-card after:transition-transform after:duration-150 peer-checked:after:translate-x-5" />
          </label>
          <p data-testid="privacy-testo" className="mt-2 text-xs font-sans leading-relaxed text-text-muted">
            {isPublic
              ? "Chiunque abbia il link vedrà nome, città, i posti dove sei stato o vuoi andare e le tue raccolte. Le note private non si vedono mai. Puoi tornare privato quando vuoi."
              : "Spento: nessuno vede il tuo profilo né i tuoi posti. Se lo accendi, chi ha il link vedrà nome, città, i posti e le raccolte, mai le note private."}
          </p>
        </div>

        {error && <p role="alert" className="text-sm font-sans text-error">{error}</p>}

        <button
          type="submit"
          disabled={state === "salvo" || !dirty}
          className="inline-flex min-h-11 w-full items-center justify-center rounded-pill bg-brand px-5 text-sm font-display font-semibold text-white active:scale-95 disabled:opacity-60"
        >
          {state === "salvo" ? "Salvo…" : state === "fatto" && !dirty ? "✓ Salvato" : "Salva"}
        </button>
      </form>

      {live && saved.handle && (
        <div data-testid="profilo-condividi" className="mt-4 border-t border-border pt-4">
          <p className="text-sm font-sans text-text-muted">Manda il link agli amici: si apre anche senza Mapetite.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <CondividiLink path={profilePath(saved.handle)} cosa="profilo" title="Il mio profilo su Mapetite" text="Ecco i miei posti preferiti su Mapetite" label="Condividi profilo" variant="solid" testId="condividi-mio-profilo" />
            <CondividiLink path={profileMapPath(saved.handle)} cosa="mappa" title="La mia mappa su Mapetite" text="La mia mappa dei locali su Mapetite" label="Condividi mappa" testId="condividi-mia-mappa" />
          </div>
          <Link href={profilePath(saved.handle)} data-testid="vedi-profilo-pubblico" className="mt-2 inline-flex min-h-10 items-center text-sm font-display font-semibold text-accent">
            Vedi come ti vedono gli altri →
          </Link>
        </div>
      )}
    </section>
  );
}
