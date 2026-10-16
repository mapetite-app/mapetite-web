"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Play, Plus } from "lucide-react";
import Avatar from "@/components/avatar";
import { personName, profilePath } from "@/lib/handle";
import { trackFeature } from "@/lib/track";
import { COMMENT_MAX, addReel, saveReview } from "@/lib/community-write";
import { reelSourceOf, seenOn, type ReelSource } from "@/lib/reel";
import type { Community, CommunityReel, CommunityReview } from "@/lib/community";
import type { Voto } from "@/lib/diario";

// "Dalla community Mapetite" (piani 5.6c e 5.6d) nella scheda della mappa e nella pagina pubblica
// del locale: la tua recensione (stelle + due righe), quelle degli altri (prima chi segui) e i reel
// collegati al locale ("Visto su TikTok"). Sempre separata dai dati Google, con l'autore in chiaro.
// Dati da /api/places/community; scritture dal telefono con le regole RLS (src/lib/community-write.ts).

type Props = {
  id: string; // UUID Supabase o Place ID Google
  contesto: "mappa" | "locale" | "assistente";
  loginHref?: string;
  voto?: Voto | null; // "Com'era?" già dato: suggerimento, non si traduce mai da solo in stelle
};

type Preview = { titolo: string | null; autore: string | null; miniatura: string | null };

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" });

function Stars({ value, size = "text-sm" }: { value: number; size?: string }) {
  const n = Math.max(0, Math.min(5, Math.round(value)));
  return (
    <span className={size} aria-label={`${n} stelle su 5`}>
      <span className="text-star">{"★".repeat(n)}</span>
      <span className="text-border">{"★".repeat(5 - n)}</span>
    </span>
  );
}

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-0.5" role="radiogroup" aria-label="Quante stelle?">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          role="radio"
          aria-checked={value === star}
          onClick={() => onChange(star)}
          aria-label={`${star} ${star === 1 ? "stella" : "stelle"}`}
          className="flex h-11 w-10 items-center justify-center text-[28px] leading-none active:scale-90"
        >
          <span className={value >= star ? "text-star" : "text-border"}>★</span>
        </button>
      ))}
    </div>
  );
}

function ReviewRow({ r }: { r: CommunityReview }) {
  return (
    <li data-testid="recensione-community" className="flex gap-3 py-2.5">
      {r.autore ? <Avatar person={r.autore} size={32} /> : <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand/10 text-sm">🍽️</span>}
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-1.5 text-sm">
          {r.autore ? (
            <Link href={profilePath(r.autore.handle)} className="font-display font-semibold text-text">{personName(r.autore)}</Link>
          ) : (
            <span className="font-display font-semibold text-text-muted">Un membro di Mapetite</span>
          )}
          {r.amico && <span className="rounded-pill bg-brand/10 px-2 py-0.5 text-[11px] font-display font-semibold text-brand">Amico</span>}
        </p>
        <p className="mt-0.5 flex items-center gap-2">
          <Stars value={r.rating} />
          <span className="text-xs font-sans text-text-muted">{shortDate(r.created_at)}</span>
        </p>
        {r.comment && <p className="mt-1 break-words font-sans text-sm leading-relaxed text-text">{r.comment}</p>}
      </div>
    </li>
  );
}

function ReelCard({ reel, contesto }: { reel: CommunityReel; contesto: string }) {
  const [preview, setPreview] = useState<Preview | null>(null);
  useEffect(() => {
    if (reel.fonte === "Instagram") return;
    const ctrl = new AbortController();
    fetch(`/api/places/oembed?url=${encodeURIComponent(reel.url)}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((p: Preview | null) => { if (p) setPreview(p); })
      .catch(() => { /* rete assente: resta la tessera senza miniatura */ });
    return () => ctrl.abort();
  }, [reel.url, reel.fonte]);
  const who = reel.mio ? "Salvato da te" : reel.autore ? personName(reel.autore) : null;
  return (
    <li className="w-32 shrink-0 snap-start">
      <a
        data-testid="reel-locale"
        data-fonte={reel.fonte}
        href={reel.url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => trackFeature("reel", { stato: "aperto", fonte: reel.fonte, contesto })}
        className="relative block h-52 overflow-hidden rounded-card bg-brand shadow-card active:scale-[0.98]"
        aria-label={`Guarda il video su ${reel.fonte}${preview?.titolo ? `: ${preview.titolo}` : ""}`}
      >
        {preview?.miniatura ? (
          // Miniatura ufficiale dell'oEmbed, caricata dalla piattaforma: mai copiata sui nostri server.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview.miniatura} alt="" loading="lazy" referrerPolicy="no-referrer" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <span aria-hidden className={`absolute inset-0 ${reel.fonte === "Instagram" ? "bg-gradient-to-br from-[#f58529] via-[#dd2a7b] to-[#8134af]" : reel.fonte === "TikTok" ? "bg-gradient-to-br from-[#111] to-[#333]" : "bg-gradient-to-br from-[#c4302b] to-[#7a1c19]"}`} />
        )}
        <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
        <span className="absolute left-2 top-2 rounded-pill bg-black/55 px-2 py-0.5 text-[11px] font-display font-semibold text-white">{reel.fonte}</span>
        <span aria-hidden className="absolute left-1/2 top-1/2 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-brand">
          <Play size={18} className="ml-0.5" fill="currentColor" />
        </span>
        <span className="absolute inset-x-2 bottom-2 text-left">
          {preview?.titolo && <span className="line-clamp-2 text-xs font-sans leading-snug text-white">{preview.titolo}</span>}
          <span className="mt-0.5 block truncate text-[11px] font-display font-semibold text-white/80">
            {preview?.autore ? `@${preview.autore.replace(/^@/, "")}` : reel.fonte === "Instagram" ? "Apri il reel" : "Guarda il video"}
          </span>
        </span>
      </a>
      {who && <p className="mt-1 truncate text-[11px] font-sans text-text-muted">{who}</p>}
    </li>
  );
}

function reelTitle(reels: CommunityReel[]): string {
  const sources = new Set<ReelSource>(reels.map((r) => r.fonte));
  return sources.size === 1 ? seenOn([...sources][0]) : "Visto sui social";
}

export default function CommunityLocale({ id, contesto, loginHref = "/login", voto = null, userId }: Props & { userId: string | null }) {
  const [data, setData] = useState<{ id: string; c: Community } | null>(null);
  const [editing, setEditing] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [showAll, setShowAll] = useState(false);
  const [reelOpen, setReelOpen] = useState(false);
  const [reelLink, setReelLink] = useState("");
  const [reelMsg, setReelMsg] = useState<string | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch(`/api/places/community?id=${encodeURIComponent(id)}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((c: Community | null) => {
        if (!c) return;
        setData({ id, c });
        setEditing(false);
        setShowAll(false);
        setReelOpen(false);
        setStatus("idle");
        setRating(c.mia?.rating ?? 0);
        setComment(c.mia?.comment ?? "");
        if (c.recensioni.length > 0 || c.reel.length > 0) {
          trackFeature("community_scheda", { risultati: c.recensioni.length, stato: c.reel.length > 0 ? "con_reel" : "senza_reel", contesto });
        }
      })
      .catch(() => { /* rete assente o scheda chiusa: la sezione resta vuota */ });
    return () => ctrl.abort();
  }, [id, contesto]);

  const c = data?.id === id ? data.c : null;
  if (!c) return <div data-testid="community-caricamento" className="h-10" aria-hidden />;

  const mine = c.mia;
  const all = [...c.recensioni.map((r) => r.rating), ...(mine ? [mine.rating] : [])];
  const avg = all.length > 0 ? all.reduce((a, b) => a + b, 0) / all.length : null;
  const others = showAll ? c.recensioni : c.recensioni.slice(0, 3);
  const canWrite = userId != null && c.placeId != null;
  const formOpen = canWrite && (editing || !mine);

  const publish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canWrite) return;
    if (rating === 0) { setStatus("error"); return; }
    setStatus("saving");
    const ok = await saveReview(userId!, c.placeId!, rating, comment);
    if (!ok) { setStatus("error"); return; }
    trackFeature("recensione_community", { stato: mine ? "modifica" : "nuova", voto: rating, contesto, fonte: comment.trim() ? "con_commento" : "solo_stelle" });
    setData({ id, c: { ...c, mia: { rating, comment: comment.trim().slice(0, COMMENT_MAX) || null } } });
    setEditing(false);
    setStatus("done");
  };

  const saveReel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canWrite) return;
    const res = await addReel(userId!, c.placeId!, reelLink);
    if (res.esito === "ok") {
      const fonte = reelSourceOf(res.url)!;
      setData({ id, c: { ...c, reel: [{ id: `nuovo-${Date.now()}`, url: res.url, fonte, autore: null, mio: true }, ...c.reel.filter((r) => r.url !== res.url)] } });
      setReelLink("");
      setReelOpen(false);
      setReelMsg(null);
      trackFeature("reel", { stato: "aggiunto", fonte, contesto });
      return;
    }
    setReelMsg(
      res.esito === "non-valido" ? "Incolla il link di un reel Instagram, di un TikTok o di un video YouTube."
        : res.esito === "doppio" ? "Questo video è già collegato al locale."
          : res.esito === "in-arrivo" ? "I video collegati ai locali arrivano a breve."
            : "Non sono riuscito a salvarlo. Riprova.",
    );
  };

  return (
    <div data-testid="community-locale">
      {avg != null && (
        <p data-testid="community-media" className="flex items-baseline gap-1.5">
          <span className="font-display text-base font-semibold text-text">
            {avg.toLocaleString("it-IT", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
          </span>
          <Stars value={avg} />
          <span className="text-xs font-sans text-text-muted">
            {all.length === 1 ? "1 recensione Mapetite" : `${all.length} recensioni Mapetite`}
          </span>
        </p>
      )}

      {/* La tua recensione */}
      {mine && !editing && (
        <div data-testid="mia-recensione" className="mt-3 rounded-card border-2 border-accent/30 bg-surface p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-display font-semibold uppercase tracking-wide text-accent">La tua recensione</p>
            <button type="button" onClick={() => { setEditing(true); setStatus("idle"); }} className="min-h-10 px-1 text-sm font-display font-semibold text-brand">
              Modifica
            </button>
          </div>
          <Stars value={mine.rating} size="text-base" />
          {mine.comment && <p className="mt-1 break-words font-sans text-sm text-text">{mine.comment}</p>}
          {status === "done" && <p className="mt-1 text-xs font-sans text-success">Pubblicata ✓</p>}
        </div>
      )}
      {formOpen && (
        <form data-testid="recensione-form" onSubmit={publish} className="mt-3 rounded-card border border-border bg-surface p-3">
          <p className="font-display text-sm font-semibold text-text">{mine ? "Modifica la tua recensione" : "Com'era? Dillo alla community"}</p>
          {voto && !mine && (
            <p className="mt-0.5 text-xs font-sans text-text-muted">
              Hai detto {voto === "su" ? "👍 Mi è piaciuto" : "👎 Non fa per me"}: quante stelle gli dai?
            </p>
          )}
          <StarPicker value={rating} onChange={(v) => { setRating(v); setStatus("idle"); }} />
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value.slice(0, COMMENT_MAX))}
            placeholder="Due righe: cosa prendere, quando andarci… (facoltativo)"
            rows={2}
            maxLength={COMMENT_MAX}
            aria-label="Il tuo commento"
            className="mt-1 w-full resize-none rounded-btn border border-border bg-white px-3 py-2 text-base font-sans focus:outline-none focus:ring-1 focus:ring-brand"
          />
          <div className="mt-1 flex items-center justify-between gap-2">
            <span className="text-[11px] font-sans text-text-muted">La vedono tutti; il tuo nome solo se il profilo è pubblico.</span>
            <span className="shrink-0 text-[11px] font-sans text-text-muted">{comment.length}/{COMMENT_MAX}</span>
          </div>
          {status === "error" && (
            <p className="mt-1 text-xs font-sans text-error">{rating === 0 ? "Scegli da 1 a 5 stelle." : "Non sono riuscito a pubblicarla. Riprova."}</p>
          )}
          <div className="mt-2 flex gap-2">
            <button
              type="submit"
              disabled={status === "saving"}
              className="min-h-11 rounded-pill bg-brand px-5 text-sm font-display font-semibold text-white active:scale-95 disabled:opacity-60"
            >
              {status === "saving" ? "Pubblico…" : mine ? "Aggiorna" : "Pubblica"}
            </button>
            {mine && (
              <button type="button" onClick={() => { setEditing(false); setRating(mine.rating); setComment(mine.comment ?? ""); }} className="min-h-11 px-3 text-sm font-display font-semibold text-text-muted">
                Annulla
              </button>
            )}
          </div>
        </form>
      )}
      {userId == null && (
        <p className="mt-2 text-sm font-sans text-text-muted">
          <Link href={loginHref} className="font-display font-semibold text-brand underline underline-offset-2">Accedi</Link> per dire com&apos;era.
        </p>
      )}
      {userId != null && c.placeId == null && (
        <p className="mt-2 text-sm font-sans text-text-muted">Salva il locale per lasciare la tua recensione.</p>
      )}

      {/* Recensioni degli altri */}
      {c.recensioni.length > 0 ? (
        <>
          <ul className="mt-2 divide-y divide-border">
            {others.map((r) => <ReviewRow key={r.id} r={r} />)}
          </ul>
          {c.recensioni.length > 3 && !showAll && (
            <button type="button" onClick={() => setShowAll(true)} className="min-h-10 text-sm font-display font-semibold text-brand">
              Mostra tutte ({c.recensioni.length})
            </button>
          )}
        </>
      ) : !mine ? (
        <p data-testid="community-vuota" className="mt-2 text-sm font-sans text-text-muted">Ancora nessuna recensione: sii il primo a dire com&apos;era.</p>
      ) : null}

      {/* Reel e video collegati al locale */}
      {(c.reel.length > 0 || (canWrite && c.reelPronti)) && (
        <div data-testid="reel-sezione" className="mt-4">
          {c.reel.length > 0 && (
            <>
              <p className="font-display text-sm font-semibold text-text">{reelTitle(c.reel)}</p>
              <ul className="-mx-5 mt-2 flex snap-x gap-2 overflow-x-auto px-5 pb-1">
                {c.reel.map((r) => <ReelCard key={r.url} reel={r} contesto={contesto} />)}
              </ul>
            </>
          )}
          {canWrite && c.reelPronti && (
            reelOpen ? (
              <form data-testid="reel-form" onSubmit={saveReel} className="mt-2">
                <input
                  type="url"
                  inputMode="url"
                  value={reelLink}
                  onChange={(e) => { setReelLink(e.target.value); setReelMsg(null); }}
                  placeholder="Incolla il link del reel o del video"
                  aria-label="Link del video"
                  className="w-full rounded-btn border border-border bg-white px-3 py-2 text-base font-sans focus:outline-none focus:ring-1 focus:ring-brand"
                />
                {reelMsg && <p data-testid="reel-errore" className="mt-1 text-xs font-sans text-error">{reelMsg}</p>}
                <div className="mt-2 flex gap-2">
                  <button type="submit" className="min-h-11 rounded-pill bg-brand px-5 text-sm font-display font-semibold text-white active:scale-95">Collega</button>
                  <button type="button" onClick={() => { setReelOpen(false); setReelMsg(null); }} className="min-h-11 px-3 text-sm font-display font-semibold text-text-muted">Annulla</button>
                </div>
              </form>
            ) : (
              <button type="button" data-testid="reel-aggiungi" onClick={() => setReelOpen(true)} className="mt-1 inline-flex min-h-10 items-center gap-1 text-sm font-display font-semibold text-brand">
                <Plus size={16} /> {c.reel.length > 0 ? "Aggiungi un video" : "L'hai visto in un reel? Collegalo"}
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}
