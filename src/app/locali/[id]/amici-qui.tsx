import Link from "next/link";
import Avatar from "@/components/avatar";
import { loadFriendsAtPlace } from "@/lib/social";
import { personName, profilePath } from "@/lib/handle";

// "2 amici ci sono stati · 1 lo vuole provare" (piano 5.3): solo per chi ha l'accesso, solo tra
// le persone che segue, solo se ci sono dati. Altrimenti non si mostra nulla.

function sentence(n: number, one: string, many: string): string {
  return n === 1 ? `1 amico ${one}` : `${n} amici ${many}`;
}

export default async function AmiciQui({ placeId }: { placeId: string }) {
  const friends = await loadFriendsAtPlace(placeId);
  if (!friends) return null;
  const { visitati, daProvare } = friends;
  const people = [...visitati, ...daProvare];
  const line = [
    visitati.length > 0 ? sentence(visitati.length, "ci è stato", "ci sono stati") : null,
    daProvare.length > 0 ? sentence(daProvare.length, "lo vuole provare", "lo vogliono provare") : null,
  ].filter(Boolean).join(" · ");

  return (
    <section data-testid="amici-qui" className="mx-5 mt-4 rounded-card border border-border bg-surface p-4">
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
            {visitati.includes(p) ? " (ci è stato)" : " (vuole provarlo)"}
          </span>
        ))}
        {people.length > 6 && ` e altri ${people.length - 6}`}
      </p>
    </section>
  );
}
