import * as THREE from "three";

// Pen-drawing shader for LineSegments carrying `draw` (time at which each
// vertex is reached by the pen) and `cat` (stroke category) attributes.
//   - fragments beyond the pen (`draw > uProgress`) are discarded
//   - fragments before `uErase` are discarded (lines can be "un-drawn")
//   - a hot accent at the pen tip sells the live-sketch feel
//   - lines dissolve behind the material scanner (`uSweepX`, car space)

export function createLineMaterial(opts: { ink?: string; accent?: string; construct?: string; opacity?: number } = {}) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: true,
    uniforms: {
      uProgress: { value: 0 },
      uErase: { value: -1 },
      uOpacity: { value: opts.opacity ?? 1 },
      uSweepX: { value: 10 },
      uSweepOn: { value: 0 },
      uXray: { value: 0 },
      uXrayInk: { value: new THREE.Color("#8fdcff") },
      uInk: { value: new THREE.Color(opts.ink ?? "#16181b") },
      uAccent: { value: new THREE.Color(opts.accent ?? "#e31937") },
      uConstruct: { value: new THREE.Color(opts.construct ?? "#8d949c") },
    },
    vertexShader: /* glsl */ `
      attribute float draw;
      attribute float cat;
      varying float vDraw;
      varying float vCat;
      varying float vX;
      void main() {
        vDraw = draw;
        vCat = cat;
        vX = position.x;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uProgress;
      uniform float uErase;
      uniform float uOpacity;
      uniform float uSweepX;
      uniform float uSweepOn;
      uniform float uXray;
      uniform vec3 uXrayInk;
      uniform vec3 uInk;
      uniform vec3 uAccent;
      uniform vec3 uConstruct;
      varying float vDraw;
      varying float vCat;
      varying float vX;
      void main() {
        if (vDraw > uProgress || vDraw < uErase) discard;
        float age = uProgress - vDraw;
        float tip = 1.0 - smoothstep(0.0, 0.035, age);

        // 0 silhouette, 1 wheel, 2 contour, 3 section, 4 detail, 5 construction, 6 dimension
        float a = 1.0;
        vec3 col = uInk;
        if (vCat > 5.5) { col = uAccent; a = 0.9; }
        else if (vCat > 4.5) { col = uConstruct; a = 0.75; }
        else if (vCat > 3.5) { a = 0.6; }
        else if (vCat > 2.5) { col = mix(uInk, uConstruct, 0.55); a = 0.42; }
        else if (vCat > 1.5) { a = 0.78; }
        else if (vCat > 0.5) { a = 0.9; }

        col = mix(col, uAccent, tip * 0.85);

        float solid = smoothstep(uSweepX - 0.03, uSweepX + 0.45, vX) * uSweepOn * (1.0 - uXray);
        col = mix(col, uXrayInk, uXray);
        float band = exp(-abs(vX - uSweepX) * 16.0) * uSweepOn;
        col = mix(col, uAccent, band);
        a = a * (1.0 - solid * 0.94) + band * 0.5;

        gl_FragColor = vec4(col, clamp(a * uOpacity + tip * 0.25 * uOpacity, 0.0, 1.0));
      }
    `,
  });
}

/** Build a LineSegments geometry from baked buffers. */
export function lineGeometry(position: Float32Array, draw: Float32Array, cat: Float32Array) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(position, 3));
  g.setAttribute("draw", new THREE.BufferAttribute(draw, 1));
  g.setAttribute("cat", new THREE.BufferAttribute(cat, 1));
  g.computeBoundingSphere();
  return g;
}

// ── Construction geometry (ground line, axles, wheel circles, dimensions) ──

type Seg = { a: THREE.Vector3; b: THREE.Vector3; t0: number; t1: number; cat: number };

export type ConstructionSpec = {
  length: number;
  height: number;
  width: number;
  axles: number[];
  wheelR: number;
};

export function buildConstruction(spec: ConstructionSpec) {
  const { length: L, height: H, axles, wheelR: R } = spec;
  const z = spec.width / 2 + 0.12;
  const segs: Seg[] = [];
  const v = (x: number, y: number) => new THREE.Vector3(x, y, z);

  const line = (a: THREE.Vector3, b: THREE.Vector3, t0: number, t1: number, cat = 5, pieces = 24) => {
    for (let i = 0; i < pieces; i++) {
      const s0 = i / pieces, s1 = (i + 1) / pieces;
      segs.push({ a: a.clone().lerp(b, s0), b: a.clone().lerp(b, s1), t0: t0 + (t1 - t0) * s0, t1: t0 + (t1 - t0) * s1, cat });
    }
  };
  const dashed = (a: THREE.Vector3, b: THREE.Vector3, t0: number, t1: number, cat = 5, dash = 0.09) => {
    const len = a.distanceTo(b);
    const n = Math.max(2, Math.floor(len / dash));
    for (let i = 0; i < n; i += 2) {
      const s0 = i / n, s1 = Math.min(1, (i + 1) / n);
      segs.push({ a: a.clone().lerp(b, s0), b: a.clone().lerp(b, s1), t0: t0 + (t1 - t0) * s0, t1: t0 + (t1 - t0) * s1, cat });
    }
  };
  const circle = (cx: number, cy: number, r: number, t0: number, t1: number, cat = 5, dashedCircle = false) => {
    const n = 96;
    for (let i = 0; i < n; i++) {
      if (dashedCircle && i % 2) continue;
      const a0 = Math.PI / 2 + (i / n) * Math.PI * 2;
      const a1 = Math.PI / 2 + ((i + 1) / n) * Math.PI * 2;
      segs.push({
        a: v(cx + Math.cos(a0) * r, cy + Math.sin(a0) * r),
        b: v(cx + Math.cos(a1) * r, cy + Math.sin(a1) * r),
        t0: t0 + ((t1 - t0) * i) / n,
        t1: t0 + ((t1 - t0) * (i + 1)) / n,
        cat,
      });
    }
  };
  const tick = (x: number, y: number, t: number, cat = 6) => {
    segs.push({ a: v(x - 0.05, y - 0.05), b: v(x + 0.05, y + 0.05), t0: t, t1: t + 0.01, cat });
  };

  // Ground and horizon.
  line(v(-L / 2 - 0.9, 0), v(L / 2 + 0.9, 0), 0.0, 0.16, 5, 48);
  dashed(v(-L / 2 - 0.45, R), v(L / 2 + 0.45, R), 0.06, 0.22, 5);
  // Axle centre lines and wheel construction circles.
  axles.forEach((x, i) => {
    dashed(v(x, -0.2), v(x, H + 0.32), 0.08 + i * 0.03, 0.24 + i * 0.03, 5, 0.07);
    circle(x, R, R * 1.14, 0.12 + i * 0.05, 0.34 + i * 0.05, 5, true);
    circle(x, R, R * 0.36, 0.2 + i * 0.05, 0.32 + i * 0.05, 5);
  });
  // Wheelbase dimension.
  const yWb = -0.34;
  const [xa, xb] = [Math.min(...axles), Math.max(...axles)];
  line(v(xa, -0.06), v(xa, yWb - 0.08), 0.24, 0.3, 6, 4);
  line(v(xb, -0.06), v(xb, yWb - 0.08), 0.26, 0.32, 6, 4);
  line(v(xa, yWb), v(xb, yWb), 0.3, 0.46, 6, 32);
  tick(xa, yWb, 0.3);
  tick(xb, yWb, 0.45);
  // Overall length dimension.
  const yL = H + 0.3;
  line(v(-L / 2, H * 0.62), v(-L / 2, yL + 0.08), 0.3, 0.38, 6, 6);
  line(v(L / 2, H * 0.4), v(L / 2, yL + 0.08), 0.32, 0.4, 6, 6);
  line(v(-L / 2, yL), v(L / 2, yL), 0.38, 0.56, 6, 40);
  tick(-L / 2, yL, 0.38);
  tick(L / 2, yL, 0.55);
  // Height dimension.
  const xH = L / 2 + 0.55;
  line(v(xH - 0.1, H), v(xH + 0.08, H), 0.42, 0.46, 6, 3);
  line(v(xH, 0), v(xH, H), 0.46, 0.6, 6, 16);
  tick(xH, 0, 0.46);
  tick(xH, H, 0.59);

  const n = segs.length;
  const position = new Float32Array(n * 6);
  const draw = new Float32Array(n * 2);
  const cat = new Float32Array(n * 2);
  segs.forEach((s, i) => {
    position.set([s.a.x, s.a.y, s.a.z, s.b.x, s.b.y, s.b.z], i * 6);
    draw[i * 2] = s.t0;
    draw[i * 2 + 1] = s.t1;
    cat[i * 2] = cat[i * 2 + 1] = s.cat;
  });

  const anchors = {
    wheelbase: [(xa + xb) / 2, yWb - 0.02, z] as [number, number, number],
    length: [0, yL + 0.02, z] as [number, number, number],
    height: [xH, H / 2, z] as [number, number, number],
    wheel: [xb, R + R * 1.14, z] as [number, number, number],
  };
  return { geometry: lineGeometry(position, draw, cat), anchors };
}
