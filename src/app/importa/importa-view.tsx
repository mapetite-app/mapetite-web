"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { browserClient } from "@/lib/supabase/client-lazy";
import GoogleMapsCard from "./google-maps-card";
import SalvaDaTelefono from "./salva-da-telefono";
import ManualAddCard from "./manual-add-card";
import MultiLinkCard from "./multi-link-card";
import TakeoutCard from "./takeout-card";
import SalvatiBrevi from "@/components/salvati-brevi";
import { displayAddress } from "@/lib/city";
import { trackFeature } from "@/lib/track";
import { addReel } from "@/lib/community-write";
import { reelSourceOf } from "@/lib/reel";
import { firmaPer, rememberFirme } from "@/lib/catalog-firme";
import { screenshotForUpload } from "@/lib/screenshot-upload";

type ImportResult = {
  nome: string | null;
  citta: string | null;
  categoria: string | null;
};

type GoogleResult = {
  id: string;
  name: string;
  address: string;
  lat: number | null;
  lng: number | null;
  category: string | null;
  rating: number | null;
  priceLevel: number | null;
};

// I nostri errori sono già in italiano; quelli del browser ("Failed to fetch", JSON rotto) no.
function errorText(e: unknown): string {
  if (e instanceof TypeError) return "Errore di rete. Controlla la connessione e riprova.";
  if (e instanceof SyntaxError) return "Qualcosa è andato storto, riprova.";
  return e instanceof Error && e.message ? e.message : "Qualcosa è andato storto, riprova.";
}

export default function ImportaView({ userId, benvenuto = false }: { userId: string | null; benvenuto?: boolean }) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [isReading, setIsReading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extracted, setExtracted] = useState<ImportResult | null>(null);
  const [searchResults, setSearchResults] = useState<GoogleResult[]>([]);
  const [manualQuery, setManualQuery] = useState("");
  const [savedName, setSavedName] = useState<string | null>(null);
  // Ricerca "a mano" chiesta da un altro punto della pagina (es. "Cerca …" sotto un link di Instagram).
  const [manualReq, setManualReq] = useState<{ q: string; n: number } | null>(null);
  const [flashShot, setFlashShot] = useState(false);
  // Le altre strade (screenshot · a mano · file di Google): una sola aperta.
  const [panel, setPanel] = useState<Panel | null>(null);
  // Tanti link incollati insieme (chat, nota): li legge la lista di MultiLinkCard.
  const [multi, setMulti] = useState<{ text: string; n: number } | null>(null);
  // Link del video da cui si sta salvando (piano 5.6d): dopo il salvataggio si collega al locale,
  // così la scheda lo mostra in "Visto su TikTok". Si memorizza solo il link, mai il video.
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [reelLinked, setReelLinked] = useState(false);
  const openPanel = (p: Panel) => {
    setPanel(p);
    // Dopo il disegno del pannello: lo si porta in vista.
    window.setTimeout(() => document.getElementById(PANEL_ID[p])?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };
  const goToScreenshot = () => {
    openPanel("shot");
    setFlashShot(true);
    window.setTimeout(() => setFlashShot(false), 2000);
  };
  const searchByHand = (q: string) => {
    setManualReq((r) => ({ q, n: (r?.n ?? 0) + 1 }));
    openPanel("mano");
  };

  // Link da fuori (/importa#da-screenshot, /importa#a-mano): si apre il pannello giusto.
  useEffect(() => {
    const fromHash = () => {
      const hash = window.location.hash.slice(1);
      const p = (Object.keys(PANEL_ID) as Panel[]).find((k) => PANEL_ID[k] === hash);
      if (p) openPanel(p);
    };
    const t = window.setTimeout(fromHash, 0);
    window.addEventListener("hashchange", fromHash);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("hashchange", fromHash);
    };
  }, []);

  // Revoke blob URL when it changes or on unmount
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setVideoUrl(null);
    setPreviewUrl(URL.createObjectURL(f));
    setError(null);
    setStep(1);
    setExtracted(null);
    setSearchResults([]);
    setSavedName(null);
  };

  const readPlace = async (body: () => Promise<{ image: string } | { link: string }>) => {
    setIsReading(true);
    setError(null);

    try {
      const extractRes = await fetch("/api/import-caption", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(await body()),
      });
      if (!extractRes.ok) {
        const d = await extractRes.json().catch(() => ({}));
        throw new Error((d as { error?: string }).error ?? "Impossibile leggere il locale.");
      }
      const extractedData: ImportResult = await extractRes.json();
      setExtracted(extractedData);

      const query = [extractedData.nome, extractedData.citta].filter(Boolean).join(" ");
      setManualQuery(query);

      let results: GoogleResult[] = [];
      if (query) {
        try {
          const searchRes = await fetch("/api/places/search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query }),
          });
          const searchData = await searchRes.json();
          results = (searchData.results ?? []).slice(0, 5);
        } catch {
          // Fall through to step 2 with empty results; user can search manually
        }
      }

      setSearchResults(results);
      setStep(2);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setIsReading(false);
    }
  };

  const handleRead = () => {
    // Leggere lo screenshot costa (AI + Google): solo per chi può poi salvare il locale.
    if (!file || !userId) return;
    trackFeature("import_screenshot");
    void readPlace(async () => ({ image: await screenshotForUpload(file) }));
  };

  // Link di un video TikTok/YouTube: il server legge la didascalia (oEmbed ufficiale) e l'AI ne
  // ricava nome e città, poi stessi passi dello screenshot (scelta del locale su Google, salva).
  const readVideo = (url: string) => {
    if (!userId) return;
    goToScreenshot();
    setFile(null);
    setPreviewUrl(null);
    setSavedName(null);
    setSearchResults([]);
    setExtracted(null);
    setStep(1);
    trackFeature("import_video");
    setVideoUrl(url);
    setReelLinked(false);
    void readPlace(async () => ({ link: url }));
  };

  // Arrivati da "Condividi" di TikTok (Android): /importa?video=<link>.
  const videoStarted = useRef(false);
  useEffect(() => {
    if (videoStarted.current || !userId) return;
    const url = new URLSearchParams(window.location.search).get("video");
    if (!url) return;
    videoStarted.current = true;
    window.history.replaceState(null, "", `${window.location.pathname}#da-screenshot`);
    // Fuori dal ciclo dell'effetto: gli aggiornamenti di stato partono dopo il primo disegno.
    setTimeout(() => readVideo(url), 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const handleManualSearch = async () => {
    if (!manualQuery.trim()) return;
    setIsSearching(true);
    setError(null);
    try {
      const res = await fetch("/api/places/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: manualQuery }),
      });
      const data = await res.json();
      const results: GoogleResult[] = (data.results ?? []).slice(0, 5);
      rememberFirme(results);
      setSearchResults(results);
      if (results.length === 0) setError("Nessun risultato. Prova con un termine diverso.");
    } catch {
      setError("Errore nella ricerca, riprova.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectPlace = async (result: GoogleResult) => {
    if (!userId || result.lat == null || result.lng == null) return;
    setIsSaving(true);
    setError(null);

    try {
      const addRes = await fetch("/api/places/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          googlePlaceId: result.id,
          name: result.name,
          address: result.address,
          lat: result.lat,
          lng: result.lng,
          category: result.category,
          rating: result.rating,
          priceLevel: result.priceLevel,
          firma: firmaPer(result.id),
        }),
      });
      if (!addRes.ok) {
        const d = await addRes.json().catch(() => ({}));
        throw new Error((d as { error?: string }).error ?? "Errore nel salvataggio del locale.");
      }
      const addData = await addRes.json();
      const placeUuid: string = addData.place.id;

      const { error: spError } = await (await browserClient())
        .from("saved_places")
        .insert({ user_id: userId, place_id: placeUuid, tags: null, note: null });
      if (spError && spError.code !== "23505") {
        throw new Error("Errore nel salvataggio nella tua lista.");
      }

      // Il video da cui è arrivato il locale resta collegato (senza migrazione: si salta in silenzio).
      if (videoUrl) {
        const reel = await addReel(userId, placeUuid, videoUrl);
        setReelLinked(reel.esito === "ok" || reel.esito === "doppio");
        if (reel.esito === "ok") trackFeature("reel", { stato: "salvato_import", fonte: reelSourceOf(videoUrl) ?? "", contesto: "importa" });
      }

      setSavedName(result.name);
      setStep(3);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setVideoUrl(null);
    setReelLinked(false);
    setPreviewUrl(null);
    setExtracted(null);
    setSearchResults([]);
    setSavedName(null);
    setManualQuery("");
    setError(null);
    setStep(1);
  };

  return (
    // Stesso fondo beige di home e salvati (giro 1/11, D52).
    <div className="min-h-[calc(100dvh-4rem)] bg-[#f8f6f2] md:min-h-[calc(100dvh-3.5rem)]" data-testid="importa-pagina">
    <div className="mx-auto max-w-2xl px-4 pb-10 pt-8">
      {benvenuto ? (
        <>
          <h1 data-testid="importa-benvenuto" className={TITLE}>Porta qui i tuoi posti</h1>
          <p className="mb-5 mt-2 text-sm text-text-muted">Incolla i link dei posti salvati su Google Maps, anche tutti insieme.</p>
        </>
      ) : (
        <>
          <h1 className={TITLE}>Aggiungi un posto</h1>
          <p className="mb-5 mt-2 text-sm text-text-muted">Incolla un link: il resto lo faccio io.</p>
        </>
      )}

      <GoogleMapsCard
        userId={userId}
        onMulti={(text) => setMulti((m) => ({ text, n: (m?.n ?? 0) + 1 }))}
      />
      {/* "Come copio il link?": l'unica guida (prima c'erano anche la tessera e il pannello "Da Google Maps", doppioni). */}
      {userId && <SalvaDaTelefono defaultOpen={benvenuto} />}
      <MultiLinkCard
        userId={userId}
        onScreenshot={goToScreenshot}
        onSearch={searchByHand}
        onReadVideo={readVideo}
        incoming={multi}
        onAgain={() => document.getElementById("importa-google-card")?.scrollIntoView({ behavior: "smooth", block: "start" })}
      />

      {/* Le altre strade: un tocco più in là, in righe compatte (una sola cosa principale per schermata). */}
      <p className="mb-2 mt-6 text-xs font-display font-semibold uppercase tracking-widest text-text-muted">Altri modi</p>
      <div className="divide-y divide-border overflow-hidden rounded-card border border-border bg-white" data-testid="importa-tessere">
        {TILES.map((t) => (
          <button
            key={t.id}
            type="button"
            data-testid={`importa-tessera-${t.id}`}
            aria-expanded={panel === t.id}
            aria-controls={PANEL_ID[t.id]}
            onClick={() => (panel === t.id ? setPanel(null) : openPanel(t.id))}
            className={`flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left transition-colors active:bg-surface ${panel === t.id ? "bg-surface" : ""}`}
          >
            <span aria-hidden className="text-2xl leading-none">{t.icon}</span>
            <span className="min-w-0 flex-1">
              {/* Revisore 2/11 (quinto giro): righe in Inter medio color inchiostro, non Poppins teal. */}
              <span data-testid="importa-tessera-titolo" className="block font-sans text-[15px] font-medium leading-tight text-text">{t.title}</span>
              <span className="block truncate text-xs text-text-muted">{t.text}</span>
            </span>
            <span aria-hidden className={`text-lg text-text-muted transition-transform ${panel === t.id ? "rotate-90" : ""}`}>›</span>
          </button>
        ))}
      </div>

      <div id={PANEL_ID.file} hidden={panel !== "file"} className="mt-4 scroll-mt-4">
        <TakeoutCard userId={userId} />
      </div>

      <div hidden={panel !== "mano"} className="mt-4">
        <ManualAddCard key={manualReq?.n ?? 0} userId={userId} initialQuery={manualReq?.q} autoSearch={Boolean(manualReq)} />
      </div>

      <section
        id="da-screenshot"
        hidden={panel !== "shot"}
        data-testid="importa-screenshot"
        className={`mt-4 scroll-mt-4 rounded-card border bg-white p-5 transition-colors ${flashShot ? "border-accent ring-2 ring-accent/40" : "border-border"}`}
      >
      <h2 className="mb-1 font-title text-xl text-text">
        <span aria-hidden>📸 </span>Da uno screenshot
      </h2>
      <p className="text-sm text-text-muted mb-5" data-testid="importa-condividi-android">
        Su Android puoi anche condividere uno screenshot direttamente a Mapetite da Instagram o TikTok.
      </p>

      {/* ── Step 1: carica immagine ── */}
      {step === 1 && (
        <div className="space-y-5">
          {/* Area grande da toccare (stile "Aggiungi qualsiasi cosa" di Albo): niente "Choose File" in inglese. */}
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-card border-2 border-dashed border-border bg-white px-4 py-8 text-center active:scale-[0.99]">
            <span aria-hidden className="text-4xl">📸</span>
            <span className="font-display text-base font-semibold text-brand">
              {file ? "Cambia screenshot" : "Scegli uno screenshot"}
            </span>
            <span className="text-xs text-text-muted">
              {file ? file.name : "Post Instagram, TikTok, una storia: leggo io nome e città del locale"}
            </span>
            <input type="file" accept="image/*" onChange={handleFileChange} className="sr-only" aria-label="Scegli uno screenshot" />
          </label>

          {previewUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt="Anteprima screenshot"
              className="max-h-72 w-full rounded-card border border-border object-contain"
            />
          )}

          <button
            type="button"
            onClick={handleRead}
            disabled={!file || isReading || !userId}
            className="min-h-12 w-full rounded-pill bg-brand px-4 text-base font-display font-semibold text-white
              hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 transition-colors"
          >
            {isReading ? "Lettura in corso..." : "Leggi locale"}
          </button>
          {!userId && (
            <p data-testid="screenshot-accedi" className="text-sm text-text-muted">
              <Link href="/login?next=%2Fimporta" className="font-semibold text-brand underline">Accedi</Link> per leggere uno screenshot e salvare il locale.
            </p>
          )}
        </div>
      )}

      {/* ── Step 2: risultati AI + scelta Google ── */}
      {step === 2 && extracted && (
        <div className="space-y-6">
          {/* Estratto dall'AI */}
          <div className="rounded-btn border border-border bg-white p-4 space-y-2">
            <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-3">
              Letto dall&apos;AI
            </p>
            <Row label="Nome" value={extracted.nome} fallback="non rilevato" />
            <Row label="Città" value={extracted.citta} fallback="da confermare" />
            <Row label="Categoria" value={extracted.categoria} fallback="non rilevata" />
          </div>

          {/* Risultati Google */}
          <div>
            <p className="text-sm font-semibold text-text mb-3">
              Seleziona il locale corretto
            </p>

            {searchResults.length > 0 ? (
              <ul className="space-y-2 mb-5">
                {searchResults.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => handleSelectPlace(r)}
                      disabled={isSaving || !userId}
                      className="w-full rounded-btn border border-border px-4 py-3 text-left
                        hover:border-brand hover:bg-surface
                        disabled:cursor-not-allowed disabled:opacity-60 transition-colors"
                    >
                      <p className="text-sm font-semibold text-text">{r.name}</p>
                      <p className="text-xs text-text-muted mt-0.5">{displayAddress(r.address)}</p>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-text-muted mb-4">Nessun risultato trovato.</p>
            )}

            {/* Ricerca manuale */}
            <div className="space-y-2">
              <p className="text-xs text-text-muted">
                {searchResults.length > 0
                  ? "Non trovi il locale? Cerca manualmente:"
                  : "Prova a cercarlo manualmente:"}
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={manualQuery}
                  onChange={(e) => setManualQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleManualSearch()}
                  placeholder="Es. Dal Toscano Roma"
                  className="min-h-11 flex-1 rounded-btn border border-border bg-white px-3 py-2 text-base
                    focus:border-brand focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleManualSearch}
                  disabled={isSearching || !manualQuery.trim()}
                  className="rounded-btn border border-border px-3 py-2 text-sm font-medium
                    text-text hover:bg-surface disabled:opacity-60 transition-colors"
                >
                  {isSearching ? "..." : "Cerca"}
                </button>
              </div>
            </div>

            {!userId && (
              <p className="mt-4 text-sm text-text-muted">
                <Link href="/login?next=%2Fimporta" className="underline text-text">
                  Accedi
                </Link>{" "}
                per salvare un locale.
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={handleReset}
            className="text-sm text-text-muted hover:text-text underline"
          >
            ← Ricomincia con un altro screenshot
          </button>
        </div>
      )}

      {/* ── Step 3: conferma ── */}
      {step === 3 && savedName && (
        <div className="rounded-btn border border-success/30 bg-success/10 p-8 text-center space-y-3">
          <p className="text-3xl">✅</p>
          <p className="text-base font-semibold text-text">Salvato!</p>
          <p className="text-sm text-text">
            <span className="font-medium">{savedName}</span> è stato aggiunto alla tua mappa.
          </p>
          {reelLinked && videoUrl && (
            <p data-testid="import-reel-collegato" className="text-sm text-text-muted">
              Il video resta collegato: lo ritrovi nella scheda, in &ldquo;Visto su {reelSourceOf(videoUrl) ?? "social"}&rdquo;.
            </p>
          )}
          <div className="flex justify-center gap-3 pt-3">
            <Link
              href="/mappa"
              className="rounded-btn bg-brand px-4 py-2 text-sm font-semibold text-white
                hover:opacity-90 transition-colors"
            >
              Vai alla mappa
            </Link>
            <button
              type="button"
              onClick={handleReset}
              className="rounded-btn border border-border px-4 py-2 text-sm font-medium
                text-text hover:bg-surface transition-colors"
            >
              Importa un altro
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="mt-6 rounded-btn bg-error/10 px-4 py-3 text-sm text-error">
          {error}
        </p>
      )}
      </section>

      {/* Revisore 2/11 (quinto giro): la metà sotto era vuota. Gli ultimi 3 salvati veri (un tocco apre la
          scheda); senza salvati, senza accesso o senza rete non compare niente. */}
      <SalvatiBrevi userId={userId} titolo="Ultimi aggiunti" testid="importa-ultimi" max={3} className="mt-8" />
    </div>
    </div>
  );
}

// Titolo nel serif da rivista di home e salvati (giro 1/11, D7).
const TITLE = "font-[family-name:var(--font-newsreader)] text-[38px] font-medium leading-none tracking-tight text-text";

type Panel = "file" | "shot" | "mano";
const PANEL_ID: Record<Panel, string> = { file: "da-file", shot: "da-screenshot", mano: "a-mano" };
// "Da Google Maps" non è più una tessera: faceva la stessa cosa di "Incolla un link" (giro 1/11, D50).
const TILES: { id: Panel; icon: string; title: string; text: string }[] = [
  { id: "shot", icon: "📸", title: "Da uno screenshot", text: "Post e storie: leggo io il nome" },
  { id: "mano", icon: "✍️", title: "Scrivi il nome", text: "Nome e città, lo trovo io" },
  { id: "file", icon: "🗂️", title: "Tutti i salvati di Google Maps", text: "Dal file che scarichi da Google" },
];

function Row({
  label,
  value,
  fallback,
}: {
  label: string;
  value: string | null;
  fallback: string;
}) {
  return (
    <div className="flex gap-3">
      <span className="text-sm font-medium text-text w-24 shrink-0">{label}</span>
      {value ? (
        <span className="text-sm text-text">{value}</span>
      ) : (
        <span className="text-sm text-text-muted italic">{fallback}</span>
      )}
    </div>
  );
}
