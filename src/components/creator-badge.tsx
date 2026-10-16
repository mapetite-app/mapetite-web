import { BadgeCheck } from "lucide-react";

// Badge "Creator" (piano 5.6b): food blogger, critici e guide scelti da Mapetite, mai
// autoassegnato (migrazione 20261016_creator.sql). Il tipo ("Food blogger", "Critico") se c'è.
export default function CreatorBadge({ tipo, size = "md" }: { tipo?: string | null; size?: "sm" | "md" }) {
  const small = size === "sm";
  return (
    <span
      data-testid="badge-creator"
      title={tipo ? `Creator · ${tipo}` : "Creator scelto da Mapetite"}
      className={`inline-flex max-w-full shrink-0 items-center gap-1 rounded-pill bg-accent font-display font-semibold text-white ${small ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-0.5 text-xs"}`}
    >
      <BadgeCheck size={small ? 11 : 13} aria-hidden className="shrink-0" />
      <span className="truncate">Creator{tipo && !small ? ` · ${tipo}` : ""}</span>
    </span>
  );
}
