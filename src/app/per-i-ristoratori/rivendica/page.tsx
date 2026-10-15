import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, MapPin } from "lucide-react";
import { getCategoryEmoji } from "@/lib/emoji";
import { displayAddress } from "@/lib/city";
import { currentUserId, loadPublicPlace } from "@/app/locali/[id]/dati";
import ModuloRivendica from "./modulo";
import { CONTACT } from "./mail";

export const metadata: Metadata = {
  title: "Rivendica il tuo locale · Mapetite",
  description: "Sei il titolare? Chiedi la verifica del tuo locale su Mapetite: badge “Verificato” e i numeri di chi ti cerca.",
  robots: { index: false, follow: true },
};

// Piano 8.1: "Sei il titolare? Rivendica questo locale" dalla pagina pubblica del locale (?locale=<UUID>)
// o da /per-i-ristoratori (senza locale: nome e città si scrivono a mano). La richiesta va nella
// tabella `claims` (migrazione 20261015_ristoratori.sql); senza tabella o senza accesso il modulo
// prepara un'email a Mapetite con gli stessi dati.
export default async function RivendicaPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const sp = await searchParams;
  const localeId = Array.isArray(sp.locale) ? sp.locale[0] : sp.locale;
  const data = localeId ? await loadPublicPlace(localeId) : null;
  const place = data?.place ?? null;
  const userId = await currentUserId();
  const ritorno = place ? `/per-i-ristoratori/rivendica?locale=${place.id}` : "/per-i-ristoratori/rivendica";

  return (
    <main className="mx-auto max-w-xl px-4 pb-28 pt-6">
      <Link href="/per-i-ristoratori" className="text-sm font-display font-semibold text-brand">← Mapetite per i ristoratori</Link>
      <h1 className="mt-3 font-title text-3xl font-semibold leading-tight text-brand">Rivendica il tuo locale</h1>
      <p className="mt-2 text-sm font-sans leading-relaxed text-text-muted">
        Verifichiamo che il locale sia tuo e accendiamo il badge <strong className="text-text">Verificato</strong>. Poi vedi quante persone ti trovano, ti salvano e ti scelgono su Mapetite.
      </p>

      {place && (
        <section data-testid="rivendica-scheda" className="mt-5 flex items-center gap-3 rounded-card border border-border bg-white p-4 shadow-card">
          <span aria-hidden className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand/10 text-2xl">
            {getCategoryEmoji(place.category, place.name)}
          </span>
          <div className="min-w-0">
            <p className="truncate font-display text-base font-semibold text-text">{place.name}</p>
            {place.address && (
              <p className="mt-0.5 flex items-start gap-1 text-xs font-sans text-text-muted">
                <MapPin size={12} className="mt-0.5 shrink-0" aria-hidden />
                <span className="line-clamp-2">{displayAddress(place.address)}</span>
              </p>
            )}
          </div>
        </section>
      )}

      {place?.verified_at ? (
        <section data-testid="rivendica-gia-verificato" className="mt-5 rounded-card bg-surface p-5">
          <p className="inline-flex items-center gap-1.5 font-display text-base font-semibold text-brand">
            <BadgeCheck size={18} aria-hidden /> Questo locale è già verificato
          </p>
          <p className="mt-1 text-sm font-sans text-text-muted">
            Se sei il titolare e non hai fatto tu la richiesta, scrivici a{" "}
            <a className="font-semibold text-brand underline" href={`mailto:${CONTACT}`}>{CONTACT}</a>.
          </p>
        </section>
      ) : (
        <ModuloRivendica
          place={place ? { id: place.id, name: place.name, address: place.address, googlePlaceId: place.google_place_id } : null}
          userId={userId}
          ritorno={ritorno}
        />
      )}

      <p className="mt-8 text-xs font-sans leading-relaxed text-text-muted">
        Usiamo questi dati solo per verificare la richiesta e ricontattarti. Non li mostriamo a nessuno e non li cediamo.
      </p>
    </main>
  );
}
