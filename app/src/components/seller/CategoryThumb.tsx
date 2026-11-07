// Product category thumbnail — port of buildgrid-seller-dashboard.html's
// `THUMB` map + `thumb()` (lines 123-124).
const THUMB: Record<string, string> = {
  Cement:
    '<rect x="36" y="12" width="48" height="58" rx="6" fill="#8793A8"/><rect x="36" y="12" width="48" height="13" rx="6" fill="#6C7890"/><rect x="43" y="33" width="34" height="20" rx="3" fill="#FFC72C"/>',
  White:
    '<rect x="36" y="12" width="48" height="58" rx="6" fill="#E3E8EF" stroke="#9AA6B8"/><rect x="36" y="12" width="48" height="13" rx="6" fill="#C9D1DC"/><rect x="43" y="33" width="34" height="20" rx="3" fill="#7A47C8"/>',
  Mortar:
    '<rect x="36" y="12" width="48" height="58" rx="6" fill="#B7893F"/><rect x="36" y="12" width="48" height="13" rx="6" fill="#8F6A2D"/><rect x="43" y="33" width="34" height="20" rx="3" fill="#fff"/>',
  Steel:
    '<g stroke-linecap="round"><path d="M14 22h92M10 34h96M16 46h92M12 58h92" stroke="#51607A" stroke-width="7"/></g>',
  Sand: '<path d="M6 68L46 26Q60 12 74 26L114 68z" fill="#E2B04A"/><path d="M60 14L114 68H72z" fill="#C98F2B"/>',
  Bricks:
    '<g fill="#C2553A"><rect x="14" y="14" width="40" height="16" rx="2"/><rect x="58" y="14" width="40" height="16" rx="2"/><rect x="30" y="34" width="40" height="16" rx="2"/><rect x="74" y="34" width="34" height="16" rx="2"/><rect x="14" y="54" width="40" height="16" rx="2"/><rect x="58" y="54" width="40" height="16" rx="2"/></g>',
};

export default function CategoryThumb({ category }: { category: string }) {
  return (
    <span className="grid h-9 w-11 flex-none place-items-center overflow-hidden rounded-lg bg-tint">
      <svg viewBox="0 0 120 80" aria-hidden="true" className="w-[34px]" dangerouslySetInnerHTML={{ __html: THUMB[category] || THUMB.Cement }} />
    </span>
  );
}
