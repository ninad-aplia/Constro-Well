"use client";
// Cart — port of buildgrid-shop.html's `VIEWS_cart`/`citem`/`emptyCart`
// (lines 507-521): line rows with qty stepper / delete / save for later, the
// free-delivery meter, coupon engine wired to the APPROVED coupon rules
// (shop/pricing.ts), saved-for-later section, order summary and the
// "Pairs well with your cart" recommendation row. Data comes from useCart()
// (browser-preview state, D14) — nothing here is a live transaction.
import { useState } from "react";
import Link from "next/link";
import Button from "@/components/ui/Button";
import ProductRow from "@/components/home/ProductRow";
import Stepper from "@/components/ui/Stepper";
import CartThumb from "./CartThumb";
import { useCart } from "./CartProvider";
import { inr } from "@/lib/shop/format";
import { FREE_DELIVERY_AT } from "@/lib/shop/pricing";

export default function CartView() {
  const cart = useCart();
  // Lazy initializer instead of an effect that mirrors `cart.coupon` into
  // local state on every render where it's set — same "derive from the
  // current value instead of syncing via effect" fix already used on
  // Stepper/ProductForm in this project, and required here for
  // react-hooks/set-state-in-effect.
  const [couponInput, setCouponInput] = useState(() => cart.coupon ?? "");
  const [couponMsg, setCouponMsg] = useState<string | null>(null);

  if (cart.status === "loading") {
    return (
      <div className="mx-auto max-w-[1600px] px-4 py-6">
        <section className="rounded-xl border border-line bg-panel p-4">
          <div className="mx-auto my-10 h-6 w-56 animate-pulse rounded bg-tint" />
          <div className="mx-auto my-4 h-4 w-72 animate-pulse rounded bg-tint" />
          <div className="mx-auto mt-8 h-10 w-40 animate-pulse rounded-full bg-tint" />
          <p className="sr-only">Loading your cart…</p>
        </section>
      </div>
    );
  }
  if (cart.status === "error") {
    return (
      <div className="mx-auto max-w-[1600px] px-4 py-6">
        <section className="rounded-xl border border-line bg-panel p-4 text-center">
          <h1 className="font-display text-xl font-bold">Your cart couldn’t load</h1>
          <p className="mt-1 text-muted">Check the page again in a moment.</p>
          <Button className="mt-4" onClick={cart.revalidate}>
            Try again
          </Button>
        </section>
      </div>
    );
  }

  // Prototype `emptyCart()`: full-empty state covers "no items at all".
  if (cart.lines.length === 0 && cart.savedLines.length === 0) {
    return (
      <div className="mx-auto max-w-[1600px] px-4 py-6">
        <CartNotice />
        <section className="rounded-xl border border-line bg-panel p-4 text-center">
          <svg className="mx-auto my-4 text-muted" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M2 4h3l2.4 12.2a1.5 1.5 0 0 0 1.5 1.3h7.9a1.5 1.5 0 0 0 1.5-1.2L20.6 8H6" />
            <circle cx="10" cy="21" r="1.4" />
            <circle cx="17.5" cy="21" r="1.4" />
          </svg>
          <h1 className="font-display text-2xl font-bold">Your cart is empty</h1>
          <p className="mt-1 text-muted">Add cement, steel, tiles and more, then come back here to check out.</p>
          <Link href="/" className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-full bg-hi px-4 font-semibold text-hiink hover:bg-hi2">
            Continue shopping
          </Link>
        </section>
      </div>
    );
  }

  const t = cart.totals;
  const left = Math.max(0, FREE_DELIVERY_AT - t.sub);

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-4">
      <CartNotice />
      {/* prototype `.cartgrid` collapses to stacked cards on narrow screens */}
      <div className="grid gap-4 lg:grid-cols-[1fr_350px]">
        <section className="rounded-xl border border-line bg-panel p-4">
          <div className="mb-2 flex items-end justify-between gap-4">
            <h1 className="font-display text-xl font-bold">Shopping cart</h1>
            <span className="text-[13px] text-muted">Price</span>
          </div>

          {cart.lines.length === 0 && (
            <p className="py-3 text-muted">All items are saved for later.</p>
          )}

          {cart.lines.map((l) => (
            <div key={l.key} className="flex gap-3 border-b border-line py-3 last:border-0">
              <CartThumb hue={l.hue} art={l.art} label={l.name} href={`/product/${l.id}`} />
              <div className="min-w-0 flex-1">
                <Link href={`/product/${l.id}`} className="font-semibold text-ink hover:underline">
                  {l.name}
                </Link>
                {l.outOfStock ? (
                  <p className="text-[13px] font-semibold text-bad">Out of stock — remove it to check out</p>
                ) : l.q < l.requestedQty ? (
                  <p className="text-[13px] font-semibold text-bad">
                    Only {l.p.stock} left — reduced from {l.requestedQty}
                  </p>
                ) : (
                  <p className={`text-[13px] ${l.p.stock <= 15 ? "text-bad" : "text-ok"}`}>
                    {l.p.stock <= 15 ? `Only ${l.p.stock} left` : "In stock"}
                  </p>
                )}
                <p className="text-[13px] text-muted">
                  Sold by {l.offer.name} · Delivery in {l.offer.days} day{l.offer.days === 1 ? "" : "s"}
                </p>
                {l.bulk && (
                  <p className="text-[13px] font-semibold text-ok">Bulk price applied</p>
                )}
                <div className="mt-1.5 flex flex-wrap items-center gap-3">
                  {!l.outOfStock && (
                    <Stepper
                      value={l.q}
                      min={1}
                      max={l.p.stock}
                      label={`Quantity of ${l.name}`}
                      onChange={(q) => cart.setQty(l.key, q, l.p.stock)}
                    />
                  )}
                  <Button variant="ghost" size="sm" onClick={() => cart.remove(l.key)}>
                    Delete
                  </Button>
                  {!l.outOfStock && (
                    <Button variant="ghost" size="sm" onClick={() => cart.saveForLater(l.key)}>
                      Save for later
                    </Button>
                  )}
                </div>
              </div>
              <div className="text-right">
                {l.outOfStock ? (
                  <b className="text-muted">—</b>
                ) : (
                  <>
                    <b>{inr(l.total)}</b>
                    <br />
                    <small className="text-muted">{inr(l.u)} each</small>
                  </>
                )}
              </div>
            </div>
          ))}

          <div className="mt-3 text-right text-[15px]">
            Subtotal ({t.items} item{t.items === 1 ? "" : "s"}): <b>{inr(t.sub)}</b>
          </div>
        </section>

        {/* prototype `.csum` — summary + free-delivery meter + coupon */}
        <aside className="h-fit rounded-xl border border-line bg-panel p-4">
          <div className="rounded-lg bg-tint p-3">
            <div aria-hidden="true" className="mb-2 h-2 overflow-hidden rounded-full bg-line">
              <i className="block h-full rounded-full bg-hi transition-[width]" style={{ width: `${Math.min(100, (t.sub / FREE_DELIVERY_AT) * 100)}%` }} />
            </div>
            <p className="text-[13px]" aria-live="polite">
              {left ? (
                <>
                  Add <b>{inr(left)}</b> more for <b>FREE delivery</b>
                </>
              ) : (
                <>Your order qualifies for <b>FREE delivery</b></>
              )}
            </p>
          </div>
          <div className="mt-3 grid gap-1 text-[14px]">
            <div className="flex justify-between">
              <span>Items</span>
              <b>{inr(t.sub)}</b>
            </div>
            {t.disc > 0 && (
              <div className="flex justify-between text-ok">
                <span>Coupon {t.code}</span>
                <b>-{inr(t.disc)}</b>
              </div>
            )}
            <div className="flex justify-between">
              <span>Delivery</span>
              <b>{t.ship ? inr(t.ship) : "FREE"}</b>
            </div>
            <div className="flex justify-between border-t border-line pt-1.5">
              <span className="font-bold">Order total</span>
              <b>{inr(t.total)}</b>
            </div>
            <p className="text-xs text-muted">Includes GST of {inr(t.gst)}</p>
          </div>

          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const outcome = cart.applyCoupon(couponInput.trim());
              setCouponMsg(outcome.msg);
            }}
          >
            <label className="sr-only" htmlFor="cpIn">
              Coupon code
            </label>
            <input
              id="cpIn"
              className="h-10 min-w-0 flex-1 rounded-lg border border-line bg-panel px-3 text-[15px]"
              placeholder="Coupon code (try BUILD10)"
              value={couponInput}
              onChange={(e) => setCouponInput(e.target.value)}
              autoComplete="off"
            />
            <Button variant="line" type="submit">
              Apply
            </Button>
          </form>
          {(cart.coupon || couponMsg) && (
            <div className={`mt-2 flex items-center justify-between gap-2 text-[13px] ${cart.coupon ? "text-ok" : "text-bad"}`} role="status">
              <span>{cart.coupon ? t.msg || `${cart.coupon} applied` : couponMsg}</span>
              {cart.coupon && (
                <Button variant="ghost" size="sm" onClick={() => { cart.clearCoupon(); setCouponMsg(null); }}>
                  Remove
                </Button>
              )}
            </div>
          )}

          <Link
            href="/checkout"
            aria-disabled={cart.lines.length === 0}
            className={`mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-hi px-4 py-2.5 font-semibold text-hiink hover:bg-hi2 ${
              cart.lines.length === 0 ? "pointer-events-none opacity-50" : ""
            }`}
          >
            Proceed to Buy
          </Link>
          <p className="mt-2 text-center text-xs text-muted">
            Preview cart — items stay in this browser; checkout is not a live transaction yet.
          </p>
        </aside>
      </div>

      {cart.savedLines.length > 0 && (
        <section className="mt-4 rounded-xl border border-line bg-panel p-4">
          <h2 className="mb-2 font-display text-xl font-bold">Saved for later ({cart.savedLines.length})</h2>
          {cart.savedLines.map((l) => (
            <div key={l.key} className="flex items-center gap-3 border-b border-line py-2.5 last:border-0">
              <CartThumb hue={l.hue} art={l.art} label={l.name} href={`/product/${l.id}`} />
              <div className="min-w-0">
                <Link href={`/product/${l.id}`} className="font-semibold hover:underline">
                  {l.name}
                </Link>
                <div className="mt-1 flex gap-3">
                  <Button variant="ghost" size="sm" onClick={() => cart.moveToCart(l.key)}>
                    Move to cart
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => cart.remove(l.key)}>
                    Delete
                  </Button>
                </div>
              </div>
              <b className="ms-auto">{inr(l.u)}</b>
            </div>
          ))}
        </section>
      )}

      {cart.pairs.length > 0 && <div className="mt-4"><ProductRow title="Pairs well with your cart" items={cart.pairs} /></div>}
    </div>
  );
}

/** Dismissible banner for the "an item was removed because it no longer exists" reconciliation case (CartProvider's `refresh`). Separate component so it can call `useCart()` itself without extra prop drilling. */
function CartNotice() {
  const cart = useCart();
  if (!cart.notice) return null;
  return (
    <div
      role="status"
      className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-warn/45 bg-warn/10 p-3 text-[13px]"
    >
      <span>{cart.notice}</span>
      <Button variant="ghost" size="sm" onClick={cart.dismissNotice}>
        Dismiss
      </Button>
    </div>
  );
}
