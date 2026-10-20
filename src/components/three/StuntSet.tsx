"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { rig } from "@/lib/rig";
import { ARENA, LANDINGS, LINEUP, flipPose, hopPose, rampPose, type Pose } from "@/lib/stunts";

// The finale "arena", modelled on the reveal stage: a dark floor with red
// light lines, haze, hanging spot cones, the curved suction ramp and a
// lineup of five stand-in vehicles. Plus the scroll-driven cold-gas smoke
// trails for all three stunts.
//
// The lineup vehicles are deliberately simple stand-ins (extruded side
// profiles with line-art edges), not reproductions of Tesla's designs.

const D2R = Math.PI / 180;

// ── smoke trail: billboard puffs whose birth is a point on a stunt path ────
function createTrail(samples: { pos: THREE.Vector3; birth: number; seed: number }[], life: number, scale: number) {
  const base = new THREE.PlaneGeometry(1, 1);
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = base.index;
  geo.setAttribute("position", base.getAttribute("position"));
  geo.setAttribute("uv", base.getAttribute("uv"));
  const n = samples.length;
  const pos = new Float32Array(n * 3), birth = new Float32Array(n), seed = new Float32Array(n);
  samples.forEach((s, i) => {
    pos.set([s.pos.x, s.pos.y, s.pos.z], i * 3);
    birth[i] = s.birth;
    seed[i] = s.seed;
  });
  geo.setAttribute("aPos", new THREE.InstancedBufferAttribute(pos, 3));
  geo.setAttribute("aBirth", new THREE.InstancedBufferAttribute(birth, 1));
  geo.setAttribute("aSeed", new THREE.InstancedBufferAttribute(seed, 1));
  geo.instanceCount = n;
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uP: { value: 0 }, uLife: { value: life }, uScale: { value: scale }, uOpacity: { value: 1 } },
    vertexShader: /* glsl */ `
      attribute vec3 aPos;
      attribute float aBirth;
      attribute float aSeed;
      uniform float uP, uLife, uScale;
      varying vec2 vUv;
      varying float vA;
      varying float vSeed;
      void main() {
        float age = (uP - aBirth) / uLife;
        if (age < 0.0 || age > 1.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
        vec3 c = aPos + vec3(0.0, age * 0.9, 0.0);
        float size = uScale * (0.35 + 1.7 * sqrt(age)) * (0.7 + 0.6 * fract(aSeed * 7.31));
        vec4 mv = viewMatrix * vec4(c, 1.0);
        float rot = aSeed * 6.2831 + age * 0.8;
        vec2 p = mat2(cos(rot), -sin(rot), sin(rot), cos(rot)) * position.xy;
        mv.xy += p * size;
        gl_Position = projectionMatrix * mv;
        vUv = uv;
        vA = (1.0 - age) * (1.0 - age) * smoothstep(0.0, 0.04, age);
        vSeed = aSeed;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      varying vec2 vUv;
      varying float vA;
      varying float vSeed;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float vnoise(vec2 p) {
        vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
      }
      void main() {
        vec2 q = vUv - 0.5;
        float d = length(q) * 2.0;
        float n = vnoise(q * 4.0 + vSeed * 13.0) * 0.6 + vnoise(q * 9.0 - vSeed * 7.0) * 0.4;
        float a = (1.0 - smoothstep(0.25, 1.0, d + (n - 0.5) * 0.55)) * vA * 0.62 * uOpacity;
        vec3 col = mix(vec3(0.80, 0.82, 0.86), vec3(1.0), n);
        gl_FragColor = vec4(col, a);
      }
    `,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 9;
  mesh.userData.noShadowBake = true;
  return { mesh, mat };
}

/** Rear nozzle cluster (car-local) — four nozzles across the rear diffuser. */
export function nozzleLocal(length: number, height: number) {
  return [-0.62, -0.22, 0.22, 0.62].map((z) => new THREE.Vector3(-length / 2 + 0.02, height * 0.3, z));
}

function sampleTrail(
  pose: (p: number) => Pose,
  pivotY: number,
  nozzles: THREE.Vector3[],
  count: number,
  seedBase: number,
) {
  const out: { pos: THREE.Vector3; birth: number; seed: number }[] = [];
  const m = new THREE.Matrix4(), r = new THREE.Matrix4(), e = new THREE.Euler();
  let k = 0;
  for (let i = 0; i < count; i++) {
    const p = i / (count - 1);
    const ps = pose(p);
    if (ps.thrust < 0.15) continue;
    e.set(ps.roll * D2R, 0, ps.pitch * D2R);
    r.makeRotationFromEuler(e);
    m.makeTranslation(ps.x, pivotY + ps.y, 0).multiply(r).multiply(new THREE.Matrix4().makeTranslation(0, -pivotY, 0));
    // two puffs per sample, from alternating nozzles
    for (let j = 0; j < 2; j++) {
      const nz = nozzles[(k++ * 3 + j) % nozzles.length].clone().applyMatrix4(m);
      out.push({ pos: nz, birth: p, seed: (seedBase + i * 0.6180339 + j * 0.31) % 1 });
    }
  }
  return out;
}

// ── lineup stand-ins ────────────────────────────────────────────────────────
function profile(kind: string, L: number, H: number) {
  const s = new THREE.Shape();
  const h = L / 2;
  const P = (pts: [number, number][]) => {
    s.moveTo(pts[0][0], pts[0][1]);
    s.splineThru(pts.slice(1).map(([x, y]) => new THREE.Vector2(x, y)));
  };
  switch (kind) {
    case "truck":
      s.moveTo(-h, 0.42);
      s.lineTo(-h, H * 0.66);
      s.lineTo(-0.15, H);
      s.lineTo(h, H * 0.56);
      s.lineTo(h, 0.42);
      s.lineTo(-h, 0.42);
      return s;
    case "semi":
      s.moveTo(-h, 0.55);
      s.lineTo(-h, 1.25);
      s.lineTo(-h + 1.6, 1.25);
      s.lineTo(-h + 1.7, H);
      s.splineThru([new THREE.Vector2(h - 1.4, H * 0.97), new THREE.Vector2(h - 0.35, H * 0.62), new THREE.Vector2(h, 1.0)]);
      s.lineTo(h, 0.55);
      s.lineTo(-h, 0.55);
      return s;
    case "cab":
      P([[-h, 0.35], [-h, 0.85], [-h + 0.6, H * 0.94], [-0.1, H], [h - 0.9, H * 0.72], [h - 0.15, 0.62], [h, 0.38]]);
      s.lineTo(-h, 0.35);
      return s;
    case "suv":
      P([[-h, 0.38], [-h + 0.05, 0.95], [-h + 0.45, H * 0.97], [0.1, H], [h - 1.45, H * 0.9], [h - 0.55, 0.92], [h - 0.05, 0.72], [h, 0.4]]);
      s.lineTo(-h, 0.38);
      return s;
    default:
      P([[-h, 0.34], [-h + 0.05, 0.86], [-h + 0.45, 0.98], [-h + 1.3, H * 0.98], [0.1, H], [h - 1.5, H * 0.74], [h - 0.35, 0.82], [h, 0.55], [h - 0.05, 0.34]]);
      s.lineTo(-h, 0.34);
      return s;
  }
}

function buildVehicle(v: (typeof LINEUP)[number]) {
  const g = new THREE.Group();
  const shape = profile(v.kind, v.length, v.height);
  const depth = v.width - 0.2;
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelSize: v.kind === "truck" ? 0.02 : 0.09,
    bevelThickness: 0.1,
    bevelSegments: 3,
    curveSegments: 24,
  });
  geo.translate(0, 0, -depth / 2);
  const paint = new THREE.MeshPhysicalMaterial({
    color: v.color,
    metalness: v.kind === "truck" ? 0.9 : 0.5,
    roughness: v.kind === "truck" ? 0.32 : 0.3,
    clearcoat: v.kind === "truck" ? 0 : 1,
    clearcoatRoughness: 0.05,
  });
  const body = new THREE.Mesh(geo, paint);
  g.add(body);
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(geo, 28),
    new THREE.LineBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.14 }),
  );
  g.add(edges);
  const wr = v.kind === "semi" ? 0.52 : v.kind === "truck" ? 0.43 : 0.36;
  const tire = new THREE.MeshStandardMaterial({ color: "#0c0c0d", roughness: 0.85 });
  const axles = v.kind === "semi" ? [v.length / 2 - 1.1, -v.length / 2 + 0.9] : [v.length * 0.31, -v.length * 0.31];
  for (const x of axles) for (const side of [1, -1]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(wr, wr, 0.28, 28), tire);
    w.rotation.x = Math.PI / 2;
    w.position.set(x, wr, side * (v.width / 2 - 0.12));
    g.add(w);
  }
  // under-glow, as the reveal lineup sat on lines of red light
  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(v.length * 1.05, v.width * 1.15),
    new THREE.MeshBasicMaterial({ color: "#ff1a2a", transparent: true, opacity: 0.1, depthWrite: false }),
  );
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = 0.012;
  g.add(glow);
  return g;
}

function radialAlpha(size = 256) {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = x / (size - 1) - 0.5, dy = y / (size - 1) - 0.5;
    const d = Math.sqrt(dx * dx + dy * dy) * 2;
    const a = Math.max(0, Math.min(1, (1 - d) / 0.55));
    const i = (y * size + x) * 4;
    data[i] = data[i + 1] = data[i + 2] = Math.round(a * a * 255);
    data[i + 3] = 255;
  }
  const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  t.needsUpdate = true;
  return t;
}

function spotCone(color: string) {
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: { uColor: { value: new THREE.Color(color) }, uOpacity: { value: 0 } },
    vertexShader: /* glsl */ `
      varying float vH;
      varying vec3 vN;
      varying vec3 vV;
      void main() {
        vH = uv.y;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uOpacity;
      varying float vH;
      varying vec3 vN;
      varying vec3 vV;
      void main() {
        float rim = pow(abs(dot(vN, vV)), 1.6);
        float a = rim * pow(vH, 1.3) * uOpacity;
        gl_FragColor = vec4(uColor * a, a);
      }
    `,
  });
  const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 4.2, 16, 40, 1, true), mat);
  return { cone, mat };
}

export function StuntSet({ dims }: { dims: { length: number; height: number } }) {
  const pivotY = dims.height * 0.45;

  const parts = useMemo(() => {
    const arena = new THREE.Group();
    arena.userData.noShadowBake = true;

    // floor fading into the dark page background
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(140, 70),
      new THREE.MeshStandardMaterial({ color: "#0b0b0d", roughness: 0.5, metalness: 0.3, transparent: true, alphaMap: radialAlpha() }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(-6, -0.002, 0);
    floor.renderOrder = -30; // before the contact shadow and haze
    arena.add(floor);

    // red light lines on the floor
    const red = new THREE.MeshBasicMaterial({ color: "#ff2034" });
    const strip = (x0: number, x1: number, z: number, w = 0.07) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 0.02, w), red);
      m.position.set((x0 + x1) / 2, 0.01, z);
      arena.add(m);
    };
    strip(-50, 34, 4.4);
    strip(-50, 34, -4.4);
    strip(-9, 9, 3.4, 0.05);
    strip(-9, 9, -3.4, 0.05);

    // curved suction ramp (inside surface radius R, wheel contact)
    const { rampX: x0, rampR: R, rampWidth: W } = ARENA;
    const t0 = -0.02, t1 = (200 * Math.PI) / 180;
    const ring = new THREE.Shape();
    const steps = 80;
    for (let i = 0; i <= steps; i++) {
      const th = t0 + ((t1 - t0) * i) / steps;
      const x = x0 + R * Math.sin(th), y = R - R * Math.cos(th);
      if (i === 0) ring.moveTo(x, y); else ring.lineTo(x, y);
    }
    for (let i = steps; i >= 0; i--) {
      const th = t0 + ((t1 - t0) * i) / steps;
      ring.lineTo(x0 + (R + 0.28) * Math.sin(th), R - (R + 0.28) * Math.cos(th));
    }
    const rampGeo = new THREE.ExtrudeGeometry(ring, { depth: W, bevelEnabled: false, curveSegments: 1 });
    rampGeo.translate(0, 0, -W / 2);
    const ramp = new THREE.Mesh(
      rampGeo,
      new THREE.MeshPhysicalMaterial({ color: "#1b1c20", metalness: 0.7, roughness: 0.35, clearcoat: 0.6 }),
    );
    arena.add(ramp);
    for (const z of [W / 2 + 0.01, -W / 2 - 0.01]) {
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= steps; i++) {
        const th = t0 + ((t1 - t0) * i) / steps;
        pts.push(new THREE.Vector3(x0 + (R + 0.04) * Math.sin(th), R - (R + 0.04) * Math.cos(th), z));
      }
      arena.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 160, 0.025, 6), red));
    }
    // ramp supports
    const strut = new THREE.MeshStandardMaterial({ color: "#2a2b30", metalness: 0.8, roughness: 0.4 });
    for (const th of [1.1, 1.6, 2.2, 2.9, 3.35]) {
      const x = x0 + (R + 0.28) * Math.sin(th), y = R - (R + 0.28) * Math.cos(th);
      for (const z of [W / 2 - 0.15, -W / 2 + 0.15]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, y, 8), strut);
        post.position.set(x, y / 2, z);
        arena.add(post);
      }
    }

    // vehicle lineup, parked abreast with noses to camera
    const totalW = LINEUP.reduce((s, v) => s + v.width, 0) + 0.7 * (LINEUP.length - 1);
    let cx = -totalW / 2;
    for (const v of LINEUP) {
      const g = buildVehicle(v);
      g.rotation.y = -Math.PI / 2; // length along z, nose toward +z
      g.position.set(cx + v.width / 2, 0, 0);
      arena.add(g);
      cx += v.width + 0.7;
    }

    // hanging spot cones
    const spots = [
      { x: -30, c: "#9fc3ff" },
      { x: -18, c: "#ffffff" },
      { x: -2, c: "#9fc3ff" },
      { x: 10, c: "#ffffff" },
    ].map(({ x, c }) => {
      const s = spotCone(c);
      s.cone.position.set(x, 8, -3);
      arena.add(s.cone);
      return s;
    });

    // smoke trails (scroll-driven)
    const noz = nozzleLocal(dims.length, dims.height);
    const flipTrail = createTrail(sampleTrail(flipPose, pivotY, noz, 90, 0.11), 0.38, 0.9);
    const rampTrail = createTrail(sampleTrail((p) => rampPose(p, pivotY), pivotY, noz, 160, 0.37), 0.32, 1.2);
    const hopTrail = createTrail(sampleTrail(hopPose, pivotY, noz, 170, 0.73), 0.3, 1.25);

    // touchdown clouds: the footage shows each landing swallowed in white gas
    const cloud = (x: number, p: number, seed: number) => {
      const out: { pos: THREE.Vector3; birth: number; seed: number }[] = [];
      let r = seed;
      const rnd = () => ((r = (r * 16807) % 2147483647) / 2147483647);
      for (let i = 0; i < 34; i++) {
        out.push({
          pos: new THREE.Vector3(x + (rnd() - 0.5) * 6, 0.25 + rnd() * 1.1, (rnd() - 0.5) * 4.4),
          birth: p - 0.015 + rnd() * 0.07,
          seed: rnd(),
        });
      }
      return out;
    };
    const rampCloud = createTrail(cloud(LANDINGS.ramp.x, LANDINGS.ramp.p, 4242), 0.42, 2.6);
    const hopCloud = createTrail(cloud(LANDINGS.hop.x, LANDINGS.hop.p, 9191), 0.5, 2.9);

    return { arena, spots, flipTrail, rampTrail, hopTrail, rampCloud, hopCloud };
  }, [dims.length, dims.height, pivotY]);

  useFrame(() => {
    const a = rig.arena;
    parts.arena.visible = a > 0.001;
    for (const s of parts.spots) s.mat.uniforms.uOpacity.value = 0.11 * a;
    const { flipTrail, rampTrail, hopTrail, rampCloud, hopCloud } = parts;
    flipTrail.mat.uniforms.uP.value = rig.stunt.flip;
    flipTrail.mesh.visible = rig.stunt.flip > 0 && rig.stunt.flip < 1.4;
    rampTrail.mat.uniforms.uP.value = rig.stunt.ramp;
    rampTrail.mesh.visible = a > 0.001 && rig.stunt.ramp > 0;
    hopTrail.mat.uniforms.uP.value = rig.stunt.hop;
    hopTrail.mesh.visible = a > 0.001 && rig.stunt.hop > 0;
    rampCloud.mat.uniforms.uP.value = rig.stunt.ramp;
    rampCloud.mesh.visible = a > 0.001 && rig.stunt.ramp > 0.8;
    hopCloud.mat.uniforms.uP.value = rig.stunt.hop;
    hopCloud.mesh.visible = a > 0.001 && rig.stunt.hop > 0.7;
  });

  return (
    <>
      <primitive object={parts.arena} />
      <primitive object={parts.flipTrail.mesh} />
      <primitive object={parts.rampTrail.mesh} />
      <primitive object={parts.hopTrail.mesh} />
      <primitive object={parts.rampCloud.mesh} />
      <primitive object={parts.hopCloud.mesh} />
    </>
  );
}

