import Link from "next/link";

// Header parity port of the storefront prototype's header (sticky dark-nav bar).
// Interactive parts are intentionally absent until their workflows exist (TASK 4.x).
export default function SiteHeader() {
  return (
    <header className="sticky top-0 z-60 bg-nav text-white">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-2 px-4 py-1.5">
        {/* Brand placeholder — neutral wordmark, no final logo invented (D1) */}
        <Link href="/" className="flex items-center gap-2 rounded-lg px-2 py-1.5">
          <span
            aria-hidden="true"
            className="grid h-8 w-8 place-items-center rounded-lg bg-hi font-display text-sm font-bold text-hiink"
          >
            CW
          </span>
          <span className="font-display text-[22px] font-bold tracking-tight">
            Constro&nbsp;Well
          </span>
        </Link>

        <p className="ms-auto hidden px-2 text-sm font-semibold text-[#C9D8EE] sm:inline">
          MVP under construction — storefront lands in Phase&nbsp;1–5
        </p>

        {/* Search placeholder — real search ships with TASK 4.2 */}
        <div
          role="presentation"
          aria-label="Search arriving with the catalogue"
          className="order-last flex h-11 w-full rounded-lg sm:order-none sm:ml-auto sm:flex-1 sm:max-w-xl"
        >
          <span className="hidden flex-1 items-center rounded-l-lg bg-white/85 px-3 text-sm text-ink sm:flex">
            Search cement, TMT bars, tiles, paint…
          </span>
          <span className="grid w-12 place-items-center rounded-r-lg bg-hi font-display text-sm font-bold text-hiink">
            GO
          </span>
        </div>
      </div>
    </header>
  );
}
