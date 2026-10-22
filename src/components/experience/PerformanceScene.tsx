import { CONCEPT_FIGURES, TRIMS } from "@/components/animation/AnimationTimeline";

// Scene 4. The band and the giant wordmark sit *under* the canvas so the car
// passes in front of the letters; the figures sit above it.

const WORD = "ROADSTER";

export function PerformanceBackdrop() {
  return (
    <>
      <div className="perf-line" data-s="perf-line" />
      <div className="perf-band" data-s="perf-band" aria-hidden="true">
        <div className="perf-word">
          {WORD.split("").map((ch, i) => (
            <span key={i} data-s="perf-letter" style={{ transform: "translateY(118%)" }}>
              {ch}
            </span>
          ))}
        </div>
      </div>
    </>
  );
}

export function PerformanceOverlay() {
  return (
    <section aria-labelledby="perf-title">
      <h2 id="perf-title" className="sr-only">
        Roadster performance: figures from the October 2026 reveal
      </h2>
      <dl className="stats" data-s="stats">
        {CONCEPT_FIGURES.map((f) => (
          <div className="stat" data-s="stat" key={f.label}>
            <dt className="stat__label mono">{f.label}</dt>
            <dd className="stat__value" style={{ margin: 0 }}>
              <span data-count={f.value} data-decimals={f.decimals} aria-hidden="true">
                {(0).toFixed(f.decimals)}
              </span>
              <span className="sr-only">{f.value}</span>
              {f.suffix}
              <small>{f.unit}</small>
            </dd>
          </div>
        ))}
      </dl>
      <p className="perf-note" data-s="perf-note">
        Tesla claims from the 15 Oct 2026 reveal (production planned for 2028). The 0.81 s run was a driverless demonstration run with
        cold-gas thrusters engaged and was not independently timed. Trims: {TRIMS.map((t) => `${t.name} ${t.zeroToSixty}`).join(" · ")}.
      </p>
    </section>
  );
}
