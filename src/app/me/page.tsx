import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function MePage() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data?.user) {
    redirect("/login");
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <h1 className="text-2xl font-bold text-zinc-900 mb-2">
        Il tuo profilo
      </h1>
      <p className="text-zinc-500">Sei loggato come:</p>
      <p className="mt-1 text-lg font-medium text-zinc-900">
        {data.user.email}
      </p>
    </div>
  );
}
