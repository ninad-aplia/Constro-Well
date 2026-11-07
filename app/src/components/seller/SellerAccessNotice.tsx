import Link from "next/link";
import Card from "@/components/ui/Card";
import LogoutButton from "@/components/auth/LogoutButton";

export default function SellerAccessNotice({
  user,
}: {
  user: { name: string; email: string; role: string };
}) {
  return (
    <div className="mx-auto grid max-w-[760px] justify-items-center px-4 py-16">
      <Card className="w-full p-8">
        <p className="text-xs font-semibold tracking-wide text-muted uppercase">Seller Hub</p>
        <h1 className="mt-1 font-display text-2xl font-bold">Seller account required</h1>
        <p className="mt-2 text-muted">
          You are signed in as <b>{user.name}</b> ({user.email}) with a{" "}
          <b className="capitalize">{user.role}</b> account. The Seller Hub is only
          available to seller accounts.
        </p>
        <p className="mt-2 text-sm text-muted">
          Seller accounts are provisioned by Constro Well; public registration
          creates customer accounts only.
        </p>
        <div className="mt-5 flex flex-wrap gap-2.5">
          <Link
            href="/"
            className="inline-flex min-h-10 items-center justify-center rounded-full bg-hi px-[18px] font-semibold text-hiink hover:bg-hi2"
          >
            Back to store
          </Link>
          <LogoutButton className="inline-flex min-h-10 items-center justify-center rounded-full border border-line bg-panel px-[18px] font-semibold text-ink hover:bg-tint disabled:opacity-60" />
        </div>
      </Card>
    </div>
  );
}
