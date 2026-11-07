// Mock-data/preview-session disclosure, shown once per Seller Hub page
// (same pattern as the Customer Portal's "Sample catalogue data" notes).
export default function PreviewDisclosure({ className }: { className?: string }) {
  return (
    <p className={`text-xs text-muted ${className ?? ""}`}>
      Preview session — sample seller data. Actions like accept, dispatch, stock
      and settings changes update this screen only; nothing is saved to a
      server or shared with real buyers.
    </p>
  );
}
