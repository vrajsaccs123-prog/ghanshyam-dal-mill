import type { Metadata, Viewport } from "next";
import { Instrument_Serif, Inter } from "next/font/google";
import Script from "next/script";
import { Header } from "@/components/Header";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const display = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-display-serif",
});

export const metadata: Metadata = {
  title: {
    default: "Ghanshyam Dal Mill — Daily Rates",
    template: "%s — Ghanshyam Dal Mill",
  },
  description:
    "Daily selling rates from Ghanshyam Dal Mill for chana dal, masoor, moong, matar, besan, and daliya.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const dynamic = "force-dynamic";

const themeScript = `
try {
  var theme = localStorage.getItem("theme");
  if (theme === "light" || theme === "dark") {
    document.documentElement.setAttribute("data-theme", theme);
  }
} catch (e) {}
`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${display.variable}`}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <body>
        <Script id="theme-init" strategy="beforeInteractive">
          {themeScript}
        </Script>
        <a className="skip" href="#rates">
          Skip to rates
        </a>
        <div className="page">
          <Header />
          <div className="main">{children}</div>
        </div>
      </body>
    </html>
  );
}
