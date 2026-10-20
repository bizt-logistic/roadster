"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import gsap from "gsap";

// Scene 8. The red wash from scene 7 *is* the inside of the letter T: the
// word starts scaled ~140× around a point inside the T's stem (so the screen
// is solid red), then zooms out until the oversized wordmark sits on white.
// The scale origin is measured from the live glyph metrics, so it stays
// correct for any viewport or font fallback.

const WORD = "ROADSTER";
const T_INDEX = WORD.indexOf("T");

export function TypographyBackdrop() {
  const [size, setSize] = useState({ w: 1440, h: 900 });
  const [fs, setFs] = useState(220);
  const textRef = useRef<SVGTextElement>(null);
  const zoomRef = useRef<SVGGElement>(null);

  useEffect(() => {
    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Fit the word to ~92% of the viewport width once fonts are ready.
  useLayoutEffect(() => {
    let cancelled = false;
    const fit = () => {
      const t = textRef.current;
      if (!t || cancelled) return;
      t.setAttribute("font-size", "100");
      const len = t.getComputedTextLength() || 600;
      const next = Math.min((100 * size.w * 0.92) / len, size.h * 0.42);
      setFs(next);
    };
    fit();
    document.fonts?.ready.then(fit);
    return () => {
      cancelled = true;
    };
  }, [size]);

  const baseline = size.h * 0.47 + fs * 0.36;

  // Scale origin: centre of the T's stem, below the crossbar.
  useLayoutEffect(() => {
    const t = textRef.current;
    const z = zoomRef.current;
    if (!t || !z) return;
    t.setAttribute("font-size", String(fs));
    try {
      const ext = t.getExtentOfChar(T_INDEX);
      const ox = ext.x + ext.width / 2;
      const oy = baseline - fs * 0.3;
      gsap.set(z, { svgOrigin: `${ox} ${oy}` });
    } catch {
      gsap.set(z, { svgOrigin: `${size.w / 2} ${baseline - fs * 0.3}` });
    }
  }, [fs, baseline, size]);

  return (
    <div className="type" data-s="type">
      <svg viewBox={`0 0 ${size.w} ${size.h}`} preserveAspectRatio="none" role="img" aria-label="Roadster">
        <g data-s="type-zoom" ref={zoomRef}>
          <text
            ref={textRef}
            x={size.w / 2}
            y={baseline}
            textAnchor="middle"
            fontSize={fs}
            fill="#e31937"
            style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.01em" }}
          >
            {WORD}
          </text>
        </g>
      </svg>
      <div className="type__meta">
        <div className="type__rule" data-s="type-rule" style={{ transform: "scaleX(0)" }} />
        <div className="type__line">
          <span className="mask" data-s="type-line">
            <span>Roadster — an interactive fan concept.</span>
          </span>
        </div>
        <div className="mono" style={{ textAlign: "right" }}>
          <span className="mask" data-s="type-line">
            <span>Concept design &amp; development · Philip Ojo Oladeji</span>
          </span>
        </div>
      </div>
    </div>
  );
}
