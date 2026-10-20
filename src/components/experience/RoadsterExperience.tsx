"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { createDirector, type Director } from "@/components/animation/ScrollDirector";
import { TRACK_VH, type SceneName } from "@/components/animation/AnimationTimeline";
import { store, useStore } from "@/lib/store";
import type { ModelManifest } from "@/components/three/RoadsterModel";
import { Navigation } from "@/components/ui/Navigation";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { CreditsDialog } from "@/components/ui/CreditsDialog";
import { IntroOverlay } from "./IntroScene";
import { WireframeRevealOverlay } from "./WireframeReveal";
import { PerformanceBackdrop, PerformanceOverlay } from "./PerformanceScene";
import { MotionOverlay, ShowcaseOverlay, ShowcasePanels } from "./VehicleShowcase";
import { VerticalBackdrop, VerticalOverlay } from "./VerticalTransition";
import { TypographyBackdrop } from "./TypographyReveal";
import { FinaleOverlay } from "./AtmosphericFinale";
import { AnatomyOverlay } from "./AnatomyScene";

const Stage = dynamic(() => import("@/components/three/Stage"), { ssr: false });

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

function hasWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

export default function RoadsterExperience() {
  const root = useRef<HTMLDivElement>(null);
  const director = useRef<Director | null>(null);
  const credits = useRef<HTMLDialogElement>(null);
  const [manifest, setManifest] = useState<ModelManifest | null | undefined>(undefined);
  const ready = useStore((s) => s.ready);
  const webgl = useStore((s) => s.webgl);

  // Decide the car source: an optimised glTF if one has been installed via
  // `npm run model:optimize`, otherwise the procedural fallback.
  useEffect(() => {
    if (!hasWebGL()) {
      store.set({ webgl: false, ready: true, progress: 1, source: "procedural" });
      setManifest(null);
      return;
    }
    let alive = true;
    fetch("/models/manifest.json", { cache: "no-cache" })
      .then((r) => (r.ok ? (r.json() as Promise<ModelManifest>) : null))
      .catch(() => null)
      .then((m) => {
        if (!alive) return;
        setManifest(m);
        store.set({ source: m ? "gltf" : "procedural" });
      });
    return () => {
      alive = false;
    };
  }, []);

  useIsoLayoutEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    director.current = createDirector(root.current!, { reducedMotion: reduced });
    return () => {
      director.current?.destroy();
      director.current = null;
    };
  }, []);

  useEffect(() => {
    if (ready) director.current?.playIntro();
  }, [ready]);

  const onNavigate = useCallback((scene: SceneName) => director.current?.scrollTo(scene), []);
  const onCredits = useCallback(() => credits.current?.showModal(), []);

  return (
    <div className="exp" ref={root} id="top">
      <div className="layer layer--under">
        <div className="bg" data-s="bg" />
        <PerformanceBackdrop />
        <ShowcasePanels />
        <VerticalBackdrop />
        <TypographyBackdrop />
      </div>

      {webgl ? manifest !== undefined && <Stage manifest={manifest} /> : (
        <div className="layer" style={{ zIndex: 1 }}>
          <p className="nowebgl mono">WebGL is unavailable — showing the typographic edition.</p>
        </div>
      )}

      <main className="layer layer--over">
        <IntroOverlay />
        <WireframeRevealOverlay />
        <PerformanceOverlay />
        <AnatomyOverlay />
        <MotionOverlay />
        <ShowcaseOverlay />
        <VerticalOverlay />
        <FinaleOverlay />
      </main>

      <Navigation onNavigate={onNavigate} onCredits={onCredits} />
      <CreditsDialog ref={credits} />
      <LoadingScreen />
      <div className="track" data-s="track" style={{ height: `${TRACK_VH}vh` }} aria-hidden="true" />
    </div>
  );
}
