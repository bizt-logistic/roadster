import * as THREE from "three";

// Illustrative X-ray "anatomy" of the production Roadster, built from the
// systems Tesla described at the 15 Oct 2026 reveal (as reported by
// TechCrunch, Teslarati and Wikipedia):
//   • structure / chassis with active aero
//   • 800 V battery of 4680 cells
//   • two rear motors
//   • composite gas tanks (200 L in the trunk for Thrust; +400 L in place of
//     the passenger seat for Rocket)
//   • cold-gas thrusters: 4 rear (Thrust), 10 around the body (Rocket)
//   • suction fan + ground-sealing skirt
// Tesla has not published the internal packaging; positions are an
// informed illustration scaled to the car, not engineering data.
//
// Car space: length along X (front = +X), ground y = 0, centred on z = 0.

export type AnatomyPart = {
  key: string;
  group: THREE.Group;
  materials: THREE.Material[];
  anchor: [number, number, number];
};

export type Anatomy = {
  root: THREE.Group;
  parts: AnatomyPart[];
  /** nozzle positions + directions (car-local) for the perimeter jets */
  perimeterNozzles: { pos: THREE.Vector3; dir: THREE.Vector3 }[];
  dispose: () => void;
};

const glow = (color: string, emissive = 1.6, opacity = 1) =>
  new THREE.MeshStandardMaterial({
    color: "#0b0e14",
    emissive: color,
    emissiveIntensity: emissive,
    metalness: 0.4,
    roughness: 0.35,
    transparent: true,
    opacity,
    depthWrite: true,
  });

const lineMat = (color: string, opacity = 0.9) =>
  new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false });

function tube(points: THREE.Vector3[], r: number, mat: THREE.Material, closed = false) {
  const curve = new THREE.CatmullRomCurve3(points, closed, "catmullrom", 0.2);
  return new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(16, points.length * 12), r, 8, closed), mat);
}

function capsule(radius: number, length: number, mat: THREE.Material) {
  return new THREE.Mesh(new THREE.CapsuleGeometry(radius, length, 8, 24), mat);
}

export function buildAnatomy(dims: { length: number; height: number; width: number; axles: number[]; wheelR: number }): Anatomy {
  const L = dims.length, H = dims.height, W = dims.width;
  const rearX = Math.min(...dims.axles), frontX = Math.max(...dims.axles);
  const root = new THREE.Group();
  root.name = "anatomy";
  const parts: AnatomyPart[] = [];
  const all: THREE.Material[] = [];
  const reg = <T extends THREE.Material>(m: T) => (all.push(m), m);

  // ── 1 · structure: skateboard rails + safety cell hoops ────────────────
  {
    const g = new THREE.Group();
    const m = reg(glow("#7fd6ff", 1.4));
    const railZ = W * 0.36, y = 0.24;
    for (const z of [railZ, -railZ]) {
      g.add(tube([new THREE.Vector3(-L * 0.46, y + 0.06, z * 0.8), new THREE.Vector3(rearX, y, z), new THREE.Vector3(0, y - 0.02, z), new THREE.Vector3(frontX, y, z), new THREE.Vector3(L * 0.46, y + 0.08, z * 0.75)], 0.018, m));
      // A-pillar → roof hoop → C-pillar
      g.add(tube([new THREE.Vector3(frontX * 0.62, y, z * 0.95), new THREE.Vector3(L * 0.09, H * 0.82, z * 0.72), new THREE.Vector3(-L * 0.05, H * 0.93, z * 0.6), new THREE.Vector3(-L * 0.24, H * 0.72, z * 0.7), new THREE.Vector3(rearX * 0.7, y + 0.1, z * 0.92)], 0.014, m));
    }
    for (const x of [-L * 0.42, rearX, -L * 0.1, L * 0.12, frontX, L * 0.43]) {
      g.add(tube([new THREE.Vector3(x, 0.24, railZ), new THREE.Vector3(x, 0.22, 0), new THREE.Vector3(x, 0.24, -railZ)], 0.012, m));
    }
    // roof hoop cross member
    g.add(tube([new THREE.Vector3(-L * 0.05, H * 0.93, railZ * 0.6), new THREE.Vector3(-L * 0.05, H * 0.97, 0), new THREE.Vector3(-L * 0.05, H * 0.93, -railZ * 0.6)], 0.014, m));
    parts.push({ key: "structure", group: g, materials: [m], anchor: [-L * 0.05, H * 0.97, 0] });
  }

  // ── 2 · battery: 4680 cells in a structural pack ───────────────────────
  {
    const g = new THREE.Group();
    const x0 = rearX + 0.35, x1 = frontX - 0.45;
    const zW = W * 0.62, y0 = 0.11, yH = 0.1;
    const caseMat = reg(lineMat("#3ee6c1", 0.85));
    const box = new THREE.BoxGeometry(x1 - x0, yH + 0.02, zW);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(box), caseMat);
    edges.position.set((x0 + x1) / 2, y0 + yH / 2, 0);
    g.add(edges);
    const cellMat = reg(glow("#3ee6c1", 1.1));
    const r = 0.023, pitch = 0.05;
    const nx = Math.floor((x1 - x0 - 0.04) / pitch), nz = Math.floor((zW - 0.04) / pitch);
    const cells = new THREE.InstancedMesh(new THREE.CylinderGeometry(r, r, yH * 0.82, 10), cellMat, nx * nz);
    const m4 = new THREE.Matrix4();
    let i = 0;
    for (let a = 0; a < nx; a++) for (let b = 0; b < nz; b++) {
      const off = b % 2 ? pitch / 2 : 0;
      m4.makeTranslation(x0 + 0.03 + a * pitch + off, y0 + yH / 2, -zW / 2 + 0.03 + b * pitch);
      cells.setMatrixAt(i++, m4);
    }
    cells.count = i;
    g.add(cells);
    parts.push({ key: "battery", group: g, materials: [caseMat, cellMat], anchor: [(x0 + x1) / 2, y0 + yH, zW / 2] });
  }

  // ── 3 · two rear motors + inverter + half-shafts ───────────────────────
  {
    const g = new THREE.Group();
    const m = reg(glow("#ff9a3c", 1.5));
    const shaft = reg(glow("#ffd2a0", 0.9));
    for (const z of [0.3, -0.3]) {
      const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.3, 28), m);
      motor.rotation.x = Math.PI / 2;
      motor.position.set(rearX + 0.05, dims.wheelR * 0.95, z);
      g.add(motor);
      const hs = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, W * 0.36, 10), shaft);
      hs.rotation.x = Math.PI / 2;
      hs.position.set(rearX, dims.wheelR, z > 0 ? z + W * 0.2 : z - W * 0.2);
      g.add(hs);
    }
    const inv = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.12, 0.42), m);
    inv.position.set(rearX + 0.32, dims.wheelR * 1.25, 0);
    g.add(inv);
    parts.push({ key: "motors", group: g, materials: [m, shaft], anchor: [rearX + 0.05, dims.wheelR * 1.35, 0.3] });
  }

  // ── 4 · composite gas tanks (COPVs) ────────────────────────────────────
  {
    const g = new THREE.Group();
    const m = reg(glow("#e8eef8", 1.2));
    // Thrust: ~200 L in the trunk (two vessels across the rear)
    for (const z of [0.26, -0.26]) {
      const t = capsule(0.13, 0.62, m);
      t.rotation.z = Math.PI / 2;
      t.position.set(rearX - 0.38, H * 0.48, z);
      g.add(t);
    }
    // Rocket: +400 L in place of the passenger seat
    const seat = capsule(0.19, 0.55, m);
    seat.rotation.x = Math.PI / 2;
    seat.rotation.z = 0.25;
    seat.position.set(-L * 0.06, H * 0.42, -W * 0.18);
    g.add(seat);
    parts.push({ key: "tanks", group: g, materials: [m], anchor: [-L * 0.06, H * 0.6, -W * 0.18] });
  }

  // ── 5 · thrusters + plumbing ───────────────────────────────────────────
  const perimeterNozzles: Anatomy["perimeterNozzles"] = [];
  {
    const g = new THREE.Group();
    const m = reg(glow("#ff2a3c", 2.2));
    const pipe = reg(glow("#ff6070", 1.0, 0.85));
    const nozzle = (pos: THREE.Vector3, dir: THREE.Vector3) => {
      const n = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.06, 0.1, 18, 1, true), m);
      n.position.copy(pos);
      n.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir.clone().normalize());
      g.add(n);
    };
    const hub = new THREE.Vector3(rearX - 0.2, H * 0.4, 0);
    // rear (Thrust): four in the diffuser
    for (const z of [-0.62, -0.22, 0.22, 0.62]) {
      const p = new THREE.Vector3(-L / 2 + 0.04, H * 0.3, z);
      nozzle(p, new THREE.Vector3(-1, 0, 0));
      g.add(tube([hub, new THREE.Vector3(-L / 2 + 0.3, H * 0.34, z * 0.8), p], 0.012, pipe));
    }
    // Rocket: one per corner (lift / attitude, firing down) + one per flank (yaw)
    const corners = [
      new THREE.Vector3(L * 0.42, 0.2, W * 0.4),
      new THREE.Vector3(L * 0.42, 0.2, -W * 0.4),
      new THREE.Vector3(-L * 0.42, 0.2, W * 0.4),
      new THREE.Vector3(-L * 0.42, 0.2, -W * 0.4),
    ];
    for (const c of corners) {
      nozzle(c, new THREE.Vector3(0, -1, 0));
      perimeterNozzles.push({ pos: c, dir: new THREE.Vector3(0, -1, 0) });
      g.add(tube([hub, new THREE.Vector3(c.x * 0.6, 0.3, c.z * 0.85), c], 0.01, pipe));
    }
    for (const s of [1, -1]) {
      const f = new THREE.Vector3(0.1, H * 0.35, (W / 2 - 0.02) * s);
      nozzle(f, new THREE.Vector3(0, 0, s));
      perimeterNozzles.push({ pos: f, dir: new THREE.Vector3(0, 0, s) });
      g.add(tube([hub, new THREE.Vector3(-0.6, H * 0.36, W * 0.3 * s), f], 0.01, pipe));
    }
    parts.push({ key: "thrusters", group: g, materials: [m, pipe], anchor: [-L / 2 + 0.04, H * 0.3, 0.62] });
  }

  // ── 6 · suction fan + ground-sealing skirt ─────────────────────────────
  {
    const g = new THREE.Group();
    const m = reg(glow("#8f7cff", 1.6));
    const fan = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.018, 10, 48), m);
    ring.rotation.x = Math.PI / 2;
    fan.add(ring);
    for (let i = 0; i < 9; i++) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.008, 0.05), m);
      blade.position.x = 0.11;
      const pivot = new THREE.Group();
      pivot.rotation.y = (i / 9) * Math.PI * 2;
      blade.rotation.x = 0.5;
      pivot.add(blade);
      fan.add(pivot);
    }
    fan.position.set(-L * 0.12, 0.08, 0);
    fan.name = "suction-fan";
    g.add(fan);
    const skirt = reg(lineMat("#8f7cff", 0.9));
    const pts: number[] = [];
    const sx = L * 0.38, sz = W * 0.44, y = 0.04;
    const rect = [[sx, sz], [-sx, sz], [-sx, -sz], [sx, -sz], [sx, sz]];
    for (let i = 0; i < rect.length - 1; i++) pts.push(rect[i][0], y, rect[i][1], rect[i + 1][0], y, rect[i + 1][1]);
    const sk = new THREE.BufferGeometry();
    sk.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    g.add(new THREE.LineSegments(sk, skirt));
    parts.push({ key: "fan", group: g, materials: [m, skirt], anchor: [-L * 0.12, 0.1, 0.25] });
  }

  for (const p of parts) {
    p.group.visible = false;
    p.materials.forEach((m) => (m.userData.baseOpacity = m.opacity));
    root.add(p.group);
  }
  root.userData.noShadowBake = true;

  return {
    root,
    parts,
    perimeterNozzles,
    dispose: () => {
      root.traverse((o) => (o as THREE.Mesh).geometry?.dispose?.());
      all.forEach((m) => m.dispose());
    },
  };
}

/** Fresnel "ghost" material for the see-through body shell. */
export function createGhostMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: { uAmount: { value: 0 }, uColor: { value: new THREE.Color("#9fdcff") } },
    vertexShader: /* glsl */ `
      varying vec3 vN;
      varying vec3 vV;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uAmount;
      uniform vec3 uColor;
      varying vec3 vN;
      varying vec3 vV;
      void main() {
        float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.6);
        float a = (0.05 + f * 0.75) * uAmount;
        gl_FragColor = vec4(uColor * a, a);
      }
    `,
  });
}
