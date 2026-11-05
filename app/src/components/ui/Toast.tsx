// Toast — port of the prototype toast: fixed bottom-center, ink background,
// hi-colored action, slide-up fade. Use `ToastProvider` once (root layout)
// and `useToast()` inside client components.
"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

type ToastAction = { label: string; onClick: () => void };
type Toast = { msg: string; action?: ToastAction };
type ToastCtx = { show: (msg: string, action?: ToastAction) => void };

const Ctx = createContext<ToastCtx>({ show: () => {} });
export const useToast = () => useContext(Ctx);

export default function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const [visible, setVisible] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((msg: string, action?: ToastAction) => {
    if (timer.current) clearTimeout(timer.current);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setToast({ msg, action });
    setVisible(true); // first-ever toast mounts visible (no fade); later toasts animate
    timer.current = setTimeout(() => setVisible(false), 3200);
  }, []);

  return (
    <Ctx.Provider value={{ show }}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className={`fixed bottom-6 left-1/2 z-300 flex max-w-[calc(100vw-24px)] -translate-x-1/2 items-center gap-3.5 rounded-xl bg-ink px-[18px] py-[11px] font-semibold text-bg transition-all duration-300 ${
          toast && visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-7 opacity-0"
        }`}
      >
        {toast?.msg ?? ""}
        {toast?.action && (
          <button
            type="button"
            className="whitespace-nowrap font-bold text-hi"
            onClick={() => {
              toast.action?.onClick();
              setVisible(false);
            }}
          >
            {toast.action.label}
          </button>
        )}
      </div>
    </Ctx.Provider>
  );
}
