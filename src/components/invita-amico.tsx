import CondividiLink from "@/components/condividi-link";
import { invitePath, myInviteCode } from "@/lib/invito";

// "Invita un amico" nel profilo (piano 9.1): il proprio link /invito/<nome> da mandare su
// WhatsApp o dove si vuole (menu di condivisione del telefono, altrimenti copia il link).
// Senza nome pubblico il codice è un pezzo dell'id: funziona lo stesso, solo senza il nome.
export default function InvitaAmico({ userId, handle }: { userId: string; handle: string | null }) {
  const path = invitePath(myInviteCode({ handle, id: userId }));
  return (
    <section data-testid="invita-amico" className="relative mb-8 overflow-hidden rounded-card bg-brand p-4 text-white shadow-card">
      <span aria-hidden className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-white/5" />
      <div className="relative flex items-center gap-3">
        <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/15 text-xl">💌</span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-base font-semibold">Invita un amico</p>
          <p className="text-sm font-sans text-white/80">Mandagli il tuo link: in un minuto ha la sua mappa dei locali.</p>
        </div>
      </div>
      <div className="relative mt-3 flex items-center gap-2">
        <p data-testid="invita-amico-link" className="min-w-0 flex-1 truncate rounded-pill bg-white/10 px-3 py-2.5 text-sm font-sans text-white/85">{path}</p>
        <CondividiLink
          path={path}
          title="Mapetite"
          text="Ti invito su Mapetite: la mappa dei locali che salvi e ritrovi quando devi scegliere."
          cosa="invito"
          label="Invita"
          testId="invita-amico-condividi"
          className="shrink-0 border-0"
        />
      </div>
    </section>
  );
}
