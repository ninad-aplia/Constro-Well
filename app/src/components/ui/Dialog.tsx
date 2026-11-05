// Dialog — thin wrapper around the native <dialog> with prototype styling
// (borderless, 16px radius, backdrop in globals.css). Focus handling and
// Escape come from the platform; callers render their own X button if needed.
"use client";

import { useEffect, useRef } from "react";

export default function Dialog({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  /** seller prototype uses 520px dialogs; default is the shop's 440px */
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    const stop = (e: Event) => {
      e.preventDefault(); // let `open` state own the dialog, Escape applies via onClose below
      onClose();
    };
    d.addEventListener("cancel", stop);
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
    return () => d.removeEventListener("cancel", stop);
  }, [open, onClose]);

  return (
    <dialog
      ref={ref}
      aria-label={title}
      className={`rounded-2xl bg-panel text-ink shadow-card ${wide ? "w-[min(520px,calc(100vw-24px))]" : "w-[min(440px,calc(100vw-24px))]"}`}
      style={{ maxHeight: "calc(100vh - 32px)" }}
    >
      {children}
    </dialog>
  );
}
