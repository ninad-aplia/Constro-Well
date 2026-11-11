// Admin console shell. Server Component: the role check here is UX only —
// FastAPI's `require_admin` remains the authorization boundary for every
// admin request (see lib/api/adminApi.ts + backend routers/admin.py).
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/current";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminTopBar from "@/components/admin/AdminTopBar";
import AdminBottomNav from "@/components/admin/AdminBottomNav";
import AdminAccessNotice from "@/components/admin/AdminAccessNotice";

// The console is request-time (session + live backend data); no static shell.
export const instant = false;

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  // The layout cannot see the requested pathname, so deep links fall back to the
  // console root (which redirects to /admin/users after sign-in).
  if (!user) redirect("/login?next=/admin");
  if (user.role !== "admin") return <AdminAccessNotice user={user} />;

  return (
    <div className="min-h-screen bg-bg text-ink md:grid md:grid-cols-[72px_minmax(0,1fr)] lg:grid-cols-[244px_minmax(0,1fr)]">
      <AdminSidebar />
      <div className="min-w-0">
        <AdminTopBar user={user} />
        <main className="mx-auto max-w-[1500px] px-3.5 py-5 pb-24 md:px-6 md:pb-8" tabIndex={-1}>
          {children}
        </main>
      </div>
      <AdminBottomNav />
    </div>
  );
}
