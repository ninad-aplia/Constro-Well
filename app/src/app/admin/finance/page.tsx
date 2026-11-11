import AdminFinanceView from "@/components/admin/AdminFinanceView";

// The console is request-time (session + live FastAPI data) and has no static
// shell; without this, Next's instant-navigation validation drops the segment
// in dev. Same per-page opt-out as the other admin pages.
export const instant = false;

export default function AdminFinancePage() {
  return <AdminFinanceView />;
}
