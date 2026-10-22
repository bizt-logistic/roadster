"use client";

import { useEffect, useRef } from "react";
import { domSync } from "@/lib/rig";

// Scenes 5 & 6.
//   Motion: a viewfinder frame and numbered captions accompany the
//   scroll-linked camera choreography (rear → profile → ¾ → plan).
//   Showcase: three DOM panels whose rectangles are driven by the render
//   loop; WebGL renders one camera into each via scissored viewports.

const CAPTIONS = [
  { n: "01", title: "Rear elevation", meta: "Az −90° · El 7°" },
  { n: "02", title: "Side profile", meta: "Az 180° · El 4°" },
  { n: "03", title: "Three-quarter", meta: "Az 138° · El 13°" },
  { n: "04", title: "Plan view", meta: "El 89° · Top-down" },
];

export function MotionOverlay() {
  return (
    <section aria-label="Camera study">
      <div className="viewfinder" data-s="viewfinder" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
        <span className="viewfinder__cross" />
        <span className="viewfinder__rec mono">Camera study</span>
      </div>
      {CAPTIONS.map((c) => (
        <div className="caption" data-s="caption" key={c.n}>
          <span className="caption__num">{c.n}</span>
          <div>
            <div className="caption__meta mono">{c.meta}</div>
            <div className="caption__title">{c.title}</div>
          </div>
        </div>
      ))}
    </section>
  );
}

const PANELS = [
  { label: "Plan", idx: "A" },
  { label: "Front three-quarter", idx: "B" },
  { label: "Rear three-quarter", idx: "C" },
];

export function ShowcasePanels() {
  const refs = useRef<(HTMLDivElement | null)[]>([]);
  useEffect(() => {
    domSync.panels = refs.current.filter(Boolean) as HTMLElement[];
    return () => {
      domSync.panels = [];
    };
  }, []);
  return (
    <>
      {PANELS.map((p, i) => (
        <div
          key={p.idx}
          className={`panel panel--${i}`}
          ref={(el) => {
            refs.current[i] = el;
          }}
          aria-hidden="true"
        >
          <div className="panel__label mono" data-s="panel-label">
            <span>{p.label}</span>
            <span>{p.idx}</span>
          </div>
        </div>
      ))}
    </>
  );
}

export function ShowcaseOverlay() {
  return (
    <section className="showcase-head" aria-labelledby="showcase-title">
      <div className="mono eyebrow" style={{ margin: 0 }}>
        <span className="mask" data-s="showcase-head">
          <span>03 · Perspectives</span>
        </span>
      </div>
      <h2 id="showcase-title">
        <span className="mask" data-s="showcase-head">
          <span>One machine, every angle.</span>
        </span>
      </h2>
    </section>
  );
}
