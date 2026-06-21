import { getCategoryEmoji } from "@/lib/emoji";

type PlaceCardProps = {
  name: string;
  category: string | null;
  address: string | null;
  tags?: string[];
};

export default function PlaceCard({ name, category, address, tags }: PlaceCardProps) {
  const emoji = getCategoryEmoji(category, name);

  return (
    <div className="flex gap-4 bg-white rounded-card shadow-card border border-border p-4">
      {/* Emoji categoria */}
      <div className="flex-shrink-0 w-[42px] h-[42px] rounded-btn bg-accent-light flex items-center justify-center text-xl leading-none">
        {emoji}
      </div>

      {/* Contenuto */}
      <div className="flex-1 min-w-0">
        <p className="font-display font-semibold text-text leading-snug truncate">
          {name}
        </p>

        {category && (
          <p className="text-sm text-text-muted mt-0.5 truncate">{category}</p>
        )}

        {address && (
          <p className="flex items-center gap-1 text-xs text-text-muted mt-1 truncate">
            <PinIcon />
            {address}
          </p>
        )}

        {tags && tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {tags.map((tag) => (
              <span
                key={tag}
                className="rounded-pill bg-accent-light text-accent px-2.5 py-0.5 text-xs font-display font-medium"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PinIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      fill="currentColor"
      className="w-3 h-3 shrink-0"
    >
      <path
        fillRule="evenodd"
        d="M8 1.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9ZM2 6a6 6 0 1 1 10.743 3.67l-3.45 5.168a1.5 1.5 0 0 1-2.487 0L3.257 9.67A5.978 5.978 0 0 1 2 6ZM8 5a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z"
        clipRule="evenodd"
      />
    </svg>
  );
}
