import { collectionColor, placesLabel } from "@/lib/raccolte";

// Copertina "a cartella" di una raccolta (piano 4.1), come le collezioni di Albo e Places:
// riquadro colorato con le emoji dei primi locali in griglia, sotto nome e numero di locali.
// Il colore dipende dal nome, quindi resta lo stesso a ogni apertura. Nessuna foto: le foto
// Google non si possono conservare (termini Google 3.2.3(b)) e le emoji si vedono subito.
export default function RaccoltaCopertina({
  name,
  count,
  emojis,
  names = [],
  covers = true,
  compact = false,
}: {
  name: string;
  count: number;
  emojis: string[];
  names?: string[];
  covers?: boolean; // ?beta=-copertine: solo l'iniziale, come prima
  compact?: boolean; // pagina pubblica: cartelle più basse
}) {
  const tiles = emojis.slice(0, 4);
  return (
    <span className="flex h-full flex-col overflow-hidden rounded-card border border-border bg-white shadow-card">
      <span
        aria-hidden
        className={`relative flex ${compact ? "h-20" : "h-[104px]"} items-stretch p-2`}
        style={{ backgroundColor: collectionColor(name) }}
      >
        {covers ? (
          <span data-testid="raccolta-copertina" className="grid w-full grid-cols-2 grid-rows-2 gap-1.5 pt-1.5">
            {tiles.map((e, i) => (
              <span key={i} className="flex items-center justify-center rounded-btn bg-white/15 text-[22px] leading-none">
                {e}
              </span>
            ))}
            {Array.from({ length: Math.max(0, 4 - tiles.length) }, (_, i) => (
              <i key={`v${i}`} className="block rounded-btn border border-dashed border-white/20" />
            ))}
          </span>
        ) : (
          <span className="flex w-full items-center justify-center font-title text-4xl font-semibold text-white/90">
            {name.charAt(0).toUpperCase()}
          </span>
        )}
      </span>
      {/* pr-8: a destra c'è il pulsante ⋯ della raccolta (nel profilo), non deve coprire il testo. */}
      <span className="block min-w-0 flex-1 pb-3 pl-3 pr-8 pt-2.5">
        {/* Parole intere a capo: affiancati a un'icona, a 360-390px i nomi si spezzavano a metà parola. */}
        <span data-testid="raccolta-nome" className="line-clamp-2 font-display text-[15px] font-semibold leading-tight text-text [overflow-wrap:anywhere] [word-break:normal]">
          {name}
        </span>
        {covers && names.length > 0 ? (
          <span data-testid="raccolta-anteprima" className="mt-1 block truncate text-xs text-text-muted">
            {placesLabel(count)} · {names.join(", ")}
          </span>
        ) : (
          <span className="mt-1 block text-xs text-text-muted">{placesLabel(count)}</span>
        )}
      </span>
    </span>
  );
}
