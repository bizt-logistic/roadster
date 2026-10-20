import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./admin.css";

export const metadata: Metadata = {
  title: "Admin — Roadster Concept Demo",
  robots: { index: false, follow: false },
};

export default function AdminRoot({ children }: { children: ReactNode }) {
  return <div className="adm">{children}</div>;
}
