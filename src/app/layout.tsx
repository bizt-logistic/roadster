import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Michroma } from "next/font/google";
import "./globals.css";
import "./commerce.css";

const michroma = Michroma({ variable: "--font-michroma", weight: "400", subsets: ["latin"], display: "swap" });
const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });
const jetbrains = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"], weight: ["400", "500"], display: "swap" });

export const metadata: Metadata = {
  title: "Roadster ",
  // description:
  //   "An unofficial, scroll-driven WebGL fan concept of the Tesla Roadster: a live technical drawing that becomes a photoreal car. Not affiliated with or endorsed by Tesla.",
  // authors: [{ name: "Philip Ojo Oladeji" }],
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${michroma.variable} ${inter.variable} ${jetbrains.variable}`}>
      <body>{children}</body>
    </html>
  );
}
