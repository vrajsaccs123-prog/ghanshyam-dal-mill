import type { Metadata, Viewport } from "next";
import { DM_Sans, Playfair_Display } from "next/font/google";
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

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable}`} data-scroll-behavior="smooth">
      <body>
        <div className="page">
          <Header />
          <div className="main">{children}</div>
        </div>
      </body>
    </html>
  );
}
