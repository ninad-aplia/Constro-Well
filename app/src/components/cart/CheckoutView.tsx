"use client";
// Checkout — same prototype layout, now backed by real addresses, server
// preview and transactional order placement. The browser sends only addressId
// and an idempotency key; all prices/totals come from the server.
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import CartThumb from "./CartThumb";
import { useRemoteCart } from "./RemoteCartProvider";
import { useSession } from "@/components/auth/SessionProvider";
import { ApiClientError } from "@/lib/api/client";
import { createAddress, fetchAddresses, type AddressInput } from "@/lib/api/addressApi";
import { placeOrder, previewCheckout } from "@/lib/api/orderApi";
import { inr } from "@/lib/shop/format";
import { COD_CAP } from "@/lib/shop/pricing";
import { validateAddress, type FieldErrors } from "@/lib/shop/validate";
import type { AddressDto, CheckoutPreviewDto } from "@/lib/api/orderDto";

const STATES = [
  "Karnataka", "Maharashtra", "Delhi", "Telangana", "Tamil Nadu",
  "West Bengal", "Gujarat", "Rajasthan", "Kerala", "Uttar Pradesh",
];

function messageOf(error: unknown): string {
  return error instanceof ApiClientError ? error.message : "Could not reach the checkout service.";
}

function checkoutKey(): string {
  const existing = sessionStorage.getItem("cw-checkout-key");
  if (existing) return existing;
  const key = crypto.randomUUID();
  sessionStorage.setItem("cw-checkout-key", key);
  return key;
}

export default function CheckoutView() {
  const cart = useRemoteCart();
  const session = useSession();
  const router = useRouter();
  const justPlaced = useRef(false);
  const [addresses, setAddresses] = useState<AddressDto[]>([]);
  const [addressStatus, setAddressStatus] = useState<"loading" | "ready" | "error">("loading");
  const [addressError, setAddressError] = useState("");
  const [selectedId, setSelectedId] = useState<string>("");
  const [showNew, setShowNew] = useState(false);
  const [draft, setDraft] = useState<AddressInput>({
    label: "Home", name: "", phone: "", line1: "", city: "", state: STATES[0], pin: "", isDefault: true,
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [preview, setPreview] = useState<CheckoutPreviewDto | null>(null);
  const [previewError, setPreviewError] = useState("");
  const [placing, setPlacing] = useState(false);
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    if (session.status === "guest") router.replace("/login?next=/checkout");
  }, [session.status, router]);

  useEffect(() => {
    if (session.status !== "authenticated" || session.user?.role !== "customer") return;
    let cancelled = false;
    fetchAddresses()
      .then((list) => {
        if (cancelled) return;
        setAddresses(list);
        setAddressStatus("ready");
        const preferred = list.find((address) => address.isDefault) ?? list[0];
        if (preferred) setSelectedId(preferred.id);
        else setShowNew(true);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setAddressError(messageOf(error));
        setAddressStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [session.status, session.user?.id, session.user?.role]);

  useEffect(() => {
    if (justPlaced.current || cart.status !== "ready" || !cart.cart?.items.length) return;
    if (!cart.cart.items.every((item) => item.available)) return;
  }, [cart.status, cart.cart]);

  useEffect(() => {
    if (justPlaced.current) return;
    if (cart.status === "ready" && (cart.cart?.items.length ?? 0) === 0) {
      router.replace("/cart");
    }
  }, [cart.status, cart.cart?.items.length, router]);

  useEffect(() => {
    if (!selectedId || showNew || cart.status !== "ready") return;
    let cancelled = false;
    previewCheckout(selectedId)
      .then((result) => {
        if (cancelled) return;
        setPreview(result);
        setPreviewError("");
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setPreviewError(messageOf(error));
        setPreview(null);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId, showNew, cart.status, cart.cart?.totals.subtotal]);

  const saveNewAddress = async () => {
    const clientErrors = validateAddress({
      name: draft.name,
      phone: draft.phone,
      pin: draft.pin,
      city: draft.city,
      line: draft.line1,
    });
    if (Object.keys(clientErrors).length) {
      setErrors(clientErrors);
      return;
    }
    setErrors({});
    setActionError("");
    try {
      const address = await createAddress(draft);
      setAddresses((current) => [address, ...current]);
      setSelectedId(address.id);
      setShowNew(false);
    } catch (error) {
      setActionError(messageOf(error));
    }
  };

  const place = async () => {
    if (!selectedId) {
      setActionError("Choose or add a delivery address");
      return;
    }
    if (preview && !preview.canPlaceOrder) {
      setActionError(preview.errors.join(" "));
      return;
    }
    setPlacing(true);
    setActionError("");
    justPlaced.current = true;
    try {
      const order = await placeOrder(selectedId, checkoutKey());
      sessionStorage.removeItem("cw-checkout-key");
      await cart.refresh().catch(() => {});
      router.push(`/thanks/${order.code}`);
    } catch (error) {
      justPlaced.current = false;
      setActionError(messageOf(error));
    } finally {
      setPlacing(false);
    }
  };

  if (session.status === "guest") {
    return <div className="mx-auto max-w-[1200px] px-4 py-6 text-muted">Redirecting to sign in…</div>;
  }
  if (session.status === "authenticated" && session.user?.role !== "customer") {
    return (
      <div className="mx-auto max-w-[1200px] px-4 py-6">
        <section className="rounded-xl border border-line bg-panel p-8 text-center">
          <h1 className="font-display text-2xl font-bold">Customer account required</h1>
          <p className="mt-1 text-muted">Checkout is only available to customer accounts.</p>
        </section>
      </div>
    );
  }
  if (session.status === "loading" || cart.status === "loading" || addressStatus === "loading") {
    return <div className="mx-auto max-w-[1200px] px-4 py-6 text-muted">Loading checkout…</div>;
  }
  if (cart.status === "error") {
    return (
      <div className="mx-auto max-w-[1200px] px-4 py-6">
        <section className="rounded-xl border border-line bg-panel p-4 text-center">
          <h1 className="font-display text-xl font-bold">Checkout couldn’t load</h1>
          <p className="mt-1 text-muted">{cart.error}</p>
          <Button className="mt-3" onClick={() => void cart.refresh().catch(() => {})}>Try again</Button>
        </section>
      </div>
    );
  }
  if (addressStatus === "error") {
    return (
      <div className="mx-auto max-w-[1200px] px-4 py-6">
        <section className="rounded-xl border border-line bg-panel p-4 text-center">
          <h1 className="font-display text-xl font-bold">Addresses couldn’t load</h1>
          <p className="mt-1 text-muted">{addressError}</p>
        </section>
      </div>
    );
  }
  if (!cart.cart || cart.cart.items.length === 0) return null;

  const t = preview?.totals ?? cart.cart.totals;
  const address = addresses.find((item) => item.id === selectedId) ?? null;

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-4">
      <h1 className="mb-3 font-display text-2xl font-bold">
        Checkout <small className="text-base text-muted">({t.itemCount} item{t.itemCount === 1 ? "" : "s"})</small>
      </h1>
      <p className="mb-3 rounded-lg border border-line bg-tint px-3 py-2 text-[13px] text-muted">
        COD-only checkout. The server revalidates stock, seller serviceability, coupon and totals before creating the order.
      </p>
      <div className="grid gap-4 lg:grid-cols-[1fr_350px]">
        <div className="grid gap-4">
          <section className={`rounded-xl border bg-panel p-4 ${!selectedId ? "border-bad" : "border-line"}`}>
            <h2 className="mb-2 font-display text-lg font-bold">
              <span className="mr-2 inline-grid h-6 w-6 place-items-center rounded-full bg-nav text-sm text-white">1</span>
              Delivery address
            </h2>
            {addresses.map((item) => (
              <label key={item.id} className="mb-2 block cursor-pointer">
                <span className="flex items-start gap-2">
                  <input type="radio" name="addr" checked={selectedId === item.id && !showNew} onChange={() => { setSelectedId(item.id); setShowNew(false); }} className="mt-1" />
                  <span>
                    <b>{item.name}</b>, {item.line1}, {item.city}, {item.state} {item.pin}
                    <br />
                    <small className="text-muted">Phone: {item.phone}{item.isDefault ? " · Default" : ""}</small>
                  </span>
                </span>
              </label>
            ))}
            <label className="mb-2 block cursor-pointer">
              <span className="flex items-start gap-2">
                <input type="radio" name="addr" checked={showNew} onChange={() => setShowNew(true)} className="mt-1" />
                <b>Add a new delivery address</b>
              </span>
            </label>

            {showNew && (
              <div className="grid gap-2.5 border-l-2 border-line pl-3">
                <div className="grid gap-2.5 sm:grid-cols-2">
                  <Field label="Full name" err={errors.name} value={draft.name} onChange={(v) => setDraft({ ...draft, name: v })} />
                  <Field label="Mobile number" err={errors.phone} value={draft.phone} onChange={(v) => setDraft({ ...draft, phone: v.replace(/\D/g, "").slice(0, 10) })} />
                </div>
                <div className="grid gap-2.5 sm:grid-cols-2">
                  <Field label="Pincode" err={errors.pin} value={draft.pin} onChange={(v) => setDraft({ ...draft, pin: v.replace(/\D/g, "").slice(0, 6) })} />
                  <Field label="Town / City" err={errors.city} value={draft.city} onChange={(v) => setDraft({ ...draft, city: v })} />
                </div>
                <Field label="Flat, house, building or site address" err={errors.line} value={draft.line1} onChange={(v) => setDraft({ ...draft, line1: v })} />
                <label className="grid gap-1 text-sm font-semibold">
                  State
                  <select className="h-10 rounded-lg border border-line bg-panel px-2" value={draft.state} onChange={(event) => setDraft({ ...draft, state: event.target.value })}>
                    {STATES.map((state) => <option key={state}>{state}</option>)}
                  </select>
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={draft.isDefault} onChange={(event) => setDraft({ ...draft, isDefault: event.target.checked })} />
                  Make this my default address
                </label>
                <div>
                  <Button variant="line" size="sm" onClick={() => void saveNewAddress()}>Save address</Button>
                </div>
              </div>
            )}
            {!selectedId && <p className="mt-2 text-[13px] font-semibold text-bad" role="alert">Choose or add a delivery address</p>}
            {address && <p className="mt-2 text-[13px] text-muted">Delivering to {address.city}, {address.state} {address.pin}</p>}
          </section>

          <section className="rounded-xl border border-line bg-panel p-4">
            <h2 className="mb-2 font-display text-lg font-bold">
              <span className="mr-2 inline-grid h-6 w-6 place-items-center rounded-full bg-nav text-sm text-white">2</span>
              Payment method
            </h2>
            <label className="block cursor-pointer">
              <span className="flex flex-wrap items-baseline gap-2">
                <input type="radio" name="pay" checked readOnly className="mt-1" />
                <b>Cash on delivery</b>
                <small className="text-muted">Available up to ₹{COD_CAP.toLocaleString("en-IN")}</small>
              </span>
            </label>
            <p className="mt-1 pl-6 text-[13px] text-muted">Pay in cash or UPI when the seller&apos;s delivery arrives.</p>
          </section>

          <section className="rounded-xl border border-line bg-panel p-4">
            <h2 className="mb-2 font-display text-lg font-bold">
              <span className="mr-2 inline-grid h-6 w-6 place-items-center rounded-full bg-nav text-sm text-white">3</span>
              Review items and delivery
            </h2>
            {cart.cart.groups.map((group) => (
              <div key={group.sellerId} className="mb-3">
                <p className="text-[13px] font-semibold text-muted">Sold by {group.sellerName} · {group.sellerCity}</p>
                {group.items.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 border-b border-line py-2.5 last:border-0">
                    <CartThumb hue={item.hue} art={item.art} label={item.name} />
                    <div className="min-w-0">
                      <b className="line-clamp-2">{item.name}</b>
                      <p className="text-[13px] text-muted">Qty {item.qty} · {inr(Number(item.unitPrice))} each · Min order {item.minOrderQty}</p>
                      {!item.available && <p className="text-[13px] font-semibold text-bad">{item.issue}</p>}
                    </div>
                    <b className="ms-auto">{inr(Number(item.lineTotal))}</b>
                  </div>
                ))}
              </div>
            ))}
          </section>

          {(previewError || (preview?.errors.length ?? 0) > 0) && (
            <section role="alert" className="rounded-xl border border-bad bg-panel p-4 text-[13px] text-bad">
              <b>Checkout cannot proceed:</b>
              <ul className="mt-1 list-disc pl-5">
                {previewError && <li>{previewError}</li>}
                {preview?.errors.map((error) => <li key={error}>{error}</li>)}
              </ul>
            </section>
          )}
          {actionError && <p role="alert" className="rounded-xl border border-bad bg-panel p-3 text-[13px] font-medium text-bad">{actionError}</p>}
        </div>

        <aside className="h-fit rounded-xl border border-line bg-panel p-4 lg:sticky lg:top-[130px]">
          <Button variant="yellow" wide onClick={() => void place()} disabled={placing || !!previewError || !preview || !preview.canPlaceOrder}>
            {placing ? "Placing order…" : "Place your order"}
          </Button>
          <p className="mt-1.5 text-center text-xs text-muted">By placing your order you agree to Constro Well’s conditions of use.</p>
          <h3 className="mt-3 font-display text-lg font-bold">Order summary</h3>
          <div className="mt-1.5 grid gap-1 text-[14px]">
            <div className="flex justify-between"><span>Items</span><b>{inr(Number(t.subtotal))}</b></div>
            <div className="flex justify-between"><span>Delivery</span><b>{Number(t.deliveryFee) ? inr(Number(t.deliveryFee)) : "FREE"}</b></div>
            {Number(t.discount) > 0 && <div className="flex justify-between text-ok"><span>Coupon {t.couponCode}</span><b>-{inr(Number(t.discount))}</b></div>}
            <div className="flex justify-between border-t border-line pt-1.5"><span className="font-bold">Order total</span><b>{inr(Number(t.total))}</b></div>
            <p className="text-xs text-muted">Includes GST of {inr(Number(t.taxAmount))}</p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Field({ label, err, value, onChange }: { label: string; err?: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-1 text-sm font-semibold">
      {label}
      <input className="h-10 rounded-lg border border-line bg-panel px-3 text-[15px] font-normal" value={value} onChange={(event) => onChange(event.target.value)} />
      {err && <span className="text-[13px] font-medium text-bad">{err}</span>}
    </label>
  );
}
