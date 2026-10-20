"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { rig } from "@/lib/rig";

// Screen-space smoke built from domain-warped fBm noise. Two full-screen
// quads share the shader:
//   • front — rolls up over everything for the finale transition
//   • back  — sits on the far plane as low floor haze behind the car
// No particles, no textures: one fragment shader per pass, and both quads
// are skipped entirely when their contribution is zero.

const noise = /* glsl */ `
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    mat2 r = mat2(0.8, -0.6, 0.6, 0.8);
    for (int i = 0; i < OCTAVES; i++) { v += a * vnoise(p); p = r * p * 2.03 + 0.17; a *= 0.5; }
    return v;
  }
`;

function smokeMaterial(front: boolean, octaves: number) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: !front,
    defines: { OCTAVES: octaves },
    uniforms: {
      uTime: { value: 0 },
      uCover: { value: 0 },
      uClear: { value: 0 },
      uFloor: { value: 0 },
      uAspect: { value: 1 },
      uDark: { value: new THREE.Color("#0d0d0f") },
      uLight: { value: new THREE.Color("#4a4a50") },
      uGlow: { value: new THREE.Color("#e31937") },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, ${front ? "-1.0" : "0.99999"}, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime, uCover, uClear, uFloor, uAspect;
      uniform vec3 uDark, uLight, uGlow;
      varying vec2 vUv;
      ${noise}
      void main() {
        vec2 p = vec2(vUv.x * uAspect, vUv.y) * 2.2;
        float t = uTime * 0.045;
        vec2 q = vec2(fbm(p + vec2(0.0, -t * 2.0)), fbm(p + vec2(5.2, 1.3 - t)));
        vec2 r = vec2(fbm(p + 3.0 * q + vec2(1.7, 9.2) + t), fbm(p + 3.0 * q + vec2(8.3, 2.8) - t * 0.6));
        float n = fbm(p + 2.6 * r);
        float billow = smoothstep(0.25, 0.85, n);
        vec3 col = mix(uDark, uLight, pow(billow, 1.6) * 0.9);

        ${front
          ? `
        // A front that rises from the bottom, then clears upwards.
        float edgeIn = uCover * 1.6 - 0.3;
        float rise = 1.0 - smoothstep(edgeIn - 0.18, edgeIn + 0.18, vUv.y + (n - 0.5) * 0.55);
        float edgeOut = uClear * 1.7 - 0.35;
        float clear = smoothstep(edgeOut - 0.2, edgeOut + 0.2, vUv.y + (n - 0.5) * 0.6);
        float a = rise * clear;
        gl_FragColor = vec4(col, a);
        `
          : `
        // Floor haze: dense at the bottom, wisps above, a red pool of light behind the car.
        float h = 1.0 - smoothstep(0.0, 0.62, vUv.y + (n - 0.5) * 0.35);
        float a = h * (0.35 + 0.65 * billow) * uFloor;
        vec2 g = vec2((vUv.x - 0.5) * uAspect, vUv.y - 0.3);
        float glow = exp(-dot(g, g) * 3.2) * uFloor;
        col = mix(col, uGlow * 0.55, glow * 0.55 * (0.4 + 0.6 * billow));
        gl_FragColor = vec4(col, clamp(a + glow * 0.35, 0.0, 1.0));
        `}
      }
    `,
  });
}

export function AtmosphericSmoke({ quality = 1 }: { quality?: number }) {
  const { front, back } = useMemo(() => {
    const geo = new THREE.PlaneGeometry(2, 2);
    const octaves = quality > 0.7 ? 5 : 3;
    const f = new THREE.Mesh(geo, smokeMaterial(true, octaves));
    const b = new THREE.Mesh(geo, smokeMaterial(false, octaves));
    for (const m of [f, b]) {
      m.frustumCulled = false;
      m.userData.noShadowBake = true;
      m.userData.mainViewOnly = true;
    }
    f.renderOrder = 100;
    b.renderOrder = -20;
    return { front: f, back: b };
  }, [quality]);

  useFrame((state) => {
    const aspect = state.size.width / Math.max(1, state.size.height);
    const time = rig.reducedMotion ? 12 : state.clock.elapsedTime;
    for (const m of [front, back]) {
      const u = (m.material as THREE.ShaderMaterial).uniforms;
      u.uTime.value = time;
      u.uAspect.value = aspect;
      u.uCover.value = rig.smokeCover;
      u.uClear.value = rig.smokeClear;
      u.uFloor.value = rig.smokeFloor;
    }
    front.visible = rig.smokeCover > 0.001 && rig.smokeClear < 0.999;
    back.visible = rig.smokeFloor > 0.001;
  });

  return (
    <>
      <primitive object={back} />
      <primitive object={front} />
    </>
  );
}
