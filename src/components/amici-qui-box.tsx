import Link from "next/link";
import Avatar from "@/components/avatar";
import { personName, profilePath } from "@/lib/handle";

// "2 amici ci sono stati · 1 lo vuole provare" (piani 5.3 e 6.2): solo tra le persone che segui.
// Usato dalla pagina pubblica del locale (dati dal server) e dalla scheda della mappa
// (dati da /api/places/amici). Nessun dato → chi lo usa non lo mostra.

export type FriendPerson = { user_id: string; handle: string; display_name: string | null };

function sentence(n: number, one: string, many: string): string {
  return n === 1 ? `1 amico ${one}` : `${n} amici ${many}`;
}

export default function AmiciQuiBox({
  visitati,
  daProvare,
  className = "mx-5 mt-4",
}: {
  visitati: FriendPerson[];
  daProvare: FriendPerson[];
  className?: string;
}) {
  const people = [...visitati, ...daProvare];
  if (people.length === 0) return null;
  const visited = new Set(visitati.map((p) => p.user_id));
  const line = [
    visitati.length > 0 ? sentence(visitati.length, "ci è stato", "ci sono stati") : null,
    daProvare.length > 0 ? sentence(daProvare.length, "lo vuole provare", "lo vogliono provare") : null,
  ].filter(Boolean).join(" · ");

  return (
    <section data-testid="amici-qui" className={`${className} rounded-card border border-border bg-surface p-4`}>
      <div className="flex items-center gap-3">
        <span className="flex shrink-0 -space-x-2">
          {people.slice(0, 4).map((p) => (
            <Avatar key={p.user_id} person={p} size={32} className="ring-2 ring-surface" />
          ))}
        </span>
        <p className="min-w-0 font-display text-sm font-semibold text-brand">{line}</p>
      </div>
      <p className="mt-2 text-xs font-sans leading-relaxed text-text-muted">
        {people.slice(0, 6).map((p, i) => (
          <span key={p.user_id}>
            {i > 0 && ", "}
            <Link href={profilePath(p.handle)} className="font-display font-semibold text-text">{personName(p)}</Link>
            {visited.has(p.user_id) ? " (l'ha provato)" : " (vuole provarlo)"}
          </span>
        ))}
        {people.length > 6 && ` e altri ${people.length - 6}`}
      </p>
    </section>
  );
}
