import { Link2 } from "lucide-react";
import CondividiLink from "@/components/condividi-link";
import { invitePath, myInviteCode } from "@/lib/invito";

// "Invita un amico" nel profilo e in Amici (piano 9.1): il proprio link /invito/<nome> da mandare su
// WhatsApp o dove si vuole (menu di condivisione del telefono, altrimenti copia il link).
// Senza nome pubblico il codice è un pezzo dell'id: funziona lo stesso, solo senza il nome.
// Revisore 2/11 (quarto giro): l'indirizzo grezzo ("/invito/u-00000000") non diceva niente a nessuno:
// si legge "Il tuo link d'invito" e il pulsante lo copia o lo condivide (l'indirizzo resta in data-path).
// Titolo in Inter medio, non Poppins.
export default function InvitaAmico({ userId, handle }: { userId: string; handle: string | null }) {
  const path = invitePath(myInviteCode({ handle, id: userId }));
  return (
    <section data-testid="invita-amico" className="relative mb-8 overflow-hidden rounded-card bg-brand p-4 text-white shadow-card">
      <span aria-hidden className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-white/5" />
      <div className="relative flex items-center gap-3">
        <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/15 text-xl">💌</span>
        <div className="min-w-0 flex-1">
          <p className="font-sans text-[16px] font-medium leading-snug">Invita un amico</p>
          <p className="text-sm font-sans text-white/80">Mandagli il tuo link: in un minuto ha la sua mappa dei locali.</p>
        </div>
      </div>
      <div className="relative mt-3 flex items-center gap-2">
        <p data-testid="invita-amico-link" data-path={path} title={path} className="flex min-w-0 flex-1 items-center gap-2 truncate rounded-pill bg-white/10 px-3 py-2.5 text-sm font-sans text-white/85">
          <Link2 size={15} aria-hidden className="shrink-0 text-white/70" />
          <span className="truncate">Il tuo link d&apos;invito</span>
        </p>
        <CondividiLink
          path={path}
          title="Mapetite"
          text="Ti invito su Mapetite: la mappa dei locali che salvi e ritrovi quando devi scegliere."
          cosa="invito"
          label="Condividi"
          testId="invita-amico-condividi"
          className="shrink-0 border-0"
        />
      </div>
    </section>
  );
}
