// Seller Hub shell — port of buildgrid-seller-dashboard.html's `.app` grid
// (CSS line 23: 244px sidebar + content). Server Component: fetches the
// initial preview state once via the facade, then hands it to the
// client-side SellerStoreProvider, which owns every subsequent mutation
// (accept/dispatch/stock edits/etc. are local preview state only — see
// SellerStoreProvider's header comment).
import SellerStoreProvider from "@/components/seller/SellerStoreProvider";
import SellerSidebar from "@/components/seller/SellerSidebar";
import SellerTopBar from "@/components/seller/SellerTopBar";
import SellerBottomNav from "@/components/seller/SellerBottomNav";
import { getSellerState } from "@/lib/api/seller";

// Every Seller Hub page is a fully interactive preview dashboard (live
// filters, drawers, forms) with no meaningful static shell — same situation
// as /search and /product/[id] under this project's `cacheComponents`
// config. Set once here so it applies to the whole /seller subtree.
export const instant = false;

export default async function SellerLayout({ children }: { children: React.ReactNode }) {
  const initialState = await getSellerState();

  return (
    <SellerStoreProvider initialState={initialState}>
      <div className="min-h-screen bg-bg text-ink md:grid md:grid-cols-[72px_minmax(0,1fr)] lg:grid-cols-[244px_minmax(0,1fr)]">
        <SellerSidebar />
        <div className="min-w-0">
          <SellerTopBar />
          <main className="mx-auto max-w-[1500px] px-3.5 py-5 pb-24 md:px-6 md:pb-8" tabIndex={-1}>
            {children}
          </main>
        </div>
      </div>
      <SellerBottomNav />
    </SellerStoreProvider>
  );
}
