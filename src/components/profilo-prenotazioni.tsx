"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { CalendarCheck } from "lucide-react";
import { loadBookings, splitBookings, subscribeBookings, type BookingRequest } from "@/lib/booking";

// Ingresso a "Le mie prenotazioni" dal profilo: il numero di quelle in arrivo (salvate nel telefono).
const EMPTY: BookingRequest[] = [];

export default function ProfiloPrenotazioni() {
  const list = useSyncExternalStore(subscribeBookings, loadBookings, () => EMPTY);
  const n = splitBookings(list).upcoming.length;
  return (
    <Link
      href="/prenotazioni"
      data-testid="profilo-prenotazioni"
      className="mb-4 flex min-h-16 items-center gap-3 rounded-card border border-border bg-white px-4 py-3 shadow-card active:scale-[0.99] transition-transform duration-150"
    >
      <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-light text-accent">
        <CalendarCheck size={20} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-display text-base font-semibold leading-tight text-text">Le mie prenotazioni</span>
        <span data-testid="profilo-prenotazioni-conteggio" className="mt-0.5 block text-sm text-text-muted">
          {n === 0 ? "Nessuna in arrivo" : `${n} in arrivo`}
        </span>
      </span>
      <span aria-hidden className="text-xl text-text-muted">→</span>
    </Link>
  );
}
