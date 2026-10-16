"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { CalendarCheck } from "lucide-react";
import { loadBookings, splitBookings, subscribeBookings, type BookingRequest } from "@/lib/booking";
import { TILE_CLASS, TileBody } from "@/components/profilo-tessera";

// Tessera "Prenotazioni" di "Le mie cose" nel profilo: quelle in arrivo (salvate nel telefono).
const EMPTY: BookingRequest[] = [];

export default function ProfiloPrenotazioni() {
  const list = useSyncExternalStore(subscribeBookings, loadBookings, () => EMPTY);
  const n = splitBookings(list).upcoming.length;
  return (
    <Link href="/prenotazioni" data-testid="profilo-prenotazioni" className={TILE_CLASS}>
      <TileBody
        icon={<CalendarCheck size={18} strokeWidth={1.75} />}
        label="Prenotazioni"
        count={n > 0 ? n : undefined}
        sub={<span data-testid="profilo-prenotazioni-conteggio">{n === 0 ? "Nessuna" : `${n} in arrivo`}</span>}
      />
    </Link>
  );
}
