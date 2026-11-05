// Card — matches prototype `.card` (panel bg, 1px line border, 12px radius).
// Portals with 14px corners (seller/delivery prototype) can pass rounded="lg".
const rounding = { md: "rounded-xl", lg: "rounded-[14px]" } as const;

export default function Card({
  rounded = "md",
  className,
  ...rest
}: React.ComponentPropsWithoutRef<"div"> & { rounded?: "md" | "lg" }) {
  return (
    <div className={`${rounding[rounded]} border border-line bg-panel ${className ?? ""}`} {...rest} />
  );
}
