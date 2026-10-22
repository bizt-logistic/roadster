// Scene 3 copy. The transition itself (scanner sweep, line dissolve, shadow,
// camera dolly) happens in WebGL; this is the editorial counterpoint.

export function WireframeRevealOverlay() {
  return (
    <section className="form-copy" data-s="form-copy" aria-labelledby="form-title" style={{ opacity: 0 }}>
      <div className="mono eyebrow">
        <span className="mask" data-s="form-line">
          <span>02 · Form</span>
        </span>
      </div>
      <h2 id="form-title">
        <span className="mask" data-s="form-line">
          <span>One geometry.</span>
        </span>
        <span className="mask" data-s="form-line">
          <span>Sketch to surface.</span>
        </span>
      </h2>
      <p>
        <span className="mask" data-s="form-line">
          <span>
            The lines you just watched being drawn are extracted from the same 3D model that now resolves into paint,
            glass and light, so every stroke lands exactly on the car.
          </span>
        </span>
      </p>
    </section>
  );
}
