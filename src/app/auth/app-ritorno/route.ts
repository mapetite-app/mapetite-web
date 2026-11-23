import type { NextRequest } from "next/server";

// Solo per l'app iPhone (DA-FARE 14). Google non permette l'accesso dentro una
// WebView: l'app apre Supabase nel foglio di Safari (ASWebAuthenticationSession)
// e fa tornare l'accesso qui, invece che direttamente su /auth/conferma.
// Questa route rimanda a `mapetite://accesso?dopo=…&code=…`: il foglio si chiude
// e l'app carica `dopo` con il code nella sua WebView, dove c'è il cookie PKCE.
// Il code da solo non apre la sessione senza quel cookie, quindi passarlo all'app
// non espone niente. `dopo` deve essere una pagina di conferma del nostro sito.
export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const dopo = params.get("dopo");
  let valido: URL | null = null;
  try {
    const u = dopo ? new URL(dopo) : null;
    if (u && u.origin === request.nextUrl.origin && u.pathname === "/auth/conferma") valido = u;
  } catch {
    valido = null;
  }
  if (!valido) {
    return Response.redirect(new URL("/login", request.nextUrl.origin), 302);
  }
  const ritorno = new URLSearchParams();
  ritorno.set("dopo", valido.toString());
  for (const chiave of ["code", "error", "error_code", "error_description"]) {
    const v = params.get(chiave);
    if (v) ritorno.set(chiave, v);
  }
  return new Response(null, {
    status: 302,
    headers: { Location: `mapetite://accesso?${ritorno.toString()}`, "Cache-Control": "no-store" },
  });
}
