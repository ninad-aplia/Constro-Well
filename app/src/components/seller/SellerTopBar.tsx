// Seller Hub top bar — port of buildgrid-seller-dashboard.html's `.top`
// (CSS lines 32-38): search, "accepting orders" vacation toggle, notification
// bell with unread popover, avatar.
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useSellerStore } from "./SellerStoreProvider";
import { useSellerLive } from "./SellerLiveProvider";
import { useToast } from "@/components/ui/Toast";
import SellerIcon from "./SellerIcon";
import LogoutButton from "@/components/auth/LogoutButton";

export default function SellerTopBar() {
  const router = useRouter();
  const toast = useToast();
  const { state, markAllNotificationsRead } = useSellerStore();
  const { summary, setVacationMode } = useSellerLive();
  const [notifOpen, setNotifOpen] = useState(false);
  const [vacationBusy, setVacationBusy] = useState(false);

  const toggleVacation = () => {
    const next = !summary.vacationMode;
    setVacationBusy(true);
    setVacationMode(next)
      .then(() => toast.show(next ? "Vacation mode on. New orders are paused." : "You are accepting orders again."))
      .catch(() => toast.show("Could not update vacation mode. Try again."))
      .finally(() => setVacationBusy(false));
  };
  const unread = state.notifications.filter((n) => !n.read).length;
  const initials = state.store.owner
    .split(" ")
    .map((x) => x[0])
    .join("");

  return (
    <header className="sticky top-0 z-30 flex items-center gap-2.5 border-b border-line bg-bg/90 px-3.5 py-2.5 backdrop-blur-sm">
      <form
        role="search"
        aria-label="Search orders"
        className="flex h-[42px] max-w-[460px] flex-1 items-center gap-2 rounded-xl border border-line bg-panel px-3 text-muted focus-within:outline-3 focus-within:outline-hi"
        onSubmit={(e) => {
          e.preventDefault();
          const q = (e.currentTarget.elements.namedItem("q") as HTMLInputElement).value.trim();
          router.push(q ? `/seller/orders?q=${encodeURIComponent(q)}` : "/seller/orders");
        }}
      >
        <SellerIcon name="search" size={18} />
        <input
          name="q"
          type="search"
          placeholder="Search orders by ID, product or city"
          autoComplete="off"
          className="min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-muted"
        />
      </form>

      <div className="ml-auto hidden items-center gap-2 text-[13px] font-semibold sm:flex">
        <span>{summary.vacationMode ? "Vacation mode" : "Accepting orders"}</span>
        <button
          type="button"
          role="switch"
          aria-checked={!summary.vacationMode}
          aria-label="Accepting new orders"
          onClick={toggleVacation}
          disabled={vacationBusy}
          className={`relative h-6 w-[42px] flex-none rounded-xl transition-colors disabled:opacity-60 ${
            summary.vacationMode ? "bg-line" : "bg-ok"
          }`}
        >
          <span
            className={`absolute top-[3px] h-[18px] w-[18px] rounded-full bg-white shadow transition-[left] ${
              summary.vacationMode ? "left-[3px]" : "left-[21px]"
            }`}
          />
        </button>
      </div>

      <div className="relative">
        <button
          type="button"
          aria-label="Notifications"
          onClick={() => setNotifOpen((v) => !v)}
          className="grid h-[42px] w-[42px] place-items-center rounded-xl border border-line bg-panel hover:border-ink2"
        >
          <SellerIcon name="bell" />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-bad px-1 text-[11px] font-bold text-white">
              {unread}
            </span>
          )}
        </button>
        {notifOpen && (
          <div className="fixed top-16 right-3.5 z-60 w-[min(360px,calc(100vw-28px))] rounded-2xl border border-line bg-panel p-3 shadow-card">
            <div className="mb-1 flex items-center justify-between gap-2.5">
              <h3 className="font-semibold">Notifications</h3>
              <button
                type="button"
                onClick={markAllNotificationsRead}
                className="rounded-lg border border-line px-3 py-1 text-[13px] font-semibold hover:bg-tint"
              >
                Mark all read
              </button>
            </div>
            {state.notifications.length === 0 ? (
              <p className="p-3 text-muted">Nothing yet.</p>
            ) : (
              state.notifications.slice(0, 8).map((n) => (
                <div key={n.id} className="flex gap-2.5 border-b border-line py-2 text-sm last:border-0">
                  <span className={`mt-1.5 h-[9px] w-[9px] flex-none rounded-full ${n.read ? "bg-line" : "bg-link"}`} />
                  <div>
                    {n.message}
                    <small className="block text-muted">{n.atLabel}</small>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <LogoutButton className="rounded-xl border border-line bg-panel px-3 py-2 text-[13px] font-semibold hover:bg-tint disabled:opacity-60" />

      <div
        className="grid h-[34px] w-[34px] flex-none place-items-center rounded-full bg-hi text-[13px] font-bold text-hiink"
        title="Account"
        aria-hidden="true"
      >
        {initials}
      </div>
    </header>
  );
}
