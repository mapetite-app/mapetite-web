"use client";

import { useState } from "react";
import Link from "next/link";
import PlacePhoto from "@/components/place-photo";
import { getCategoryEmoji } from "@/lib/emoji";
import { cityFromAddress } from "@/lib/city";
import { findReelLink } from "@/lib/reel";
import { findSocialLink } from "@/lib/social-link";
import { withNext } from "@/lib/next-path";
import { trackFeature } from "@/lib/track";

// "Provalo senza account" (proposta 75): in home, per chi non ha ancora un account, un campo
// "Incolla un reel". Si vede il posto con foto e verdetto; "Salvalo" porta alla registrazione e poi a
// "Salva dal reel" (/importa/condividi) con nome e link, dove la lettura e la ricerca già fatte sono nel
// telefono (nessuna seconda chiamata nella stessa scheda del browser). Tetti in src/app/api/prova-reel/route.ts.

type Luogo = { nome: string; citta: string | null; categoria: string | null };
type Posto = { id: string; name: string; address: string; category: string | null; rating: number | null; userRatingCount: number | null; photoRef: string | null; photoAuthor: string | null };
type Verdetto = { verdict: string; goFor: string[]; dontExpect: string[] };
type Esito = { letto: Luogo; posto: Posto | null; sicuro: boolean; verdetto: Verdetto | null; risultati: unknown[] };

const remember = (k: string, v: unknown) => { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch { /* storage non disponibile */ } };

export default function ProvaReel() {
  const [testo, setTesto] = useState("");
  const [nome, setNome] = useState("");
  const [chiediNome, setChiediNome] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [errore, setErrore] = useState<{ msg: string; finita: boolean } | null>(null);
  const [esito, setEsito] = useState<Esito | null>(null);

  const prova = async () => {
    if (busy || (!testo.trim() && !nome.trim())) return;
    if (!nome.trim() && !findSocialLink(testo)) {
      setErrore({ msg: "Incolla il link di un reel di Instagram, TikTok o YouTube.", finita: false });
      return;
    }
    setBusy(true);
    setErrore(null);
    try {
      const res = await fetch("/api/prova-reel", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ testo: testo.trim(), nome: nome.trim() }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (d.codice === "nome") { setChiediNome(d.error); return; }
        setErrore({ msg: d.error ?? "Qualcosa è andato storto, riprova.", finita: res.status === 429 });
        return;
      }
      const e = d as Esito;
      setEsito(e);
      setChiediNome(null);
      trackFeature("prova_reel", { stato: e.posto ? (e.verdetto ? "verdetto" : "posto") : "non_trovato" });
      // Dopo la registrazione /importa riparte da qui senza rileggere né ricercare (chiavi di reel-save.tsx).
      const pending = [nome.trim(), testo.trim()].filter(Boolean).join("\n");
      const luoghi = [e.letto];
      remember(`mapetite.reel-letto:${findReelLink(pending) ?? pending}`, luoghi);
      if (e.risultati.length > 0) remember(`mapetite.reel-ricerca:${[e.letto.nome, e.letto.citta].filter(Boolean).join(" ")}`, e.risultati);
    } catch {
      setErrore({ msg: "Errore di rete. Controlla la connessione e riprova.", finita: false });
    } finally {
      setBusy(false);
    }
  };

  const salva = () => trackFeature("prova_reel", { stato: "salvalo" });
  // Dopo l'accesso (e il primo accesso, per chi è nuovo) si torna a "Salva dal reel" con nome e link:
  // la lettura e la ricerca sono già nel telefono, si conferma con un tocco ("È questo?").
  const dopo = `/importa/condividi?${new URLSearchParams({ ...(nome.trim() ? { title: nome.trim() } : {}), text: testo.trim() })}`;

  if (esito) {
    const p = esito.posto;
    const v = esito.verdetto;
    const emoji = getCategoryEmoji(p?.category ?? esito.letto.categoria, p?.name ?? esito.letto.nome);
    const citta = p ? cityFromAddress(p.address) : esito.letto.citta;
    return (
      <section data-testid="prova-esito" className="mt-6 overflow-hidden rounded-card border border-border bg-white shadow-card">
        {p ? (
          <>
            <div className="relative h-36 bg-surface">
              <PlacePhoto photoRef={p.photoRef} alt={p.name} className="h-full w-full object-cover" credit={p.photoAuthor} fallback={<span aria-hidden className="flex h-full items-center justify-center text-5xl">{emoji}</span>} />
            </div>
            <div className="p-4">
              {!esito.sicuro && (
                <p data-testid="prova-forse" className="mb-1 text-xs font-sans text-text-muted">Nel reel: «{esito.letto.nome}». Su Google Maps trovo questo:</p>
              )}
              <p className="text-lg font-display font-semibold leading-tight text-text" data-testid="prova-nome">{p.name}</p>
              <p className="mt-0.5 text-sm font-sans text-text-muted">{[citta, p.rating ? `★ ${p.rating.toFixed(1).replace(".", ",")} su Google` : null].filter(Boolean).join(" · ")}</p>
              {v ? (
                <div data-testid="prova-verdetto" className="mt-3">
                  <p className="text-[11px] font-display font-semibold uppercase tracking-wider text-accent">Il verdetto</p>
                  <p className="mt-0.5 text-base font-sans leading-snug text-text">{v.verdict}</p>
                  {(v.goFor[0] || v.dontExpect[0]) && (
                    <div className="mt-2 flex flex-wrap gap-1.5 text-xs font-sans">
                      {v.goFor[0] && <span className="rounded-pill bg-accent-light px-2.5 py-1 text-accent">Vai per: {v.goFor[0]}</span>}
                      {v.dontExpect[0] && <span className="rounded-pill bg-surface px-2.5 py-1 text-text-muted">Non aspettarti: {v.dontExpect[0]}</span>}
                    </div>
                  )}
                </div>
              ) : (
                <p data-testid="prova-senza-verdetto" className="mt-3 text-sm font-sans text-text-muted">Il verdetto non è pronto: lo scrivo appena lo salvi.</p>
              )}
            </div>
          </>
        ) : (
          <p data-testid="prova-non-trovato" className="p-4 text-sm font-sans text-text">
            Nel reel leggo <strong className="font-semibold">{[esito.letto.nome, esito.letto.citta].filter(Boolean).join(", ")}</strong>, ma su Google Maps non lo trovo. Con l&apos;account puoi cercarlo e salvarlo a mano.
          </p>
        )}
        <div className="flex flex-col gap-2 px-4 pb-4">
          <Link href={withNext("/signup", dopo)} onClick={salva} data-testid="prova-salvalo" className="flex min-h-12 items-center justify-center rounded-pill bg-accent text-base font-display font-semibold text-white active:scale-[0.98]">
            Salvalo nella tua mappa
          </Link>
          <p className="text-center text-xs font-sans text-text-muted">
            Serve un account gratuito ·{" "}
            <Link href={withNext("/login", dopo)} onClick={salva} className="inline-flex min-h-11 items-center font-semibold text-brand">Ho già un account</Link>
          </p>
        </div>
      </section>
    );
  }

  return (
    <section data-testid="prova-reel" className="mt-6 rounded-card border border-border bg-white p-4 shadow-card">
      <p className="text-base font-display font-semibold text-text"><span aria-hidden>🎬 </span>Hai visto un posto in un reel?</p>
      <p className="mt-0.5 text-sm font-sans text-text-muted">Incolla il link: ti dico se merita. Senza account.</p>
      <form className="mt-3 flex flex-col gap-2" onSubmit={(e) => { e.preventDefault(); void prova(); }}>
        <input
          value={testo}
          onChange={(e) => { setTesto(e.target.value); setErrore(null); }}
          placeholder="Link di Instagram o TikTok"
          aria-label="Link del reel"
          inputMode="url"
          data-testid="prova-link"
          className="min-h-12 w-full rounded-pill border border-border bg-white px-4 text-base text-text focus:border-brand focus:outline-none"
        />
        {chiediNome && (
          <>
            <p data-testid="prova-chiedi-nome" className="px-1 text-sm font-sans text-text">{chiediNome}</p>
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Nome del locale e città"
              aria-label="Nome del locale"
              maxLength={120}
              data-testid="prova-nome-campo"
              autoFocus
              className="min-h-12 w-full rounded-pill border border-border bg-white px-4 text-base text-text focus:border-brand focus:outline-none"
            />
          </>
        )}
        <button
          type="submit"
          disabled={busy || (chiediNome ? !nome.trim() : !testo.trim())}
          data-testid="prova-vai"
          className="min-h-12 rounded-pill bg-brand text-base font-display font-semibold text-white active:scale-[0.98] disabled:opacity-50"
        >
          {busy ? "Leggo il reel…" : "Fammi vedere"}
        </button>
      </form>
      {errore && (
        <p role="alert" data-testid="prova-errore" className="mt-2 rounded-btn bg-error/10 px-3 py-2 text-sm text-error">
          {errore.msg}
          {errore.finita && <> <Link href="/signup" className="font-semibold underline">Crea l&apos;account</Link></>}
        </p>
      )}
    </section>
  );
}
