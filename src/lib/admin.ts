// Chi vede le pagine riservate (/admin/numeri): solo Lorenzo, con i suoi due indirizzi.
// Per tutti gli altri quelle pagine non esistono (404), così non si sa nemmeno che ci sono.
export const ADMIN_EMAILS = ["founder.mapetite@gmail.com", "massimettilorenzo@gmail.com"] as const;

export function isAdminEmail(email: string | null | undefined): boolean {
  return !!email && (ADMIN_EMAILS as readonly string[]).includes(email.trim().toLowerCase());
}
