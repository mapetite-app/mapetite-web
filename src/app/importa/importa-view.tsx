"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { browserClient } from "@/lib/supabase/client-lazy";
import GoogleMapsCard from "./google-maps-card";
import ManualAddCard from "./manual-add-card";
import MultiLinkCard from "./multi-link-card";
import { displayAddress } from "@/lib/city";
import { trackFeature } from "@/lib/track";
import { addReel } from "@/lib/community-write";
import { reelSourceOf } from "@/lib/reel";

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

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Lo screenshot di un iPhone è spesso un PNG da 3–5 MB: in base64 supera il limite delle
// richieste di Vercel (4,5 MB) e il tester vedeva "Impossibile leggere" su un'immagine buona.
// Si rimpicciolisce nel telefono a 1568 px sul lato lungo (quanto basta all'AI per leggere)
// e si manda in JPEG: qualche centinaio di kB. Se il browser non ci riesce, si manda com'è.
const MAX_SIDE = 1568;
async function screenshotForUpload(file: File): Promise<string> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas");
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return canvas.toDataURL("image/jpeg", 0.85);
  } catch {
    return readFileAsDataUrl(file);
  }
}

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
  // Link del video da cui si sta salvando (piano 5.6d): dopo il salvataggio si collega al locale,
  // così la scheda lo mostra in "Visto su TikTok". Si memorizza solo il link, mai il video.
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [reelLinked, setReelLinked] = useState(false);

  const goToScreenshot = () => {
    document.getElementById("da-screenshot")?.scrollIntoView({ behavior: "smooth", block: "start" });
    setFlashShot(true);
    window.setTimeout(() => setFlashShot(false), 2000);
  };
  const searchByHand = (q: string) => setManualReq((r) => ({ q, n: (r?.n ?? 0) + 1 }));

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
    <div className="mx-auto max-w-2xl px-4 py-8">
      {/* Dal primo accesso ("Importa da Google Maps"): prima l'import di tanti link insieme. */}
      {benvenuto ? (
        <>
          <h1 data-testid="importa-benvenuto" className="mb-1 font-title text-3xl font-semibold text-brand">Porta qui i tuoi posti</h1>
          <p className="mb-6 text-sm text-text-muted">Copia da Google Maps i link dei posti che hai salvato (o la chat dove te li mandi) e incollali qui: li salvo tutti insieme.</p>
          <MultiLinkCard userId={userId} onScreenshot={goToScreenshot} onSearch={searchByHand} onReadVideo={readVideo} />
          <div className="mt-6">
            <GoogleMapsCard userId={userId} onScreenshot={goToScreenshot} onSearch={searchByHand} onReadVideo={readVideo} />
          </div>
        </>
      ) : (
        <>
          <h1 className="mb-1 font-title text-3xl font-semibold text-brand">Importa</h1>
          <p className="mb-6 text-sm text-text-muted">Salva un locale in un gesto: dal link di Google Maps, dal nome o da uno screenshot.</p>

          <GoogleMapsCard userId={userId} onScreenshot={goToScreenshot} onSearch={searchByHand} onReadVideo={readVideo} />

          <div className="mt-6">
            <MultiLinkCard userId={userId} onScreenshot={goToScreenshot} onSearch={searchByHand} onReadVideo={readVideo} />
          </div>
        </>
      )}

      <div className="mt-6">
        <ManualAddCard key={manualReq?.n ?? 0} userId={userId} initialQuery={manualReq?.q} autoSearch={Boolean(manualReq)} />
      </div>

      <section
        id="da-screenshot"
        data-testid="importa-screenshot"
        className={`mt-6 scroll-mt-4 rounded-card border bg-surface p-5 transition-colors ${flashShot ? "border-accent ring-2 ring-accent/40" : "border-border"}`}
      >
      <h2 className="mb-1 font-display text-lg font-semibold text-brand">
        <span aria-hidden>📸 </span>Da uno screenshot
      </h2>
      <p className="text-sm text-text-muted mb-2">
        Carica uno screenshot di un post social e aggiungi il locale alla tua mappa in pochi passi.
      </p>
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
    </div>
  );
}

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
