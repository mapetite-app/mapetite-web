"use client";

import { useEffect, useState } from "react";
import InvitoAccetta from "@/components/invito-accetta";
import { chiInvita } from "@/app/onboarding/actions";
import { clearStoredInvite, isFriendCode, readStoredInvite } from "@/lib/invito";
import { trackFeature } from "@/lib/track";

// L'invito di un amico rimasto senza risposta (revisore 14/11, terzo giro): chi chiudeva il primo accesso con
// "Apri la mia mappa" senza toccare "Diventa amico" o "Non ora" lo perdeva. Il codice resta nel telefono e qui
// si ripropone, finché non si risponde. Mai accettato in automatico.
// Revisore 14/11 (quarto giro): se siete già amici, "Siete già amici" e basta (niente "Diventa amico").
export default function InvitoSospeso({ senzaNome }: { senzaNome: boolean }) {
  const [invito, setInvito] = useState<{ codice: string; nome: string | null; amico: boolean } | null>(null);

  useEffect(() => {
    const codice = readStoredInvite();
    if (!isFriendCode(codice)) return;
    let vivo = true;
    chiInvita(codice)
      .then((r) => {
        if (!vivo || r === "rete") return; // si riprova alla prossima apertura
        if (r) setInvito({ codice, nome: r.nome, amico: r.amico });
        else clearStoredInvite(); // il codice non esiste più (per esempio dopo "Nuovo link")
        if (r && r.amico) clearStoredInvite(); // già amici: non c'è niente da rispondere
      })
      .catch(() => {});
    return () => { vivo = false; };
  }, []);

  if (!invito) return null;
  if (invito.amico) {
    return (
      <p data-testid="invito-gia-amici" className="mt-4 rounded-card border border-[#e3e7e7] bg-white p-4 text-[15px] font-sans text-text">
        🤝 Tu e {invito.nome ?? "chi ti ha invitato"} siete già amici.
      </p>
    );
  }
  return (
    <section data-testid="invito-sospeso" aria-label="Invito di un amico" className="mt-4 rounded-card border border-[#e3e7e7] bg-white p-4">
      <p className="font-display text-[15px] font-semibold text-text">💌 {invito.nome ?? "Un amico"} ti ha invitato</p>
      <p className="mb-3 mt-0.5 text-[13px] font-sans text-text-muted">Da amici vi vedete per nome qui in Amici.</p>
      <InvitoAccetta
        codice={invito.codice}
        nome={invito.nome}
        chiediNome={senzaNome}
        contesto="amici"
        className=""
        nonOra={() => {
          trackFeature("invito_amico", { stato: "non_ora", contesto: "amici" });
          clearStoredInvite();
          setInvito(null);
        }}
      />
    </section>
  );
}
