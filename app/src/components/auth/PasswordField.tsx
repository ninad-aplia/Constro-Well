"use client";

import { useState } from "react";

export default function PasswordField({
  id,
  label,
  value,
  onChange,
  error,
  autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  autoComplete: "current-password" | "new-password";
}) {
  const [visible, setVisible] = useState(false);

  return (
    <label htmlFor={id} className="grid gap-1 text-sm font-semibold">
      {label}
      <span className="relative block">
        <input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          autoComplete={autoComplete}
          onChange={(event) => onChange(event.target.value)}
          className="h-11 w-full rounded-lg border border-line bg-panel px-3 pr-16 text-ink"
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? "Hide password" : "Show password"}
          className="absolute top-1/2 right-2 -translate-y-1/2 rounded-md px-2 py-1 text-[13px] font-semibold text-link hover:bg-tint"
        >
          {visible ? "Hide" : "Show"}
        </button>
      </span>
      {error && <span className="text-[13px] font-medium text-bad">{error}</span>}
    </label>
  );
}
