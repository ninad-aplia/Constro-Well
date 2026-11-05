// Pill — port of the prototype `.pill` status chip (12px bold, rounded-full).
// `tone` maps to `.pill.ok/.warn/.bad/.info` + the neutral default.
const tones = {
  neutral: "border-line bg-tint text-ink2",
  ok: "border-ok/45 bg-ok/10 text-ok",
  warn: "border-warn/45 bg-warn/10 text-warn",
  bad: "border-bad/45 bg-bad/10 text-bad",
  info: "border-link/45 bg-link/10 text-link",
} as const;

export type PillProps = React.ComponentPropsWithoutRef<"span"> & {
  tone?: keyof typeof tones;
};

export default function Pill({ tone = "neutral", className, children, ...rest }: PillProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-current/0 px-2.5 py-[2px] text-[12px] font-bold whitespace-nowrap ${tones[tone]} ${className ?? ""}`}
      {...rest}
    >
      {children}
    </span>
  );
}
