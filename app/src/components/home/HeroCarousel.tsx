// Hero carousel interaction — port of buildgrid-shop.html's carousel JS
// (`setSlide`, `AFTER.home` autoplay, `car`/`dots` handlers, lines 662-694).
// Receives fully-resolved slide data as props; no mock-data imports here.
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { HeroSlide } from "@/lib/api/catalog";

const AUTOPLAY_MS = 6000;

// Slide field names (`a`/`b` gradient stops, `h` heading, `p` body) mirror the
// prototype's `Slide` shape verbatim (data/catalog.ts) — not renamed here to
// avoid touching the verified data layer.
function slideHref(slide: HeroSlide): string {
  if (slide.deal) return "/search?deal=1";
  if (slide.cat) return `/search?cat=${encodeURIComponent(slide.cat)}`;
  return "/search";
}

export default function HeroCarousel({ slides }: { slides: HeroSlide[] }) {
  const [current, setCurrent] = useState(0);
  const hovered = useRef(false);
  const focused = useRef(false);

  const go = (i: number) => setCurrent(((i % slides.length) + slides.length) % slides.length);

  // One interval for the component's lifetime (matches the prototype: manual
  // nav doesn't reset the 6s cadence, it just skips a tick while paused).
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => {
      if (!hovered.current && !focused.current) {
        setCurrent((c) => (c + 1) % slides.length);
      }
    }, AUTOPLAY_MS);
    return () => clearInterval(id);
  }, [slides.length]);

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Featured offers"
      className="relative overflow-hidden rounded-xl bg-nav h-[min(46vw,440px)] min-h-[400px] max-sm:h-[380px] max-sm:min-h-[380px]"
      onMouseEnter={() => { hovered.current = true; }}
      onMouseLeave={() => { hovered.current = false; }}
      onFocus={() => { focused.current = true; }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          focused.current = false;
        }
      }}
    >
      <div
        className="flex h-full transition-transform duration-700 ease-[cubic-bezier(0.3,0.7,0.2,1)]"
        style={{ transform: `translateX(-${current * 100}%)` }}
      >
        {slides.map((s, i) => (
          <div
            key={i}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${slides.length}`}
            aria-hidden={i === current ? undefined : true}
            className="flex w-full flex-none items-center justify-between gap-5 overflow-hidden px-[max(24px,calc((100%-1400px)/2+64px))] pb-[175px] text-white max-sm:flex-col max-sm:items-start max-sm:justify-center max-sm:px-6 max-sm:pb-[120px] max-sm:pt-5"
            style={{ background: `linear-gradient(120deg, ${s.a}, ${s.b})` }}
          >
            <div className="grid max-w-[520px] justify-items-start gap-3.5">
              <h1 className="text-[clamp(30px,4vw,50px)] leading-[1.02] font-bold tracking-[-0.03em]">
                {s.h}
              </h1>
              <p className="text-[clamp(15px,1.5vw,18px)] text-white/[0.88]">{s.p}</p>
              <Link
                href={slideHref(s)}
                tabIndex={i === current ? 0 : -1}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-hi px-[18px] font-semibold whitespace-nowrap text-hiink hover:bg-hi2"
              >
                {s.cta}
              </Link>
            </div>
            <div className="relative hidden h-full w-[min(40%,480px)] flex-none -mb-[110px] sm:block">
              <span
                className="absolute top-[12%] left-[6%] w-[62%] drop-shadow-[0_18px_24px_rgba(0,0,0,0.3)]"
                dangerouslySetInnerHTML={{ __html: `<svg viewBox="0 0 120 80" aria-hidden="true">${s.art[0]}</svg>` }}
              />
              <span
                className="absolute top-[34%] right-0 w-[52%] drop-shadow-[0_18px_24px_rgba(0,0,0,0.3)]"
                dangerouslySetInnerHTML={{ __html: `<svg viewBox="0 0 120 80" aria-hidden="true">${s.art[1]}</svg>` }}
              />
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => go(current - 1)}
        aria-label="Previous slide"
        className="absolute top-0 left-0 z-10 grid h-[60%] w-14 place-items-center text-white opacity-80 hover:bg-white/10 hover:opacity-100 max-sm:hidden"
      >
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M15 6l-6 6 6 6" />
        </svg>
      </button>
      <button
        type="button"
        onClick={() => go(current + 1)}
        aria-label="Next slide"
        className="absolute top-0 right-0 z-10 grid h-[60%] w-14 place-items-center text-white opacity-80 hover:bg-white/10 hover:opacity-100 max-sm:hidden"
      >
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M9 6l6 6-6 6" />
        </svg>
      </button>

      <div className="absolute bottom-[160px] left-1/2 z-20 flex -translate-x-1/2 gap-2 max-sm:bottom-[100px]">
        {slides.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => go(i)}
            aria-label={`Slide ${i + 1}`}
            aria-current={i === current}
            className={`h-2.5 rounded-full bg-white/[0.45] transition-[width] duration-300 ${i === current ? "w-[26px] bg-hi" : "w-2.5"}`}
          />
        ))}
      </div>
    </section>
  );
}
