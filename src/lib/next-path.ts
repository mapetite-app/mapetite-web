// Ritorno dopo l'accesso: chi apre un link condiviso (o una pagina che chiede l'accesso),
// tocca "Accedi" o "Crea un account" e finisce la registrazione, deve tornare dov'era.
// Il percorso viaggia nel parametro `next` di /login e /signup.
//
// Sicurezza (open redirect): si accettano SOLO percorsi interni al sito, cioè che iniziano
// con un solo "/" (mai "//" o "/\", che i browser leggono come un altro sito), senza
// protocollo, spazi o caratteri di controllo, e di lunghezza limitata. Tutto il resto
// viene ignorato, come se `next` non ci fosse.
//
// Modulo senza dipendenze: lo importa anche scripts/e2e/giro.mjs per i controlli.

export const NEXT_MAX_LENGTH = 512;

// Pagine verso cui non ha senso tornare (rimanderebbero di nuovo all'accesso o sono API).
const NO_RETURN = /^\/(login|signup|onboarding|api)(\/|\?|#|$)/;

export function safeNext(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const v = raw.trim();
  if (!v || v.length > NEXT_MAX_LENGTH) return null;
  if (v[0] !== "/" || v[1] === "/" || v[1] === "\\") return null;
  // Barre rovesciate, spazi e caratteri di controllo: alcuni browser li trasformano in "/".
  for (const ch of v) {
    const c = ch.charCodeAt(0);
    if (ch === "\\" || /\s/.test(ch) || c < 0x20 || c === 0x7f) return null;
  }
  let url: URL;
  try {
    url = new URL(v, "https://mapetite.invalid");
  } catch {
    return null;
  }
  if (url.origin !== "https://mapetite.invalid") return null;
  const path = `${url.pathname}${url.search}${url.hash}`;
  // Dopo la normalizzazione "/..//evil.com" diventa "//evil.com": va ricontrollato.
  if (path[1] === "/" || NO_RETURN.test(path)) return null;
  return path;
}

// "/login" + "/locali/abc" → "/login?next=%2Flocali%2Fabc". Senza `next` valido, `base` com'è.
export function withNext(base: string, next: string | null | undefined): string {
  const safe = safeNext(next);
  if (!safe) return base;
  return `${base}${base.includes("?") ? "&" : "?"}next=${encodeURIComponent(safe)}`;
}

// Dove andare dopo l'accesso: chi non ha ancora fatto l'onboarding ci passa (portandosi
// dietro `next`); gli altri tornano a `next`, oppure alla mappa come sempre.
export function afterLoginPath(next: string | null | undefined, onboardingCompleted: boolean): string {
  const safe = safeNext(next);
  if (!onboardingCompleted) return withNext("/onboarding", safe);
  return safe ?? "/mappa";
}
