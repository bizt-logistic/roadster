"use client";

import { forwardRef } from "react";
import { useStore } from "@/lib/store";

export const CreditsDialog = forwardRef<HTMLDialogElement>(function CreditsDialog(_, ref) {
  const source = useStore((s) => s.source);
  return (
    <dialog className="credits" ref={ref} aria-labelledby="credits-title">
      <div className="mono" style={{ color: "var(--red)" }}>
        Unofficial fan concept
      </div>
      <h2 id="credits-title">Credits &amp; sources</h2>
      <p>
        <strong>Unofficial Tesla Roadster Fan Concept — Not Affiliated with Tesla.</strong> This is a personal creative
        engineering study. Tesla and Roadster are trademarks of Tesla, Inc.; no Tesla logos, fonts, imagery or code are
        used.
      </p>
      <ul>
        <li>Concept design &amp; development: Philip Ojo Oladeji.</li>
        {source === "gltf" ? (
          <li>
            3D model:{" "}
            <a href="https://sketchfab.com/3d-models/tesla-roadster-2028-0caed2c3ad1e4dd8ad90b1bb11b23d38" target="_blank" rel="noreferrer">
              “Tesla Roadster (2028).”
            </a>{" "}
            by{" "}
            <a href="https://sketchfab.com/morolucky" target="_blank" rel="noreferrer">
              morolucky
            </a>
            , licensed{" "}
            <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">
              CC BY 4.0
            </a>
            . Optimised (welded, simplified, compressed) and line art derived for this project.
          </li>
        ) : (
          <li>3D model: procedural concept geometry generated in code for this project.</li>
        )}
        <li>Studio lighting, smoke, shadows and line drawing are generated procedurally at runtime.</li>
        <li>Typefaces: Michroma, Inter and JetBrains Mono (SIL Open Font License) via Google Fonts.</li>
        <li>
          Figures and stunts are recreated from coverage of Tesla's 15 Oct 2026 Roadster reveal (TechCrunch, Teslarati, Wikipedia) and are Tesla claims, not independent measurements. The lineup vehicles are simplified stand-ins.
        </li>
      </ul>
      <form method="dialog">
        <button className="credits__close" type="submit">
          Close
        </button>
      </form>
    </dialog>
  );
});
