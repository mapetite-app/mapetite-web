"use client";

import Link from "next/link";
import { useState } from "react";
import { browserClient } from "@/lib/supabase/client-lazy";
import { withNext } from "@/lib/next-path";
import { mailRivendica, type DatiRivendica } from "./mail";

// Modulo "Rivendica questo locale" (piano 8.1). Con l'accesso la richiesta va nella tabella
// `claims` (RLS: ognuno inserisce solo la propria, nessuno la rilegge dal telefono). Senza tabella
// (migrazione da applicare) o senza accesso si prepara un'email a Mapetite con gli stessi dati:
// un pulsante da toccare, perché l'app di posta si apre solo da un tocco (iPhone).
const RUOLI = ["Titolare", "Gestore", "Socio", "Responsabile di sala", "Marketing / comunicazione", "Altro"];

const INPUT =
  "mt-1 block w-full rounded-btn border border-border bg-white px-3 py-2.5 text-[15px] font-sans text-text outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";
const LABEL = "block text-sm font-display font-semibold text-text";

type Stato = "pronto" | "invio" | "inviata" | "gia" | "email" | "errore";

export default function ModuloRivendica({
  place,
  userId,
  ritorno,
}: {
  place: { id: string; name: string; address: string | null; googlePlaceId: string | null } | null;
  userId: string | null;
  ritorno: string;
}) {
  const [stato, setStato] = useState<Stato>("pronto");
  const [mail, setMail] = useState<string | null>(null);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (stato === "invio") return;
    const f = new FormData(e.currentTarget);
    const v = (k: string) => String(f.get(k) ?? "").trim();
    const dati: DatiRivendica = {
      localeNome: place?.name ?? v("locale_nome"),
      localeIndirizzo: place?.address ?? null,
      localeCitta: place ? null : v("locale_citta") || null,
      localeId: place?.id ?? null,
      nome: v("nome"),
      ruolo: v("ruolo"),
      telefono: v("telefono"),
      email: v("email"),
      messaggio: v("messaggio") || null,
    };
    const ripiego = () => { setMail(mailRivendica(dati)); setStato("email"); };
    if (!userId) { ripiego(); return; }

    setStato("invio");
    const client = await browserClient().catch(() => null);
    if (!client) { setMail(mailRivendica(dati)); setStato("errore"); return; }
    const { error } = await client.from("claims").insert({
      user_id: userId,
      place_id: place?.id ?? null,
      google_place_id: place?.googlePlaceId ?? null,
      locale_nome: place ? null : dati.localeNome,
      locale_citta: dati.localeCitta,
      nome: dati.nome,
      ruolo: dati.ruolo,
      telefono: dati.telefono,
      email: dati.email,
      messaggio: dati.messaggio,
    });
    if (!error) { setStato("inviata"); return; }
    // 23505 = richiesta già in attesa per questo locale.
    if (error.code === "23505") { setStato("gia"); return; }
    // PGRST205 / 42P01 = tabella non ancora creata: si ripiega sull'email, senza allarmare.
    if (error.code === "PGRST205" || error.code === "42P01") {
      console.warn("[rivendica] tabella claims non ancora creata: ripiego sull'email");
      ripiego();
      return;
    }
    console.error("[rivendica] invio non riuscito:", error.code, error.message);
    setMail(mailRivendica(dati));
    setStato("errore");
  };

  if (stato === "inviata" || stato === "gia") {
    return (
      <section role="status" data-testid="rivendica-inviata" className="mt-5 rounded-card bg-brand p-5 text-white shadow-card">
        <p className="font-display text-lg font-semibold">{stato === "inviata" ? "Richiesta inviata ✓" : "Richiesta già in verifica"}</p>
        <p className="mt-1 text-sm font-sans leading-relaxed text-white/85">
          {stato === "inviata"
            ? "Ti ricontattiamo entro pochi giorni per la verifica. Quando è fatta, sulla pagina del locale compare il badge “Verificato” e trovi i tuoi numeri."
            : "Abbiamo già una tua richiesta per questo locale: ti ricontattiamo noi."}
        </p>
        {place && (
          <Link href={`/locali/${place.id}`} className="mt-4 inline-flex min-h-11 items-center rounded-pill bg-white px-5 text-sm font-display font-semibold text-brand">
            Torna al locale
          </Link>
        )}
      </section>
    );
  }

  if (stato === "email" && mail) {
    return (
      <section role="status" data-testid="rivendica-ripiego" className="mt-5 rounded-card border border-border bg-surface p-5">
        <p className="font-display text-lg font-semibold text-brand">Manca solo l&apos;invio</p>
        <p className="mt-1 text-sm font-sans leading-relaxed text-text-muted">
          Abbiamo preparato un&apos;email con i tuoi dati: tocca il pulsante e premi “Invia” nella tua app di posta.
        </p>
        <a data-testid="rivendica-email" href={mail} className="mt-4 inline-flex min-h-12 items-center rounded-pill bg-accent px-6 text-sm font-display font-semibold text-white active:scale-[0.98]">
          Invia la richiesta per email
        </a>
        <button type="button" onClick={() => setStato("pronto")} className="mt-3 block text-sm font-display font-semibold text-brand underline underline-offset-2">
          Modifica i dati
        </button>
      </section>
    );
  }

  return (
    <form data-testid="rivendica-modulo" onSubmit={submit} className="mt-5 space-y-4 rounded-card border border-border bg-white p-5 shadow-card">
      {!place && (
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={LABEL}>
            Nome del locale
            <input name="locale_nome" required minLength={2} maxLength={120} autoComplete="organization" className={INPUT} />
          </label>
          <label className={LABEL}>
            Città
            <input name="locale_citta" required minLength={2} maxLength={80} autoComplete="address-level2" className={INPUT} />
          </label>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={LABEL}>
          Nome e cognome
          <input name="nome" required minLength={2} maxLength={100} autoComplete="name" className={INPUT} />
        </label>
        <label className={LABEL}>
          Ruolo
          <select name="ruolo" required defaultValue="" className={INPUT}>
            <option value="" disabled>Scegli…</option>
            {RUOLI.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </label>
        <label className={LABEL}>
          Telefono
          <input name="telefono" type="tel" required minLength={5} maxLength={30} autoComplete="tel" inputMode="tel" className={INPUT} />
        </label>
        <label className={LABEL}>
          Email
          <input name="email" type="email" required minLength={5} maxLength={160} autoComplete="email" className={INPUT} />
        </label>
      </div>
      <label className={LABEL}>
        Messaggio <span className="font-sans font-normal text-text-muted">(facoltativo)</span>
        <textarea name="messaggio" rows={3} maxLength={1000} placeholder="Es. il modo migliore per contattarti, orari, sito della prenotazione…" className={`${INPUT} resize-y`} />
      </label>

      <button type="submit" disabled={stato === "invio"} className="inline-flex min-h-12 w-full items-center justify-center rounded-pill bg-accent px-6 text-[15px] font-display font-semibold text-white shadow-float active:scale-[0.98] disabled:opacity-70">
        {stato === "invio" ? "Invio…" : "Invia la richiesta"}
      </button>

      {stato === "errore" && mail && (
        <p role="alert" className="text-sm font-sans text-error">
          Non sono riuscito a inviarla.{" "}
          <a href={mail} className="font-semibold underline">Mandacela per email</a> oppure riprova.
        </p>
      )}
      {!userId && (
        <p data-testid="rivendica-accedi" className="text-xs font-sans leading-relaxed text-text-muted">
          Hai un account Mapetite?{" "}
          <Link href={withNext("/login", ritorno)} className="font-display font-semibold text-brand">Accedi</Link>{" "}
          e la richiesta arriva direttamente, collegata al tuo pannello. Altrimenti la mandi per email.
        </p>
      )}
    </form>
  );
}
