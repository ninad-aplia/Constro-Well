// Product image gallery — port of buildgrid-shop.html's `.gal`/`.thumbs`/
// `.galmain` (CSS lines 109-111) and `galleryMain()` (lines 460-464): 3
// thumbnails (product art, key specs, "on site") that swap the main image.
// Client component: thumbnail-click is the only interaction here — pure
// presentation, no business logic, no transaction implied.
//
// Deviation (documented, not a data-fidelity issue): the prototype procedurally
// draws an on-site construction scene (crane, pallet) in raw SVG. That's
// decorative illustration, not product data, so it's simplified here to a
// gradient backdrop with the category icon overlaid — same visual idea
// (specs card + "on site" scene + product art), without reproducing the
// elaborate generated drawing.
"use client";

import { useState } from "react";

const THUMB_LABELS = ["Product", "Specs", "On site"];

export default function ProductGallery({
  art,
  hue,
  specs,
  brand,
  unit,
  category,
}: {
  art: string;
  hue: string;
  specs: string[];
  brand: string;
  unit: string;
  category: string;
}) {
  const [active, setActive] = useState(0);
  const tint = {
    backgroundImage: `linear-gradient(160deg, var(--tint), color-mix(in srgb, ${hue} 22%, var(--tint)))`,
  };

  return (
    <section aria-label="Product images" className="flex gap-2.5 self-start md:sticky md:top-[130px]">
      <div className="grid content-start gap-2">
        {THUMB_LABELS.map((label, i) => (
          <button
            key={label}
            type="button"
            onClick={() => setActive(i)}
            aria-label={`Image ${i + 1}: ${label}`}
            aria-current={active === i}
            className={`grid h-14 w-14 flex-none place-items-center overflow-hidden rounded-lg border-2 ${
              active === i ? "border-hi2" : "border-line"
            }`}
          >
            {i === 0 ? (
              <span className="grid h-full w-full place-items-center" style={tint}>
                <svg viewBox="0 0 120 80" aria-hidden="true" className="w-11" dangerouslySetInnerHTML={{ __html: art }} />
              </span>
            ) : (
              <span className="grid h-full w-full place-items-center bg-nav text-[11px] font-bold text-white">
                {label}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="aspect-[4/3] flex-1 overflow-hidden rounded-xl border border-line">
        {active === 0 && (
          <div className="grid h-full place-items-center" style={tint}>
            <svg viewBox="0 0 120 80" aria-hidden="true" className="w-2/3" dangerouslySetInnerHTML={{ __html: art }} />
          </div>
        )}
        {active === 1 && (
          <div className="grid h-full grid-rows-[auto_1fr_auto] gap-2 bg-nav p-5 text-white">
            <p className="font-display text-sm font-bold text-hi">KEY SPECIFICATIONS</p>
            <ul className="grid auto-rows-min gap-2 text-sm">
              {specs.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
            <p className="text-xs text-[#9FB6D6]">
              {brand} · {unit}
            </p>
          </div>
        )}
        {active === 2 && (
          <div className="relative grid h-full place-items-center bg-gradient-to-br from-[#102B52] to-[#091A33]">
            <span className="w-2/5 opacity-90">
              <svg viewBox="0 0 120 80" aria-hidden="true" dangerouslySetInnerHTML={{ __html: art }} />
            </span>
            <span className="absolute bottom-3 left-3 text-xs font-semibold text-white/70">
              {category} on a construction site
            </span>
          </div>
        )}
      </div>
    </section>
  );
}
