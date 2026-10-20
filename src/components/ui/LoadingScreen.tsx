"use client";

import { useStore } from "@/lib/store";

export function LoadingScreen() {
  const progress = useStore((s) => s.progress);
  const ready = useStore((s) => s.ready);
  const pct = Math.round(Math.min(1, progress) * 100);
  return (
    <div className="loader" data-s="loader" role="status" aria-live="polite" aria-busy={!ready}>
      <div className="loader__inner">
        <div className="loader__brand">ROADSTER</div>
        <div className="loader__bar">
          <div className="loader__fill" style={{ transform: `scaleX(${Math.max(0.02, progress)})` }} />
        </div>
        <div className="loader__meta mono">
          <span>{ready ? "Ready" : "Preparing the studio"}</span>
          <span>{pct.toString().padStart(3, "0")}</span>
        </div>
      </div>
    </div>
  );
}
