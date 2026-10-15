import { redirect } from "next/navigation";

// Pagina vecchia, sostituita da "I miei salvati" sulla mappa: i link già condivisi portano lì.
export default function MieiLocaliPage() {
  redirect("/mappa?vista=salvati");
}
