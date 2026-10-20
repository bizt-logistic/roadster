// Stunt trajectories recreated from coverage of Tesla's 15 Oct 2026 Roadster
// reveal (driverless demo car):
//   • the thruster launch + barrel roll (performance band)
//   • the inverted ramp: suction holds the car as it climbs a curved ramp
//     until upside down, cold-gas thrusters fire, it flips and lands
//   • the hop: a barrel roll over a lineup of Tesla vehicles
//
// Each stunt is a pure function of progress p ∈ [0, 1] returning the car's
// ground-frame pose. The scroll timeline drives p; the smoke-trail system
// samples the very same functions, so trails always match the motion and
// rewind correctly when scrolling backwards.

export type Pose = { x: number; y: number; roll: number; pitch: number; thrust: number; aux?: number };

const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
const seg = (p: number, a: number, b: number) => clamp01((p - a) / (b - a));
const smooth = (t: number) => t * t * (3 - 2 * t);
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t: number) => 1 - Math.pow(1 - t, 2);
const easeIn = (t: number) => t * t;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** thrust envelope: on between a and b with short fades */
const burst = (p: number, a: number, b: number, fade = 0.03) =>
  Math.min(seg(p, a, a + fade), 1 - seg(p, b - fade, b));

// ── Performance band: launch, full barrel roll, land ──────────────────────
export const FLIP = { x0: 0.32, x1: 0.62, apex: 0.95 };

export function flipPose(p: number): Pose {
  const up = seg(p, 0, 0.36), down = seg(p, 0.36, 0.73);
  let y = p < 0.36 ? FLIP.apex * easeOut(up) : FLIP.apex * (1 - easeIn(down));
  if (p > 0.73) y = 0.045 * Math.sin(Math.PI * seg(p, 0.73, 0.88)); // suspension rebound
  const roll = 360 * easeInOut(seg(p, 0.06, 0.67));
  const pitch = p < 0.36 ? 5 * easeOut(up) : p < 0.77 ? lerp(5, -2.5, smooth(seg(p, 0.36, 0.77))) : lerp(-2.5, 0, easeOut(seg(p, 0.77, 1)));
  return { x: lerp(FLIP.x0, FLIP.x1, p), y: Math.max(0, y), roll, pitch, thrust: burst(p, 0, 0.42), aux: burst(p, 0.04, 0.62) };
}

// ── Finale arena layout ───────────────────────────────────────────────────
export const ARENA = {
  rampX: -26,
  rampR: 4.2,
  rampWidth: 2.8,
  approach: -44,
  landX: -31,
  hopFrom: -10.5,
  hopTo: 11,
  hopApex: 5.4,
  stopX: 21,
};

/** pivotY: height of the roll/pitch pivot above the ground (car centre of mass) */
export function rampPose(p: number, pivotY: number): Pose {
  const { rampX: x0, rampR: R, approach, landX } = ARENA;
  const r = R - pivotY;
  if (p < 0.2) {
    const t = seg(p, 0, 0.2);
    return { x: lerp(approach, x0, t * t * 0.4 + t * 0.6), y: 0, roll: 0, pitch: 0, thrust: 0 };
  }
  if (p < 0.55) {
    // suction climb around the inside of the curved ramp, ending inverted
    const th = Math.PI * easeInOut(seg(p, 0.2, 0.55));
    return { x: x0 + r * Math.sin(th), y: r * (1 - Math.cos(th)), roll: 0, pitch: (th * 180) / Math.PI, thrust: 0 };
  }
  const yTop = 2 * r;
  if (p < 0.86) {
    // thrusters fire: release, half flip, land back on four wheels
    const s = seg(p, 0.55, 0.86);
    return {
      x: lerp(x0, landX, easeOut(s)),
      y: yTop * (1 - easeIn(s)),
      roll: 0,
      pitch: 180 + 180 * easeInOut(s),
      thrust: burst(p, 0.53, 0.8),
      aux: burst(p, 0.56, 0.86),
    };
  }
  const b = seg(p, 0.86, 1);
  return { x: landX, y: 0.07 * Math.sin(Math.PI * Math.min(1, b * 2.2)) * (1 - b), roll: 0, pitch: 360, thrust: 0 };
}

export function hopPose(p: number): Pose {
  const { landX, hopFrom, hopTo, hopApex, stopX } = ARENA;
  if (p < 0.3) {
    const t = seg(p, 0, 0.3);
    return { x: lerp(landX, hopFrom, t * t), y: 0, roll: 0, pitch: 0, thrust: burst(p, 0.22, 0.32) };
  }
  if (p < 0.76) {
    const s = seg(p, 0.3, 0.76);
    return {
      x: lerp(hopFrom, hopTo, smooth(s)),
      y: hopApex * Math.pow(Math.sin(Math.PI * s), 0.55),
      roll: 360 * easeInOut(seg(s, 0.12, 0.88)),
      pitch: 6 * Math.sin(Math.PI * s) - 3 * s,
      thrust: burst(p, 0.29, 0.62),
      aux: burst(p, 0.3, 0.78),
    };
  }
  const t = seg(p, 0.76, 1);
  return {
    x: lerp(hopTo, stopX, easeOut(t)),
    y: 0.06 * Math.sin(Math.PI * Math.min(1, t * 3)) * (1 - t),
    roll: 0,
    pitch: -2 * (1 - smooth(t)),
    thrust: 0,
  };
}

/** Where each stunt touches down (x) and at what progress — for landing clouds. */
export const LANDINGS = { ramp: { x: ARENA.landX, p: 0.86 }, hop: { x: ARENA.hopTo, p: 0.76 } };

/** Vehicles in the hop lineup (as reported; parked abreast, noses to camera). */
export const LINEUP = [
  { name: "Model 3", kind: "sedan", width: 1.95, length: 4.7, height: 1.44, color: "#1f3a8a" },
  { name: "Model Y", kind: "suv", width: 2.0, length: 4.8, height: 1.62, color: "#a3101a" },
  { name: "Semi", kind: "semi", width: 2.55, length: 6.4, height: 3.65, color: "#f2f2ef" },
  { name: "Cybertruck", kind: "truck", width: 2.2, length: 5.7, height: 1.9, color: "#9aa0a6" },
  { name: "Cybercab", kind: "cab", width: 1.95, length: 4.3, height: 1.5, color: "#c8a96a" },
] as const;
