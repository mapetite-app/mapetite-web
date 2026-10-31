"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { browserClient } from "@/lib/supabase/client-lazy";
import { cityFromAddress, displayAddress } from "@/lib/city";
import { saveSearchPlace, rememberPendingLink, type LinkOutcome, type SearchPlace } from "@/lib/save-from-link";
import { rememberFirme } from "@/lib/catalog-firme";
import { addReel } from "@/lib/community-write";
import { findReelLink, instagramEmbedUrl, reelSourceOf, type ReelSource } from "@/lib/reel";
import { findVideoLink } from "@/lib/video-caption";
import { findSocialLink, placeHintFromText } from "@/lib/social-link";
import { confidentMatch, stessoLocale } from "@/lib/reel-match";
import { screenshotForUpload } from "@/lib/screenshot-upload";
import { trackFeature } from "@/lib/track";
import PlacePhoto from "@/components/place-photo";
import QuandoCiVai from "@/components/quando-ci-vai";
import { getCategoryEmoji } from "@/lib/emoji";

// "Salva dal reel" in un gesto (sprint 25/10, chiave di volta A). Dal link condiviso o incollato:
//  - TikTok/YouTube: si legge da soli la didascalia (oEmbed ufficiale) → l'AI trova i locali;
//  - Instagram (non leggibile senza un'app Meta) o video illeggibile: UN solo passo, screenshot o
//    nome/didascalia scritti a mano;
//  - il primo locale si cerca su Google (1 ricerca) e, se combacia di sicuro, si salva da solo con
//    "Non è questo" per annullare; altrimenti "È questo?". Gli altri locali del reel: un tocco ciascuno.
// Il link del reel resta collegato al locale ("Visto su …" nella scheda). Mai locali inventati:
// si salva solo un risultato di Google, e solo se il nome letto nel video è dentro il nome Google.

export type Luogo = { nome: string; citta: string | null; categoria: string | null };
type Lettura = { nome: string | null; citta: string | null; categoria: string | null; luoghi?: Luogo[] };

function errorText(e: unknown): string {
  if (e instanceof TypeError) return "Errore di rete. Controlla la connessione e riprova.";
  return e instanceof Error && e.message ? e.message : "Qualcosa è andato storto, riprova.";
}

export function luoghiOf(r: Lettura | null | undefined): Luogo[] {
  if (!r) return [];
  if (r.luoghi && r.luoghi.length > 0) return r.luoghi;
  return r.nome ? [{ nome: r.nome, citta: r.citta, categoria: r.categoria }] : [];
}

// Riaperta o ricaricata: niente seconda lettura AI né seconda ricerca Google a pagamento.
function cached<T>(key: string): T | null {
  try { return JSON.parse(sessionStorage.getItem(key) ?? "null") as T | null; } catch { return null; }
}
function remember(key: string, v: unknown) {
  try { sessionStorage.setItem(key, JSON.stringify(v)); } catch { /* storage non disponibile */ }
}

async function readReel(body: { link: string } | { caption: string } | { image: string }): Promise<Luogo[]> {
  const res = await fetch("/api/import-caption", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? "Non riesco a leggere il locale.");
  return luoghiOf(data as Lettura);
}

async function searchPlaces(query: string): Promise<SearchPlace[]> {
  const key = `mapetite.reel-ricerca:${query}`;
  const hit = cached<SearchPlace[]>(key);
  if (Array.isArray(hit)) { rememberFirme(hit); return hit; }
  const res = await fetch("/api/places/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? "Non riesco a cercare il locale su Google Maps. Riprova.");
  const found = (((data as { results?: SearchPlace[] }).results) ?? []).slice(0, 5);
  rememberFirme(found);
  remember(key, found);
  return found;
}

const queryOf = (l: Luogo) => [l.nome, l.citta].filter(Boolean).join(" ");
const labelOf = (l: Luogo) => [l.nome, l.citta].filter(Boolean).join(", ");

export default function ReelSave({
  text,
  userId,
  initial = null,
  autoSave = true,
}: {
  // Testo condiviso o incollato (con il link del reel), anche vuoto se arriva solo uno screenshot.
  text: string;
  userId: string | null;
  // Locali già letti (screenshot condiviso da Android): si salta la lettura.
  initial?: Luogo[] | null;
  // false: si chiede sempre "È questo?" (lettura arrivata da un link che non sappiamo chi ha aperto).
  autoSave?: boolean;
}) {
  const reelUrl = findReelLink(text);
  const source: ReelSource | null = (reelUrl ? reelSourceOf(reelUrl) : null) ?? findSocialLink(text);
  const video = findVideoLink(text);
  const readKey = `mapetite.reel-letto:${reelUrl ?? text}`;
  const [luoghi, setLuoghi] = useState<Luogo[] | null>(initial && initial.length > 0 ? initial : null);
  const [reading, setReading] = useState(false);
  const [ask, setAsk] = useState<string | null>(null);
  const [draft, setDraft] = useState(() => placeHintFromText(text) ?? "");
  const [error, setError] = useState<string | null>(null);
  // Lettura chiesta con un tocco qui (screenshot, nome scritto): vale come il gesto del Condividi.
  const [daTocco, setDaTocco] = useState(false);
  // Reel Instagram incorporato (embed ufficiale di Meta) per leggere nome e posizione senza uscire
  // dall'app: Meta non dà la didascalia alle altre app (oEmbed senza token provato il 29/10), ma il
  // post si può mostrare. Si carica solo su richiesta: pesa e parla con Instagram.
  const embed = source === "Instagram" && reelUrl ? instagramEmbedUrl(reelUrl) : null;
  const [showEmbed, setShowEmbed] = useState(false);
  const started = useRef(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  const askFor = (why: string) => { setReading(false); setAsk(why); };

  // Una o più letture (le slide di un carosello, proposta 13): i locali si uniscono senza doppioni.
  const read = (body: { link: string } | { caption: string } | { image: string } | { image: string }[]) => {
    setReading(true);
    setError(null);
    const bodies = Array.isArray(body) ? body : [body];
    void Promise.allSettled(bodies.map((b) => readReel(b)))
      .then((all) => {
        const ok = all.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
        if (ok.length === 0) throw (all[0] as PromiseRejectedResult).reason;
        const found: Luogo[] = [];
        for (const l of ok.flat()) if (found.length < 8 && !found.some((x) => stessoLocale(x.nome, l.nome))) found.push(l);
        return found;
      })
      .then((found) => {
        trackFeature("reel_salva", { stato: found.length > 0 ? "letto" : "illeggibile", fonte: source ?? "screenshot", n: found.length, immagini: bodies.length });
        if (found.length === 0) {
          askFor("Qui non trovo il nome di un locale.");
          return;
        }
        remember(readKey, found);
        setAsk(null);
        setReading(false);
        setLuoghi(found);
      })
      .catch((e) => {
        setReading(false);
        // Video privato o rimosso: si passa allo screenshot invece di fermarsi.
        if (!Array.isArray(body) && "link" in body) askFor("Non riesco a leggere questo video.");
        else setError(errorText(e));
      });
  };

  useEffect(() => {
    if (started.current || luoghi || !userId) return;
    started.current = true;
    const hit = cached<Luogo[]>(readKey);
    const t = window.setTimeout(() => {
      if (Array.isArray(hit) && hit.length > 0) { setLuoghi(hit); return; }
      if (video) { read({ link: video }); return; }
      // Instagram con un nome nel testo condiviso ("Pizzeria Bella a Roma 🍕 https://…"): lo legge l'AI.
      const hint = placeHintFromText(text);
      if (hint) { read({ caption: hint }); return; }
      askFor(source === "Instagram"
        ? "Instagram non lascia leggere i reel alle altre app."
        : "Da questo link non posso leggere il video.");
    }, 0);
    // In sviluppo React monta due volte: annullato il primo giro, il secondo deve ripartire.
    return () => { window.clearTimeout(t); started.current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    // Fino a 5 screenshot insieme: le slide di un carosello "5 posti dove…".
    const files = Array.from(e.target.files ?? []).slice(0, 5);
    e.target.value = "";
    if (files.length === 0) return;
    trackFeature("import_screenshot", { n: files.length });
    setDaTocco(true);
    setReading(true);
    const images = await Promise.all(files.map((f) => screenshotForUpload(f)));
    read(images.length === 1 ? { image: images[0] } : images.map((image) => ({ image })));
  };

  if (!userId) {
    return (
      <div className="space-y-3 rounded-card border border-border bg-surface p-5" data-testid="reel-accedi">
        <p className="text-sm text-text">Per salvare i locali di questo reel accedi a Mapetite: il link resta qui e lo ritrovi dopo l&apos;accesso.</p>
        <div className="flex flex-wrap gap-2">
          <Link href="/login?next=%2Fimporta" onClick={() => rememberPendingLink(text)} className="inline-flex min-h-11 items-center rounded-pill bg-brand px-4 text-sm font-display font-semibold text-white">
            Accedi
          </Link>
          <Link href="/signup?next=%2Fimporta" onClick={() => rememberPendingLink(text)} className="inline-flex min-h-11 items-center rounded-pill border border-border bg-white px-4 text-sm font-display font-semibold text-brand">
            Crea un account
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="reel-salva">
      {reading && (
        <div className="flex items-center gap-3 rounded-card border border-border bg-surface p-4" data-testid="reel-lettura" aria-live="polite">
          <span aria-hidden className="inline-block h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-brand/20 border-t-brand" />
          <p className="text-sm text-text">{luoghi ? "Cerco…" : `Leggo il reel${source ? ` di ${source}` : ""} e cerco il locale…`}</p>
        </div>
      )}

      {ask && !reading && (
        <div className="space-y-3 rounded-card border border-border bg-surface p-4" data-testid="reel-chiedi">
          <p className="text-sm text-text">
            <span aria-hidden>📸 </span>
            {ask} Fai uno screenshot del reel dove si vede il nome o la posizione del locale (anche più slide insieme): al resto penso io.
          </p>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            data-testid="reel-screenshot"
            className="min-h-12 w-full rounded-pill bg-brand px-4 text-base font-display font-semibold text-white active:scale-[0.99]"
          >
            📸 Carica lo screenshot
          </button>
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={onFile} aria-label="Screenshot del reel" />
          <form
            className="flex gap-2"
            onSubmit={(e) => { e.preventDefault(); if (draft.trim()) { setDaTocco(true); read({ caption: draft.trim().slice(0, 2000) }); } }}
          >
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              ref={nameRef}
              placeholder={showEmbed ? "Scrivi il nome che vedi" : "Oppure scrivi il nome"}
              aria-label="Nome del locale o didascalia del reel"
              data-testid="reel-testo"
              className="min-h-11 min-w-0 flex-1 scroll-mt-20 rounded-pill border border-border bg-white px-4 text-base text-text focus:border-brand focus:outline-none"
            />
            <button type="submit" disabled={!draft.trim()} className="min-h-11 shrink-0 rounded-pill border border-border bg-white px-4 text-sm font-display font-semibold text-brand disabled:opacity-50">
              Trova
            </button>
          </form>
          {embed && !showEmbed && (
            <button
              type="button"
              onClick={() => { setShowEmbed(true); nameRef.current?.scrollIntoView({ block: "start", behavior: "smooth" }); trackFeature("reel_salva", { stato: "guarda_reel", fonte: "Instagram" }); }}
              data-testid="reel-guarda"
              className="min-h-11 w-full rounded-pill border border-border bg-white px-4 text-sm font-display font-semibold text-brand"
            >
              ▶ Guarda il reel
            </button>
          )}
          {embed && showEmbed && (
            <iframe
              src={embed}
              title="Reel di Instagram"
              data-testid="reel-embed"
              referrerPolicy="strict-origin-when-cross-origin"
              sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
              className="h-[55vh] w-full rounded-card border border-border bg-white"
            />
          )}
        </div>
      )}

      {error && (
        <p className="rounded-btn bg-error/10 px-4 py-3 text-sm text-error" data-testid="reel-errore">{error}</p>
      )}

      {luoghi && (
        <>
          <PlaceRow key={queryOf(luoghi[0])} luogo={luoghi[0]} userId={userId} reelUrl={reelUrl} source={source} auto autoSave={autoSave || daTocco} />
          {luoghi.length > 1 && (
            <div className="space-y-2 pt-1" data-testid="reel-altri">
              <p className="text-sm font-semibold text-text">Nel reel ci sono anche</p>
              {luoghi.slice(1).map((l) => (
                <PlaceRow key={queryOf(l)} luogo={l} userId={userId} reelUrl={reelUrl} source={source} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

type RowState =
  | { s: "idle" }
  | { s: "searching" }
  | { s: "found"; top: SearchPlace; rest: SearchPlace[] }
  | { s: "saving"; top: SearchPlace; rest: SearchPlace[] }
  | { s: "saved"; top: SearchPlace; rest: SearchPlace[]; out: LinkOutcome; auto: boolean }
  | { s: "choose"; options: SearchPlace[] }
  | { s: "none" }
  | { s: "error"; msg: string };

function PlaceRow({
  luogo,
  userId,
  reelUrl,
  source,
  auto = false,
  autoSave = true,
}: {
  luogo: Luogo;
  userId: string;
  reelUrl: string | null;
  source: ReelSource | null;
  auto?: boolean;
  autoSave?: boolean;
}) {
  const savedKey = `mapetite.reel-salvato:${reelUrl ?? ""}:${queryOf(luogo)}`;
  const [st, setSt] = useState<RowState>(auto ? { s: "searching" } : { s: "idle" });
  const [tolto, setTolto] = useState(false);
  const [reelOk, setReelOk] = useState(false);
  // Collegamento del reel in corso: "Non è questo" aspetta, così il reel non resta sul locale sbagliato.
  const [linking, setLinking] = useState(false);
  const [manual, setManual] = useState(luogo.nome);
  const started = useRef(false);
  const fonte = source ?? "screenshot";
  const noKey = `mapetite.reel-no:${reelUrl ?? ""}:${queryOf(luogo)}`;

  const save = async (top: SearchPlace, rest: SearchPlace[], isAuto: boolean) => {
    setSt({ s: "saving", top, rest });
    try {
      const out = await saveSearchPlace(top, userId);
      const done: RowState = { s: "saved", top, rest, out, auto: isAuto };
      setSt(done);
      remember(savedKey, done);
      trackFeature("reel_salva", { stato: isAuto ? "auto" : "confermato", fonte });
      if (reelUrl && out.place) {
        setLinking(true);
        try {
          const r = await addReel(userId, out.place.id, reelUrl);
          setReelOk(r.esito === "ok" || r.esito === "doppio");
          if (r.esito === "ok") trackFeature("reel", { stato: "salvato_import", fonte: reelSourceOf(reelUrl) ?? "", contesto: "reel" });
        } finally {
          setLinking(false);
        }
      }
    } catch (e) {
      setSt({ s: "error", msg: errorText(e) });
    }
  };

  const search = (query: string, isFirst: boolean) => {
    setSt({ s: "searching" });
    void searchPlaces(query)
      .then((found) => {
        if (found.length === 0) { setSt({ s: "none" }); return; }
        const [top, ...rest] = found;
        // Dopo un "Non è questo" (anche riaperta) il locale scartato non si ripropone: si sceglie tra gli altri.
        const scartato = cached<string>(noKey);
        if (isFirst && typeof scartato === "string") { setSt({ s: "choose", options: found.filter((r) => r.id !== scartato) }); return; }
        // Solo la prima ricerca, con il nome letto dal reel, può salvare da sola; mai se anche un altro
        // risultato ha lo stesso nome (catene, omonimi: "Roscioli" bar e ristorante).
        const sure = autoSave && confidentMatch(luogo, top) && !rest.some((r) => confidentMatch(luogo, r));
        if (isFirst && sure) void save(top, rest, true);
        else if (isFirst) setSt({ s: "found", top, rest });
        else setSt({ s: "choose", options: found });
      })
      .catch((e) => setSt({ s: "error", msg: errorText(e) }));
  };

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const t = window.setTimeout(() => {
      // Già salvato in questa sessione (ricaricata): si mostra l'esito, senza rifare il salvataggio.
      const prev = cached<RowState>(savedKey);
      if (prev?.s === "saved") { setSt(prev); return; }
      if (auto) search(queryOf(luogo), true);
    }, 0);
    // In sviluppo React monta due volte: annullato il primo giro, il secondo deve ripartire.
    return () => { window.clearTimeout(t); started.current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // "Non è questo": se l'aveva salvato da solo lo si toglie (e il reel con lui), poi le alternative.
  const notThis = async (top: SearchPlace, rest: SearchPlace[], out: LinkOutcome | null) => {
    if (out?.place && !out.alreadySaved) {
      try {
        const client = await browserClient();
        const { error } = await client.from("saved_places").delete().eq("user_id", userId).eq("place_id", out.place.id);
        if (error) throw error;
        // Solo questo reel: gli altri video collegati a quel locale restano.
        if (reelUrl) await client.from("contenuti_locali").delete().eq("user_id", userId).eq("place_id", out.place.id).eq("url", reelUrl);
        trackFeature("reel_salva", { stato: "annullato", fonte });
        setTolto(true);
      } catch {
        // Non tolto: lo si dice, e il locale resta salvato (si toglie dai Salvati).
        setSt({ s: "error", msg: `Non sono riuscito a togliere ${top.name} dai salvati: puoi toglierlo dai Salvati.` });
        return;
      }
    } else if (out?.place && reelUrl) {
      // Era già nei salvati (dal collaudo del 21/10): il locale resta, si stacca solo questo reel.
      try {
        const client = await browserClient();
        const { error } = await client.from("contenuti_locali").delete().eq("user_id", userId).eq("place_id", out.place.id).eq("url", reelUrl);
        if (error) throw error;
        trackFeature("reel_salva", { stato: "annullato_gia_salvato", fonte });
      } catch {
        setSt({ s: "error", msg: `Non sono riuscito a staccare il reel da ${top.name}: puoi toglierlo dalla scheda del locale.` });
        return;
      }
    }
    remember(noKey, top.id);
    try { sessionStorage.removeItem(savedKey); } catch { /* storage non disponibile */ }
    setReelOk(false);
    setSt({ s: "choose", options: rest });
  };

  const where = (r: SearchPlace) => cityFromAddress(r.address) ?? luogo.citta;
  const btn = "inline-flex min-h-11 items-center rounded-pill px-4 text-sm font-display font-semibold disabled:opacity-60";

  if (st.s === "idle") {
    return (
      <button
        type="button"
        onClick={() => search(queryOf(luogo), true)}
        data-testid="reel-altro"
        className="flex min-h-14 w-full items-center gap-3 rounded-card border border-border bg-white px-3 py-1.5 text-left"
      >
        <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-btn bg-accent-light text-xl">{getCategoryEmoji(luogo.categoria, luogo.nome)}</span>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-text">{labelOf(luogo)}</span>
        <span className="shrink-0 text-sm font-display font-semibold text-brand">+ Salva</span>
      </button>
    );
  }

  if (st.s === "searching") {
    return (
      <div className="flex items-center gap-3 rounded-card border border-border bg-surface p-4" data-testid="reel-cerco" aria-live="polite">
        <span aria-hidden className="inline-block h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-brand/20 border-t-brand" />
        <p className="min-w-0 text-sm text-text">Ho letto «{labelOf(luogo)}»: lo cerco su Google Maps…</p>
      </div>
    );
  }

  if (st.s === "saved" && !auto) {
    // Gli altri locali del post: una riga compatta (il verdetto lo trova nella scheda, nessuna chiamata in più).
    const place = st.out.place!;
    return (
      <div className="flex items-center gap-3 rounded-card border border-success/30 bg-success/10 px-3 py-2" data-testid="reel-salvato" aria-live="polite">
        <Foto place={st.top} />
        <Link href={`/mappa?salvato=${encodeURIComponent(place.id)}`} className="min-w-0 flex-1">
          <span className="block text-[11px] font-semibold uppercase tracking-wide text-success">{st.out.alreadySaved ? "✓ Era già salvato" : "✓ Salvato"}</span>
          <span className="block truncate text-sm font-semibold text-brand">{st.top.name}</span>
        </Link>
        {st.auto && (
          <button type="button" onClick={() => notThis(st.top, st.rest, st.out)} disabled={linking} data-testid="reel-non-e-questo" className="min-h-11 shrink-0 px-2 text-xs font-display font-semibold text-brand underline disabled:opacity-60">
            Non è questo
          </button>
        )}
      </div>
    );
  }

  if (st.s === "saved") {
    const place = st.out.place!;
    return (
      <div className="rounded-card border border-success/30 bg-success/10 p-4" data-testid="reel-salvato" aria-live="polite">
        {auto && <div className="mb-3"><Foto place={st.top} big /></div>}
        <p className="text-xs font-semibold uppercase tracking-wide text-success">
          {st.out.alreadySaved ? "✓ Era già nei tuoi salvati" : "✓ Salvato in 📌 Voglio andarci"}
        </p>
        <p className="mt-1 font-display text-xl font-semibold text-brand">{st.top.name}{where(st.top) ? `, ${where(st.top)}` : ""}</p>
        <p className="mt-0.5 text-xs text-text-muted">{displayAddress(st.top.address)}</p>
        <VerdettoSubito place={st.top} />
        {!st.out.alreadySaved && <QuandoCiVai userId={userId} placeId={place.id} />}
        {reelOk && <p className="mt-2 text-xs text-text-muted" data-testid="reel-collegato">🎬 Il reel resta collegato: lo ritrovi nella scheda.</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href={`/mappa?salvato=${encodeURIComponent(place.id)}`} className={`${btn} bg-brand text-white`}>
            Apri sulla mappa
          </Link>
          {st.auto && (
            <button type="button" onClick={() => notThis(st.top, st.rest, st.out)} disabled={linking} data-testid="reel-non-e-questo" className={`${btn} border border-border bg-white text-brand`}>
              Non è questo
            </button>
          )}
        </div>
        {/* Proposta 35: dal reel appena visto, i posti simili fuori dai soliti giri (stessa ricerca della
            scheda, 1 Google e 1 Haiku solo se toccata). Link e non pulsante: la cosa principale resta "Apri". */}
        <Link
          href={`/mappa?come=${encodeURIComponent(place.id)}`}
          onClick={() => trackFeature("altri_come_reel")}
          data-testid="reel-altri-come"
          className="mt-2 inline-flex min-h-11 items-center text-sm font-display font-semibold text-brand underline-offset-2 hover:underline"
        >
          ✨ Altri come questo
        </Link>
      </div>
    );
  }

  if (st.s === "found" || st.s === "saving") {
    return (
      <div className="rounded-card border border-border bg-surface p-4" data-testid="reel-trovato">
        {auto && <div className="mb-3"><Foto place={st.top} big /></div>}
        <div className="flex items-start gap-3">
          {!auto && <Foto place={st.top} />}
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">È questo?</p>
            <p className={`mt-1 font-display font-semibold text-brand ${auto ? "text-xl" : "text-lg"}`}>{st.top.name}{where(st.top) ? `, ${where(st.top)}` : ""}</p>
            <p className="mt-0.5 text-xs text-text-muted">{displayAddress(st.top.address)}</p>
          </div>
        </div>
        <p className="mt-1 text-xs text-text-muted">Nel reel: «{labelOf(luogo)}»</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => save(st.top, st.rest, false)} disabled={st.s === "saving"} data-testid="reel-conferma" className={`${btn} bg-brand text-white`}>
            {st.s === "saving" ? "Salvo…" : "Sì, salva"}
          </button>
          <button type="button" onClick={() => notThis(st.top, st.rest, null)} disabled={st.s === "saving"} data-testid="reel-non-e-questo" className={`${btn} border border-border bg-white text-brand`}>
            No, è un altro
          </button>
        </div>
      </div>
    );
  }

  // Alternative, nessun risultato o errore: si sceglie tra gli altri o si cerca a mano (1 ricerca a tocco).
  return (
    <div className="space-y-3 rounded-card border border-border bg-surface p-4" data-testid="reel-scegli">
      {tolto && <p className="text-sm font-medium text-text" data-testid="reel-tolto">✓ Tolto dai salvati. Qual è quello giusto?</p>}
      {st.s === "error" && <p className="rounded-btn bg-error/10 px-3 py-2 text-sm text-error">{st.msg}</p>}
      {st.s === "none" && <p className="text-sm text-text">Non trovo «{labelOf(luogo)}» su Google Maps.</p>}
      {st.s === "choose" && st.options.length > 0 && (
        <>
          <p className="text-sm font-semibold text-text">Forse è uno di questi?</p>
          <ul className="space-y-2">
            {st.options.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => save(r, st.options.filter((o) => o.id !== r.id), false)}
                  className="flex w-full items-center gap-3 rounded-btn border border-border bg-white px-3 py-2.5 text-left"
                >
                  <Foto place={r} />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-text">{r.name}</span>
                    <span className="mt-0.5 block text-xs text-text-muted">{displayAddress(r.address)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (manual.trim()) search(manual.trim(), false); }}>
        <input
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          aria-label="Nome del locale e città"
          placeholder="Nome del locale e città"
          data-testid="reel-cerca-mano"
          className="min-h-11 min-w-0 flex-1 scroll-mt-20 rounded-pill border border-border bg-white px-4 text-base text-text focus:border-brand focus:outline-none"
        />
        <button type="submit" disabled={!manual.trim()} className={`${btn} shrink-0 border border-border bg-white text-brand`}>
          Cerca
        </button>
      </form>
    </div>
  );
}

// Foto Google del locale (riferimento dalla ricerca, mai salvato) o, se manca, l'emoji del tipo.
function Foto({ place, big = false }: { place: { name: string; category: string | null; photoRef?: string | null; photoAuthor?: string | null }; big?: boolean }) {
  const emoji = <span aria-hidden className={big ? "text-5xl" : "text-xl"}>{getCategoryEmoji(place.category, place.name)}</span>;
  return (
    <span className={`relative flex shrink-0 items-center justify-center overflow-hidden bg-accent-light ${big ? "h-40 w-full rounded-btn" : "h-11 w-11 rounded-btn"}`}>
      <PlacePhoto photoRef={place.photoRef ?? null} alt={place.name} className="h-full w-full object-cover" fallback={emoji} credit={big ? place.photoAuthor ?? null : null} />
    </span>
  );
}

// Proposta 14: il verdetto Mapetite subito, nel "✓ Salvato" (il differenziatore nel momento più forte).
// Stessa via della scheda dei salvati (/api/places/verdetto): dalla cache se c'è, altrimenti
// 1 Place Details + 1 Haiku dentro il tetto di 25 verdetti nuovi al giorno. Ricordato nel telefono
// per la sessione: riaperta la pagina non si richiede. Senza verdetto (tetto, errore) non si mostra
// niente di inventato: solo la riga "lo scrivo appena apri la scheda".
type Verdetto = { verdict: string | null; photoRef: string | null; photoAuthor: string | null };
function VerdettoSubito({ place }: { place: SearchPlace }) {
  const key = `mapetite.reel-verdetto:${place.id}`;
  const [v, setV] = useState<Verdetto | "attesa" | "no">("attesa");
  useEffect(() => {
    const hit = cached<Verdetto>(key);
    let vivo = true;
    const t = window.setTimeout(() => {
      if (hit && typeof hit === "object") { setV(hit); return; }
      void fetch("/api/places/verdetto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ googlePlaceId: place.id }),
      })
        .then(async (res) => {
          const d = (await res.json().catch(() => ({}))) as Partial<Verdetto>;
          if (!vivo) return;
          if (!res.ok || !d.verdict) { setV("no"); return; }
          const got: Verdetto = { verdict: d.verdict, photoRef: d.photoRef ?? null, photoAuthor: d.photoAuthor ?? null };
          remember(key, got);
          setV(got);
          trackFeature("reel_salva", { stato: "verdetto" });
        })
        .catch(() => { if (vivo) setV("no"); });
    }, 0);
    return () => { vivo = false; window.clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [place.id]);

  if (v === "attesa") {
    return (
      <div className="mt-3 rounded-btn bg-white/70 p-3" data-testid="reel-verdetto-attesa" aria-live="polite">
        <span className="block space-y-1.5">
          <span className="block h-3 w-3/4 animate-pulse rounded bg-border/60" />
          <span className="block h-3 w-1/2 animate-pulse rounded bg-border/60" />
        </span>
      </div>
    );
  }
  if (v === "no") {
    return <p className="mt-2 text-xs text-text-muted" data-testid="reel-verdetto-dopo">✦ Il verdetto Mapetite lo trovi nella scheda.</p>;
  }
  return (
    <div className="mt-3 rounded-btn bg-white p-3" data-testid="reel-verdetto">
      <span className="block text-[11px] font-semibold uppercase tracking-wide text-text-muted">Il verdetto Mapetite</span>
      <span className="mt-0.5 block text-[15px] font-medium leading-snug text-text"><span aria-hidden className="mr-1 text-accent">✦</span>{v.verdict}</span>
    </div>
  );
}
