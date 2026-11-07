// Withdraw dialog — port of buildgrid-seller-dashboard.html's `dWithdraw()` (line 272).
"use client";

import Dialog from "@/components/ui/Dialog";
import Button from "@/components/ui/Button";
import SellerIcon from "./SellerIcon";
import { useSellerStore } from "./SellerStoreProvider";
import { getBalance } from "@/lib/seller/selectors";
import { MIN_WITHDRAWAL } from "@/lib/seller/rules";

function inr(n: number): string {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

export default function WithdrawDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, withdraw } = useSellerStore();
  const { available } = getBalance(state);
  const canWithdraw = available >= MIN_WITHDRAWAL;

  return (
    <Dialog open={open} onClose={onClose} title="Withdraw to bank" wide>
      <form
        className="relative grid gap-3 p-[22px]"
        onSubmit={(e) => {
          e.preventDefault();
          if (!canWithdraw) return;
          withdraw();
          onClose();
        }}
      >
        <button type="button" onClick={onClose} aria-label="Close" className="absolute top-3 right-3 grid h-[34px] w-[34px] place-items-center rounded-lg bg-tint">
          <SellerIcon name="x" size={16} />
        </button>
        <h2 className="font-display text-lg font-bold">Withdraw to bank</h2>
        <p className="text-sm text-muted">
          Available balance <b>{inr(available)}</b>. Money arrives in {state.store.bank} within 1 working day. Minimum withdrawal is{" "}
          {inr(MIN_WITHDRAWAL)}.
        </p>
        {!canWithdraw && (
          <div className="flex items-start gap-2.5 rounded-lg border border-warn/40 bg-warn/10 p-2.5 text-sm">
            <SellerIcon name="alert" size={18} />
            <div>You need at least {inr(MIN_WITHDRAWAL)} available to withdraw.</div>
          </div>
        )}
        <Button type="submit" variant="yellow" wide disabled={!canWithdraw}>
          Withdraw {inr(available)}
        </Button>
      </form>
    </Dialog>
  );
}
