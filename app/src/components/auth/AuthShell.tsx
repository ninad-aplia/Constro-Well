import Link from "next/link";
import Card from "@/components/ui/Card";

export default function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto grid max-w-[1100px] gap-5 px-4 py-10 md:grid-cols-[minmax(0,1fr)_440px] md:items-start">
      <section className="hidden rounded-2xl bg-nav p-8 text-white md:block">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-hi font-display text-sm font-bold text-hiink">
            CW
          </span>
          <span className="font-display text-2xl font-bold tracking-tight">Constro Well</span>
        </Link>
        <h1 className="mt-10 font-display text-3xl leading-tight font-bold">
          Build better, buy smarter.
        </h1>
        <p className="mt-3 max-w-[420px] text-[#C9D8EE]">
          Cement, steel, sand, tiles and finishing materials from marketplace
          sellers, with transparent offers and cash on delivery.
        </p>
        <ul className="mt-8 grid gap-3 text-sm text-[#DCE7F5]">
          <li className="flex gap-2.5">
            <span className="mt-1.5 h-2 w-2 flex-none rounded-full bg-hi" />
            One account for orders, tracking and seller tools
          </li>
          <li className="flex gap-2.5">
            <span className="mt-1.5 h-2 w-2 flex-none rounded-full bg-hi" />
            Secure HTTP-only sessions — no passwords in browser storage
          </li>
          <li className="flex gap-2.5">
            <span className="mt-1.5 h-2 w-2 flex-none rounded-full bg-hi" />
            COD-only checkout within the approved order cap
          </li>
        </ul>
      </section>

      <Card className="p-6 sm:p-7">
        <div className="mb-5 md:hidden">
          <Link href="/" className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-hi font-display text-sm font-bold text-hiink">
              CW
            </span>
            <span className="font-display text-xl font-bold">Constro Well</span>
          </Link>
        </div>
        <h1 className="font-display text-2xl font-bold">{title}</h1>
        <p className="mt-1 mb-5 text-sm text-muted">{subtitle}</p>
        {children}
      </Card>
    </div>
  );
}
