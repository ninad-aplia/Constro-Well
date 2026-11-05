// Quantity stepper — port of the prototype `.stp` control.
// Presentation only: `min`/`max` limits must come from the caller (they are
// business rules — stock, seller min order). Pass `value`+`onChange` to make
// it controlled; omit `value` for uncontrolled use.
"use client";

import { useState } from "react";
const reduce = (n: number, lo: number, hi: number) =>
  Math.min(Math.max(n, lo), Number.isNaN(Number(hi)) ? Infinity : hi);

export default function Stepper({
  value,
  onChange,
  min = 1,
  max,
  label = "Quantity",
  className,
}: {
  value?: number;
  onChange?: (next: number) => void;
  min?: number;
  max?: number;
  label?: string;
  className?: string;
}) {
  const [internal, setInternal] = useState(value ?? min);
  const controlled = value !== undefined;

  const clamp = (n: number) => {
    const c = reduce(n, min, max ?? Number.MAX_SAFE_INTEGER);
    return c;
  };
  const commit = (n: number) => {
    const c = clamp(n);
    if (!controlled) setInternal(c);
    onChange?.(c);
  };
  const cur = controlled ? clamp(value) : internal;

  return (
    <span className={`inline-flex items-center overflow-hidden rounded-lg border border-line ${className ?? ""}`}>
      <button
        type="button"
        className="grid h-8 w-[29px] place-items-center bg-tint hover:bg-line"
        aria-label={`${label}: decrease`}
        onClick={() => commit(cur - 1)}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14" /></svg>
      </button>
      <input
        type="number"
        className="h-8 w-9 border-0 bg-panel text-center text-[13px] font-semibold [-moz-appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
        min={min}
        max={max ?? undefined}
        value={cur}
        onChange={(e) => onChange?.(clamp(Number(e.target.value) || min))}
        onBlur={(e) => commit(Number(e.target.value) || min)}
        aria-label={label}
      />
      <button
        type="button"
        className="grid h-8 w-[29px] place-items-center bg-tint hover:bg-line"
        aria-label={`${label}: increase`}
        onClick={() => commit(cur + 1)}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
      </button>
    </span>
  );
}
