import type { Metadata } from "next";
import { Bricolage_Grotesque, Figtree } from "next/font/google";
import "./globals.css";
import ToastProvider from "@/components/ui/Toast";
import PortalChrome from "@/components/layout/PortalChrome";
import { CartProvider } from "@/components/cart";

// Fonts from the storefront prototype: Figtree (body), Bricolage Grotesque (display).
const body = Figtree({
  variable: "--font-body",
  subsets: ["latin"],
});

const disp = Bricolage_Grotesque({
  variable: "--font-disp",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Constro Well: building materials online",
    template: "%s | Constro Well",
  },
  description:
    "Construction materials marketplace MVP — cement, TMT bars, tiles, paint and more from verified sellers.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${body.variable} ${disp.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <a className="skip" href="#app">
          Skip to main content
        </a>
        <ToastProvider>
          <CartProvider>
            <PortalChrome>{children}</PortalChrome>
          </CartProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
