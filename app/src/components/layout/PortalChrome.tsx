// Switches the root layout's chrome by portal: the Customer Portal's
// SiteHeader/SiteFooter must not appear on Seller Hub or Delivery Portal
// pages, which have their own sidebar-based shells with completely different
// navigation (AGENTS.md: "portal-specific visual characteristics" must be
// preserved, not layered with the shop's header). A Client Component is the
// only way to branch on the current path without moving the existing
// Customer Portal routes into a route group — this keeps every existing
// Customer Portal file untouched.
"use client";

import { usePathname } from "next/navigation";
import SiteHeader from "@/components/ui/SiteHeader";
import SiteFooter from "@/components/ui/SiteFooter";

export default function PortalChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hasOwnShell = pathname?.startsWith("/seller") || pathname?.startsWith("/delivery") || false;

  if (hasOwnShell) {
    return (
      <main id="app" className="flex-1" tabIndex={-1}>
        {children}
      </main>
    );
  }

  return (
    <>
      <SiteHeader />
      <main id="app" className="flex-1" tabIndex={-1}>
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
