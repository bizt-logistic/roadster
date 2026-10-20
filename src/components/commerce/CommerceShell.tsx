import type { ReactNode } from "react";

export const CREDIT = "Demo by Philip Ojo Oladeji";
export const DISCLAIMER = "Unofficial Tesla Roadster Fan Concept — Not Affiliated with Tesla.";

export function CommerceShell({ children, active }: { children: ReactNode; active: "reserve" | "invest" | "gallery" }) {
  return (
    <div className="shop">
      {/* <div className="shop__banner" role="note">
        <strong>Concept demo · Test networks</strong> — payments run on Bitcoin testnet and Ethereum Sepolia; no real money moves and no vehicle is sold. {DISCLAIMER}
      </div> */}
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
        {/* <span> */}
          {/* <strong>{CREDIT}</strong>
        </span>
        <span>{DISCLAIMER}</span> */}
        <span>Figures and prices as reported from the 15 Oct 2026 reveal; Tesla claims, subject to change.</span>
      </footer>
    </div>
  );
}
