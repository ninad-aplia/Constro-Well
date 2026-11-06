// Horizontal scroll container + prev/next controls — port of
// buildgrid-shop.html's `.scroller`/`.sc` CSS (lines 84-85) and the `scroll`
// action (line 692): scrollBy 85% of the visible width per click, respecting
// prefers-reduced-motion. Client component: genuine scroll interaction is the
// only reason this isn't server-rendered — card content itself stays server.
"use client";

import { useRef, type ReactNode } from "react";

export default function ScrollerRow({ children }: { children: ReactNode }) {
  const trackRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 1 | -1) => {
    const el = trackRef.current;
    if (!el) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: direction * el.clientWidth * 0.85, behavior: reduceMotion ? "auto" : "smooth" });
  };

  return (
    <div className="relative">
      <div
        ref={trackRef}
        className="flex snap-x snap-proximity gap-3.5 overflow-x-auto pt-0.5 pb-3.5 [scrollbar-width:thin]"
      >
        {children}
      </div>
      <button
        type="button"
        onClick={() => scroll(-1)}
        aria-label="Scroll left"
        className="absolute top-[42%] left-1 z-10 grid h-[84px] w-[42px] place-items-center rounded-lg border border-line bg-panel shadow-card"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M15 6l-6 6 6 6" />
        </svg>
      </button>
      <button
        type="button"
        onClick={() => scroll(1)}
        aria-label="Scroll right"
        className="absolute top-[42%] right-1 z-10 grid h-[84px] w-[42px] place-items-center rounded-lg border border-line bg-panel shadow-card"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M9 6l6 6-6 6" />
        </svg>
      </button>
    </div>
  );
}
