"use client";
// Checkout — port of buildgrid-shop.html's `VIEWS_checkout` + `placeOrder`
// validators (lines 546-595), adapted to the approved Constro Well rules:
// authentication is Phase 3 (guest checkout preview today) and payment is
// COD-only per D3/D4 (prototype's UPI/card/net-banking UI stays hidden until
// an approved gateway exists — DECISIONS.md D3).
//
// `placeOrder` always results in a PREVIEW ORDER: saved through the
// lib/api/orders boundary (browser-only today, Stage-2 REST later), labelled
// "Preview order" on-screen, and not a payment or reservation (D14). The
// server-side order creation (stock decrement, price re-check, D3/D4 COD cap
// enforcement, per-seller shipment split) is TASK 5.2 and deliberately NOT
// simulated here.
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import CartThumb from "./CartThumb";
import { useCart } from "./CartProvider";
import { inr } from "@/lib/shop/format";
import { COD_CAP, validateAddress, validateCod, type FieldErrors } from "@/lib/shop/validate";
import type { Address, OrderItem, OrderPreview } from "@/lib/shop/types";
import { saveOrder, getOrders, makePreviewOrderId } from "@/lib/api/orders";
import { readAddresses, writeAddresses } from "@/lib/cart/store";

/** Isolates the impure `Date.now()` read to a plain module-level function (same reasoning as `makePreviewOrderId` in lib/api/orders.ts) so it's never treated as a render-time call (react-hooks/purity). */
function nowMs(): number {
  return Date.now();
}

/** Mount-time address selection, computed once via a lazy `useState` initializer instead of a post-mount effect (react-hooks/set-state-in-effect) — same "derive, don't sync" fix already used elsewhere in this project (Stepper, Seller's ProductForm). */
function initialAddressState(): { addresses: Address[]; addrSel: string; showNewForm: boolean } {
  const saved = readAddresses();
  if (!saved.length) return { addresses: saved, addrSel: "new", showNewForm: true };
  const defIdx = Math.max(0, saved.findIndex((a) => a.def));
  return { addresses: saved, addrSel: String(defIdx), showNewForm: false };
}

const STATES = [
  "Karnataka",
  "Maharashtra",
  "Delhi",
  "Telangana",
  "Tamil Nadu",
  "West Bengal",
  "Gujarat",
  "Rajasthan",
  "Kerala",
  "Uttar Pradesh",
]; // prototype state list (buildgrid-shop.html:536)

export default function CheckoutView() {
  const cart = useCart();
  const router = useRouter();
  const [initialAddr] = useState(initialAddressState);
  const [addresses, setAddresses] = useState<Address[]>(initialAddr.addresses);
  const [addrSel, setAddrSel] = useState<string>(initialAddr.addrSel);
  const [showNewForm, setShowNewForm] = useState(initialAddr.showNewForm);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [placing, setPlacing] = useState(false);
  const [draft, setDraft] = useState({
    name: "",
    phone: "",
    pin: "",
    city: "",
    line: "",
    state: STATES[0],
    def: true,
  });

  // Only purchasable lines (in stock) can ever reach an order — an
  // out-of-stock line is still shown in the cart, but never priced or
  // counted here (CartProvider already resolves it to q=0/total=0; this
  // filter additionally keeps it out of the order's item list entirely).
  const purchasableLines = cart.lines.filter((l) => !l.outOfStock);

  // Set the instant `place()` clears the cart, so it can't also be mistaken
  // for "arrived here with nothing to buy" by the guard effect below — without
  // this, `cart.remove()`-ing every line raced with `router.push("/thanks/…")`
  // and `router.replace("/cart")` would sometimes win, silently discarding the
  // navigation to the confirmation page even though the order itself saved
  // correctly (caught via browser testing during the repair pass).
  const orderJustPlaced = useRef(false);

  // Checkout with an empty (or entirely out-of-stock) cart sends the
  // shopper back to the cart (prototype `placeOrder` guard) — unless that
  // emptiness is the expected result of an order this component just placed.
  useEffect(() => {
    if (orderJustPlaced.current) return;
    if (cart.status === "ready" && purchasableLines.length === 0) router.replace("/cart");
  }, [cart.status, purchasableLines.length, router]);

  if (cart.status === "loading") {
    return (
      <div className="mx-auto max-w-[1200px] px-4 py-6">
        <p className="text-muted">Loading checkout…</p>
      </div>
    );
  }
  if (cart.status === "error") {
    return (
      <div className="mx-auto max-w-[1200px] px-4 py-6">
        <section className="rounded-xl border border-line bg-panel p-4 text-center">
          <h1 className="font-display text-xl font-bold">Checkout couldn’t load</h1>
          <Button className="mt-3" onClick={cart.revalidate}>
            Try again
          </Button>
        </section>
      </div>
    );
  }

  const t = cart.totals;
  const payError = validateCod(t.total);

  const place = async () => {
    setErrors({});
    const e: FieldErrors = {};
    // `addr` is built/looked-up as `Address | null` (never `| undefined`) so
    // every path below is explicit: a new address only becomes a candidate
    // once it passes validation; an existing selection only resolves when
    // the index is genuinely in range (covers a deleted/unavailable
    // selection, not just a negative one as before).
    let addr: Address | null = null;
    if (addrSel === "new" || showNewForm) {
      for (const [k, m] of Object.entries(validateAddress(draft))) e[k] = m;
      if (Object.keys(e).length === 0) addr = { ...draft };
    } else {
      const idx = Number(addrSel);
      const inRange = Number.isInteger(idx) && idx >= 0 && idx < addresses.length;
      addr = inRange ? addresses[idx] : null;
    }
    if (!addr) e.addr = "Choose or add a delivery address";
    const codBlock = validateCod(t.total);
    if (codBlock) e.pay = codBlock;
    if (Object.keys(e).length) {
      setErrors(e);
      document.querySelector<HTMLElement>("[data-err='true']")?.scrollIntoView({ block: "center", behavior: "smooth" });
      return;
    }
    // Unreachable in practice (already guarded above) — gives TypeScript's
    // control-flow analysis an explicit narrowing point so `addr` is `Address`,
    // not `Address | null`, below. No cast, no `any`, no `!`.
    if (!addr) return;

    setPlacing(true);
    // Preview order id: random client-side "BG-" number (unique within the
    // browser store). Real server-generated ids land with TASK 5.2.
    const id = makePreviewOrderId(new Set((await getOrders()).map((o) => o.id)));

    const now = nowMs();
    const maxDays = Math.max(...purchasableLines.map((l) => l.offer.days), 1);
    const order: OrderPreview = {
      id,
      created: now,
      items: purchasableLines.map((l): OrderItem => ({
        id: l.id,
        name: l.name,
        cat: l.cat,
        unit: l.p.unit,
        q: l.q,
        total: l.total,
        seller: l.offer.name,
        art: l.art,
        hue: l.hue,
      })),
      t: { sub: t.sub, ship: t.ship, disc: t.disc, total: t.total, gst: t.gst, code: t.code },
      addr,
      pay: "Cash on delivery",
      // ETA = longest offer lead time (prototype `etaDate(maxD)`), demo clock.
      eta: now + maxDays * 86_400_000,
      stage: 0,
      times: [now],
      cancelled: false,
    };
    if (addrSel === "new" || showNewForm) {
      const saved = writeAddressesSafe(order.addr);
      setAddresses(saved);
      setAddrSel(String(saved.length - 1));
      setShowNewForm(false);
    }
    // Keep save-for-later rows (prototype keeps saved rows after ordering).
    orderJustPlaced.current = true;
    await saveOrder(order);
    for (const l of purchasableLines) cart.remove(l.key);
    router.push(`/thanks/${order.id}`);
  };

  function writeAddressesSafe(addr: Address): Address[] {
    const next = addr.def
      ? [...addresses.map((a) => ({ ...a, def: false })), addr]
      : [...addresses, addr];
    writeAddresses(next);
    return next;
  }

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-4">
      <h1 className="mb-3 font-display text-2xl font-bold">
        Checkout <small className="text-base text-muted">({t.items} item{t.items === 1 ? "" : "s"})</small>
      </h1>
      <p className="mb-3 rounded-lg border border-line bg-tint px-3 py-2 text-[13px] text-muted">
        Preview checkout — no payment is processed and the order is stored only in this browser
        (real order finalisation lands with the Stage-2 API, TASK 5.2).
      </p>
      <div className="grid gap-4 lg:grid-cols-[1fr_350px]">
        <div className="grid gap-4">
          {/* 1 — Delivery address */}
          <section className="rounded-xl border border-line bg-panel p-4" data-err={errors.addr ? "true" : undefined}>
            <h2 className="mb-2 font-display text-lg font-bold">
              <span className="mr-2 inline-grid h-6 w-6 place-items-center rounded-full bg-nav text-sm text-white">1</span>
              Delivery address
            </h2>
            {addresses.map((a, i) => (
              <label key={`${a.name}-${i}`} className="mb-2 block cursor-pointer">
                <span className="flex items-start gap-2">
                  <input
                    type="radio"
                    name="addr"
                    value={String(i)}
                    checked={addrSel === String(i) && !showNewForm}
                    onChange={() => { setAddrSel(String(i)); setShowNewForm(false); }}
                    className="mt-1"
                  />
                  <span>
                    <b>{a.name}</b>, {a.line}, {a.city}, {a.state} {a.pin}
                    <br />
                    <small className="text-muted">
                      Phone: {a.phone}
                      {a.def ? " · Default" : ""}
                    </small>
                  </span>
                </span>
              </label>
            ))}
            <label className="mb-2 block cursor-pointer">
              <span className="flex items-start gap-2">
                <input
                  type="radio"
                  name="addr"
                  value="new"
                  checked={addrSel === "new" || showNewForm}
                  onChange={() => { setAddrSel("new"); setShowNewForm(true); }}
                  className="mt-1"
                />
                <span>
                  <b>Add a new delivery address</b>
                </span>
              </span>
            </label>

            <div id="naBox" hidden={!showNewForm} className="grid gap-2.5 border-l-2 border-line pl-3">
              <div className="grid gap-2.5 sm:grid-cols-2">
                <Field label="Full name" err={errors.name} value={draft.name} onChange={(v) => setDraft({ ...draft, name: v })} autoComplete="name" id="na_name" />
                <Field label="Mobile number" err={errors.phone} value={draft.phone} onChange={(v) => setDraft({ ...draft, phone: v.replace(/\D/g, "").slice(0, 10) })} inputMode="numeric" id="na_phone" maxLength={10} autoComplete="tel-national" />
              </div>
              <div className="grid gap-2.5 sm:grid-cols-2">
                <Field label="Pincode" err={errors.pin} value={draft.pin} onChange={(v) => setDraft({ ...draft, pin: v.replace(/\D/g, "").slice(0, 6) })} inputMode="numeric" id="na_pin" maxLength={6} autoComplete="postal-code" />
                <Field label="Town / City" err={errors.city} value={draft.city} onChange={(v) => setDraft({ ...draft, city: v })} id="na_city" autoComplete="address-level2" />
              </div>
              <Field label="Flat, house, building or site address" err={errors.line} value={draft.line} onChange={(v) => setDraft({ ...draft, line: v })} id="na_line" autoComplete="street-address" />
              <label className="grid gap-1 text-sm font-semibold">
                State
                <select
                  className="h-10 rounded-lg border border-line bg-panel px-2"
                  value={draft.state}
                  onChange={(e) => setDraft({ ...draft, state: e.target.value })}
                >
                  {STATES.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={draft.def} onChange={(e) => setDraft({ ...draft, def: e.target.checked })} />
                Make this my default address
              </label>
            </div>
            <FieldError msg={errors.addr} />
          </section>

          {/* 2 — Payment method (COD-only per D3/D4) */}
          <section className="rounded-xl border border-line bg-panel p-4" data-err={errors.pay ? "true" : undefined}>
            <h2 className="mb-2 font-display text-lg font-bold">
              <span className="mr-2 inline-grid h-6 w-6 place-items-center rounded-full bg-nav text-sm text-white">2</span>
              Payment method
            </h2>
            <label className="block cursor-pointer">
              <span className="flex flex-wrap items-baseline gap-2">
                <input type="radio" name="pay" value="cod" checked readOnly className="mt-1" />
                <b>Cash on delivery</b>
                <small className="text-muted">Available up to ₹{COD_CAP.toLocaleString("en-IN")}</small>
              </span>
            </label>
            <p className="mt-1 pl-6 text-[13px] text-muted">
              Pay in cash or UPI to the delivery partner when your order arrives. COD-only at launch
              (DECISIONS.md D3); online methods arrive when an approved gateway exists.
            </p>
            <FieldError msg={errors.pay} />
            {payError && !errors.pay && (
              <p className="mt-2 text-[13px] font-semibold text-bad" role="alert">
                {payError}
              </p>
            )}
          </section>

          {/* 3 — Review items */}
          <section className="rounded-xl border border-line bg-panel p-4">
            <h2 className="mb-2 font-display text-lg font-bold">
              <span className="mr-2 inline-grid h-6 w-6 place-items-center rounded-full bg-nav text-sm text-white">3</span>
              Review items and delivery
            </h2>
            {purchasableLines.map((l) => (
              <div key={l.key} className="flex items-center gap-3 border-b border-line py-2.5 last:border-0">
                <CartThumb hue={l.hue} art={l.art} label={l.name} />
                <div className="min-w-0">
                  <b className="line-clamp-2">{l.name}</b>
                  <p className="text-[13px] text-muted">
                    Qty {l.q} · {inr(l.u)} each
                  </p>
                </div>
                <b className="ms-auto">{inr(l.total)}</b>
              </div>
            ))}
          </section>
        </div>

        {/* Summary aside (prototype `.csum.sticky`) */}
        <aside className="h-fit rounded-xl border border-line bg-panel p-4 lg:sticky lg:top-[130px]">
          <Button variant="yellow" wide onClick={place} disabled={placing}>
            {placing ? "Placing preview order…" : "Place your order"}
          </Button>
          <p className="mt-1.5 text-center text-xs text-muted">
            By placing your order you agree to Constro Well’s conditions of use.
          </p>
          <h3 className="mt-3 font-display text-lg font-bold">Order summary</h3>
          <div className="mt-1.5 grid gap-1 text-[14px]">
            <div className="flex justify-between">
              <span>Items</span>
              <b>{inr(t.sub)}</b>
            </div>
            <div className="flex justify-between">
              <span>Delivery</span>
              <b>{t.ship ? inr(t.ship) : "FREE"}</b>
            </div>
            {t.disc > 0 && (
              <div className="flex justify-between text-ok">
                <span>Coupon {t.code}</span>
                <b>-{inr(t.disc)}</b>
              </div>
            )}
            <div className="flex justify-between border-t border-line pt-1.5">
              <span className="font-bold">Order total</span>
              <b>{inr(t.total)}</b>
            </div>
            <p className="text-xs text-muted">Includes GST of {inr(t.gst)}</p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Field({
  label,
  err,
  value,
  onChange,
  id,
  inputMode,
  maxLength,
  autoComplete,
}: {
  label: string;
  err?: string;
  value: string;
  onChange: (v: string) => void;
  id: string;
  inputMode?: "numeric";
  maxLength?: number;
  autoComplete?: string;
}) {
  return (
    <label className="grid gap-1 text-sm font-semibold">
      {label}
      <input
        id={id}
        className="h-10 rounded-lg border border-line bg-panel px-3 text-[15px] font-normal"
        value={value}
        inputMode={inputMode}
        maxLength={maxLength}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={err ? true : undefined}
        aria-describedby={err ? `${id}-err` : undefined}
      />
      <FieldError msg={err} id={`${id}-err`} />
    </label>
  );
}

function FieldError({ msg, id }: { msg?: string; id?: string }) {
  if (!msg) return null;
  return (
    <small id={id} className="font-semibold text-bad" role="alert">
      {msg}
    </small>
  );
}
