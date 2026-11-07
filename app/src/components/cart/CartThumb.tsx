// Cart line thumbnail (prototype `.cimg` art tile with the category hue
// gradient). Pure markup, usable from client and server components.
import Link from "next/link";

export default function CartThumb({
  hue,
  art,
  label,
  href,
}: {
  hue: string;
  art: string;
  label: string;
  href?: string;
}) {
  const tile = (
    <span
      aria-hidden="true"
      className="block h-full w-full"
      style={{ backgroundImage: `linear-gradient(160deg, var(--tint), color-mix(in srgb, ${hue} 22%, var(--tint)))` }}
    >
      <svg viewBox="0 0 120 80" className="mx-auto block h-full w-full max-h-[80px]">
        <g dangerouslySetInnerHTML={{ __html: art }} />
      </svg>
    </span>
  );
  if (!href) {
    return (
      <span className="block h-[72px] w-[72px] flex-none overflow-hidden rounded-lg border border-line">
        {tile}
      </span>
    );
  }
  return (
    <Link
      href={href}
      aria-label={label}
      className="block h-[72px] w-[72px] flex-none overflow-hidden rounded-lg border border-line"
    >
      {tile}
    </Link>
  );
}
