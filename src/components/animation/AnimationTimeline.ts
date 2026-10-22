// Scene map for the master timeline. Units are arbitrary "beats"; the whole
// story spans SCENES.end beats and is stretched over TRACK_VH of scroll.

export const SCENES = {
  intro: 0,
  reveal: 6,
  performance: 20,
  anatomy: 37,
  motion: 52,
  showcase: 72,
  split: 86,
  type: 96,
  finale: 104,
  stunts: 109,
  end: 138,
} as const;

export type SceneName = keyof typeof SCENES;

/** total scroll length of the experience, in viewport heights (~13.5 vh per beat) */
export const TRACK_VH = 1860;

export const NAV_ITEMS: { label: string; scene: SceneName }[] = [
  { label: "Design", scene: "reveal" },
  { label: "Performance", scene: "performance" },
  { label: "Anatomy", scene: "anatomy" },
  { label: "Stunts", scene: "stunts" },
];

/**
 * Figures Tesla presented at the 15 Oct 2026 Roadster reveal. They are
 * company claims for a car scheduled for 2028 production; the 0.81 s run was
 * shown on a driverless demo car with thrusters engaged and was not
 * independently timed.
 */
export const CONCEPT_FIGURES = [
  { label: "0–60 mph · reveal run", value: 0.81, decimals: 2, unit: "s", suffix: "" },
  { label: "Top speed", value: 230, decimals: 0, unit: "mph", suffix: "+" },
  { label: "Range", value: 300, decimals: 0, unit: "mi", suffix: "" },
] as const;

/** Configurations announced at the reveal (Tesla claims). */
export const TRIMS = [
  { name: "Performance", tag: "Road ready", zeroToSixty: "< 1.6 s", seats: 2 },
  { name: "Thrust", tag: "Race ready · rear cold-gas thrusters", zeroToSixty: "< 0.9 s", seats: 2 },
  { name: "Rocket", tag: "Air ready · 10 thrusters · invite only", zeroToSixty: "< 0.59 s", seats: 1 },
] as const;

/** Published wheelbase (Wikipedia, 111.2 in). */
export const WHEELBASE_MM = 2825;
