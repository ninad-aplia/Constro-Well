// Guest sign-in home tile — port of buildgrid-shop.html's `.tile.signin`
// section (line 411, guest branch). No auth backend exists yet (TASK 3.1 not
// started), so this always renders the guest state — never a fabricated
// signed-in user or cart count. `/login` and `/register` are forward
// references: the routes don't exist yet, same pattern as `/search` and
// `/product/[id]` elsewhere on this page.
import Link from "next/link";
import Card from "@/components/ui/Card";

export default function SignInTile() {
  return (
    <Card className="flex flex-col gap-2.5 p-[18px]">
      <h2 className="font-display text-xl font-bold">
        Sign in for the best experience
      </h2>
      <p className="text-muted">
        Save your cart, track orders and check out faster.
      </p>
      <Link
        href="/login"
        className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-full bg-hi px-[18px] font-semibold whitespace-nowrap text-hiink hover:bg-hi2"
      >
        Sign in securely
      </Link>
      <Link
        href="/register"
        className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-full border border-line bg-panel px-[18px] font-semibold whitespace-nowrap text-ink hover:bg-tint"
      >
        Create an account
      </Link>
    </Card>
  );
}
