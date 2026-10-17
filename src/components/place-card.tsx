import { STATE_TAGS, sortTags, tagLabel } from "@/lib/tags";
import { getCategoryEmoji } from "@/lib/emoji";
import { categoryLabel } from "@/lib/category-label";

type PlaceCardProps = {
  name: string;
  category: string | null;
  address: string | null;
  tags?: string[];
  note?: string | null;
};

// Card di un salvato nel profilo. Più leggera dal 17/10 (stile Places): tipo e via su una riga (la città è già nel titolo del gruppo),
// lo stato ("Voglio andarci" / "Ci sono stato") in corallo, le raccolte in grigio.
export default function PlaceCard({ name, category, address, tags, note }: PlaceCardProps) {
  const emoji = getCategoryEmoji(category, name);
  const isState = (t: string) => (STATE_TAGS as readonly string[]).includes(t);
  const meta = [category ? categoryLabel(category) : null, address?.split(",")[0]?.trim() || null].filter(Boolean).join(" · ");

  return (
    <div className="flex gap-3 bg-white rounded-card border border-border p-3">
      {/* Emoji categoria */}
      <div className="flex-shrink-0 w-[42px] h-[42px] rounded-btn bg-surface flex items-center justify-center text-xl leading-none">
        {emoji}
      </div>

      {/* Contenuto */}
      <div className="flex-1 min-w-0">
        <p className="font-display font-semibold text-text leading-snug truncate">
          {name}
        </p>

        {meta && (
          <p className="text-sm text-text-muted mt-0.5 truncate">{meta}</p>
        )}

        {tags && tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {sortTags(tags).map((tag) => (
              <span
                key={tag}
                className={`rounded-pill px-2.5 py-0.5 text-xs font-display font-medium ${isState(tag) ? "bg-accent-light text-accent" : "bg-surface text-text-muted"}`}
              >
                {tagLabel(tag)}
              </span>
            ))}
          </div>
        )}

        {note && (
          <p className="mt-1.5 text-xs text-text-muted italic">{note}</p>
        )}
      </div>
    </div>
  );
}
