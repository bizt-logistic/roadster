"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/", label: "Overview" },
  { href: "/requests", label: "Payment requests" },
  { href: "/orders", label: "Reservations" },
  { href: "/test-drives", label: "Test drives" },
  { href: "/pricing", label: "Pricing & offers" },
  { href: "/payments", label: "Wallets & banks" },
  { href: "/emails", label: "Emails" },
  { href: "/investors", label: "Investor leads" },
];

/** counts: badge numbers keyed by href (payments to review, today's drives). */
export function AdminNav({ counts }: { counts: Record<string, number> }) {
  const path = usePathname();
  return (
    <nav className="adm-nav" aria-label="Admin">
      {ITEMS.map((it) => {
        const active = it.href === "/" ? path === "/" : path.startsWith(it.href);
        const n = counts[it.href] ?? 0;
        return (
          <Link key={it.href} href={it.href} aria-current={active ? "page" : undefined}>
            {it.label}
            {n > 0 && <span className="adm-count">{n}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
