import type { Metadata, Viewport } from "next";
import {
  Inter,
  Noto_Sans_Arabic,
  Noto_Sans_Bengali,
  Noto_Sans_Devanagari,
  Noto_Sans_Kannada,
  Noto_Sans_Malayalam,
  Noto_Sans_Tamil,
  Noto_Sans_Telugu,
} from "next/font/google";
import "./globals.css";
import { I18nProvider } from "@/i18n";
import { ThemeProvider, themeInitScript } from "@/components/ThemeProvider";
import { NavBar } from "@/components/NavBar";
import { Footer } from "@/components/Footer";
import { AlertCenter } from "@/components/AlertCenter";

// Fonts are self-hosted by Next.js at build time. Script fonts are not
// preloaded: the browser only downloads them when that script is on screen
// (unicode-range), so English users never pay for them.
// (next/font requires literal options in each call.)
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const tamil = Noto_Sans_Tamil({ weight: ["400", "600", "700"], display: "swap", preload: false, subsets: ["tamil"], variable: "--font-ta" });
const deva = Noto_Sans_Devanagari({ weight: ["400", "600", "700"], display: "swap", preload: false, subsets: ["devanagari"], variable: "--font-deva" });
const telugu = Noto_Sans_Telugu({ weight: ["400", "600", "700"], display: "swap", preload: false, subsets: ["telugu"], variable: "--font-te" });
const kannada = Noto_Sans_Kannada({ weight: ["400", "600", "700"], display: "swap", preload: false, subsets: ["kannada"], variable: "--font-kn" });
const malayalam = Noto_Sans_Malayalam({ weight: ["400", "600", "700"], display: "swap", preload: false, subsets: ["malayalam"], variable: "--font-ml" });
const bengali = Noto_Sans_Bengali({ weight: ["400", "600", "700"], display: "swap", preload: false, subsets: ["bengali"], variable: "--font-bn" });
const arabic = Noto_Sans_Arabic({ weight: ["400", "600", "700"], display: "swap", preload: false, subsets: ["arabic"], variable: "--font-ar" });

const fontVars = [inter, tamil, deva, telugu, kannada, malayalam, bengali, arabic].map((f) => f.variable).join(" ");

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: { default: "SkyFare - Fly smart. Pay less.", template: "%s | SkyFare" },
  description:
    "SkyFare is a smart flight ticket booking tracker demo: find the cheapest flights, see a fare calendar, get ML price predictions (book now or wait), track prices and mock-book tickets in 11 languages with voice search.",
  applicationName: "SkyFare",
  keywords: ["flights", "cheap flights", "fare prediction", "price tracker", "machine learning", "Next.js demo"],
  openGraph: {
    title: "SkyFare - Fly smart. Pay less.",
    description: "Find the cheapest flights and know when to book. A demo with ML fare predictions, budget mode, price alerts and voice search.",
    images: ["/images/hero/sky-wing.jpg"],
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f0f9ff" },
    { media: "(prefers-color-scheme: dark)", color: "#020617" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning className={fontVars}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-dvh">
        <ThemeProvider>
          <I18nProvider>
            <div className="flex min-h-dvh flex-col">
              <NavBar />
              <main id="main" className="flex-1">
                {children}
              </main>
              <Footer />
            </div>
            <AlertCenter />
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
