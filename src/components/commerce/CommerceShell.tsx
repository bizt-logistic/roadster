import type { ReactNode } from "react";

export const CREDIT = "Concept design & development by Philip Ojo Oladeji";
export const DISCLAIMER = "Unofficial concept · Not affiliated with Tesla, Inc.";

export function CommerceShell({ children, active }: { children: ReactNode; active: "reserve" | "invest" | "gallery" | "drive" }) {
  return (
    <div className="shop">
      <header className="shop__nav">
        {/* plain anchors: a full page load keeps the 3D experience's state fresh */}
        <a className="shop__brand" href="/">
          ROADSTER
        </a>
        <nav aria-label="Primary">
          <a href="/">Experience</a>
          <a href="/gallery" aria-current={active === "gallery" ? "page" : undefined}>
            Gallery
          </a>
          <a href="/test-drive" aria-current={active === "drive" ? "page" : undefined}>
            Test drive
          </a>
          <a href="/reserve" aria-current={active === "reserve" ? "page" : undefined}>
            Reserve
          </a>
          <a href="/invest" aria-current={active === "invest" ? "page" : undefined}>
            Invest &amp; partner
          </a>
        </nav>
      </header>
      <main className="shop__main">{children}</main>
      <footer className="shop__footer">
        <span>
          <strong>{CREDIT}</strong>
        </span>
        <span>{DISCLAIMER}</span>
        <span>Vehicle figures as reported from the 15 Oct 2026 reveal (Tesla claims, subject to change). Payments run on test networks.</span>
      </footer>
    </div>
  );
}
