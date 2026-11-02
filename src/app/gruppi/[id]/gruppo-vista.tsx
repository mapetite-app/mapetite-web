"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Plus, ThumbsUp, X } from "lucide-react";
import Avatar from "@/components/avatar";
import CondividiLink from "@/components/condividi-link";
import { getCategoryEmoji } from "@/lib/emoji";
import { categoryLabel } from "@/lib/category-label";
import { cityFromAddress } from "@/lib/city";
import { invitoGruppoPath, numeriGruppo, ordinaPosti, votantiLabel, type Gruppo, type Membro, type PostoGruppo } from "@/lib/gruppi";
import { aggiungiPosto, esciDalGruppo, togliPosto, vota } from "@/lib/gruppi-write";
import { trackFeature } from "@/lib/track";

type Salvato = {
  placeId: string;
  name: string;
  category: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  googlePlaceId: string | null;
};

function meta(p: { category: string | null; address: string | null }): string {
  return [categoryLabel(p.category), cityFromAddress(p.address)].filter(Boolean).join(" · ");
}

export default function GruppoVista({
  userId,
  gruppo,
  membri,
  postiIniziali,
  salvati,
  appenaCreata,
}: {
  userId: string;
  gruppo: Gruppo;
  membri: Membro[];
  postiIniziali: PostoGruppo[];
  salvati: Salvato[];
  appenaCreata: boolean;
}) {
  const router = useRouter();
  const [posti, setPosti] = useState(postiIniziali);
  const [errore, setErrore] = useState<string | null>(null);
  const [scegli, setScegli] = useState(false);
  const [filtro, setFiltro] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [esci, setEsci] = useState(false);

  const mioNome = membri.find((m) => m.user_id === userId)?.nome ?? "Tu";
  const ordinati = useMemo(() => ordinaPosti(posti), [posti]);
  const giaDentro = useMemo(() => new Set(posti.map((p) => p.place_id)), [posti]);
  const candidati = useMemo(() => {
    const q = filtro.trim().toLowerCase();
    return salvati.filter((s) => !giaDentro.has(s.placeId) && (!q || s.name.toLowerCase().includes(q) || (s.address ?? "").toLowerCase().includes(q)));
  }, [salvati, giaDentro, filtro]);
  const invito = invitoGruppoPath(gruppo.codice);

  const toggleVoto = async (p: PostoGruppo) => {
    if (busy) return;
    const si = !p.ho_votato;
    const cambia = (x: PostoGruppo, on: boolean): PostoGruppo => ({
      ...x,
      ho_votato: on,
      voti: Math.max(0, x.voti + (on ? 1 : -1)),
      votanti: on ? [...x.votanti, mioNome] : x.votanti.filter((n, i) => !(n === mioNome && i === x.votanti.lastIndexOf(mioNome))),
    });
    setErrore(null);
    setPosti((all) => all.map((x) => (x.posto_id === p.posto_id ? cambia(x, si) : x)));
    trackFeature("gruppo_voto", { stato: si ? "si" : "tolto" });
    const r = await vota(p.posto_id, userId, si);
    if (!r.ok) {
      setPosti((all) => all.map((x) => (x.posto_id === p.posto_id ? cambia(x, !si) : x)));
      setErrore(r.errore);
    }
  };

  const aggiungi = async (s: Salvato) => {
    if (busy) return;
    setBusy(s.placeId);
    setErrore(null);
    const r = await aggiungiPosto(gruppo.id, s.placeId, userId);
    setBusy(null);
    if (!r.ok) {
      setErrore(r.errore);
      return;
    }
    trackFeature("gruppo_aggiungi", { fonte: "salvati" });
    setPosti((all) => [
      ...all,
      {
        posto_id: r.data ?? `nuovo-${s.placeId}`,
        place_id: s.placeId,
        google_place_id: s.googlePlaceId,
        name: s.name,
        category: s.category,
        address: s.address,
        lat: s.lat,
        lng: s.lng,
        aggiunto_da: userId,
        aggiunto_da_nome: mioNome,
        created_at: new Date().toISOString(),
        voti: 0,
        votanti: [],
        ho_votato: false,
      },
    ]);
    // Già proposto da qualcun altro nel frattempo: si ricarica per avere il posto vero.
    if (r.data == null) router.refresh();
  };

  const togli = async (p: PostoGruppo) => {
    if (busy) return;
    setBusy(p.posto_id);
    const r = await togliPosto(p.posto_id);
    setBusy(null);
    if (!r.ok) {
      setErrore(r.errore);
      return;
    }
    trackFeature("gruppo_togli");
    setPosti((all) => all.filter((x) => x.posto_id !== p.posto_id));
  };

  const esciOra = async () => {
    setBusy("esci");
    const r = await esciDalGruppo(gruppo.id, userId);
    if (!r.ok) {
      setBusy(null);
      setErrore(r.errore);
      return;
    }
    trackFeature("gruppo_esci");
    router.push("/gruppi");
    router.refresh();
  };

  const totaleVoti = posti.reduce((n, p) => n + p.voti, 0);
  // Riquadro grande solo finché nella lista non c'è nessun altro (o appena creata).
  const invitoGrande = appenaCreata || membri.length <= 1;
  const testoInvito = `Scegliamo insieme dove andare: entra in "${gruppo.nome}" su Mapetite e vota il tuo posto preferito.`;

  return (
    <div>
      <header className="mt-2 flex items-center gap-3">
        <span aria-hidden className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-accent-light text-3xl">{gruppo.emoji}</span>
        <div className="min-w-0 flex-1">
          <h1 className="font-title text-2xl font-semibold leading-tight text-text break-words">{gruppo.nome}</h1>
          <p className="mt-0.5 text-sm text-text-muted" data-testid="gruppo-numeri">{numeriGruppo({ membri: membri.length || gruppo.membri, posti: posti.length })}</p>
        </div>
      </header>

      {membri.length > 0 && (
        <div className="mt-4 flex items-center gap-3">
          <ul data-testid="gruppo-membri" className="-ml-4 flex min-w-0 flex-1 gap-3 overflow-x-auto pb-1 pl-4" aria-label="Chi c'è nella lista">
            {membri.map((m) => (
              <li key={m.user_id} className="flex w-14 shrink-0 flex-col items-center gap-1 text-center">
                <Avatar person={{ display_name: m.nome }} size={44} />
                <span className="w-full truncate text-[11px] font-display text-text">{m.user_id === userId ? "Tu" : m.nome}</span>
              </li>
            ))}
          </ul>
          {/* Con gli amici già dentro l'invito è un pulsante piccolo: in primo piano restano i posti e i voti. */}
          {!invitoGrande && (
            <CondividiLink
              path={invito}
              title={`${gruppo.nome} · Mapetite`}
              text={testoInvito}
              cosa="gruppo"
              label="Invita"
              variant="outline"
              testId="gruppo-condividi"
              className="shrink-0"
            />
          )}
        </div>
      )}

      {invitoGrande && (
        <section data-testid="gruppo-invita" className="mt-4 rounded-card bg-brand p-4 text-white">
          <p className="font-display text-[15px] font-semibold text-white">
            {appenaCreata ? "Lista creata! Ora invita gli amici" : "Invita gli amici nella lista"}
          </p>
          <p className="mt-0.5 text-sm text-white/80">
            Manda il link nel vostro gruppo WhatsApp: chi lo apre entra, propone posti e vota.
          </p>
          <CondividiLink
            path={invito}
            title={`${gruppo.nome} · Mapetite`}
            text={testoInvito}
            cosa="gruppo"
            label="Condividi il link d'invito"
            variant="outline"
            testId="gruppo-condividi"
            className="mt-3 w-full"
          />
        </section>
      )}

      <section className="mt-6" aria-labelledby="posti-titolo">
        <div className="flex items-center justify-between gap-2">
          <h2 id="posti-titolo" className="text-xs font-display font-semibold uppercase tracking-wider text-text-muted">
            Posti proposti{posti.length > 0 ? ` · ${posti.length}` : ""}
          </h2>
          {totaleVoti > 0 && <span className="text-xs text-text-muted">{totaleVoti === 1 ? "1 voto" : `${totaleVoti} voti`}</span>}
        </div>

        {errore && <p role="alert" className="mt-2 text-sm font-sans text-error">{errore}</p>}

        {ordinati.length === 0 ? (
          <div data-testid="gruppo-vuoto" className="mt-2 rounded-card border border-border bg-surface p-5 text-center">
            <p className="font-display text-base font-semibold text-brand">Nessun posto proposto</p>
            <p className="mx-auto mt-1 max-w-xs text-sm text-text-muted">Proponi il primo dai tuoi salvati, o dalla scheda di un locale con &quot;Proponi in una lista di gruppo&quot;.</p>
          </div>
        ) : (
          <ol className="mt-2 flex flex-col gap-2" data-testid="gruppo-posti">
            {ordinati.map((p, i) => {
              const inTesta = i === 0 && p.voti > 0 && (ordinati[1]?.voti ?? 0) < p.voti;
              const m = meta(p);
              return (
                <li
                  key={p.posto_id}
                  data-testid="gruppo-posto"
                  data-voti={p.voti}
                  className={`flex items-center gap-3 rounded-card border bg-white p-3 shadow-card ${inTesta ? "border-accent" : "border-border"}`}
                >
                  <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-btn bg-accent-light text-xl">
                    {getCategoryEmoji(p.category, p.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    {inTesta && (
                      <span data-testid="gruppo-in-testa" className="mb-0.5 inline-block rounded-pill bg-accent px-2 py-0.5 text-[11px] font-display font-semibold text-white">
                        🏆 In testa
                      </span>
                    )}
                    <Link href={`/locali/${p.place_id}`} className="block truncate font-display text-[15px] font-semibold text-text">
                      {p.name}
                    </Link>
                    {m && <span className="block truncate text-xs text-text-muted">{m}</span>}
                    <span className="mt-0.5 block truncate text-xs text-text-muted">
                      {votantiLabel(p.votanti)}
                      {p.aggiunto_da_nome ? ` · proposto da ${p.aggiunto_da === userId ? "te" : p.aggiunto_da_nome}` : ""}
                    </span>
                  </div>
                  {p.aggiunto_da === userId && p.voti === 0 && (
                    <button
                      type="button"
                      onClick={() => togli(p)}
                      disabled={!!busy}
                      aria-label={`Togli ${p.name} dalla lista`}
                      className="flex h-10 w-8 shrink-0 items-center justify-center text-text-muted"
                    >
                      <X size={16} aria-hidden />
                    </button>
                  )}
                  <button
                    type="button"
                    data-testid="gruppo-vota"
                    onClick={() => toggleVoto(p)}
                    aria-pressed={p.ho_votato}
                    aria-label={p.ho_votato ? `Togli il tuo voto a ${p.name}` : `Vota ${p.name}`}
                    className={`flex min-h-11 min-w-14 shrink-0 items-center justify-center gap-1 rounded-pill px-3 text-sm font-display font-semibold active:scale-95 transition-colors duration-150 ${
                      p.ho_votato ? "bg-brand text-white" : "border border-border bg-white text-brand"
                    }`}
                  >
                    <ThumbsUp size={16} aria-hidden className="shrink-0" />
                    <span>{p.voti}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        )}

        {!scegli ? (
          <button
            type="button"
            data-testid="gruppo-aggiungi"
            onClick={() => { setScegli(true); trackFeature("gruppo_apri_salvati"); }}
            className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-pill bg-accent px-4 text-[15px] font-display font-semibold text-white shadow-card active:scale-[0.98]"
          >
            <Plus size={18} aria-hidden /> Proponi dai tuoi salvati
          </button>
        ) : (
          <div data-testid="gruppo-salvati" className="mt-3 rounded-card border border-border bg-white p-3 shadow-card">
            <div className="flex items-center justify-between gap-2">
              <p className="font-display text-[15px] font-semibold text-brand">I tuoi salvati</p>
              <button type="button" onClick={() => setScegli(false)} className="min-h-10 px-2 text-sm font-display font-semibold text-text-muted">Chiudi</button>
            </div>
            {salvati.length > 6 && (
              <input
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
                placeholder="Cerca tra i tuoi salvati"
                aria-label="Cerca tra i tuoi salvati"
                className="mt-2 min-h-11 w-full rounded-btn border border-border bg-white px-3 text-base font-sans text-text outline-none focus:border-brand"
              />
            )}
            {salvati.length === 0 ? (
              <p className="py-4 text-center text-sm text-text-muted">
                Non hai ancora salvato posti. <Link href="/mappa" className="font-display font-semibold text-accent">Cercane uno sulla mappa</Link>
              </p>
            ) : candidati.length === 0 ? (
              <p className="py-4 text-center text-sm text-text-muted">{filtro ? "Nessun salvato con questo nome." : "Hai già proposto tutti i tuoi salvati."}</p>
            ) : (
              <ul className="mt-2 max-h-80 divide-y divide-border overflow-y-auto">
                {candidati.slice(0, 60).map((s) => (
                  <li key={s.placeId}>
                    <button
                      type="button"
                      data-testid="gruppo-salvato"
                      onClick={() => aggiungi(s)}
                      disabled={!!busy}
                      className="flex min-h-14 w-full items-center gap-3 py-2 text-left disabled:opacity-60"
                    >
                      <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-btn bg-surface text-lg">{getCategoryEmoji(s.category, s.name)}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-display text-sm font-semibold text-text">{s.name}</span>
                        {meta(s) && <span className="block truncate text-xs text-text-muted">{meta(s)}</span>}
                      </span>
                      <span className="shrink-0 font-display text-sm font-semibold text-accent">{busy === s.placeId ? "…" : "+ Proponi"}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      <div className="mt-10 text-center">
        {!esci ? (
          <button type="button" onClick={() => setEsci(true)} className="min-h-11 px-3 text-sm font-display font-semibold text-text-muted">
            Esci dalla lista
          </button>
        ) : (
          <div className="rounded-card border border-border bg-surface p-4">
            <p className="text-sm text-text">Uscire da &quot;{gruppo.nome}&quot;? I posti che hai proposto restano agli altri.</p>
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={() => setEsci(false)} className="min-h-11 flex-1 rounded-pill border border-border bg-white text-sm font-display font-semibold text-brand">Resta</button>
              <button type="button" onClick={esciOra} disabled={busy === "esci"} data-testid="gruppo-esci" className="min-h-11 flex-1 rounded-pill bg-error text-sm font-display font-semibold text-white disabled:opacity-60">Esci</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
