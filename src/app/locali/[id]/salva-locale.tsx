"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { browserClient } from "@/lib/supabase/client-lazy";
import { withNext } from "@/lib/next-path";
import { CONSIGLIATO_MAX, NOME_NON_VALIDO, leggiCampoNome, stessoNome } from "@/lib/consigliato-da";
import { mioNome } from "@/lib/share-place";

// Invito per chi ha ricevuto il link: salvarlo in Mapetite ("📌 Da provare", tag "Da provare",
// lo stesso dei salvataggi da link e dalla scheda) oppure scoprire l'app.
// Il pulsante principale sta in una barra flottante in fondo (come la scheda B): sempre in vista.
const WANT_TAG = "Da provare";

const PRIMARY =
  "inline-flex min-h-12 w-full items-center justify-center rounded-pill bg-accent px-5 text-[15px] font-display font-semibold text-white shadow-float active:scale-95 disabled:opacity-70";

// Chi non ha l'accesso va a login/registrazione con `returnPath`: finito (anche l'onboarding)
// torna qui con "salva=1" e trova il pulsante evidenziato (`highlight`). Il salvataggio
// parte SOLO dal suo tocco: nessuna scrittura automatica.
export default function SalvaLocale({
  placeId,
  placeName,
  userId,
  returnPath,
  highlight = false,
  consigliatoDa = null,
}: {
  placeId: string;
  placeName: string;
  userId: string | null;
  returnPath: string;
  highlight?: boolean;
  // Proposta 58: nome di chi l'ha consigliato, dal link (?da=Giulia), già ripulito dalla pagina.
  consigliatoDa?: string | null;
}) {
  const [state, setState] = useState<"idle" | "saving" | "saved" | "already" | "error">("idle");
  // È la nota di chi salva: può toglierlo o cambiarlo prima di salvare.
  const [da, setDa] = useState<string | null>(consigliatoDa);
  const [daBozza, setDaBozza] = useState<string | null>(null);
  const [erroreNome, setErroreNome] = useState(false);
  // Vuoto = togli il nome; cifre o simboli = resta il nome di prima e si dice perché (mai cancellato in silenzio).
  const confermaDa = () => {
    if (daBozza === null) return;
    const campo = leggiCampoNome(daBozza);
    if (!campo.valido) { setErroreNome(true); return; }
    setDa(campo.nome);
    setDaBozza(null);
    setErroreNome(false);
  };
  // Chi apre il proprio link non vede "Te l'ha consigliato <sé stesso>": si confronta con il proprio primo nome
  // (stessa lettura del profilo di Condividi). Finché non si sa, la riga non compare.
  const [controllato, setControllato] = useState(!userId || !consigliatoDa);
  const controllo = useRef<Promise<void> | null>(null);
  const sonoIo = useRef(false);
  // Revisore 15/11 (secondo): chi si chiama come chi gli consiglia il posto (Giulia da Giulia) perdeva la riga.
  // Ora non si salva da solo ma si chiede: "Te l'ha consigliato Giulia? Sì".
  const [omonimo, setOmonimo] = useState(false);
  useEffect(() => {
    if (!userId || !consigliatoDa) return;
    let vivo = true;
    const p = mioNome(userId).then((m) => {
      if (!vivo) return;
      if (stessoNome(m.nome, consigliatoDa)) {
        sonoIo.current = true;
        setOmonimo(true);
        setDa((cur) => (cur === consigliatoDa ? null : cur));
      }
      setControllato(true);
    });
    controllo.current = p;
    return () => { vivo = false; };
  }, [userId, consigliatoDa]);

  const save = async () => {
    if (!userId || state === "saving") return;
    // Revisore 15/11 (secondo): "Marco 2" scritto e poi Salva senza OK partiva con il nome vecchio, in silenzio.
    // Come in Modifica: con un nome non valido nel campo non si salva e l'errore resta in vista.
    if (daBozza !== null && daBozza.trim() !== "" && !leggiCampoNome(daBozza).valido) { setErroreNome(true); return; }
    setState("saving");
    // Senza rete il codice di Supabase potrebbe non essere ancora scaricato: errore, non pulsante bloccato.
    const client = await browserClient().catch(() => null);
    if (!client) { setState("error"); return; }
    if (controllo.current) await controllo.current;
    const campo = daBozza !== null ? leggiCampoNome(daBozza) : null;
    // Il nome proprio (arrivato dal proprio link) non si salva mai.
    const scelto = campo ? (campo.valido ? campo.nome : da) : da;
    const nome = scelto && !(sonoIo.current && scelto === consigliatoDa) ? scelto : null;
    const row: Record<string, unknown> = { user_id: userId, place_id: placeId, tags: [WANT_TAG], note: null };
    let { error } = await client.from("saved_places").insert(nome ? { ...row, consigliato_da: nome } : row);
    // Colonna consigliato_da non ancora creata (migrazione 20261115e): si salva senza il nome.
    if (nome && (error?.code === "PGRST204" || error?.code === "42703")) ({ error } = await client.from("saved_places").insert(row));
    if (error && error.code === "23505") {
      // Già salvato: il nome si aggiunge solo se sul salvato non c'era (mai sopra quello scritto prima).
      if (nome) {
        await client.from("saved_places").update({ consigliato_da: nome })
          .eq("user_id", userId).eq("place_id", placeId).is("consigliato_da", null)
          .then(() => {}, () => {});
      }
      setState("already");
    }
    else if (error) setState("error");
    else setState("saved");
  };

  const done = state === "saved" || state === "already";

  return (
    <>
      {/* Solo per chi non ha l'accesso: chi è già dentro Mapetite ha il pulsante qui sotto e basta
          (Lorenzo 17/10, una cosa principale). "Scopri Mapetite" era un doppione del marchio in alto. */}
      {!userId && (
        <section data-testid="invito-mapetite" className="mx-5 mt-6 rounded-card border border-border bg-surface p-4">
          <p data-testid="invito-titolo" className="font-display text-base font-semibold text-brand">
            {consigliatoDa ? `${consigliatoDa} ti ha consigliato ${placeName}` : `Ti hanno consigliato ${placeName}?`}
          </p>
          <p data-testid="invito-accedi" className="mt-1 text-sm font-sans text-text-muted">
            Salvalo in Mapetite e lo ritrovi sulla tua mappa quando devi scegliere.{" "}
            <Link href={withNext("/login", returnPath)} className="font-display font-semibold text-brand">Hai già un account? Accedi</Link>
          </p>
        </section>
      )}

      <div className="sticky bottom-[calc(var(--nav-height-mobile)+var(--nav-sporgenza)+0.5rem)] z-10 mt-6 px-5">
        {done ? (
          <div role="status" data-testid="salvato-pubblico" className="flex flex-col gap-2 rounded-card bg-brand p-3 shadow-float">
            <p className="text-center text-sm font-display font-semibold text-white">
              {state === "saved" ? "✓ Salvato tra i tuoi “Da provare”" : "✓ È già tra i tuoi salvati"}
            </p>
            <Link
              href={`/mappa?salvato=${placeId}`}
              className="inline-flex min-h-11 items-center justify-center rounded-pill bg-white px-5 text-sm font-display font-semibold text-brand"
            >
              Aprilo sulla tua mappa
            </Link>
          </div>
        ) : userId ? (
          <>
            {/* Proposta 58: chi te l'ha consigliato, una riga discreta sopra Salva (si toglie o si cambia). */}
            {daBozza !== null ? (
              <>
              <p className="mb-1 px-3 font-display text-[10.5px] font-semibold uppercase tracking-[0.14em] text-text-muted">Te l&apos;ha consigliato</p>
              <form
                data-testid="consigliato-campo"
                onSubmit={(e) => { e.preventDefault(); confermaDa(); }}
                className="mb-2 flex items-center gap-2 rounded-pill bg-surface px-2 shadow-card"
              >
                <input
                  autoFocus
                  value={daBozza}
                  onChange={(e) => { setDaBozza(e.target.value); setErroreNome(false); }}
                  onBlur={confermaDa}
                  maxLength={CONSIGLIATO_MAX}
                  enterKeyHint="done"
                  placeholder="Chi te l'ha consigliato?"
                  aria-label="Chi te l'ha consigliato?"
                  aria-invalid={erroreNome}
                  className="min-h-11 min-w-0 flex-1 bg-transparent px-2 text-base font-sans text-text focus:outline-none"
                />
                <button type="submit" className="min-h-11 min-w-11 shrink-0 rounded-pill px-3 text-sm font-display font-semibold text-brand">OK</button>
              </form>
              {erroreNome && (
                <p data-testid="consigliato-errore" role="alert" className="-mt-1 mb-2 text-center text-xs font-sans text-error">
                  {NOME_NON_VALIDO}{da ? ` · resta ${da}` : ""}
                </p>
              )}
              </>
            ) : da && controllato ? (
              <p data-testid="consigliato-riga" className="mb-2 flex items-center justify-center gap-1 text-sm font-sans text-text-muted">
                <span className="truncate">Te l&apos;ha consigliato <span className="font-display font-semibold text-brand">{da}</span></span>
                <button type="button" data-testid="consigliato-cambia" onClick={() => setDaBozza(da)} className="min-h-11 shrink-0 px-2 font-display text-xs font-semibold text-brand underline underline-offset-2">
                  Cambia
                </button>
                <button type="button" data-testid="consigliato-togli" onClick={() => setDa(null)} aria-label="Togli chi te l'ha consigliato" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-text-muted">
                  <X size={14} aria-hidden />
                </button>
              </p>
            ) : omonimo && !da && consigliatoDa && controllato ? (
              <p data-testid="consigliato-chiedi" className="mb-2 flex items-center justify-center gap-1 text-sm font-sans text-text-muted">
                <span className="truncate">Te l&apos;ha consigliato <span className="font-display font-semibold text-brand">{consigliatoDa}</span>?</span>
                <button
                  type="button"
                  data-testid="consigliato-si"
                  onClick={() => { sonoIo.current = false; setOmonimo(false); setDa(consigliatoDa); }}
                  className="min-h-11 min-w-11 shrink-0 px-2 font-display text-xs font-semibold text-brand underline underline-offset-2"
                >
                  Sì
                </button>
              </p>
            ) : null}
            {highlight && (
              <p data-testid="salva-evidenziato" className="mb-2 rounded-card bg-brand px-4 py-2.5 text-center text-sm font-display font-semibold text-white shadow-float">
                Ci sei! Tocca qui sotto per salvarlo nella tua mappa.
              </p>
            )}
            <button
              type="button"
              onClick={save}
              disabled={state === "saving"}
              className={`${PRIMARY}${highlight ? " ring-4 ring-accent/35 ring-offset-2 ring-offset-bg" : ""}`}
            >
              {state === "saving" ? "Salvo…" : "📌 Salva in Mapetite"}
            </button>
          </>
        ) : (
          <Link href={withNext("/signup", returnPath)} className={PRIMARY}>
            📌 Salva in Mapetite
          </Link>
        )}
        {state === "error" && (
          <p role="alert" className="mt-2 rounded-pill bg-surface px-3 py-1 text-center text-xs font-sans text-error shadow-card">
            Non sono riuscito a salvarlo. Riprova.
          </p>
        )}
      </div>
    </>
  );
}
