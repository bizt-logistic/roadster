import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { CarMaterials } from "./Materials";

// A Roadster-inspired grand tourer built entirely from code. It is the
// fallback when no licensed glTF model is installed, and it follows the same
// conventions as the optimised model: length along X (front = +X), ground at
// y = 0, centred on z = 0, units in metres.
//
// The body is lofted from ~220 cross-sections. Each half-section runs from the
// floor, up an inner wheel-well wall, out across the arch, up the flank and
// over a superelliptic shoulder to the spine. Because the arch height is a
// per-station function, wheel openings fall out of the loft naturally.

export const CAR = {
  length: 4.5,
  height: 1.14,
  axleFront: 1.42,
  axleRear: -1.4,
  wheelR: 0.355,
  wheelZ: 0.8,
  wheelW: 0.29,
};

type Key = [number, number];

/** Monotone cubic (Fritsch–Carlson) interpolation through keyframes. */
function curve(keys: Key[]) {
  const n = keys.length;
  const xs = keys.map((k) => k[0]);
  const ys = keys.map((k) => k[1]);
  const d: number[] = [];
  const m: number[] = new Array(n).fill(0);
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  m[0] = d[0];
  m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i];
    const s = a * a + b * b;
    if (s > 9) { const t = 3 / Math.sqrt(s); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
  }
  return (x: number) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    while (x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i];
    const t = (x - xs[i]) / h;
    const t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
  };
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// ── Side elevation & plan curves (u: 0 = tail, 1 = nose) ─────────────────────
const H = curve([[0, 0.7], [0.03, 0.78], [0.09, 0.83], [0.2, 0.86], [0.32, 0.87], [0.5, 0.86], [0.66, 0.83], [0.74, 0.8], [0.84, 0.7], [0.92, 0.6], [0.97, 0.52], [1, 0.44]]);
const SH = curve([[0, 0.58], [0.1, 0.62], [0.22, 0.64], [0.5, 0.6], [0.8, 0.6], [0.93, 0.52], [1, 0.4]]);
const W = curve([[0, 0.8], [0.03, 0.9], [0.1, 0.98], [0.2, 1.0], [0.3, 0.98], [0.45, 0.93], [0.6, 0.94], [0.76, 0.98], [0.86, 0.97], [0.93, 0.9], [0.98, 0.76], [1, 0.62]]);
const B0 = curve([[0, 0.3], [0.05, 0.16], [0.95, 0.15], [1, 0.22]]);
const SILL = curve([[0, 0.34], [0.05, 0.25], [0.12, 0.2], [0.88, 0.2], [0.95, 0.22], [1, 0.26]]);
const FENDER = curve([[0, 0], [0.12, 0.035], [0.2, 0.05], [0.3, 0.0], [0.72, 0.0], [0.82, 0.075], [0.9, 0.055], [1, 0]]);

const ROOF = curve([[0.29, 0.87], [0.36, 0.99], [0.45, 1.1], [0.52, 1.135], [0.58, 1.115], [0.66, 0.99], [0.755, 0.8]]);
const CANOPY_W = curve([[0.29, 0.4], [0.36, 0.6], [0.5, 0.68], [0.62, 0.74], [0.7, 0.76], [0.755, 0.72]]);

const L = CAR.length;
const END = 0.035;
const SE_N = 2.6;

const uToX = (u: number) => -L / 2 + u * L;

function endFactor(u: number) {
  if (u < END) { const t = 1 - u / END; return Math.sqrt(Math.max(0, 1 - t * t)); }
  if (u > 1 - END) { const t = 1 - (1 - u) / END; return Math.sqrt(Math.max(0, 1 - t * t)); }
  return 1;
}

const ARCH_R = 0.45;
const ARCH_CY = 0.3;

function archHeight(x: number) {
  let y = 0;
  for (const ax of [CAR.axleFront, CAR.axleRear]) {
    const dx = x - ax;
    if (Math.abs(dx) < ARCH_R) y = Math.max(y, ARCH_CY + Math.sqrt(ARCH_R * ARCH_R - dx * dx));
  }
  return y;
}

const spow = (v: number, p: number) => Math.sign(v) * Math.pow(Math.abs(v), p);

/** Station profile shared by the loft and everything seated on the body. */
function profile(u: number) {
  const x = uToX(u);
  const f = endFactor(u);
  const w = W(u) * f;
  const arch = archHeight(x);
  // Fenders swell over the wheels: the shoulder rises to clear the arch.
  const sh = Math.max(SH(u), arch + 0.05);
  const bulge = FENDER(u);
  const top = Math.max(H(u), sh - bulge + 0.04);
  const b0 = B0(u);
  const bs = Math.min(sh - 0.05, Math.max(SILL(u), arch));
  return { x, f, w, sh, top, bulge, b0, bs };
}

type Section = { z: number[]; y: number[]; dark: number[] };

/** Right half (z ≥ 0) cross-section from floor centre to spine. */
function section(u: number): Section {
  const { f, w, sh, top, b0, bs } = profile(u);
  const zi = Math.max(0.04, w - 0.36);
  const z: number[] = [];
  const y: number[] = [];
  const dark: number[] = [];
  const push = (zz: number, yy: number, dk: number) => { z.push(zz); y.push(yy); dark.push(dk); };

  for (let i = 0; i <= 3; i++) push((zi * i) / 3, b0, 1);
  for (let i = 1; i <= 3; i++) push(zi, b0 + ((bs - b0) * i) / 3, 1);
  for (let i = 1; i <= 3; i++) push(zi + ((w * 0.985 - zi) * i) / 3, bs, 1);
  push(w * 0.985, bs, 0); // duplicate for a crisp trim/paint edge
  for (let i = 1; i <= 4; i++) {
    const t = i / 4;
    push(w * (0.985 + 0.015 * Math.sin((t * Math.PI) / 2)), bs + (sh - bs) * t, 0);
  }
  const N = 16;
  const { bulge } = profile(u);
  for (let i = 1; i <= N; i++) {
    const th = (i / N) * (Math.PI / 2);
    const zz = w * Math.pow(Math.cos(th), 2 / SE_N);
    const b = bulge * smooth(0.5, 0.9, zz / Math.max(w, 1e-3));
    push(zz, sh + (top + b - sh) * Math.pow(Math.sin(th), 2 / SE_N), 0);
  }
  // Collapse towards the vertical centre at the nose and tail.
  const mid = (b0 + top) / 2;
  for (let i = 0; i < y.length; i++) y[i] = mid + (y[i] - mid) * (0.15 + 0.85 * f);
  return { z, y, dark };
}

/** Height of the body's upper surface at lateral offset z (for seating the canopy). */
function bodyTopY(u: number, z: number) {
  const { f, w, sh, top, bulge, b0 } = profile(u);
  const r = Math.min(1, Math.abs(z) / Math.max(w, 1e-4));
  const th = Math.acos(Math.pow(r, SE_N / 2));
  const y = sh + (top + bulge * smooth(0.5, 0.9, r) - sh) * Math.pow(Math.sin(th), 2 / SE_N);
  const mid = (b0 + top) / 2;
  return mid + (y - mid) * (0.15 + 0.85 * f);
}

const STATIONS = 220;

function loftBody() {
  const sample = section(0.5);
  const half = sample.z.length;
  const ring = half * 2 - 2;
  const pos: number[] = [];
  const col: number[] = [];
  const uv: number[] = [];
  for (let s = 0; s <= STATIONS; s++) {
    const u = s / STATIONS;
    const x = uToX(u);
    const sec = section(u);
    const order: [number, number, number][] = [];
    for (let i = 0; i < half; i++) order.push([sec.z[i], sec.y[i], sec.dark[i]]);
    for (let i = half - 2; i >= 1; i--) order.push([-sec.z[i], sec.y[i], sec.dark[i]]);
    order.forEach(([zz, yy, dk], i) => {
      pos.push(x, yy, zz);
      const c = dk ? 0.035 : 1;
      col.push(c, c, c);
      uv.push((s / STATIONS) * L, (i / ring) * 4.2); // ≈ metres, for the flake map
    });
  }
  const idx: number[] = [];
  for (let s = 0; s < STATIONS; s++) {
    for (let i = 0; i < ring; i++) {
      const a = s * ring + i;
      const b = s * ring + ((i + 1) % ring);
      const c = (s + 1) * ring + i;
      const d = (s + 1) * ring + ((i + 1) % ring);
      idx.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function loftCanopy() {
  const u0 = 0.29, u1 = 0.755, S = 90, N = 28;
  const pos: number[] = [];
  for (let s = 0; s <= S; s++) {
    const u = u0 + ((u1 - u0) * s) / S;
    const x = uToX(u);
    const wc = CANOPY_W(u);
    const base0 = bodyTopY(u, 0);
    const hc = Math.max(0, ROOF(u) - base0);
    for (let j = 0; j <= N; j++) {
      const phi = (j / N) * Math.PI;
      const z = wc * spow(Math.cos(phi), 2 / 2.3);
      const y = bodyTopY(u, z) + 0.006 + hc * Math.pow(Math.sin(phi), 2 / 2.3);
      pos.push(x, y, z);
    }
  }
  const idx: number[] = [];
  for (let s = 0; s < S; s++) for (let j = 0; j < N; j++) {
    const a = s * (N + 1) + j, b = a + 1, c = a + N + 1, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// ── Surface patches (lights, intakes) laid onto the body ─────────────────────
function perimeterPoint(u: number, s: number, side: 1 | -1) {
  const sec = section(u);
  const n = sec.z.length;
  const len: number[] = [0];
  for (let i = 1; i < n; i++) len.push(len[i - 1] + Math.hypot(sec.z[i] - sec.z[i - 1], sec.y[i] - sec.y[i - 1]));
  const target = Math.min(1, Math.max(0, s)) * len[n - 1];
  let i = 1;
  while (i < n - 1 && len[i] < target) i++;
  const t = (target - len[i - 1]) / Math.max(1e-6, len[i] - len[i - 1]);
  const z = sec.z[i - 1] + (sec.z[i] - sec.z[i - 1]) * t;
  const y = sec.y[i - 1] + (sec.y[i] - sec.y[i - 1]) * t;
  return new THREE.Vector3(uToX(u), y, z * side);
}

function surfacePatch(
  fn: (a: number, b: number) => [number, number],
  side: 1 | -1,
  segA = 18,
  segB = 3,
  lift = 0.004,
) {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= segA; i++) for (let j = 0; j <= segB; j++) {
    const [u, s] = fn(i / segA, j / segB);
    pts.push(perimeterPoint(u, s, side));
  }
  // Lift along the approximate outward normal.
  const g = new THREE.BufferGeometry();
  const pos = new Float32Array(pts.length * 3);
  const centre = new THREE.Vector3();
  pts.forEach((p) => centre.add(p));
  centre.divideScalar(pts.length);
  pts.forEach((p, k) => {
    const [u, s] = fn(Math.floor(k / (segB + 1)) / segA, (k % (segB + 1)) / segB);
    const pa = perimeterPoint(u + 0.004, s, side), pb = perimeterPoint(u, s + 0.01, side);
    const n = new THREE.Vector3().subVectors(pa, p).cross(new THREE.Vector3().subVectors(pb, p)).normalize();
    if (n.dot(new THREE.Vector3(p.x * 0.2, p.y - 0.4, p.z)) < 0) n.negate();
    pos[k * 3] = p.x + n.x * lift; pos[k * 3 + 1] = p.y + n.y * lift; pos[k * 3 + 2] = p.z + n.z * lift;
  });
  const idx: number[] = [];
  for (let i = 0; i < segA; i++) for (let j = 0; j < segB; j++) {
    const a = i * (segB + 1) + j, b = a + 1, c = a + segB + 1, d = c + 1;
    if (side === 1) idx.push(a, c, b, b, c, d); else idx.push(a, b, c, b, d, c);
  }
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function bothSides(fn: (a: number, b: number) => [number, number], segA?: number, segB?: number, lift?: number) {
  return mergeGeometries([surfacePatch(fn, 1, segA, segB, lift), surfacePatch(fn, -1, segA, segB, lift)]);
}

// ── Wheels ───────────────────────────────────────────────────────────────────
function tireGeometry() {
  const R = CAR.wheelR, hw = CAR.wheelW / 2, rr = 0.27;
  const prof = [
    [rr, -hw * 0.95], [R - 0.03, -hw], [R - 0.008, -hw * 0.86], [R, -hw * 0.62],
    [R, hw * 0.62], [R - 0.008, hw * 0.86], [R - 0.03, hw], [rr, hw * 0.95],
  ].map(([r, z]) => new THREE.Vector2(r, z));
  const g = new THREE.LatheGeometry(prof, 72);
  g.rotateX(Math.PI / 2);
  return g;
}

function rimFaceGeometry() {
  const outer = 0.262;
  const shape = new THREE.Shape();
  shape.absarc(0, 0, outer, 0, Math.PI * 2, false);
  const spokes = 10;
  for (let i = 0; i < spokes; i++) {
    const a0 = (i / spokes) * Math.PI * 2 + 0.11;
    const a1 = ((i + 1) / spokes) * Math.PI * 2 - 0.11;
    const twist = 0.16;
    const hole = new THREE.Path();
    const rIn = 0.085, rOut = 0.232;
    hole.moveTo(Math.cos(a0) * rIn, Math.sin(a0) * rIn);
    for (let k = 0; k <= 6; k++) {
      const t = k / 6;
      const r = rIn + (rOut - rIn) * t;
      const a = a0 + twist * t;
      hole.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    hole.absarc(0, 0, rOut, a0 + twist, a1 + twist, false);
    for (let k = 6; k >= 0; k--) {
      const t = k / 6;
      const r = rIn + (rOut - rIn) * t;
      const a = a1 + twist * t;
      hole.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    shape.holes.push(hole);
  }
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: 0.025,
    bevelEnabled: true,
    bevelSize: 0.006,
    bevelThickness: 0.006,
    bevelSegments: 2,
    curveSegments: 48,
  });
  return g;
}

function buildWheel(mats: CarMaterials, side: 1 | -1) {
  const wheel = new THREE.Group();
  const spinner = new THREE.Group();
  spinner.userData.spinDir = side;
  wheel.add(spinner);

  const tire = new THREE.Mesh(tireGeometry(), mats.rubber);
  tire.name = "tire";
  spinner.add(tire);

  const face = new THREE.Mesh(rimFaceGeometry(), mats.rim);
  face.position.z = CAR.wheelW * 0.5 - 0.06;
  face.name = "rim";
  spinner.add(face);

  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.262, 0.262, CAR.wheelW * 0.9, 48, 1, true), mats.rimInner);
  barrel.rotation.x = Math.PI / 2;
  spinner.add(barrel);

  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.04, 24), mats.rim);
  hub.rotation.x = Math.PI / 2;
  hub.position.z = CAR.wheelW * 0.5 - 0.03;
  spinner.add(hub);

  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.028, 48), mats.brake);
  disc.rotation.x = Math.PI / 2;
  disc.position.z = -0.02;
  wheel.add(disc);

  const caliper = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.16, 0.07), mats.caliper);
  caliper.position.set(-0.13, 0.11, 0.0);
  caliper.rotation.z = 0.7;
  wheel.add(caliper);

  if (side === -1) wheel.rotation.y = Math.PI;
  return { wheel, spinner };
}

// ── Assembly ─────────────────────────────────────────────────────────────────
export type BuiltCar = {
  root: THREE.Group;
  spinners: THREE.Object3D[];
  bodyMeshes: THREE.Mesh[];
  allMeshes: THREE.Mesh[];
  panelLines: THREE.BufferGeometry;
};

export function buildProceduralRoadster(mats: CarMaterials): BuiltCar {
  const root = new THREE.Group();
  root.name = "procedural-roadster";

  const body = new THREE.Mesh(loftBody(), mats.paintVC);
  body.name = "body";
  root.add(body);

  const canopy = new THREE.Mesh(loftCanopy(), mats.glass);
  canopy.name = "canopy";
  root.add(canopy);

  // Headlights: slim almond slits on the leading edge of each front fender.
  const headFn = (a: number, b: number): [number, number] => {
    const width = 0.012 + 0.035 * Math.sin(Math.PI * a);
    return [0.915 + 0.065 * a, 0.69 + 0.12 * a + (b - 0.5) * width];
  };
  const headHousing = new THREE.Mesh(bothSides((a, b) => {
    const [u, s] = headFn(a, b);
    return [u, 0.69 + (s - 0.69) * 1.6 + 0.12 * a * -0.6];
  }, 18, 3, 0.003), mats.trimGloss);
  const head = new THREE.Mesh(bothSides(headFn, 18, 3, 0.005), mats.headlight);
  headHousing.name = "headlight-housing";
  head.name = "headlight";
  root.add(headHousing, head);

  // Full-width tail light bar wrapping the Kamm tail.
  const tail = new THREE.Mesh(bothSides((a, b) => [0.03 + b * 0.007, 0.56 + a * 0.44], 24, 1, 0.004), mats.taillight);
  tail.name = "taillight";
  root.add(tail);

  // Dark technical surfaces: front intake, rear diffuser, side scoops.
  const intake = new THREE.Mesh(bothSides((a, b) => [0.968 + 0.02 * b, 0.36 + 0.28 * a], 12, 2, 0.003), mats.trimMatte);
  const diffuser = new THREE.Mesh(bothSides((a, b) => [0.012 + 0.03 * b, 0.33 + 0.2 * a], 12, 2, 0.003), mats.trimMatte);
  const scoop = new THREE.Mesh(bothSides((a, b) => {
    const h = 0.05 * Math.sin(Math.PI * a) + 0.004;
    return [0.3 + 0.075 * a, 0.47 + (b - 0.5) * h * 2];
  }, 16, 2, 0.003), mats.trimMatte);
  intake.name = "intake";
  diffuser.name = "diffuser";
  scoop.name = "side-scoop";
  root.add(intake, diffuser, scoop);

  // Mirrors on short stalks at the base of the A-pillar.
  for (const side of [1, -1] as const) {
    const mirror = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), mats.paint);
    mirror.scale.set(0.11, 0.045, 0.07);
    const u = 0.705;
    const z = (CANOPY_W(u) + 0.075) * side;
    mirror.position.set(uToX(u), bodyTopY(u, Math.abs(z)) + 0.13, z);
    mirror.rotation.y = -0.15 * side;
    mirror.name = "mirror";
    root.add(mirror);
    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.012, 0.12, 8), mats.trimGloss);
    stalk.position.set(uToX(u) - 0.02, bodyTopY(u, Math.abs(z)) + 0.07, z - 0.03 * side);
    stalk.rotation.x = 0.6 * side;
    root.add(stalk);
  }

  const spinners: THREE.Object3D[] = [];
  for (const ax of [CAR.axleFront, CAR.axleRear]) for (const side of [1, -1] as const) {
    const { wheel, spinner } = buildWheel(mats, side);
    wheel.position.set(ax, CAR.wheelR, CAR.wheelZ * side);
    wheel.name = `wheel-${ax > 0 ? "F" : "R"}${side > 0 ? "R" : "L"}`;
    root.add(wheel);
    spinners.push(spinner);
  }

  // Panel shut lines (doors, frunk, charge port) as thin dark strokes.
  const panel: number[] = [];
  const strokes: ((t: number) => [number, number])[] = [
    (t) => [0.645 - 0.03 * t, 0.36 + 0.3 * t], // door leading edge
    (t) => [0.4 + 0.02 * t, 0.4 + 0.24 * t], // door trailing edge
    (t) => [0.4 + 0.245 * t, 0.4 - 0.02 * Math.sin(Math.PI * t) - 0.04 * (1 - t)], // door bottom
    (t) => [0.82 + 0.12 * t, 0.86 - 0.02 * t], // frunk edge
  ];
  for (const side of [1, -1] as const) for (const fn of strokes) {
    let prev: THREE.Vector3 | null = null;
    for (let i = 0; i <= 24; i++) {
      const [u, s] = fn(i / 24);
      const p = perimeterPoint(u, s, side);
      p.multiplyScalar(1).add(new THREE.Vector3(0, 0, 0.0025 * side));
      if (prev) panel.push(prev.x, prev.y, prev.z, p.x, p.y, p.z);
      prev = p;
    }
  }
  const panelLines = new THREE.BufferGeometry();
  panelLines.setAttribute("position", new THREE.Float32BufferAttribute(panel, 3));

  root.updateMatrixWorld(true);
  const allMeshes: THREE.Mesh[] = [];
  root.traverse((o) => { if ((o as THREE.Mesh).isMesh) allMeshes.push(o as THREE.Mesh); });

  return { root, spinners, bodyMeshes: [body], allMeshes, panelLines };
}

export const PROCEDURAL_WHEELS = [CAR.axleFront, CAR.axleRear].flatMap((x) =>
  [1, -1].map((s) => ({ x, y: CAR.wheelR, z: CAR.wheelZ * s, r: CAR.wheelR, w: CAR.wheelW })),
);
