import SellerFinanceView from "@/components/seller/SellerFinanceView";

// Request-time page with no meaningful static shell; the seller layout already
// opts out, and setting it here too keeps the page segment from being dropped by
// Next's instant-navigation validation.
export const instant = false;

export default function SellerFinancePage() {
  return <SellerFinanceView />;
}
