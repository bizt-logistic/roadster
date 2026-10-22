"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import { ContactShadows, OrbitControls, useGLTF } from "@react-three/drei";
import { VehicleLighting } from "@/components/three/VehicleLighting";
import { createCarMaterials } from "@/components/three/Materials";
import { paintFromSource, type ModelManifest } from "@/components/three/RoadsterModel";
import { buildProceduralRoadster } from "@/components/three/ProceduralRoadster";

// Lightweight studio viewer for the reservation page: same model and paint
// as the experience, orbitable, no scroll choreography.

const noClip = new THREE.Plane(new THREE.Vector3(1, 0, 0), 1000);

export function GltfCar({ manifest }: { manifest: ModelManifest }) {
  const gltf = useGLTF(manifest.model, false, true);
  const root = useMemo(() => {
    const mats = createCarMaterials(noClip);
    const scene = gltf.scene.clone(true);
    const drop: THREE.Object3D[] = [];
    scene.traverse((o) => {
      if ((o as THREE.LineSegments).isLineSegments) drop.push(o);
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const m = mesh.material as THREE.MeshStandardMaterial;
      if (manifest.materials.paint.includes(m.name)) mesh.material = paintFromSource(m, mats.paint);
    });
    drop.forEach((o) => o.parent?.remove(o));
    return scene;
  }, [gltf, manifest]);
  return <primitive object={root} />;
}

export function ProceduralCar() {
  const root = useMemo(() => buildProceduralRoadster(createCarMaterials(noClip)).root, []);
  return <primitive object={root} />;
}

export default function CarViewer({ className }: { className?: string }) {
  const [manifest, setManifest] = useState<ModelManifest | null | undefined>(undefined);
  useEffect(() => {
    fetch("/models/manifest.json")
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
      .then(setManifest);
  }, []);
  return (
    <div className={className} aria-label="Interactive 3D view of the Roadster, drag to rotate" role="img">
      {manifest !== undefined && (
        <Canvas
          dpr={[1, 1.75]}
          camera={{ fov: 24, position: [6.2, 2.0, 7.0], near: 0.1, far: 100 }}
          gl={{ antialias: true, alpha: true }}
          onCreated={({ gl }) => {
            gl.toneMapping = THREE.NeutralToneMapping;
            gl.localClippingEnabled = true;
          }}
        >
          <Suspense fallback={null}>
            <VehicleLighting />
            {manifest ? <GltfCar manifest={manifest} /> : <ProceduralCar />}
            <ContactShadows position={[0, 0.002, 0]} scale={9} far={1.6} blur={2.4} opacity={0.7} resolution={512} frames={1} />
          </Suspense>
          <OrbitControls
            target={[0, 0.5, 0]}
            enablePan={false}
            enableZoom={false}
            minPolarAngle={0.9}
            maxPolarAngle={1.5}
            autoRotate
            autoRotateSpeed={0.6}
            enableDamping
          />
        </Canvas>
      )}
    </div>
  );
}
