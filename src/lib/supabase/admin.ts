import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Client server-only con la service role key: bypassa le RLS.
 * Non importare mai da componenti client o file esposti al browser.
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
