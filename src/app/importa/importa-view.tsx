"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import GoogleMapsCard from "./google-maps-card";
import ManualAddCard from "./manual-add-card";

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

// I nostri errori sono già in italiano; quelli del browser ("Failed to fetch", JSON rotto) no.
function errorText(e: unknown): string {
  if (e instanceof TypeError) return "Errore di rete. Controlla la connessione e riprova.";
  if (e instanceof SyntaxError) return "Qualcosa è andato storto, riprova.";
  return e instanceof Error && e.message ? e.message : "Qualcosa è andato storto, riprova.";
}

export default function ImportaView({ userId }: { userId: string | null }) {
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
    setPreviewUrl(URL.createObjectURL(f));
    setError(null);
    setStep(1);
    setExtracted(null);
    setSearchResults([]);
    setSavedName(null);
  };

  const handleRead = async () => {
    if (!file) return;
    setIsReading(true);
    setError(null);

    try {
      const dataUrl = await readFileAsDataUrl(file);

      const extractRes = await fetch("/api/import-caption", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: dataUrl }),
      });
      if (!extractRes.ok) throw new Error("Impossibile leggere il locale dallo screenshot.");
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

      const { error: spError } = await createClient()
        .from("saved_places")
        .insert({ user_id: userId, place_id: placeUuid, tags: null, note: null });
      if (spError && spError.code !== "23505") {
        throw new Error("Errore nel salvataggio nella tua lista.");
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
      <h1 className="mb-6 font-title text-3xl font-semibold text-brand">Importa</h1>

      <ManualAddCard userId={userId} />

      <div className="mt-6">
        <GoogleMapsCard userId={userId} />
      </div>

      <h2 className="mt-10 mb-2 font-display text-lg font-semibold text-brand">Da uno screenshot</h2>
      <p className="text-sm text-text-muted mb-2">
        Carica uno screenshot di un post social e aggiungi il locale alla tua mappa in pochi passi.
      </p>
      <p className="text-sm text-text-muted mb-6" data-testid="importa-condividi-android">
        Su Android puoi anche condividere uno screenshot direttamente a Mapetite da Instagram o TikTok.
      </p>

      {/* ── Step 1: carica immagine ── */}
      {step === 1 && (
        <div className="space-y-5">
          {/* Area grande da toccare (stile "Aggiungi qualsiasi cosa" di Albo): niente "Choose File" in inglese. */}
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-card border-2 border-dashed border-border bg-surface px-4 py-8 text-center active:scale-[0.99]">
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
            disabled={!file || isReading}
            className="min-h-12 w-full rounded-pill bg-brand px-4 text-base font-display font-semibold text-white
              hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 transition-colors"
          >
            {isReading ? "Lettura in corso..." : "Leggi locale"}
          </button>
        </div>
      )}

      {/* ── Step 2: risultati AI + scelta Google ── */}
      {step === 2 && extracted && (
        <div className="space-y-6">
          {/* Estratto dall'AI */}
          <div className="rounded-btn border border-border bg-surface p-4 space-y-2">
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
                      <p className="text-xs text-text-muted mt-0.5">{r.address}</p>
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
                <Link href="/login" className="underline text-text">
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
