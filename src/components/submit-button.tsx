"use client";

import { useFormStatus } from "react-dom";
import type { ComponentPropsWithoutRef } from "react";

// Disabilita il bottone mentre la server action è in corso, per evitare
// che un doppio click invii due volte lo stesso form.
export default function SubmitButton({
  children,
  ...props
}: ComponentPropsWithoutRef<"button">) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" disabled={pending} {...props}>
      {pending ? "Attendere…" : children}
    </button>
  );
}
