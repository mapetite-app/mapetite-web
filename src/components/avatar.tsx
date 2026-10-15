import { personInitial } from "@/lib/handle";

// Avatar di una persona: iniziale su un colore Mapetite (niente foto: mai immagini finte).
// Il colore dipende dal nome, così la stessa persona ha sempre lo stesso.
const TONES = ["bg-brand text-white", "bg-accent text-white", "bg-brand-light text-white", "bg-accent-light text-accent"];

function tone(seed: string): string {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return TONES[h % TONES.length];
}

export default function Avatar({
  person,
  size = 40,
  className = "",
}: {
  person: { display_name?: string | null; handle?: string | null };
  size?: number;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}
      className={`flex shrink-0 items-center justify-center rounded-full font-display font-semibold ${tone(person.handle ?? person.display_name ?? "?")} ${className}`}
    >
      {personInitial(person)}
    </span>
  );
}
