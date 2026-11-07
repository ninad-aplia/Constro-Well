// Mock-data/preview-session disclosure, shown once per Seller Hub page.
// Pages backed by PostgreSQL can pass an accurate custom message.
export default function PreviewDisclosure({
  className,
  message,
}: {
  className?: string;
  message?: string;
}) {
  return (
    <p className={`text-xs text-muted ${className ?? ""}`}>
      {message ??
        "Preview session — sample seller data. Actions like accept, dispatch, stock and settings changes update this screen only; nothing is saved to a server or shared with real buyers."}
    </p>
  );
}
