import AmiciQuiBox from "@/components/amici-qui-box";
import { loadFriendsAtPlace } from "@/lib/social";

// "2 amici ci sono stati · 1 lo vuole provare" (piano 5.3): solo per chi ha l'accesso, solo tra
// le persone che segue, solo se ci sono dati. Altrimenti non si mostra nulla.
// Il riquadro è lo stesso della scheda della mappa (src/components/amici-qui-box.tsx).

export default async function AmiciQui({ placeId }: { placeId: string }) {
  const friends = await loadFriendsAtPlace(placeId);
  if (!friends) return null;
  return <AmiciQuiBox visitati={friends.visitati} daProvare={friends.daProvare} />;
}
