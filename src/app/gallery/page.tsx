import type { Metadata } from "next";
import { CommerceShell } from "@/components/commerce/CommerceShell";

export const metadata: Metadata = {
  title: "Gallery | Roadster Concept",
  description: "Studio renders of the Roadster concept model. Not affiliated with Tesla.",
};

const SHOTS = [
  { id: "hero", title: "Front three-quarter", note: "Wedge profile, hidden headlights, Ano White." },
  { id: "profile", title: "Side profile", note: "Low roofline running into the rear wing." },
  { id: "rear", title: "Rear three-quarter", note: "Full-width tail light and the diffuser that hosts the rear thrusters." },
  { id: "front", title: "Head-on", note: "Wide stance; the nose sits just above the ground." },
  { id: "top", title: "Plan view", note: "Glass canopy and the long, narrow body from above." },
  { id: "wheel", title: "Detail", note: "Thin-spoke wheel and the sculpted side." },
  { id: "low", title: "Low angle", note: "The stage look: dark floor, red rim light." },
];

export default function Gallery() {
  return (
    <CommerceShell active="gallery">
      <div className="shop__intro">
        <p className="mono eyebrow">Gallery</p>
        <h1>Every angle.</h1>
        <p>
          Studio renders of the concept model used across this site. Scroll to look around, then reserve when you&apos;re
          ready.
        </p>
      </div>
      <div className="gallery">
        {SHOTS.map((s, i) => (
          <figure key={s.id} className="gallery__item">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/images/gallery/${s.id}.webp`}
              srcSet={`/images/gallery/${s.id}-sm.webp 800w, /images/gallery/${s.id}.webp 1600w`}
              sizes="(max-width: 900px) 100vw, 1200px"
              alt={`Roadster concept, ${s.title.toLowerCase()} (3D render)`}
              loading={i < 2 ? "eager" : "lazy"}
              width={1600}
              height={1000}
            />
            <figcaption>
              <span className="mono">
                {String(i + 1).padStart(2, "0")} / {String(SHOTS.length).padStart(2, "0")}
              </span>
              <strong>{s.title}</strong>
              <em>{s.note}</em>
            </figcaption>
          </figure>
        ))}
      </div>
      <div className="gallery__cta">
        <a className="cta" href="/reserve">
          Reserve yours
        </a>
        <p className="hint">Images are 3D renders of the fan-made model “Tesla Roadster (2028).” by morolucky (CC BY 4.0).</p>
      </div>
    </CommerceShell>
  );
}
