import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

// In Next.js 16 il file "middleware.ts" è stato rinominato "proxy.ts":
// questa funzione gira su ogni richiesta (lato server) prima che la pagina
// venga renderizzata, e qui la usiamo per mantenere aggiornata la sessione
// utente di Supabase.
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
