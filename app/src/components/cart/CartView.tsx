"use client";
// Cart — same prototype layout, now backed by the persistent PostgreSQL cart.
// Items are grouped by seller; all prices, delivery fees, coupon discounts and
// tax come from the server. Guest localStorage carts are preserved and can be
// merged after sign-in; `cw-cart` is no longer the source of truth.
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Stepper from "@/components/ui/Stepper";
import CartThumb from "./CartThumb";
import { useRemoteCart } from "./RemoteCartProvider";
import { useSession } from "@/components/auth/SessionProvider";
import { ApiClientError } from "@/lib/api/client";
import { fetchProductOffers } from "@/lib/api/catalogApi";
import { readCart, writeCart } from "@/lib/cart/store";
import { inr } from "@/lib/shop/format";
import { FREE_DELIVERY_AT } from "@/lib/shop/pricing";
import type { CartItemDto } from "@/lib/api/cartDto";

function messageOf(error: unknown): string {
  return error instanceof ApiClientError ? error.message : "Could not update the cart. Try again.";
}

export default function CartView() {
  const cart = useRemoteCart();
  const session = useSession();
  const router = useRouter();
  const [couponInput, setCouponInput] = useState("");
  const [couponMsg, setCouponMsg] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [guestEntries, setGuestEntries] = useState<{ id: number; s: number; q: number; saved: boolean }[]>([]);
  const [mergeMsg, setMergeMsg] = useState("");
  const [mergeBusy, setMergeBusy] = useState(false);

  useEffect(() => {
    if (session.status === "guest") {
      router.replace("/login?next=/cart");
    }
  }, [session.status, router]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setGuestEntries(readCart().filter((entry) => !entry.saved));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [session.status, session.user?.id]);

  const run = async (key: string, action: () => Promise<void>) => {
    setBusy(key);
    setActionError("");
    try {
      await action();
    } catch (error) {
      setActionError(messageOf(error));
    } finally {
      setBusy(null);
    }
  };

  const mergeGuestCart = async () => {
    setMergeBusy(true);
    setMergeMsg("");
    const remaining: typeof guestEntries = [];
    let merged = 0;
    for (const entry of guestEntries) {
      if (entry.s !== 0) {
        remaining.push(entry);
        continue;
      }
      try {
        const { offers } = await fetchProductOffers(String(entry.id));
        const offer = offers.find(
          (candidate) => entry.q >= candidate.minOrderQty && entry.q <= candidate.stock,
        );
        if (!offer) {
          remaining.push(entry);
          continue;
        }
        await cart.add(offer.id, entry.q);
        merged += 1;
      } catch {
        remaining.push(entry);
      }
    }
    writeCart(remaining);
    setGuestEntries(remaining);
    setMergeBusy(false);
    setMergeMsg(
      merged
        ? `Merged ${merged} item${merged === 1 ? "" : "s"}${remaining.length ? `; ${remaining.length} could not be mapped and remain saved in this browser.` : "."}`
        : "No guest items could be mapped to current seller offers. They remain saved in this browser.",
    );
  };

  if (session.status === "loading" || cart.status === "loading") {
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

  if (session.status === "guest") {
    return (
      <div className="mx-auto max-w-[1600px] px-4 py-6">
        <section className="rounded-xl border border-line bg-panel p-8 text-center">
          <h1 className="font-display text-2xl font-bold">Sign in to view your cart</h1>
          <p className="mt-1 text-muted">Your cart is saved to your account across devices and restarts.</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2.5">
            <Link href="/login?next=/cart" className="inline-flex min-h-10 items-center rounded-full bg-hi px-4 font-semibold text-hiink hover:bg-hi2">
              Sign in
            </Link>
            <Link href="/register?next=/cart" className="inline-flex min-h-10 items-center rounded-full border border-line px-4 font-semibold hover:bg-tint">
              Create account
            </Link>
          </div>
        </section>
      </div>
    );
  }

  if (session.user?.role !== "customer") {
    return (
      <div className="mx-auto max-w-[1600px] px-4 py-6">
        <section className="rounded-xl border border-line bg-panel p-8 text-center">
          <h1 className="font-display text-2xl font-bold">Customer account required</h1>
          <p className="mt-1 text-muted">The cart is only available to customer accounts.</p>
        </section>
      </div>
    );
  }

  if (cart.status === "error") {
    return (
      <div className="mx-auto max-w-[1600px] px-4 py-6">
        <section className="rounded-xl border border-line bg-panel p-4 text-center">
          <h1 className="font-display text-xl font-bold">Your cart couldn’t load</h1>
          <p className="mt-1 text-muted">{cart.error}</p>
          <Button className="mt-4" onClick={() => void cart.refresh().catch(() => {})}>
            Try again
          </Button>
        </section>
      </div>
    );
  }

  const data = cart.cart;
  if (!data || (data.items.length === 0 && data.savedItems.length === 0)) {
    return (
      <div className="mx-auto max-w-[1600px] px-4 py-6">
        <GuestMerge
          entries={guestEntries}
          busy={mergeBusy}
          message={mergeMsg}
          onMerge={() => void mergeGuestCart()}
          onKeep={() => setGuestEntries([])}
        />
        <section className="rounded-xl border border-line bg-panel p-4 text-center">
          <svg className="mx-auto my-4 text-muted" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M2 4h3l2.4 12.2a1.5 1.5 0 0 0 1.5 1.3h7.9a1.5 1.5 0 0 0 1.5-1.2L20.6 8H6" />
            <circle cx="10" cy="21" r="1.4" />
            <circle cx="17.5" cy="21" r="1.4" />
          </svg>
          <h1 className="font-display text-2xl font-bold">Your cart is empty</h1>
          <p className="mt-1 text-muted">Add cement, steel, tiles and more, then come back here.</p>
          <Link href="/" className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-full bg-hi px-4 font-semibold text-hiink hover:bg-hi2">
            Continue shopping
          </Link>
        </section>
      </div>
    );
  }

  const t = data.totals;
  const left = Math.max(0, FREE_DELIVERY_AT - Number(t.subtotal));

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-4">
      <GuestMerge
        entries={guestEntries}
        busy={mergeBusy}
        message={mergeMsg}
        onMerge={() => void mergeGuestCart()}
        onKeep={() => setGuestEntries([])}
      />
      {actionError && (
        <p role="alert" className="mb-3 rounded-xl border border-bad bg-panel px-3 py-2 text-[13px] font-medium text-bad">
          {actionError}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_350px]">
        <section className="grid gap-4">
          {data.groups.map((group) => (
            <div key={group.sellerId} className="rounded-xl border border-line bg-panel p-4">
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2 border-b border-line pb-2">
                <div>
                  <h2 className="font-display text-lg font-bold">Sold by {group.sellerName}</h2>
                  <p className="text-[13px] text-muted">
                    {group.sellerCity} · Delivery {Number(group.deliveryFee) ? inr(Number(group.deliveryFee)) : "FREE"}
                    {" · "}Free above {inr(Number(group.freeAbove))}
                  </p>
                </div>
                <span className="text-[13px] text-muted">Seller subtotal <b className="text-ink">{inr(Number(group.subtotal))}</b></span>
              </div>

              {group.items.map((item) => (
                <CartLine key={item.id} item={item} busy={busy} run={run} />
              ))}
            </div>
          ))}

          <div className="text-right text-[15px]">
            Subtotal ({t.itemCount} item{t.itemCount === 1 ? "" : "s"}): <b>{inr(Number(t.subtotal))}</b>
          </div>

          {data.savedItems.length > 0 && (
            <section className="rounded-xl border border-line bg-panel p-4">
              <h2 className="mb-2 font-display text-xl font-bold">Saved for later ({data.savedItems.length})</h2>
              {data.savedItems.map((item) => (
                <div key={item.id} className="flex items-center gap-3 border-b border-line py-2.5 last:border-0">
                  <CartThumb hue={item.hue} art={item.art} label={item.name} href={`/product/${item.productCode}`} />
                  <div className="min-w-0">
                    <Link href={`/product/${item.productCode}`} className="font-semibold hover:underline">
                      {item.name}
                    </Link>
                    <p className="text-[13px] text-muted">Sold by {item.sellerName}</p>
                    <div className="mt-1 flex gap-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busy === item.id}
                        onClick={() => void run(item.id, () => cart.setSaved(item.id, false))}
                      >
                        Move to cart
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busy === item.id}
                        onClick={() => void run(item.id, () => cart.remove(item.id))}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                  <b className="ms-auto">{inr(Number(item.unitPrice))}</b>
                </div>
              ))}
            </section>
          )}
        </section>

        <aside className="h-fit rounded-xl border border-line bg-panel p-4">
          <div className="rounded-lg bg-tint p-3">
            <div aria-hidden="true" className="mb-2 h-2 overflow-hidden rounded-full bg-line">
              <i className="block h-full rounded-full bg-hi transition-[width]" style={{ width: `${Math.min(100, (Number(t.subtotal) / FREE_DELIVERY_AT) * 100)}%` }} />
            </div>
            <p className="text-[13px]" aria-live="polite">
              {left ? (
                <>Add <b>{inr(left)}</b> more for <b>FREE delivery</b> (per seller thresholds apply)</>
              ) : (
                <>Delivery is calculated per seller above their free threshold.</>
              )}
            </p>
          </div>

          <div className="mt-3 grid gap-1 text-[14px]">
            <div className="flex justify-between"><span>Items</span><b>{inr(Number(t.subtotal))}</b></div>
            {Number(t.discount) > 0 && (
              <div className="flex justify-between text-ok"><span>Coupon {t.couponCode}</span><b>-{inr(Number(t.discount))}</b></div>
            )}
            <div className="flex justify-between"><span>Delivery</span><b>{Number(t.deliveryFee) ? inr(Number(t.deliveryFee)) : "FREE"}</b></div>
            <div className="flex justify-between border-t border-line pt-1.5"><span className="font-bold">Order total</span><b>{inr(Number(t.total))}</b></div>
            <p className="text-xs text-muted">Includes GST of {inr(Number(t.taxAmount))}</p>
          </div>

          <form
            className="mt-3 flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void (async () => {
                const outcome = await cart.applyCoupon(couponInput.trim());
                setCouponMsg(outcome.msg);
              })();
            }}
          >
            <label className="sr-only" htmlFor="cpIn">Coupon code</label>
            <input
              id="cpIn"
              className="h-10 min-w-0 flex-1 rounded-lg border border-line bg-panel px-3 text-[15px]"
              placeholder="Coupon code (try BUILD10)"
              value={couponInput}
              onChange={(event) => setCouponInput(event.target.value)}
              autoComplete="off"
            />
            <Button variant="line" type="submit">Apply</Button>
          </form>
          {(data.coupon || couponMsg || data.couponMessage) && (
            <div className={`mt-2 flex items-center justify-between gap-2 text-[13px] ${data.coupon ? "text-ok" : "text-bad"}`} role="status">
              <span>{data.coupon ? `${data.coupon.code} applied` : couponMsg ?? data.couponMessage}</span>
              {data.coupon && (
                <Button variant="ghost" size="sm" onClick={() => { void cart.clearCoupon(); setCouponMsg(null); }}>
                  Remove
                </Button>
              )}
            </div>
          )}

          <Button
            variant="yellow"
            wide
            disabled
            title="Checkout is the next task; this cart is already server-priced."
            className="mt-4"
          >
            Proceed to Buy
          </Button>
          <p className="mt-2 text-center text-xs text-muted">
            Checkout is not connected yet. Prices, delivery and coupon values above are server-calculated.
          </p>
        </aside>
      </div>
    </div>
  );
}

function CartLine({
  item,
  busy,
  run,
}: {
  item: CartItemDto;
  busy: string | null;
  run: (key: string, action: () => Promise<void>) => Promise<void>;
}) {
  const cart = useRemoteCart();
  return (
    <div className="flex gap-3 border-b border-line py-3 last:border-0">
      <CartThumb hue={item.hue} art={item.art} label={item.name} href={`/product/${item.productCode}`} />
      <div className="min-w-0 flex-1">
        <Link href={`/product/${item.productCode}`} className="font-semibold text-ink hover:underline">
          {item.name}
        </Link>
        {!item.available ? (
          <p className="text-[13px] font-semibold text-bad">{item.issue ?? "Unavailable"} — remove it or save it for later</p>
        ) : (
          <p className={`text-[13px] ${item.stock <= 15 ? "text-bad" : "text-ok"}`}>
            {item.stock <= 15 ? `Only ${item.stock} left` : "In stock"}
          </p>
        )}
        <p className="text-[13px] text-muted">
          Sold by {item.sellerName} · Min order {item.minOrderQty} · Delivery in {item.leadTimeDays} day{item.leadTimeDays === 1 ? "" : "s"}
        </p>
        {item.bulk && <p className="text-[13px] font-semibold text-ok">Bulk price applied</p>}
        <div className="mt-1.5 flex flex-wrap items-center gap-3">
          {item.available && (
            <Stepper
              value={item.qty}
              min={item.minOrderQty}
              max={item.stock}
              label={`Quantity of ${item.name}`}
              onChange={(qty) => void run(item.id, () => cart.setQty(item.id, qty))}
            />
          )}
          <Button variant="ghost" size="sm" disabled={busy === item.id} onClick={() => void run(item.id, () => cart.remove(item.id))}>
            Delete
          </Button>
          {item.available && (
            <Button variant="ghost" size="sm" disabled={busy === item.id} onClick={() => void run(item.id, () => cart.setSaved(item.id, true))}>
              Save for later
            </Button>
          )}
        </div>
      </div>
      <div className="text-right">
        {item.available ? (
          <>
            <b>{inr(Number(item.lineTotal))}</b>
            <br />
            <small className="text-muted">{inr(Number(item.unitPrice))} each</small>
          </>
        ) : (
          <b className="text-muted">—</b>
        )}
      </div>
    </div>
  );
}

function GuestMerge({
  entries,
  busy,
  message,
  onMerge,
  onKeep,
}: {
  entries: { id: number; s: number; q: number; saved: boolean }[];
  busy: boolean;
  message: string;
  onMerge: () => void;
  onKeep: () => void;
}) {
  if (entries.length === 0) return null;
  return (
    <div role="status" className="mb-3 rounded-xl border border-warn/45 bg-warn/10 p-3 text-[13px]">
      <p>
        You have a guest cart saved in this browser ({entries.length} item{entries.length === 1 ? "" : "s"}).
        It is still preserved; merge eligible items into your account cart?
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button size="sm" variant="line" disabled={busy} onClick={onMerge}>
          {busy ? "Merging…" : "Merge guest cart"}
        </Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={onKeep}>
          Keep for later
        </Button>
      </div>
      {message && <p className="mt-2 text-muted">{message}</p>}
    </div>
  );
}
