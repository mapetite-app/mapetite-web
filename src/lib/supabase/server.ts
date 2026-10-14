import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll viene chiamato da un Server Component: ignorabile
            // se c'è un Proxy che aggiorna le sessioni utente.
          }
        },
      },
    }
  );
}

// Utente della richiesta: layout e pagina lo chiedono entrambi, ma a Supabase si chiede una
// volta sola per richiesta (cache di React). Un viaggio di rete in meno a ogni pagina per chi ha
// fatto l'accesso. Solo per i componenti del server, non per le route API.
export const getUser = cache(async () => (await createClient()).auth.getUser());
