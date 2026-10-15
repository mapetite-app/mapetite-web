import Link from "next/link";
import { withNext } from "@/lib/next-path";

// Invito in fondo ai link condivisi (profilo, mappa di una persona) per chi non ha l'account:
// il passaparola diventa un nuovo utente. Dopo la registrazione si torna alla pagina di partenza.
export default function InvitoMapetite({ returnPath }: { returnPath: string }) {
  return (
    <section data-testid="invito-crea-mappa" className="mx-4 mt-8 rounded-card bg-brand p-5 text-white shadow-card">
      <p className="text-xs font-display font-semibold uppercase tracking-wide text-accent">Mapetite</p>
      <p className="mt-1 font-title text-2xl font-semibold leading-tight">Crea la tua mappa su Mapetite</p>
      <p className="mt-2 text-sm font-sans leading-relaxed text-white/80">
        Salva i locali che scopri sui social o dagli amici, ritrovali quando devi scegliere e segui chi ha i tuoi gusti.
      </p>
      <Link
        href={withNext("/signup", returnPath)}
        className="mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-pill bg-accent px-5 text-[15px] font-display font-semibold text-white active:scale-95"
      >
        Crea la tua mappa, è gratis
      </Link>
      <Link
        href={withNext("/login", returnPath)}
        className="mt-2 inline-flex min-h-11 w-full items-center justify-center text-sm font-display font-semibold text-white/85"
      >
        Hai già un account? Accedi
      </Link>
    </section>
  );
}
