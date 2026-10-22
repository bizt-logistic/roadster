"use client";

import { forwardRef, type ReactNode } from "react";
import { useStore } from "@/lib/store";

/** One block of the build sheet: a heading and its line items. */
function Block({ n, title, children }: { n: string; title: string; children: ReactNode }) {
  return (
    <section className="credits__block">
      <h3>
        <span className="mono">{n}</span> {title}
      </h3>
      <ul>{children}</ul>
    </section>
  );
}

export const CreditsDialog = forwardRef<HTMLDialogElement>(function CreditsDialog(_, ref) {
  const source = useStore((s) => s.source);
  return (
    <dialog className="credits" ref={ref} aria-labelledby="credits-title">
      {/* first focusable element, so the panel opens at the top */}
      <form method="dialog" className="credits__x">
        <button type="submit" aria-label="Close credits" autoFocus>
          ×
        </button>
      </form>
      <div className="mono credits__eyebrow">Credits · how it&apos;s built</div>
      <h2 id="credits-title">Roadster, an interactive concept</h2>
      <p className="credits__lead">
        Concept design &amp; development by <strong>Philip Ojo Oladeji</strong>. A cinematic product website, a booking and
        payments platform and a separate admin dashboard, designed and built end to end.
      </p>

      <Block n="01" title="Cinematic experience">
        <li>One scroll-driven master timeline (GSAP ScrollTrigger) choreographs nine scenes, from the white drawing sheet to the smoke finale.</li>
        <li>Lenis smooth scrolling, scrubbed to the timeline, with reduced-motion support throughout.</li>
        <li>Real-time 3D in WebGL with Three.js, React Three Fiber and Drei.</li>
        <li>Custom GLSL shaders: a pen-on-paper line-art drawing, an X-ray anatomy view, fBm volumetric smoke, a baked contact shadow and a studio paint material.</li>
        <li>Wireframe-to-photoreal reveal, camera choreography, a multi-viewport showcase and physically staged stunts (flip, inverted ramp, thruster hop).</li>
      </Block>

      <Block n="02" title="3D model & assets">
        {source === "gltf" ? (
          <li>
            Model:{" "}
            <a href="https://sketchfab.com/3d-models/tesla-roadster-2028-0caed2c3ad1e4dd8ad90b1bb11b23d38" target="_blank" rel="noreferrer">
              “Tesla Roadster (2028).”
            </a>{" "}
            by{" "}
            <a href="https://sketchfab.com/morolucky" target="_blank" rel="noreferrer">
              morolucky
            </a>
            , licensed{" "}
            <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">
              CC BY 4.0
            </a>
            .
          </li>
        ) : (
          <li>Model: procedural concept geometry generated in code for this project.</li>
        )}
        <li>Optimised with glTF-Transform: welded, simplified, Meshopt-compressed geometry and WebP textures.</li>
        <li>Line art, X-ray internals, lighting, shadows and smoke are generated procedurally at runtime.</li>
        <li>Gallery images are studio renders of the same model.</li>
        <li>Typefaces: Michroma, Inter and JetBrains Mono (SIL Open Font License), self-hosted with next/font.</li>
      </Block>

      <Block n="03" title="Commerce & bookings">
        <li>Reservations for each version, paid in full or in 3, 6 or 12 monthly installments.</li>
        <li>Private test drives in European cities with live slot availability, per-car pricing and experience upgrades.</li>
        <li>Checkout add-ons and promo codes; every price is recomputed on the server in US dollars.</li>
        <li>Payments by Bitcoin, Ethereum or bank transfer: the team issues payment details that expire, with BIP-21 / EIP-681 QR codes and a live countdown.</li>
        <li>Testnet-only address validation (bech32 checksums), watch-only wallets and no private keys on the server.</li>
        <li>Meeting-point emails with calendar invites once a test drive is paid (Resend).</li>
      </Block>

      <Block n="04" title="Admin dashboard">
        <li>A separate Next.js app that talks to the site through a token-protected API.</li>
        <li>Live alerts for new payment requests (sound, toast, tab badge, desktop notifications).</li>
        <li>Control over prices, test-drive cities, times and capacity, add-ons, promo codes, wallets and bank accounts.</li>
        <li>Booking management, payment verification, rescheduling, an email outbox and revenue by stream.</li>
      </Block>

      <Block n="05" title="Engineering">
        <li>Next.js 16 (App Router), React 19 and TypeScript; server components and route handlers.</li>
        <li>Data in a JSON store or Supabase (Postgres), switched by configuration.</li>
        <li>Responsive from phone to desktop, keyboard accessible, with reduced-motion fallbacks.</li>
        <li>Tested with headless-browser visual captures and end-to-end API checks.</li>
      </Block>

      <Block n="06" title="Sources & notes">
        <li>
          Figures and stunts are recreated from coverage of the 15 Oct 2026 Roadster reveal (TechCrunch, Teslarati, Wikipedia).
          They are manufacturer claims, not independent measurements. Lineup vehicles are simplified stand-ins.
        </li>
        <li>
          Unofficial concept · not affiliated with Tesla, Inc. Tesla and Roadster are trademarks of Tesla, Inc.; no Tesla
          logos, fonts, imagery or code are used. Payments run on test networks.
        </li>
      </Block>

      <form method="dialog">
        <button className="credits__close" type="submit">
          Close
        </button>
      </form>
    </dialog>
  );
});
