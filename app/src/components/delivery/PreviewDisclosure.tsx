// Delivery Portal data notice, shown once per page. Delivery jobs and OTP
// verification are persisted in PostgreSQL; there is no GPS or SMS provider.
export default function PreviewDisclosure({ className }: { className?: string }) {
  return (
    <p className={`text-xs text-muted ${className ?? ""}`}>
      Delivery jobs, OTP checks and issues are saved to the marketplace database. This app has no real GPS
      tracking or SMS/WhatsApp notifications.
    </p>
  );
}
