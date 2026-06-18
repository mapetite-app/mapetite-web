"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Review } from "./page";

type Place = {
  id: string;
  name: string;
  category: string | null;
  address: string | null;
};

function Stars({ rating, max = 5 }: { rating: number; max?: number }) {
  const filled = Math.round(Math.max(0, Math.min(max, rating)));
  return (
    <span aria-label={`${filled} stelle su ${max}`}>
      <span className="text-amber-400">{"★".repeat(filled)}</span>
      <span className="text-zinc-300">{"★".repeat(max - filled)}</span>
    </span>
  );
}

function StarPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          onMouseEnter={() => setHovered(star)}
          onMouseLeave={() => setHovered(0)}
          className="text-2xl leading-none focus:outline-none"
          aria-label={`${star} stelle`}
        >
          <span
            className={
              (hovered || value) >= star ? "text-amber-400" : "text-zinc-300"
            }
          >
            ★
          </span>
        </button>
      ))}
    </div>
  );
}

function ReviewForm({
  placeId,
  userId,
  existing,
  onDone,
}: {
  placeId: string;
  userId: string;
  existing: Review | null;
  onDone: (review: Review) => void;
}) {
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [comment, setComment] = useState(existing?.comment ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) {
      setError("Seleziona una valutazione.");
      return;
    }
    setError(null);

    startTransition(async () => {
      const supabase = createClient();
      const commentValue = comment.trim() || null;

      if (existing) {
        const { data, error: err } = await supabase
          .from("reviews")
          .update({ rating, comment: commentValue })
          .eq("id", existing.id)
          .select("id, user_id, rating, comment, created_at")
          .single();
        if (err) {
          setError("Errore durante il salvataggio.");
          return;
        }
        onDone(data as Review);
      } else {
        const { data, error: err } = await supabase
          .from("reviews")
          .insert({ place_id: placeId, user_id: userId, rating, comment: commentValue })
          .select("id, user_id, rating, comment, created_at")
          .single();
        if (err) {
          setError("Errore durante il salvataggio.");
          return;
        }
        onDone(data as Review);
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <p className="mb-1 text-sm text-zinc-500">Valutazione</p>
        <StarPicker value={rating} onChange={setRating} />
      </div>
      <div>
        <p className="mb-1 text-sm text-zinc-500">Commento (opzionale)</p>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          placeholder="Scrivi un commento..."
          className="w-full resize-none rounded-md border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending
          ? "..."
          : existing
          ? "Aggiorna recensione"
          : "Pubblica recensione"}
      </button>
    </form>
  );
}

export default function PlaceDetailView({
  place,
  reviews: initialReviews,
  userId,
  placeId,
}: {
  place: Place;
  reviews: Review[];
  userId: string | null;
  placeId: string;
}) {
  const [reviews, setReviews] = useState<Review[]>(initialReviews);
  const router = useRouter();

  const myReview = userId
    ? (reviews.find((r) => r.user_id === userId) ?? null)
    : null;

  const avgRating =
    reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : null;

  const handleDone = (updated: Review) => {
    setReviews((prev) => {
      const exists = prev.find((r) => r.id === updated.id);
      if (exists) return prev.map((r) => (r.id === updated.id ? updated : r));
      return [updated, ...prev];
    });
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("it-IT", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <button
        type="button"
        onClick={() => router.back()}
        className="mb-6 text-sm text-zinc-500 hover:text-zinc-900"
      >
        ← Torna indietro
      </button>

      <h1 className="text-2xl font-bold text-zinc-900">{place.name}</h1>
      {place.category && (
        <p className="mt-1 text-zinc-500">{place.category}</p>
      )}
      {place.address && (
        <p className="text-sm text-zinc-400">{place.address}</p>
      )}

      {avgRating !== null && (
        <div className="mt-2 flex items-center gap-2">
          <Stars rating={avgRating} />
          <span className="text-sm text-zinc-500">
            {avgRating.toFixed(1)} ·{" "}
            {reviews.length === 1
              ? "1 recensione"
              : `${reviews.length} recensioni`}
          </span>
        </div>
      )}

      <hr className="my-8 border-zinc-200" />

      <section className="mb-10">
        <h2 className="mb-4 text-lg font-semibold text-zinc-900">
          {myReview ? "La tua recensione" : "Lascia una recensione"}
        </h2>
        {userId ? (
          <ReviewForm
            placeId={placeId}
            userId={userId}
            existing={myReview}
            onDone={handleDone}
          />
        ) : (
          <p className="text-sm text-zinc-500">
            <a href="/login" className="underline hover:text-zinc-900">
              Accedi
            </a>{" "}
            per lasciare una recensione.
          </p>
        )}
      </section>

      {reviews.length > 0 ? (
        <section>
          <h2 className="mb-4 text-lg font-semibold text-zinc-900">
            Recensioni ({reviews.length})
          </h2>
          <ul className="space-y-6">
            {reviews.map((review) => (
              <li key={review.id} className="border-b border-zinc-100 pb-6 last:border-0">
                <div className="flex items-center gap-2">
                  <Stars rating={review.rating} />
                  {review.user_id === userId && (
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500">
                      Tu
                    </span>
                  )}
                </div>
                {review.comment && (
                  <p className="mt-2 text-sm text-zinc-700">{review.comment}</p>
                )}
                <p className="mt-1 text-xs text-zinc-400">
                  {formatDate(review.created_at)}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="text-sm text-zinc-400">
          Ancora nessuna recensione per questo locale.
        </p>
      )}
    </div>
  );
}
