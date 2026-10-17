// Il marchio di Mapetite (la "m" corallo con la forchetta dell'icona dell'app), disegnato in SVG:
// nitido a ogni misura e senza scaricare immagini. Sostituisce l'emoji 🍽️ in home e nelle pagine pubbliche.
export default function LogoMark({ size = 64, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      role="img"
      aria-label="Mapetite"
      className={className}
    >
      <rect width="512" height="512" rx="112" fill="#1a3c40" />
      <path
        d="M120 432V236a70 70 0 0 1 140 0v196M260 236a70 70 0 0 1 140 0v196"
        fill="none"
        stroke="#ff6b4a"
        strokeWidth="76"
        strokeLinecap="butt"
        strokeLinejoin="round"
      />
      {/* Forchetta nel vuoto della prima gamba della "m". */}
      <g fill="#ff6b4a">
        <rect x="172" y="224" width="7" height="50" rx="3.5" />
        <rect x="186.5" y="220" width="7" height="54" rx="3.5" />
        <rect x="201" y="224" width="7" height="50" rx="3.5" />
        <rect x="172" y="264" width="36" height="16" rx="8" />
        <rect x="184" y="272" width="12" height="80" rx="6" />
      </g>
      <circle cx="260" cy="72" r="20" fill="none" stroke="#ff6b4a" strokeWidth="10" />
    </svg>
  );
}
