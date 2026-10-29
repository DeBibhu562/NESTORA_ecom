import type { Metadata, Viewport } from "next";
import { Figtree, Fraunces } from "next/font/google";
import { CartDrawer } from "@/components/CartDrawer";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { BRAND, SITE_URL } from "@/lib/api";
import { AuthProvider } from "@/lib/auth";
import { CartProvider } from "@/lib/cart";
import "./globals.css";

const figtree = Figtree({ subsets: ["latin"], variable: "--font-figtree", display: "swap" });
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", display: "swap" });

export const metadata: Metadata = { metadataBase: new URL(SITE_URL), title: { default: BRAND, template: `%s | ${BRAND}` }, description: `${BRAND}: everyday drinkware and kitchen essentials.` };
export const viewport: Viewport = { themeColor: "#072835" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${figtree.variable} ${fraunces.variable}`}>
      <body className="flex min-h-screen flex-col">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:p-3">Skip to content</a>
        <AuthProvider>
        <CartProvider>
          <Header />
          <div id="main" className="flex-1">{children}</div>
          <Footer />
          <CartDrawer />
        </CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
