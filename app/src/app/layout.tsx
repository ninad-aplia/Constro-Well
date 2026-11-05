import type { Metadata } from "next";
import { Bricolage_Grotesque, Figtree } from "next/font/google";
import "./globals.css";
import SiteHeader from "@/components/ui/SiteHeader";
import SiteFooter from "@/components/ui/SiteFooter";
import ToastProvider from "@/components/ui/Toast";

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
          <SiteHeader />
          <main id="app" className="flex-1" tabIndex={-1}>
            {children}
          </main>
          <SiteFooter />
        </ToastProvider>
      </body>
    </html>
  );
}
