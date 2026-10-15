import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Map as MapIcon } from "lucide-react";
import MappaPersonaLazy from "@/components/mappa-persona-lazy";
import CondividiLink from "@/components/condividi-link";
import RaccoltaAzioni from "@/components/raccolta-azioni";
import { getCategoryEmoji } from "@/lib/emoji";
import { categoryLabel } from "@/lib/category-label";
import { cityFromAddress } from "@/lib/city";
import { isStateTag } from "@/lib/tags";
import { collectionColor, collectionFromParam, inCollection, placesLabel, publicCollectionPath, summarizeCollections } from "@/lib/raccolte";
import { loadMySaved, myUserId, withVerdicts } from "@/lib/raccolte-server";
import { loadMySocial } from "@/lib/social";

// Pagina di una propria raccolta (piano 4.1): cartella aperta con mini mappa e lista dei locali,
// verdetto già in memoria, condivisione con link (se il profilo è pubblico) e gestione (⋯).

type Props = { params: Promise<{ nome: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const name = collectionFromParam((await params).nome);
  return { title: name ? `${name} · Le tue raccolte · Mapetite` : "Raccolta · Mapetite" };
}

function Barra() {
  return (
    <div className="flex items-center justify-between px-4 pt-4">
      <Link href="/profilo" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-display font-semibold text-brand">
        <ArrowLeft size={18} aria-hidden /> Profilo
      </Link>
    </div>
  );
}

export default async function RaccoltaPage({ params }: Props) {
  const name = collectionFromParam((await params).nome);
  const userId = await myUserId();

  if (!userId) {
    return (
      <main className="mx-auto max-w-md px-6 py-16 text-center">
        <p className="font-display text-xl font-semibold text-brand">Le tue raccolte ti aspettano</p>
        <p className="mt-2 text-sm text-text-muted">Accedi per aprire le tue raccolte.</p>
        <a href={`/login?next=${encodeURIComponent(`/raccolte/${encodeURIComponent(name ?? "")}`)}`} className="mt-4 inline-flex min-h-11 items-center rounded-pill bg-brand px-5 text-sm font-display font-semibold text-white">
          Accedi
        </a>
      </main>
    );
  }

  const [all, social] = await Promise.all([loadMySaved(userId), loadMySocial(userId)]);
  const rows = name && !isStateTag(name) ? await withVerdicts(inCollection(all, name)) : [];

  if (!name || rows.length === 0) {
    return (
      <main className="mx-auto min-h-dvh max-w-md bg-bg pb-10" data-testid="raccolta-vuota">
        <Barra />
        <section className="mx-4 mt-6 rounded-card border border-border bg-surface p-6 text-center">
          <p aria-hidden className="text-4xl">📂</p>
          <p className="mt-2 font-display text-lg font-semibold text-brand">Raccolta vuota</p>
          <p className="mx-auto mt-1 max-w-xs text-sm text-text-muted">
            In questa raccolta non c&apos;è più nessun locale. Dalla scheda di un locale salvato puoi aggiungerlo a una raccolta.
          </p>
          <Link href="/profilo" className="mt-4 inline-flex min-h-11 items-center rounded-pill bg-brand px-5 text-sm font-display font-semibold text-white">
            Le tue raccolte
          </Link>
        </section>
      </main>
    );
  }

  const others = summarizeCollections(all).filter((c) => c.name !== name).map((c) => ({ name: c.name, count: c.count }));
  const allTags = [...new Set(all.flatMap((r) => r.tags))];
  const cities = [...new Set(rows.map((r) => cityFromAddress(r.address)).filter((c): c is string => !!c))];
  const spots = rows.flatMap((r) =>
    r.lat != null && r.lng != null
      ? [{ id: r.placeId, name: r.name, category: r.category, lat: Number(r.lat), lng: Number(r.lng), visited: r.tags.includes("Già visitato") }]
      : [],
  );
  const me = "stato" in social ? null : social;
  const shareable = me?.is_public && me.handle ? publicCollectionPath(me.handle, name) : null;
  const visited = rows.filter((r) => r.tags.includes("Già visitato")).length;

  return (
    <main className="mx-auto min-h-dvh max-w-md bg-bg pb-10" data-testid="raccolta-pagina">
      <Barra />

      <header className="px-4 pt-3">
        <div className="relative overflow-hidden rounded-card px-4 pb-4 pt-5 text-white shadow-card" style={{ backgroundColor: collectionColor(name) }}>
          <span aria-hidden className="pointer-events-none absolute -bottom-3 -right-1 flex gap-1 text-[56px] leading-none opacity-30">
            {rows.slice(0, 3).map((r) => <span key={r.placeId}>{getCategoryEmoji(r.category, r.name)}</span>)}
          </span>
          <p className="relative text-[11px] font-display font-semibold uppercase tracking-wider text-white/70">Raccolta</p>
          <h1 data-testid="raccolta-titolo" className="relative mt-1 font-title text-[28px] font-semibold leading-tight [overflow-wrap:anywhere]">{name}</h1>
          <p className="relative mt-1 text-sm text-white/80">
            {placesLabel(rows.length)}
            {visited > 0 && ` · ${visited} già provat${visited === 1 ? "o" : "i"}`}
            {cities.length > 0 && ` · ${cities.slice(0, 2).join(", ")}${cities.length > 2 ? "…" : ""}`}
          </p>
        </div>

        <div className="mt-3 flex items-center gap-2">
          {shareable ? (
            <CondividiLink path={shareable} cosa="raccolta" title={`${name} · Mapetite`} text={`La mia raccolta “${name}” su Mapetite`} testId="condividi-raccolta" variant="solid" />
          ) : (
            <Link href="/profilo#profilo-pubblico" data-testid="condividi-raccolta-privata" className="inline-flex min-h-11 items-center rounded-pill border border-border bg-white px-4 text-sm font-display font-semibold text-brand">
              Condividi
            </Link>
          )}
          <Link
            href={`/mappa?${new URLSearchParams({ vista: "salvati", tag: name }).toString()}`}
            data-testid="raccolta-sulla-mappa"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-pill border border-border bg-white px-4 text-sm font-display font-semibold text-brand"
          >
            <MapIcon size={16} aria-hidden /> Sulla mappa
          </Link>
          <span className="flex-1" />
          <RaccoltaAzioni userId={userId} name={name} rows={rows.map((r) => ({ placeId: r.placeId, tags: r.tags }))} allTags={allTags} others={others} />
        </div>
        {!shareable && (
          <p data-testid="raccolta-privata" className="mt-2 text-xs text-text-muted">
            Per mandare il link a un amico, rendi pubblico il tuo profilo: la raccolta si aprirà in sola lettura, senza le tue note.
          </p>
        )}
      </header>

      {spots.length > 0 && (
        <section className="mt-5 px-4" aria-label="Mappa della raccolta">
          <div className="h-44">
            <MappaPersonaLazy spots={spots} className="h-full w-full" />
          </div>
        </section>
      )}

      <section className="mt-5 px-4" aria-label="Locali della raccolta">
        <ul className="space-y-2" data-testid="raccolta-lista">
          {rows.map((r) => {
            const meta = [categoryLabel(r.category), cityFromAddress(r.address)].filter(Boolean).join(" · ");
            const done = r.tags.includes("Già visitato");
            return (
              <li key={r.placeId}>
                <Link
                  href={`/mappa?salvato=${r.placeId}`}
                  data-testid="raccolta-locale"
                  className="flex gap-3 rounded-card border border-border bg-white p-3 shadow-card active:scale-[0.99] transition-transform duration-150"
                >
                  <span aria-hidden className="flex h-12 w-12 shrink-0 items-center justify-center rounded-btn bg-accent-light text-2xl">
                    {getCategoryEmoji(r.category, r.name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start gap-2">
                      <span className="min-w-0 flex-1 truncate font-display text-[15px] font-semibold text-text">{r.name}</span>
                      <span className={`shrink-0 rounded-pill px-2 py-0.5 text-[11px] font-display font-semibold ${done ? "bg-accent-light text-accent" : "bg-brand/10 text-brand"}`}>
                        {done ? "✓ Provato" : "📌 Da provare"}
                      </span>
                    </span>
                    {meta && <span className="mt-0.5 block truncate text-xs text-text-muted">{meta}</span>}
                    {r.verdict && <span data-testid="raccolta-verdetto" className="mt-1.5 block text-[13px] leading-snug text-text line-clamp-2">{r.verdict}</span>}
                    {r.note && <span className="mt-1 block truncate text-xs italic text-text-muted">“{r.note}”</span>}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}
