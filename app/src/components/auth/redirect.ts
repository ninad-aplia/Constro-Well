export type UserRole = "customer" | "seller" | "driver" | "admin";

/** Landing route after sign-in. Sellers always go to the Seller Portal. */
export function homeForRole(role: UserRole): string {
  switch (role) {
    case "seller":
      return "/seller";
    case "driver":
      return "/delivery";
    case "admin":
      return "/";
    default:
      return "/";
  }
}

/** Only same-site relative destinations are accepted. */
export function safeNext(next: string | null | undefined): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return null;
  return next;
}
