"use client";

import { Suspense, useEffect, useState } from "react";
import * as THREE from "three";
import { Canvas, useThree } from "@react-three/fiber";
import { ContactShadows } from "@react-three/drei";
import { VehicleLighting } from "@/components/three/VehicleLighting";
import type { ModelManifest } from "@/components/three/RoadsterModel";
import { rig } from "@/lib/rig";
import { GltfCar, ProceduralCar } from "./CarViewer";

// Offline "photo studio": renders the model from a named camera preset so the
// gallery stills come from the same model the site uses (no third-party
// photography). Used by scripts/capture.mjs to produce public/images/gallery.

export const SHOTS: Record<string, { pos: [number, number, number]; target: [number, number, number]; fov: number; bg: string; dark?: boolean }> = {
  hero: { pos: [5.2, 1.25, 5.4], target: [0, 0.48, 0], fov: 26, bg: "#f4f4f2" },
  profile: { pos: [0, 0.7, 9], target: [0, 0.52, 0], fov: 25, bg: "#ffffff" },
  rear: { pos: [-5.4, 1.1, 4.3], target: [0, 0.5, 0], fov: 26, bg: "#0b0b0c", dark: true },
  front: { pos: [7.2, 0.55, 0.8], target: [0, 0.5, 0], fov: 24, bg: "#0b0b0c", dark: true },
  top: { pos: [0.01, 12.5, 0], target: [0, 0, 0], fov: 26, bg: "#ececea" },
  wheel: { pos: [2.9, 0.62, 2.8], target: [1.35, 0.35, 0.9], fov: 26, bg: "#f4f4f2" },
  low: { pos: [4.6, 0.3, 3.6], target: [0, 0.62, 0], fov: 30, bg: "#0b0b0c", dark: true },
};

function Camera({ shot }: { shot: string }) {
  const { camera } = useThree();
  useEffect(() => {
    const s = SHOTS[shot] ?? SHOTS.hero;
    const cam = camera as THREE.PerspectiveCamera;
    cam.position.set(...s.pos);
    if (shot === "top") cam.up.set(1, 0, 0);
    cam.fov = s.fov;
    cam.lookAt(...s.target);
    cam.updateProjectionMatrix();
  }, [camera, shot]);
  return null;
}

export function StudioRender({ shot }: { shot: string }) {
  const s = SHOTS[shot] ?? SHOTS.hero;
  const [manifest, setManifest] = useState<ModelManifest | null | undefined>(undefined);
  useEffect(() => {
    rig.env = s.dark ? 0.75 : 1;
    rig.rim = s.dark ? 1 : 0;
    rig.envRot = shot === "rear" ? 1.2 : 0.4;
    fetch("/models/manifest.json")
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
      .then(setManifest);
  }, [s.dark, shot]);

  return (
    <div style={{ position: "fixed", inset: 0, background: s.dark ? `radial-gradient(90% 80% at 50% 70%, #26262a 0%, ${s.bg} 70%)` : s.bg }}>
      {manifest !== undefined && (
        <Canvas
          dpr={2}
          camera={{ fov: s.fov, near: 0.1, far: 100 }}
          gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true }}
          onCreated={({ gl }) => {
            gl.toneMapping = THREE.NeutralToneMapping;
            gl.localClippingEnabled = true;
          }}
        >
          <Camera shot={shot} />
          <Suspense fallback={null}>
            <VehicleLighting />
            {manifest ? <GltfCar manifest={manifest} /> : <ProceduralCar />}
            <ContactShadows position={[0, 0.002, 0]} scale={10} far={1.6} blur={2.2} opacity={s.dark ? 0.9 : 0.65} resolution={1024} frames={1} />
          </Suspense>
        </Canvas>
      )}
    </div>
  );
}
