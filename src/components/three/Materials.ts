import * as THREE from "three";

// Studio materials tuned for a neutral tone-mapped, light-studio look.
// Every car material shares one clipping plane: the "scanner" that sweeps
// from nose to tail during the wireframe → photoreal transition.

/** Production Roadster launch colour, "Ano White" (pearl white). */
export const PAINT_WHITE = new THREE.Color("#ecebe6");

export type CarMaterials = ReturnType<typeof createCarMaterials>;

let flakeTex: THREE.DataTexture | null = null;

/**
 * Metallic-flake normal map. Real metallic paint is a base coat of aluminium
 * flakes, each tilted slightly differently, under a smooth clear coat. Here
 * every texel is a randomly tilted flake normal; three.js applies `normalMap`
 * to the base layer only (the clear coat keeps the smooth geometric normal),
 * which reproduces the sparkle-under-glass "flop" of real paint.
 */
export function getFlakeTexture() {
  if (flakeTex) return flakeTex;
  const size = 256;
  const data = new Uint8Array(size * size * 4);
  let seed = 1337;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < size * size; i++) {
    const tilt = 0.55 * Math.pow(rnd(), 1.5);
    const a = rnd() * Math.PI * 2;
    const x = Math.cos(a) * tilt, y = Math.sin(a) * tilt;
    const z = Math.sqrt(Math.max(0, 1 - x * x - y * y));
    data[i * 4] = (x * 0.5 + 0.5) * 255;
    data[i * 4 + 1] = (y * 0.5 + 0.5) * 255;
    data[i * 4 + 2] = (z * 0.5 + 0.5) * 255;
    data[i * 4 + 3] = 255;
  }
  flakeTex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  flakeTex.wrapS = flakeTex.wrapT = THREE.RepeatWrapping;
  flakeTex.magFilter = THREE.LinearFilter;
  flakeTex.minFilter = THREE.LinearMipmapLinearFilter;
  flakeTex.generateMipmaps = true;
  flakeTex.anisotropy = 4;
  flakeTex.repeat.set(3, 3);
  flakeTex.needsUpdate = true;
  return flakeTex;
}

export function createCarMaterials(sweepPlane: THREE.Plane) {
  const clip = [sweepPlane];

  const paintParams: THREE.MeshPhysicalMaterialParameters = {
    color: PAINT_WHITE,
    metalness: 0.22,
    roughness: 0.32,
    clearcoat: 1,
    clearcoatRoughness: 0.03,
    envMapIntensity: 1.3,
    normalMap: getFlakeTexture(),
    normalScale: new THREE.Vector2(0.22, 0.22),
    clippingPlanes: clip,
  };

  const m = {
    paint: new THREE.MeshPhysicalMaterial(paintParams),
    /** paint × vertex colour, used where trim is baked into the loft */
    paintVC: new THREE.MeshPhysicalMaterial({ ...paintParams, vertexColors: true }),
    // "Gold Glazed" glass: near-black with warm gold specular reflections
    glass: new THREE.MeshPhysicalMaterial({
      color: "#0b0906",
      specularColor: new THREE.Color("#e2b45c"),
      specularIntensity: 1,
      metalness: 0.1,
      roughness: 0.04,
      clearcoat: 1,
      clearcoatRoughness: 0.02,
      envMapIntensity: 1.6,
      clippingPlanes: clip,
    }),
    rubber: new THREE.MeshStandardMaterial({ color: "#121212", roughness: 0.86, metalness: 0, clippingPlanes: clip }),
    rim: new THREE.MeshPhysicalMaterial({
      color: "#3a3c40",
      metalness: 1,
      roughness: 0.28,
      clearcoat: 0.6,
      clearcoatRoughness: 0.1,
      clippingPlanes: clip,
    }),
    rimInner: new THREE.MeshStandardMaterial({ color: "#1b1c1f", metalness: 0.9, roughness: 0.45, side: THREE.DoubleSide, clippingPlanes: clip }),
    brake: new THREE.MeshStandardMaterial({ color: "#6d6f73", metalness: 1, roughness: 0.38, clippingPlanes: clip }),
    caliper: new THREE.MeshStandardMaterial({ color: "#c8101e", metalness: 0.3, roughness: 0.4, clippingPlanes: clip }),
    trimGloss: new THREE.MeshPhysicalMaterial({ color: "#050506", metalness: 0.2, roughness: 0.12, clearcoat: 1, clippingPlanes: clip }),
    trimMatte: new THREE.MeshStandardMaterial({ color: "#0b0b0c", metalness: 0.1, roughness: 0.7, clippingPlanes: clip }),
    headlight: new THREE.MeshStandardMaterial({
      color: "#ffffff",
      emissive: "#f4f8ff",
      emissiveIntensity: 2.2,
      roughness: 0.2,
      clippingPlanes: clip,
    }),
    taillight: new THREE.MeshStandardMaterial({
      color: "#5a0006",
      emissive: "#ff1a2a",
      emissiveIntensity: 1.6,
      roughness: 0.25,
      clippingPlanes: clip,
    }),
    panelLine: new THREE.LineBasicMaterial({ color: "#2a0306", transparent: true, opacity: 0.55, clippingPlanes: clip }),
  };
  return m;
}

/** Keywords used to classify materials of a sourced glTF model. */
export const MATERIAL_HINTS = {
  paint: /(paint|body|carpaint|car_paint|exterior|red|color|colour|kuzov|lak)/i,
  glass: /(glass|window|windshield|windscreen|steklo)/i,
  rubber: /(tire|tyre|rubber|shina)/i,
  light: /(light|lamp|led|emiss|fara)/i,
};

/** Upgrade an arbitrary glTF material so it sits well in the studio and obeys the sweep. */
export function adaptGltfMaterial(mat: THREE.Material, plane: THREE.Plane) {
  mat.clippingPlanes = [plane];
  const std = mat as THREE.MeshStandardMaterial;
  if (std.isMeshStandardMaterial) {
    std.envMapIntensity = 1.15;
  }
  mat.needsUpdate = true;
  return mat;
}
