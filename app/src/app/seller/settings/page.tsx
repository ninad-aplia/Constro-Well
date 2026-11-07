// Seller Hub Settings — port of buildgrid-seller-dashboard.html's
// viewSettings() (line 388): store profile form (GSTIN/mobile validation),
// KYC checklist, notification preference toggles.
"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Pill from "@/components/ui/Pill";
import PreviewDisclosure from "@/components/seller/PreviewDisclosure";
import SellerIcon from "@/components/seller/SellerIcon";
import { useSellerStore } from "@/components/seller/SellerStoreProvider";
import type { NotificationPreferences } from "@/lib/seller/types";

const PREFERENCE_COPY: { key: keyof NotificationPreferences; label: string; sub: string }[] = [
  { key: "newOrder", label: "New order alerts", sub: "SMS and push the moment an order arrives" },
  { key: "deadlineReminders", label: "Deadline reminders", sub: "1 hour before an accept or dispatch deadline" },
  { key: "lowStock", label: "Low stock alerts", sub: "When a product reaches its restock level" },
  { key: "payouts", label: "Payout notifications", sub: "When money is released or transferred" },
];

export default function SellerSettingsPage() {
  const { state, saveStoreProfile, verifyKycDoc, togglePreference } = useSellerStore();
  const [name, setName] = useState(state.store.name);
  const [gstin, setGstin] = useState(state.store.gstin);
  const [phone, setPhone] = useState(state.store.phone);
  const [address, setAddress] = useState(state.store.address);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const submit = () => {
    const next: Record<string, string> = {};
    if (!/^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/.test(gstin.toUpperCase())) next.gstin = "Enter a valid 15-character GSTIN";
    if (!/^[6-9]\d{9}$/.test(phone)) next.phone = "Enter a valid 10-digit mobile number";
    if (name.length < 3) next.name = "Enter your business name";
    setErrors(next);
    if (Object.keys(next).length) return;
    saveStoreProfile({ name, gstin, phone, address });
  };

  const kyc = state.store.kyc;

  return (
    <div className="grid gap-4">
      <PreviewDisclosure />

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
                <input className="h-10 rounded-lg border border-line bg-tint px-2.5 text-muted" value={state.store.city} disabled />
              </label>
            </div>
            <label className="grid gap-1 text-sm font-semibold">
              Pickup address
              <input className="h-10 rounded-lg border border-line bg-panel px-2.5" value={address} onChange={(e) => setAddress(e.target.value)} />
            </label>
            <Button type="submit" variant="yellow" className="w-fit">
              Save changes
            </Button>
          </form>
        </Card>

        <div className="grid content-start gap-3.5">
          <Card rounded="lg" className="p-[18px]">
            <h2 className="mb-1.5 font-display text-lg font-bold">Verification</h2>
            {([
              ["GST certificate", "gst", kyc.gst],
              ["PAN card", "pan", kyc.pan],
              ["Cancelled cheque", "cheque", kyc.cheque],
            ] as const).map(([label, doc, status]) => (
              <div key={label} className="flex items-center justify-between gap-3.5 border-b border-line py-2.5 last:border-0">
                <span className="flex items-center gap-2">
                  <SellerIcon name="doc" size={16} />
                  {label}
                </span>
                {status === "Verified" ? (
                  <Pill tone="ok">
                    <SellerIcon name="check" size={12} /> Verified
                  </Pill>
                ) : (
                  <Button size="sm" variant="line" onClick={() => verifyKycDoc(doc)}>
                    Upload (demo)
                  </Button>
                )}
              </div>
            ))}
            {kyc.cheque !== "Verified" && (
              <div className="mt-2.5 flex items-start gap-2.5 rounded-lg border border-warn/40 bg-warn/10 p-2.5 text-sm">
                <SellerIcon name="alert" size={18} />
                <div>Payouts to your bank stay on hold until the cancelled cheque is verified.</div>
              </div>
            )}
          </Card>

          <Card rounded="lg" className="p-[18px]">
            <h2 className="mb-1.5 font-display text-lg font-bold">Alerts</h2>
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
