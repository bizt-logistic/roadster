"use client";

import { useStore } from "@/lib/store";
import { LINEUP } from "@/lib/stunts";

// Scene 9: the reveal-stage arena. The smoke, ramp, lineup and thruster
// trails are WebGL (AtmosphericSmoke, StuntSet); this layer carries the stunt
// captions and the final composition.

const STUNTS = [
  {
    n: "01",
    title: "Inverted ramp",
    body: "Fan-generated suction holds the car to a curved ramp until it is upside down. Cold-gas thrusters fire, it flips and lands on four wheels.",
  },
  {
    n: "02",
    title: "The hop",
    body: `A thruster-assisted barrel roll over a lineup of Tesla vehicles: ${LINEUP.map((v) => v.name).join(", ")}.`,
  },
];

export function FinaleOverlay() {
  const source = useStore((s) => s.source);
  return (
    <section className="finale" aria-labelledby="finale-title">
      {STUNTS.map((s) => (
        <div className="stunt-cap" data-s="stunt-cap" key={s.n}>
          <div className="mono stunt-cap__meta">
            Stunt {s.n} · recreated from the 15 Oct 2026 reveal
          </div>
          <h3 className="stunt-cap__title">{s.title}</h3>
          <p className="stunt-cap__body">{s.body}</p>
        </div>
      ))}

      <div className="finale__title">
        <h2 id="finale-title" style={{ margin: 0 }}>
          <span className="mask" data-s="finale-line">
            <span className="display">ROADSTER</span>
          </span>
        </h2>
        <div className="finale__sub">
          <span className="mask" data-s="finale-line">
            <span>
              <span>An interactive experience</span>, drawn, built, flown and lit in real time in
              your browser.
            </span>
          </span>
        </div>
        <div className="finale__ctas" data-s="finale-credit-cta">
          <a className="finale__cta" href="/reserve">Reserve yours</a>
          <a className="finale__cta finale__cta--ghost" href="/test-drive">Book a test drive</a>
          <a className="finale__cta finale__cta--ghost" href="/invest">Invest &amp; partner</a>
        </div>
      </div>
      <footer className="finale__credit mono" data-s="finale-credit">
        <span>
          <strong>Concept design &amp; development by Philip Ojo Oladeji</strong>
        </span>
        <span>Unofficial concept · Not affiliated with Tesla, Inc.</span>
        <span>
          {source === "gltf"
            ? "3D model: “Tesla Roadster (2028).” by morolucky · CC BY 4.0"
            : "3D model: procedural concept geometry"}
        </span>
      </footer>
    </section>
  );
}
