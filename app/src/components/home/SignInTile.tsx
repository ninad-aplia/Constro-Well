// Session-aware sign-in home tile - port of buildgrid-shop.html's `.tile.signin`.
// Guest state keeps the original sign-in/create-account links; signed-in users
// see their account and role-specific portal link. No credentials are stored
// in the browser — the HTTP-only session cookie is the only session state.
"use client";

import Link from "next/link";
import Card from "@/components/ui/Card";
import { useSession } from "@/components/auth/SessionProvider";
import LogoutButton from "@/components/auth/LogoutButton";

const primary =
  "inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-full bg-hi px-[18px] font-semibold whitespace-nowrap text-hiink hover:bg-hi2";
const secondary =
  "inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-full border border-line bg-panel px-[18px] font-semibold whitespace-nowrap text-ink hover:bg-tint";

export default function SignInTile() {
  const { user, status } = useSession();

  if (status === "loading") {
    return (
      <Card className="flex flex-col gap-2.5 p-[18px]">
        <h2 className="font-display text-xl font-bold">Your account</h2>
        <p className="text-muted">Checking your session…</p>
      </Card>
    );
  }

  if (!user) {
    return (
      <Card className="flex flex-col gap-2.5 p-[18px]">
        <h2 className="font-display text-xl font-bold">Sign in for the best experience</h2>
        <p className="text-muted">Save your cart, track orders and check out faster.</p>
        <Link href="/login" className={primary}>
          Sign in securely
        </Link>
        <Link href="/register" className={secondary}>
          Create an account
        </Link>
      </Card>
    );
  }

  const portal =
    user.role === "seller"
      ? { href: "/seller", label: "Open Seller Hub" }
      : user.role === "driver"
        ? { href: "/delivery", label: "Open Delivery Portal" }
        : null;

  return (
    <Card className="flex flex-col gap-2.5 p-[18px]">
      <h2 className="font-display text-xl font-bold">Welcome back, {user.name.split(" ")[0]}</h2>
      <p className="text-muted">
        Signed in as {user.email}
        <span className="mt-0.5 block text-xs capitalize">{user.role} account</span>
      </p>
      {portal ? (
        <Link href={portal.href} className={primary}>
          {portal.label}
        </Link>
      ) : (
        <Link href="/orders" className={primary}>
          View your orders
        </Link>
      )}
      <Link href="/" className={secondary}>
        Continue shopping
      </Link>
      <LogoutButton className={`${secondary} disabled:opacity-60`} />
    </Card>
  );
}
