import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter, JetBrains_Mono, Michroma } from "next/font/google";
import "./globals.css";

const inter = Inter({ variable: "--font-text", subsets: ["latin"], display: "swap" });
const mono = JetBrains_Mono({ variable: "--font-mono", subsets: ["latin"], weight: ["400", "500", "600"], display: "swap" });
const display = Michroma({ variable: "--font-display", weight: "400", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "Roadster Admin",
  description: "Admin dashboard for the Roadster concept (test networks).",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable} ${display.variable}`}>
      <body className="adm">{children}</body>
    </html>
  );
}
