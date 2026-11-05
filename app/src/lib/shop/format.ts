// Pure money/display helpers, ported from buildgrid-shop.html (`fmt`, `inr`).
export const fmt = (n: number) => Math.round(n).toLocaleString("en-IN");
export const inr = (n: number) => "₹" + fmt(n);
