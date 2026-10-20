// The single mutable source of truth for every animated value in the
// experience. GSAP tweens write into it; the WebGL frame loop and a handful of
// DOM sync routines read from it. Nothing here touches React state, so the
// scroll timeline never causes re-renders.

import type { Object3D } from "three";

export type CamState = {
  /** azimuth in degrees: 0 = side profile (nose right), 90 = front, -90 = rear */
  az: number;
  /** elevation in degrees above the horizon */
  el: number;
  dist: number;
  tx: number;
  ty: number;
  tz: number;
  fov: number;
  /** screen-space framing offset as a fraction of the viewport */
  sx: number;
  sy: number;
};

export type PanelCam = { az: number; el: number; dist: number; ty: number; fov: number };

export const rig = {
  // ── line drawing ────────────────────────────────────────────────
  /** autoplay intro drawing progress */
  introDraw: 0,
  /** scroll-linked drawing progress (combined with introDraw via max) */
  draw: 0,
  /** construction lines (ground, axles, dimensions) */
  introConstruct: 0,
  construct: 0,
  constructOut: 0,
  /** global line opacity */
  lines: 1,
  // ── material reveal ─────────────────────────────────────────────
  /** 0 → nothing solid, 1 → fully rendered (front to rear sweep) */
  sweep: 0,
  shadow: 0,
  // ── camera + vehicle ────────────────────────────────────────────
  cam: { az: 0, el: 2, dist: 13.5, tx: 0, ty: 0.62, tz: 0, fov: 18, sx: 0, sy: 0.04 } as CamState,
  /** y = lift off the ground, roll = barrel-roll about the long axis (deg), pitch (deg) */
  car: { x: 0, z: 0, y: 0, rotY: 0, roll: 0, pitch: 0, spin: 0, visible: 1 },
  /** studio environment yaw (rad) — slides reflections across the paint */
  envRot: 0,
  /** cold-gas thruster output 0..1 (rear plumes) */
  thrust: 0,
  /** stunt progress (see lib/stunts.ts); values > 1 let trails dissipate */
  stunt: { flip: 0, ramp: 0, hop: 0 },
  /** finale arena visibility */
  arena: 0,
  /** perimeter (Rocket) thruster output 0..1 — corner lift + flank yaw jets */
  thrustAux: 0,
  /** X-ray anatomy: body fades to a fresnel ghost, internals reveal */
  xray: 0,
  /** per-system reveal 0..1: structure, battery, motors, tanks, thrusters, fan */
  anat: [0, 0, 0, 0, 0, 0],
  // ── showcase (multi-viewport) ───────────────────────────────────
  split: 0,
  splitOut: 0,
  panels: [
    { az: -90, el: 89, dist: 9, ty: 0.4, fov: 30 },
    { az: 40, el: 10, dist: 6.4, ty: 0.5, fov: 26 },
    { az: -140, el: 8, dist: 6.4, ty: 0.5, fov: 26 },
  ] as PanelCam[],
  // ── atmosphere + lighting ───────────────────────────────────────
  /** smoke rolling up over the screen (0 → covered) */
  smokeCover: 0,
  /** smoke clearing upwards again (0 → 1 revealed) */
  smokeClear: 0,
  /** low-lying floor haze for the final composition */
  smokeFloor: 0,
  /** screen-space y (px) of the car's tail, used by the vertical red wake */
  tailY: 0,
  env: 1,
  rim: 0,
  idle: 1,
  reducedMotion: false,
};

export type Rig = typeof rig;

// DOM nodes the WebGL loop keeps in sync (labels, panel backgrounds).
export const domSync = {
  labels: [] as { el: HTMLElement; anchor: [number, number, number] }[],
  panels: [] as HTMLElement[],
  wake: null as HTMLElement | null,
  /** car group (set by the 3D rig) and its length, for projections */
  car: null as Object3D | null,
  carLength: 4.5,
  carHeight: 1.14,
};
