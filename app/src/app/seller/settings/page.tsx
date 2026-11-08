// Seller Hub Settings — port of buildgrid-seller-dashboard.html's
// viewSettings() (line 388): store profile form (GSTIN/mobile validation),
// KYC checklist, notification preference toggles. The store-details form and
// KYC status now read/write the real Seller row through
// `/api/seller/settings`; notification preferences have no persisted model
// yet and stay local-only (see PreviewDisclosure below).
"use client";

import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Pill from "@/components/ui/Pill";
import { useToast } from "@/components/ui/Toast";
import PreviewDisclosure from "@/components/seller/PreviewDisclosure";
import SellerIcon from "@/components/seller/SellerIcon";
import { useSellerStore } from "@/components/seller/SellerStoreProvider";
import { ApiClientError } from "@/lib/api/client";
import { fetchSellerProfile, updateSellerProfile } from "@/lib/api/sellerApi";
import type { SellerProfileDto } from "@/lib/api/sellerOrderDto";
import type { NotificationPreferences } from "@/lib/seller/types";

const PREFERENCE_COPY: { key: keyof NotificationPreferences; label: string; sub: string }[] = [
  { key: "newOrder", label: "New order alerts", sub: "SMS and push the moment an order arrives" },
  { key: "deadlineReminders", label: "Deadline reminders", sub: "1 hour before an accept or dispatch deadline" },
  { key: "lowStock", label: "Low stock alerts", sub: "When a product reaches its restock level" },
  { key: "payouts", label: "Payout notifications", sub: "When money is released or transferred" },
];

function messageOf(error: unknown): string {
  if (error instanceof ApiClientError) {
    if (error.status === 401) return "Sign in as a seller to manage settings.";
    if (error.status === 403) return "This account does not have a seller profile.";
    return error.message;
  }
  return "Could not reach the settings service. Try again.";
}

type LoadState = "loading" | "ready" | "error";

export default function SellerSettingsPage() {
  const toast = useToast();
  const { state, togglePreference } = useSellerStore();
  const [profile, setProfile] = useState<SellerProfileDto | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [loadError, setLoadError] = useState("");
  const [name, setName] = useState("");
  const [gstin, setGstin] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchSellerProfile()
      .then((p) => {
        if (cancelled) return;
        setProfile(p);
        setName(p.storeName);
        setGstin(p.gstin);
        setPhone(p.phone);
        setAddress(p.pickupAddress);
        setLoadState("ready");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoadError(messageOf(err));
        setLoadState("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const submit = () => {
    const next: Record<string, string> = {};
    if (!/^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/.test(gstin.toUpperCase())) next.gstin = "Enter a valid 15-character GSTIN";
    if (!/^[6-9]\d{9}$/.test(phone)) next.phone = "Enter a valid 10-digit mobile number";
    if (name.length < 3) next.name = "Enter your business name";
    setErrors(next);
    if (Object.keys(next).length) return;
    setSaving(true);
    updateSellerProfile({ storeName: name, gstin, phone, pickupAddress: address })
      .then((updated) => {
        setProfile(updated);
        toast.show("Store details saved");
      })
      .catch((err: unknown) => toast.show(messageOf(err)))
      .finally(() => setSaving(false));
  };

  if (loadState === "loading") {
    return <p className="text-muted">Loading settings…</p>;
  }
  if (loadState === "error" || !profile) {
    return <p className="text-bad">{loadError}</p>;
  }

  const kyc = profile.kyc;

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="font-display text-[clamp(25px,3vw,34px)] font-bold">Settings</h1>
        <p className="mt-1 text-muted">Your store profile, verification and alerts.</p>
      </div>

      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
        <Card rounded="lg" className="p-[18px]">
          <h2 className="mb-2.5 font-display text-lg font-bold">Store details</h2>
          <form
            className="grid gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <label className="grid gap-1 text-sm font-semibold">
              Business name
              <input className="h-10 rounded-lg border border-line bg-panel px-2.5" value={name} onChange={(e) => setName(e.target.value)} />
              {errors.name && <span className="text-[13px] font-medium text-bad">{errors.name}</span>}
            </label>
            <label className="grid gap-1 text-sm font-semibold">
              GSTIN
              <input className="h-10 rounded-lg border border-line bg-panel px-2.5" value={gstin} onChange={(e) => setGstin(e.target.value)} />
              {errors.gstin && <span className="text-[13px] font-medium text-bad">{errors.gstin}</span>}
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <label className="grid gap-1 text-sm font-semibold">
                Mobile
                <input className="h-10 rounded-lg border border-line bg-panel px-2.5" inputMode="numeric" maxLength={10} value={phone} onChange={(e) => setPhone(e.target.value)} />
                {errors.phone && <span className="text-[13px] font-medium text-bad">{errors.phone}</span>}
              </label>
              <label className="grid gap-1 text-sm font-semibold">
                City
                <input className="h-10 rounded-lg border border-line bg-tint px-2.5 text-muted" value={profile.city} disabled />
              </label>
            </div>
            <label className="grid gap-1 text-sm font-semibold">
              Pickup address
              <input className="h-10 rounded-lg border border-line bg-panel px-2.5" value={address} onChange={(e) => setAddress(e.target.value)} />
            </label>
            <Button type="submit" variant="yellow" className="w-fit" disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </form>
        </Card>

        <div className="grid content-start gap-3.5">
          <Card rounded="lg" className="p-[18px]">
            <h2 className="mb-1.5 font-display text-lg font-bold">Verification</h2>
            {([
              ["GST certificate", kyc.gst],
              ["PAN card", kyc.pan],
              ["Cancelled cheque", kyc.cheque],
            ] as const).map(([label, status]) => (
              <div key={label} className="flex items-center justify-between gap-3.5 border-b border-line py-2.5 last:border-0">
                <span className="flex items-center gap-2">
                  <SellerIcon name="doc" size={16} />
                  {label}
                </span>
                {status === "verified" ? (
                  <Pill tone="ok">
                    <SellerIcon name="check" size={12} /> Verified
                  </Pill>
                ) : (
                  <Pill tone="info">Pending — document upload isn&rsquo;t available yet</Pill>
                )}
              </div>
            ))}
            {kyc.cheque !== "verified" && (
              <div className="mt-2.5 flex items-start gap-2.5 rounded-lg border border-warn/40 bg-warn/10 p-2.5 text-sm">
                <SellerIcon name="alert" size={18} />
                <div>Payouts to your bank stay on hold until the cancelled cheque is verified.</div>
              </div>
            )}
          </Card>

          <Card rounded="lg" className="p-[18px]">
            <h2 className="mb-1.5 font-display text-lg font-bold">Alerts</h2>
            <PreviewDisclosure
              className="mb-2"
              message="Notification preferences are not yet backed by a database table; toggles below only apply to this browser session."
            />
            {PREFERENCE_COPY.map(({ key, label, sub }) => (
              <div key={key} className="flex items-center justify-between gap-3.5 border-b border-line py-2.5 last:border-0">
                <div>
                  <b>{label}</b>
                  <div className="text-[13px] text-muted">{sub}</div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={state.preferences[key]}
                  aria-label={label}
                  onClick={() => togglePreference(key)}
                  className={`relative h-6 w-[42px] flex-none rounded-xl ${state.preferences[key] ? "bg-ok" : "bg-line"}`}
                >
                  <span
                    className={`absolute top-[3px] h-[18px] w-[18px] rounded-full bg-white shadow transition-[left] ${
                      state.preferences[key] ? "left-[21px]" : "left-[3px]"
                    }`}
                  />
                </button>
              </div>
            ))}
          </Card>
        </div>
      </div>
    </div>
  );
}
