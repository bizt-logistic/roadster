// Scene 4b: X-ray anatomy. The body turns into a fresnel ghost, the line
// drawing returns as a cyan skeleton and six systems light up in turn. The
// callouts are pinned to 3D anchors by the render loop (data-anchor="x-…").

export const ANATOMY_ITEMS = [
  { key: "structure", title: "Structure", spec: "Bonded chassis, active wings · Track Mode lowers the car" },
  { key: "battery", title: "Battery", spec: "800 V pack of 4680 cells · capacity not disclosed" },
  { key: "motors", title: "Motors", spec: "Two rear motors · 1,000+ kW claimed" },
  { key: "tanks", title: "Gas tanks", spec: "Composite vessels · ~200 L (Thrust), +400 L in the passenger seat (Rocket)" },
  { key: "thrusters", title: "Cold-gas thrusters", spec: "4 rear nozzles (Thrust) · 10 around the body (Rocket)" },
  { key: "fan", title: "Suction fan", spec: "Fan + ground-sealing skirt — holds the car to a surface, even upside down" },
] as const;

export function AnatomyOverlay() {
  return (
    <section className="anat" aria-labelledby="anat-title">
      <div className="anat__copy">
        <div className="mono eyebrow">
          <span className="mask" data-s="anat-line">
            <span>05 — Anatomy</span>
          </span>
        </div>
        <h2 id="anat-title">
          <span className="mask" data-s="anat-line">
            <span>What lives</span>
          </span>
          <span className="mask" data-s="anat-line">
            <span>under the white.</span>
          </span>
        </h2>
        <ol className="anat__list">
          {ANATOMY_ITEMS.map((it, i) => (
            <li key={it.key} data-s="anat-item">
              <span className="anat__idx mono">{String(i + 1).padStart(2, "0")}</span>
              <span>
                <strong>{it.title}</strong>
                <em>{it.spec}</em>
              </span>
            </li>
          ))}
        </ol>
        <p className="anat__note" data-s="anat-note">
          Illustrative layout from the systems Tesla described at the 15 Oct 2026 reveal. Tesla has not published the
          Roadster&apos;s internal packaging; figures are Tesla claims.
        </p>
      </div>

      {ANATOMY_ITEMS.map((it, i) => (
        <div className="dim" data-anchor={`x-${it.key}`} key={it.key} aria-hidden="true">
          <div className="anat-label mono" data-s="anat-label">
            <i />
            {String(i + 1).padStart(2, "0")} · {it.title}
          </div>
        </div>
      ))}
    </section>
  );
}
