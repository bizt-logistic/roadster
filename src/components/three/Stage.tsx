"use client";

import { Component, Suspense, useEffect, useState, type ReactNode } from "react";
import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import { PerformanceMonitor, useProgress } from "@react-three/drei";
import { store } from "@/lib/store";
import { VehicleLighting } from "./VehicleLighting";
import { GltfRoadsterModel, ProceduralRoadsterModel, type ModelManifest } from "./RoadsterModel";
import { AtmosphericSmoke } from "./AtmosphericSmoke";
import { CameraController } from "./CameraController";
import { StuntSet } from "./StuntSet";
import { CAR } from "./ProceduralRoadster";

function ProgressReporter() {
  const { progress, active } = useProgress();
  useEffect(() => {
    if (!store.get().ready) store.set({ progress: Math.min(0.96, active ? progress / 100 : 0.96) });
  }, [progress, active]);
  return null;
}

/** If the sourced model fails to load or parse, fall back to the procedural car. */
class ModelBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(err: unknown) {
    console.warn("[roadster] glTF model failed, using procedural fallback", err);
    store.set({ source: "procedural" });
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export default function Stage({ manifest }: { manifest: ModelManifest | null }) {
  const [quality] = useState(() => {
    if (typeof window === "undefined") return 1;
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    return coarse || window.innerWidth < 760 ? 0.6 : 1;
  });
  const maxDpr = typeof window === "undefined" ? 1.5 : Math.min(window.devicePixelRatio || 1, quality < 1 ? 1.5 : 1.75);
  const [dpr, setDpr] = useState(maxDpr);

  return (
    <Canvas
      className="stage"
      aria-hidden="true"
      dpr={dpr}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance", stencil: false }}
      camera={{ fov: 18, near: 0.1, far: 300, position: [0, 1, 14] }}
      onCreated={({ gl }) => {
        gl.localClippingEnabled = true;
        gl.toneMapping = THREE.NeutralToneMapping;
        gl.toneMappingExposure = 1.0;
        gl.setClearColor(0x000000, 0);
      }}
    >
      <PerformanceMonitor
        bounds={() => [45, 58]}
        flipflops={3}
        onDecline={() => setDpr((d) => Math.max(1, d - 0.35))}
        onIncline={() => setDpr((d) => Math.min(maxDpr, d + 0.25))}
      />
      <ProgressReporter />
      <Suspense fallback={null}>
        <VehicleLighting />
        {manifest ? (
          <ModelBoundary fallback={<ProceduralRoadsterModel />}>
            <GltfRoadsterModel manifest={manifest} />
          </ModelBoundary>
        ) : (
          <ProceduralRoadsterModel />
        )}
        <StuntSet dims={manifest ? manifest.dims : { length: CAR.length, height: CAR.height }} />
        <AtmosphericSmoke quality={quality} />
      </Suspense>
      <CameraController />
    </Canvas>
  );
}
