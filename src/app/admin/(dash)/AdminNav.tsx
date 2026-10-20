"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/orders", label: "Reservations" },
  { href: "/admin/payments", label: "Wallets & banks" },
  { href: "/admin/investors", label: "Investor leads" },
];

export function AdminNav({ review }: { review: number }) {
  const path = usePathname();
  return (
    <nav className="adm-nav" aria-label="Admin">
      {ITEMS.map((it) => {
        const active = it.href === "/admin" ? path === "/admin" : path.startsWith(it.href);
        return (
          <Link key={it.href} href={it.href} aria-current={active ? "page" : undefined}>
            {it.label}
            {it.href === "/admin/orders" && review > 0 && <span className="adm-count">{review}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
