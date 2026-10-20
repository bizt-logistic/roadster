import { WHEELBASE_MM } from "@/components/animation/AnimationTimeline";

// Scene 1–2: the white sheet. The car itself is drawn in WebGL; this layer
// carries the editorial line, the drawing's title block and the dimension
// labels that the render loop pins to 3D anchor points.
//
// Outer elements are owned by the scroll timeline, inner ones by the autoplay
// intro, so the two never animate the same property.

const DIMS: { anchor: string; text: string; soft?: boolean }[] = [
  { anchor: "wheelbase", text: `Wheelbase · ${WHEELBASE_MM.toLocaleString("en-US")} mm` },
  { anchor: "length", text: "Overall length" },
  { anchor: "height", text: "H" },
  { anchor: "wheel", text: "Ø Wheel", soft: true },
];

export function IntroOverlay() {
  return (
    <>
      <div className="intro-copy" data-s="intro-copy">
        <div className="mono">
          <span className="mask" data-s="intro-reveal">
            <span>Interactive fan concept · 01/09</span>
          </span>
        </div>
        <h1 className="intro-title">
          <span className="mask" data-s="intro-reveal">
            <span>Every icon</span>
          </span>
          <span className="mask" data-s="intro-reveal">
            <span>begins as a line.</span>
          </span>
        </h1>
      </div>

      <div className="scroll-cue" data-s="scroll-cue" aria-hidden="true">
        <div className="scroll-cue__inner" data-s="scroll-cue-inner">
          <span className="mono">Scroll to construct</span>
          <span className="scroll-cue__line" />
        </div>
      </div>

      <div className="titleblock" data-s="titleblock" aria-hidden="true">
        <div className="titleblock__grid" data-s="titleblock-inner">
          <div>Dwg</div>
          <div>
            <strong>RDSTR-02-SE</strong>
          </div>
          <div>View</div>
          <div>Side elevation</div>
          <div>Scale</div>
          <div>1:20</div>
          <div>Status</div>
          <div>Unofficial fan concept</div>
        </div>
      </div>

      {DIMS.map((d) => (
        <div className="dim" data-anchor={d.anchor} key={d.anchor} aria-hidden="true">
          <div className={`dim__inner mono${d.soft ? " dim__inner--soft" : ""}`} data-s="dim-inner">
            {d.text}
          </div>
        </div>
      ))}
    </>
  );
}
