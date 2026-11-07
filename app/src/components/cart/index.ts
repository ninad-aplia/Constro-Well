"use client";
// Public client entry for cart-facing UI (provider + badge). Keeps imports in
// pages/layouts short: `import { CartProvider, useCart } from "@/components/cart"`.
export { default as CartProvider } from "./CartProvider";
export { default as CartBadge } from "./CartBadge";
export { useCart } from "./CartProvider";
