import { Link2 } from "lucide-react";
import CondividiLink from "@/components/condividi-link";
import { invitePath, myInviteCode } from "@/lib/invito";

// "Invita un amico" nel profilo e in Amici (piano 9.1): il proprio link /invito/<nome> da mandare su
// WhatsApp o dove si vuole (menu di condivisione del telefono, altrimenti copia il link).
// Senza nome pubblico il codice è un pezzo dell'id: funziona lo stesso, solo senza il nome.
// Revisore 2/11 (quarto giro): l'indirizzo grezzo ("/invito/u-00000000") non diceva niente a nessuno:
// si legge "Il tuo link d'invito" e il pulsante lo copia o lo condivide (l'indirizzo resta in data-path).
// Titolo in Inter medio, non Poppins.
// Revisore 2/11 (quinto giro): in Amici, senza amici, è lo stato vuoto della pagina ("vuoto"): tre posti
// per gli amici, una frase vera (niente promesse su funzioni che non ci sono) e l'invito a tutta larghezza.
export default function InvitaAmico({ userId, handle, vuoto = false }: { userId: string; handle: string | null; vuoto?: boolean }) {
  const path = invitePath(myInviteCode({ handle, id: userId }));
  const condividi = (cls: string, label: string) => (
    <CondividiLink
      path={path}
      title="Mapetite"
      text="Ti invito su Mapetite: la mappa dei locali che salvi e ritrovi quando devi scegliere."
      cosa="invito"
      label={label}
      testId="invita-amico-condividi"
      className={cls}
    />
  );
  if (vuoto) {
    return (
      <section data-testid="invita-amico" data-vuoto="1" className="relative mb-8 overflow-hidden rounded-card bg-brand px-5 pb-5 pt-6 text-center text-white shadow-card">
        <span aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/5" />
        <span aria-hidden className="pointer-events-none absolute -bottom-12 -left-8 h-28 w-28 rounded-full bg-white/5" />
        {/* Tre posti per gli amici: quello in mezzo è l'invito. */}
        <div aria-hidden className="relative mx-auto flex w-max items-center">
          <span className="h-12 w-12 rounded-full border-[1.5px] border-dashed border-white/35" />
          <span className="-mx-2 flex h-16 w-16 items-center justify-center rounded-full bg-white/15 text-3xl ring-4 ring-brand">💌</span>
          <span className="h-12 w-12 rounded-full border-[1.5px] border-dashed border-white/35" />
        </div>
        <p className="relative mt-4 font-sans text-[18px] font-medium leading-snug">Invita un amico</p>
        <p className="relative mx-auto mt-1 max-w-[290px] text-sm font-sans leading-relaxed text-white/80">
          Nessun amico qui, per ora. Mandagli il tuo link: in un minuto ha la sua mappa dei locali, e vi passate i posti con un tocco.
        </p>
        <div className="relative mt-4">
          {condividi("w-full min-h-12 border-0 bg-accent! text-[15px] text-white!", "Manda il tuo link")}
          <p data-testid="invita-amico-link" data-path={path} className="mt-2 text-xs font-sans text-white/65">Il tuo link d&apos;invito si apre anche senza l&apos;app.</p>
        </div>
      </section>
    );
  }

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
        {condividi("shrink-0 border-0", "Condividi")}
      </div>
    </section>
  );
}
