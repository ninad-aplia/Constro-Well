// Seller overview table. Shows only fields the admin API returns; KYC values are
// the stored enum values, never inferred labels.
import Link from "next/link";
import Pill from "@/components/ui/Pill";
import type { AdminSeller } from "@/lib/api/adminApi";

const KYC_TONE: Record<string, "ok" | "warn" | "neutral"> = {
  verified: "ok",
  pending: "warn",
};

function joined(iso: string): string {
  const normalized = /[zZ]$|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : `${iso}Z`;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function KycPill({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-tint px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap">
      <span className="text-muted">{label}</span>
      <Pill tone={KYC_TONE[value] ?? "neutral"} className="capitalize">
        {value}
      </Pill>
    </span>
  );
}

export default function AdminSellersTable({
  sellers,
  total,
}: {
  sellers: AdminSeller[];
  total: number;
}) {
  if (sellers.length === 0) {
    const empty = total === 0;
    return (
      <section className="grid justify-items-center gap-2 rounded-xl border border-line bg-panel px-5 py-12 text-center">
        <h2 className="font-display text-lg font-bold">
          {empty ? "No sellers yet" : "No sellers on this page"}
        </h2>
        <p className="text-sm text-muted">
          {empty
            ? "Seller accounts will appear here after onboarding."
            : "The requested page is beyond the end of the list."}
        </p>
        {!empty && (
          <Link
            href="/admin/sellers"
            className="mt-1 inline-flex min-h-9 items-center rounded-lg border border-line bg-panel px-3 text-[13px] font-semibold hover:bg-tint"
          >
            Back to first page
          </Link>
        )}
      </section>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-panel">
      <table className="w-full min-w-[1080px] border-collapse text-sm">
        <caption className="sr-only">Seller accounts and stored KYC status</caption>
        <thead>
          <tr className="border-b border-line text-left text-xs text-muted">
            <th scope="col" className="px-4 py-2.5 font-semibold">Store</th>
            <th scope="col" className="px-4 py-2.5 font-semibold">Owner</th>
            <th scope="col" className="px-4 py-2.5 font-semibold">City</th>
            <th scope="col" className="px-4 py-2.5 font-semibold">KYC checks</th>
            <th scope="col" className="px-4 py-2.5 font-semibold">Vacation</th>
            <th scope="col" className="px-4 py-2.5 font-semibold">Joined</th>
            <th scope="col" className="px-4 py-2.5 font-semibold">
              <span className="sr-only">Details</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {sellers.map((seller) => (
            <tr key={seller.id} className="border-b border-line/70 last:border-0 hover:bg-tint/60">
              <td className="px-4 py-3">
                <span className="block font-semibold">{seller.storeName}</span>
                <span className="block font-mono text-[11px] text-muted">{seller.id}</span>
              </td>
              <td className="px-4 py-3">
                <span className="block">{seller.ownerName}</span>
                <span className="block font-mono text-[11px] text-muted">{seller.ownerUserId}</span>
              </td>
              <td className="px-4 py-3">{seller.city}</td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-1.5">
                  <KycPill label="GST" value={seller.kycGst} />
                  <KycPill label="PAN" value={seller.kycPan} />
                  <KycPill label="Cheque" value={seller.kycCheque} />
                </div>
              </td>
              <td className="px-4 py-3">
                <Pill tone={seller.vacationMode ? "warn" : "neutral"}>
                  {seller.vacationMode ? "On" : "Off"}
                </Pill>
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-muted">{joined(seller.createdAt)}</td>
              <td className="px-4 py-3 text-right">
                <Link
                  href={`/admin/sellers/${seller.id}`}
                  className="inline-flex min-h-8 items-center rounded-lg border border-line bg-panel px-3 text-[13px] font-semibold hover:bg-tint"
                >
                  View details
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
