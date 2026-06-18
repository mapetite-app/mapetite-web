import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PlaceDetailView from "./place-detail-view";

export type Review = {
  id: string;
  user_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
};

export default async function PlaceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: place }, { data: reviews }, { data: userData }] =
    await Promise.all([
      supabase
        .from("places")
        .select("id, name, category, address")
        .eq("id", id)
        .single(),
      supabase
        .from("reviews")
        .select("id, user_id, rating, comment, created_at")
        .eq("place_id", id)
        .order("created_at", { ascending: false }),
      supabase.auth.getUser(),
    ]);

  if (!place) notFound();

  return (
    <PlaceDetailView
      place={place as { id: string; name: string; category: string | null; address: string | null }}
      reviews={(reviews ?? []) as Review[]}
      userId={userData?.user?.id ?? null}
      placeId={id}
    />
  );
}
