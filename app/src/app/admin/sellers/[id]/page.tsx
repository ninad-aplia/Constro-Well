// Admin > Seller detail. Read-only: store profile, owner, stored KYC flags and
// the bounded seller-scoped admin activity. No approval/mutation controls.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import Link from "next/link";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/server/auth/session";
import AdminNotice from "@/components/admin/AdminNotice";
import Card from "@/components/ui/Card";
import Pill from "@/components/ui/Pill";
import { formatAuditTime } from "@/lib/admin/activity";
import { formatDateOnly, kycLabel, kycTone, sellerDetailError } from "@/lib/admin/sellers";
import {
  AdminApiUnavailableError,
  fetchAdminSeller,
  type AdminSellerDetail,
} from "@/lib/api/adminApi";

export const instant = false;

type Outcome =
  | { kind: "ok"; data: AdminSellerDetail }
  | { kind: "unconfigured" }
  | { kind: "unauthorized" }
  | { kind: "forbidden" }
  | { kind: "not-found" }
  | { kind: "failed" };

async function loadSeller(id: string): Promise<Outcome> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return { kind: "unauthorized" };
  try {
    return { kind: "ok", data: await fetchAdminSeller(id, `${SESSION_COOKIE}=${token}`) };
  } catch (error) {
    if (error instanceof AdminApiUnavailableError) return { kind: "unconfigured" };
    return { kind: sellerDetailError(error) };
  }
}

// Request-scoped memoisation: generateMetadata and the page share one FastAPI
// call (hence one audited read per page view).
const loadSellerCached = cache(loadSeller);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const outcome = await loadSellerCached(id);
  // Resolving metadata happens before the streamed shell, so this yields a real
  // HTTP 404 instead of a soft 200 for unknown sellers.
  if (outcome.kind === "not-found") notFound();
  return {
    title:
      outcome.kind === "ok"
        ? `${outcome.data.seller.storeName} — Admin — Constro Well`
        : "Seller detail — Admin — Constro Well",
  };
}

function BackLink() {
  return (
    <Link
      href="/admin/sellers"
      className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-line bg-panel px-3 text-[13px] font-semibold hover:bg-tint"
    >
      ← Back to sellers
    </Link>
  );
}

function KycRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line/70 py-2 last:border-0">
      <span className="text-sm text-muted">{label}</span>
      <Pill tone={kycTone(value)}>{kycLabel(value)}</Pill>
    </div>
  );
}

export default async function AdminSellerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const outcome = await loadSellerCached(id);
  if (outcome.kind === "not-found") notFound();

  if (outcome.kind !== "ok") {
    const copy = {
      unconfigured: {
        title: "Admin service is not configured",
        body: "Set FASTAPI_BASE_URL on the server to connect the admin console. No fallback data is shown.",
      },
      unauthorized: {
        title: "Sign in required",
        body: "Your admin session has expired. Sign in again to view this seller.",
      },
      forbidden: {
        title: "Administrator access required",
        body: "This account is not allowed to view seller details.",
      },
      failed: {
        title: "Seller couldn't load",
        body: "The admin service is unavailable right now. Try again in a moment.",
      },
    }[outcome.kind];

    return (
      <div className="grid gap-4">
        <div>
          <BackLink />
        </div>
        <AdminNotice
          title={copy.title}
          body={copy.body}
          action={
            outcome.kind === "unauthorized" ? (
              <Link
                href="/login?next=/admin"
                className="mt-1 inline-flex min-h-9 items-center rounded-lg border border-line bg-panel px-3 text-[13px] font-semibold hover:bg-tint"
              >
                Sign in
              </Link>
            ) : outcome.kind === "failed" ? (
              <Link
                href={`/admin/sellers/${encodeURIComponent(id)}`}
                className="mt-1 inline-flex min-h-9 items-center rounded-lg border border-line bg-panel px-3 text-[13px] font-semibold hover:bg-tint"
              >
                Try again
              </Link>
            ) : undefined
          }
        />
      </div>
    );
  }

  const { seller, owner, auditHistory } = outcome.data;

  return (
    <div className="grid gap-4">
      <div>
        <BackLink />
      </div>

      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="font-display text-2xl font-bold">{seller.storeName}</h1>
          <p className="text-sm text-muted">
            Seller <span className="font-mono text-xs">{seller.id}</span> · {seller.city}
          </p>
        </div>
      </header>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Card className="p-[18px]">
          <h2 className="mb-2 font-display text-lg font-bold">Seller profile</h2>
          <dl className="grid grid-cols-[130px_1fr] gap-x-3 gap-y-1.5 text-sm">
            <dt className="text-muted">Store name</dt>
            <dd className="font-semibold">{seller.storeName}</dd>
            <dt className="text-muted">Seller ID</dt>
            <dd className="font-mono text-xs">{seller.id}</dd>
            <dt className="text-muted">City</dt>
            <dd>{seller.city}</dd>
            <dt className="text-muted">Business phone</dt>
            <dd>{seller.phone}</dd>
            <dt className="text-muted">Account created</dt>
            <dd>{formatDateOnly(seller.createdAt)}</dd>
            <dt className="text-muted">Vacation mode</dt>
            <dd>
              <Pill tone={seller.vacationMode ? "warn" : "neutral"}>
                {seller.vacationMode ? "On" : "Off"}
              </Pill>
            </dd>
          </dl>
        </Card>

        <Card className="p-[18px]">
          <h2 className="mb-2 font-display text-lg font-bold">Owner account</h2>
          <dl className="grid grid-cols-[130px_1fr] gap-x-3 gap-y-1.5 text-sm">
            <dt className="text-muted">Name</dt>
            <dd className="font-semibold">{owner.name}</dd>
            <dt className="text-muted">User ID</dt>
            <dd className="font-mono text-xs">{owner.id}</dd>
            <dt className="text-muted">Email</dt>
            <dd className="break-all">{owner.email}</dd>
            <dt className="text-muted">Account created</dt>
            <dd>{formatDateOnly(owner.createdAt)}</dd>
          </dl>
        </Card>

        <Card className="p-[18px]">
          <h2 className="mb-1 font-display text-lg font-bold">KYC checks</h2>
          <p className="mb-2 text-xs text-muted">
            Stored verification flags only. No documents or decisions are stored in this
            system yet.
          </p>
          <KycRow label="GST" value={seller.kycGst} />
          <KycRow label="PAN" value={seller.kycPan} />
          <KycRow label="Cancelled cheque" value={seller.kycCheque} />
        </Card>

        <Card className="p-[18px]">
          <h2 className="mb-1 font-display text-lg font-bold">Recorded admin activity</h2>
          <p className="mb-2 text-xs text-muted">
            Only actions recorded against this seller are shown; list views and activity from
            before this feature are not included. This is not a complete business history.
          </p>
          {auditHistory.length === 0 ? (
            <p className="text-sm text-muted">No seller-scoped admin activity recorded yet.</p>
          ) : (
            <ul className="grid gap-2">
              {auditHistory.map((event) => (
                <li key={event.id} className="border-b border-line/70 pb-2 last:border-0 last:pb-0">
                  <span className="block text-sm font-semibold">{event.action}</span>
                  <span className="block text-xs text-muted">
                    {event.actor.name} · {formatAuditTime(event.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
