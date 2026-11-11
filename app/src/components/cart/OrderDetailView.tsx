"use client";
// Order detail + tracker — same prototype layout, now fetched from the
// authenticated order API. Shipment rows show each seller's fulfilment state.
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Dialog from "@/components/ui/Dialog";
import OrderCard from "./OrderCard";
import { toOrderPreview } from "./orderAdapters";
import { useSession } from "@/components/auth/SessionProvider";
import { cancelOrder, confirmShipmentDelivery, fetchOrder, reportShipmentIssue } from "@/lib/api/orderApi";
import { ApiClientError } from "@/lib/api/client";
import { inr } from "@/lib/shop/format";
import { ORDER_STAGES } from "@/lib/shop/types";
import type { OrderDto } from "@/lib/api/orderDto";

const dLong = (value: string | number): string =>
  new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
const dStamp = (value: string | number): string =>
  new Date(value).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

export default function OrderDetailView({ id }: { id: string }) {
  const session = useSession();
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "notfound">("loading");
  const [order, setOrder] = useState<OrderDto | null>(null);
  const [error, setError] = useState("");
  const [reloadToken, setReloadToken] = useState(0);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelError, setCancelError] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [reviewBusyId, setReviewBusyId] = useState<string | null>(null);
  const [reviewErrors, setReviewErrors] = useState<Record<string, string>>({});
  const [issueShipmentId, setIssueShipmentId] = useState<string | null>(null);
  const [issueNote, setIssueNote] = useState("");
  const [issueSubmitting, setIssueSubmitting] = useState(false);
  const [issueError, setIssueError] = useState("");

  useEffect(() => {
    if (session.status === "guest") router.replace(`/login?next=${encodeURIComponent(`/orders/${id}`)}`);
  }, [session.status, router, id]);

  useEffect(() => {
    if (session.status !== "authenticated" || session.user?.role !== "customer") return;
    let cancelled = false;
    fetchOrder(id)
      .then((result) => {
        if (cancelled) return;
        setOrder(result);
        setStatus("ready");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiClientError && err.status === 404) {
          setStatus("notfound");
          return;
        }
        setError(err instanceof ApiClientError ? err.message : "Could not load this order.");
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [session.status, session.user?.id, session.user?.role, id, reloadToken]);

  const retry = () => {
    setStatus("loading");
    setError("");
    setReloadToken((value) => value + 1);
  };

  if (session.status === "guest") return <div className="mx-auto max-w-[1200px] px-4 py-6 text-muted">Redirecting to sign in…</div>;
  if (session.status === "authenticated" && session.user?.role !== "customer") {
    return (
      <div className="mx-auto max-w-[1200px] px-4 py-6">
        <section className="rounded-xl border border-line bg-panel p-8 text-center">
          <h1 className="font-display text-2xl font-bold">Customer account required</h1>
          <p className="mt-1 text-muted">Order details are only available to customer accounts.</p>
        </section>
      </div>
    );
  }
  if (session.status === "loading" || status === "loading") return <div className="mx-auto max-w-[1200px] px-4 py-6 text-muted">Loading order {id}…</div>;
  if (status === "error") {
    return (
      <div className="mx-auto max-w-[1200px] px-4 py-6">
        <section className="rounded-xl border border-line bg-panel p-4 text-center">
          <h1 className="font-display text-xl font-bold">This order couldn’t load</h1>
          <p className="mt-1 text-muted">{error}</p>
          <Button className="mt-4" onClick={retry}>Try again</Button>
        </section>
      </div>
    );
  }
  if (status === "notfound" || !order) {
    return (
      <div className="mx-auto max-w-[1200px] px-4 py-6">
        <section className="rounded-xl border border-line bg-panel p-4 text-center">
          <h1 className="font-display text-xl font-bold">Order not found</h1>
          <p className="mt-1 text-muted">This order does not belong to your account or does not exist.</p>
          <Link href="/orders" className="mt-4 inline-flex min-h-10 items-center rounded-full border border-line px-4 font-semibold hover:bg-tint">Back to your orders</Link>
        </section>
      </div>
    );
  }

  const preview = toOrderPreview(order);
  const headline = order.cancelled ? "This order was cancelled" : order.stage >= 4 ? "Delivered" : `Arriving ${dLong(preview.eta)}`;
  const canCancel =
    !order.cancelled &&
    order.shipments.length > 0 &&
    order.shipments.every((shipment) => ["new", "accepted", "packed"].includes(shipment.status));

  const submitCancel = async () => {
    setCancelError("");
    if (cancelReason.trim().length < 3) {
      setCancelError("Give a reason for cancelling.");
      return;
    }
    setCancelling(true);
    try {
      setOrder(await cancelOrder(order.code, cancelReason.trim()));
      setCancelOpen(false);
      setCancelReason("");
    } catch (err) {
      setCancelError(err instanceof ApiClientError ? err.message : "Could not cancel this order.");
    } finally {
      setCancelling(false);
    }
  };

  const confirmDelivery = async (shipmentId: string) => {
    setReviewBusyId(shipmentId);
    setReviewErrors((prev) => ({ ...prev, [shipmentId]: "" }));
    try {
      setOrder(await confirmShipmentDelivery(order.code, shipmentId));
    } catch (err) {
      setReviewErrors((prev) => ({
        ...prev,
        [shipmentId]: err instanceof ApiClientError ? err.message : "Could not confirm this delivery.",
      }));
    } finally {
      setReviewBusyId(null);
    }
  };

  const submitIssue = async () => {
    if (!issueShipmentId) return;
    setIssueError("");
    if (issueNote.trim().length < 3) {
      setIssueError("Describe the issue.");
      return;
    }
    setIssueSubmitting(true);
    try {
      setOrder(await reportShipmentIssue(order.code, issueShipmentId, issueNote.trim()));
      setIssueShipmentId(null);
      setIssueNote("");
    } catch (err) {
      setIssueError(err instanceof ApiClientError ? err.message : "Could not report this issue.");
    } finally {
      setIssueSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-4">
      <nav aria-label="Breadcrumb" className="mb-2 text-[13px] text-muted">
        <Link href="/orders" className="text-link hover:underline">Your orders</Link> › Order {order.code}
      </nav>
      <h1 className="mb-3 font-display text-2xl font-bold">Order details</h1>

      <section className="mb-4 rounded-xl border border-line bg-panel p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2 className="font-display text-lg font-bold">{headline}</h2>
          {canCancel && (
            <Button variant="line" size="sm" onClick={() => setCancelOpen(true)}>
              Cancel order
            </Button>
          )}
        </div>
        {order.cancelled && (
          <div className="mt-2 rounded-lg border border-bad/40 bg-bad/10 p-2.5 text-sm">
            <b>Cancelled before dispatch.</b> Reserved stock was restored.
            {order.financeModel === "escrow" && " The internal escrow hold was refunded."} Cash on delivery means no
            money was collected, so there is no refund to wait for.
          </div>
        )}
        {!order.cancelled && order.financeModel === "seller_collected" && (
          <p className="mt-1 text-[13px] text-muted">
            Cash on delivery — pay the seller (or their driver) directly when your order arrives.
          </p>
        )}
        {!order.cancelled && order.financeModel === "escrow" && (
          <p className="mt-1 text-[13px] text-muted">
            Escrow: {inr(Number(order.escrow.held))} held
            {Number(order.escrow.refunded) > 0 ? ` · ${inr(Number(order.escrow.refunded))} refunded` : ""}
            {Number(order.escrow.released) > 0 ? ` · ${inr(Number(order.escrow.released))} released` : ""}
          </p>
        )}
        {!order.cancelled && (
          <ol className="mt-3 grid gap-2 sm:grid-cols-5">
            {ORDER_STAGES.map((stage, index) => (
              <li
                key={stage}
                className={`grid gap-1 rounded-lg border p-2.5 text-[13px] ${
                  index < order.stage ? "border-line bg-tint opacity-70" : index === order.stage ? "border-hi bg-tint" : "border-line"
                }`}
                aria-current={index === order.stage ? "step" : undefined}
              >
                <span className="grid place-items-center text-hiink" aria-hidden="true">
                  {index <= order.stage ? <span className="grid h-6 w-6 place-items-center rounded-full bg-hi text-xs font-bold">✓</span> : <span className="grid h-6 w-6 place-items-center rounded-full border border-line bg-panel text-xs">{index + 1}</span>}
                </span>
                <b>{stage}</b>
                <small className="text-muted">{preview.times[index] ? dStamp(preview.times[index]) : ""}</small>
              </li>
            ))}
          </ol>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-line bg-panel p-4">
          <h3 className="font-display text-lg font-bold">Shipping address</h3>
          <p className="mt-1">
            {order.address.name}<br />{order.address.line1}<br />
            {order.address.city}, {order.address.state} {order.address.pin}<br />
            Phone: {order.address.phone}
          </p>
          <h3 className="mt-3 font-display text-lg font-bold">Payment method</h3>
          <p className="mt-1">{order.paymentLabel}</p>
        </section>
        <section className="rounded-xl border border-line bg-panel p-4">
          <h3 className="font-display text-lg font-bold">Order summary</h3>
          <div className="mt-1.5 grid gap-1 text-[14px]">
            <div className="flex justify-between"><span>Items</span><b>{inr(Number(order.totals.subtotal))}</b></div>
            <div className="flex justify-between"><span>Delivery</span><b>{Number(order.totals.deliveryFee) ? inr(Number(order.totals.deliveryFee)) : "FREE"}</b></div>
            {Number(order.totals.discount) > 0 && <div className="flex justify-between text-ok"><span>Coupon {order.couponCode}</span><b>-{inr(Number(order.totals.discount))}</b></div>}
            <div className="flex justify-between border-t border-line pt-1.5"><span className="font-bold">Grand total</span><b>{inr(Number(order.totals.total))}</b></div>
            <p className="text-xs text-muted">Includes GST of {inr(Number(order.totals.taxAmount))}</p>
          </div>
        </section>
      </div>

      <section className="mt-4 rounded-xl border border-line bg-panel p-4">
        <h3 className="font-display text-lg font-bold">Shipments</h3>
        <div className="mt-2 grid gap-2">
          {order.shipments.map((shipment) => (
            <div key={shipment.id} className="rounded-lg border border-line p-3">
              <div className="flex flex-wrap justify-between gap-2">
                <b>{shipment.sellerName}</b>
                <span className="text-[13px] font-semibold capitalize text-muted">{shipment.status.replaceAll("_", " ")}</span>
              </div>
              <p className="text-[13px] text-muted">{shipment.code}{shipment.deliveredAt ? ` · delivered ${dLong(shipment.deliveredAt)}` : ""}</p>
              {shipment.otp && (
                <div className="mt-1.5 flex flex-wrap items-center gap-2 rounded-lg border border-warn/40 bg-warn/10 p-2.5 text-[13px]">
                  <span>Delivery OTP</span>
                  <b className="font-display text-xl tracking-[0.3em]">{shipment.otp}</b>
                  <span className="text-muted">Share only with the driver at drop-off.</span>
                </div>
              )}
              <ul className="mt-1 grid gap-0.5 text-[13px] text-muted">
                {shipment.events.map((event) => <li key={`${event.at}-${event.message}`}>{dStamp(event.at)} · {event.message}</li>)}
              </ul>
              {shipment.status === "review" && (
                <div className="mt-2 grid gap-2 rounded-lg border border-ok/40 bg-ok/10 p-2.5 text-[13px]">
                  <span>Delivered — confirm it&apos;s all good, or report a problem.</span>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="yellow"
                      disabled={reviewBusyId === shipment.id}
                      onClick={() => void confirmDelivery(shipment.id)}
                    >
                      {reviewBusyId === shipment.id ? "Confirming…" : "Confirm delivery"}
                    </Button>
                    <Button
                      size="sm"
                      variant="line"
                      disabled={reviewBusyId === shipment.id}
                      onClick={() => {
                        setIssueShipmentId(shipment.id);
                        setIssueNote("");
                        setIssueError("");
                      }}
                    >
                      Report an issue
                    </Button>
                  </div>
                  {reviewErrors[shipment.id] && <p role="alert" className="text-bad">{reviewErrors[shipment.id]}</p>}
                </div>
              )}
              {shipment.status === "disputed" && shipment.issue && (
                <div className="mt-2 rounded-lg border border-bad/40 bg-bad/10 p-2.5 text-[13px]">
                  <b>Issue reported.</b> {shipment.issue.note}
                </div>
              )}
              {shipment.status === "settled" && (
                <p className="mt-2 text-[13px] text-ok">You confirmed this delivery.</p>
              )}
            </div>
          ))}
        </div>
      </section>

      <div className="mt-4"><OrderCard order={preview} brief /></div>

      <Dialog
        open={cancelOpen}
        onClose={() => {
          if (!cancelling) setCancelOpen(false);
        }}
        title="Cancel this order?"
      >
        <form
          className="grid gap-3 p-5"
          onSubmit={(event) => {
            event.preventDefault();
            void submitCancel();
          }}
        >
          <h2 className="font-display text-lg font-bold">Cancel {order.code}?</h2>
          <p className="text-sm text-muted">
            This only works before a seller dispatches. Reserved stock is restored and the escrow hold is refunded.
          </p>
          <label className="grid gap-1 text-sm font-semibold">
            Reason
            <textarea
              rows={3}
              maxLength={300}
              value={cancelReason}
              onChange={(event) => setCancelReason(event.target.value)}
              className="rounded-lg border border-line bg-panel p-2.5 text-sm font-normal"
              placeholder="Ordered by mistake, found a better price…"
            />
          </label>
          {cancelError && <p role="alert" className="rounded-lg border border-bad bg-panel p-2.5 text-[13px] font-medium text-bad">{cancelError}</p>}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="red" disabled={cancelling}>
              {cancelling ? "Cancelling…" : "Cancel order"}
            </Button>
            <Button type="button" variant="line" disabled={cancelling} onClick={() => setCancelOpen(false)}>
              Keep order
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={issueShipmentId !== null}
        onClose={() => {
          if (!issueSubmitting) setIssueShipmentId(null);
        }}
        title="Report an issue"
      >
        <form
          className="grid gap-3 p-5"
          onSubmit={(event) => {
            event.preventDefault();
            void submitIssue();
          }}
        >
          <h2 className="font-display text-lg font-bold">What went wrong?</h2>
          <p className="text-sm text-muted">
            This opens a dispute on the delivery for an admin to review. You cannot undo this once submitted.
          </p>
          <label className="grid gap-1 text-sm font-semibold">
            Describe the problem
            <textarea
              rows={3}
              maxLength={500}
              value={issueNote}
              onChange={(event) => setIssueNote(event.target.value)}
              className="rounded-lg border border-line bg-panel p-2.5 text-sm font-normal"
              placeholder="e.g. Cement bags arrived torn/damaged"
            />
          </label>
          {issueError && <p role="alert" className="rounded-lg border border-bad bg-panel p-2.5 text-[13px] font-medium text-bad">{issueError}</p>}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="red" disabled={issueSubmitting}>
              {issueSubmitting ? "Reporting…" : "Report issue"}
            </Button>
            <Button type="button" variant="line" disabled={issueSubmitting} onClick={() => setIssueShipmentId(null)}>
              Cancel
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
