// Mock-data/preview-session disclosure, shown once per Delivery Portal page
// (same pattern as the Seller Hub's `components/seller/PreviewDisclosure.tsx`).
export default function PreviewDisclosure({ className }: { className?: string }) {
  return (
    <p className={`text-xs text-muted ${className ?? ""}`}>
      Preview session — sample delivery data derived from the Seller Hub&apos;s mock
      orders. Confirming a delivery or marking a failed attempt updates this
      screen only; nothing is saved to a server. This demo has no real GPS
      tracking, live location or SMS notifications.
    </p>
  );
}
