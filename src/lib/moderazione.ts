// Proposta 82 "Segnala e nascondi" (23/11, regola 1.2 dell'App Store): tipi e motivi comuni a
// telefono e server. Le scritture passano solo da /api/moderazione (chiave di servizio).
export type TipoContenuto = "recensione" | "foto";
export type Motivo = "offensiva" | "falsa" | "fuori_tema" | "altro";

export const MOTIVI: { id: Motivo; label: string }[] = [
  { id: "offensiva", label: "Offensiva" },
  { id: "falsa", label: "Falsa o pubblicità" },
  { id: "fuori_tema", label: "Non c'entra" },
  { id: "altro", label: "Altro" },
];

export const isTipo = (v: unknown): v is TipoContenuto => v === "recensione" || v === "foto";
export const isMotivo = (v: unknown): v is Motivo => MOTIVI.some((m) => m.id === v);
