"use client";

import Link from "next/link";
import { useSession } from "./SessionProvider";
import LogoutButton from "./LogoutButton";

const linkClass =
  "rounded-lg px-2.5 py-1.5 text-sm font-semibold hover:bg-white/10 focus-visible:outline-3 focus-visible:outline-hi";

export default function SessionNav() {
  const { user, status } = useSession();

  if (status === "loading") {
    return <span className="animate-pulse rounded bg-white/10 px-3 py-1.5 text-sm text-[#C9D8EE]">Account</span>;
  }

  if (!user) {
    return (
      <div className="flex items-center gap-1">
        <Link href="/login" className={linkClass}>
          Sign in
        </Link>
        <Link href="/register" className="hidden rounded-lg bg-white/10 px-2.5 py-1.5 text-sm font-semibold hover:bg-white/20 sm:inline">
          Create account
        </Link>
      </div>
    );
  }

  const firstName = user.name.split(" ")[0] || user.name;
  const portal =
    user.role === "seller"
      ? { href: "/seller", label: "Seller Hub" }
      : user.role === "driver"
        ? { href: "/delivery", label: "Delivery" }
        : null;

  return (
    <div className="flex items-center gap-1">
      <span className="hidden text-sm font-semibold text-[#C9D8EE] md:inline" title={user.email}>
        Hi, {firstName}
      </span>
      {portal && (
        <Link href={portal.href} className={linkClass}>
          {portal.label}
        </Link>
      )}
      {user.role === "customer" && (
        <Link href="/orders" className={linkClass}>
          Orders
        </Link>
      )}
      <LogoutButton className={`${linkClass} disabled:opacity-60`} />
    </div>
  );
}
