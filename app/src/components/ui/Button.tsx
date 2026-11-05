import type { ButtonHTMLAttributes, ReactNode } from "react";

/**
 * Button — port of the prototype `.btn` component.
 * Shop prototype uses pill-shaped buttons (border-radius 20px)... the seller
 * hub and delivery prototypes use 10px corners. `pill` selects the shop shape.
 * Variants/sizes mirror `.btn.yellow/.orange/.line/.dark/.red`, `.btn.sm`, `.btn.wide`.
 */
const variants = {
  yellow: "bg-hi text-hiink hover:bg-hi2",
  orange: "bg-or text-[#1F0F00] hover:brightness-95",
  line: "border border-line bg-panel hover:bg-tint",
  dark: "bg-nav text-white hover:brightness-110",
  red: "bg-bad text-white hover:brightness-110",
  ghost: "text-link hover:underline",
} as const;

const shapes = {
  rounded: "rounded-[10px]",
  pill: "rounded-full",
} as const;

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variants;
  size?: "md" | "sm";
  wide?: boolean;
  pill?: boolean;
  icon?: ReactNode;
};

export default function Button({
  variant = "yellow",
  size,
  wide,
  pill,
  icon,
  className,
  type = "button",
  children,
  ...rest
}: ButtonProps) {
  const cls = [
    "inline-flex items-center justify-center gap-2 font-semibold whitespace-nowrap select-none",
    size === "sm" ? "min-h-8 rounded-lg px-3 text-[13px]" : "min-h-10 px-[18px]",
    shapes[pill ? "pill" : "rounded"],
    variants[variant],
    wide ? "w-full" : "",
    "disabled:opacity-50 disabled:pointer-events-none",
    className ?? "",
  ].join(" ");

  return (
    <button type={type} className={cls} {...rest}>
      {icon}
      {children}
    </button>
  );
}
