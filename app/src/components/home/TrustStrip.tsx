// Trust strip — port of buildgrid-shop.html's `.trust` section (line 416) and
// CSS (lines 81, 157: 4 columns desktop, 2 columns at <=900px). Static server
// component — no mock data, no API facade needed.
//
// Deviation (D3/D13, owner-approved 2026-11-07): the prototype's fourth block
// advertises "Secure payments — UPI, cards, net banking and COD", but the
// approved MVP is COD-only (D3); other payment UI stays hidden until a
// gateway is approved. Advertising payment methods this app cannot process
// would be a false trust claim, so this block is replaced with the lock icon
// over "Cash on delivery" / "Cash on delivery for orders up to ₹50,000."
// (the approved D4 order cap). The other three blocks are unchanged.
import Card from "@/components/ui/Card";

const BLOCKS = [
  {
    heading: "Delivery to site",
    caption: "Free above ₹5,000, trucks tracked to your door",
    icon: (
      <>
        <path d="M2 6h11v10H2zM13 9h5l3 3v4h-8" />
        <circle cx="7" cy="18" r="1.8" />
        <circle cx="17" cy="18" r="1.8" />
      </>
    ),
  },
  {
    heading: "Genuine materials",
    caption: "Verified sellers, ISI and BIS standards",
    icon: (
      <>
        <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />
        <path d="M9 12l2 2 4-4" />
      </>
    ),
  },
  {
    heading: "7-day replacement",
    caption: "For damaged or wrong items",
    icon: (
      <>
        <path d="M3 12a9 9 0 109-9" />
        <path d="M3 4v5h5" />
      </>
    ),
  },
  {
    heading: "Cash on delivery",
    caption: "Cash on delivery for orders up to ₹50,000.",
    icon: (
      <>
        <rect x="5" y="11" width="14" height="10" rx="2" />
        <path d="M8 11V8a4 4 0 018 0v3" />
      </>
    ),
  },
];

export default function TrustStrip() {
  return (
    <Card className="mt-4 grid grid-cols-2 gap-4 p-5 min-[901px]:grid-cols-4">
      {BLOCKS.map(({ heading, caption, icon }) => (
        <div key={heading} className="grid justify-items-start gap-0.5">
          <svg
            width="26"
            height="26"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="text-link"
          >
            {icon}
          </svg>
          <b>{heading}</b>
          <span className="text-[13px] text-muted">{caption}</span>
        </div>
      ))}
    </Card>
  );
}
