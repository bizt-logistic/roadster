"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { rig, domSync } from "@/lib/rig";
import { store } from "@/lib/store";
import { buildCarLineArt } from "@/lib/lineart.mjs";
import { adaptGltfMaterial, createCarMaterials, MATERIAL_HINTS } from "./Materials";
import { buildProceduralRoadster, CAR, PROCEDURAL_WHEELS } from "./ProceduralRoadster";
import { buildConstruction, createLineMaterial, lineGeometry } from "./lineShader";
import { createContactShadow } from "./contactShadow";
import { buildAnatomy, createGhostMaterial } from "./anatomy";

export type ModelManifest = {
  model: string;
  dims: { length: number; height: number; width: number; axles: number[]; wheelR: number };
  materials: { paint: string[]; glass: string[] };
  wheelNodes: string[];
};

type Spinner = { obj: THREE.Object3D; dir: number; axis?: THREE.Vector3 };

type CarAssembly = {
  root: THREE.Object3D;
  spinners: Spinner[];
  lines: THREE.BufferGeometry;
  meshes: THREE.Mesh[];
  dims: ModelManifest["dims"];
  extras: THREE.Object3D[];
};

const D2R = Math.PI / 180;

/** Shared clipping plane driven by the scanner sweep. */
const sweepPlane = new THREE.Plane(new THREE.Vector3(1, 0, 0), -10);

function toTriMesh(mesh: THREE.Mesh, rootInverse: THREE.Matrix4) {
  const g = mesh.geometry;
  const m = new THREE.Matrix4().multiplyMatrices(rootInverse, mesh.matrixWorld);
  const src = g.getAttribute("position");
  const pos = new Float32Array(src.count * 3);
  const v = new THREE.Vector3();
  for (let i = 0; i < src.count; i++) {
    v.fromBufferAttribute(src, i).applyMatrix4(m);
    pos[i * 3] = v.x; pos[i * 3 + 1] = v.y; pos[i * 3 + 2] = v.z;
  }
  const idx = g.index ? (g.index.array as Uint32Array) : null;
  return { pos, idx };
}

// ── Procedural fallback ─────────────────────────────────────────────────────
function useProceduralAssembly(): CarAssembly {
  return useMemo(() => {
    const mats = createCarMaterials(sweepPlane);
    const built = buildProceduralRoadster(mats);
    const inv = new THREE.Matrix4();
    const art = buildCarLineArt({
      body: built.bodyMeshes.map((m) => toTriMesh(m, inv)),
      all: built.allMeshes.map((m) => toTriMesh(m, inv)),
      wheels: PROCEDURAL_WHEELS,
      length: CAR.length,
      height: CAR.height,
      creaseAngle: 30,
      budget: 40000,
    });
    const panel = new THREE.LineSegments(built.panelLines, mats.panelLine);
    built.root.add(panel);
    return {
      root: built.root,
      spinners: built.spinners.map((s) => ({ obj: s, dir: (s.userData.spinDir as number) ?? 1 })),
      lines: lineGeometry(art.position, art.draw, art.cat),
      meshes: built.allMeshes,
      dims: { length: CAR.length, height: CAR.height, width: 2.0, axles: [CAR.axleRear, CAR.axleFront], wheelR: CAR.wheelR },
      extras: [],
    };
  }, []);
}

// ── Sourced glTF model ──────────────────────────────────────────────────────
const paintCache = new WeakMap<THREE.Material, THREE.Material>();

/**
 * Studio clearcoat over the model's own surface data. Single-material
 * models bake body, glass, tyres and trim into one albedo, so the source
 * albedo / normal / roughness / metalness maps are kept and a clear coat is
 * layered on top; the coat reuses the roughness map, so tyres stay matte while
 * painted panels gloss. Without an albedo texture the solid studio paint is used.
 */
export function paintFromSource(src: THREE.MeshStandardMaterial, fallback: THREE.MeshPhysicalMaterial) {
  const albedo = src.map ?? (src.emissiveMap as THREE.Texture | null);
  if (!albedo) return fallback;
  const cached = paintCache.get(src);
  if (cached) return cached;
  albedo.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.MeshPhysicalMaterial({
    map: albedo,
    color: "#ffffff",
    roughnessMap: src.roughnessMap ?? null,
    roughness: src.roughnessMap ? Math.min(1, src.roughness) : 0.32,
    metalness: 0.18,
    clearcoat: 1,
    clearcoatRoughness: 0.04,
    clearcoatRoughnessMap: src.roughnessMap ?? null,
    envMapIntensity: 1.25,
    clippingPlanes: fallback.clippingPlanes,
  });
  // Use the albedo as a mask instead of a colour: bright texels are painted
  // panels and become clean pearl paint; dark texels (glass, tyres, trim,
  // vents) keep a darkened version of their own colour. This removes the
  // reflections that auto-generated models bake into their textures.
  const paint = (fallback.color as THREE.Color).clone();
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uPaint = { value: paint };
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform vec3 uPaint;")
      .replace(
        "#include <map_fragment>",
        /* glsl */ `
        #ifdef USE_MAP
          vec4 texelColor = texture2D( map, vMapUv );
          float lum = dot( texelColor.rgb, vec3( 0.2126, 0.7152, 0.0722 ) );
          float body = smoothstep( 0.1, 0.2, lum );
          diffuseColor.rgb *= mix( texelColor.rgb * 0.55, uPaint, body );
        #endif
        `,
      );
  };
  m.customProgramCacheKey = () => "roadster-paint-mask";
  paintCache.set(src, m);
  return m;
}

function useGltfAssembly(manifest: ModelManifest): CarAssembly {
  const gltf = useGLTF(manifest.model, false, true);
  return useMemo(() => {
    const root = gltf.scene;
    root.updateMatrixWorld(true);
    const mats = createCarMaterials(sweepPlane);
    const paintNames = new Set(manifest.materials.paint);
    const glassNames = new Set(manifest.materials.glass);
    let lines: THREE.BufferGeometry | null = null;
    const meshes: THREE.Mesh[] = [];
    const remove: THREE.Object3D[] = [];

    root.traverse((o) => {
      if ((o as THREE.LineSegments).isLineSegments && o.name.toLowerCase().includes("lineart")) {
        // Attributes may arrive quantised (meshopt); getX() de-normalises and
        // the node matrix carries the position dequantisation transform.
        const g = (o as THREE.LineSegments).geometry;
        const pos = g.getAttribute("position");
        const draw = g.getAttribute("_draw");
        const cat = g.getAttribute("_cat");
        const n = pos.count;
        const p = new Float32Array(n * 3);
        const d = new Float32Array(n);
        const c = new Float32Array(n);
        const v = new THREE.Vector3();
        for (let i = 0; i < n; i++) {
          v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
          p[i * 3] = v.x; p[i * 3 + 1] = v.y; p[i * 3 + 2] = v.z;
          d[i] = draw.getX(i);
          c[i] = Math.round(cat.getX(i) * 8); // stored as cat / 8
        }
        lines = lineGeometry(p, d, c);
        remove.push(o);
        return;
      }
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mat = mesh.material as THREE.Material;
      const name = mat?.name ?? "";
      if (paintNames.has(name) || (!paintNames.size && MATERIAL_HINTS.paint.test(name))) {
        mesh.material = paintFromSource(mat as THREE.MeshStandardMaterial, mats.paint);
      } else if (glassNames.has(name)) {
        const g = mat as THREE.MeshPhysicalMaterial;
        const keepTransparent = g.transparent && g.opacity < 0.9;
        mesh.material = keepTransparent
          ? new THREE.MeshPhysicalMaterial({
              color: "#0b0e12", metalness: 0, roughness: 0.03, transparent: true, opacity: Math.max(0.35, g.opacity),
              clearcoat: 1, envMapIntensity: 1.6, clippingPlanes: [sweepPlane], depthWrite: false,
            })
          : mats.glass;
      } else if (Array.isArray(mesh.material)) {
        mesh.material.forEach((mm) => adaptGltfMaterial(mm, sweepPlane));
      } else if (mat) {
        adaptGltfMaterial(mat, sweepPlane);
      }
      mesh.castShadow = false;
      meshes.push(mesh);
    });
    remove.forEach((o) => o.parent?.remove(o));

    // Wheels: wrap each named wheel node in a pivot centred on its bounds.
    const spinners: Spinner[] = [];
    for (const name of manifest.wheelNodes) {
      const node = root.getObjectByName(name);
      if (!node || !node.parent) continue;
      const box = new THREE.Box3().setFromObject(node);
      const centreWorld = box.getCenter(new THREE.Vector3());
      const parent = node.parent;
      const centre = parent.worldToLocal(centreWorld.clone());
      const pivot = new THREE.Group();
      pivot.position.copy(centre);
      parent.add(pivot);
      pivot.attach(node);
      // Car-space axle axis (Z) expressed in the pivot's parent space.
      const qInv = parent.getWorldQuaternion(new THREE.Quaternion()).invert();
      spinners.push({ obj: pivot, dir: 1, axis: new THREE.Vector3(0, 0, 1).applyQuaternion(qInv).normalize() });
    }
    root.updateMatrixWorld(true);

    return {
      root,
      spinners,
      lines: lines ?? new THREE.BufferGeometry(),
      meshes,
      dims: manifest.dims,
      extras: [],
    };
  }, [gltf, manifest]);
}

// ── Scanner sheet: the red "laser" plane that materialises the car ──────────
function createScanner(height: number, width: number) {
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: { uOpacity: { value: 0 }, uColor: { value: new THREE.Color("#e31937") } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      uniform vec3 uColor;
      varying vec2 vUv;
      void main() {
        vec2 d = min(vUv, 1.0 - vUv);
        float edge = 1.0 - smoothstep(0.0, 0.012, min(d.x, d.y));
        float fill = 0.07 * (1.0 - abs(vUv.y - 0.5) * 1.4);
        float scan = 0.12 * smoothstep(0.0, 0.5, fract(vUv.y * 22.0)) * (1.0 - smoothstep(0.5, 1.0, fract(vUv.y * 22.0)));
        gl_FragColor = vec4(uColor, (edge * 0.9 + fill + scan * 0.25) * uOpacity);
      }
    `,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), mat);
  mesh.rotation.y = Math.PI / 2;
  mesh.position.y = height / 2 - 0.04;
  mesh.renderOrder = 8;
  return { mesh, mat };
}

// ── Cold-gas thruster plumes ────────────────────────────────────────────────
// Rear cluster (Thrust: four nozzles in the diffuser) plus the Rocket's
// perimeter jets — one per corner firing down for lift/attitude and one per
// flank for yaw — as seen radiating from the car in the reveal footage.
function plumeMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: { uThrust: { value: 0 }, uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      uniform float uThrust, uTime;
      varying vec2 vUv;
      float hash(float n) { return fract(sin(n) * 43758.5453); }
      void main() {
        // vUv.y: 1 at the nozzle → 0 at the plume tail
        float along = vUv.y;
        float flicker = 0.75 + 0.25 * hash(floor(uTime * 40.0) + vUv.x * 3.0);
        float core = pow(along, 1.6);
        float a = core * uThrust * flicker * 0.85;
        vec3 col = mix(vec3(0.75, 0.82, 0.95), vec3(1.0), core);
        gl_FragColor = vec4(col * a, a);
      }
    `,
  });
}

function createPlumes(length: number, height: number, perimeter: { pos: THREE.Vector3; dir: THREE.Vector3 }[]) {
  const mat = plumeMaterial();
  const auxMat = plumeMaterial();
  const group = new THREE.Group();
  const rear = new THREE.Group();
  const aux = new THREE.Group();
  group.add(rear, aux);
  // cone with its apex at the origin pointing along +Y, flaring along −Y
  const cone = (len: number, r: number) => {
    const g = new THREE.ConeGeometry(r, len, 20, 1, true);
    g.translate(0, -len / 2, 0);
    return g;
  };
  const rearGeo = cone(1.5, 0.16);
  const auxGeo = cone(1.1, 0.14);
  const down = new THREE.Vector3(0, -1, 0);
  const place = (geo: THREE.BufferGeometry, m: THREE.Material, pos: THREE.Vector3, dir: THREE.Vector3, parent: THREE.Group) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.copy(pos);
    mesh.quaternion.setFromUnitVectors(down, dir.clone().normalize());
    mesh.renderOrder = 10;
    mesh.frustumCulled = false;
    parent.add(mesh);
  };
  for (const z of [-0.62, -0.22, 0.22, 0.62]) {
    place(rearGeo, mat, new THREE.Vector3(-length / 2 + 0.02, height * 0.3, z), new THREE.Vector3(-1, -0.12, 0), rear);
  }
  for (const n of perimeter) {
    // corners splay slightly outward, producing the X-shaped plume pattern
    const d = n.dir.clone();
    if (d.y < -0.5) d.add(new THREE.Vector3(Math.sign(n.pos.x) * 0.35, 0, Math.sign(n.pos.z) * 0.35));
    place(auxGeo, auxMat, n.pos, d, aux);
  }
  group.userData.noShadowBake = true;
  return { group, rear, aux, mat, auxMat };
}

// ── The rig that hosts either car source ────────────────────────────────────
function CarRig({ asm }: { asm: CarAssembly }) {
  const group = useRef<THREE.Group>(null);
  const { gl, scene } = useThree();
  const pivotRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Group>(null);
  const baked = useRef(0);
  const L = asm.dims.length;
  /** roll axis height ≈ centre of mass */
  const pivotY = asm.dims.height * 0.45;

  const parts = useMemo(() => {
    const lineMat = createLineMaterial();
    const lines = new THREE.LineSegments(asm.lines, lineMat);
    lines.renderOrder = 6;
    lines.frustumCulled = false;

    const consMat = createLineMaterial();
    const cons = buildConstruction(asm.dims);
    const construction = new THREE.LineSegments(cons.geometry, consMat);
    construction.renderOrder = 7;
    construction.frustumCulled = false;

    const depthMat = new THREE.MeshBasicMaterial({
      colorWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: 2,
      polygonOffsetUnits: 6,
    });
    const depth = new THREE.Group();
    const inv = new THREE.Matrix4().copy(asm.root.matrixWorld).invert();
    for (const m of asm.meshes) {
      const d = new THREE.Mesh(m.geometry, depthMat);
      d.matrixAutoUpdate = false;
      d.matrix.multiplyMatrices(inv, m.matrixWorld);
      d.renderOrder = -10;
      depth.add(d);
    }

    const shadow = createContactShadow(L + 1.6, asm.dims.width + 1.4, asm.dims.height * 1.25);
    const scanner = createScanner(asm.dims.height * 1.3, asm.dims.width * 1.2);
    const anatomy = buildAnatomy(asm.dims);
    const plumes = createPlumes(L, asm.dims.height, anatomy.perimeterNozzles);

    // X-ray: every body material fades with hashed alpha (no sorting issues)
    // while a fresnel ghost of the same geometry keeps the silhouette.
    const bodyMats = new Set<THREE.Material>();
    asm.root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach((m) => {
        if (!m.userData.xrayReady) {
          m.userData.xrayReady = true;
          m.userData.baseOpacity = m.opacity;
          m.alphaHash = true;
          m.needsUpdate = true;
        }
        bodyMats.add(m);
      });
    });
    const ghostMat = createGhostMaterial();
    const ghost = new THREE.Group();
    for (const m of asm.meshes) {
      const gm = new THREE.Mesh(m.geometry, ghostMat);
      gm.matrixAutoUpdate = false;
      gm.matrix.multiplyMatrices(inv, m.matrixWorld);
      gm.renderOrder = 12;
      ghost.add(gm);
    }
    ghost.visible = false;
    ghost.userData.noShadowBake = true;

    return { lineMat, lines, consMat, construction, cons, depth, shadow, scanner, plumes, anatomy, bodyMats: [...bodyMats], ghost, ghostMat };
  }, [asm, L]);

  // Register projected DOM labels: drawing dimensions + anatomy callouts.
  useEffect(() => {
    const map: Record<string, [number, number, number]> = { ...parts.cons.anchors };
    for (const p of parts.anatomy.parts) map[`x-${p.key}`] = p.anchor;
    const els = document.querySelectorAll<HTMLElement>("[data-anchor]");
    domSync.labels = Array.from(els)
      .filter((el) => map[el.dataset.anchor!])
      .map((el) => ({ el, anchor: map[el.dataset.anchor!] }));
    return () => {
      domSync.labels = [];
    };
  }, [parts]);

  useEffect(() => {
    domSync.car = group.current;
    domSync.carLength = L;
    domSync.carHeight = asm.dims.height;
    return () => {
      domSync.car = null;
    };
  }, [L, asm.dims.height]);

  useEffect(() => () => {
    parts.shadow.dispose();
    parts.lineMat.dispose();
    parts.consMat.dispose();
  }, [parts]);

  const v = useMemo(() => ({ n: new THREE.Vector3(), p: new THREE.Vector3(), q: new THREE.Quaternion() }), []);

  useFrame(() => {
    const g = group.current;
    if (!g) return;

    if (baked.current < 3) {
      baked.current++;
      if (baked.current === 3) {
        g.updateMatrixWorld(true);
        const hide: THREE.Object3D[] = [];
        scene.traverse((o) => { if (o.userData.noShadowBake) hide.push(o); });
        hide.push(parts.lines, parts.construction, parts.scanner.mesh, parts.depth);
        const wasVisible = asm.root.visible;
        asm.root.visible = true;
        parts.shadow.bake(gl, scene, hide);
        asm.root.visible = wasVisible;
        store.set({ ready: true, progress: 1 });
      }
    }

    // Ground frame (position, heading) carries the shadow; the body pivots
    // about its centre of mass for lifts and barrel rolls above it.
    g.position.set(rig.car.x, 0, rig.car.z);
    g.rotation.y = rig.car.rotY * D2R;
    g.visible = rig.car.visible > 0.001;
    const pivot = pivotRef.current!;
    const lift = Math.max(0, rig.car.y);
    pivot.position.y = pivotY + lift;
    pivot.rotation.set(rig.car.roll * D2R, 0, rig.car.pitch * D2R);
    g.updateMatrixWorld();
    const body = bodyRef.current!;

    // Scanner sweep: nose (+X) to tail, in the body's frame.
    const margin = 0.08;
    const sweepX = THREE.MathUtils.lerp(L / 2 + margin, -L / 2 - margin, rig.sweep);
    v.n.set(1, 0, 0).applyQuaternion(body.getWorldQuaternion(v.q));
    v.p.set(sweepX, 0, 0).applyMatrix4(body.matrixWorld);
    sweepPlane.setFromNormalAndCoplanarPoint(v.n, v.p);
    asm.root.visible = rig.sweep > 0.001;

    const sweeping = rig.sweep > 0.001 && rig.sweep < 0.999;
    parts.scanner.mesh.visible = sweeping;
    parts.scanner.mesh.position.x = sweepX;
    parts.scanner.mat.uniforms.uOpacity.value = Math.sin(Math.min(1, rig.sweep * 1.02) * Math.PI);

    const draw = Math.max(rig.introDraw, rig.draw);
    const lu = parts.lineMat.uniforms;
    lu.uProgress.value = draw;
    lu.uOpacity.value = rig.lines;
    lu.uSweepX.value = sweepX;
    lu.uSweepOn.value = rig.sweep > 0.001 ? 1 : 0;
    parts.lines.visible = rig.lines > 0.002 && draw > 0;

    const cu = parts.consMat.uniforms;
    cu.uProgress.value = Math.max(rig.introConstruct, rig.construct) * 0.61;
    cu.uErase.value = rig.constructOut * 0.62 - 0.001;
    cu.uOpacity.value = 1;
    parts.construction.visible = rig.constructOut < 0.999 && cu.uProgress.value > 0;

    // X-ray: body → ghost, line drawing returns as a cyan skeleton, internals reveal.
    const xr = rig.xray;
    lu.uXray.value = xr;
    for (const m of parts.bodyMats) m.opacity = (m.userData.baseOpacity ?? 1) * (1 - xr);
    if (xr > 0.995) asm.root.visible = false; // fully ghosted: skip the hashed body entirely
    parts.ghost.visible = xr > 0.005;
    parts.ghostMat.uniforms.uAmount.value = xr;
    parts.depth.visible = (parts.lines.visible || parts.construction.visible) && xr < 0.005;
    parts.anatomy.root.visible = xr > 0.005;
    parts.anatomy.parts.forEach((p, i) => {
      const k = rig.anat[i] ?? 0;
      p.group.visible = k > 0.005;
      if (!p.group.visible) return;
      p.group.position.y = (1 - k) * -0.08;
      for (const m of p.materials) m.opacity = (m.userData.baseOpacity ?? 1) * k;
    });
    if (parts.anatomy.root.visible && !rig.reducedMotion) {
      const fan = parts.anatomy.root.getObjectByName("suction-fan");
      if (fan) fan.rotation.y += 0.12;
    }

    // Shadow stays on the floor: it tightens away and softens as the car lifts.
    const air = THREE.MathUtils.smoothstep(lift, 0, 0.9);
    parts.shadow.tight.opacity = rig.shadow * 0.92 * (1 - air);
    parts.shadow.soft.opacity = rig.shadow * 0.55 * (1 - air * 0.55);
    parts.shadow.group.scale.setScalar(1 + air * 0.25);

    const now = rig.reducedMotion ? 0 : performance.now() / 1000;
    parts.plumes.rear.visible = rig.thrust > 0.01;
    parts.plumes.mat.uniforms.uThrust.value = rig.thrust;
    parts.plumes.mat.uniforms.uTime.value = now;
    parts.plumes.aux.visible = rig.thrustAux > 0.01;
    parts.plumes.auxMat.uniforms.uThrust.value = rig.thrustAux;
    parts.plumes.auxMat.uniforms.uTime.value = now;

    for (const s of asm.spinners) {
      if (s.axis) s.obj.quaternion.setFromAxisAngle(s.axis, -rig.car.spin * s.dir);
      else s.obj.rotation.z = -rig.car.spin * s.dir;
    }
  });

  return (
    <group ref={group}>
      <primitive object={parts.shadow.group} />
      <group ref={pivotRef} position-y={pivotY}>
        <group ref={bodyRef} position-y={-pivotY}>
          <primitive object={asm.root} />
          <primitive object={parts.depth} />
          <primitive object={parts.lines} />
          <primitive object={parts.construction} />
          <primitive object={parts.scanner.mesh} />
          <primitive object={parts.plumes.group} />
          <primitive object={parts.anatomy.root} />
          <primitive object={parts.ghost} />
        </group>
      </group>
    </group>
  );
}

export function ProceduralRoadsterModel() {
  const asm = useProceduralAssembly();
  return <CarRig asm={asm} />;
}

export function GltfRoadsterModel({ manifest }: { manifest: ModelManifest }) {
  const asm = useGltfAssembly(manifest);
  return <CarRig asm={asm} />;
}
