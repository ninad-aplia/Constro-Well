// Stars — rating display using the prototype's exact CSS-mask gradient
// (see `.stars` in globals.css). Value 0–5; renders aria-labelled image role.
export default function Stars({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  const clamped = Math.min(5, Math.max(0, value));
  return (
    <span
      className={`stars ${className ?? ""}`}
      style={{ "--p": `${(clamped / 5) * 100}%` } as React.CSSProperties}
      role="img"
      aria-label={`${clamped} out of 5 stars`}
    />
  );
}
