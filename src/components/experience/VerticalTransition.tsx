"use client";

import { useEffect, useRef } from "react";
import { domSync } from "@/lib/rig";

// Scene 7. The red panel is the car's wake: its top edge is written every
// frame from the projected position of the car's tail (`--wake`), while the
// timeline widens it (`--side`) until it floods the screen.

export function VerticalBackdrop() {
  const wake = useRef<HTMLDivElement>(null);
  useEffect(() => {
    domSync.wake = wake.current;
    return () => {
      domSync.wake = null;
    };
  }, []);
  return (
    <>
      <div className="wake" data-s="wake" ref={wake} aria-hidden="true" />
      <div className="wash" data-s="wash" aria-hidden="true" />
    </>
  );
}

export function VerticalOverlay() {
  return (
    <section className="split-copy" aria-labelledby="split-title">
      <div className="mono eyebrow">
        <span className="mask" data-s="split-line">
          <span>04 — Vector</span>
        </span>
      </div>
      <h2 id="split-title">
        <span className="mask" data-s="split-line">
          <span>The shortest line</span>
        </span>
        <span className="mask" data-s="split-line">
          <span>between two points.</span>
        </span>
      </h2>
      <p>
        <span className="mask" data-s="split-line">
          <span>Drawn straight, and taken quickly.</span>
        </span>
      </p>
    </section>
  );
}
