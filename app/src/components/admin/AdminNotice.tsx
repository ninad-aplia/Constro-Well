// Shared inline notice for Admin pages (error/unauthorized/empty states).
export default function AdminNotice({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <section
      role="alert"
      className="grid justify-items-start gap-2 rounded-xl border border-line bg-panel p-6"
    >
      <h2 className="font-display text-lg font-bold">{title}</h2>
      <p className="text-sm text-muted">{body}</p>
      {action}
    </section>
  );
}
