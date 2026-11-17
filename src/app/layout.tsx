import type { Metadata, Viewport } from "next";
import { DM_Sans, Playfair_Display } from "next/font/google";
import Script from "next/script";
import { Header } from "@/components/Header";
import "./globals.css";

const sans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
});

const display = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
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
      className={`${sans.variable} ${display.variable}`}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <body>
        <Script id="theme-init" strategy="beforeInteractive">
          {themeScript}
        </Script>
        <div className="page">
          <Header />
          <div className="main">{children}</div>
        </div>
      </body>
    </html>
  );
}
