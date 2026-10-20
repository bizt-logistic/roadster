"use client";

import { useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import { rig } from "@/lib/rig";

// Procedural photo studio: long overhead softboxes and side strips produce the
// clean, continuous highlights of an automotive product shoot. It is baked
// once into an environment map (frames={1}), so it costs nothing per frame.

export function VehicleLighting() {
  const scene = useThree((s) => s.scene);
  const rim = useRef<THREE.SpotLight>(null);
  const key = useRef<THREE.DirectionalLight>(null);

  useFrame(() => {
    scene.environmentIntensity = rig.env;
    scene.environmentRotation.y = rig.envRot;
    if (rim.current) rim.current.intensity = rig.rim * 260;
    if (key.current) key.current.intensity = 0.6 + rig.rim * 0.4;
  });

  return (
    <>
      <Environment frames={1} resolution={256} background={false}>
        <color attach="background" args={["#dcdcdc"]} />
        {/* overhead softbox array */}
        <Lightformer form="rect" intensity={2.4} rotation-x={Math.PI / 2} position={[0, 6, -2]} scale={[12, 1.6, 1]} />
        <Lightformer form="rect" intensity={2.4} rotation-x={Math.PI / 2} position={[0, 6, 1.5]} scale={[12, 1.6, 1]} />
        <Lightformer form="rect" intensity={1.6} rotation-x={Math.PI / 2} position={[0, 6, 5]} scale={[12, 1.2, 1]} />
        {/* long side strips — these draw the shoulder highlight */}
        <Lightformer form="rect" intensity={2.2} rotation-y={Math.PI / 2} position={[-12, 1.4, 0]} scale={[30, 0.7, 1]} />
        <Lightformer form="rect" intensity={2.2} rotation-y={-Math.PI / 2} position={[12, 1.4, 0]} scale={[30, 0.7, 1]} />
        <Lightformer form="rect" intensity={1.2} position={[0, 2.2, 12]} scale={[24, 1.4, 1]} />
        <Lightformer form="rect" intensity={0.8} rotation-y={Math.PI} position={[0, 2, -12]} scale={[24, 2, 1]} />
        {/* warm kicker */}
        <Lightformer form="circle" intensity={3} color="#fff1e6" position={[6, 5, 6]} scale={2.5} onUpdate={(s) => s.lookAt(0, 0, 0)} />
        {/* dark floor bounce keeps the lower body grounded */}
        <Lightformer form="rect" intensity={0.15} color="#222" rotation-x={-Math.PI / 2} position={[0, -1, 0]} scale={[40, 40, 1]} />
      </Environment>
      <directionalLight ref={key} position={[4, 8, 5]} intensity={0.6} />
      <spotLight
        ref={rim}
        position={[-5.5, 2.4, -4.5]}
        angle={0.6}
        penumbra={1}
        intensity={0}
        color="#ff2a36"
        distance={22}
        decay={1.6}
      />
    </>
  );
}
