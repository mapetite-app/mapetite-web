import { redirect } from "next/navigation";

// Prova dal vivo 8/11: "/raccolte" rispondeva "pagina non esiste". Le raccolte stanno nei Salvati.
export default function RaccoltePage() {
  redirect("/mappa?vista=salvati");
}
