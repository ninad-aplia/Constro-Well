"use client";
// Header cart button — port of buildgrid-shop.html's `.hbtn.cartb` (line 173):
// icon + live count + "Cart" label, right end of the storefront header.
// Server-rendered once count is 0 until the client cart hydrates, then the
// badge tracks cart mutations.
import Link from "next/link";
import { useCart } from "@/components/cart";

export default function CartBadge() {
  const { count } = useCart();
  return (
    <Link
      href="/cart"
      aria-label={`Cart, ${count} item${count === 1 ? "" : "s"}`}
      className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 hover:bg-white/10"
    >
      <span className="relative">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M2 4h3l2.4 12.2a1.5 1.5 0 0 0 1.5 1.3h7.9a1.5 1.5 0 0 0 1.5-1.2L20.6 8H6" />
          <circle cx="10" cy="21" r="1.4" />
          <circle cx="17.5" cy="21" r="1.4" />
        </svg>
        <span className="absolute bottom-1 left-1/2 min-w-4 -translate-x-1/2 rounded bg-white/15 px-0.5 text-center text-[10px] font-bold leading-4">
          {count}
        </span>
      </span>
      <b className="hidden text-sm font-semibold sm:inline">Cart</b>
    </Link>
  );
}
